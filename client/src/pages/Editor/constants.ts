import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken =
  'pk.eyJ1IjoicHVuY2hpbmdtYW4iLCJhIjoiY2p1cjcyMmh2M3NpZDQ5bnEwMDV6ZTE1OSJ9.ef8y6l9fsKFMX91m_Rt2ng';

// POI icons/colors now live in `client/src/constants/poiCategories.ts` — the
// single source of truth for every POI-facing component.

export const citiesList = [
  'Wernigerode',
  'Berlin',
  'Hamburg',
  'Munich',
  'Cologne',
  'Frankfurt',
];

export const MAP_STYLE = 'mapbox://styles/sirajmuneer/cmjh1h0wb000b01se721kbl7m';
export const MAP_INITIAL_CENTER: [number, number] = [10.7865, 51.8054];
export const MAP_INITIAL_ZOOM = 11;
export const AVERAGE_SPEED_KMH = 10.86;
