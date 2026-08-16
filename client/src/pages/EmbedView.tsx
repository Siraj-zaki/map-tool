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

// Debug logger utility
const DEBUG = true;
const log = {
  info: (msg: string, data?: any) => {
    if (DEBUG) {
      console.log(`%c[EmbedView] ${msg}`, 'color: #088d95; font-weight: bold;', data ?? '');
    }
  },
  warn: (msg: string, data?: any) => {
    if (DEBUG) {
      console.warn(`%c[EmbedView] ⚠️ ${msg}`, 'color: #f59e0b; font-weight: bold;', data ?? '');
    }
  },
  error: (msg: string, data?: any) => {
    if (DEBUG) {
      console.error(`%c[EmbedView] ❌ ${msg}`, 'color: #ef4444; font-weight: bold;', data ?? '');
    }
  },
  compare: (label: string, apiValue: any, displayValue: any) => {
    if (DEBUG) {
      console.log(`%c[EmbedView] COMPARE: ${label}`, 'color: #8b5cf6; font-weight: bold;');
      console.log('  API Value:', apiValue);
      console.log('  Display Value:', displayValue);
      console.log('  Match:', JSON.stringify(apiValue) === JSON.stringify(displayValue) ? '✅ YES' : '❌ NO');
    }
  }
};

