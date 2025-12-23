import { useTranslation } from 'react-i18next';
import { formatDuration, type Route } from '../../api';
import WeatherWidget from '../Weather/WeatherWidget';
import './RouteStatsBar.css';

interface RouteStatsBarProps {
  route: Route;
  showWeather?: boolean;
  showDownloadButton?: boolean;
  onDownloadClick?: () => void;
}

export default function RouteStatsBar({
  route,
  showWeather = true,
  showDownloadButton = false,
  onDownloadClick,
}: RouteStatsBarProps) {
  const { t } = useTranslation();

  // Get center coordinates for weather
  const centerLat = (route.startPoint[1] + route.endPoint[1]) / 2;
  const centerLng = (route.startPoint[0] + route.endPoint[0]) / 2;

  return (
    <div className="route-stats-bar" id="route-stats-bar">
      {/* Left Section: Title */}
      <div className="stats-left">
        <h1 className="route-title" id="routeTitle">
          {route.name}
        </h1>
      </div>

      {/* Center Section: Stats */}
      <div className="stats-center">
        <div className="stat-item" title={t('distance')}>
          <i className="fas fa-route"></i>
          <span>{parseFloat(String(route.distance || 0)).toFixed(1)} km</span>
        </div>
        <div className="stat-item" title={t('duration')}>
          <i className="fas fa-clock"></i>
          <span>{formatDuration(Number(route.duration) || 0)}</span>
        </div>
        <div className="stat-item" title={t('totalAscent')}>
          <i className="fas fa-arrow-up"></i>
          <span>
            {Math.round(parseFloat(String(route.totalAscent || 0)))} m
          </span>
        </div>
        <div className="stat-item" title={t('lowestPoint')}>
          <i className="fas fa-arrow-down"></i>
          <span>
            {Math.round(parseFloat(String(route.lowestPoint || 0)))} m
          </span>
        </div>
        <div className="stat-item" title={t('highestPoint')}>
          <i className="fas fa-mountain"></i>
          <span>
            {Math.round(parseFloat(String(route.highestPoint || 0)))} m
          </span>
        </div>
      </div>

      {/* Right Section: Weather, Download, Logo */}
      <div className="stats-right">
        {showWeather && (
          <div className="weather-container">
            <WeatherWidget lat={centerLat} lng={centerLng} compact />
          </div>
        )}

        {showDownloadButton && onDownloadClick && (
          <button className="download-btn" onClick={onDownloadClick}>
            <i className="fas fa-download"></i>
            <span className="download-text">{t('downloadGPX')}</span>
          </button>
        )}

        <a
          href="https://mountainsquad.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="logo-link"
        >
          <img
            src="/images/small-logo.png"
            alt="Mountain Squad"
            className="ms-logo"
            onError={e => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </a>
      </div>
    </div>
  );
}
