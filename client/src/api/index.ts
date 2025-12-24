import { cachedFetch, clearCache } from '../utils/performance';

const API_BASE = '/api';

// Types
export interface Route {
  id: number;
  name: string;
  description?: string;
  startPoint: [number, number];
  endPoint: [number, number];
  waypoints: [number, number][];
  routeGeometry?: [number, number][];
  elevationData?: { elevation: number; distance: number }[];
  distance: number;
  duration: number;
  highestPoint: number;
  lowestPoint: number;
  totalAscent: number;
  totalDescent: number;
  pois: POI[];
}

export interface POI {
  poi_id: number;
  name: string;
  description?: string;
  lngLat: [number, number];
  type?: string;
  best_time?: string;
  images: string[];
  amenities: string[];
}

export interface GpxFile {
  id: number;
  route_id: number;
  tour_type: 'gold' | 'silver' | 'bronze';
  stage_number: number;
  start_point_name?: string;
  file_path: string;
}

export interface User {
  id: number;
  username: string;
  role: string;
}

// Auth API
export const authApi = {
  login: async (username: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });
    return res.json();
  },

  logout: async () => {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    // Clear cache on logout
    clearCache();
    return res.json();
  },

  getProfile: async () => {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      credentials: 'include',
    });
    return res.json();
  },
};

// Routes API with caching
export const routesApi = {
  getAll: async (): Promise<{ success: boolean; data: Route[] }> => {
    return cachedFetch(
      'routes:all',
      async () => {
        const res = await fetch(`${API_BASE}/routes`);
        return res.json();
      },
      2 * 60 * 1000 // 2 minute cache
    );
  },

  getById: async (id: number): Promise<{ success: boolean; route: Route }> => {
    return cachedFetch(
      `routes:${id}`,
      async () => {
        const res = await fetch(`${API_BASE}/routes/${id}`);
        return res.json();
      },
      5 * 60 * 1000 // 5 minute cache
    );
  },

  create: async (route: Partial<Route>) => {
    const res = await fetch(`${API_BASE}/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(route),
    });
    // Invalidate routes cache on create
    clearCache('routes:all');
    return res.json();
  },

  update: async (id: number, route: Partial<Route>) => {
    const res = await fetch(`${API_BASE}/routes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(route),
    });
    // Invalidate caches on update
    clearCache('routes:all');
    clearCache(`routes:${id}`);
    return res.json();
  },

  delete: async (id: number) => {
    const res = await fetch(`${API_BASE}/routes/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    // Invalidate caches on delete
    clearCache('routes:all');
    clearCache(`routes:${id}`);
    return res.json();
  },

  // Force refresh a route (bypass cache)
  getByIdFresh: async (
    id: number
  ): Promise<{ success: boolean; route: Route }> => {
    clearCache(`routes:${id}`);
    const res = await fetch(`${API_BASE}/routes/${id}`);
    return res.json();
  },
};

// Split Point Types
export interface SplitPoint {
  stageNumber: number;
  locationName: string;
  lng: number;
  lat: number;
  distanceKm: number;
}

export interface SplitPointsResponse {
  success: boolean;
  splitPoints: {
    silver: SplitPoint[];
    bronze: SplitPoint[];
  };
}

// Split Points API
export const splitPointsApi = {
  getByRoute: async (routeId: number): Promise<SplitPointsResponse> => {
    return cachedFetch(
      `splitPoints:${routeId}`,
      async () => {
        const res = await fetch(`${API_BASE}/routes/${routeId}/split-points`);
        return res.json();
      },
      5 * 60 * 1000 // 5 minute cache
    );
  },

  save: async (
    routeId: number,
    tourType: 'silver' | 'bronze',
    splitPoints: SplitPoint[]
  ) => {
    const res = await fetch(`${API_BASE}/routes/${routeId}/split-points`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ tourType, splitPoints }),
    });
    // Invalidate cache
    clearCache(`splitPoints:${routeId}`);
    return res.json();
  },
};

// GPX API with caching
export const gpxApi = {
  getByRoute: async (
    routeId: number,
    tourType?: string,
    startPoint?: string
  ) => {
    const cacheKey = `gpx:${routeId}:${tourType || 'all'}:${
      startPoint || 'all'
    }`;

    return cachedFetch(
      cacheKey,
      async () => {
        let url = `${API_BASE}/gpx/${routeId}`;
        const params = new URLSearchParams();
        if (tourType) params.append('tour_type', tourType);
        if (startPoint) params.append('start_point', startPoint);
        if (params.toString()) url += `?${params}`;

        const res = await fetch(url);
        return res.json();
      },
      10 * 60 * 1000 // 10 minute cache for GPX files
    );
  },

  download: (fileId: number) => {
    window.open(`${API_BASE}/gpx/download/${fileId}`, '_blank');
  },

  getStartPoints: async (routeId: number) => {
    return cachedFetch(
      `gpx:startPoints:${routeId}`,
      async () => {
        const res = await fetch(`${API_BASE}/gpx/start-points/${routeId}`);
        return res.json();
      },
      10 * 60 * 1000 // 10 minute cache
    );
  },
};

// Mapbox Directions API with caching
const MAPBOX_TOKEN =
  'pk.eyJ1IjoicHVuY2hpbmdtYW4iLCJhIjoiY2p1cjcyMmh2M3NpZDQ5bnEwMDV6ZTE1OSJ9.ef8y6l9fsKFMX91m_Rt2ng';

export const getDirections = async (
  start: [number, number],
  waypoints: [number, number][],
  end: [number, number],
  profile: 'walking' | 'cycling' = 'walking'
) => {
  const coords = [start, ...waypoints, end].map(c => c.join(',')).join(';');
  const cacheKey = `directions:${profile}:${coords}`;

  return cachedFetch(
    cacheKey,
    async () => {
      const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?geometries=geojson&access_token=${MAPBOX_TOKEN}&overview=full`;
      const res = await fetch(url);
      return res.json();
    },
    30 * 60 * 1000 // 30 minute cache for directions
  );
};

