// Route styling constants - updated with new stage colors and shadow
export const ROUTE_STYLES = {
  // Shadow configuration for route lines
  SHADOW: {
    COLOR: '#000000',
    OPACITY: 0.15, // 12-18% opacity
    BLUR: 3, // 2-4 px
    OFFSET_X: 0,
    OFFSET_Y: 1, // 1-2 px
  },
  // Stage colors - subtle variations
  STAGES: {
    STAGE_1: '#088D95', // Gold / Base - main reference color
    STAGE_2: '#076873', // Slightly darker (~6-8% darker)
    STAGE_3: '#5CB7BB', // Slightly lighter
  },
  ZOOM: {
    COLOR: '#808080', // Gray for zoomed/out-of-view routes
    WIDTH: 5,
    OUTLINE: false,
  },
  MAIN: {
    COLOR: '#088D95', // Updated to match Stage 1
    WIDTH: 5,
    OUTLINE: false, // No outline per new guidelines
  },
  ELEVATION: {
    // Stage-based colors for elevation profile - visually distinct
    STAGE_1_LINE: '#088D95', // Teal (original)
    STAGE_1_AREA: 'rgba(8, 141, 149, 0.30)',
    STAGE_2_LINE: '#10ca5eff', // Blue
    STAGE_2_AREA: 'rgba(37, 99, 235, 0.25)',
    STAGE_3_LINE: '#10B981', // Emerald green
    STAGE_3_AREA: 'rgba(16, 185, 129, 0.25)',
    // Default (single stage)
    PROFILE_LINE: '#088D95',
    PROFILE_AREA: 'rgba(8, 141, 149, 0.25)',
    CROSSHAIR: '#088D95',
    OUT_OF_VIEW_LINE: '#808080',
    OUT_OF_VIEW_AREA: 'rgba(128, 128, 128, 0.08)',
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

// Helper to get stage color by index (for map route)
export function getStageColor(stageIndex: number): string {
  const colors = [
    ROUTE_STYLES.STAGES.STAGE_1,
    ROUTE_STYLES.STAGES.STAGE_2,
    ROUTE_STYLES.STAGES.STAGE_3,
  ];
  return colors[stageIndex % colors.length];
}

// Helper to get stage line color for elevation profile (more distinct colors)
export function getElevationStageColor(stageIndex: number): string {
  const colors = [
    ROUTE_STYLES.ELEVATION.STAGE_1_LINE,
    ROUTE_STYLES.ELEVATION.STAGE_2_LINE,
    ROUTE_STYLES.ELEVATION.STAGE_3_LINE,
  ];
  return colors[stageIndex % colors.length];
}

// Helper to get stage area color (with opacity)
export function getStageAreaColor(stageIndex: number): string {
  const colors = [
    ROUTE_STYLES.ELEVATION.STAGE_1_AREA,
    ROUTE_STYLES.ELEVATION.STAGE_2_AREA,
    ROUTE_STYLES.ELEVATION.STAGE_3_AREA,
  ];
  return colors[stageIndex % colors.length];
}
