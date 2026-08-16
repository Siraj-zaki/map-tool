/**
 * POI category registry — single source of truth.
 *
 * Every POI-facing component (modal picker, map markers, sidebar, list,
 * elevation chart) reads from here. Adding a new category means editing
 * this file only.
 *
 * `aliases` keeps old-value records rendering after a rename (e.g. the
 * legacy DB value "gipfel" resolves to the "summit" category without a
 * data migration).
 */

/**
 * A single custom field on a POI category. Renders in both the modal editor
 * and the public detail sidebar. Values live in the POI's `metadata` JSON
 * column keyed by `key`.
 */
export type PoiFieldSpec =
  | {
      key: string;
      kind: 'text';
      labelKey: string;
      icon?: string;
      placeholder?: string;
    }
  | {
      key: string;
      kind: 'number';
      labelKey: string;
      icon?: string;
      unit?: string;
      min?: number;
      max?: number;
      step?: number;
    }
  | { key: string; kind: 'url'; labelKey: string; icon?: string }
  | { key: string; kind: 'phone'; labelKey: string; icon?: string }
  | {
      key: string;
      kind: 'select';
      labelKey: string;
      icon?: string;
      options: { value: string; labelKey: string }[];
    }
  | { key: string; kind: 'bool'; labelKey: string; icon?: string };

export interface PoiCategory {
  /** Stable identifier stored in the DB. Never rename after release. */
  id: PoiCategoryId;
  /** i18next key for the display label. */
  labelKey: string;
  /** Font Awesome class, e.g. "fa-mountain" (rendered with `fas` prefix). */
  faIcon: string;
  /** Marker fill color (also drives category accents in the sidebar). */
  color: string;
  /** Legacy DB values that should resolve to this category. */
  aliases?: string[];
  /**
   * Category-specific fields shown in the editor + detail view.
   * Values are stored in `POI.metadata` (JSON column) keyed by field.key.
   */
  fields?: PoiFieldSpec[];
}

export const POI_CATEGORIES: readonly PoiCategory[] = [
  {
    id: 'summit',
    labelKey: 'poiSummit',
    faIcon: 'fa-mountain',
    color: '#16a34a',
    // "gipfel" is the German for summit — legacy records use it verbatim.
    // "highlight" is the retired generic bucket; most Harz highlights are
    // peaks, so summit is the closest visual fit.
    aliases: ['gipfel', 'highlight'],
    fields: [
      {
        key: 'elevation_m',
        kind: 'number',
        labelKey: 'fieldElevation',
        icon: 'fa-mountain',
        unit: 'm',
        min: 0,
        max: 9000,
        step: 1,
      },
      {
        key: 'prominence_m',
        kind: 'number',
        labelKey: 'fieldProminence',
        icon: 'fa-arrows-up-down',
        unit: 'm',
        min: 0,
        step: 1,
      },
    ],
  },
  {
    id: 'restaurant',
    labelKey: 'poiRestaurant',
    faIcon: 'fa-utensils',
    color: '#f97316',
    fields: [
      { key: 'cuisine', kind: 'text', labelKey: 'fieldCuisine', icon: 'fa-utensils' },
      { key: 'hours', kind: 'text', labelKey: 'fieldHours', icon: 'fa-clock', placeholder: 'e.g. Mo–Fr 11:00–22:00' },
      { key: 'phone', kind: 'phone', labelKey: 'fieldPhone', icon: 'fa-phone' },
      { key: 'website', kind: 'url', labelKey: 'fieldWebsite', icon: 'fa-globe' },
    ],
  },
  {
    id: 'hotel',
    labelKey: 'poiHotel',
    faIcon: 'fa-hotel',
    color: '#2563eb',
    fields: [
      {
        key: 'price_range',
        kind: 'select',
        labelKey: 'fieldPriceRange',
        icon: 'fa-tag',
        options: [
          { value: '$', labelKey: 'priceBudget' },
          { value: '$$', labelKey: 'priceMid' },
          { value: '$$$', labelKey: 'priceHigh' },
          { value: '$$$$', labelKey: 'priceLuxury' },
        ],
      },
      { key: 'phone', kind: 'phone', labelKey: 'fieldPhone', icon: 'fa-phone' },
      { key: 'website', kind: 'url', labelKey: 'fieldWebsite', icon: 'fa-globe' },
    ],
  },
  {
    id: 'lake',
    labelKey: 'poiLake',
    faIcon: 'fa-water',
    color: '#0ea5e9',
    fields: [
      { key: 'swimming', kind: 'bool', labelKey: 'fieldSwimming', icon: 'fa-person-swimming' },
      { key: 'area_km2', kind: 'number', labelKey: 'fieldArea', icon: 'fa-vector-square', unit: 'km²', min: 0, step: 0.01 },
      { key: 'max_depth_m', kind: 'number', labelKey: 'fieldMaxDepth', icon: 'fa-ruler-vertical', unit: 'm', min: 0, step: 0.1 },
    ],
  },
  {
    id: 'photo',
    labelKey: 'poiPhoto',
    faIcon: 'fa-camera',
    color: '#a855f7',
    fields: [
      {
        key: 'best_light',
        kind: 'select',
        labelKey: 'fieldBestLight',
        icon: 'fa-sun',
        options: [
          { value: 'golden_morning', labelKey: 'lightGoldenMorning' },
          { value: 'golden_evening', labelKey: 'lightGoldenEvening' },
          { value: 'blue_hour', labelKey: 'lightBlueHour' },
          { value: 'midday', labelKey: 'lightMidday' },
          { value: 'anytime', labelKey: 'lightAnytime' },
        ],
      },
      {
        key: 'facing',
        kind: 'select',
        labelKey: 'fieldFacing',
        icon: 'fa-compass',
        options: [
          { value: 'N', labelKey: 'compassN' },
          { value: 'NE', labelKey: 'compassNE' },
          { value: 'E', labelKey: 'compassE' },
          { value: 'SE', labelKey: 'compassSE' },
          { value: 'S', labelKey: 'compassS' },
          { value: 'SW', labelKey: 'compassSW' },
          { value: 'W', labelKey: 'compassW' },
          { value: 'NW', labelKey: 'compassNW' },
        ],
      },
    ],
  },
  {
    id: 'repair',
    labelKey: 'poiRepair',
    faIcon: 'fa-wrench',
    color: '#f59e0b',
    aliases: ['repair_station'],
    fields: [
      { key: 'indoor', kind: 'bool', labelKey: 'fieldIndoor', icon: 'fa-house' },
      { key: 'pump', kind: 'bool', labelKey: 'fieldPump', icon: 'fa-gauge' },
      { key: 'phone', kind: 'phone', labelKey: 'fieldPhone', icon: 'fa-phone' },
    ],
  },
  {
    id: 'stamp',
    labelKey: 'poiStamp',
    faIcon: 'fa-stamp',
    color: '#e11d48',
    fields: [
      { key: 'stamp_code', kind: 'text', labelKey: 'fieldStampCode', icon: 'fa-hashtag', placeholder: 'e.g. HWN 042' },
      { key: 'motif', kind: 'text', labelKey: 'fieldMotif', icon: 'fa-image' },
    ],
  },
];

