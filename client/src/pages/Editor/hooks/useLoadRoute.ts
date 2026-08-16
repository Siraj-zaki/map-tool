import { useEffect } from 'react';
import { locationsApi, routesApi, splitPointsApi, type RouteLocation } from '../../../api';
import type {
  EditMode,
  ElevationSample,
  LngLat,
  RouteStats,
  SplitPointsState,
  Waypoint,
} from '../types';

interface UseLoadRouteArgs {
  id: string | undefined;
  mapLoaded: boolean;
  setLoading: (v: boolean) => void;
  setName: (v: string) => void;
  setDescription: (v: string) => void;
  setStartPoint: (v: LngLat) => void;
  setEndPoint: (v: LngLat) => void;
  setWaypoints: (v: Waypoint[]) => void;
  setRouteGeometry: (v: LngLat[] | null) => void;
  setElevationData: (v: ElevationSample[] | null) => void;
  setIsGpxRoute: (v: boolean) => void;
  setPois: (v: any[]) => void;
  setRouteStats: (v: RouteStats) => void;
  setEditMode: (v: EditMode) => void;
  setLocations: (v: RouteLocation[]) => void;
  setSplitPoints: (v: SplitPointsState) => void;
}

export function useLoadRoute(args: UseLoadRouteArgs) {
  const {
    id,
    mapLoaded,
    setLoading,
    setName,
    setDescription,
    setStartPoint,
    setEndPoint,
    setWaypoints,
    setRouteGeometry,
    setElevationData,
    setIsGpxRoute,
    setPois,
    setRouteStats,
    setEditMode,
    setLocations,
    setSplitPoints,
  } = args;

  // Load existing route
  useEffect(() => {
    console.log(
      '[Editor] Load route effect - id:',
      id,
      'mapLoaded:',
      mapLoaded
    );
    if (!id || !mapLoaded) return;

    const loadRoute = async () => {
      console.log('[Editor] Loading route data for id:', id);
      setLoading(true);
      try {
        const result = await routesApi.getById(Number(id));
        console.log('[Editor] Route API result:', result);
        if (result.success) {
          console.log('[Editor] Setting route data:', {
            startPoint: result.route.startPoint,
            endPoint: result.route.endPoint,
            waypoints: result.route.waypoints?.length,
            pois: result.route.pois?.length,
          });
          setName(result.route.name);
          setDescription(result.route.description || '');
          setStartPoint(result.route.startPoint);
          setEndPoint(result.route.endPoint);
          // Handle both legacy format (array of coords) and new format (array of objects)
          const loadedWaypoints = result.route.waypoints || [];
          const normalizedWaypoints = loadedWaypoints.length > 0 && Array.isArray(loadedWaypoints[0])
            ? (loadedWaypoints as unknown as LngLat[]).map(wp => ({ lngLat: wp, mode: 'auto' as const }))
            : (loadedWaypoints as Waypoint[]);
          setWaypoints(normalizedWaypoints);
          setRouteGeometry(result.route.routeGeometry || null);
          setElevationData(result.route.elevationData || null); // Restore stored elevation data
          // Set isGpxRoute=true when route has stored geometry & elevation, to preserve
          // the route path and elevation stats from being overwritten by Mapbox API
          setIsGpxRoute(
            !!(result.route.routeGeometry?.length && result.route.elevationData?.length)
          );
          setPois(result.route.pois || []);
          setRouteStats({
            distance: parseFloat(String(result.route.distance || 0)),
            duration: Math.round(
              parseFloat(String(result.route.duration || 0)) / 60
            ),
            highestPoint: parseInt(String(result.route.highestPoint || 0)),
            lowestPoint: parseInt(String(result.route.lowestPoint || 0)),
            totalAscent: parseInt(String(result.route.totalAscent || 0)),
            totalDescent: parseInt(String(result.route.totalDescent || 0)),
          });
          setEditMode('waypoint');

          // Fetch locations for this route
          try {
            const locResult = await locationsApi.getByRoute(Number(id));
            if (locResult.success) {
              setLocations(locResult.data);
            }
          } catch (locError) {
            console.error('Failed to load locations:', locError);
          }

          // Fetch split points (default/generic)
          try {
            const spResult = await splitPointsApi.getByRoute(
              Number(id),
              'Route Start',
              undefined
            );
            if (spResult.success) {
              setSplitPoints(spResult.splitPoints);
            }
          } catch (spError) {
            console.error('Failed to load split points:', spError);
          }
        }
      } catch (error) {
        console.error('[Editor] Failed to load route:', error);
      } finally {
        setLoading(false);
      }
    };
    loadRoute();
  }, [id, mapLoaded]);
}
