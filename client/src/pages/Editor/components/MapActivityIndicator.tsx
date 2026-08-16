import { useTranslation } from 'react-i18next';

interface MapActivityIndicatorProps {
  routing: boolean;
  calculatingElevation: boolean;
}

/**
 * Non-blocking activity chip that surfaces async work happening on the map
 * (routing API calls, elevation queries). Positioned so it doesn't cover
 * the mode-info overlay (top-center) or the navigation controls (top-right).
 * Fades in/out to avoid a jarring pop.
 */
export default function MapActivityIndicator({
  routing,
  calculatingElevation,
}: MapActivityIndicatorProps) {
  const { t } = useTranslation();
  const visible = routing || calculatingElevation;

  // Prefer the more disruptive message when both are active — routing
  // blocks the geometry render, elevation happens in the background.
  const message = routing
    ? t('calculatingRoute') || 'Calculating route…'
    : t('calculatingElevationEllipsis') || 'Calculating elevation…';

  return (
    <div
      className={`absolute top-4 right-16 z-40 pointer-events-none transition-all duration-200 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
      }`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#080e11]/95 backdrop-blur-sm border border-[#1e2a33] rounded-full shadow-lg shadow-black/40">
        <i className="fas fa-spinner fa-spin text-[#088d95] text-xs"></i>
        <span className="text-white text-xs font-medium">{message}</span>
      </div>
    </div>
  );
}
