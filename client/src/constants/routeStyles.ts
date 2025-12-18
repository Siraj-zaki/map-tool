// Route styling constants - matching public.html original design
export const ROUTE_STYLES = {
  ZOOM: {
    COLOR: '#808080', // Gray for zoomed/out-of-view routes
    WIDTH: 5,
    OUTLINE: true,
    OUTLINE_WIDTH: 2,
    OUTLINE_COLOR: 'rgba(211, 211, 211, 0.2)',
  },
  MAIN: {
    COLOR: '#088373', // Teal for main routes
    WIDTH: 5,
    OUTLINE: true,
    OUTLINE_WIDTH: 2,
    OUTLINE_COLOR: 'rgba(211, 211, 211, 0.2)',
  },
  ELEVATION: {
    PROFILE_LINE: '#088373',
    PROFILE_AREA: 'rgba(8, 131, 115, 0.15)',
    CROSSHAIR: '#088D95',
    OUT_OF_VIEW_LINE: '#808080',
    OUT_OF_VIEW_AREA: 'rgba(128, 128, 128, 0.15)',
    MARKER_FILL: '#088D95',
    MARKER_STROKE: '#FFFFFF',
    GRID_LINES: 'rgba(255, 255, 255, 0.1)',
    TEXT_COLOR: '#a0a0a0',
    TOOLTIP_BG: 'rgba(11, 18, 21, 0.9)',
    TOOLTIP_TEXT: '#FFFFFF',
    POI_LINE: 'rgba(255, 255, 255, 0.3)',
  },
};

// CSS Variables - matching public.css :root
export const CSS_VARS = {
  BACKGROUND_DARK: '#0b1215',
  BACKGROUND_DARKER: '#080e11',
  HIGHLIGHT: '#088d95',
  HIGHLIGHT_SOFT: '#0da6ae',
  TEXT_PRIMARY: '#e0e0e0',
  TEXT_SECONDARY: '#a0a0a0',
  BORDER_COLOR: '#1e2a33',
  BORDER_RADIUS: '8px',
  BORDER_RADIUS_LG: '12px',
};

// Marker types configuration
export const MARKER_TYPES = {
  start: { icon: 'play', color: '#0b1215', size: 36, iconSize: 14 },
  end: { icon: 'flag-checkered', color: '#0b1215', size: 36, iconSize: 14 },
  via: { icon: '', color: '#06599c', size: 0, iconSize: 0 },
};

// POI icon mappings
export const POI_ICONS = {
  hotel: '/images/hotel.png',
  restaurant: '/images/restaurant.png',
  gipfel: '/images/gipfel.png',
  highlight: '/images/highlight.png',
};

// POI profile icons (for elevation chart)
export const POI_PROFILE_ICONS = {
  highlight: '/images/gipfel_profil1.png',
  gipfel: '/images/gipfel_profil1.png',
};

// POI fallback Font Awesome icons
export const POI_ICON_FALLBACK: Record<string, { icon: string; bg: string }> = {
  hotel: { icon: 'fa-hotel', bg: '#3b82f6' },
  restaurant: { icon: 'fa-utensils', bg: '#f97316' },
  gipfel: { icon: 'fa-mountain', bg: '#22c55e' },
  highlight: { icon: 'fa-star', bg: '#eab308' },
};
