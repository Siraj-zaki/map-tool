import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { routesApi, type POI, type Route } from '../api';
import ElevationProfile from '../components/ElevationProfile/ElevationProfile';
import MapComponent from '../components/Map/MapComponent';
import POISidebar from '../components/POI/POISidebar';
import PremiumModal from '../components/Premium/PremiumModal';
import RouteStatsBar from '../components/RouteStatsBar/RouteStatsBar';
import TourSelector from '../components/TourSelector/TourSelector';
import WeatherForecast from '../components/Weather/WeatherForecast';

export default function EmbedView() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const routeId = searchParams.get('route');
  const lang = searchParams.get('lang');

  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPoi, setSelectedPoi] = useState<POI | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [tourType, setTourType] = useState<'gold' | 'silver' | 'bronze'>(
    'gold'
  );
  const [selectedStage, setSelectedStage] = useState<number | null>(null);

  // Bi-directional sync between map and profile
  const [highlightDistance, setHighlightDistance] = useState<
    number | undefined
  >();
  const [highlightPosition, setHighlightPosition] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const flyToPoiRef = useRef<((poi: POI) => void) | null>(null);

  // Set language from URL parameter
  useEffect(() => {
    if (lang && (lang === 'de' || lang === 'en')) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);

  useEffect(() => {
    if (!routeId) {
      setError('No route ID provided. Use ?route=ID');
      setLoading(false);
      return;
    }

    const loadRoute = async () => {
      try {
        const result = await routesApi.getById(Number(routeId));
        if (result.success) {
          setRoute(result.route);
        } else {
          setError('Route not found');
        }
      } catch (err) {
        setError('Failed to load route');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadRoute();
  }, [routeId]);

  // Handle map hover - updates elevation profile
  const handleMapPositionChange = useCallback(
    (
      pos: {
        lng: number;
        lat: number;
        distance: number;
        index: number;
      } | null
    ) => {
      if (pos) {
        setHighlightDistance(pos.distance);
      } else {
        setHighlightDistance(undefined);
      }
    },
    []
  );

  // Handle elevation profile hover - updates map marker
  const handleElevationPositionChange = useCallback(
    (
      pos: {
        lng: number;
        lat: number;
        distance: number;
        elevation: number;
        grade: number;
      } | null
    ) => {
      if (pos) {
        setHighlightPosition({ lng: pos.lng, lat: pos.lat });
      } else {
        setHighlightPosition(null);
      }
    },
    []
  );

  // Handle POI click from elevation profile - opens sidebar and flies to POI
  const handlePoiClick = useCallback((poi: POI) => {
    setSelectedPoi(poi);
    // Fly to POI on map
    if (flyToPoiRef.current) {
      flyToPoiRef.current(poi);
    }
  }, []);

  if (loading) {
    return (
      <div className="wrapper">
        <div className="h-full flex flex-col items-center justify-center text-[#a0a0a0]">
          <i className="fas fa-mountain text-4xl text-[#088d95] mb-4 animate-bounce"></i>
          <div className="text-sm">{t('routeLoading')}</div>
        </div>
        <style>{wrapperStyles}</style>
      </div>
    );
  }

  if (error || !route) {
    return (
      <div className="wrapper">
        <div className="h-full flex flex-col items-center justify-center text-[#a0a0a0]">
          <i className="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
          <div>{error || t('routeNotFound')}</div>
        </div>
        <style>{wrapperStyles}</style>
      </div>
    );
  }

  return (
    <div className="wrapper">
      {/* Route Stats Bar */}
      <RouteStatsBar
        route={route}
        showWeather={true}
        showDownloadButton={true}
        onDownloadClick={() => setShowPremiumModal(true)}
      />

      {/* Map Content Area */}
      <div className="content" style={{ position: 'relative' }}>
        {/* Tour Selector - Top Left */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '60px',
            zIndex: 40,
          }}
        >
          <TourSelector
            tourType={tourType}
            onTourTypeChange={setTourType}
            selectedStage={selectedStage}
            onStageSelect={setSelectedStage}
          />
        </div>

        {/* Weather Forecast Overlay - Top Right */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '60px',
            zIndex: 40,
          }}
        >
          <WeatherForecast
            lat={(route.startPoint[1] + route.endPoint[1]) / 2}
            lng={(route.startPoint[0] + route.endPoint[0]) / 2}
            locationName={route.name || 'Route'}
          />
        </div>

        <div id="map">
          <MapComponent
            route={route}
            tourType={tourType}
            selectedStage={selectedStage}
            onPositionChange={handleMapPositionChange}
            onPoiClick={setSelectedPoi}
            highlightPosition={highlightPosition}
            isFullscreen={isFullscreen}
          />
        </div>

        {/* Fullscreen Button */}
        <button
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen();
              setIsFullscreen(true);
            } else {
              document.exitFullscreen();
              setIsFullscreen(false);
            }
          }}
          className="absolute top-3 left-3 z-50 w-10 h-10 flex items-center justify-center bg-[#080e11] border border-[#1e2a33] rounded-lg text-gray-400 hover:text-white hover:bg-[#088d95] hover:border-[#088d95] transition-all"
          title={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
        >
          <i className={`fas fa-${isFullscreen ? 'compress' : 'expand'}`}></i>
        </button>
      </div>

      {/* Elevation Profile Container */}
      <div id="profilesContainer">
        <ElevationProfile
          route={route}
          pois={route.pois}
          tourType={tourType}
          onPositionChange={handleElevationPositionChange}
          highlightDistance={highlightDistance}
          onPoiClick={handlePoiClick}
        />
      </div>

      {/* POI Sidebar */}
      <POISidebar
        poi={selectedPoi}
        routeStartPoint={route.startPoint}
        onClose={() => setSelectedPoi(null)}
      />

      {/* Premium Modal */}
      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        featureName="GPX Download"
      />

      <style>{wrapperStyles}</style>
    </div>
  );
}

// CSS matching public.css exactly with enhancements
const wrapperStyles = `
  .wrapper {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
    background: #0b1215;
    border-radius: 12px;
    border: 2px solid #088d95;
    box-shadow: 0 0 15px rgba(8, 141, 149, 0.7);
  }

  .content {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    overflow: hidden;
    background: transparent;
  }

  #map {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #0b1215;
  }

  #profilesContainer {
    width: 100%;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    background: #0b1215;
    z-index: 10;
  }
`;
