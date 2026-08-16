import mapboxgl from 'mapbox-gl';
import { useEffect, type MutableRefObject } from 'react';

interface UseHighlightMarkerArgs {
  map: MutableRefObject<mapboxgl.Map | null>;
  mapLoaded: boolean;
  highlightPosition: { lng: number; lat: number } | null;
  highlightMarkerRef: MutableRefObject<mapboxgl.Marker | null>;
}

export function useHighlightMarker({
  map,
  mapLoaded,
  highlightPosition,
  highlightMarkerRef,
}: UseHighlightMarkerArgs) {
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
}
