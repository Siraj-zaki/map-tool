import { useTranslation } from 'react-i18next';
import { calculateHikingDuration, formatDuration, type Route } from '../../api';
import { useColorSettings } from '../../contexts/ColorSettingsContext';
import './RouteStatsBar.css';

interface RouteStatsBarProps {
  route: Route;
  showWeather?: boolean;
  showDownloadButton?: boolean;
  onDownloadClick?: () => void;
  onLocationSelect?: (coords: {
    lng: number;
    lat: number;
    name: string;
  }) => void;
  /** Custom logo URL — falls back to the default header logo when omitted. */
  logoUrl?: string;
  /**
   * Per-view accent override (share-link `customAccentColor`). Recolors
   * `--brand-accent` for this subtree only.
   */
  accentColor?: string;
  /**
   * Per-view primary override (share-link `customPrimaryColor`). Recolors
   * `--brand-primary` for this subtree only — flips the download CTA + any
   * `.brand-primary-*` consumer.
   */
  primaryColor?: string;
}

const DEFAULT_LOGO = '/images/header-logo.svg';

/**
 * Renders a monochrome SVG asset as a CSS mask so its shape is filled with
 * `--brand-accent`. The stat-bar icons ship as static SVGs — using them as
 * `<img>` would ignore the brand color; using them as mask fills them with
 * the current accent so admins see their brand applied.
 */
function StatIcon({
  src,
  alt,
  variant = 'desktop',
}: {
  src: string;
  alt: string;
  variant?: 'desktop' | 'mobile';
}) {
  return (
    <span
      role="img"
      aria-label={alt}
      className={
        variant === 'mobile' ? 'stat-icon-tinted--mobile' : 'stat-icon-tinted'
      }
      style={{ ['--icon-url' as any]: `url(${src})` }}
    />
  );
}

