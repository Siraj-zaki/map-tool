import type { SplitPoint } from '../../api';

export type LngLat = [number, number];

export type DrawingMode = 'auto' | 'manual';

export type EditMode = 'pan' | 'start' | 'end' | 'waypoint' | 'poi' | 'splitpoint';

export type Waypoint = { lngLat: LngLat; mode: DrawingMode };

export type RoutingProfile = 'walking' | 'cycling';

export type TourType = 'gold' | 'silver' | 'bronze';

export interface RouteStats {
  distance: number;
  duration: number;
  highestPoint: number;
  lowestPoint: number;
  totalAscent: number;
  totalDescent: number;
}

export interface SplitPointsState {
  gold: SplitPoint[];
  silver: SplitPoint[];
  bronze: SplitPoint[];
}

export interface ElevationSample {
  elevation: number;
  distance: number;
  coordinates?: LngLat;
}

export interface AlternativeRoute {
  geometry: LngLat[];
  distance: number;
}

export type SplitPointCallback = (
  lng: number,
  lat: number,
  distanceKm: number
) => void;
