import { useEffect, useReducer, useRef } from 'react';
import type {
  ElevationSample,
  LngLat,
  RouteStats,
  Waypoint,
} from '../types';

// Snapshot of everything the user can undo/redo — every field the effects
// might overwrite is included, so restoring a snapshot doesn't leave the
// screen mid-recompute (e.g., preserves GPX geometry rather than triggering
// a Directions API re-fetch).
export interface EditorSnapshot {
  startPoint: LngLat | null;
  endPoint: LngLat | null;
  waypoints: Waypoint[];
  pois: any[];
  routeGeometry: LngLat[] | null;
  elevationData: ElevationSample[] | null;
  isGpxRoute: boolean;
  routeStats: RouteStats;
}

interface UseEditorHistoryArgs {
  // Current state (for reading into snapshots)
  startPoint: LngLat | null;
  endPoint: LngLat | null;
  waypoints: Waypoint[];
  pois: any[];
  routeGeometry: LngLat[] | null;
  elevationData: ElevationSample[] | null;
  isGpxRoute: boolean;
  routeStats: RouteStats;

  // Setters (for applying snapshots)
  setStartPoint: (v: LngLat | null) => void;
  setEndPoint: (v: LngLat | null) => void;
  setWaypoints: (v: Waypoint[]) => void;
  setPois: (v: any[]) => void;
  setRouteGeometry: (v: LngLat[] | null) => void;
  setElevationData: (v: ElevationSample[] | null) => void;
  setIsGpxRoute: (v: boolean) => void;
  setRouteStats: (v: RouteStats) => void;
  setSelectedWaypointIndex: (v: number | null) => void;
}

export interface UseEditorHistoryReturn {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const MAX_HISTORY = 50;
// Long enough for the async effect chain (Directions API → auto-elevation)
// to settle so the snapshot captures the final derived state, not an
// intermediate one. Shorter values would create multiple history entries
// per user action.
const SNAPSHOT_DEBOUNCE_MS = 1200;
// Slightly longer than the debounce so a snapshot triggered during an
// undo/redo apply doesn't slip through before the guard flips off.
const APPLY_GUARD_MS = 1500;

export function useEditorHistory(args: UseEditorHistoryArgs): UseEditorHistoryReturn {
  const {
    startPoint,
    endPoint,
    waypoints,
    pois,
    routeGeometry,
    elevationData,
    isGpxRoute,
    routeStats,
    setStartPoint,
    setEndPoint,
    setWaypoints,
    setPois,
    setRouteGeometry,
    setElevationData,
    setIsGpxRoute,
    setRouteStats,
    setSelectedWaypointIndex,
  } = args;

  const past = useRef<EditorSnapshot[]>([]);
  const future = useRef<EditorSnapshot[]>([]);
  const applying = useRef(false);
  const hasInitialized = useRef(false);

  // Force re-render when history stacks change (so canUndo/canRedo update).
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  // Keep a live ref of current state so debounced/timeout callbacks always
  // see the latest values, not the values from when the callback was created.
  const currentStateRef = useRef<EditorSnapshot>({
    startPoint,
    endPoint,
    waypoints,
    pois,
    routeGeometry,
    elevationData,
    isGpxRoute,
    routeStats,
  });
  currentStateRef.current = {
    startPoint,
    endPoint,
    waypoints,
    pois,
    routeGeometry,
    elevationData,
    isGpxRoute,
    routeStats,
  };

  // Take a snapshot after each user-input change, debounced so the async
  // effect chain (route drawing → elevation) can settle first. We only
  // trigger on user-input state (start/end/waypoints/pois), not on derived
  // state, but the snapshot is read at the debounce fire time so it captures
  // whatever derived values have settled by then.
  useEffect(() => {
    if (applying.current) return;

    const timer = setTimeout(() => {
      if (applying.current) return;
      const snap: EditorSnapshot = { ...currentStateRef.current };

      if (!hasInitialized.current) {
        // First snapshot on mount: seed past with the initial state so
        // undo has somewhere to go back to after the first action.
        past.current.push(snap);
        hasInitialized.current = true;
        forceUpdate();
        return;
      }

      // Skip if nothing meaningful changed since the last snapshot (by
      // reference — we always create new arrays/objects when state changes,
      // so ref equality is a good enough proxy).
      const last = past.current[past.current.length - 1];
      if (
        last &&
        last.startPoint === snap.startPoint &&
        last.endPoint === snap.endPoint &&
        last.waypoints === snap.waypoints &&
        last.pois === snap.pois &&
        last.routeGeometry === snap.routeGeometry
      ) {
        return;
      }

      past.current.push(snap);
      future.current = []; // New action invalidates redo history
      if (past.current.length > MAX_HISTORY) past.current.shift();
      forceUpdate();
    }, SNAPSHOT_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startPoint, endPoint, waypoints, pois]);

  const applySnapshot = (snap: EditorSnapshot) => {
    applying.current = true;
    // Order matters slightly — set isGpxRoute first so the drawing effect
    // sees the correct mode when other inputs land in the same render.
    setIsGpxRoute(snap.isGpxRoute);
    setStartPoint(snap.startPoint);
    setEndPoint(snap.endPoint);
    setWaypoints(snap.waypoints);
    setPois(snap.pois);
    setRouteGeometry(snap.routeGeometry);
    setElevationData(snap.elevationData);
    setRouteStats(snap.routeStats);
    // Clear any waypoint selection — indexes may no longer be meaningful
    // after a restore (waypoints array may have different length).
    setSelectedWaypointIndex(null);

    // Release the guard after the debounce window so the snapshot effect
    // doesn't push the restored state back onto the stack.
    setTimeout(() => {
      applying.current = false;
      forceUpdate();
    }, APPLY_GUARD_MS);
  };

  const undo = () => {
    // Need at least 2 entries: [initial, current]. Popping current takes
    // us back to initial.
    if (past.current.length < 2) return;
    const current = past.current.pop()!;
    future.current.push(current);
    const previous = past.current[past.current.length - 1];
    applySnapshot(previous);
    forceUpdate();
  };

  const redo = () => {
    if (future.current.length === 0) return;
    const next = future.current.pop()!;
    past.current.push(next);
    applySnapshot(next);
    forceUpdate();
  };

  // Keyboard shortcuts: Ctrl/Cmd+Z for undo, Ctrl/Cmd+Shift+Z (or Ctrl+Y)
  // for redo. Ignored when typing in a text field.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = document.activeElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    undo,
    redo,
    canUndo: past.current.length > 1,
    canRedo: future.current.length > 0,
  };
}
