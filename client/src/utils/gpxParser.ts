/**
 * GPX File Parser Utility
 * Parses GPX files and extracts track/route points
 */

export interface GPXPoint {
  lat: number;
  lon: number;
  ele: number;
}

/**
 * Parse GPX file content and extract track/route points
 */
export function parseGPX(gpxText: string): GPXPoint[] {
  const parser = new DOMParser();
  const gpx = parser.parseFromString(gpxText, 'text/xml');

  // Check for parse errors
  const parseError = gpx.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid GPX file format');
  }

  // Try different GPX formats (trkpt = track points, rtept = route points, wpt = waypoints)
  let trackPoints = gpx.querySelectorAll('trkpt');
  if (trackPoints.length === 0) {
    trackPoints = gpx.querySelectorAll('rtept');
  }
  if (trackPoints.length === 0) {
    trackPoints = gpx.querySelectorAll('wpt');
  }

  if (trackPoints.length === 0) {
    throw new Error('No track or route points found in GPX file');
  }

  const points: GPXPoint[] = Array.from(trackPoints).map(point => ({
    lat: parseFloat(point.getAttribute('lat') || '0'),
    lon: parseFloat(point.getAttribute('lon') || '0'),
    ele: parseFloat(point.querySelector('ele')?.textContent || '0'),
  }));

  return points;
}

/**
 * Calculate distance between two points in km (Haversine formula)
 */
function calculateDistance(p1: GPXPoint, p2: GPXPoint): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLon = ((p2.lon - p1.lon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Process GPX points to extract optimal waypoints for routing
 */
export function processGPXToRoute(points: GPXPoint[]): {
  startPoint: [number, number];
  endPoint: [number, number];
  waypoints: [number, number][];
  routeGeometry: [number, number][];
  totalDistance: number;
  elevationGain: number;
  elevationLoss: number;
  highestPoint: number;
  lowestPoint: number;
} {
  if (points.length < 2) {
    throw new Error('GPX file must contain at least 2 points');
  }

  // Calculate total route length
  let totalDistance = 0;
  for (let i = 0; i < points.length - 1; i++) {
    totalDistance += calculateDistance(points[i], points[i + 1]);
  }

  // Calculate optimal number of waypoints
  const MAX_WAYPOINTS = 70;
  const MIN_WAYPOINTS = 5;
  const POINTS_PER_KM = 2;

  let optimalWaypoints = Math.ceil(totalDistance * POINTS_PER_KM);
  optimalWaypoints = Math.max(
    MIN_WAYPOINTS,
    Math.min(optimalWaypoints, MAX_WAYPOINTS)
  );

  // Extract waypoints at regular intervals
  const waypoints: [number, number][] = [];
  if (points.length > 2) {
    const step = Math.max(
      1,
      Math.floor((points.length - 2) / optimalWaypoints)
    );
    for (
      let i = step;
      i < points.length - step && waypoints.length < optimalWaypoints;
      i += step
    ) {
      waypoints.push([points[i].lon, points[i].lat]);
    }
  }

  // Create full route geometry from all points
  const routeGeometry: [number, number][] = points.map(p => [p.lon, p.lat]);

  // Calculate elevation stats
  let elevationGain = 0;
  let elevationLoss = 0;
  let highestPoint = points[0].ele;
  let lowestPoint = points[0].ele;

  for (let i = 1; i < points.length; i++) {
    const eleDiff = points[i].ele - points[i - 1].ele;
    if (eleDiff > 0) elevationGain += eleDiff;
    else elevationLoss += Math.abs(eleDiff);

    if (points[i].ele > highestPoint) highestPoint = points[i].ele;
    if (points[i].ele < lowestPoint) lowestPoint = points[i].ele;
  }

  return {
    startPoint: [points[0].lon, points[0].lat],
    endPoint: [points[points.length - 1].lon, points[points.length - 1].lat],
    waypoints,
    routeGeometry,
    totalDistance,
    elevationGain,
    elevationLoss,
    highestPoint,
    lowestPoint,
  };
}

/**
 * Get route name from GPX metadata
 */
export function getGPXRouteName(gpxText: string): string | null {
  const parser = new DOMParser();
  const gpx = parser.parseFromString(gpxText, 'text/xml');

  // Try different name locations
  const name =
    gpx.querySelector('trk > name')?.textContent ||
    gpx.querySelector('rte > name')?.textContent ||
    gpx.querySelector('metadata > name')?.textContent;

  return name || null;
}
