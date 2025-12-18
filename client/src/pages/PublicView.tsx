import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { routesApi, type POI, type Route } from '../api';
import ElevationProfile from '../components/ElevationProfile/ElevationProfile';
import GpxDownloadModal from '../components/GPX/GpxDownloadModal';
import MapComponent from '../components/Map/MapComponent';
import POISidebar from '../components/POI/POISidebar';
import RouteStatsBar from '../components/RouteStatsBar/RouteStatsBar';
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
  const [showGpxModal, setShowGpxModal] = useState(false);
  const [tourType, setTourType] = useState<'gold' | 'silver' | 'bronze'>(
    'gold'
  );

  // Bi-directional sync between map and profile
  const [highlightDistance, setHighlightDistance] = useState<
    number | undefined
  >();
  const [highlightPosition, setHighlightPosition] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const flyToPoiRef = useRef<((poi: POI) => void) | null>(null);

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
        tourType={tourType}
        onTourTypeChange={setTourType}
        showWeather={true}
        showTourSelector={true}
        showDownloadButton={true}
        onDownloadClick={() => setShowGpxModal(true)}
      />

      {/* Map Container with Weather Overlay */}
      <div className="flex-1 relative h-full">
        {/* Weather Forecast Overlay */}
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '60px',
            right: '60px',
            zIndex: 40,
            maxWidth: 'calc(100% - 60px)',
          }}
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
          onPositionChange={handleMapPositionChange}
          onPoiClick={setSelectedPoi}
          isFullscreen={isFullscreen}
          highlightPosition={highlightPosition}
        />

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-3 left-3 z-50 w-10 h-10 flex items-center justify-center bg-[#080e11] border border-[#1e2a33] rounded-lg text-gray-400 hover:text-white hover:bg-[#088d95] hover:border-[#088d95] transition-all"
        >
          <i className={`fas fa-${isFullscreen ? 'compress' : 'expand'}`}></i>
        </button>

        {/* POI Sidebar */}
        <POISidebar
          poi={selectedPoi}
          routeStartPoint={route.startPoint}
          onClose={() => setSelectedPoi(null)}
        />
      </div>

      {/* Elevation Profile with Weather */}
      {!isFullscreen && (
        <div className="flex flex-col bg-[#0b1215]">
          <ElevationProfile
            route={route}
            pois={route.pois}
            onPositionChange={handleElevationPositionChange}
            highlightDistance={highlightDistance}
            onPoiClick={handlePoiClick}
          />

          {/* Full Weather Widget - Mobile Only */}
          <div className="md:hidden px-4 py-2 bg-[#080e11] border-t border-[#1e2a33]">
            <WeatherForecast
              lat={centerLat}
              lng={centerLng}
              locationName={route.name || 'Route'}
            />
          </div>
        </div>
      )}

      {/* GPX Download Modal */}
      {showGpxModal && (
        <GpxDownloadModal
          onClose={() => setShowGpxModal(false)}
          routeId={route.id}
        />
      )}
    </div>
  );
}
