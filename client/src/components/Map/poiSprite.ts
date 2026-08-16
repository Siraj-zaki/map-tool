import type { Map as MapboxMap } from 'mapbox-gl';
import {
  POI_CATEGORIES,
  POI_FALLBACK_CATEGORY,
  type PoiCategory,
} from '../../constants/poiCategories';

/**
 * Runtime-generated Mapbox POI sprites derived from the shared category
 * registry. One sprite per category, rendered on canvas using the page's
 * loaded Font Awesome font so the public map matches the HTML pill markers
 * in the editor.
 *
 * Why runtime vs. static PNGs: adding a new category should be a one-file
 * edit to `poiCategories.ts`. Static PNG assets couple the map to a build
 * pipeline that the rest of the app doesn't use.
 */

// Rendered size in CSS pixels. The sprite is drawn at 2× for retina.
const SPRITE_SIZE_CSS = 40;
const SPRITE_PIXEL_RATIO = 2;
const SPRITE_SIZE_PX = SPRITE_SIZE_CSS * SPRITE_PIXEL_RATIO;

// Mapbox image id prefix — kept namespaced so we don't collide with the map
// style's built-in Maki sprites.
const SPRITE_PREFIX = 'poi_sprite_';

export function spriteIdFor(categoryId: string): string {
  return `${SPRITE_PREFIX}${categoryId}`;
}

/**
 * Resolve a Font Awesome class ("fa-mountain") to the unicode glyph it
 * renders. Reads the `content` property of the ::before pseudo-element on
 * a probe span, which is what Font Awesome sets — this way we don't need
 * to hardcode per-icon unicode values and we automatically pick up
 * whichever FA version the app ships.
 */
function resolveFaGlyph(iconClass: string): string {
  const probe = document.createElement('span');
  probe.className = `fas ${iconClass}`;
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.left = '-9999px';
  probe.style.top = '0';
  document.body.appendChild(probe);
  try {
    const raw = window
      .getComputedStyle(probe, '::before')
      .getPropertyValue('content');
    // Value comes back quoted (e.g. `""`), possibly with escapes.
    return raw.replace(/^["']|["']$/g, '');
  } finally {
    document.body.removeChild(probe);
  }
}

/**
 * Draw a single category sprite onto a canvas.
 * Layout: white outer ring → colored fill → white FA glyph centered.
 */
function drawSprite(cat: PoiCategory): ImageData | null {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE_PX;
  canvas.height = SPRITE_SIZE_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const center = SPRITE_SIZE_PX / 2;
  const radius = SPRITE_SIZE_PX * 0.42;

  // Drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 6 * SPRITE_PIXEL_RATIO;
  ctx.shadowOffsetY = 2 * SPRITE_PIXEL_RATIO;

  // Filled circle
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = cat.color;
  ctx.fill();

  // White border on top (reset shadow so it doesn't stroke a shadow ring)
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineWidth = 3 * SPRITE_PIXEL_RATIO;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // Glyph — resolved from the DOM so we stay agnostic of FA version
  const glyph = resolveFaGlyph(cat.faIcon);
  if (glyph) {
    // FA 6 free registers as "Font Awesome 6 Free" with weight 900 (solid).
    // Falling back to "FontAwesome" covers older versions.
    ctx.font = `900 ${SPRITE_SIZE_PX * 0.42}px "Font Awesome 6 Free", "FontAwesome", sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Tiny vertical nudge — FA glyphs sit slightly high in the baseline box
    ctx.fillText(glyph, center, center + SPRITE_SIZE_PX * 0.015);
  }

  return ctx.getImageData(0, 0, SPRITE_SIZE_PX, SPRITE_SIZE_PX);
}

/**
 * Register a Mapbox image for every POI category + the fallback. Awaits
 * document.fonts.ready so the FA font is definitely loaded before we
 * rasterize glyphs to canvas (otherwise we'd get the fallback font).
 * Safe to call multiple times — existing images are skipped.
 */
export async function registerPoiSprites(map: MapboxMap): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // fonts.ready isn't fatal — carry on and take whatever we get
    }
  }

  const all: PoiCategory[] = [...POI_CATEGORIES, POI_FALLBACK_CATEGORY];
  for (const cat of all) {
    const id = spriteIdFor(cat.id);
    if (map.hasImage(id)) continue;

    const imageData = drawSprite(cat);
    if (!imageData) continue;

    map.addImage(id, imageData, { pixelRatio: SPRITE_PIXEL_RATIO });
  }
}
