import mapboxgl from 'mapbox-gl';

export interface ElevationDataPoint {
  elevation: number;
  distance: number;
  coordinates: [number, number];
}

export interface ElevationResult {
  elevations: number[];
  elevationData: ElevationDataPoint[];
  highestPoint: number;
  lowestPoint: number;
  totalAscent: number;
  totalDescent: number;
  totalDistanceKm: number;
}

/**
 * Haversine distance between two [lng, lat] coordinate pairs, in km.
 */
function haversineDistance(
  a: [number, number],
  b: [number, number]
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const aVal =
    sinLat * sinLat +
    Math.cos((a[1] * Math.PI) / 180) *
    Math.cos((b[1] * Math.PI) / 180) *
    sinLon * sinLon;
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}

/**
 * Smooth elevation array with a moving-average window.
 * Preserves array length; edges use a narrower window.
 */
function smoothElevations(
  elevations: number[],
  windowSize: number = 5
): number[] {
  if (elevations.length <= windowSize) return [...elevations];

  const half = Math.floor(windowSize / 2);
  const smoothed: number[] = new Array(elevations.length);

  for (let i = 0; i < elevations.length; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(elevations.length - 1, i + half);
    let sum = 0;
    for (let j = lo; j <= hi; j++) {
      sum += elevations[j];
    }
    smoothed[i] = sum / (hi - lo + 1);
  }

  return smoothed;
}
/**
 * Ensure the map has a DEM source and terrain enabled.
 * If already present, this is a no-op.
 */
function ensureTerrain(map: mapboxgl.Map): void {
  if (!map.getSource('mapbox-dem')) {
    console.log('[Mapbox Elevation] Adding terrain source...');
    map.addSource('mapbox-dem', {
      type: 'raster-dem',
      url: 'mapbox://mapbox.terrain-rgb',
      tileSize: 512,
      maxzoom: 14,
    });
  }

  // Always call setTerrain to ensure it's active
  map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
}

/**
 * Fit the map to the route bounding box and wait until all tiles
 * (including terrain) are loaded. This ensures queryTerrainElevation
 * can return valid data for every coordinate.
 *
 * Returns the previous camera state so it can be restored later.
 */
async function fitToRouteAndWait(
  map: mapboxgl.Map,
  coordinates: [number, number][]
): Promise<{
  center: mapboxgl.LngLat;
  zoom: number;
  pitch: number;
  bearing: number;
}> {
  // Save current camera state
  const savedState = {
    center: map.getCenter(),
    zoom: map.getZoom(),
    pitch: map.getPitch(),
    bearing: map.getBearing(),
  };

  // Compute bounding box of the route
  const bounds = new mapboxgl.LngLatBounds();
  for (const coord of coordinates) {
    bounds.extend(coord);
  }

  // Fly/jump the map to encompass the entire route at zoom ≤14
  // (terrain maxzoom=14, so we need a zoom that loads terrain for the whole area).
  // Use jumpTo (instant) instead of flyTo to avoid waiting for animation.
  map.fitBounds(bounds, {
    padding: 50,
    maxZoom: 14,
    pitch: 0,
    bearing: 0,
    animate: false, // instant jump
  });

  // Wait for all tiles (including terrain DEM) to be loaded
  await new Promise<void>(resolve => {
    map.once('idle', () => resolve());
  });

  return savedState;
}

/**
 * Restore the camera to a previously saved state.
 */
function restoreCamera(
  map: mapboxgl.Map,
  state: { center: mapboxgl.LngLat; zoom: number; pitch: number; bearing: number }
): void {
  map.jumpTo({
    center: state.center,
    zoom: state.zoom,
    pitch: state.pitch,
    bearing: state.bearing,
  });
}

/**
 * Gets elevation data for route coordinates using Mapbox's queryTerrainElevation.
 *
 * Features:
 * 1. Fits map to route bounds and waits for idle → terrain tiles loaded for ALL points
 * 2. Calculates actual Haversine distances between consecutive points
 * 3. Returns raw elevation values — no smoothing or filtering applied
 * 4. Returns full ElevationDataPoint[] with { elevation, distance, coordinates }
 */
/**
 * Options for elevation queries.
 * - `preserveCamera` (default false): skip the fitBounds+wait+restore dance
 *   so the user's viewport is not disturbed. When true, only coordinates
 *   whose DEM tiles are already loaded return real elevations; if more than
 *   half return null we throw so callers can defer to an explicit
 *   full-fidelity calculation instead of storing garbage data.
 */
export interface ElevationOptions {
  preserveCamera?: boolean;
}

