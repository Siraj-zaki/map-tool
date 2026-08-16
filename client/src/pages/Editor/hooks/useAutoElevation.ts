import mapboxgl from 'mapbox-gl';
import { useEffect, type MutableRefObject } from 'react';
import { getMapboxElevation } from '../../../utils/elevationMapbox';
import type { ElevationSample, LngLat, RouteStats } from '../types';

interface UseAutoElevationArgs {
  map: MutableRefObject<mapboxgl.Map | null>;
  mapLoaded: boolean;
  routeGeometry: LngLat[] | null;
  isGpxRoute: boolean;
  elevationData: ElevationSample[] | null;
  calculatingElevation: boolean;
  setCalculatingElevation: (v: boolean) => void;
  setElevationData: (v: ElevationSample[]) => void;
  setRouteStats: React.Dispatch<React.SetStateAction<RouteStats>>;
}

export function useAutoElevation(args: UseAutoElevationArgs) {
  const {
    map,
    mapLoaded,
    routeGeometry,
    isGpxRoute,
    elevationData,
    calculatingElevation,
    setCalculatingElevation,
    setElevationData,
    setRouteStats,
  } = args;

  // Auto-calculate elevation when route geometry changes (for non-GPX routes)
  useEffect(() => {
    // Skip if no route or in GPX mode (GPX has its own elevation data)
    if (!routeGeometry || routeGeometry.length === 0 || isGpxRoute) return;
    // Skip if we already have elevation data
    if (elevationData && elevationData.length > 0) return;
    // Skip if already calculating
    if (calculatingElevation) return;
    // Skip if map not ready
    if (!map.current || !mapLoaded) return;

    console.log('[Editor] Auto-calculating elevation for non-GPX route...');

    // Use a timer to debounce rapid changes
    const timer = setTimeout(async () => {
      setCalculatingElevation(true);
      try {
        // preserveCamera=true: never fit the map to the route bounds while
        // the user is editing. Adding a waypoint used to snap the camera
        // out to fit the whole route, wait for terrain to load, then snap
        // back — which read as a jarring "zoom out / zoom back in" pulse
        // even though both movements were instant. Now we query using
        // whatever DEM tiles are already loaded and, if too many points
        // are missing tiles, we simply skip the auto-update. The explicit
        // "Calculate elevation" button and the save flow do a full-camera
        // calculation, so users still get accurate values on demand.
        const elevResult = await getMapboxElevation(
          map.current!,
          routeGeometry,
          { preserveCamera: true }
        );
        console.log('[Editor] Auto-elevation result:', elevResult);

        setElevationData(elevResult.elevationData);

        setRouteStats(prev => ({
          ...prev,
          distance: elevResult.totalDistanceKm || prev.distance,
          highestPoint: elevResult.highestPoint,
          lowestPoint: elevResult.lowestPoint,
          totalAscent: elevResult.totalAscent,
          totalDescent: elevResult.totalDescent,
        }));
      } catch (error) {
        // TILES_NOT_LOADED is expected when the user is zoomed in on a
        // portion of the route; the elevation button remains available.
        if ((error as Error)?.message === 'TILES_NOT_LOADED') {
          console.log(
            '[Editor] Auto-elevation skipped — click the elevation button for full-route data'
          );
        } else {
          console.error('[Editor] Auto-elevation calculation failed:', error);
        }
      } finally {
        setCalculatingElevation(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [routeGeometry, isGpxRoute, mapLoaded, elevationData, calculatingElevation]);
}
