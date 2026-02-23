import { useTranslation } from 'react-i18next';
import { calculateHikingDuration, formatDuration, type Route } from '../../api';
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
}

export default function RouteStatsBar({
  route,
  showDownloadButton = false,
  onDownloadClick,
}: RouteStatsBarProps) {
  const { t } = useTranslation();

  // Calculate realistic hiking/cycling duration based on distance and elevation
  const distanceKm = parseFloat(String(route.distance || 0));
  const totalAscent = parseFloat(String(route.totalAscent || 0));
  const calculatedDuration = calculateHikingDuration(distanceKm, totalAscent);

  return (
    <>
      {/* --- DESKTOP VIEW (unchanged, hidden on mobile) --- */}
      <div className="hidden md:flex route-stats-bar">
        {/* Left Section: Logo & Title */}
        <div className="stats-left">
          <img
            className="ms-logo-icon"
            src="/images/header-logo.svg"
            alt="Logo"
          />
          <h1 className="route-title">{route.name}</h1>
          <div className="stats-separator"></div>
        </div>

        {/* Center Section: Stats */}
        <div className="stats-center">
          {/* Distance */}
          <div className="stat-item" title={t('distance')}>
            <div className="stat-icon-wrapper">
              <img
                src="/images/header-distance.svg"
                alt="Distance icon"
                className="stat-icon"
              />
            </div>
            <span className="stat-value">{distanceKm.toFixed(1)} km</span>
          </div>

          {/* Duration */}
          <div className="stat-item" title={t('duration')}>
            <div className="stat-icon-wrapper">
              <img
                src="/images/header-time.svg"
                alt="Duration icon"
                className="stat-icon"
              />
            </div>
            <span className="stat-value">
              {formatDuration(calculatedDuration)}
            </span>
          </div>

          {/* Ascent */}
          <div className="stat-item" title={t('totalAscent')}>
            <div className="stat-icon-wrapper">
              <img
                src="/images/header-arrow-up.svg"
                alt="Ascent icon"
                className="stat-icon"
              />
            </div>
            <span className="stat-value">{Math.round(totalAscent)} m</span>
          </div>

          {/* Descent */}
          <div className="stat-item" title={t('totalDescent')}>
            <div className="stat-icon-wrapper">
              <img
                src="/images/header-arrow-down.svg"
                alt="Descent icon"
                className="stat-icon"
              />
            </div>
            <span className="stat-value">
              {Math.round(parseFloat(String(route.totalDescent || 0)))} m
            </span>
          </div>

          {/* Highest/Lowest */}
          <div className="stat-item" title={t('highestPoint')}>
            <div className="stat-icon-wrapper">
              <img
                src="/images/header-mountain.svg"
                alt="Highest point icon"
                className="stat-icon"
              />
            </div>
            <span className="stat-value">
              {Math.round(parseFloat(String(route.highestPoint || 0)))} m
            </span>
          </div>
        </div>

        {/* Right Section: Download */}
        <div className="stats-right">
          {showDownloadButton && onDownloadClick && (
            <button className="download-btn" onClick={onDownloadClick}>
              <span className="download-text">GPX herunterladen</span>
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
      <div className="flex md:hidden flex-col w-full relative z-50 bg-black rounded-b-3xl mt-[-10px] pt-[10px] pb-4 px-5">
        {/* Top Row: Logo, Title, Download */}
        <div className="w-full flex items-center justify-between mb-2 mt-2">
          <div className="flex items-center gap-3">
            <img
              className="w-[32px] h-[32px] object-contain"
              src="/images/header-logo.svg"
              alt="Logo"
            />
            <h1 className="text-white text-[16px] font-bold font-['Roboto'] truncate max-w-[200px]">
              {route.name}
            </h1>
          </div>

          {showDownloadButton && onDownloadClick && (
            <button
              onClick={onDownloadClick}
              className="w-10 h-10 bg-[#5ec4cd] rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            >
              <img
                src="/images/download-icon.svg"
                alt="Download"
                className="w-5 h-5 filter brightness-0 invert"
              />
            </button>
          )}
        </div>

        {/* Bottom Row: Core Stats */}
        <div className="w-full flex items-center gap-4 pl-[44px]">
          {/* Distance */}
          <div className="flex items-center gap-1.5">
            <img
              src="/images/header-distance.svg"
              alt="Dist"
              className="w-[15px] h-[15px] object-contain"
            />
            <span className="text-white text-xs font-semibold font-['Roboto']">
              {distanceKm.toFixed(1)} km
            </span>
          </div>

          {/* Duration */}
          <div className="flex items-center gap-2">
            <img
              src="/images/header-time.svg"
              alt="Time"
              className="w-[15px] h-[15px] object-contain"
            />
            <span className="text-white text-xs font-semibold font-['Roboto']">
              {formatDuration(calculatedDuration)}
            </span>
          </div>

          {/* Ascent */}
          <div className="flex items-center gap-2">
            <img
              src="/images/header-arrow-up.svg"
              alt="Up"
              className="w-[15px] h-[15px] object-contain"
            />
            <span className="text-white text-xs font-semibold font-['Roboto']">
              {Math.round(totalAscent)} m
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