export async function getMapboxElevation(
  map: mapboxgl.Map,
  coordinates: [number, number][],
  options: ElevationOptions = {}
): Promise<ElevationResult> {
  const preserveCamera = options.preserveCamera === true;
  console.log(
    `[Mapbox Elevation] Querying elevations for ${coordinates.length} points (preserveCamera=${preserveCamera})...`
  );

  try {
    // 1. Ensure terrain is enabled
    ensureTerrain(map);

    // 2. Fit the map to the route extent so DEM tiles load for the whole
    //    area — skipped when the caller doesn't want the camera to move
    //    (e.g. auto-elevation on waypoint add). In that mode we accept
    //    that some coordinates may return null and bail out if too many do.
    const savedCamera = preserveCamera
      ? null
      : await fitToRouteAndWait(map, coordinates);
    if (!preserveCamera) {
      console.log('[Mapbox Elevation] Map fitted to route bounds and idle — terrain tiles loaded');
    }

    // 3. Query raw elevation for every coordinate
    const rawElevations: number[] = [];
    let nullCount = 0;

    for (let i = 0; i < coordinates.length; i++) {
      const coord = coordinates[i]!;
      const elevation = map.queryTerrainElevation(
        { lng: coord[0], lat: coord[1] },
        { exaggerated: false }
      );

      if (elevation !== null && elevation !== undefined) {
        rawElevations.push(elevation);
      } else {
        nullCount++;
        // Interpolate from last valid value
        rawElevations.push(
          rawElevations.length > 0
            ? rawElevations[rawElevations.length - 1]!
            : 0
        );
      }
    }

    console.log(
      `[Mapbox Elevation] Raw query: ${coordinates.length - nullCount} valid, ${nullCount} null`
    );

    // In preserveCamera mode we may be zoomed too far in for most of the
    // route to have loaded DEM tiles. Throwing here keeps the caller's
    // state untouched so a later explicit calculation can produce accurate
    // stats rather than storing an all-flat fallback line.
    if (preserveCamera && nullCount > coordinates.length / 2) {
      throw new Error('TILES_NOT_LOADED');
    }

    // 4. Restore the camera position so the user doesn't see a flicker
    if (savedCamera) restoreCamera(map, savedCamera);

    // 5. Smooth the raw elevations with a 5-point moving average.
    // Testing with the Komoot GPX reference showed that Smooth(5) on DEM data
    // recovers ascent/descent values within 1.3% of the GPX reference.
    // (Raw DEM gives ~7000m vs GPX's ~4447m; Smooth(5) gives ~4506m)
    const smoothed = smoothElevations(rawElevations, 5);

    // 6. Calculate actual distances using Haversine between consecutive points
    const distances: number[] = [0];
    let accumulatedKm = 0;
    for (let i = 1; i < coordinates.length; i++) {
      accumulatedKm += haversineDistance(coordinates[i - 1], coordinates[i]);
      distances.push(Math.round(accumulatedKm * 100) / 100);
    }

    // 7. Calculate stats from smoothed elevations
    let highestPoint = smoothed[0] ?? 0;
    let lowestPoint = smoothed[0] ?? 0;
    let totalAscent = 0;
    let totalDescent = 0;

    for (let i = 1; i < smoothed.length; i++) {
      const diff = smoothed[i] - smoothed[i - 1];
      if (diff > 0) totalAscent += diff;
      else totalDescent += Math.abs(diff);
      if (smoothed[i] > highestPoint) highestPoint = smoothed[i];
      if (smoothed[i] < lowestPoint) lowestPoint = smoothed[i];
    }

    // 8. Build per-point data using smoothed elevations
    const elevationData: ElevationDataPoint[] = coordinates.map((coord, i) => ({
      elevation: Math.round(smoothed[i]),
      distance: distances[i],
      coordinates: coord,
    }));

    const result: ElevationResult = {
      elevations: smoothed.map(e => Math.round(e)),
      elevationData,
      highestPoint: Math.round(highestPoint),
      lowestPoint: Math.round(lowestPoint),
      totalAscent: Math.round(totalAscent),
      totalDescent: Math.round(totalDescent),
      totalDistanceKm: distances[distances.length - 1] ?? 0,
    };

    console.log('[Mapbox Elevation] Stats:', {
      highest: result.highestPoint,
      lowest: result.lowestPoint,
      ascent: result.totalAscent,
      descent: result.totalDescent,
      distanceKm: result.totalDistanceKm,
      points: coordinates.length,
    });

    return result;
  } catch (err) {
    console.error('[Mapbox Elevation] Failed to get elevation', err);
    throw err;
  }
}
