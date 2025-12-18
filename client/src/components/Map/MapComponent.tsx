import mapboxgl from 'mapbox-gl';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { POI, Route } from '../../api';
import { POI_ICON_FALLBACK, ROUTE_STYLES } from '../../constants/routeStyles';

mapboxgl.accessToken =
  'pk.eyJ1IjoicHVuY2hpbmdtYW4iLCJhIjoiY2p1cjcyMmh2M3NpZDQ5bnEwMDV6ZTE1OSJ9.ef8y6l9fsKFMX91m_Rt2ng';

// Tour type stage configuration
type TourType = 'gold' | 'silver' | 'bronze';

// Stage marker colors (for stage break markers)
const stageMarkerColors: Record<TourType, string[]> = {
  gold: ['#FFD700'],
  silver: ['#C0C0C0', '#8A8A8A'],
  bronze: ['#CD7F32', '#B87333', '#A0522D'],
};

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
  onPositionChange?: (position: {
    lng: number;
    lat: number;
    distance: number;
    index: number;
  }) => void;
  onPoiClick?: (poi: POI) => void;
  isFullscreen?: boolean;
  highlightPosition?: { lng: number; lat: number } | null;
}

export default function MapComponent({
  route,
  tourType = 'gold',
  onPositionChange,
  onPoiClick,
  isFullscreen = false,
  highlightPosition,
}: MapComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const stageMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const hoverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const highlightMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const routeCoordinatesRef = useRef<[number, number][]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

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
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [10.57, 51.92],
      zoom: 10,
      pitch: 45,
      bearing: 20,
      attributionControl: false,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

    map.current.on('load', () => {
      createArrowImage();
      setIsLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [createArrowImage]);

  // Split route into stages based on tour type
  const getStageSegments = useCallback(
    (coordinates: [number, number][], numStages: number) => {
      const segments: [number, number][][] = [];
      const pointsPerStage = Math.ceil(coordinates.length / numStages);

      for (let i = 0; i < numStages; i++) {
        const start = i * pointsPerStage;
        const end = Math.min((i + 1) * pointsPerStage + 1, coordinates.length);
        segments.push(coordinates.slice(start, end));
      }

      return segments;
    },
    []
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
        number
      ][];
      console.log(
        '[Map] No routeGeometry, using waypoints:',
        coordinates.length,
        'points'
      );
    }
    routeCoordinatesRef.current = coordinates;

    const stageSegments = getStageSegments(coordinates, config.stages);

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

      // Route outline
      map.current!.addLayer({
        id: outlineLayerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ROUTE_STYLES.MAIN.OUTLINE_COLOR,
          'line-width':
            ROUTE_STYLES.MAIN.WIDTH + ROUTE_STYLES.MAIN.OUTLINE_WIDTH * 2,
        },
      });

      // Route line
      map.current!.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ROUTE_STYLES.MAIN.COLOR,
          'line-width': ROUTE_STYLES.MAIN.WIDTH,
        },
      });
    });

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
          width: 20px; height: 20px; 
          background-color: #0b1215;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 0 5px rgba(46, 46, 46, 0.5);
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

    map.current.on('mousemove', 'route-hover', handleMouseMove);
    map.current.on('mouseleave', 'route-hover', handleMouseLeave);

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

    // Stage break markers for Silver/Bronze
    const markerColors = stageMarkerColors[tourType];
    if (config.stages > 1) {
      const pointsPerStage = Math.ceil(coordinates.length / config.stages);

      for (let i = 1; i < config.stages; i++) {
        const breakIndex = Math.min(i * pointsPerStage, coordinates.length - 1);
        const breakPoint = coordinates[breakIndex];
        const markerColor = markerColors[(i - 1) % markerColors.length];

        const el = document.createElement('div');
        el.className = 'stage-marker';
        el.innerHTML = `
          <div style="
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
          ">
            <div class="stage-tooltip" style="
              position: absolute;
              bottom: 100%;
              left: 50%;
              transform: translateX(-50%) translateY(-4px);
              background: ${markerColor};
              color: ${tourType === 'gold' ? '#000' : '#fff'};
              font-weight: bold;
              font-size: 11px;
              padding: 4px 10px;
              border-radius: 6px;
              border: 2px solid white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.4);
              white-space: nowrap;
              opacity: 0;
              pointer-events: none;
              transition: opacity 0.2s ease, transform 0.2s ease;
            ">
              Stage ${i} → ${i + 1}
            </div>
            <div class="stage-dot" style="
              width: 20px;
              height: 20px;
              background: ${markerColor};
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.4);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              font-weight: bold;
              color: ${tourType === 'gold' ? '#000' : '#fff'};
            ">${i}</div>
          </div>
        `;

        el.addEventListener('mouseenter', () => {
          const tooltip = el.querySelector('.stage-tooltip') as HTMLElement;
          if (tooltip) {
            tooltip.style.opacity = '1';
            tooltip.style.transform = 'translateX(-50%) translateY(-8px)';
          }
        });
        el.addEventListener('mouseleave', () => {
          const tooltip = el.querySelector('.stage-tooltip') as HTMLElement;
          if (tooltip) {
            tooltip.style.opacity = '0';
            tooltip.style.transform = 'translateX(-50%) translateY(-4px)';
          }
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(breakPoint)
          .addTo(map.current);
        stageMarkersRef.current.push(marker);
      }
    }

    // Start marker - matching original design
    const startEl = document.createElement('div');
    startEl.className = 'marker start-marker';
    startEl.innerHTML = `
      <div style="
        background: #0b1215;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #e0e0e0;
        box-shadow: 0 2px 8px rgba(8, 141, 149, 0.2);
        cursor: pointer;
        padding-left: 2px;
      ">
        <i class="fa-solid fa-play" style="font-size: 14px; color: #fff;"></i>
      </div>
    `;
    const startMarker = new mapboxgl.Marker({ element: startEl })
      .setLngLat(route.startPoint)
      .addTo(map.current);
    markersRef.current.push(startMarker);

    // End marker
    const endEl = document.createElement('div');
    endEl.className = 'marker end-marker';
    endEl.innerHTML = `
      <div style="
        background: #0b1215;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #e0e0e0;
        box-shadow: 0 2px 8px rgba(8, 141, 149, 0.2);
        cursor: pointer;
      ">
        <i class="fa-solid fa-flag-checkered" style="font-size: 14px; color: #fff;"></i>
      </div>
    `;
    const endMarker = new mapboxgl.Marker({ element: endEl })
      .setLngLat(route.endPoint)
      .addTo(map.current);
    markersRef.current.push(endMarker);

    // POI markers using HTML-based markers - Round circle design
    if (route.pois && route.pois.length > 0) {
      route.pois.forEach(poi => {
        const fallback =
          POI_ICON_FALLBACK[poi.type || 'highlight'] ||
          POI_ICON_FALLBACK.highlight;

        const el = document.createElement('div');
        const size = 36;
        el.className = 'poi-marker';
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.backgroundColor = fallback.bg;
        el.style.border = '3px solid white';
        el.style.borderRadius = '50%';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        el.style.cursor = 'pointer';
        el.style.padding = '0';
        el.tabIndex = 0;

        // Add Font Awesome icon
        const iconEl = document.createElement('i');
        iconEl.className = `fas ${fallback.icon}`;
        iconEl.style.color = 'white';
        iconEl.style.fontSize = '14px';
        iconEl.style.pointerEvents = 'none';
        el.appendChild(iconEl);

        el.addEventListener('click', () => {
          onPoiClick?.(poi);
        });

        new mapboxgl.Marker(el)
          .setLngLat(poi.lngLat as [number, number])
          .addTo(map.current!);
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
    onPoiClick,
    onPositionChange,
    getDistanceAlongRoute,
    getStageSegments,
    createArrowsSource,
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
          width: 16px; height: 16px;
          background-color: #088D95;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 0 8px rgba(8, 141, 149, 0.6);
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

  return (
    <div
      ref={mapContainer}
      className={`w-full ${
        isFullscreen
          ? 'h-screen fixed inset-0 z-[999]'
          : 'h-full min-h-[100%] relative'
      }`}
    />
  );
}
