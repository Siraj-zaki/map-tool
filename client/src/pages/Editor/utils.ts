import type { LngLat } from './types';
import { AVERAGE_SPEED_KMH } from './constants';

// Haversine distance calculation (in meters)
export const haversineDistance = (coord1: LngLat, coord2: LngLat): number => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (coord1[1] * Math.PI) / 180;
  const φ2 = (coord2[1] * Math.PI) / 180;
  const Δφ = ((coord2[1] - coord1[1]) * Math.PI) / 180;
  const Δλ = ((coord2[0] - coord1[0]) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Interpolate points along a straight line for accurate elevation data
export const interpolateLine = (
  start: LngLat,
  end: LngLat,
  spacingMeters: number = 20
): LngLat[] => {
  const totalDistance = haversineDistance(start, end);
  const numPoints = Math.max(2, Math.ceil(totalDistance / spacingMeters));
  const points: LngLat[] = [];

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    const lng = start[0] + (end[0] - start[0]) * t;
    const lat = start[1] + (end[1] - start[1]) * t;
    points.push([lng, lat]);
  }

  return points;
};

// Calculate duration based on fixed 10.86 km/h average speed
export const calculateRealisticDuration = (distanceKm: number): number => {
  const totalTimeHours = distanceKm / AVERAGE_SPEED_KMH;
  return Math.round(totalTimeHours * 60);
};

export const formatDuration = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const s = 0;
  return `${h.toString().padStart(2, '0')}:${m
    .toString()
    .padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};
