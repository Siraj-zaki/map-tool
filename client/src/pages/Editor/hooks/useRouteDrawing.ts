import mapboxgl from 'mapbox-gl';
import { useEffect, type MutableRefObject } from 'react';
import { getDirections, type RouteSettings } from '../../../api';
import type {
  AlternativeRoute,
  LngLat,
  RouteStats,
  RoutingProfile,
  Waypoint,
} from '../types';
import { haversineDistance, interpolateLine } from '../utils';

interface UseRouteDrawingArgs {
  map: MutableRefObject<mapboxgl.Map | null>;
  mapLoaded: boolean;
  startPoint: LngLat | null;
  endPoint: LngLat | null;
  waypoints: Waypoint[];
  routeGeometry: LngLat[] | null;
  isGpxRoute: boolean;
  routeSettings: RouteSettings;
  routingProfile: RoutingProfile;
  setRouteGeometry: (v: LngLat[]) => void;
  setElevationData: (v: null) => void;
  setRouteStats: React.Dispatch<React.SetStateAction<RouteStats>>;
  setAlternativeRoutes: (v: AlternativeRoute[]) => void;
  /**
   * Optional. Set to true while the Directions API is being called so the
   * editor can display a non-blocking "calculating route…" indicator.
   * Manual (direct-line) segments skip this because they're synchronous.
   */
  setRoutingLoading?: (v: boolean) => void;
}

