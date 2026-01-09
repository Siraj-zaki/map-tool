import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { routesApi, type POI, type Route } from '../api';
import ElevationProfile from '../components/ElevationProfile/ElevationProfileVisx';
import LocationFilter from '../components/LocationFilter/LocationFilter';
import MapComponent from '../components/Map/MapComponent';
import POISidebar from '../components/POI/POISidebar';
import PremiumModal from '../components/Premium/PremiumModal';
import RouteStatsBar from '../components/RouteStatsBar/RouteStatsBar';
import TourStagePanel from '../components/TourStagePanel/TourStagePanel';
import WeatherForecast from '../components/Weather/WeatherForecast';

export default function PublicView() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const routeId = id || searchParams.get('route');
  const { t } = useTranslation();

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
  const [flyToLocation, setFlyToLocation] = useState<{
    lng: number;
    lat: number;
  } | null>(null);

  // Bi-directional sync between map and profile
  const [highlightDistance, setHighlightDistance] = useState<
    number | undefined
  >();
  const [highlightPosition, setHighlightPosition] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const flyToPoiRef = useRef<((poi: POI) => void) | null>(null);

  // Mobile Toggles
  const [showMobileRouteStats, setShowMobileRouteStats] = useState(false);
  const [showMobileWeather, setShowMobileWeather] = useState(false);

  useEffect(() => {
    if (!routeId) {
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
    console.log('[PublicView] handlePoiClick called:', poi.name);
    setSelectedPoi(poi);
    // Fly to POI on map
    if (flyToPoiRef.current) {
      flyToPoiRef.current(poi);
    }
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#0b1215] text-gray-400">
        <i className="fas fa-mountain fa-spin text-4xl text-[#088d95] mb-4"></i>
        <span>{t('routeLoading')}</span>
      </div>
    );
  }

  if (error || !route) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#0b1215] text-gray-400">
        <i className="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
        <span>{error || t('noRouteSpecified')}</span>
      </div>
    );
  }

  // Get center coordinates for weather
  const centerLat = (route.startPoint[1] + route.endPoint[1]) / 2;
  const centerLng = (route.startPoint[0] + route.endPoint[0]) / 2;

  return (
    <div className="h-screen flex flex-col bg-[#0b1215]">
      {/* Stats Bar */}
      <RouteStatsBar
        route={route}
        showWeather={true}
        showDownloadButton={true}
        onDownloadClick={() => setShowPremiumModal(true)}
        onLocationSelect={coords =>
          setFlyToLocation({ lng: coords.lng, lat: coords.lat })
        }
      />

      {/* Map Container with Overlays */}
      <div className="flex-1 relative h-full overflow-hidden">
        {/* Mobile Toggles (Top Right, below header) */}
        <div className="absolute top-4 right-3 z-50 flex flex-col gap-2 md:hidden">
          <button
            onClick={() => {
              setShowMobileRouteStats(!showMobileRouteStats);
              setShowMobileWeather(false); // Toggle exclusive
            }}
            className={`w-10 h-10 flex items-center justify-center rounded-lg border shadow-lg transition-all ${
              showMobileRouteStats
                ? 'bg-[#088d95] border-[#088d95] text-white'
                : 'bg-[#080e11] border-[#1e2a33] text-[#088d95]'
            }`}
          >
            <i className="fas fa-list-ul"></i>
          </button>
          <button
            onClick={() => {
              setShowMobileWeather(!showMobileWeather);
              setShowMobileRouteStats(false); // Toggle exclusive
            }}
            className={`w-10 h-10 flex items-center justify-center rounded-lg border shadow-lg transition-all ${
              showMobileWeather
                ? 'bg-[#088d95] border-[#088d95] text-white'
                : 'bg-[#080e11] border-[#1e2a33] text-[#088d95]'
            }`}
          >
            <i className="fas fa-cloud"></i>
          </button>
        </div>

        {/* Tour Selector - Top Left (Hidden on mobile unless toggled) */}
        <div
          className={`absolute top-2 left-2 md:top-3 md:left-[60px] z-40 flex flex-col gap-3 items-start transition-opacity duration-300 ${
            showMobileRouteStats
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto'
          }`}
        >
          <TourStagePanel
            route={route}
            tourType={tourType}
            onTourTypeChange={setTourType}
            selectedStage={selectedStage}
            onStageSelect={setSelectedStage}
          />
          <LocationFilter routeId={route.id} tourType={tourType} />
        </div>

        {/* Weather Forecast Overlay */}
        {/* Desktop: Top Right. Mobile: Bottom Left (above profile) */}
        <div
          className={`absolute z-40 transition-all duration-300
            md:top-4 md:right-3 md:bottom-auto md:left-auto md:opacity-100 md:pointer-events-auto
            ${
              showMobileWeather
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none'
            }
            bottom-2 left-2 right-2 md:w-auto
            `}
        >
          <WeatherForecast
            lat={centerLat}
            lng={centerLng}
            locationName={route.name || 'Route'}
          />
        </div>

        <MapComponent
          route={route}
          tourType={tourType}
          selectedStage={selectedStage}
          onPositionChange={handleMapPositionChange}
          onPoiClick={setSelectedPoi}
          isFullscreen={isFullscreen}
          highlightPosition={highlightPosition}
          flyToLocation={flyToLocation}
        />

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-3 left-3 z-50 w-9 h-9 flex items-center justify-center bg-[#080e11] border border-[#1e2a33] rounded-lg text-gray-400 hover:text-white hover:bg-[#088d95] hover:border-[#088d95] transition-all hidden md:flex"
        >
          <i
            className={`fas fa-${isFullscreen ? 'compress' : 'expand'} text-sm`}
          ></i>
        </button>

        {/* POI Sidebar */}
        <POISidebar
          poi={selectedPoi}
          routeStartPoint={route.startPoint}
          routeGeometry={route.routeGeometry}
          onClose={() => setSelectedPoi(null)}
        />
      </div>

      {/* Elevation Profile with Weather */}
      {!isFullscreen && (
        <div className="flex flex-col bg-[#0b1215] h-[180px] sm:h-[200px] md:h-[220px] lg:h-[250px]">
          <ElevationProfile
            route={route}
            pois={route.pois}
            tourType={tourType}
            onPositionChange={handleElevationPositionChange}
            highlightDistance={highlightDistance}
            onPoiClick={handlePoiClick}
          />
        </div>
      )}

      {/* Premium Modal */}
      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
      />
    </div>
  );
}
