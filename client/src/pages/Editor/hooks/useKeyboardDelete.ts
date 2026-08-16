import { useEffect } from 'react';
import type { Waypoint } from '../types';

interface UseKeyboardDeleteArgs {
  selectedWaypointIndex: number | null;
  setSelectedWaypointIndex: (idx: number | null) => void;
  setIsGpxRoute: (v: boolean) => void;
  setRouteGeometry: (v: null) => void;
  setWaypoints: React.Dispatch<React.SetStateAction<Waypoint[]>>;
}

export function useKeyboardDelete({
  selectedWaypointIndex,
  setSelectedWaypointIndex,
  setIsGpxRoute,
  setRouteGeometry,
  setWaypoints,
}: UseKeyboardDeleteArgs) {
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
}
