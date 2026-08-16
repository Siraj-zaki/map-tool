import mapboxgl from 'mapbox-gl';
import type { MutableRefObject } from 'react';
import type { RouteSettings } from '../../../api';
import {
  getGPXRouteName,
  parseGPX,
  processGPXToRoute,
  processGPXWithAccurateStats,
} from '../../../utils/gpxParser';
import type {
  EditMode,
  ElevationSample,
  LngLat,
  RouteStats,
  Waypoint,
} from '../types';

interface GPXUploadDeps {
  map: MutableRefObject<mapboxgl.Map | null>;
  markersRef: MutableRefObject<mapboxgl.Marker[]>;
  gpxInputRef: MutableRefObject<HTMLInputElement | null>;
  name: string;
  routeSettings: RouteSettings;
  setIsGpxRoute: (v: boolean) => void;
  setStartPoint: (v: LngLat) => void;
  setEndPoint: (v: LngLat) => void;
  setWaypoints: React.Dispatch<React.SetStateAction<Waypoint[]>>;
  setRouteGeometry: (v: LngLat[] | null) => void;
  setPois: (v: any[]) => void;
  setElevationData: (v: ElevationSample[]) => void;
  setName: (v: string) => void;
  setRouteStats: React.Dispatch<React.SetStateAction<RouteStats>>;
  setEditMode: (v: EditMode) => void;
}

export async function handleGPXUpload(
  event: React.ChangeEvent<HTMLInputElement>,
  deps: GPXUploadDeps
) {
  const {
    map,
    markersRef,
    gpxInputRef,
    name,
    routeSettings,
    setIsGpxRoute,
    setStartPoint,
    setEndPoint,
    setWaypoints,
    setRouteGeometry,
    setPois,
    setElevationData,
    setName,
    setRouteStats,
    setEditMode,
  } = deps;

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
    // Wrap GPX waypoints with default 'auto' mode for backward compatibility
    setWaypoints(routeData.waypoints.map((wp: LngLat) => ({
      lngLat: wp,
      mode: 'auto' as const
    })));
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
        '<i class="fa-solid fa-play" style="color: white; font-size: 0.75rem;"></i>';
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
      routeData.waypoints.forEach((wp: LngLat, index: number) => {
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
            // Preserve mode (auto) when updating position
            newWp[index] = { lngLat: [marker.getLngLat().lng, marker.getLngLat().lat], mode: 'auto' };
            return newWp;
          });
        });
        markersRef.current.push(marker);
      });

      // End marker
      const endEl = document.createElement('div');
      endEl.innerHTML =
        '<i class="fa-solid fa-flag-checkered" style="color: white; font-size: 0.75rem;"></i>';
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

    // Note: a second fitBounds using only start/end/waypoints used to run
    // here. It fought with the fitBounds above (which uses all coordinates)
    // and caused the map to "zoom out then back in" right after upload.
    setEditMode('waypoint');
  } catch (error) {
    alert(
      `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
  if (gpxInputRef.current) gpxInputRef.current.value = '';
}