export type PoiCategoryId =
  | 'summit'
  | 'restaurant'
  | 'hotel'
  | 'lake'
  | 'photo'
  | 'repair'
  | 'stamp';

export const POI_CATEGORY_IDS: readonly PoiCategoryId[] = POI_CATEGORIES.map(
  c => c.id
) as PoiCategoryId[];

/**
 * Fallback rendered for unknown/legacy types that don't match any alias.
 * Purposefully neutral so misconfigured records are visually obvious
 * without breaking the map.
 */
export const POI_FALLBACK_CATEGORY: PoiCategory = {
  id: 'summit', // arbitrary — never used as an id, only to satisfy the type
  labelKey: 'poiOther',
  faIcon: 'fa-map-pin',
  color: '#6b7280', // gray-500
};

// Precompute alias → category lookup so getCategory is O(1).
const BY_ID_OR_ALIAS: Record<string, PoiCategory> = (() => {
  const map: Record<string, PoiCategory> = {};
  for (const cat of POI_CATEGORIES) {
    map[cat.id] = cat;
    for (const alias of cat.aliases ?? []) map[alias] = cat;
  }
  return map;
})();

/**
 * Resolve a stored `type` string to its canonical category.
 * Returns `null` if unknown — callers usually want `getCategoryOrFallback`.
 */
export function getCategory(type: string | undefined | null): PoiCategory | null {
  if (!type) return null;
  return BY_ID_OR_ALIAS[type.toLowerCase()] ?? null;
}

/**
 * Resolve a stored `type` to a category, falling back to a neutral marker
 * so unknown legacy values still render on the map.
 */
export function getCategoryOrFallback(
  type: string | undefined | null
): PoiCategory {
  return getCategory(type) ?? POI_FALLBACK_CATEGORY;
}

/**
 * True if `type` is currently a first-class category shown in the picker.
 * Legacy alias-only values return false — use this to hide retired types
 * from the picker while still rendering existing records via aliases.
 */
export function isCanonicalCategoryId(
  type: string | undefined | null
): type is PoiCategoryId {
  return !!type && POI_CATEGORY_IDS.includes(type as PoiCategoryId);
}
