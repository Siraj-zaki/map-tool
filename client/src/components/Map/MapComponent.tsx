import mapboxgl from 'mapbox-gl';
import { useCallback, useEffect, useRef, useState } from 'react';
// import difficultyImage from '../../../public/images/difficulty.png';
import HighlightImage from '../../../public/images/highlight-marker.png';
import HotelImage from '../../../public/images/hotel-marker.png';
import SummitImage from '../../../public/images/mountain-marker.png';
import RestaurantImage from '../../../public/images/resturant-marker.png';
import type { POI, Route, SplitPoint } from '../../api';
import { splitPointsApi } from '../../api';
import { POI_ICON_FALLBACK, ROUTE_STYLES } from '../../constants/routeStyles';
import { useColorSettings } from '../../contexts/ColorSettingsContext';

mapboxgl.accessToken =
  'pk.eyJ1IjoicHVuY2hpbmdtYW4iLCJhIjoiY2p1cjcyMmh2M3NpZDQ5bnEwMDV6ZTE1OSJ9.ef8y6l9fsKFMX91m_Rt2ng';

// Tour type stage configuration
type TourType = 'gold' | 'silver' | 'bronze';

const stageConfig: Record<TourType, { stages: number }> = {
  gold: { stages: 1 },
  silver: { stages: 2 },
  bronze: { stages: 3 },
};