export default function EmbedView() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const { token } = useParams();
  const routeId = searchParams.get('route');
  const lang = searchParams.get('lang');

  const [route, setRoute] = useState<Route | null>(null);
  const [shareMeta, setShareMeta] = useState<ShareLinkResolved['share'] | null>(
    null
  );
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
  const flyToPoiRef = useRef<((poi: POI) => void) | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [splitPoints, setSplitPoints] = useState<{
    gold: SplitPoint[];
    silver: SplitPoint[];
    bronze: SplitPoint[];
  } | null>(null);
  
  // Ref to track previous split points for comparison
  const prevSplitPointsRef = useRef(splitPoints);
  const apiResponseRef = useRef<any>(null);
  const fetchTimestampRef = useRef<number>(0);

  // Fetch split points when location changes
  useEffect(() => {
    if (route?.id) {
      const startLocation = selectedLocationId ? undefined : 'Route Start';
      const locId = selectedLocationId || undefined;
      
      // Generate unique fetch ID to handle race conditions
      const currentFetchId = Date.now();
      fetchTimestampRef.current = currentFetchId;
      
      log.info('🔄 FETCHING SPLIT POINTS', {
        routeId: route.id,
        selectedLocationId,
        startLocation,
        locationId: locId,
        fetchId: currentFetchId,
        timestamp: new Date().toISOString()
      });
      
      splitPointsApi.getByRoute(route.id, startLocation, locId).then(res => {
        // Ignore stale responses
        if (currentFetchId !== fetchTimestampRef.current) {
          log.warn('⚠️ Ignoring stale API response', { 
            fetchId: currentFetchId, 
            current: fetchTimestampRef.current 
          });
          return;
        }
        
        if (res.success) {
          apiResponseRef.current = res.splitPoints;
          
          log.info('✅ API RESPONSE RECEIVED - USING THESE VALUES DIRECTLY', {
            fetchId: currentFetchId,
            locationContext: locId ? `Location ${locId}` : startLocation,
            gold: res.splitPoints.gold?.length || 0,
            silver: res.splitPoints.silver?.length || 0,
            bronze: res.splitPoints.bronze?.length || 0,
            goldPoints: res.splitPoints.gold,
            silverPoints: res.splitPoints.silver,
            bronzePoints: res.splitPoints.bronze
          });
          
          // Detailed logging of each split point with coordinates
          (['gold', 'silver', 'bronze'] as const).forEach(tourType => {
            const points = res.splitPoints[tourType] || [];
            if (points.length > 0) {
              log.info(`📍 ${tourType.toUpperCase()} Split Points Details:`,
                points.map((sp, idx) => ({
                  stage: sp.stageNumber,
                  name: sp.locationName,
                  coords: { lng: sp.lng, lat: sp.lat },
                  distanceKm: sp.distanceKm
                }))
              );
            }
          });
          
          // Note: prevSplitPointsRef tracks previous values for debugging only
          prevSplitPointsRef.current = res.splitPoints;
          setSplitPoints(res.splitPoints);
        } else {
          log.error('API returned error', res);
        }
      }).catch(err => {
        log.error('Failed to fetch split points', err);
      });
    }
  }, [route?.id, selectedLocationId]);

  // Custom Map Controls state
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [, setIsFullscreen] = useState(false);

  // Set language from URL parameter
  useEffect(() => {
    if (lang && (lang === 'de' || lang === 'en')) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);

  // Expose debug helpers to window for console debugging
  useEffect(() => {
    (window as any).__EMBEDVIEW_DEBUG__ = {
      getCurrentState: () => ({
        routeId,
        route,
        tourType,
        selectedStage,
        selectedLocationId,
        splitPoints,
        apiResponse: apiResponseRef.current
      }),
      getSplitPoints: () => splitPoints,
      getApiResponse: () => apiResponseRef.current,
      compareSplitPoints: () => {
        if (!apiResponseRef.current || !splitPoints) {
          console.log('No data to compare');
          return;
        }
        console.log('%c=== SPLIT POINTS COMPARISON ===', 'color: #8b5cf6; font-size: 14px; font-weight: bold;');
        (['gold', 'silver', 'bronze'] as const).forEach(type => {
          const api = apiResponseRef.current[type] || [];
          const state = splitPoints[type] || [];
          console.log(`\n%c${type.toUpperCase()}:`, 'color: #088d95; font-weight: bold;');
          console.log('  API Response:', api.length, 'points');
          console.log('  Current State:', state.length, 'points');
          console.log('  Match:', api.length === state.length ? '✅' : '❌');
          if (api.length > 0) {
            console.log('  Points:');
            api.forEach((sp: SplitPoint, i: number) => {
              console.log(`    [${i + 1}] Stage ${sp.stageNumber}: "${sp.locationName}" @ [${sp.lng.toFixed(6)}, ${sp.lat.toFixed(6)}] - ${sp.distanceKm.toFixed(2)}km`);
            });
          }
        });
      },
      checkMapCoordinates: () => {
        if (!route?.routeGeometry) {
          console.log('No route geometry available');
          return;
        }
        console.log('%c=== ROUTE GEOMETRY ===', 'color: #10b981; font-size: 14px; font-weight: bold;');
        console.log('Total points:', route.routeGeometry.length);
        console.log('Start:', route.routeGeometry[0]);
        console.log('End:', route.routeGeometry[route.routeGeometry.length - 1]);
        
        if (splitPoints) {
          console.log('%c\n=== SPLIT POINTS ON MAP ===', 'color: #10b981; font-size: 14px; font-weight: bold;');
          (['gold', 'silver', 'bronze'] as const).forEach(type => {
            const points = splitPoints[type] || [];
            if (points.length > 0) {
              console.log(`\n%c${type.toUpperCase()} Split Points on Map:`, 'color: #088d95; font-weight: bold;');
              points.forEach((sp, i) => {
                // Find closest point on route geometry
                let minDist = Infinity;
                let closestIdx = -1;
                route.routeGeometry?.forEach((coord, idx) => {
                  const dist = Math.sqrt(
                    Math.pow(coord[0] - sp.lng, 2) + Math.pow(coord[1] - sp.lat, 2)
                  );
                  if (dist < minDist) {
                    minDist = dist;
                    closestIdx = idx;
                  }
                });
                
                const closestCoord = closestIdx >= 0 ? route.routeGeometry?.[closestIdx] : null;
                console.log(`  [${i + 1}] Stage ${sp.stageNumber}:`, {
                  splitPoint: [sp.lng.toFixed(6), sp.lat.toFixed(6)],
                  closestRoutePoint: closestCoord ? [closestCoord[0].toFixed(6), closestCoord[1].toFixed(6)] : 'N/A',
                  distanceFromRoute: (minDist * 111000).toFixed(2) + 'm', // Approximate meters
                  indexOnRoute: closestIdx
                });
              });
            }
          });
        }
      },
      refreshSplitPoints: () => {
        if (route?.id) {
          const startLocation = selectedLocationId ? undefined : 'Route Start';
          const locId = selectedLocationId || undefined;
          log.info('🔄 Manually refreshing split points');
          return splitPointsApi.getByRoute(route.id, startLocation, locId);
        }
      }
    };
    
    console.log('%c🔧 Debug helpers available! Try:', 'color: #088d95; font-size: 12px;');
    console.log('  window.__EMBEDVIEW_DEBUG__.getCurrentState()');
    console.log('  window.__EMBEDVIEW_DEBUG__.compareSplitPoints()');
    console.log('  window.__EMBEDVIEW_DEBUG__.checkMapCoordinates()');
    console.log('  window.__EMBEDVIEW_DEBUG__.refreshSplitPoints()  - Refetches split points');
  }, [route, splitPoints, selectedLocationId]);

  useEffect(() => {
    log.info('🚀 COMPONENT MOUNTED', { routeId, lang, url: window.location.href });
    
    if (!token && !routeId) {
      setError('NOT_FOUND');
      setLoading(false);
      return;
    }

    const loadRoute = async () => {
      try {
        if (token) {
          // Tokenized share — includes expiry/revoke enforcement + per-link
          // customization (logo, accent).
          log.info('📡 Resolving share token…', { token });
          const result = await shareLinksApi.resolve(token);
          if ('error' in result) {
            log.error('Share link not usable', result);
            setError(result.error || 'NOT_FOUND');
          } else {
            setRoute(result.route);
            setShareMeta(result.share);
          }
        } else {
          log.info('📡 Fetching route...', { routeId: Number(routeId) });
          const result = await routesApi.getById(Number(routeId));
          if (result.success) {
            setRoute(result.route);
          } else {
            log.error('Route not found', result);
            setError('NOT_FOUND');
          }
        }
      } catch (err) {
        log.error('Failed to load route', err);
        setError('LOAD_FAILED');
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
        log.error('Fullscreen error', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, []);

  // Handler for tour type changes with logging
  const handleTourTypeChange = useCallback((type: 'gold' | 'silver' | 'bronze') => {
    log.info('🏆 Tour type changed', {
      from: tourType,
      to: type,
      availableSplitPoints: splitPoints?.[type]?.length || 0
    });
    
    // Log the current split points for this tour type
    const points = splitPoints?.[type] || [];
    if (points.length > 0) {
      log.info(`📍 Current ${type.toUpperCase()} split points:`,
        points.map(sp => ({
          stage: sp.stageNumber,
          name: sp.locationName,
          coords: [sp.lng, sp.lat],
          distance: sp.distanceKm
        }))
      );
    } else {
      log.warn(`No split points found for ${type} tour type`);
    }
    
    setTourType(type);
  }, [tourType, splitPoints]);

  // Handler for stage selection with logging
  const handleStageSelect = useCallback((stage: number | null) => {
    log.info('🎯 Stage selected', {
      stage,
      tourType,
      totalStages: (splitPoints?.[tourType]?.length || 0) + 1,
      splitPointForStage: stage && stage > 1 ? splitPoints?.[tourType]?.[stage - 2] : null
    });
    setSelectedStage(stage);
  }, [tourType, splitPoints]);

  // Handler for location changes with logging
  const handleLocationChange = useCallback((locationId: number | null) => {
    log.info('🗺️ Location selection changed', {
      from: selectedLocationId,
      to: locationId,
      locationName: locationId ? 'Specific Location' : 'Route Start'
    });
    setSelectedLocationId(locationId);
  }, [selectedLocationId]);

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
      <div className="h-screen w-full flex items-center justify-center bg-[#0b1215] text-[#a0a0a0]">
        <i
          className="fas fa-mountain text-4xl mb-4 animate-bounce"
          style={{ color: 'var(--brand-primary, #088d95)' }}
        ></i>
        <div className="text-sm ml-3">{t('routeLoading')}</div>
      </div>
    );
  }

  if (error || !route) {
    const message =
      error === 'EXPIRED'
        ? t('shareExpiredMessage') || 'This share link has expired.'
        : error === 'REVOKED'
          ? t('shareRevokedMessage') || 'This share link has been revoked.'
          : error === 'NOT_FOUND' || (token && error)
            ? t('shareNotFoundMessage') || 'This share link no longer exists.'
            : t('routeNotFound');
    const icon =
      error === 'EXPIRED' ? 'fa-hourglass-end'
        : error === 'REVOKED' ? 'fa-ban'
          : 'fa-exclamation-triangle';
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0b1215] text-[#a0a0a0] px-6 text-center">
        <i className={`fas ${icon} text-4xl text-red-500 mb-4`}></i>
        <div className="text-white text-base font-medium">{message}</div>
      </div>
    );
  }

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
        {(() => {
          log.info('🗺️ RENDERING MapComponent with props:', {
            tourType,
            selectedStage,
            selectedLocationId,
            splitPointsAvailable: {
              gold: splitPoints?.gold?.length || 0,
              silver: splitPoints?.silver?.length || 0,
              bronze: splitPoints?.bronze?.length || 0
            }
          });
          return null;
        })()}
        <MapComponent
          route={route}
          tourType={tourType}
          selectedStage={selectedStage}
          onPositionChange={handleMapPositionChange}
          onPoiClick={setSelectedPoi}
          highlightPosition={highlightPosition}
          flyToLocation={flyToLocation}
          selectedLocationId={selectedLocationId}
          splitPoints={splitPoints}
          onMapLoad={m => {
            mapRef.current = m;
            log.info('✅ Map loaded successfully');
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

      {/* 3. Left Floating Panel (Tour Stages) */}
      <div className="static md:absolute md:top-18 md:left-5 z-60 flex flex-col gap-4 md:transform md:origin-top-left md:scale-90 lg:scale-100 transition-all">
        {(() => {
          log.info('📋 RENDERING TourStagePanel with externalSplitPoints:', {
            gold: splitPoints?.gold?.length || 0,
            silver: splitPoints?.silver?.length || 0,
            bronze: splitPoints?.bronze?.length || 0
          });
          return null;
        })()}
        <TourStagePanel
          route={route}
          tourType={tourType}
          onTourTypeChange={handleTourTypeChange}
          selectedStage={selectedStage}
          onStageSelect={handleStageSelect}
          selectedLocationId={selectedLocationId}
          onLocationChange={handleLocationChange}
          externalSplitPoints={splitPoints}
        />
        {/* <LocationFilter routeId={route.id} tourType={tourType} /> */}
      </div>

      {/* 5. Right Floating Simple Weather Widget */}
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

      {/* 4. Right Floating Widget (Custom Map Controls) */}
      <div className="absolute hidden md:flex top-[160px] md:top-[110px] right-2 md:right-4 z-40  flex-col items-center gap-2 md:gap-3 transform origin-right scale-75 sm:scale-90 lg:scale-100 transition-all pointer-events-auto">
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
      {/* Mobile Desktop */}
      <div className="absolute md:hidden flex  bottom-[360px] md:top-[284px] right-2 md:right-4 z-40  flex-col items-center gap-2 md:gap-3 transform origin-right scale-75 sm:scale-90 lg:scale-100 transition-all pointer-events-auto">
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

      {/* 5. Bottom Elevation Profile Panel */}
      <div className="absolute bottom-[92px] md:bottom-4 left-0 md:left-4 right-0 md:right-4 h-[280px] md:h-56 z-50 bg-black md:bg-[#020617] rounded-t-[20px] md:rounded-2xl overflow-hidden shadow-2xl border-t border-cyan-950 md:border-gray-800 transition-all duration-300">
        <div className="h-full w-full relative">
          {(() => {
            const currentSplitPoints = splitPoints?.[tourType] || [];
            log.info('📈 RENDERING ElevationProfile with splitPoints:', {
              tourType,
              count: currentSplitPoints.length,
              points: currentSplitPoints.map(sp => ({
                stage: sp.stageNumber,
                distanceKm: sp.distanceKm,
                coords: [sp.lng, sp.lat]
              }))
            });
            return null;
          })()}
          <ElevationProfile
            route={route}
            pois={route.pois}
            tourType={tourType}
            onPositionChange={handleElevationPositionChange}
            highlightDistance={highlightDistance}
            onPoiClick={handlePoiClick}
            splitPoints={splitPoints?.[tourType]}
          />
          {/* Custom overlays for bottom panel could go here if needed */}
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
