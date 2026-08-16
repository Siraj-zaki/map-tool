import mapboxgl from 'mapbox-gl';
import { useEffect, type MutableRefObject } from 'react';
import type {
  DrawingMode,
  EditMode,
  LngLat,
  SplitPointCallback,
  Waypoint,
} from '../types';

interface UseMapClickHandlerArgs {
  map: MutableRefObject<mapboxgl.Map | null>;
  mapLoaded: boolean;
  editMode: EditMode;
  startPoint: LngLat | null;
  endPoint: LngLat | null;
  waypoints: Waypoint[];
  drawingMode: DrawingMode;
  routeGeometry: LngLat[] | null;
  selectedWaypointIndex: number | null;
  splitPointCallbackRef: MutableRefObject<SplitPointCallback | null>;
  setSelectedWaypointIndex: (idx: number | null) => void;
  setEditMode: (mode: EditMode) => void;
  setStartPoint: (p: LngLat) => void;
  setEndPoint: (p: LngLat) => void;
  setWaypoints: React.Dispatch<React.SetStateAction<Waypoint[]>>;
  setRouteGeometry: (v: null) => void;
  setIsGpxRoute: (v: boolean) => void;
  setElevationData: (v: null) => void;
  setEditingPoiIndex: (v: number | null) => void;
  setPoiModalLngLat: (v: LngLat) => void;
  setPoiModalOpen: (v: boolean) => void;
}

export function useMapClickHandler(args: UseMapClickHandlerArgs) {
  const {
    map,
    mapLoaded,
    editMode,
    startPoint,
    endPoint,
    waypoints,
    drawingMode,
    routeGeometry,
    selectedWaypointIndex,
    splitPointCallbackRef,
    setSelectedWaypointIndex,
    setEditMode,
    setStartPoint,
    setEndPoint,
    setWaypoints,
    setRouteGeometry,
    setIsGpxRoute,
    setElevationData,
    setEditingPoiIndex,
    setPoiModalLngLat,
    setPoiModalOpen,
  } = args;

  // Handle map click
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      const coord: LngLat = [e.lngLat.lng, e.lngLat.lat];

      // Pan mode: map click does nothing (users can freely navigate)
      if (editMode === 'pan') {
        setSelectedWaypointIndex(null);
        return;
      }

      // Capture selection BEFORE clearing so we can insert after it in waypoint mode
      const insertionAnchor = selectedWaypointIndex;

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
        // Open POI Modal (Add new)
        setEditingPoiIndex(null);
        setPoiModalLngLat(coord);
        setPoiModalOpen(true);
      } else {
        // Waypoint mode - smart insertion between existing waypoints
        if (!startPoint) {
          setStartPoint(coord);
        } else if (!endPoint && waypoints.length === 0) {
          // No waypoints yet and no end point - add as first waypoint
          setRouteGeometry(null);
          setIsGpxRoute(false);
          // Store waypoint with current drawing mode
          setWaypoints([{ lngLat: coord, mode: drawingMode }]);
        } else {
          setIsGpxRoute(false);
          setRouteGeometry(null);
          setElevationData(null);

          if (insertionAnchor !== null && insertionAnchor < waypoints.length) {
            // A waypoint was selected → insert new waypoint immediately after it,
            // so sequential clicks continue the sequence from the selection
            // (e.g., selection is #78 → new becomes #79, next becomes #80).
            const insertAt = insertionAnchor + 1;
            setWaypoints(prev => {
              const next = [...prev];
              next.splice(insertAt, 0, { lngLat: coord, mode: drawingMode });
              return next;
            });
            // Advance selection to the newly added waypoint so successive
            // clicks keep inserting in order.
            setSelectedWaypointIndex(insertAt);
            console.log(
              `[Editor] Inserted waypoint at #${insertAt + 1} after selection #${insertionAnchor + 1} (mode: ${drawingMode})`
            );
          } else {
            // No selection → append to end. Sequential append is correct for
            // manual route building where users add points in order. (The old
            // "closest segment" insertion was broken for routes that loop near
            // themselves — it would insert a new point at the wrong position.)
            setWaypoints(prev => [...prev, { lngLat: coord, mode: drawingMode }]);
            console.log(
              `[Editor] Appended waypoint #${waypoints.length + 1} (mode: ${drawingMode})`
            );
          }
        }
      }
    };

    map.current.on('click', handleClick);
    return () => {
      map.current?.off('click', handleClick);
    };
  }, [mapLoaded, editMode, startPoint, endPoint, waypoints, drawingMode, selectedWaypointIndex]);
}
