import mapboxgl from 'mapbox-gl';
import { useEffect, type MutableRefObject, type RefObject } from 'react';
import { getCategoryOrFallback } from '../../../constants/poiCategories';
import type { LngLat, Waypoint } from '../types';

interface UseMapMarkersArgs {
  map: MutableRefObject<mapboxgl.Map | null>;
  mapLoaded: boolean;
  markersRef: MutableRefObject<mapboxgl.Marker[]>;
  waypointListRef: RefObject<HTMLDivElement>;
  startPoint: LngLat | null;
  endPoint: LngLat | null;
  waypoints: Waypoint[];
  pois: any[];
  selectedWaypointIndex: number | null;
  setStartPoint: (p: LngLat) => void;
  setEndPoint: (p: LngLat) => void;
  setWaypoints: React.Dispatch<React.SetStateAction<Waypoint[]>>;
  setIsGpxRoute: (v: boolean) => void;
  setRouteGeometry: (v: null) => void;
  setElevationData: (v: null) => void;
  setSelectedWaypointIndex: (idx: number | null) => void;
  handlePoiEdit: (index: number) => void;
}

export function useMapMarkers(args: UseMapMarkersArgs) {
  const {
    map,
    mapLoaded,
    markersRef,
    waypointListRef,
    startPoint,
    endPoint,
    waypoints,
    pois,
    selectedWaypointIndex,
    setStartPoint,
    setEndPoint,
    setWaypoints,
    setIsGpxRoute,
    setRouteGeometry,
    setElevationData,
    setSelectedWaypointIndex,
    handlePoiEdit,
  } = args;

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
          '<i class="fa-solid fa-play" style="color: white; font-size: 0.75rem;"></i>';
        el.className = 'w-8 h-8 bg-green-500 rounded-full flex items-center justify-center border-2 border-white cursor-move pl-0.5';
        const marker = new mapboxgl.Marker({
          element: el,
          draggable: true,
        })
          .setLngLat(startPoint)
          .addTo(map.current);
        marker.on('dragend', () => {
          setIsGpxRoute(false);
          setRouteGeometry(null);
          setElevationData(null);
          setStartPoint([marker.getLngLat().lng, marker.getLngLat().lat]);
        });
        markersRef.current.push(marker);
      }

      // Waypoints
      waypoints.forEach((wp, index: number) => {
        const el = document.createElement('div');
        el.textContent = String(index + 1);
        el.setAttribute('data-waypoint-index', String(index));

        // Apply different styling based on selection state and mode
        const isSelected = selectedWaypointIndex === index;
        const isManual = wp.mode === 'manual';
        const baseClasses = isManual
          ? 'border-dashed bg-orange-500' // Manual mode: dashed border, orange color
          : 'bg-[#088d95]'; // Auto mode: solid border, teal color
        const selectedClasses = isSelected
          ? isManual
            ? 'w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center border-3 border-white border-dashed text-white text-xs font-bold cursor-pointer shadow-lg ring-2 ring-orange-300'
            : 'w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center border-3 border-white text-white text-xs font-bold cursor-pointer shadow-lg ring-2 ring-yellow-300'
          : `w-7 h-7 ${baseClasses} rounded-full flex items-center justify-center border-2 border-white text-white text-xs font-bold cursor-pointer`;
        el.className = selectedClasses;

        const marker = new mapboxgl.Marker({ element: el, draggable: true })
          .setLngLat(wp.lngLat)
          .addTo(map.current!);

        // Click handler for selection
        el.addEventListener('click', e => {
          e.stopPropagation(); // Prevent map click from firing

          // Set selected waypoint
          setSelectedWaypointIndex(index);

          // The waypoint is already visible on the map (the user just clicked
          // its marker), so avoid any camera movement. Previously we called
          // flyTo({zoom: 15}) here which caused a jarring "zoom out then back
          // in" swoop when the current zoom differed from 15.

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
          ] as LngLat;

          // Always clear stored geometry and recalculate route
          setIsGpxRoute(false);
          setRouteGeometry(null);
          setElevationData(null);
          setWaypoints(prev => {
            const newWp = [...prev];
            // Preserve the mode when updating position
            newWp[index] = { ...newWp[index], lngLat: draggedLngLat };
            return newWp;
          });
        });
        markersRef.current.push(marker);
      });

      // End marker
      if (endPoint) {
        const el = document.createElement('div');
        el.innerHTML =
          '<i class="fa-solid fa-flag-checkered" style="color: white; font-size: 0.75rem;"></i>';
        el.className = 'w-8 h-8 bg-red-500 rounded-full flex items-center justify-center border-2 border-white cursor-move';
        const marker = new mapboxgl.Marker({
          element: el,
          draggable: true,
        })
          .setLngLat(endPoint)
          .addTo(map.current!);
        marker.on('dragend', () => {
          setIsGpxRoute(false);
          setRouteGeometry(null);
          setElevationData(null);
          setEndPoint([marker.getLngLat().lng, marker.getLngLat().lat]);
        });
        markersRef.current.push(marker);
      }

      // POI markers with type-specific Font Awesome pill markers
      pois.forEach((poi: { type: string; lngLat: LngLat }) => {
        const el = document.createElement('div');
        const category = getCategoryOrFallback(poi.type);
        el.innerHTML = `
          <div style="position: relative;">
            <div style="position: absolute; width: 2.5rem; height: 0.9375rem; bottom: -0.5rem; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.3); border-radius: 50%; filter: blur(0.3125rem);"></div>
            <div style="width: 2.5rem; height: 2.5rem; background: ${category.color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 0.1875rem solid white; box-shadow: 0 0.125rem 0.5rem rgba(0,0,0,0.3); position: relative; z-index: 2;">
              <i class="fas ${category.faIcon}" style="color: white; font-size: 1rem;"></i>
            </div>
          </div>
        `;
        el.style.cursor = 'pointer';

        // Add click listener for editing
        el.addEventListener('click', e => {
          e.stopPropagation(); // Prevent map click
          handlePoiEdit(pois.indexOf(poi));
        });

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
}
