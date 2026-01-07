export interface ElevationResult {
  elevations: number[];
  highestPoint: number;
  lowestPoint: number;
  totalAscent: number;
  totalDescent: number;
}

/**
 * Samples coordinates to reduce the number of queries
 * Similar to the existing sampling logic, takes max ~200 points
 */
function sampleCoordinates(
  coordinates: [number, number][],
  maxPoints: number = 200
): { sampled: [number, number][]; indices: number[] } {
  if (coordinates.length <= maxPoints) {
    return {
      sampled: coordinates,
      indices: coordinates.map((_, i) => i),
    };
  }

  const step = Math.ceil(coordinates.length / maxPoints);
  const sampled: [number, number][] = [];
  const indices: number[] = [];

  for (let i = 0; i < coordinates.length; i += step) {
    sampled.push(coordinates[i]);
    indices.push(i);
  }

  // Always include last point
  if (indices[indices.length - 1] !== coordinates.length - 1) {
    sampled.push(coordinates[coordinates.length - 1]);
    indices.push(coordinates.length - 1);
  }

  return { sampled, indices };
}

/**
 * Interpolates elevation values for all coordinates based on sampled data
 */
function interpolateElevations(
  totalCount: number,
  sampledIndices: number[],
  sampledElevations: number[]
): number[] {
  const elevations: number[] = new Array(totalCount);
  let sampleIdx = 0;

  for (let i = 0; i < totalCount; i++) {
    if (i === sampledIndices[sampleIdx]) {
      elevations[i] = sampledElevations[sampleIdx];
      sampleIdx = Math.min(sampleIdx + 1, sampledIndices.length - 1);
    } else {
      // Linear interpolation between sampled points
      const prevIdx = sampledIndices[sampleIdx - 1] || 0;
      const nextIdx = sampledIndices[sampleIdx];
      const prevElev = sampledElevations[sampleIdx - 1] || sampledElevations[0];
      const nextElev = sampledElevations[sampleIdx];

      const t = (i - prevIdx) / (nextIdx - prevIdx);
      elevations[i] = prevElev + t * (nextElev - prevElev);
    }
  }

  return elevations;
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
 */
export async function getMapboxElevation(
  map: mapboxgl.Map,
  coordinates: [number, number][]
): Promise<ElevationResult> {
  console.log(
    `[Mapbox Elevation] Querying elevations for ${coordinates.length} points...`
  );

  // Wait for terrain to be ready
  await waitForTerrain(map);

  // Sample coordinates to reduce queries
  const { sampled, indices } = sampleCoordinates(coordinates, 200);
  console.log(`[Mapbox Elevation] Sampled to ${sampled.length} points`);

  // Query elevation for each sampled point
  const sampledElevations: number[] = [];
  for (const coord of sampled) {
    const elevation = map.queryTerrainElevation(coord, {
      exaggerated: false, // Get true elevation, not exaggerated for display
    });

    // If elevation is null (terrain not loaded at this point), use a default
    // This shouldn't happen after waitForTerrain, but handle it gracefully
    sampledElevations.push(elevation ?? 500);
  }

  console.log(
    `[Mapbox Elevation] Queried ${sampledElevations.length} elevations`
  );

  // Interpolate to get elevations for all coordinates
  const allElevations = interpolateElevations(
    coordinates.length,
    indices,
    sampledElevations
  );

  // Calculate stats
  let highestPoint = allElevations[0];
  let lowestPoint = allElevations[0];
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
}