// Fetch elevation data for route coordinates using Open-Elevation API
export const getElevationData = async (
  coordinates: [number, number][]
): Promise<{
  elevations: number[];
  highestPoint: number;
  lowestPoint: number;
  totalAscent: number;
  totalDescent: number;
}> => {
  // Sample coordinates if there are too many (Open-Elevation has limits)
  const maxPoints = 100;
  let sampledCoords = coordinates;
  if (coordinates.length > maxPoints) {
    const step = Math.ceil(coordinates.length / maxPoints);
    sampledCoords = coordinates.filter((_, i) => i % step === 0);
    // Always include last point
    if (
      sampledCoords[sampledCoords.length - 1] !==
      coordinates[coordinates.length - 1]
    ) {
      sampledCoords.push(coordinates[coordinates.length - 1]);
    }
  }

  try {
    // Use Open-Elevation API (free, no API key required)
    const locations = sampledCoords.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));
    const response = await fetch(
      'https://api.open-elevation.com/api/v1/lookup',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations }),
      }
    );

    if (!response.ok) {
      throw new Error('Elevation API failed');
    }

    const data = await response.json();
    const elevations: number[] = data.results.map(
      (r: { elevation: number }) => r.elevation
    );

    // Calculate stats
    let highestPoint = elevations[0];
    let lowestPoint = elevations[0];
    let totalAscent = 0;
    let totalDescent = 0;

    for (let i = 1; i < elevations.length; i++) {
      const diff = elevations[i] - elevations[i - 1];
      if (diff > 0) totalAscent += diff;
      else totalDescent += Math.abs(diff);

      if (elevations[i] > highestPoint) highestPoint = elevations[i];
      if (elevations[i] < lowestPoint) lowestPoint = elevations[i];
    }

    return {
      elevations,
      highestPoint: Math.round(highestPoint),
      lowestPoint: Math.round(lowestPoint),
      totalAscent: Math.round(totalAscent),
      totalDescent: Math.round(totalDescent),
    };
  } catch (error) {
    console.error('Failed to fetch elevation data:', error);
    // Return defaults on error
    return {
      elevations: [],
      highestPoint: 0,
      lowestPoint: 0,
      totalAscent: 0,
      totalDescent: 0,
    };
  }
};

// Haversine distance calculation
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Format duration
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

// Settings API for route and stage colors
export interface RouteSettings {
  mainColor: string;
  lineWidth: number;
  shadowColor: string;
  shadowOpacity: number;
}

export interface StageColorSetting {
  stageNumber: number;
  lineColor: string;
  lineOpacity: number;
  areaColor: string | null;
  areaOpacity: number;
}

export interface AllSettings {
  routeSettings: RouteSettings | null;
  stageColors: {
    gold: StageColorSetting[];
    silver: StageColorSetting[];
    bronze: StageColorSetting[];
  };
}

export const settingsApi = {
  // Get all settings (route + stages)
  getAll: async (): Promise<{ success: boolean } & AllSettings> => {
    return cachedFetch(
      'settings:all',
      async () => {
        const res = await fetch(`${API_BASE}/settings/all`);
        return res.json();
      },
      5 * 60 * 1000 // 5 minute cache
    );
  },

  // Get route settings only
  getRouteSettings: async (): Promise<{
    success: boolean;
    settings: RouteSettings;
  }> => {
    const res = await fetch(`${API_BASE}/settings/route`);
    return res.json();
  },

  // Update route settings
  updateRouteSettings: async (settings: Partial<RouteSettings>) => {
    clearCache('settings:all');
    const res = await fetch(`${API_BASE}/settings/route`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(settings),
    });
    return res.json();
  },

  // Get all stage colors
  getStageColors: async (): Promise<{
    success: boolean;
    stages: AllSettings['stageColors'];
  }> => {
    const res = await fetch(`${API_BASE}/settings/stages`);
    return res.json();
  },

  // Update a specific stage color
  updateStageColor: async (
    tourType: 'gold' | 'silver' | 'bronze',
    stageNumber: number,
    colors: Partial<StageColorSetting>
  ) => {
    clearCache('settings:all');
    const res = await fetch(
      `${API_BASE}/settings/stages/${tourType}/${stageNumber}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(colors),
      }
    );
    return res.json();
  },
};