export function useRouteDrawing(args: UseRouteDrawingArgs) {
  const {
    map,
    mapLoaded,
    startPoint,
    endPoint,
    waypoints,
    routeGeometry,
    isGpxRoute,
    routeSettings,
    routingProfile,
    setRouteGeometry,
    setElevationData,
    setRouteStats,
    setAlternativeRoutes,
    setRoutingLoading,
  } = args;

  // Calculate route - draws progressively as waypoints are added
  // Also handles pre-existing routeGeometry from GPX uploads
  useEffect(() => {
    // Draw route if we have at least start + 1 waypoint OR start + end
    const hasMinimumPoints = startPoint && (waypoints.length > 0 || endPoint);
    if (!map.current || !mapLoaded || !hasMinimumPoints) return;

    const drawRoute = async () => {
      // Only surface the loading indicator when at least one segment will
      // actually hit the Directions API — cheap-to-compute paths (existing
      // geometry, all-manual routes) skip the spinner entirely.
      const willCallApi =
        !(routeGeometry && routeGeometry.length > 0) &&
        (waypoints.some(w => w.mode === 'auto') ||
          (endPoint != null && waypoints.every(w => w.mode === 'auto')));
      if (willCallApi) setRoutingLoading?.(true);
      try {
        // Wait for style to be fully loaded
        if (!map.current!.isStyleLoaded()) {
          map.current!.once('style.load', () => {
            drawRoute();
          });
          return;
        }

        // If we already have stored route geometry (from GPX upload or saved route),
        // use it directly instead of calling the Directions API which would
        // generate a different (wrong) path.
        if (routeGeometry && routeGeometry.length > 0) {
          console.log(
            '[Editor] Using existing stored geometry:',
            routeGeometry.length,
            'coordinates'
          );

          // Clean up existing layers/sources
          if (map.current!.getLayer('route')) map.current!.removeLayer('route');
          if (map.current!.getSource('route'))
            map.current!.removeSource('route');

          map.current!.addSource('route', {
            type: 'geojson',
            lineMetrics: true,
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: routeGeometry,
              },
            },
          });
          map.current!.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': routeSettings.mainColor,
              'line-width': routeSettings.lineWidth,
            },
          });
          return;
        }

        // Calculate route segment by segment based on waypoint modes
        // Build ordered list of all nodes: Start -> Waypoints -> End
        const nodes: Waypoint[] = [
          { lngLat: startPoint, mode: 'auto' }, // Start is always auto
          ...waypoints,
        ];
        if (endPoint) {
          // End point uses mode from last waypoint if exists, otherwise auto
          const endMode = waypoints.length > 0 ? waypoints[waypoints.length - 1].mode : 'auto';
          nodes.push({ lngLat: endPoint, mode: endMode });
        }

        let fullGeometry: LngLat[] = [];
        let totalDistance = 0;
        let altRoutes: AlternativeRoute[] = [];

        console.log(`[Editor] Calculating route with ${nodes.length} nodes`);

        // Process each segment based on the mode of the destination node
        for (let i = 1; i < nodes.length; i++) {
          const prevNode = nodes[i - 1];
          const currNode = nodes[i];

          console.log(`[Editor] Segment ${i}: ${prevNode.mode} -> ${currNode.mode} (${currNode.mode === 'manual' ? 'DIRECT LINE' : 'API'})`);

          if (currNode.mode === 'auto') {
            // Auto mode: Call Directions API for this segment
            try {
              const result = await getDirections(
                prevNode.lngLat,
                [],
                currNode.lngLat,
                routingProfile
              );

              if (result.routes?.[0]) {
                const segmentGeometry = result.routes[0].geometry.coordinates as LngLat[];
                totalDistance += result.routes[0].distance;

                // Append geometry (slice first point to avoid duplicates)
                if (fullGeometry.length === 0) {
                  fullGeometry = [...segmentGeometry];
                } else {
                  fullGeometry = [...fullGeometry, ...segmentGeometry.slice(1)];
                }

                // Collect alternative routes from first segment only
                if (i === 1) {
                  for (let ri = 1; ri < result.routes.length; ri++) {
                    altRoutes.push({
                      geometry: result.routes[ri].geometry.coordinates as LngLat[],
                      distance: result.routes[ri].distance,
                    });
                  }
                }
              }
            } catch (error) {
              console.error(`[Editor] Failed to get directions for segment ${i}:`, error);
            }
          } else {
            // Manual mode: Interpolate a straight line
            const interpolatedPoints = interpolateLine(prevNode.lngLat, currNode.lngLat, 20);

            // Calculate Haversine distance for this segment (in meters)
            const segmentDistanceMeters = haversineDistance(prevNode.lngLat, currNode.lngLat);
            totalDistance += segmentDistanceMeters;

            // Append interpolated points (slice first point to avoid duplicates)
            if (fullGeometry.length === 0) {
              fullGeometry = [...interpolatedPoints];
            } else {
              fullGeometry = [...fullGeometry, ...interpolatedPoints.slice(1)];
            }

            console.log(`[Editor] Manual segment: ${interpolatedPoints.length} points, ${(segmentDistanceMeters / 1000).toFixed(2)} km`);
          }
        }

        console.log(`[Editor] Combined geometry has ${fullGeometry.length} coordinates, total distance: ${(totalDistance / 1000).toFixed(2)} km`);

        if (fullGeometry.length > 0) {
          // Save the complete route geometry for storage
          setRouteGeometry(fullGeometry);
          console.log(
            '[Editor] Route geometry saved:',
            fullGeometry.length,
            'coordinates'
          );

          // Update distance and duration (elevation will be auto-recalculated)
          // Duration always based on fixed 10.86 km/h average speed
          const distanceKm = Number((totalDistance / 1000).toFixed(2));
          const durationMinutes = Math.round((distanceKm / 10.86) * 60);
          setRouteStats(prev => ({
            ...prev,
            distance: distanceKm,
            duration: durationMinutes,
          }));

          // Clear elevation data since route changed — auto-calculate effect will re-populate
          setElevationData(null);

          // Clean up existing layers/sources (main route + alternatives)
          if (map.current!.getLayer('route')) map.current!.removeLayer('route');
          if (map.current!.getSource('route'))
            map.current!.removeSource('route');
          // Clean up alternative route layers
          for (let ai = 0; ai < 5; ai++) {
            const altId = `route-alt-${ai}`;
            if (map.current!.getLayer(altId)) map.current!.removeLayer(altId);
            if (map.current!.getSource(altId)) map.current!.removeSource(altId);
          }

          map.current!.addSource('route', {
            type: 'geojson',
            lineMetrics: true,
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: fullGeometry,
              },
            },
          });
          map.current!.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': routeSettings.mainColor,
              'line-width': routeSettings.lineWidth,
            },
          });

          // Draw alternative routes as dashed lines
          if (altRoutes.length > 0) {
            setAlternativeRoutes(altRoutes);
            altRoutes.forEach((alt, idx) => {
              const altId = `route-alt-${idx}`;
              map.current!.addSource(altId, {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: { index: idx },
                  geometry: {
                    type: 'LineString',
                    coordinates: alt.geometry,
                  },
                },
              });
              map.current!.addLayer({
                id: altId,
                type: 'line',
                source: altId,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                  'line-color': '#888888',
                  'line-width': routeSettings.lineWidth - 1,
                  'line-dasharray': [3, 2],
                  'line-opacity': 0.7,
                },
              });

              // Click handler to select this alternative
              map.current!.on('click', altId, () => {
                console.log(`[Editor] User selected alternative route ${idx}`);
                // Set the alternative as the main route
                setRouteGeometry(alt.geometry);
                const altDistKm = Number((alt.distance / 1000).toFixed(2));
                const altDurMin = Math.round((altDistKm / 10.86) * 60);
                setRouteStats(prev => ({
                  ...prev,
                  distance: altDistKm,
                  duration: altDurMin,
                }));
                setElevationData(null);
                setAlternativeRoutes([]);

                // Redraw: swap the main route to the selected alternative
                if (map.current!.getSource('route')) {
                  (map.current!.getSource('route') as any).setData({
                    type: 'Feature',
                    properties: {},
                    geometry: {
                      type: 'LineString',
                      coordinates: alt.geometry,
                    },
                  });
                }
                // Remove all alternative layers
                for (let ri = 0; ri < 5; ri++) {
                  const rAltId = `route-alt-${ri}`;
                  if (map.current!.getLayer(rAltId)) map.current!.removeLayer(rAltId);
                  if (map.current!.getSource(rAltId)) map.current!.removeSource(rAltId);
                }
              });

              // Show pointer cursor on hover
              map.current!.on('mouseenter', altId, () => {
                if (map.current) map.current.getCanvas().style.cursor = 'pointer';
              });
              map.current!.on('mouseleave', altId, () => {
                if (map.current) map.current.getCanvas().style.cursor = '';
              });
            });
          } else {
            setAlternativeRoutes([]);
          }
        }
      } catch (error) {
        console.error('Failed to calculate route:', error);
      } finally {
        if (willCallApi) setRoutingLoading?.(false);
      }
    };

    const timer = setTimeout(drawRoute, 100);
    return () => clearTimeout(timer);
  }, [
    startPoint,
    waypoints,
    endPoint,
    isGpxRoute,
    mapLoaded,
    routeSettings,
    routingProfile,
  ]);
}
