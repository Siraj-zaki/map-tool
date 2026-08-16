import mapboxgl from 'mapbox-gl';
import { forwardRef, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { EditMode, LngLat, Waypoint } from '../types';

interface RoutePointsListProps {
  map: MutableRefObject<mapboxgl.Map | null>;
  startPoint: LngLat | null;
  endPoint: LngLat | null;
  waypoints: Waypoint[];
  distanceKm: number;
  selectedWaypointIndex: number | null;
  setStartPoint: (v: LngLat | null) => void;
  setEndPoint: (v: LngLat | null) => void;
  setEditMode: (v: EditMode) => void;
  setSelectedWaypointIndex: (v: number | null) => void;
  setIsGpxRoute: (v: boolean) => void;
  setRouteGeometry: (v: null) => void;
  onRemoveWaypoint: (idx: number) => void;
}

const RoutePointsList = forwardRef<HTMLDivElement, RoutePointsListProps>(
  function RoutePointsList(
    {
      map,
      startPoint,
      endPoint,
      waypoints,
      distanceKm,
      selectedWaypointIndex,
      setStartPoint,
      setEndPoint,
      setEditMode,
      setSelectedWaypointIndex,
      setIsGpxRoute,
      setRouteGeometry,
      onRemoveWaypoint,
    },
    ref
  ) {
    const { t } = useTranslation();
    return (
      <div className="bg-[#0b1215] border border-[#1e2a33] rounded-lg p-3">
        <h4 className="text-[#088d95] text-xs uppercase mb-2 font-semibold">
          {t('routePoints')}
        </h4>

        <div ref={ref} className="max-h-[18.75rem] overflow-y-auto">
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

                // Pan to waypoint on map. Use easeTo (linear) instead of
                // flyTo — flyTo's cinematic curve zooms out then back in for
                // far distances, which reads as "map goes out and back again".
                if (map.current) {
                  const currentZoom = map.current.getZoom();
                  map.current.easeTo({
                    center: wp.lngLat,
                    // Only zoom in if we're currently too far out; never zoom
                    // out from where the user was.
                    zoom: currentZoom < 14 ? 15 : currentZoom,
                    duration: 600,
                    essential: true,
                  });
                }
              }}
              className={`flex justify-between items-center py-1.5 border-b border-[#1e2a33] cursor-pointer transition-all ${selectedWaypointIndex === idx
                ? 'bg-yellow-500/20 border-l-2 border-l-yellow-500 pl-2'
                : 'hover:bg-[#1e2a33]/50'
                }`}
            >
              <span className="text-sm text-white flex items-center gap-2">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[0.6875rem] font-bold ${
                    selectedWaypointIndex === idx
                      ? 'bg-yellow-500'
                      : wp.mode === 'manual'
                      ? 'bg-orange-500 border border-dashed border-white'
                      : 'bg-[#088d95]'
                  }`}
                >
                  {idx + 1}
                </span>
                {t('waypoint')} {idx + 1}
                {wp.mode === 'manual' && (
                  <i className="fas fa-pen text-orange-500 text-xs" title="Direct line"></i>
                )}
              </span>
              <button
                onClick={e => {
                  e.stopPropagation(); // Prevent selection when clicking delete
                  // Clear GPX mode since we're modifying the route
                  setIsGpxRoute(false);
                  setRouteGeometry(null);
                  onRemoveWaypoint(idx);
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

          <h3 className="text-white text-lg font-bold">
            {distanceKm.toFixed(1)} km
          </h3>
        </div>
      </div>
    );
  }
);

export default RoutePointsList;
