import mapboxgl from 'mapbox-gl';
import { useEffect, useRef, type RefObject } from 'react';
import {
  MAP_INITIAL_CENTER,
  MAP_INITIAL_ZOOM,
  MAP_STYLE,
} from '../constants';

interface UseMapInitArgs {
  mapContainer: RefObject<HTMLDivElement>;
  map: RefObject<mapboxgl.Map | null>;
  setMapLoaded: (loaded: boolean) => void;
}

export function useMapInit({ mapContainer, map, setMapLoaded }: UseMapInitArgs) {
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
      (map as { current: mapboxgl.Map | null }).current = new mapboxgl.Map({
        container: mapContainer.current,
        style: MAP_STYLE,
        center: MAP_INITIAL_CENTER,
        zoom: MAP_INITIAL_ZOOM,
      });

      map.current!.addControl(new mapboxgl.NavigationControl(), 'top-right');

      map.current!.on('load', () => {
        console.log('[Editor] Map loaded');

        // Only set state if still mounted
        if (mountedRef.current) {
          // 3. Enable terrain to make elevation data available
          map.current?.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
          setMapLoaded(true);
        }
      });

      map.current!.on('error', e => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Watch container size (sidebar collapse/expand doesn't trigger a window
  // resize, so mapbox-gl doesn't know its canvas grew until the user resizes
  // the window). A ResizeObserver keeps the map in sync with its container.
  useEffect(() => {
    const container = mapContainer.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      map.current?.resize();
    });
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
