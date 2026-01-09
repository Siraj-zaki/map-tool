import mapboxgl from 'mapbox-gl';

export interface ElevationResult {
  elevations: number[];
  highestPoint: number;
  lowestPoint: number;
  totalAscent: number;
  totalDescent: number;
}

/**
 * Waits for the map terrain to be loaded
 * Returns a promise that resolves when terrain is ready
 */
function waitForTerrain(map: mapboxgl.Map): Promise<void> {
  return new Promise(resolve => {
    // Check if terrain source exists and map is ready
    const terrainSource = map.getSource('mapbox-dem');

    if (terrainSource && map.isStyleLoaded()) {
      // Terrain source exists and style is loaded - we can query immediately
      // Use a small timeout to ensure terrain tiles have been processed
      setTimeout(() => resolve(), 100);
    } else if (!terrainSource) {
      // No terrain source - add it
      console.log('[Mapbox Elevation] Adding terrain source...');
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

      // Wait for idle after adding terrain
      map.once('idle', () => resolve());
    } else {
      // Style not loaded yet, wait for it
      map.once('load', () => {
        setTimeout(() => resolve(), 100);
      });
    }
  });
}

/**
 * Gets elevation data for route coordinates using Mapbox's queryTerrainElevation
 * This is a client-side method that uses the loaded terrain tiles
 *
 * IMPORTANT: Queries ALL coordinates without sampling for accurate elevation data
 */
export async function getMapboxElevation(
  map: mapboxgl.Map,
  coordinates: [number, number][]
): Promise<ElevationResult> {
  console.log(
    `[Mapbox Elevation] Querying elevations for ${coordinates.length} points (NO SAMPLING)...`
  );

  // Save current map state to restore later
  const currentCenter = map.getCenter();
  const currentZoom = map.getZoom();
  const currentPitch = map.getPitch();
  const currentBearing = map.getBearing();

  try {
    // CRITICAL: Fit map to route bounds to ensure terrain tiles are loaded for ALL coordinates
    // queryTerrainElevation returns null for off-screen points
    console.log(
      '[Mapbox Elevation] Fitting map to route bounds to load terrain tiles...'
    );
    const bounds = new mapboxgl.LngLatBounds();
    coordinates.forEach(coord => bounds.extend(coord));

    map.fitBounds(bounds, {
      padding: 50,
      duration: 0, // Instant, no animation
      animate: false,
    });

    // Wait for terrain to be ready AFTER fitting bounds
    await waitForTerrain(map);

    // Additional wait for terrain tiles to load after bounds change
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('[Mapbox Elevation] Terrain should be loaded for route area');

    // Query elevation for EVERY coordinate - no sampling!
    const allElevations: number[] = [];
    let nullCount = 0;
    let validCount = 0;

    // Process in batches to avoid UI blocking
    const BATCH_SIZE = 500;
    const numBatches = Math.ceil(coordinates.length / BATCH_SIZE);

    console.log(
      `[Mapbox Elevation] Processing ${numBatches} batches of ${BATCH_SIZE} points each`
    );

    for (let batch = 0; batch < numBatches; batch++) {
      const startIdx = batch * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, coordinates.length);

      for (let i = startIdx; i < endIdx; i++) {
        const coord = coordinates[i]!;
        const elevation = map.queryTerrainElevation(coord, {
          exaggerated: false,
        });

        if (elevation !== null && elevation !== undefined) {
          allElevations.push(elevation);
          validCount++;
          // Log every 100th coordinate for debugging
          if (i % 100 === 0) {
            console.log(
              `[Elev ${i}] coord: [${coord[0].toFixed(4)}, ${coord[1].toFixed(
                4
              )}] => ${elevation.toFixed(1)}m`
            );
          }
        } else {
          nullCount++;
          // Use interpolation from last valid value or 0
          if (allElevations.length > 0) {
            allElevations.push(allElevations[allElevations.length - 1]!);
          } else {
            allElevations.push(0);
          }
          // Log null values for debugging
          if (nullCount <= 10) {
            console.warn(
              `[Elev ${i}] coord: [${coord[0].toFixed(4)}, ${coord[1].toFixed(
                4
              )}] => NULL (using fallback)`
            );
          }
        }
      }

      // Yield to UI every batch
      if (batch < numBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    console.log(
      `[Mapbox Elevation] Results: ${validCount} valid, ${nullCount} null out of ${allElevations.length} total`
    );

    // Calculate stats
    let highestPoint = allElevations[0] ?? 0;
    let lowestPoint = allElevations[0] ?? 0;
    let totalAscent = 0;
    let totalDescent = 0;

    for (let i = 1; i < allElevations.length; i++) {
      const diff = allElevations[i] - allElevations[i - 1];
      if (diff > 0) {
        totalAscent += diff;
      } else {
        totalDescent += Math.abs(diff);
      }

      if (allElevations[i] > highestPoint) {
        highestPoint = allElevations[i];
      }
      if (allElevations[i] < lowestPoint) {
        lowestPoint = allElevations[i];
      }
    }

    console.log('[Mapbox Elevation] Stats calculated:', {
      highest: Math.round(highestPoint),
      lowest: Math.round(lowestPoint),
      ascent: Math.round(totalAscent),
      descent: Math.round(totalDescent),
    });

    return {
      elevations: allElevations,
      highestPoint: Math.round(highestPoint),
      lowestPoint: Math.round(lowestPoint),
      totalAscent: Math.round(totalAscent),
      totalDescent: Math.round(totalDescent),
    };
  } finally {
    // Restore map state
    console.log('[Mapbox Elevation] Restoring map camera state...');
    map.jumpTo({
      center: currentCenter,
      zoom: currentZoom,
      pitch: currentPitch,
      bearing: currentBearing,
    });
  }
}