// Haversine distance calculation (returns meters)
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Calculate bearing between two points
function getBearing(start: [number, number], end: [number, number]): number {
  const startLat = (start[0] * Math.PI) / 180;
  const startLng = (start[1] * Math.PI) / 180;
  const endLat = (end[0] * Math.PI) / 180;
  const endLng = (end[1] * Math.PI) / 180;

  const dLng = endLng - startLng;

  const x = Math.sin(dLng) * Math.cos(endLat);
  const y =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

  let bearing = (Math.atan2(x, y) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

interface MapComponentProps {
  route?: Route | null;
  tourType?: TourType;
  selectedStage?: number | null;
  onPositionChange?: (position: {
    lng: number;
    lat: number;
    distance: number;
    index: number;
  }) => void;
  onPoiClick?: (poi: POI) => void;
  highlightPosition?: { lng: number; lat: number } | null;
  flyToLocation?: { lng: number; lat: number } | null;
}

export default function MapComponent({
  route,
  tourType = 'gold',
  selectedStage,
  onPositionChange,
  onPoiClick,
  highlightPosition,
  flyToLocation,
}: MapComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const stageMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const hoverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const highlightMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const routeCoordinatesRef = useRef<[number, number][]>([]);
  const onPoiClickRef = useRef(onPoiClick);
  const [isLoaded, setIsLoaded] = useState(false);
  const [splitPoints, setSplitPoints] = useState<{
    silver: SplitPoint[];
    bronze: SplitPoint[];
  } | null>(null);

  // Keep ref updated with latest callback
  useEffect(() => {
    onPoiClickRef.current = onPoiClick;
  }, [onPoiClick]);

  // Get dynamic colors from context
  const { routeSettings, getStageColor } = useColorSettings();

  // Calculate distance to point along route
  const getDistanceAlongRoute = useCallback(
    (
      point: [number, number],
      routeData: Route
    ): { distance: number; index: number } => {
      const coords = [
        routeData.startPoint,
        ...routeData.waypoints,
        routeData.endPoint,
      ];
      let minDist = Infinity;
      let closestSegmentIndex = 0;

      for (let i = 0; i < coords.length - 1; i++) {
        const dist = haversineDistance(
          point[1],
          point[0],
          coords[i][1],
          coords[i][0]
        );
        if (dist < minDist) {
          minDist = dist;
          closestSegmentIndex = i;
        }
      }

      let accumulatedDist = 0;
      for (let i = 0; i < closestSegmentIndex; i++) {
        accumulatedDist += haversineDistance(
          coords[i][1],
          coords[i][0],
          coords[i + 1][1],
          coords[i + 1][0]
        );
      }

      return { distance: accumulatedDist / 1000, index: closestSegmentIndex };
    },
    []
  );

  // Fetch split points when route changes
  useEffect(() => {
    if (!route?.id) {
      setSplitPoints(null);
      return;
    }

    const fetchSplitPoints = async () => {
      try {
        const result = await splitPointsApi.getByRoute(route.id);
        if (result.success) {
          setSplitPoints(result.splitPoints);
        }
      } catch (err) {
        console.error('Failed to fetch split points:', err);
      }
    };

    fetchSplitPoints();
  }, [route?.id]);

  // Create arrow SVG for route direction indicators - matching original main.js
  const createArrowImage = useCallback(() => {
    if (!map.current || map.current.hasImage('route-arrow')) return;

    const arrowImage = new Image(24, 24);
    arrowImage.onload = () => {
      if (map.current && !map.current.hasImage('route-arrow')) {
        map.current.addImage('route-arrow', arrowImage, { sdf: true });
      }
    };
    arrowImage.src =
      'data:image/svg+xml;charset=utf-8,' +
      encodeURIComponent(`
      <svg id="route-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">
        <polygon points="14 1 1 27 14 22 27 27 14 1" fill="#fff" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
      </svg>
    `);
  }, []);

  // Create arrow source with dynamic spacing based on zoom - matching route.js
  const createArrowsSource = useCallback((coordinates: [number, number][]) => {
    if (!map.current) return;

    const currentZoom = map.current.getZoom();
    const zoomFactor = Math.pow(2.2, 14 - currentZoom);
    const baseDistance = 800 * zoomFactor;
    const minDistance = Math.max(Math.min(baseDistance, 5000), 150);
    const minSegmentLength = Math.max(30, 100 - currentZoom * 5);

    const arrowFeatures: GeoJSON.Feature[] = [];
    let accumulatedDistance = 0;
    let lastArrowPosition: [number, number] | null = null;

    for (let i = 1; i < coordinates.length - 1; i++) {
      const prevPoint = coordinates[i - 1];
      const currentPoint = coordinates[i];
      const nextPoint = coordinates[i + 1];

      const segmentDistance = haversineDistance(
        prevPoint[1],
        prevPoint[0],
        currentPoint[1],
        currentPoint[0]
      );
      accumulatedDistance += segmentDistance;

      if (accumulatedDistance >= minDistance) {
        const bearing = getBearing(
          [currentPoint[1], currentPoint[0]],
          [nextPoint[1], nextPoint[0]]
        );
        const nextSegmentDistance = haversineDistance(
          currentPoint[1],
          currentPoint[0],
          nextPoint[1],
          nextPoint[0]
        );

        if (
          nextSegmentDistance > minSegmentLength &&
          (!lastArrowPosition ||
            haversineDistance(
              lastArrowPosition[1],
              lastArrowPosition[0],
              currentPoint[1],
              currentPoint[0]
            ) >
              minDistance / 2)
        ) {
          arrowFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: currentPoint },
            properties: { bearing },
          });
          accumulatedDistance = 0;
          lastArrowPosition = currentPoint;
        }
      }
    }

    // Remove existing arrow layer/source
    if (map.current.getLayer('routeArrows')) {
      map.current.removeLayer('routeArrows');
    }
    if (map.current.getSource('arrow-source')) {
      map.current.removeSource('arrow-source');
    }

    // Add new arrow source
    map.current.addSource('arrow-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: arrowFeatures },
    });

    // Calculate arrow size based on zoom
    const arrowSize = Math.max(
      0.12,
      Math.min(0.3, 0.12 + (currentZoom - 8) * 0.02)
    );

    // Add arrow layer
    map.current.addLayer({
      id: 'routeArrows',
      type: 'symbol',
      source: 'arrow-source',
      layout: {
        'icon-image': 'route-arrow',
        'icon-size': arrowSize,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-rotate': ['get', 'bearing'],
        'icon-rotation-alignment': 'map',
        'icon-offset': [0, 0],
      },
      paint: {
        'icon-opacity': 1,
        'icon-color': '#FFFFFF',
      },
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/sirajmuneer/cmjh1h0wb000b01se721kbl7m',
      center: [10.57, 51.92],
      zoom: 10,
      pitch: 45,
      bearing: 20,
      attributionControl: false,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-left');
    map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

    map.current.on('load', () => {
      createArrowImage();

      // 3. Enable terrain to make elevation data available
      map.current?.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
      setIsLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [createArrowImage]);

  // Split route into stages based on tour type
  const getStageSegments = useCallback(
    (
      coordinates: [number, number][],
      numStages: number,
      tourType: TourType
    ) => {
      // Default even split if no custom points or Gold tour
      if (
        tourType === 'gold' ||
        !splitPoints ||
        (tourType === 'silver' && splitPoints.silver.length === 0) ||
        (tourType === 'bronze' && splitPoints.bronze.length === 0)
      ) {
        const segments: [number, number][][] = [];
        const pointsPerStage = Math.ceil(coordinates.length / numStages);

        for (let i = 0; i < numStages; i++) {
          const start = i * pointsPerStage;
          const end = Math.min(
            (i + 1) * pointsPerStage + 1,
            coordinates.length
          );
          segments.push(coordinates.slice(start, end));
        }
        return segments;
      }

      // Use custom split points
      const relevantSplitPoints = splitPoints[tourType as 'silver' | 'bronze'];
      // Sort points by stage number just in case
      const sortedSplitPoints = [...relevantSplitPoints].sort(
        (a, b) => a.stageNumber - b.stageNumber
      );

      // Map split points to closest coordinate indices
      const splitIndices: number[] = sortedSplitPoints.map(sp => {
        // Find index of coordinate closest to split point
        let minD = Infinity;
        let closestIdx = 0;

        // Optimization: Search only within reasonable bounds if needed,
        // but for < 10k points, simple iteration is fine.
        // We can also use distanceKm to estimate index if we had cumulative distances pre-calculated.
        coordinates.forEach((coord, idx) => {
          const d = haversineDistance(sp.lat, sp.lng, coord[1], coord[0]);
          if (d < minD) {
            minD = d;
            closestIdx = idx;
          }
        });
        return closestIdx;
      });

      // Construct segments: [0...split1], [split1...split2], [split2...end]
      const segments: [number, number][][] = [];
      let currentStart = 0;

      for (let i = 0; i < numStages; i++) {
        // Last stage goes to end
        if (i === numStages - 1) {
          segments.push(coordinates.slice(currentStart));
        } else {
          // Get split index for this stage end
          // stage 1 ends at splitIndices[0]
          const splitIdx = splitIndices[i]; // splitIndices has length numStages - 1
          if (splitIdx !== undefined && splitIdx > currentStart) {
            segments.push(coordinates.slice(currentStart, splitIdx + 1));
            currentStart = splitIdx;
          } else {
            // Fallback if bad index
            const end = Math.min(
              currentStart + Math.ceil(coordinates.length / numStages),
              coordinates.length
            );
            segments.push(coordinates.slice(currentStart, end));
            currentStart = end;
          }
        }
      }

      return segments;
    },
    [splitPoints]
  );

  // Handle route display
  useEffect(() => {
    if (!map.current || !isLoaded || !route) return;

    const config = stageConfig[tourType];

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    stageMarkersRef.current.forEach(m => m.remove());
    stageMarkersRef.current = [];

    // Remove existing layers/sources
    const existingLayers = map.current.getStyle().layers || [];
    existingLayers.forEach(layer => {
      if (
        layer.id.startsWith('route-stage-') ||
        layer.id.startsWith('route-outline-stage-') ||
        layer.id === 'route-hover' ||
        layer.id === 'routeArrows'
      ) {
        map.current!.removeLayer(layer.id);
      }
    });

    // Remove old sources
    for (let i = 0; i < 3; i++) {
      if (map.current.getSource(`route-stage-${i}`)) {
        map.current.removeSource(`route-stage-${i}`);
      }
    }
    if (map.current.getSource('route-hover-source')) {
      map.current.removeSource('route-hover-source');
    }
    if (map.current.getSource('arrow-source')) {
      map.current.removeSource('arrow-source');
    }

    // Use stored routeGeometry if available, otherwise construct from waypoints
    let coordinates: [number, number][];
    if (route.routeGeometry && route.routeGeometry.length > 0) {
      // Use the complete stored geometry from DB (from Directions API or GPX)
      coordinates = route.routeGeometry;
      console.log(
        '[Map] Using stored routeGeometry:',
        coordinates.length,
        'points'
      );
    } else {
      // Fallback: construct from start/waypoints/end (less accurate, just control points)
      coordinates = [route.startPoint, ...route.waypoints, route.endPoint] as [
        number,
        number,
      ][];
      console.log(
        '[Map] No routeGeometry, using waypoints:',
        coordinates.length,
        'points'
      );
    }
    routeCoordinatesRef.current = coordinates;

    const stageSegments = getStageSegments(
      coordinates,
      config.stages,
      tourType
    );

    // Add each stage as a separate layer
    stageSegments.forEach((segment, index) => {
      const sourceId = `route-stage-${index}`;
      const outlineLayerId = `route-outline-stage-${index}`;
      const layerId = `route-stage-${index}`;

      map.current!.addSource(sourceId, {
        type: 'geojson',
        lineMetrics: true,
        data: {
          type: 'Feature',
          properties: { stage: index + 1 },
          geometry: { type: 'LineString', coordinates: segment },
        },
      });

      // Route shadow layer (rendered first, underneath)
      map.current!.addLayer({
        id: outlineLayerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': routeSettings.shadowColor,
          'line-opacity': routeSettings.shadowOpacity,
          'line-width': routeSettings.lineWidth + 2,
          'line-blur': ROUTE_STYLES.SHADOW.BLUR,
          'line-translate': [
            ROUTE_STYLES.SHADOW.OFFSET_X,
            ROUTE_STYLES.SHADOW.OFFSET_Y,
          ],
        },
      });

      // Route line with stage color from database
      const stageColor = getStageColor(tourType, index);
      map.current!.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': stageColor,
          'line-width': routeSettings.lineWidth,
        },
      });
    });

    // Add stage boundary markers (small numbered dots at stage start/end)
    if (stageSegments.length > 1) {
      const stageMarkersData: {
        coordinates: [number, number];
        stageNumber: number;
        color: string;
      }[] = [];

      stageSegments.forEach((segment, index) => {
        if (index > 0) {
          // Add marker at start of each stage (except first)
          stageMarkersData.push({
            coordinates: segment[0],
            stageNumber: index + 1,
            color: getStageColor(tourType, index),
          });
        }
      });

      // Create markers using mapboxgl Marker
      stageMarkersData.forEach(({ coordinates, stageNumber, color }) => {
        // Create marker element
        const el = document.createElement('div');
        el.className = 'stage-marker';
        el.style.cssText = `
          width: 1.5rem;
          height: 1.5rem;
          background: ${color};
          border: 0.125rem solid #ffffff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.6875rem;
          font-weight: 700;
          color: #ffffff;
          box-shadow: 0 0.125rem 0.375rem rgba(0,0,0,0.3);
          cursor: default;
        `;
        el.textContent = String(stageNumber);

        // Add marker to map and save reference for cleanup
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat(coordinates)
          .addTo(map.current!);
        stageMarkersRef.current.push(marker);
      });
    }

    // Add invisible hover layer
    map.current.addSource('route-hover-source', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates },
      },
    });

    map.current.addLayer({
      id: 'route-hover',
      type: 'line',
      source: 'route-hover-source',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': 'transparent', 'line-width': 20 },
    });

    // Add route arrows
    if (map.current.hasImage('route-arrow')) {
      createArrowsSource(coordinates);
    }

    // Mouse move handler for route hover
    const handleMouseMove = (e: mapboxgl.MapMouseEvent) => {
      if (!route || !onPositionChange) return;

      const point: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const { distance, index } = getDistanceAlongRoute(point, route);

      // Show hover marker
      if (hoverMarkerRef.current) {
        hoverMarkerRef.current.setLngLat(point);
      } else {
        const el = document.createElement('div');
        el.className = 'hover-marker';
        el.style.cssText = `
          width: 1.25rem; height: 1.25rem; 
          background-color: #0b1215;
          border-radius: 50%;
          border: 0.125rem solid white;
          box-shadow: 0 0 0.3125rem rgba(46, 46, 46, 0.5);
          pointer-events: none;
        `;
        hoverMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat(point)
          .addTo(map.current!);
      }

      map.current!.getCanvas().style.cursor = 'pointer';
      onPositionChange({ lng: point[0], lat: point[1], distance, index });
    };

    const handleMouseLeave = () => {
      if (hoverMarkerRef.current) {
        hoverMarkerRef.current.remove();
        hoverMarkerRef.current = null;
      }
      map.current!.getCanvas().style.cursor = '';
    };

    // map.current.on('mousemove', 'route-hover', handleMouseMove);
    // map.current.on('mouseleave', 'route-hover', handleMouseLeave);

    // Update arrows on zoom - matching route.js
    const handleZoom = () => {
      if (
        routeCoordinatesRef.current.length > 0 &&
        map.current?.hasImage('route-arrow')
      ) {
        createArrowsSource(routeCoordinatesRef.current);
      }
    };

    map.current.on('zoomend', handleZoom);

    // Stage break markers for Silver/Bronze (commented out by user)
    // const markerColors = stageMarkerColors[tourType];
    //   const pointsPerStage = Math.ceil(coordinates.length / config.stages);

    //   for (let i = 1; i < config.stages; i++) {
    //     const breakIndex = Math.min(i * pointsPerStage, coordinates.length - 1);
    //     const breakPoint = coordinates[breakIndex];
    //     const markerColor = markerColors[(i - 1) % markerColors.length];

    //     const el = document.createElement('div');
    //     el.className = 'stage-marker';
    //     el.innerHTML = `
    //       <div style="
    //         position: relative;
    //         display: flex;
    //         flex-direction: column;
    //         align-items: center;
    //         cursor: pointer;
    //       ">
    //         <div class="stage-tooltip" style="
    //           position: absolute;
    //           bottom: 100%;
    //           left: 50%;
    //           transform: translateX(-50%) translateY(-0.25rem);
    //           background: ${markerColor};
    //           color: ${tourType === 'gold' ? '#000' : '#fff'};
    //           font-weight: bold;
    //           font-size: 0.6875rem;
    //           padding: 0.25rem 0.625rem;
    //           border-radius: 0.375rem;
    //           border: 0.125rem solid white;
    //           box-shadow: 0 0.125rem 0.5rem rgba(0,0,0,0.4);
    //           white-space: nowrap;
    //           opacity: 0;
    //           pointer-events: none;
    //           transition: opacity 0.2s ease, transform 0.2s ease;
    //         ">
    //           Stage ${i} → ${i + 1}
    //         </div>
    //         <div class="stage-dot" style="
    //           width: 1.25rem;
    //           height: 1.25rem;
    //           background: ${markerColor};
    //           border-radius: 50%;
    //           border: 0.1875rem solid white;
    //           box-shadow: 0 0.125rem 0.5rem rgba(0,0,0,0.4);
    //           display: flex;
    //           align-items: center;
    //           justify-content: center;
    //           font-size: 0.625rem;
    //           font-weight: bold;
    //           color: ${tourType === 'gold' ? '#000' : '#fff'};
    //         ">${i}</div>
    //       </div>
    //     `;

    //     el.addEventListener('mouseenter', () => {
    //       const tooltip = el.querySelector('.stage-tooltip') as HTMLElement;
    //       if (tooltip) {
    //         tooltip.style.opacity = '1';
    //         tooltip.style.transform = 'translateX(-50%) translateY(-0.5rem)';
    //       }
    //     });
    //     el.addEventListener('mouseleave', () => {
    //       const tooltip = el.querySelector('.stage-tooltip') as HTMLElement;
    //       if (tooltip) {
    //         tooltip.style.opacity = '0';
    //         tooltip.style.transform = 'translateX(-50%) translateY(-0.25rem)';
    //       }
    //     });

    //     const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
    //       .setLngLat(breakPoint)
    //       .addTo(map.current);
    //     stageMarkersRef.current.push(marker);
    //   }
    // }

    // Start marker - matching original design
    const startEl = document.createElement('div');
    startEl.className = 'marker start-marker';
    startEl.style.cssText = `
      width: 2.25rem;
      height: 2.25rem;
      will-change: transform;
    `;
    startEl.innerHTML = `
      <div style="
        background: #0b1215;
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 0.125rem solid #e0e0e0;
        box-shadow: 0 0.125rem 0.5rem rgba(8, 141, 149, 0.2);
        cursor: pointer;
        padding-left: 0.125rem;
      ">
        <i class="fa-solid fa-play" style="font-size: 0.875rem; color: #fff;"></i>
      </div>
    `;
    const startMarker = new mapboxgl.Marker({
      element: startEl,
      anchor: 'center',
      offset: [0, 0],
    })
      .setLngLat(route.startPoint)
      .addTo(map.current);
    markersRef.current.push(startMarker);

    // End marker
    const endEl = document.createElement('div');
    endEl.className = 'marker end-marker';
    endEl.style.cssText = `
      width: 2.25rem;
      height: 2.25rem;
      will-change: transform;
    `;
    endEl.innerHTML = `
      <div style="
        background: #0b1215;
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 0.125rem solid #e0e0e0;
        box-shadow: 0 0.125rem 0.5rem rgba(8, 141, 149, 0.2);
        cursor: pointer;
      ">
        <i class="fa-solid fa-flag-checkered" style="font-size: 0.875rem; color: #fff;"></i>
      </div>
    `;
    const endMarker = new mapboxgl.Marker({
      element: endEl,
      anchor: 'center',
      offset: [0, 0],
    })
      .setLngLat(route.endPoint)
      .addTo(map.current);
    markersRef.current.push(endMarker);

    // POI markers - using native Mapbox layers with clustering
    if (route.pois && route.pois.length > 0) {
      // Remove existing POI layers/source if they exist
      if (map.current.getLayer('poi-labels')) {
        map.current.removeLayer('poi-labels');
      }
      if (map.current.getLayer('poi-circles')) {
        map.current.removeLayer('poi-circles');
      }
      if (map.current.getLayer('cluster-circles')) {
        map.current.removeLayer('cluster-circles');
      }
      if (map.current.getLayer('cluster-count')) {
        map.current.removeLayer('cluster-count');
      }
      if (map.current.getSource('poi-source')) {
        map.current.removeSource('poi-source');
      }

      // Create GeoJSON features for POIs
      const poiFeatures: GeoJSON.Feature[] = route.pois.map((poi, index) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: poi.lngLat,
        },
        properties: {
          id: index,
          name: poi.name || '',
          type: poi.type || 'highlightNew',
          description: poi.description || '',
          poiIndex: index,
          // Map POI type to color
          color: POI_ICON_FALLBACK[poi.type || 'highlight']?.bg || '#eab308',
          // Map POI type to Maki icon name
          makiIcon:
            poi.type === 'hotel'
              ? 'hotelNew'
              : poi.type === 'restaurant'
                ? 'restaurantNew'
                : poi.type === 'gipfel'
                  ? 'mountainNew'
                  : 'starNew',
        },
      }));

      // Add POI source with clustering enabled
      map.current.addSource('poi-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: poiFeatures,
        },
        cluster: true,
        clusterMaxZoom: 14, // Max zoom to cluster points
        clusterRadius: 50, // Radius of each cluster when clustering points
      });

      // Add cluster circles layer
      map.current.addLayer({
        id: 'cluster-circles',
        type: 'circle',
        source: 'poi-source',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#000',
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            18, // 1.125rem radius for clusters with < 5 points
            5,
            22, // 1.375rem radius for clusters with 5-10 points
            10,
            28, // 1.75rem radius for clusters with 10+ points
          ],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Add cluster count label layer
      map.current.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'poi-source',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 14,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      // Add symbol layer for unclustered POI icons
      const loadImagePromise = (
        url: string,
        imageName: string
      ): Promise<void> => {
        return new Promise((resolve, reject) => {
          map.current?.loadImage(url, (error, image) => {
            if (error) {
              reject(error);
              return;
            }
            if (image && map.current && !map.current.hasImage(imageName)) {
              map.current.addImage(imageName, image);
            }
            resolve();
          });
        });
      };

      Promise.all([
        loadImagePromise(HighlightImage, 'highlightNew'),
        loadImagePromise(HotelImage, 'hotelNew'),
        loadImagePromise(RestaurantImage, 'lodgingNew'),
        loadImagePromise(RestaurantImage, 'restaurantNew'),
        loadImagePromise(RestaurantImage, 'restaurantNew'),
        loadImagePromise(SummitImage, 'mountainNew'),
        loadImagePromise(HighlightImage, 'starNew'),
      ])
        .then(() => {
          // Only add the layer after all images are loaded
          if (map.current && !map.current.getLayer('poi-labels')) {
            map.current.addLayer({
              id: 'poi-labels',
              type: 'symbol',
              source: 'poi-source',
              filter: ['!', ['has', 'point_count']], // Only show unclustered points
              layout: {
                'icon-image': ['get', 'makiIcon'],
                'icon-size': 0.03,
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
              },
              paint: {
                'icon-color': '#ffffff',
              },
            });
          }
        })
        .catch(error => {
          console.error('Error loading POI images:', error);
        });

      // Handle cluster click - zoom in to expand cluster
      map.current.on('click', 'cluster-circles', e => {
        const features = map.current!.queryRenderedFeatures(e.point, {
          layers: ['cluster-circles'],
        });
        if (!features.length) return;

        const clusterId = features[0].properties?.cluster_id;
        const source = map.current!.getSource(
          'poi-source'
        ) as mapboxgl.GeoJSONSource;

        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom === null || zoom === undefined) return;

          const geometry = features[0].geometry as GeoJSON.Point;
          map.current!.easeTo({
            center: geometry.coordinates as [number, number],
            zoom: zoom,
            duration: 500,
          });
        });
      });

      // Handle POI click events (unclustered points)
      map.current.on('click', 'poi-labels', e => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          const poiIndex = feature.properties?.poiIndex;
          if (poiIndex !== undefined && route.pois[poiIndex]) {
            onPoiClickRef.current?.(route.pois[poiIndex]);
          }
        }
      });

      // Change cursor on cluster hover
      map.current.on('mouseenter', 'cluster-circles', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = 'pointer';
        }
      });

      map.current.on('mouseleave', 'cluster-circles', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = '';
        }
      });

      // Change cursor on POI hover
      map.current.on('mouseenter', 'poi-labels', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = 'pointer';
        }
      });

      map.current.on('mouseleave', 'poi-labels', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = '';
        }
      });
    }

    // Fit bounds
    const allCoords = [...coordinates];
    if (route.pois) {
      route.pois.forEach(poi => allCoords.push(poi.lngLat));
    }

    const bounds = allCoords.reduce(
      (boundsObj, coord) => boundsObj.extend(coord as [number, number]),
      new mapboxgl.LngLatBounds(allCoords[0], allCoords[0])
    );

    const isMobile = window.innerWidth < 768;
    const padding = isMobile
      ? { top: 50, bottom: 50, left: 20, right: 20 }
      : { top: 50, bottom: 50, left: 50, right: 50 };

    map.current.fitBounds(bounds, {
      padding,
      maxZoom: 15,
      pitch: 45,
      bearing: 20,
      duration: 1500,
    });

    // Cleanup
    return () => {
      if (map.current) {
        map.current.off('mousemove', 'route-hover', handleMouseMove);
        map.current.off('mouseleave', 'route-hover', handleMouseLeave);
        map.current.off('zoomend', handleZoom);
      }
    };
  }, [
    route,
    tourType,
    isLoaded,
    onPositionChange,
    getDistanceAlongRoute,
    getStageSegments,
    createArrowsSource,
    routeSettings,
    getStageColor,
  ]);

  // Handle highlight position from elevation profile hover
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    if (highlightPosition) {
      if (highlightMarkerRef.current) {
        highlightMarkerRef.current.setLngLat([
          highlightPosition.lng,
          highlightPosition.lat,
        ]);
      } else {
        const el = document.createElement('div');
        el.className = 'highlight-marker';
        el.style.cssText = `
          width: 1rem; height: 1rem;
          background-color: #088D95;
          border-radius: 50%;
          border: 0.1875rem solid white;
          box-shadow: 0 0 0.5rem rgba(8, 141, 149, 0.6);
          pointer-events: none;
        `;
        highlightMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([highlightPosition.lng, highlightPosition.lat])
          .addTo(map.current);
      }
    } else {
      if (highlightMarkerRef.current) {
        highlightMarkerRef.current.remove();
        highlightMarkerRef.current = null;
      }
    }
  }, [highlightPosition, isLoaded]);

  // Cleanup markers on unmount
  useEffect(() => {
    return () => {
      hoverMarkerRef.current?.remove();
      highlightMarkerRef.current?.remove();
    };
  }, []);

  // Stage zoom animation - fly to selected stage
  useEffect(() => {
    if (
      !map.current ||
      !isLoaded ||
      !route ||
      selectedStage === null ||
      selectedStage === undefined
    )
      return;

    const config = stageConfig[tourType];

    // Only process if we have multiple stages and valid selection
    if (
      config.stages <= 1 ||
      selectedStage < 1 ||
      selectedStage > config.stages
    )
      return;

    // Get coordinates
    let coordinates: [number, number][];
    if (route.routeGeometry && route.routeGeometry.length > 0) {
      coordinates = route.routeGeometry;
    } else {
      coordinates = [route.startPoint, ...route.waypoints, route.endPoint] as [
        number,
        number,
      ][];
    }

    // Calculate stage segment
    const stageSegments = getStageSegments(
      coordinates,
      config.stages,
      tourType
    );
    const stageIndex = selectedStage - 1; // Convert to 0-indexed

    if (!stageSegments[stageIndex] || stageSegments[stageIndex].length === 0)
      return;

    const stageCoords = stageSegments[stageIndex];

    // Calculate bounds for this stage
    const bounds = stageCoords.reduce(
      (boundsObj, coord) => boundsObj.extend(coord as [number, number]),
      new mapboxgl.LngLatBounds(stageCoords[0], stageCoords[0])
    );

    // Animate to stage with smooth transition
    map.current.fitBounds(bounds, {
      padding: { top: 80, bottom: 120, left: 60, right: 60 },
      maxZoom: 14,
      pitch: 50,
      bearing: 10 + selectedStage * 15, // Slight bearing change per stage
      duration: 2000, // Smooth 2-second animation
      essential: true,
    });

    console.log(`[Map] Zooming to Stage ${selectedStage}`, {
      stageCoords: stageCoords.length,
      bounds: bounds.toArray(),
    });
  }, [selectedStage, tourType, route, isLoaded, getStageSegments]);

  // Fly to searched location
  useEffect(() => {
    if (!map.current || !isLoaded || !flyToLocation) return;

    map.current.flyTo({
      center: [flyToLocation.lng, flyToLocation.lat],
      zoom: 14,
      pitch: 45,
      bearing: 0,
      duration: 2000,
      essential: true,
    });
  }, [flyToLocation, isLoaded]);

  return (
    <div ref={mapContainer} className="w-full h-full min-h-[100%] relative" />
  );
}
