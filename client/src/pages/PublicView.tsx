import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { routesApi, type POI, type Route } from '../api';
import ElevationProfile from '../components/ElevationProfile/ElevationProfileVisx';
import GpxDownloadModal from '../components/GPX/GpxDownloadModal';
import MapComponent from '../components/Map/MapComponent';
import POISidebar from '../components/POI/POISidebar';
import RouteStatsBar from '../components/RouteStatsBar/RouteStatsBar';
import TourStagePanel from '../components/TourStagePanel/TourStagePanel';

export default function PublicView() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const routeId = id || searchParams.get('route');
  const { t } = useTranslation();

  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPoi, setSelectedPoi] = useState<POI | null>(null);
  const [showGpxModal, setShowGpxModal] = useState(false);
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
  const [selectedCity, setSelectedCity] = useState('Wernigerode');
  const flyToPoiRef = useRef<((poi: POI) => void) | null>(null);

  // Custom Map Controls state
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [, setIsFullscreen] = useState(false);

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

  // Handle POI click
  const handlePoiClick = useCallback((poi: POI) => {
    console.log('[PublicView] handlePoiClick called:', poi.name);
    setSelectedPoi(poi);
    if (flyToPoiRef.current) {
      flyToPoiRef.current(poi);
    }
  }, []);

  // Map Controls Actions
  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut();
  }, []);

  const handleLocateMe = useCallback(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        position => {
          mapRef.current?.flyTo({
            center: [position.coords.longitude, position.coords.latitude],
            zoom: 14,
          });
        },
        err => {
          console.error('Geolocation error:', err);
        }
      );
    }
  }, []);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(
          `Error attempting to enable full-screen mode: ${err.message} (${err.name})`
        );
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black font-sans">
      {/* 1. Background Map */}
      <div className="absolute inset-0 z-0">
        <MapComponent
          route={route}
          tourType={tourType}
          selectedStage={selectedStage}
          onPositionChange={handleMapPositionChange}
          onPoiClick={setSelectedPoi}
          highlightPosition={highlightPosition}
          flyToLocation={flyToLocation}
          selectedCity={selectedCity}
          onMapLoad={m => {
            mapRef.current = m;
          }}
        />
      </div>

      {/* 2. Top Navigation Bar */}
      <div className="absolute top-0 left-0 right-0 z-50 shadow-lg">
        <RouteStatsBar
          route={route}
          showDownloadButton={true}
          onDownloadClick={() => setShowGpxModal(true)}
          onLocationSelect={coords =>
            setFlyToLocation({ lng: coords.lng, lat: coords.lat })
          }
        />
      </div>

      {/* 3. Left Floating Panel */}
      <div className="static md:absolute md:top-28 md:left-4 z-60 flex flex-col gap-4 md:transform md:origin-top-left md:scale-90 lg:scale-100 transition-all">
        <TourStagePanel
          route={route}
          tourType={tourType}
          onTourTypeChange={setTourType}
          selectedStage={selectedStage}
          onStageSelect={setSelectedStage}
          selectedCity={selectedCity}
          onCityChange={setSelectedCity}
        />
        {/* <LocationFilter routeId={route.id} tourType={tourType} /> */}
      </div>

      {/* 4. Right Floating Widget (Custom Map Controls) */}
      <div className="absolute top-[160px] md:top-[284px] right-2 md:right-4 z-40 flex flex-col items-center gap-2 md:gap-3 transform origin-right scale-75 sm:scale-90 lg:scale-100 transition-all pointer-events-auto">
        {/* Fullscreen Tool */}
        <button onClick={handleFullscreen} className="" title="Fullscreen">
          <img
            src="/images/fullscreen-icon.svg"
            alt="Fullscreen"
            className="w-12 h-12 md:w-12 md:h-12 text-white"
          />
        </button>

        {/* Location Tool */}
        <button onClick={handleLocateMe} className="" title="Locate Me">
          <img
            src="/images/location-icon.svg"
            alt="Locate Me"
            className="w-12 h-12 md:w-12 md:h-12 text-white"
          />
        </button>

        {/* Zoom Controls */}
        <div className="w-12 md:w-10 h-22 md:h-20 bg-[#0a1f26] rounded-[14px] md:rounded-[10px] relative flex flex-col items-center justify-between shadow-lg border border-[#1d4450]">
          <button
            onClick={handleZoomIn}
            className="w-full h-1/2 flex items-center justify-center hover:bg-white/10 transition-colors rounded-t-[14px] md:rounded-t-[10px] z-10 text-white"
            title="Zoom In"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 4v16m-8-8h16"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {/* Divider line */}
          <div className="absolute top-1/2 left-2 right-2 h-px bg-[#1d4450] -translate-y-1/2"></div>
          <button
            onClick={handleZoomOut}
            className="w-full h-1/2 flex items-center justify-center hover:bg-white/10 transition-colors rounded-b-[14px] md:rounded-b-[10px] z-10 text-white"
            title="Zoom Out"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 12h16"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* 5. Left Floating Simple Weather Widget */}
      <div className="absolute bottom-[230px] md:bottom-[244px] right-2 md:right-4 z-40 transform origin-right scale-75 sm:scale-90 lg:scale-100 transition-all">
        <div className="relative  flex justify-center items-center gap-[7px]">
          <img
            src="/images/weather-icon.svg"
            alt="Weather"
            className="w-[4.5rem] h-[3.1rem]"
          />
          <div className="text-white absolute right-[20px] text-xs font-semibold font-['Roboto'] leading-none pt-px">
            5°
          </div>
        </div>
      </div>

      {/* 5. Bottom Elevation Profile Panel */}
      <div className="absolute bottom-[92px] md:bottom-4 left-0 md:left-4 right-0 md:right-4 h-[280px] md:h-56 z-50 bg-black md:bg-[#020617] rounded-t-[20px] md:rounded-2xl overflow-hidden shadow-2xl border-t border-cyan-950 md:border-gray-800 transition-all duration-300">
        <div className="h-full w-full relative">
          <ElevationProfile
            route={route}
            pois={route.pois}
            tourType={tourType}
            onPositionChange={handleElevationPositionChange}
            highlightDistance={highlightDistance}
            onPoiClick={handlePoiClick}
          />
        </div>
      </div>

      {/* POI Sidebar */}
      <POISidebar
        poi={selectedPoi}
        routeStartPoint={route.startPoint}
        routeGeometry={route.routeGeometry}
        onClose={() => setSelectedPoi(null)}
      />

      {/* Modals */}
      {showGpxModal && route && (
        <GpxDownloadModal
          routeId={route.id}
          selectedCity={selectedCity}
          onClose={() => setShowGpxModal(false)}
        />
      )}
    </div>
  );
}
