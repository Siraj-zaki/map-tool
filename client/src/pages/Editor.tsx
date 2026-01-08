import mapboxgl from 'mapbox-gl';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { authApi, getDirections, routesApi, type Route } from '../api';
import ElevationProfile from '../components/ElevationProfile/ElevationProfileVisx';
import POIModal, { type POIData } from '../components/POI/POIModal';
import SplitPointEditor from '../components/SplitPointEditor/SplitPointEditor';
import { useColorSettings } from '../contexts/ColorSettingsContext';
import { getMapboxElevation } from '../utils/elevationMapbox';
import {
  getGPXRouteName,
  parseGPX,
  processGPXToRoute,
  processGPXWithAccurateStats,
} from '../utils/gpxParser';

mapboxgl.accessToken =
  'pk.eyJ1IjoicHVuY2hpbmdtYW4iLCJhIjoiY2p1cjcyMmh2M3NpZDQ5bnEwMDV6ZTE1OSJ9.ef8y6l9fsKFMX91m_Rt2ng';

// POI type icons (Font Awesome)
const poiIcons: Record<string, { icon: string; color: string }> = {
  hotel: { icon: 'fa-hotel', color: '#3b82f6' },
  restaurant: { icon: 'fa-utensils', color: '#f97316' },
  gipfel: { icon: 'fa-mountain', color: '#22c55e' },
  highlight: { icon: 'fa-star', color: '#eab308' },
};

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { routeSettings } = useColorSettings();
  const isEditing = Boolean(id);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const gpxInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  const [startPoint, setStartPoint] = useState<[number, number] | null>(null);
  const [endPoint, setEndPoint] = useState<[number, number] | null>(null);
  const [waypoints, setWaypoints] = useState<[number, number][]>([]);
  const [routeGeometry, setRouteGeometry] = useState<[number, number][] | null>(
    null
  );
  // Track if route came from GPX upload (to skip Directions API calls)
  const [isGpxRoute, setIsGpxRoute] = useState(false);
  // Store elevation data for persistence (avoids repeated API calls)
  const [elevationData, setElevationData] = useState<
    { elevation: number; distance: number }[] | null
  >(null);
  const [pois, setPois] = useState<any[]>([]);
  const [editMode, setEditMode] = useState<
    'start' | 'end' | 'waypoint' | 'poi' | 'splitpoint'
  >('start');

  // Split point selection state
  const [_splitPointTourType, setSplitPointTourType] = useState<
    'silver' | 'bronze'
  >('silver');
  const [_splitPointStageNumber, setSplitPointStageNumber] =
    useState<number>(1);
  const splitPointCallbackRef = useRef<
    ((lng: number, lat: number, distanceKm: number) => void) | null
  >(null);

  // POI Modal state
  const [poiModalOpen, setPoiModalOpen] = useState(false);
  const [poiModalLngLat, setPoiModalLngLat] = useState<[number, number]>([
    0, 0,
  ]);

  const [routeStats, setRouteStats] = useState({
    distance: 0,
    duration: 0,
    highestPoint: 0,
    lowestPoint: 0,
    totalAscent: 0,
    totalDescent: 0,
  });

  // Bi-directional sync between map and elevation profile
  // Note: highlightDistance is used for map→elevation sync (not yet implemented in Editor's ad-hoc map)
  // For now we only have elevation→map sync via highlightPosition
  const [highlightDistance] = useState<number | undefined>();
  const [highlightPosition, setHighlightPosition] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const highlightMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // Selected waypoint state for click selection and keyboard delete
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState<
    number | null
  >(null);
  const waypointListRef = useRef<HTMLDivElement>(null);

  // Elevation calculation state - only calculate when user clicks button or saves
  const [calculatingElevation, setCalculatingElevation] = useState(false);

  // Mode labels for info overlay
  const modeLabels: Record<string, string> = {
    start: t('clickToSetStart'),
    waypoint: t('clickToAddWaypoint'),
    end: t('clickToSetEnd'),
    poi: t('clickToAddPoi'),
    splitpoint:
      t('clickToSetSplitPoint') || 'Click on route to set stage boundary',
  };

  // Check auth
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await authApi.getProfile();
        if (!result.success) navigate('/admin/login');
      } catch {
        navigate('/admin/login');
      }
    };
    checkAuth();
  }, [navigate]);

  // Initialize map - using mounted ref to handle StrictMode
  const mountedRef = useRef(true);

  useEffect(() => {
    // Track mount state for StrictMode
    mountedRef.current = true;

    if (!mapContainer.current) {
      console.log('[Editor] No map container ref');
      return;
    }

    // If map already exists and is valid, just return
    if (map.current) {
      console.log('[Editor] Map already exists');
      return;
    }

    console.log('[Editor] Creating new map...');
    console.log(
      '[Editor] Container dimensions:',
      mapContainer.current.offsetWidth,
      'x',
      mapContainer.current.offsetHeight
    );

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/sirajmuneer/cmjh1h0wb000b01se721kbl7m',
        center: [10.7865, 51.8054],
        zoom: 11,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      map.current.on('load', () => {
        console.log('[Editor] Map loaded');

        // Only set state if still mounted
        if (mountedRef.current) {
          // 3. Enable terrain to make elevation data available
          map.current?.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
          setMapLoaded(true);
        }
      });

      map.current.on('error', e => {
        console.error('[Editor] Map error:', e);
      });
    } catch (error) {
      console.error('[Editor] Failed to create map:', error);
    }

    return () => {
      console.log('[Editor] Cleanup called');
      mountedRef.current = false;
      // Don't remove map in StrictMode, only on actual unmount
      // The map instance will be reused
    };
  }, []);

  // Handle map click
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      // Clear waypoint selection when clicking on map (not on a marker)
      setSelectedWaypointIndex(null);

      // Handle split point mode
      if (editMode === 'splitpoint') {
        if (splitPointCallbackRef.current && routeGeometry) {
          // Find closest point on route and calculate distance
          let minDist = Infinity;
          let closestCoord = coord;
          let distanceKm = 0;
          let accumulatedDistance = 0;

          for (let i = 0; i < routeGeometry.length; i++) {
            const rc = routeGeometry[i];
            const d = Math.sqrt(
              Math.pow(coord[0] - rc[0], 2) + Math.pow(coord[1] - rc[1], 2)
            );
            if (i > 0) {
              const prev = routeGeometry[i - 1];
              const R = 6371;
              const dLat = ((rc[1] - prev[1]) * Math.PI) / 180;
              const dLon = ((rc[0] - prev[0]) * Math.PI) / 180;
              const a =
                Math.sin(dLat / 2) ** 2 +
                Math.cos((prev[1] * Math.PI) / 180) *
                  Math.cos((rc[1] * Math.PI) / 180) *
                  Math.sin(dLon / 2) ** 2;
              accumulatedDistance +=
                R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            }
            if (d < minDist) {
              minDist = d;
              closestCoord = rc;
              distanceKm = accumulatedDistance;
            }
          }

          splitPointCallbackRef.current(
            closestCoord[0],
            closestCoord[1],
            distanceKm
          );
        }
        setEditMode('waypoint'); // Return to normal mode
        return;
      }

      if (editMode === 'start') {
        setStartPoint(coord);
        setEditMode('waypoint');
      } else if (editMode === 'end') {
        setEndPoint(coord);
        setEditMode('waypoint');
      } else if (editMode === 'poi') {
        // Open POI Modal
        setPoiModalLngLat(coord);
        setPoiModalOpen(true);
      } else {
        // Waypoint mode - smart insertion between existing waypoints
        if (!startPoint) {
          setStartPoint(coord);
        } else if (!endPoint && waypoints.length === 0) {
          // No waypoints yet and no end point - add as first waypoint
          setWaypoints([coord]);
        } else {
          // For GPX routes: check if click is ON the route or OFF the route
          if (isGpxRoute && routeGeometry && routeGeometry.length > 0) {
            // Find the closest point on the GPX route to the clicked location
            let minDist = Infinity;
            let closestPointOnRoute = coord;
            let closestIndex = 0;

            for (let i = 0; i < routeGeometry.length; i++) {
              const rc = routeGeometry[i];
              const d = Math.sqrt(
                Math.pow(coord[0] - rc[0], 2) + Math.pow(coord[1] - rc[1], 2)
              );
              if (d < minDist) {
                minDist = d;
                closestPointOnRoute = rc;
                closestIndex = i;
              }
            }

            // Distance threshold: ~0.001 degrees ≈ 100 meters
            // If click is within threshold, add waypoint ON the existing route
            // If click is farther, recalculate route through the new waypoint
            const DISTANCE_THRESHOLD = 0.001; // ~100 meters

            if (minDist <= DISTANCE_THRESHOLD) {
              // ON THE ROUTE: Add waypoint at closest point, preserve GPX data
              console.log(
                `[Editor] Click is ON route (${(minDist * 111000).toFixed(
                  0
                )}m from route), adding marker`
              );

              // Find the correct position in waypoints array based on route order
              const waypointIndices = waypoints.map(wp => {
                let bestIdx = 0;
                let bestDist = Infinity;
                for (let i = 0; i < routeGeometry.length; i++) {
                  const d = Math.sqrt(
                    Math.pow(wp[0] - routeGeometry[i][0], 2) +
                      Math.pow(wp[1] - routeGeometry[i][1], 2)
                  );
                  if (d < bestDist) {
                    bestDist = d;
                    bestIdx = i;
                  }
                }
                return bestIdx;
              });

              // Find insert position based on route order
              let insertIndex = 0;
              for (let i = 0; i < waypointIndices.length; i++) {
                if (closestIndex > waypointIndices[i]) {
                  insertIndex = i + 1;
                }
              }

              // Add waypoint at closest point on the route (preserving GPX geometry)
              setWaypoints(prev => {
                const newWaypoints = [...prev];
                newWaypoints.splice(insertIndex, 0, closestPointOnRoute);
                return newWaypoints;
              });

              console.log(
                `[Editor] GPX mode: Added waypoint at closest route point, waypoint #${
                  insertIndex + 1
                }`
              );
              // GPX geometry and elevation data are PRESERVED
            } else {
              // OFF THE ROUTE (new road): Recalculate entire route through this waypoint
              console.log(
                `[Editor] Click is OFF route (${(minDist * 111000).toFixed(
                  0
                )}m from route), recalculating via Directions API`
              );

              // Find insert position based on route order
              const waypointIndices = waypoints.map(wp => {
                let bestIdx = 0;
                let bestDist = Infinity;
                for (let i = 0; i < routeGeometry.length; i++) {
                  const d = Math.sqrt(
                    Math.pow(wp[0] - routeGeometry[i][0], 2) +
                      Math.pow(wp[1] - routeGeometry[i][1], 2)
                  );
                  if (d < bestDist) {
                    bestDist = d;
                    bestIdx = i;
                  }
                }
                return bestIdx;
              });

              let insertIndex = 0;
              for (let i = 0; i < waypointIndices.length; i++) {
                if (closestIndex > waypointIndices[i]) {
                  insertIndex = i + 1;
                }
              }

              // Clear GPX mode and trigger recalculation
              setIsGpxRoute(false);
              setRouteGeometry(null);
              setElevationData(null);
              setWaypoints(prev => {
                const newWaypoints = [...prev];
                newWaypoints.splice(insertIndex, 0, coord);
                return newWaypoints;
              });

              console.log(
                `[Editor] Route will be recalculated through new waypoint at position ${
                  insertIndex + 1
                }`
              );
            }
          } else {
            // Non-GPX route: use the original smart insertion logic
            // Build the full path: start -> waypoints -> end (if exists)
            const fullPath: [number, number][] = [startPoint];
            waypoints.forEach(wp => fullPath.push(wp));
            if (endPoint) fullPath.push(endPoint);

            // Function to calculate perpendicular distance from point to line segment
            const pointToSegmentDistance = (
              point: [number, number],
              segStart: [number, number],
              segEnd: [number, number]
            ): number => {
              const dx = segEnd[0] - segStart[0];
              const dy = segEnd[1] - segStart[1];
              const lengthSq = dx * dx + dy * dy;

              if (lengthSq === 0) {
                // Segment is a point
                return Math.sqrt(
                  Math.pow(point[0] - segStart[0], 2) +
                    Math.pow(point[1] - segStart[1], 2)
                );
              }

              // Project point onto the line segment
              let t =
                ((point[0] - segStart[0]) * dx +
                  (point[1] - segStart[1]) * dy) /
                lengthSq;
              t = Math.max(0, Math.min(1, t)); // Clamp to segment

              const projX = segStart[0] + t * dx;
              const projY = segStart[1] + t * dy;

              return Math.sqrt(
                Math.pow(point[0] - projX, 2) + Math.pow(point[1] - projY, 2)
              );
            };

            // Find the closest segment
            let minDist = Infinity;
            let insertIndex = waypoints.length; // Default to end

            for (let i = 0; i < fullPath.length - 1; i++) {
              const dist = pointToSegmentDistance(
                coord,
                fullPath[i],
                fullPath[i + 1]
              );
              if (dist < minDist) {
                minDist = dist;
                insertIndex = i;
              }
            }

            // Insert the waypoint at the correct position
            // Clear GPX mode since we're modifying a non-GPX route
            setIsGpxRoute(false);
            setRouteGeometry(null);
            setWaypoints(prev => {
              const newWaypoints = [...prev];
              newWaypoints.splice(insertIndex, 0, coord);
              return newWaypoints;
            });

            console.log(
              `[Editor] Inserted waypoint at index ${insertIndex} (will be waypoint #${
                insertIndex + 1
              })`
            );
          }
        }
      }
    };

    map.current.on('click', handleClick);
    return () => {
      map.current?.off('click', handleClick);
    };
  }, [mapLoaded, editMode, startPoint, endPoint, waypoints]);
  // Update markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Wait for style to be loaded before adding markers
    const addMarkers = () => {
      if (!map.current || !map.current.isStyleLoaded()) {
        map.current?.once('style.load', addMarkers);
        return;
      }

      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      // Start marker
      if (startPoint) {
        const el = document.createElement('div');
        el.innerHTML =
          '<i class="fa-solid fa-play" style="color: white; font-size: 12px;"></i>';
        el.className = isGpxRoute
          ? 'w-8 h-8 bg-green-500 rounded-full flex items-center justify-center border-2 border-white pl-0.5'
          : 'w-8 h-8 bg-green-500 rounded-full flex items-center justify-center border-2 border-white cursor-move pl-0.5';
        // Only allow dragging in non-GPX mode
        const marker = new mapboxgl.Marker({
          element: el,
          draggable: !isGpxRoute,
        })
          .setLngLat(startPoint)
          .addTo(map.current);
        if (!isGpxRoute) {
          marker.on('dragend', () => {
            setIsGpxRoute(false);
            setRouteGeometry(null);
            setStartPoint([marker.getLngLat().lng, marker.getLngLat().lat]);
          });
        }
        markersRef.current.push(marker);
      }

      // Waypoints
      waypoints.forEach((wp: [number, number], index: number) => {
        const el = document.createElement('div');
        el.textContent = String(index + 1);
        el.setAttribute('data-waypoint-index', String(index));

        // Apply different styling based on selection state
        const isSelected = selectedWaypointIndex === index;
        el.className = isSelected
          ? 'w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center border-3 border-white text-white text-xs font-bold cursor-pointer shadow-lg ring-2 ring-yellow-300'
          : 'w-7 h-7 bg-[#088d95] rounded-full flex items-center justify-center border-2 border-white text-white text-xs font-bold cursor-pointer';

        const marker = new mapboxgl.Marker({ element: el, draggable: true })
          .setLngLat(wp)
          .addTo(map.current!);

        // Click handler for selection
        el.addEventListener('click', e => {
          e.stopPropagation(); // Prevent map click from firing

          // Set selected waypoint
          setSelectedWaypointIndex(index);

          // Zoom to the waypoint
          if (map.current) {
            map.current.flyTo({
              center: wp,
              zoom: 15,
              essential: true,
            });
          }

          // Scroll to waypoint in sidebar
          if (waypointListRef.current) {
            const waypointElements = waypointListRef.current.querySelectorAll(
              '[data-waypoint-item]'
            );
            const targetElement = waypointElements[index] as HTMLElement;
            if (targetElement) {
              targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              });
            }
          }
        });

        marker.on('dragend', () => {
          const draggedLngLat = [
            marker.getLngLat().lng,
            marker.getLngLat().lat,
          ] as [number, number];

          // In GPX mode: check if dragged ON route or OFF route
          if (isGpxRoute && routeGeometry && routeGeometry.length > 0) {
            let minDist = Infinity;
            let closestPoint = draggedLngLat;

            for (const rc of routeGeometry) {
              const d = Math.sqrt(
                Math.pow(draggedLngLat[0] - rc[0], 2) +
                  Math.pow(draggedLngLat[1] - rc[1], 2)
              );
              if (d < minDist) {
                minDist = d;
                closestPoint = rc;
              }
            }

            // Distance threshold: ~0.001 degrees ≈ 100 meters
            const DISTANCE_THRESHOLD = 0.001;

            if (minDist <= DISTANCE_THRESHOLD) {
              // ON THE ROUTE: Snap to closest point, preserve GPX data
              console.log(
                `[Editor] Waypoint dragged ON route (${(
                  minDist * 111000
                ).toFixed(0)}m), snapping`
              );
              marker.setLngLat(closestPoint);
              setWaypoints(prev => {
                const newWp = [...prev];
                newWp[index] = closestPoint;
                return newWp;
              });
              // GPX geometry preserved!
            } else {
              // OFF THE ROUTE: Recalculate route through new location
              console.log(
                `[Editor] Waypoint dragged OFF route (${(
                  minDist * 111000
                ).toFixed(0)}m), recalculating via Directions API`
              );
              setIsGpxRoute(false);
              setRouteGeometry(null);
              setElevationData(null);
              setWaypoints(prev => {
                const newWp = [...prev];
                newWp[index] = draggedLngLat;
                return newWp;
              });
            }
          } else {
            // Non-GPX mode: recalculate route via Directions API
            setIsGpxRoute(false);
            setRouteGeometry(null);
            setWaypoints(prev => {
              const newWp = [...prev];
              newWp[index] = draggedLngLat;
              return newWp;
            });
          }
        });
        markersRef.current.push(marker);
      });

      // End marker
      if (endPoint) {
        const el = document.createElement('div');
        el.innerHTML =
          '<i class="fa-solid fa-flag-checkered" style="color: white; font-size: 12px;"></i>';
        el.className = isGpxRoute
          ? 'w-8 h-8 bg-red-500 rounded-full flex items-center justify-center border-2 border-white'
          : 'w-8 h-8 bg-red-500 rounded-full flex items-center justify-center border-2 border-white cursor-move';
        // Only allow dragging in non-GPX mode
        const marker = new mapboxgl.Marker({
          element: el,
          draggable: !isGpxRoute,
        })
          .setLngLat(endPoint)
          .addTo(map.current!);
        if (!isGpxRoute) {
          marker.on('dragend', () => {
            setIsGpxRoute(false);
            setRouteGeometry(null);
            setEndPoint([marker.getLngLat().lng, marker.getLngLat().lat]);
          });
        }
        markersRef.current.push(marker);
      }

      // POI markers with type-specific Font Awesome icons
      pois.forEach((poi: { type: string; lngLat: [number, number] }) => {
        const el = document.createElement('div');
        const iconInfo = poiIcons[poi.type] || poiIcons.highlight;
        el.innerHTML = `
          <div style="position: relative;">
            <div style="position: absolute; width: 40px; height: 15px; bottom: -8px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.3); border-radius: 50%; filter: blur(5px);"></div>
            <div style="width: 40px; height: 40px; background: ${iconInfo.color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); position: relative; z-index: 2;">
              <i class="fas ${iconInfo.icon}" style="color: white; font-size: 16px;"></i>
            </div>
          </div>
        `;
        el.style.cursor = 'pointer';
        const marker = new mapboxgl.Marker({ element: el, offset: [0, -24] })
          .setLngLat(poi.lngLat)
          .addTo(map.current!);
        markersRef.current.push(marker);
      });
    };

    // Call addMarkers with a small delay to ensure map is ready
    const timer = setTimeout(addMarkers, 50);
    return () => clearTimeout(timer);
  }, [startPoint, waypoints, endPoint, pois, mapLoaded, selectedWaypointIndex]);

  // Calculate route - draws progressively as waypoints are added
  // Also handles pre-existing routeGeometry from GPX uploads
  useEffect(() => {
    // Draw route if we have at least start + 1 waypoint OR start + end
    const hasMinimumPoints = startPoint && (waypoints.length > 0 || endPoint);
    if (!map.current || !mapLoaded || !hasMinimumPoints) return;

    const drawRoute = async () => {
      try {
        // Wait for style to be fully loaded
        if (!map.current!.isStyleLoaded()) {
          map.current!.once('style.load', () => {
            drawRoute();
          });
          return;
        }

        // If route came from GPX upload, use existing geometry directly (skip API)
        if (isGpxRoute && routeGeometry && routeGeometry.length > 0) {
          console.log(
            '[Editor] GPX route - using existing geometry:',
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

        // No existing geometry - calculate route via Mapbox Directions API
        // The API has a limit of 25 waypoints total (including start/end)
        // For routes with more waypoints, we batch the calls and concatenate results
        const MAX_WAYPOINTS_PER_BATCH = 23; // Leave room for start and end in each batch
        const effectiveEnd = endPoint || waypoints[waypoints.length - 1];
        const effectiveWaypoints = endPoint
          ? waypoints
          : waypoints.slice(0, -1);

        let fullGeometry: [number, number][] = [];
        let totalDistance = 0;
        let totalDuration = 0;

        if (effectiveWaypoints.length <= MAX_WAYPOINTS_PER_BATCH) {
          // Simple case: single API call
          const result = await getDirections(
            startPoint,
            effectiveWaypoints,
            effectiveEnd,
            'walking'
          );
          if (result.routes?.[0]) {
            fullGeometry = result.routes[0].geometry.coordinates as [
              number,
              number
            ][];
            totalDistance = result.routes[0].distance;
            totalDuration = result.routes[0].duration;
          }
        } else {
          // Complex case: batch API calls for many waypoints
          console.log(
            `[Editor] Batching ${effectiveWaypoints.length} waypoints into multiple API calls`
          );

          // Split waypoints into batches, ensuring overlap at batch boundaries
          const batches: {
            start: [number, number];
            waypoints: [number, number][];
            end: [number, number];
          }[] = [];
          let currentIndex = 0;

          while (currentIndex < effectiveWaypoints.length) {
            const batchStart =
              currentIndex === 0
                ? startPoint
                : effectiveWaypoints[currentIndex - 1];
            const remainingWaypoints = effectiveWaypoints.length - currentIndex;
            const batchSize = Math.min(
              MAX_WAYPOINTS_PER_BATCH,
              remainingWaypoints
            );
            const batchWaypoints = effectiveWaypoints.slice(
              currentIndex,
              currentIndex + batchSize
            );

            // Determine batch end
            const isLastBatch =
              currentIndex + batchSize >= effectiveWaypoints.length;
            const batchEnd = isLastBatch
              ? effectiveEnd
              : batchWaypoints[batchWaypoints.length - 1];

            // For intermediate batches, don't include the last waypoint as a waypoint (it's the end)
            const waypointsForApi = isLastBatch
              ? batchWaypoints
              : batchWaypoints.slice(0, -1);

            batches.push({
              start: batchStart,
              waypoints: waypointsForApi,
              end: batchEnd,
            });

            currentIndex += batchSize;
          }

          console.log(`[Editor] Split into ${batches.length} batches`);

          // Execute all batch API calls
          for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            const result = await getDirections(
              batch.start,
              batch.waypoints,
              batch.end,
              'walking'
            );

            if (result.routes?.[0]) {
              const batchGeometry = result.routes[0].geometry.coordinates as [
                number,
                number
              ][];

              // Skip first coordinate of subsequent batches to avoid duplicates
              if (i > 0 && batchGeometry.length > 0) {
                fullGeometry = [...fullGeometry, ...batchGeometry.slice(1)];
              } else {
                fullGeometry = [...fullGeometry, ...batchGeometry];
              }

              totalDistance += result.routes[0].distance;
              totalDuration += result.routes[0].duration;
            }
          }

          console.log(
            `[Editor] Combined geometry has ${fullGeometry.length} coordinates`
          );
        }

        if (fullGeometry.length > 0) {
          // Save the complete route geometry for storage
          setRouteGeometry(fullGeometry);
          console.log(
            '[Editor] Route geometry saved:',
            fullGeometry.length,
            'coordinates'
          );

          // Update distance and duration (elevation is calculated manually or before save)
          setRouteStats(prev => ({
            ...prev,
            distance: Number((totalDistance / 1000).toFixed(2)),
            duration: Math.round(totalDuration / 60),
            // Reset elevation stats since route changed - will be recalculated
            highestPoint: 0,
            lowestPoint: 0,
            totalAscent: 0,
            totalDescent: 0,
          }));

          // Clear elevation data since route changed - user needs to recalculate
          setElevationData(null);

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
        }
      } catch (error) {
        console.error('Failed to calculate route:', error);
      }
    };

    // Small delay to ensure map is ready
    const timer = setTimeout(drawRoute, 100);
    return () => clearTimeout(timer);
  }, [startPoint, waypoints, endPoint, isGpxRoute, mapLoaded, routeSettings]);

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
          setWaypoints(result.route.waypoints || []);
          setRouteGeometry(result.route.routeGeometry || null);
          setElevationData(result.route.elevationData || null); // Restore stored elevation data
          setPois(result.route.pois || []);
          setRouteStats({
            distance: result.route.distance || 0,
            duration: Math.round((result.route.duration || 0) / 60),
            highestPoint: result.route.highestPoint || 0,
            lowestPoint: result.route.lowestPoint || 0,
            totalAscent: result.route.totalAscent || 0,
            totalDescent: result.route.totalDescent || 0,
          });
          setEditMode('waypoint');
        }
      } catch (error) {
        console.error('[Editor] Failed to load route:', error);
      } finally {
        setLoading(false);
      }
    };
    loadRoute();
  }, [id, mapLoaded]);

  // Keyboard event listener for deleting selected waypoint
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Delete or Backspace is pressed and a waypoint is selected
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedWaypointIndex !== null
      ) {
        // Prevent default behavior (e.g., navigating back on Backspace)
        e.preventDefault();

        // Don't delete if user is typing in an input field
        const activeElement = document.activeElement;
        if (
          activeElement &&
          (activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA')
        ) {
          return;
        }

        console.log(`[Editor] Deleting waypoint ${selectedWaypointIndex + 1}`);

        // Clear GPX mode since we're modifying the route
        setIsGpxRoute(false);
        setRouteGeometry(null);

        // Remove the waypoint
        setWaypoints(prev =>
          prev.filter((_, i) => i !== selectedWaypointIndex)
        );

        // Clear selection
        setSelectedWaypointIndex(null);
      }

      // Escape key to deselect
      if (e.key === 'Escape' && selectedWaypointIndex !== null) {
        setSelectedWaypointIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedWaypointIndex]);

  // Manage highlight marker on map (from elevation profile hover)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (highlightPosition) {
      // Create or update highlight marker
      if (!highlightMarkerRef.current) {
        const el = document.createElement('div');
        el.className =
          'w-4 h-4 bg-[#088d95] rounded-full border-2 border-white shadow-lg';
        highlightMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([highlightPosition.lng, highlightPosition.lat])
          .addTo(map.current);
      } else {
        highlightMarkerRef.current.setLngLat([
          highlightPosition.lng,
          highlightPosition.lat,
        ]);
      }
    } else {
      // Remove highlight marker
      if (highlightMarkerRef.current) {
        highlightMarkerRef.current.remove();
        highlightMarkerRef.current = null;
      }
    }
  }, [highlightPosition, mapLoaded]);

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
        const elevData = await getMapboxElevation(map.current!, routeGeometry);
        console.log('[Editor] Auto-elevation result:', elevData);

        // Create elevation data array
        const distanceKm = routeStats.distance;
        const elevationDataArray = elevData.elevations.map((elev, i) => ({
          elevation: elev,
          distance:
            i === 0 ? 0 : (distanceKm * i) / (elevData.elevations.length - 1),
        }));
        setElevationData(elevationDataArray);

        setRouteStats(prev => ({
          ...prev,
          highestPoint: elevData.highestPoint,
          lowestPoint: elevData.lowestPoint,
          totalAscent: elevData.totalAscent,
          totalDescent: elevData.totalDescent,
        }));
      } catch (error) {
        console.error('[Editor] Auto-elevation calculation failed:', error);
      } finally {
        setCalculatingElevation(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [routeGeometry, isGpxRoute, mapLoaded]);

  // Handler for elevation profile hover - updates map marker
  const handleElevationPositionChange = (
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
  };

  // Handler for POI click on elevation profile - zoom to POI on map
  const handlePoiClickFromProfile = ({
    lngLat,
  }: {
    lngLat: [number, number];
    name: string;
  }) => {
    if (!lngLat) return;

    // Fly to location
    if (map.current) {
      map.current.flyTo({
        center: lngLat,
        zoom: 16,
        essential: true,
      });
    }

    // Open POI modal using coordinates to find the POI
    const poiIndex = pois.findIndex(p => {
      // Normalize p.lngLat which might be array or object
      let pLng, pLat;
      if (Array.isArray(p.lngLat)) {
        pLng = p.lngLat[0];
        pLat = p.lngLat[1];
      } else {
        pLng = p.lngLat.lng;
        pLat = p.lngLat.lat;
      }
      return (
        Math.abs(pLng - lngLat[0]) < 0.00001 &&
        Math.abs(pLat - lngLat[1]) < 0.00001
      );
    });

    if (poiIndex >= 0) {
      setPoiModalLngLat(lngLat);
      setPoiModalOpen(true);
    }
  };

  // Calculate elevation data manually (called from button or before save)
  const calculateElevation = async () => {
    // If we already have accurate elevation data from GPX, don't overwrite it
    if (elevationData && elevationData.length > 0 && isGpxRoute) {
      console.log(
        '[Editor] Using existing GPX elevation data, skipping Mapbox calculation'
      );
      alert(
        'Elevation data already available from GPX file. No recalculation needed.'
      );
      return;
    }

    if (!routeGeometry || routeGeometry.length === 0) {
      alert('Please create a route first');
      return;
    }

    if (!map.current) {
      alert('Map not ready. Please try again.');
      return;
    }

    setCalculatingElevation(true);
    try {
      console.log(
        '[Editor] Calculating elevation using Mapbox for',
        routeGeometry.length,
        'coordinates'
      );
      const elevData = await getMapboxElevation(map.current, routeGeometry);
      console.log('[Editor] Elevation data:', elevData);

      // Store elevation data for saving - create array of {elevation, distance} pairs
      const distanceKm = routeStats.distance;
      const elevationDataArray = elevData.elevations.map((elev, i) => ({
        elevation: elev,
        distance:
          i === 0 ? 0 : (distanceKm * i) / (elevData.elevations.length - 1),
      }));
      setElevationData(elevationDataArray);

      setRouteStats(prev => ({
        ...prev,
        highestPoint: elevData.highestPoint,
        lowestPoint: elevData.lowestPoint,
        totalAscent: elevData.totalAscent,
        totalDescent: elevData.totalDescent,
      }));

      console.log('[Editor] Elevation calculated successfully');
    } catch (error) {
      console.error('[Editor] Failed to calculate elevation:', error);
      alert(
        'Failed to calculate elevation data. Please ensure the map terrain is loaded.'
      );
    } finally {
      setCalculatingElevation(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Route name is required');
      return;
    }
    if (!startPoint || !endPoint) {
      alert('Please set start and end points');
      return;
    }
    if (!routeGeometry || routeGeometry.length === 0) {
      alert('Please wait for route to be calculated');
      return;
    }

    setSaving(true);
    try {
      // Calculate elevation if not already done
      let finalElevationData = elevationData;
      let finalRouteStats = { ...routeStats };

      if (!elevationData || elevationData.length === 0) {
        console.log(
          '[Editor] Calculating elevation using Mapbox before save...'
        );

        if (!map.current) {
          alert('Map not ready. Cannot save without elevation data.');
          return;
        }

        const elevData = await getMapboxElevation(map.current, routeGeometry);

        const distanceKm = routeStats.distance;
        finalElevationData = elevData.elevations.map((elev, i) => ({
          elevation: elev,
          distance:
            i === 0 ? 0 : (distanceKm * i) / (elevData.elevations.length - 1),
        }));

        // PRESERVE user-edited stats - only use calculated values if user hasn't edited them
        // A value of 0 indicates it hasn't been edited (or user explicitly set to 0)
        finalRouteStats = {
          ...routeStats,
          // Use user-edited values if they exist, otherwise use calculated
          highestPoint:
            routeStats.highestPoint > 0
              ? routeStats.highestPoint
              : elevData.highestPoint,
          lowestPoint:
            routeStats.lowestPoint > 0
              ? routeStats.lowestPoint
              : elevData.lowestPoint,
          totalAscent:
            routeStats.totalAscent > 0
              ? routeStats.totalAscent
              : elevData.totalAscent,
          totalDescent:
            routeStats.totalDescent > 0
              ? routeStats.totalDescent
              : elevData.totalDescent,
        };

        console.log('[Editor] Saving with stats:', finalRouteStats);

        // Update state for future reference
        setElevationData(finalElevationData);
        setRouteStats(finalRouteStats);
      }

      const routeData = {
        name,
        description,
        startPoint,
        endPoint,
        routeGeometry,
        elevationData: finalElevationData, // Use calculated elevation data
        waypoints,
        pois: pois.map(p => ({
          name: p.name,
          description: p.description,
          lngLat: p.lngLat,
          type: p.type,
          best_time: p.bestTime || p.best_time,
          images: p.images || [],
          amenities: p.amenities || [],
        })),
        distance: finalRouteStats.distance,
        duration: finalRouteStats.duration * 60,
        highestPoint: finalRouteStats.highestPoint,
        lowestPoint: finalRouteStats.lowestPoint,
        totalAscent: finalRouteStats.totalAscent,
        totalDescent: finalRouteStats.totalDescent,
      } as any;
      if (isEditing) await routesApi.update(Number(id), routeData);
      else await routesApi.create(routeData);
      navigate('/admin');
    } catch (error) {
      console.error('Failed to save route:', error);
      alert('Failed to save route');
    } finally {
      setSaving(false);
    }
  };

  const clearRoute = () => {
    setStartPoint(null);
    setEndPoint(null);
    setWaypoints([]);
    setPois([]);
    setRouteGeometry(null);
    setElevationData(null); // Clear stored elevation data
    setIsGpxRoute(false);
    setRouteStats({
      distance: 0,
      duration: 0,
      highestPoint: 0,
      lowestPoint: 0,
      totalAscent: 0,
      totalDescent: 0,
    });
    setEditMode('start');
    if (map.current?.getLayer('route')) map.current.removeLayer('route');
    if (map.current?.getSource('route')) map.current.removeSource('route');
  };

  const removeWaypoint = (index: number) =>
    setWaypoints(prev => prev.filter((_, i) => i !== index));
  const removePoi = (index: number) =>
    setPois(prev => prev.filter((_, i) => i !== index));

  const handlePOISave = (poiData: POIData) => {
    setPois(prev => [...prev, { ...poiData, id: Date.now() } as any]);
    setPoiModalOpen(false);
    setEditMode('waypoint');
  };

  const handleGPXUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();

      // Use accurate stats processing for statistics
      const accurateStats = processGPXWithAccurateStats(text);

      // Use original processing for waypoints (needed for route editing)
      const points = parseGPX(text);
      const routeData = processGPXToRoute(points);
      const routeName = getGPXRouteName(text);

      // Mark as GPX route FIRST to prevent any intermediate API calls
      setIsGpxRoute(true);

      // Clear any existing route visual (but don't reset isGpxRoute)
      if (map.current?.getLayer('route')) map.current.removeLayer('route');
      if (map.current?.getSource('route')) map.current.removeSource('route');

      // Set all the route data using accurate coordinates
      setStartPoint([
        accurateStats.coordinates[0][0],
        accurateStats.coordinates[0][1],
      ]);
      setEndPoint([
        accurateStats.coordinates[accurateStats.coordinates.length - 1][0],
        accurateStats.coordinates[accurateStats.coordinates.length - 1][1],
      ]);
      setWaypoints(routeData.waypoints);
      setRouteGeometry(accurateStats.coordinates);
      setPois([]);

      // Use accurate elevation data
      setElevationData(accurateStats.elevationData);

      console.log(
        '[Editor] GPX geometry saved:',
        accurateStats.coordinates.length,
        'coordinates'
      );
      console.log(
        '[Editor] GPX accurate stats:',
        'Distance:',
        accurateStats.distanceKm,
        'km,',
        'Duration:',
        accurateStats.durationFormatted,
        ',',
        'Ascent:',
        accurateStats.totalAscentM,
        'm,',
        'Descent:',
        accurateStats.totalDescentM,
        'm'
      );

      if (routeName && !name) setName(routeName);

      // Set accurate route statistics
      setRouteStats(prev => ({
        ...prev,
        distance: accurateStats.distanceKm,
        duration: accurateStats.durationMinutes,
        highestPoint: accurateStats.highestPointM,
        lowestPoint: accurateStats.lowestPointM,
        totalAscent: accurateStats.totalAscentM,
        totalDescent: accurateStats.totalDescentM,
      }));

      // Draw the route immediately on the map (don't wait for useEffect)
      if (map.current && map.current.isStyleLoaded()) {
        // Clean up existing layers/sources
        if (map.current.getLayer('route')) map.current.removeLayer('route');
        if (map.current.getSource('route')) map.current.removeSource('route');

        map.current.addSource('route', {
          type: 'geojson',
          lineMetrics: true,
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: accurateStats.coordinates,
            },
          },
        });
        map.current.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': routeSettings.mainColor,
            'line-width': routeSettings.lineWidth,
          },
        });
        console.log('[Editor] GPX route drawn immediately on map');

        // Auto-zoom to fit the entire route using fitBounds
        const bounds = new mapboxgl.LngLatBounds();
        accurateStats.coordinates.forEach(coord => {
          bounds.extend(coord);
        });
        map.current.fitBounds(bounds, {
          padding: { top: 100, bottom: 150, left: 350, right: 50 },
          duration: 1000,
        });
        console.log('[Editor] Map zoomed to fit route bounds');

        // Draw markers immediately (don't wait for useEffect)
        // Clear existing markers first
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        // Start marker
        const startEl = document.createElement('div');
        startEl.innerHTML =
          '<i class="fa-solid fa-play" style="color: white; font-size: 12px;"></i>';
        startEl.className =
          'w-8 h-8 bg-green-500 rounded-full flex items-center justify-center border-2 border-white cursor-move pl-0.5';
        const startMarker = new mapboxgl.Marker({
          element: startEl,
          draggable: true,
        })
          .setLngLat(routeData.startPoint)
          .addTo(map.current);
        startMarker.on('dragend', () => {
          // Clear GPX mode to recalculate route via Directions API
          setIsGpxRoute(false);
          setRouteGeometry(null);
          setStartPoint([
            startMarker.getLngLat().lng,
            startMarker.getLngLat().lat,
          ]);
        });
        markersRef.current.push(startMarker);

        // Waypoint markers with numbers
        routeData.waypoints.forEach((wp: [number, number], index: number) => {
          const el = document.createElement('div');
          el.textContent = String(index + 1);
          el.className =
            'w-7 h-7 bg-[#088d95] rounded-full flex items-center justify-center border-2 border-white text-white text-xs font-bold cursor-move';
          const marker = new mapboxgl.Marker({ element: el, draggable: true })
            .setLngLat(wp)
            .addTo(map.current!);
          marker.on('dragend', () => {
            // Clear GPX mode to recalculate route via Directions API
            setIsGpxRoute(false);
            setRouteGeometry(null);
            setWaypoints(prev => {
              const newWp = [...prev];
              newWp[index] = [marker.getLngLat().lng, marker.getLngLat().lat];
              return newWp;
            });
          });
          markersRef.current.push(marker);
        });

        // End marker
        const endEl = document.createElement('div');
        endEl.innerHTML =
          '<i class="fa-solid fa-flag-checkered" style="color: white; font-size: 12px;"></i>';
        endEl.className =
          'w-8 h-8 bg-red-500 rounded-full flex items-center justify-center border-2 border-white cursor-move';
        const endMarker = new mapboxgl.Marker({
          element: endEl,
          draggable: true,
        })
          .setLngLat(routeData.endPoint)
          .addTo(map.current);
        endMarker.on('dragend', () => {
          // Clear GPX mode to recalculate route via Directions API
          setIsGpxRoute(false);
          setRouteGeometry(null);
          setEndPoint([endMarker.getLngLat().lng, endMarker.getLngLat().lat]);
        });
        markersRef.current.push(endMarker);

        console.log('[Editor] GPX markers drawn immediately on map');
      }

      if (map.current) {
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend(routeData.startPoint);
        bounds.extend(routeData.endPoint);
        routeData.waypoints.forEach(wp => bounds.extend(wp));
        map.current.fitBounds(bounds, { padding: 50 });
      }
      setEditMode('waypoint');
    } catch (error) {
      alert(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
    if (gpxInputRef.current) gpxInputRef.current.value = '';
  };

  // Calculate duration based on fixed 10.5 km/h average speed
  const calculateRealisticDuration = () => {
    const distanceKm = routeStats.distance;
    const AVERAGE_SPEED_KMH = 10.5;
    const totalTimeHours = distanceKm / AVERAGE_SPEED_KMH;
    return Math.round(totalTimeHours * 60);
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const s = 0;
    return `${h.toString().padStart(2, '0')}:${m
      .toString()
      .padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen flex flex-col bg-[#0b1215] relative">
      {/* Loading Overlay - shown OVER the map instead of replacing it */}
      {loading && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-[#0b1215]/80">
          <div className="flex flex-col items-center gap-3">
            <i className="fas fa-spinner fa-spin text-3xl text-[#088d95]"></i>
            <span className="text-gray-400">{t('loading')}</span>
          </div>
        </div>
      )}

      {/* Mode Info Overlay */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-[#080e11] border border-[#1e2a33] rounded-lg text-white text-sm shadow-lg">
        <i className="fas fa-info-circle text-[#088d95] mr-2"></i>
        {modeLabels[editMode]}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Map + Elevation */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative min-h-[300px]">
            <div
              ref={mapContainer}
              className="absolute h-[100%]  inset-0 z-10"
            />
          </div>

          {/* Elevation Profile */}
          <div className="h-[200px] bg-[#080e11] border-t border-[#1e2a33]">
            {startPoint && endPoint ? (
              <ElevationProfile
                route={
                  {
                    id: id ? Number(id) : 0,
                    name,
                    description,
                    startPoint,
                    endPoint,
                    waypoints,
                    routeGeometry: routeGeometry || undefined,
                    elevationData: elevationData || undefined, // Pass stored elevation data
                    distance: routeStats.distance,
                    duration: routeStats.duration * 60,
                    highestPoint: routeStats.highestPoint,
                    lowestPoint: routeStats.lowestPoint,
                    totalAscent: routeStats.totalAscent,
                    totalDescent: routeStats.totalDescent,
                    pois: pois.map((p, i) => ({
                      poi_id: i,
                      name: p.name || `POI ${i + 1}`,
                      lngLat: p.lngLat,
                      type: p.type,
                      images: p.images || [],
                      amenities: p.amenities || [],
                    })),
                  } as Route
                }
                pois={pois.map((p, i) => ({
                  poi_id: i,
                  name: p.name || `POI ${i + 1}`,
                  lngLat: p.lngLat,
                  type: p.type,
                  images: p.images || [],
                  amenities: p.amenities || [],
                }))}
                onPositionChange={handleElevationPositionChange}
                highlightDistance={highlightDistance}
                onPoiClick={poi =>
                  handlePoiClickFromProfile({
                    lngLat: poi.lngLat,
                    name: poi.name,
                  })
                }
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                {t('setStartEndHint')}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-[300px] bg-[#080e11] border-l border-[#1e2a33] p-3 flex flex-col gap-3 overflow-y-auto">
          {/* Route Name */}
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('routeNamePlaceholder')}
            className="w-full px-3 py-2.5 bg-[#0b1215] border border-[#1e2a33] rounded-lg text-white placeholder-gray-500 focus:border-[#088d95] focus:outline-none"
          />

          {/* Mode Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setEditMode('start')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-all ${
                editMode === 'start'
                  ? 'bg-green-500 text-white'
                  : 'bg-[#0b1215] border border-[#1e2a33] text-gray-400 hover:border-green-500'
              }`}
            >
              <i className="fas fa-play"></i> {t('start')}
            </button>
            <button
              onClick={() => setEditMode('end')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-all ${
                editMode === 'end'
                  ? 'bg-red-500 text-white'
                  : 'bg-[#0b1215] border border-[#1e2a33] text-gray-400 hover:border-red-500'
              }`}
            >
              <i className="fas fa-flag-checkered"></i> {t('end')}
            </button>
            <button
              onClick={() => setEditMode('waypoint')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-all ${
                editMode === 'waypoint'
                  ? 'bg-[#088d95] text-white'
                  : 'bg-[#0b1215] border border-[#1e2a33] text-gray-400 hover:border-[#088d95]'
              }`}
            >
              <i className="fas fa-plus"></i> {t('waypoint')}
            </button>
            <button
              onClick={() => setEditMode('poi')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-all ${
                editMode === 'poi'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-[#0b1215] border border-[#1e2a33] text-gray-400 hover:border-yellow-500'
              }`}
            >
              <i className="fas fa-map-marker-alt"></i> POI
            </button>
          </div>

          {/* Action Buttons */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#088d95] hover:bg-[#0da6ae] text-white rounded-lg transition-all disabled:opacity-50"
          >
            {saving ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : (
              <i className="fas fa-save"></i>
            )}{' '}
            {t('saveRoute')}
          </button>
          <button
            onClick={clearRoute}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-all"
          >
            <i className="fas fa-trash"></i> {t('deleteRoute')}
          </button>

          {/* Calculate Elevation Button */}
          <button
            onClick={calculateElevation}
            disabled={
              calculatingElevation ||
              !routeGeometry ||
              routeGeometry.length === 0
            }
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${
              elevationData && elevationData.length > 0
                ? 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30'
            } disabled:opacity-50`}
          >
            {calculatingElevation ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : elevationData && elevationData.length > 0 ? (
              <i className="fas fa-check-circle"></i>
            ) : (
              <i className="fas fa-mountain"></i>
            )}{' '}
            {calculatingElevation
              ? 'Calculating...'
              : elevationData && elevationData.length > 0
              ? 'Elevation Calculated'
              : 'Calculate Elevation'}
          </button>

          {/* GPX Upload */}
          <div>
            <input
              type="file"
              ref={gpxInputRef}
              accept=".gpx"
              className="hidden"
              onChange={handleGPXUpload}
            />
            <button
              onClick={() => gpxInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-[#1e2a33] text-gray-400 hover:text-white hover:border-[#088d95] rounded-lg transition-all"
            >
              <i className="fas fa-upload"></i> {t('uploadGPX')}
            </button>
          </div>

          {/* Split Point Editor - only show when editing existing route */}
          {isEditing && routeGeometry && (
            <SplitPointEditor
              routeId={id ? Number(id) : null}
              routeGeometry={routeGeometry}
              totalDistance={routeStats.distance}
              onSetSplitPointMode={(
                active,
                tourType,
                stageNumber,
                callback
              ) => {
                if (active) {
                  setEditMode('splitpoint');
                  setSplitPointTourType(tourType);
                  setSplitPointStageNumber(stageNumber);
                  splitPointCallbackRef.current = callback;
                } else {
                  setEditMode('waypoint');
                  splitPointCallbackRef.current = null;
                }
              }}
            />
          )}

          {/* POIs Section */}
          {pois.length > 0 && (
            <div className="bg-[#0b1215] border border-[#1e2a33] rounded-lg p-3">
              <h4 className="text-[#088d95] text-xs uppercase mb-2 font-semibold">
                Interessenpunkte ({pois.length})
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {pois.map((poi, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center py-1.5 px-2 bg-[#080e11] rounded border border-[#1e2a33]"
                  >
                    <span className="text-sm text-white flex items-center gap-2 truncate">
                      <i
                        className={`fas ${
                          (poiIcons[poi.type] || poiIcons.highlight).icon
                        }`}
                        style={{
                          color: (poiIcons[poi.type] || poiIcons.highlight)
                            .color,
                        }}
                      ></i>
                      {poi.name}
                    </span>
                    <button
                      onClick={() => removePoi(idx)}
                      className="text-red-400 hover:text-red-300 text-lg px-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Route Points */}
          <div className="bg-[#0b1215] border border-[#1e2a33] rounded-lg p-3">
            <h4 className="text-[#088d95] text-xs uppercase mb-2 font-semibold">
              {t('routePoints')}
            </h4>

            <div
              ref={waypointListRef}
              className="max-h-[300px] overflow-y-auto"
            >
              {startPoint && (
                <div className="flex justify-between items-center py-1.5 border-b border-[#1e2a33]">
                  <span className="text-sm text-white">
                    <i className="fas fa-play text-green-500 mr-2"></i>
                    {t('start')}
                  </span>
                  <button
                    onClick={() => {
                      setStartPoint(null);
                      setEditMode('start');
                    }}
                    className="text-red-400 hover:text-red-300 text-lg"
                  >
                    ×
                  </button>
                </div>
              )}

              {waypoints.map((wp, idx) => (
                <div
                  key={idx}
                  data-waypoint-item
                  onClick={() => {
                    // Select waypoint
                    setSelectedWaypointIndex(idx);

                    // Zoom to waypoint on map
                    if (map.current) {
                      map.current.flyTo({
                        center: wp,
                        zoom: 15,
                        essential: true,
                      });
                    }
                  }}
                  className={`flex justify-between items-center py-1.5 border-b border-[#1e2a33] cursor-pointer transition-all ${
                    selectedWaypointIndex === idx
                      ? 'bg-yellow-500/20 border-l-2 border-l-yellow-500 pl-2'
                      : 'hover:bg-[#1e2a33]/50'
                  }`}
                >
                  <span className="text-sm text-white flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                        selectedWaypointIndex === idx
                          ? 'bg-yellow-500'
                          : 'bg-[#088d95]'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    {t('waypoint')} {idx + 1}
                  </span>
                  <button
                    onClick={e => {
                      e.stopPropagation(); // Prevent selection when clicking delete
                      // Clear GPX mode since we're modifying the route
                      setIsGpxRoute(false);
                      setRouteGeometry(null);
                      removeWaypoint(idx);
                      // Clear selection if deleting the selected waypoint
                      if (selectedWaypointIndex === idx) {
                        setSelectedWaypointIndex(null);
                      } else if (
                        selectedWaypointIndex !== null &&
                        selectedWaypointIndex > idx
                      ) {
                        // Adjust selection index if deleting before selected
                        setSelectedWaypointIndex(selectedWaypointIndex - 1);
                      }
                    }}
                    className="text-red-400 hover:text-red-300 text-lg"
                  >
                    ×
                  </button>
                </div>
              ))}

              {endPoint && (
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-sm text-white">
                    <i className="fas fa-flag text-red-500 mr-2"></i>
                    {t('end')}
                  </span>
                  <button
                    onClick={() => {
                      setEndPoint(null);
                      setEditMode('end');
                    }}
                    className="text-red-400 hover:text-red-300 text-lg"
                  >
                    ×
                  </button>
                </div>
              )}

              {!startPoint && !endPoint && waypoints.length === 0 && (
                <div className="text-gray-500 text-sm py-2">
                  {t('clickOnMap')}
                </div>
              )}
            </div>
          </div>

          {/* Stats - Editable */}
          <div className="bg-[#0b1215] border border-[#1e2a33] rounded-lg p-3">
            <h4 className="text-[#088d95] text-xs uppercase mb-2 font-semibold flex justify-between items-center">
              {t('routeStatistics')}
              <span className="text-gray-500 text-[10px] normal-case font-normal">
                (click to edit)
              </span>
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">{t('distance')}</span>
                <div className="flex items-center">
                  <input
                    type="number"
                    step="0.01"
                    value={routeStats.distance}
                    onChange={e =>
                      setRouteStats(prev => ({
                        ...prev,
                        distance: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-20 bg-transparent text-[#088d95] font-semibold text-right border-b border-transparent hover:border-[#088d95] focus:border-[#088d95] focus:outline-none px-1"
                  />
                  <span className="text-[#088d95] font-semibold ml-1">km</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">{t('duration')}</span>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={formatDuration(
                      routeStats.duration || calculateRealisticDuration()
                    )}
                    onChange={e => {
                      // Parse HH:MM:SS format to minutes
                      const parts = e.target.value.split(':');
                      if (parts.length >= 2) {
                        const hours = parseInt(parts[0] || '0');
                        const mins = parseInt(parts[1] || '0');
                        setRouteStats(prev => ({
                          ...prev,
                          duration: hours * 60 + mins,
                        }));
                      }
                    }}
                    className="w-20 bg-transparent text-[#088d95] font-semibold text-right border-b border-transparent hover:border-[#088d95] focus:border-[#088d95] focus:outline-none px-1"
                    placeholder="HH:MM"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">{t('highestPoint')}</span>
                <div className="flex items-center">
                  <input
                    type="number"
                    value={routeStats.highestPoint}
                    onChange={e =>
                      setRouteStats(prev => ({
                        ...prev,
                        highestPoint: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="w-16 bg-transparent text-[#088d95] font-semibold text-right border-b border-transparent hover:border-[#088d95] focus:border-[#088d95] focus:outline-none px-1"
                  />
                  <span className="text-[#088d95] font-semibold ml-1">m</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">{t('lowestPoint')}</span>
                <div className="flex items-center">
                  <input
                    type="number"
                    value={routeStats.lowestPoint}
                    onChange={e =>
                      setRouteStats(prev => ({
                        ...prev,
                        lowestPoint: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="w-16 bg-transparent text-[#088d95] font-semibold text-right border-b border-transparent hover:border-[#088d95] focus:border-[#088d95] focus:outline-none px-1"
                  />
                  <span className="text-[#088d95] font-semibold ml-1">m</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">{t('totalAscent')}</span>
                <div className="flex items-center">
                  <span className="text-green-500">↑</span>
                  <input
                    type="number"
                    value={routeStats.totalAscent}
                    onChange={e =>
                      setRouteStats(prev => ({
                        ...prev,
                        totalAscent: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="w-16 bg-transparent text-green-500 font-semibold text-right border-b border-transparent hover:border-green-500 focus:border-green-500 focus:outline-none px-1"
                  />
                  <span className="text-green-500 font-semibold ml-1">m</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">{t('totalDescent')}</span>
                <div className="flex items-center">
                  <span className="text-red-400">↓</span>
                  <input
                    type="number"
                    value={routeStats.totalDescent}
                    onChange={e =>
                      setRouteStats(prev => ({
                        ...prev,
                        totalDescent: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="w-16 bg-transparent text-red-400 font-semibold text-right border-b border-transparent hover:border-red-400 focus:border-red-400 focus:outline-none px-1"
                  />
                  <span className="text-red-400 font-semibold ml-1">m</span>
                </div>
              </div>
            </div>
          </div>

          {/* Back */}
          <button
            onClick={() => navigate('/admin')}
            className="mt-auto w-full flex items-center justify-center gap-2 py-2.5 border border-[#1e2a33] text-gray-400 hover:text-white hover:border-[#088d95] rounded-lg transition-all"
          >
            <i className="fas fa-arrow-left"></i> {t('back')}
          </button>
        </div>
      </div>

      {/* POI Modal */}
      <POIModal
        isOpen={poiModalOpen}
        lngLat={poiModalLngLat}
        editingPoi={pois.find(
          p =>
            p.lngLat[0] === poiModalLngLat[0] &&
            p.lngLat[1] === poiModalLngLat[1]
        )}
        onSave={handlePOISave}
        onClose={() => {
          setPoiModalOpen(false);
          setEditMode('waypoint');
        }}
      />
    </div>
  );
}
