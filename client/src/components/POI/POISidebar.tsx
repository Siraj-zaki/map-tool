import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { POI } from '../../api';
import {
  getCategoryOrFallback,
  type PoiFieldSpec,
} from '../../constants/poiCategories';
import './POISidebar.css';

interface POISidebarProps {
  poi: POI | null;
  routeStartPoint?: [number, number];
  routeGeometry?: [number, number][];
  onClose: () => void;
}

// --- Distance helpers ------------------------------------------------------

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Cumulative route distance from start to the point nearest the POI.
// Returns meters, or -1 if the route isn't available.
function distanceAlongRouteMeters(
  poiLngLat: [number, number],
  routeGeometry: [number, number][] | undefined
): number {
  if (!routeGeometry || routeGeometry.length < 2) return -1;

  const [poiLng, poiLat] = poiLngLat;

  let closestIdx = 0;
  let minDist = Infinity;
  for (let i = 0; i < routeGeometry.length; i++) {
    const [lng, lat] = routeGeometry[i];
    const d = haversineKm(poiLat, poiLng, lat, lng);
    if (d < minDist) {
      minDist = d;
      closestIdx = i;
    }
  }

  let total = 0;
  for (let i = 1; i <= closestIdx; i++) {
    const [pLng, pLat] = routeGeometry[i - 1];
    const [cLng, cLat] = routeGeometry[i];
    total += haversineKm(pLat, pLng, cLat, cLng);
  }
  return Math.round(total * 1000);
}

// --- Amenity → icon/label lookups ------------------------------------------

const AMENITY_ICONS: Record<string, string> = {
  food: 'fa-utensils',
  wc: 'fa-restroom',
  charging: 'fa-charging-station',
  difficulty: 'fa-mountain',
  parking: 'fa-parking',
  water: 'fa-droplet',
  shelter: 'fa-house',
  viewpoint: 'fa-binoculars',
  camping: 'fa-campground',
  wifi: 'fa-wifi',
  shower: 'fa-shower',
};

const AMENITY_LABELS: Record<string, string> = {
  food: 'food',
  wc: 'toilet',
  charging: 'chargingStation',
  difficulty: 'difficulty',
  parking: 'parking',
  water: 'waterSource',
  shelter: 'shelter',
  viewpoint: 'viewpoint',
  camping: 'camping',
  wifi: 'wifi',
  shower: 'shower',
};

// Grouped so the facilities panel reads as a scannable list rather than a
// flat 11-item grid.
const AMENITY_GROUPS: { titleKey: string; keys: string[] }[] = [
  { titleKey: 'amenityEssentials', keys: ['wc', 'water', 'food', 'shelter'] },
  { titleKey: 'amenityComforts', keys: ['wifi', 'shower', 'camping'] },
  { titleKey: 'amenityServices', keys: ['parking', 'charging', 'viewpoint', 'difficulty'] },
];

// --- Component -------------------------------------------------------------