export default function RouteStatsBar({
  route,
  showDownloadButton = false,
  onDownloadClick,
  logoUrl,
  accentColor,
  primaryColor,
}: RouteStatsBarProps) {
  const { t } = useTranslation();
  const { routeSettings } = useColorSettings();
  // Precedence: per-share-link override (prop) → global white-label brand
  // → default. This lets share links customize per-view while everything
  // else picks up the admin-configured brand.
  const effectiveLogo = logoUrl || routeSettings.brandLogoUrl || undefined;
  const effectiveAccent =
    accentColor || routeSettings.accentColor || undefined;
  const effectivePrimary =
    primaryColor || routeSettings.primaryColor || undefined;

  // Calculate realistic hiking/cycling duration based on distance and elevation
  const distanceKm = parseFloat(String(route.distance || 0));
  const totalAscent = parseFloat(String(route.totalAscent || 0));
  const calculatedDuration = calculateHikingDuration(distanceKm, totalAscent);

  const resolvedLogo = effectiveLogo || DEFAULT_LOGO;
  // Override the brand CSS vars scoped to this bar so per-share-link
  // customization wins over the global admin brand within this subtree.
  // Consumers (`.brand-primary-bg`, `.brand-accent-bg`, `.icon-box-*`)
  // pick up whichever value is closest in the CSS custom-property scope.
  const styleWithAccent: React.CSSProperties = {};
  if (effectivePrimary) {
    (styleWithAccent as any)['--brand-primary'] = effectivePrimary;
  }
  if (effectiveAccent) {
    (styleWithAccent as any)['--brand-accent'] = effectiveAccent;
    // Backwards-compat: if a legacy share link only set accent (no primary),
    // recolor the header CTA too so it behaves like it did pre-Phase-6.
    if (!effectivePrimary) {
      (styleWithAccent as any)['--brand-primary'] = effectiveAccent;
    }
  }

  return (
    <>
      {/* --- DESKTOP VIEW (unchanged, hidden on mobile) --- */}
      <div className="hidden md:flex route-stats-bar" style={styleWithAccent}>
        {/* Left Section: Logo & Title */}
        <div className="stats-left">
          <img
            className="ms-logo-icon"
            src={resolvedLogo}
            alt="Logo"
            onError={e => {
              // Guard against a bad custom URL wiping out the header — fall
              // back to the default logo so the bar isn't visually broken.
              const img = e.currentTarget;
              if (img.src !== window.location.origin + DEFAULT_LOGO) {
                img.src = DEFAULT_LOGO;
              }
            }}
          />
          <h1 className="route-title">{route.name}</h1>
          <div className="stats-separator"></div>
        </div>

        {/* Center Section: Stats */}
        <div className="stats-center">
          {/* Distance */}
          <div className="stat-item" title={t('distance')}>
            <div className="stat-icon-wrapper">
              <StatIcon src="/images/header-distance.svg" alt="Distance" />
            </div>
            <span className="stat-value">{distanceKm.toFixed(1)} km</span>
          </div>

          {/* Duration */}
          <div className="stat-item" title={t('duration')}>
            <div className="stat-icon-wrapper">
              <StatIcon src="/images/header-time.svg" alt="Duration" />
            </div>
            <span className="stat-value">
              {formatDuration(calculatedDuration)}
            </span>
          </div>

          {/* Ascent */}
          <div className="stat-item" title={t('totalAscent')}>
            <div className="stat-icon-wrapper">
              <StatIcon src="/images/header-arrow-up.svg" alt="Ascent" />
            </div>
            <span className="stat-value">{Math.round(totalAscent)} m</span>
          </div>

          {/* Descent */}
          <div className="stat-item" title={t('totalDescent')}>
            <div className="stat-icon-wrapper">
              <StatIcon src="/images/header-arrow-down.svg" alt="Descent" />
            </div>
            <span className="stat-value">
              {Math.round(parseFloat(String(route.totalDescent || 0)))} m
            </span>
          </div>

          {/* Highest/Lowest */}
          <div className="stat-item" title={t('highestPoint')}>
            <div className="stat-icon-wrapper">
              <StatIcon src="/images/header-mountain.svg" alt="Highest point" />
            </div>
            <span className="stat-value">
              {Math.round(parseFloat(String(route.highestPoint || 0)))} m
            </span>
          </div>
        </div>

        {/* Right Section: Download */}
        <div className="stats-right">
          {showDownloadButton && onDownloadClick && (
            <button
              className="download-btn brand-primary-bg"
              onClick={onDownloadClick}
            >
              <span className="download-text ">GPX herunterladen</span>
              <img
                src="/images/download-icon.svg"
                alt="Download GPX"
                className="download-icon"
              />
            </button>
          )}
        </div>
      </div>

      {/* --- MOBILE VIEW (visible only on mobile) --- */}
      <div
        className="flex md:hidden h-[80px] flex-row w-full relative z-50 bg-black rounded-b-3xl mt-[-10px] pt-[20px] pb-4 px-5 items-center justify-between"
        style={styleWithAccent}
      >

        {/* Left Section (Logo + Texts) */}
        <div className="flex items-center gap-2 h-full mt-1 w-full overflow-hidden">
          {/* Logo & Divider */}
          <div className="flex items-center h-full relative shrink-0">
            <img
              className="w-[42px] h-[42px] ml-[0px] object-contain"
              src={resolvedLogo}
              alt="Logo"
              onError={e => {
                const img = e.currentTarget;
                if (img.src !== window.location.origin + DEFAULT_LOGO) {
                  img.src = DEFAULT_LOGO;
                }
              }}
            />
            <div className="h-[40px] w-[1px] bg-[#4b4b4b] ml-[14px]" />
          </div>

          {/* Texts (Title & Stats) vertically justified */}
          <div className="flex flex-col justify-between h-[42px] ml-[2px] w-full min-w-0">
            <h1 className="text-white text-[16px] font-bold font-['Roboto'] truncate w-full leading-tight mt-[-2px]">
              {route.name}
            </h1>

            <div className="flex items-center gap-2 sm:gap-4 mt-[4px]">
              {/* Distance */}
              <div className="flex items-center gap-1.5 shrink-0">
                <StatIcon
                  src="/images/header-distance.svg"
                  alt="Distance"
                  variant="mobile"
                />
                <span className="text-white text-[11.5px] font-semibold font-['Roboto']">
                  {distanceKm.toFixed(1)} km
                </span>
              </div>

              {/* Duration */}
              <div className="flex items-center gap-1.5 shrink-0">
                <StatIcon
                  src="/images/header-time.svg"
                  alt="Duration"
                  variant="mobile"
                />
                <span className="text-white text-[11.5px] font-semibold font-['Roboto']">
                  {formatDuration(calculatedDuration)}
                </span>
              </div>

              {/* Ascent */}
              <div className="flex items-center gap-1.5 shrink-0">
                <StatIcon
                  src="/images/header-arrow-up.svg"
                  alt="Ascent"
                  variant="mobile"
                />
                <span className="text-white text-[11.5px] font-semibold font-['Roboto']">
                  {Math.round(totalAscent)} m
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section (Download Button) sized exactly to match text block height */}
        {showDownloadButton && onDownloadClick && (
          <button
            onClick={onDownloadClick}
            className="w-10 h-[42px] brand-primary-bg rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-transform mt-1 ml-2"
          >
            <img
              src="/images/download-icon.svg"
              alt="Download"
              className="w-5 h-5 filter brightness-0 invert"
            />
          </button>
        )}
      </div>
    </>
  );
}
