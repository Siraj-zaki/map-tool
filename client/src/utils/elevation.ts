/**
 * Elevation API utility using Open-Meteo free elevation service
 * https://open-meteo.com/en/docs/elevation-api
 */

const ELEVATION_API_URL = 'https://api.open-meteo.com/v1/elevation';
const BATCH_SIZE = 100; // Max coordinates per request

/**
 * Fetches elevation data for an array of coordinates
 * @param coordinates Array of [lng, lat] coordinates
 * @returns Array of elevation values in meters
 */
export async function fetchElevations(
  coordinates: [number, number][]
): Promise<number[]> {
  if (coordinates.length === 0) return [];

  const elevations: number[] = [];

  // Process in batches of 100 (API limit)
  for (let i = 0; i < coordinates.length; i += BATCH_SIZE) {
    const batch = coordinates.slice(i, i + BATCH_SIZE);

    // Format coordinates for API (lat,lng format required)
    const latitudes = batch.map(c => c[1]).join(',');
    const longitudes = batch.map(c => c[0]).join(',');

    try {
      const response = await fetch(
        `${ELEVATION_API_URL}?latitude=${latitudes}&longitude=${longitudes}`
      );

      if (!response.ok) {
        console.error('[Elevation API] Request failed:', response.status);
        // Return default elevations for this batch
        elevations.push(...batch.map(() => 500));
        continue;
      }

      const data = await response.json();

      if (data.elevation && Array.isArray(data.elevation)) {
        elevations.push(...data.elevation);
      } else {
        console.error('[Elevation API] Invalid response format:', data);
        elevations.push(...batch.map(() => 500));
      }
    } catch (error) {
      console.error('[Elevation API] Error fetching elevations:', error);
      // Return default elevations on error
      elevations.push(...batch.map(() => 500));
    }

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < coordinates.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return elevations;
}

/**
 * Samples coordinates to reduce API calls while maintaining profile shape
 * Takes every Nth point to get approximately targetCount points
 */
export function sampleCoordinates<T>(
  data: T[],
  targetCount: number = 200
): { sampled: T[]; indices: number[] } {
  if (data.length <= targetCount) {
    return {
      sampled: data,
      indices: data.map((_, i) => i),
    };
  }

  const step = Math.ceil(data.length / targetCount);
  const sampled: T[] = [];
  const indices: number[] = [];

  for (let i = 0; i < data.length; i += step) {
    sampled.push(data[i]);
    indices.push(i);
  }

  // Always include last point
  if (indices[indices.length - 1] !== data.length - 1) {
    sampled.push(data[data.length - 1]);
    indices.push(data.length - 1);
  }

  return { sampled, indices };
}

/**
 * Interpolates elevation values for all coordinates based on sampled data
 */
export function interpolateElevations(
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
 * Main function to get elevation data for route coordinates
 * Samples, fetches, and interpolates for efficiency
 */
export async function getRouteElevations(
  coordinates: [number, number][]
): Promise<number[]> {
  console.log(
    `[Elevation] Fetching elevations for ${coordinates.length} points...`
  );

  // Sample coordinates to reduce API calls (max ~200 points)
  const { sampled, indices } = sampleCoordinates(coordinates, 200);
  console.log(`[Elevation] Sampled to ${sampled.length} points`);

  // Fetch elevations for sampled points
  const sampledElevations = await fetchElevations(sampled);
  console.log(`[Elevation] Received ${sampledElevations.length} elevations`);

  // Interpolate to get elevations for all coordinates
  const allElevations = interpolateElevations(
    coordinates.length,
    indices,
    sampledElevations
  );

  console.log(`[Elevation] Interpolated to ${allElevations.length} elevations`);

  return allElevations;
}