export default function POISidebar({
  poi,
  routeGeometry,
  onClose,
}: POISidebarProps) {
  const { t } = useTranslation();
  const [imageIndex, setImageIndex] = useState(0);
  const [copyState, setCopyState] = useState<null | 'coords' | 'link'>(null);

  // Reset the carousel when the selected POI changes so a new POI doesn't
  // open on a stale slide.
  useEffect(() => {
    setImageIndex(0);
    setCopyState(null);
  }, [poi?.poi_id]);

  const images = poi?.images ?? [];
  const hasImages = images.length > 0;
  const hasMultipleImages = images.length > 1;

  const nextImage = useCallback(() => {
    if (!hasMultipleImages) return;
    setImageIndex(i => (i + 1) % images.length);
  }, [hasMultipleImages, images.length]);

  const prevImage = useCallback(() => {
    if (!hasMultipleImages) return;
    setImageIndex(i => (i - 1 + images.length) % images.length);
  }, [hasMultipleImages, images.length]);

  // Keyboard shortcuts while the sidebar is open: ←/→ navigate images,
  // Esc closes. Ignored when a text field is focused.
  useEffect(() => {
    if (!poi) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') nextImage();
      else if (e.key === 'ArrowLeft') prevImage();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [poi, nextImage, prevImage, onClose]);

  if (!poi) return null;

  const category = getCategoryOrFallback(poi.type);
  const metadata = (poi.metadata ?? {}) as Record<string, unknown>;
  const distanceMeters = distanceAlongRouteMeters(poi.lngLat, routeGeometry);

  // Only render facts the user actually filled in.
  const populatedFields: PoiFieldSpec[] = (category.fields ?? []).filter(f => {
    const v = metadata[f.key];
    return v !== undefined && v !== null && v !== '';
  });

  const copyCoords = async () => {
    try {
      const text = `${poi.lngLat[1].toFixed(5)}, ${poi.lngLat[0].toFixed(5)}`;
      await navigator.clipboard.writeText(text);
      setCopyState('coords');
      setTimeout(() => setCopyState(null), 1200);
    } catch {
      // Clipboard API may fail on http:// or missing permission — silent
    }
  };

  const openInMaps = () => {
    const [lng, lat] = poi.lngLat;
    // Universal maps URL — works with Google Maps, Apple Maps on iOS,
    // and most Android map apps as a directions intent.
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const phoneUrl = typeof metadata.phone === 'string' ? metadata.phone : null;
  const websiteUrl = typeof metadata.website === 'string' ? metadata.website : null;

  return (
    <div className={`poi-sidebar ${poi ? 'visible' : ''}`}>
      <div className="poi-content">
        {/* --- Hero: image carousel with a colored category header band --- */}
        <div className="poi-hero">
          <button
            className="close-button"
            onClick={onClose}
            aria-label={t('close') || 'Close'}
          >
            <i className="fas fa-times"></i>
          </button>

          <div className="image-carousel">
            <div className="carousel-container">
              {hasImages ? (
                images.map((img, index) => (
                  <img
                    key={`${poi.poi_id}-${index}`}
                    src={img}
                    alt={poi.name}
                    className="carousel-image"
                    loading={index === 0 ? 'eager' : 'lazy'}
                    style={{
                      display: index === imageIndex ? 'block' : 'none',
                    }}
                    onError={e => {
                      e.currentTarget.src = '/api/placeholder/400/320';
                    }}
                  />
                ))
              ) : (
                <div
                  className="carousel-placeholder"
                  style={{ background: `linear-gradient(135deg, ${category.color}22 0%, #0b1215 100%)` }}
                >
                  <i
                    className={`fas ${category.faIcon}`}
                    style={{ color: category.color, fontSize: '3rem', opacity: 0.6 }}
                  ></i>
                </div>
              )}
            </div>

            {hasMultipleImages && (
              <>
                <button
                  className="carousel-button prev"
                  onClick={prevImage}
                  aria-label="Previous image"
                >
                  ❮
                </button>
                <button
                  className="carousel-button next"
                  onClick={nextImage}
                  aria-label="Next image"
                >
                  ❯
                </button>
                <div className="carousel-dots">
                  {images.map((_, index) => (
                    <span
                      key={index}
                      className={`dot ${index === imageIndex ? 'active' : ''}`}
                      onClick={() => setImageIndex(index)}
                    ></span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Category chip anchored top-left of hero */}
          <div
            className="poi-category-chip"
            style={{
              background: `${category.color}`,
            }}
          >
            <i className={`fas ${category.faIcon}`}></i>
            <span>{t(category.labelKey)}</span>
          </div>

          {/* Title + colored accent band overlay */}
          <div className="poi-hero-overlay">
            <div
              className="poi-hero-accent"
              style={{ background: category.color }}
            />
            <h1 className="poi-hero-title">{poi.name}</h1>
          </div>
        </div>

        {/* --- Body: scrollable, single column of sections --- */}
        <div className="poi-body">
          {/* Description */}
          {poi.description && (
            <section className="poi-section">
              <p className="poi-description">{poi.description}</p>
            </section>
          )}

          {/* Category-specific facts */}
          {populatedFields.length > 0 && (
            <section className="poi-section">
              <h3 className="poi-section-title" style={{ color: category.color }}>
                {t('detailsSection') || 'Details'}
              </h3>
              <div className="poi-facts-grid">
                {populatedFields.map(field => (
                  <FactCell
                    key={field.key}
                    field={field}
                    value={metadata[field.key]}
                    t={t}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Route context (distance from start, best time) */}
          {(distanceMeters >= 0 || poi.best_time) && (
            <section className="poi-section">
              <h3 className="poi-section-title" style={{ color: category.color }}>
                {t('overview')}
              </h3>
              <div className="poi-facts-grid">
                {distanceMeters >= 0 && (
                  <div className="poi-fact">
                    <i className="fas fa-route poi-fact-icon" style={{ color: category.color }}></i>
                    <div className="poi-fact-body">
                      <span className="poi-fact-label">
                        {t('distanceFromStart')}
                      </span>
                      <span className="poi-fact-value">
                        {distanceMeters < 1000
                          ? `${distanceMeters} m`
                          : `${(distanceMeters / 1000).toFixed(1)} km`}
                      </span>
                    </div>
                  </div>
                )}
                {poi.best_time && (
                  <div className="poi-fact">
                    <i className="fas fa-clock poi-fact-icon" style={{ color: category.color }}></i>
                    <div className="poi-fact-body">
                      <span className="poi-fact-label">{t('bestVisitTime')}</span>
                      <span className="poi-fact-value">
                        {t(poi.best_time) || poi.best_time}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Amenities (grouped) */}
          {poi.amenities && poi.amenities.length > 0 && (
            <section className="poi-section">
              <h3 className="poi-section-title" style={{ color: category.color }}>
                {t('facilitiesAndService')}
              </h3>
              <AmenityGroups amenities={poi.amenities} t={t} />
            </section>
          )}

          {/* Location + actions */}
          <section className="poi-section">
            <h3 className="poi-section-title" style={{ color: category.color }}>
              {t('location')}
            </h3>
            <button
              type="button"
              onClick={copyCoords}
              className="poi-coords-row"
              title={t('copyCoordinates') || 'Copy coordinates'}
            >
              <i className="fas fa-map-marker-alt" style={{ color: category.color }}></i>
              <span>
                {poi.lngLat[1].toFixed(5)}, {poi.lngLat[0].toFixed(5)}
              </span>
              <i
                className={`fas ${copyState === 'coords' ? 'fa-check' : 'fa-copy'} poi-coords-copy`}
              ></i>
            </button>

            <div className="poi-actions-row">
              <button
                type="button"
                onClick={openInMaps}
                className="poi-action-btn"
                style={{ borderColor: category.color, color: category.color }}
              >
                <i className="fas fa-diamond-turn-right"></i>
                <span>{t('getDirections') || 'Get directions'}</span>
              </button>
              {phoneUrl && (
                <a
                  href={`tel:${phoneUrl.replace(/[^\d+]/g, '')}`}
                  className="poi-action-btn"
                >
                  <i className="fas fa-phone"></i>
                  <span>{phoneUrl}</span>
                </a>
              )}
              {websiteUrl && (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="poi-action-btn"
                >
                  <i className="fas fa-globe"></i>
                  <span>{t('fieldWebsite') || 'Website'}</span>
                </a>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components --------------------------------------------------------

interface FactCellProps {
  field: PoiFieldSpec;
  value: unknown;
  t: (key: string) => string;
}

function FactCell({ field, value, t }: FactCellProps) {
  let display: string;

  switch (field.kind) {
    case 'number':
      display = `${value}${field.unit ? ` ${field.unit}` : ''}`;
      break;
    case 'bool':
      display = value ? (t('yes') || 'Yes') : (t('no') || 'No');
      break;
    case 'select': {
      const opt = field.options.find(o => o.value === value);
      display = opt ? t(opt.labelKey) : String(value);
      break;
    }
    case 'url':
    case 'phone':
    case 'text':
    default:
      display = String(value);
  }

  return (
    <div className="poi-fact">
      {field.icon && (
        <i className={`fas ${field.icon} poi-fact-icon`}></i>
      )}
      <div className="poi-fact-body">
        <span className="poi-fact-label">{t(field.labelKey)}</span>
        <span className="poi-fact-value">{display}</span>
      </div>
    </div>
  );
}

interface AmenityGroupsProps {
  amenities: string[];
  t: (key: string) => string;
}

function AmenityGroups({ amenities, t }: AmenityGroupsProps) {
  const owned = new Set(amenities.map(a => a.toLowerCase()));

  // Preserve group order; skip empty groups; anything unknown lands in "Other".
  const groupedRows = AMENITY_GROUPS.map(group => ({
    ...group,
    items: group.keys.filter(k => owned.has(k)),
  })).filter(g => g.items.length > 0);

  const covered = new Set(AMENITY_GROUPS.flatMap(g => g.keys));
  const unknown = amenities.filter(a => !covered.has(a.toLowerCase()));

  return (
    <div className="poi-amenity-groups">
      {groupedRows.map(group => (
        <div key={group.titleKey} className="poi-amenity-group">
          <span className="poi-amenity-group-title">
            {t(group.titleKey) || group.titleKey}
          </span>
          <div className="poi-amenity-chips">
            {group.items.map(a => (
              <span key={a} className="poi-amenity-chip">
                <i className={`fas ${AMENITY_ICONS[a] || 'fa-circle'}`}></i>
                {t(AMENITY_LABELS[a] || a)}
              </span>
            ))}
          </div>
        </div>
      ))}
      {unknown.length > 0 && (
        <div className="poi-amenity-group">
          <span className="poi-amenity-group-title">
            {t('amenityOther') || 'Other'}
          </span>
          <div className="poi-amenity-chips">
            {unknown.map(a => (
              <span key={a} className="poi-amenity-chip">
                <i className="fas fa-circle"></i>
                {a}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
