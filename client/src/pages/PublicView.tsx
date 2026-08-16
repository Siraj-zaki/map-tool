import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  routesApi,
  shareLinksApi,
  splitPointsApi,
  type POI,
  type Route,
  type ShareLinkResolved,
  type SplitPoint,
} from '../api';
import ElevationProfile from '../components/ElevationProfile/ElevationProfileVisx';
import MapComponent from '../components/Map/MapComponent';
import {
  FullscreenToolIcon,
  LocationToolIcon,
} from '../components/Map/MapControlIcons';
import POISidebar from '../components/POI/POISidebar';
import PremiumModal from '../components/Premium/PremiumModal';
import RouteStatsBar from '../components/RouteStatsBar/RouteStatsBar';
import TourStagePanel from '../components/TourStagePanel/TourStagePanel';

export default function PublicView() {
  const { id, token } = useParams();
  const [searchParams] = useSearchParams();
  const routeId = id || searchParams.get('route');
  const { t } = useTranslation();

  const [route, setRoute] = useState<Route | null>(null);
  const [shareMeta, setShareMeta] = useState<ShareLinkResolved['share'] | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  // `error` covers both "not found" (404) and "gone" (410 expired/revoked).
  // We keep the raw error string so the render layer can pick the right
  // friendly message.
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
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [splitPoints, setSplitPoints] = useState<{
    gold: SplitPoint[];
    silver: SplitPoint[];
    bronze: SplitPoint[];
  } | null>(null);
  const flyToPoiRef = useRef<((poi: POI) => void) | null>(null);

  // Fetch split points when location changes
  useEffect(() => {
    if (route?.id) {
      const startLocation = selectedLocationId ? undefined : 'Route Start';
      const locId = selectedLocationId || undefined;
      console.log('[PublicView] Fetching split points:', { routeId: route.id, startLocation, locId });
      splitPointsApi.getByRoute(route.id, startLocation, locId).then(res => {
        if (res.success) {
          console.log('[PublicView] Received split points:', res.splitPoints);
          setSplitPoints(res.splitPoints);
        }
      }).catch(console.error);
    }
  }, [route?.id, selectedLocationId]);

  // Custom Map Controls state
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!token && !routeId) {
      setLoading(false);
      return;
    }

    const loadRoute = async () => {
      try {
        if (token) {
          // Tokenized share link — server enforces expiry/revoke and returns
          // 410 with error='EXPIRED'|'REVOKED' when applicable. Surface the
          // exact error string so the render layer picks the right message.
          const result = await shareLinksApi.resolve(token);
          if ('error' in result) {
            setError(result.error || 'NOT_FOUND');
          } else {
            setRoute(result.route);
            setShareMeta(result.share);
          }
        } else {
          const result = await routesApi.getById(Number(routeId));
          if (result.success) {
            setRoute(result.route);
          } else {
            setError('NOT_FOUND');
          }
        }
      } catch (err) {
        setError('LOAD_FAILED');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadRoute();
  }, [routeId, token]);

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
        <i
          className="fas fa-mountain fa-spin text-4xl mb-4"
          style={{ color: 'var(--brand-primary, #088d95)' }}
        ></i>
        <span>{t('routeLoading')}</span>
      </div>
    );
  }

  if (error || !route) {
    // Friendly error page — distinguishes expired/revoked share links from
    // generic 404s so users get an actionable message.
    const errorMessage =
      error === 'EXPIRED'
        ? t('shareExpiredMessage') || 'This share link has expired.'
        : error === 'REVOKED'
          ? t('shareRevokedMessage') || 'This share link has been revoked.'
          : error === 'NOT_FOUND' || (token && error)
            ? t('shareNotFoundMessage') || 'This share link no longer exists.'
            : error || t('noRouteSpecified');
    const icon =
      error === 'EXPIRED' ? 'fa-hourglass-end'
        : error === 'REVOKED' ? 'fa-ban'
          : 'fa-exclamation-triangle';

    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#0b1215] text-gray-400 px-6 text-center">
        <i className={`fas ${icon} text-4xl text-red-500 mb-4`}></i>
        <span className="text-white text-lg font-medium mb-2">
          {errorMessage}
        </span>
        <a
          href="/"
          className="mt-4 px-4 py-2 border border-[#1e2a33] rounded-lg text-sm text-gray-400 hover:text-white hover:border-[#088d95] transition-all"
        >
          <i className="fas fa-home mr-2"></i>
          {t('backToHome') || 'Back to home'}
        </a>
      </div>
    );
  }

  // Per-share-link brand overrides. Setting these on the outer root makes
  // every downstream `.brand-primary-*` / `.brand-accent-*` consumer pick
  // up the custom color for THIS view only — the admin's global brand
  // (set via ColorSettingsContext on documentElement) still applies to
  // routes viewed by admin id.
  const rootStyle: React.CSSProperties = {};
  if (shareMeta?.customPrimaryColor) {
    (rootStyle as any)['--brand-primary'] = shareMeta.customPrimaryColor;
  }
  if (shareMeta?.customAccentColor) {
    (rootStyle as any)['--brand-accent'] = shareMeta.customAccentColor;
  }

  return (
    <div
      className="relative w-full h-screen overflow-hidden bg-black font-sans"
      style={rootStyle}
    >
      {/* 1. Background Map */}
      <div className="absolute inset-0 md:inset-0 bottom-[360px] md:bottom-0 z-0">
        <MapComponent
          route={route}
          tourType={tourType}
          selectedStage={selectedStage}
          onPositionChange={handleMapPositionChange}
          onPoiClick={setSelectedPoi}
          highlightPosition={highlightPosition}
          flyToLocation={flyToLocation}
          selectedLocationId={selectedLocationId}
          onMapLoad={m => {
            mapRef.current = m;
          }}
        />
      </div>

      {/* 2. Top Navigation Bar */}
      <div className="absolute top-0 left-0 right-0 z-50 shadow-lg">
        <RouteStatsBar
          route={route}
          logoUrl={shareMeta?.customLogoUrl || undefined}
          primaryColor={shareMeta?.customPrimaryColor || undefined}
          accentColor={shareMeta?.customAccentColor || undefined}
          showDownloadButton={true}
          onDownloadClick={() => setShowGpxModal(true)}
          onLocationSelect={coords =>
            setFlyToLocation({ lng: coords.lng, lat: coords.lat })
          }
        />
      </div>

      {/* 3. Left Floating Panel */}
      <div className="static md:absolute md:top-18 md:left-5 z-60 flex flex-col gap-4 md:transform md:origin-top-left md:scale-90 lg:scale-100 transition-all">
        <TourStagePanel
          route={route}
          tourType={tourType}
          onTourTypeChange={setTourType}
          selectedStage={selectedStage}
          onStageSelect={setSelectedStage}
          selectedLocationId={selectedLocationId}
          onLocationChange={setSelectedLocationId}
          externalSplitPoints={splitPoints}
        />
        {/* <LocationFilter routeId={route.id} tourType={tourType} /> */}
      </div>

      {/* 4. Right Floating Widget (Custom Map Controls) */}
      <div className="absolute top-[160px] md:top-[284px] right-2 md:right-4 z-40 flex flex-col items-center gap-2 md:gap-3 transform origin-right scale-75 sm:scale-90 lg:scale-100 transition-all pointer-events-auto">
        {/* Fullscreen Tool — inline SVG so background chrome recolors with
            brand while the white glyph stays readable. */}
        <button onClick={handleFullscreen} title="Fullscreen" aria-label="Fullscreen">
          <FullscreenToolIcon className="w-12 h-12" />
        </button>

        {/* Location Tool */}
        <button onClick={handleLocateMe} title="Locate Me" aria-label="Locate Me">
          <LocationToolIcon className="w-12 h-12" />
        </button>

        {/* Zoom Controls */}
        <div className="w-12 md:w-10 h-22 md:h-20 brand-panel-bg-strong rounded-[14px] md:rounded-[10px] relative flex flex-col items-center justify-between shadow-lg border brand-panel-border">
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
          <div className="absolute top-1/2 left-2 right-2 h-px brand-panel-divider -translate-y-1/2"></div>
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
            splitPoints={splitPoints?.[tourType]}
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
      <PremiumModal
        isOpen={showGpxModal}
        onClose={() => setShowGpxModal(false)}
      />
    </div>
  );
}
