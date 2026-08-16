import mapboxgl from 'mapbox-gl';
import { useState, type MutableRefObject, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import SplitPointEditor from '../../../components/SplitPointEditor/SplitPointEditor';
import type { RouteLocation } from '../../../api';
import type {
  EditMode,
  LngLat,
  RouteStats,
  SplitPointCallback,
  SplitPointsState,
  TourType,
  Waypoint,
} from '../types';
import POIsList from './POIsList';
import RoutePointsList from './RoutePointsList';
import RouteStatsPanel from './RouteStatsPanel';

interface EditorSidebarProps {
  map: MutableRefObject<mapboxgl.Map | null>;
  waypointListRef: RefObject<HTMLDivElement>;

  name: string;
  setName: (v: string) => void;

  setEditMode: (v: EditMode) => void;

  isEditing: boolean;
  id: string | undefined;
  routeGeometry: LngLat[] | null;
  routeStats: RouteStats;
  setRouteStats: React.Dispatch<React.SetStateAction<RouteStats>>;
  splitPoints: SplitPointsState;
  setSplitPoints: (v: SplitPointsState) => void;
  locations: RouteLocation[];
  selectedLocationId: number | null;
  setSelectedLocationId: (v: number | null) => void;
  splitPointCallbackRef: MutableRefObject<SplitPointCallback | null>;
  setSplitPointTourType: (v: TourType) => void;
  setSplitPointStageNumber: (v: number) => void;

  pois: any[];
  onPoiEdit: (index: number) => void;
  onPoiRemove: (index: number) => void;
  onPoiReorder: (fromIndex: number, toIndex: number) => void;

  startPoint: LngLat | null;
  endPoint: LngLat | null;
  waypoints: Waypoint[];
  selectedWaypointIndex: number | null;
  setStartPoint: (v: LngLat | null) => void;
  setEndPoint: (v: LngLat | null) => void;
  setSelectedWaypointIndex: (v: number | null) => void;
  setIsGpxRoute: (v: boolean) => void;
  setRouteGeometry: (v: null) => void;
  onRemoveWaypoint: (idx: number) => void;
}

export default function EditorSidebar(props: EditorSidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const {
    map,
    waypointListRef,
    name,
    setName,
    setEditMode,
    isEditing,
    id,
    routeGeometry,
    routeStats,
    setRouteStats,
    splitPoints,
    setSplitPoints,
    locations,
    selectedLocationId,
    setSelectedLocationId,
    splitPointCallbackRef,
    setSplitPointTourType,
    setSplitPointStageNumber,
    pois,
    onPoiEdit,
    onPoiRemove,
    onPoiReorder,
    startPoint,
    endPoint,
    waypoints,
    selectedWaypointIndex,
    setStartPoint,
    setEndPoint,
    setSelectedWaypointIndex,
    setIsGpxRoute,
    setRouteGeometry,
    onRemoveWaypoint,
  } = props;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        title={t('expand') || 'Expand panel'}
        className="absolute right-4 top-4 z-40 h-9 px-2.5 flex items-center gap-2 bg-[#080e11]/95 backdrop-blur-sm border border-[#1e2a33] rounded-lg shadow-2xl shadow-black/50 text-gray-300 hover:text-white hover:border-[#088d95] transition-all"
      >
        <i className="fas fa-chevron-left text-xs"></i>
        <span className="text-xs font-medium">
          {name || t('routeDetails') || 'Route details'}
        </span>
      </button>
    );
  }

  return (
    <div className="w-[19rem] bg-[#080e11] border-l border-[#1e2a33] flex flex-col shrink-0">
      {/* Header with collapse toggle */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1e2a33]">
        <span className="text-[0.7rem] uppercase tracking-widest text-gray-500 font-semibold">
          {t('routeDetails') || 'Route details'}
        </span>
        <button
          onClick={() => setCollapsed(true)}
          title={t('collapse') || 'Collapse panel'}
          className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-[#1e2a33] hover:text-white transition-all"
        >
          <i className="fas fa-chevron-right text-xs"></i>
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 p-3 flex flex-col gap-3 overflow-y-auto">
        {/* Route Name */}
        <div>
          <label className="text-[0.65rem] uppercase tracking-widest text-gray-500 font-semibold block mb-1.5">
            {t('routeName') || 'Route name'}
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('routeNamePlaceholder')}
            className="w-full px-3 py-2.5 bg-[#0b1215] border border-[#1e2a33] rounded-lg text-white placeholder-gray-500 focus:border-[#088d95] focus:outline-none text-sm"
          />
        </div>

        {/* Split Point Editor - temporarily disabled per new flow requirements */}
        {false && isEditing && routeGeometry && (
          <SplitPointEditor
            routeId={id ? Number(id) : null}
            routeGeometry={routeGeometry}
            totalDistance={routeStats.distance}
            onSetSplitPointMode={(
              active,
              tourType,
              stageNumber,
              callback
            ) => {
              if (active) {
                setEditMode('splitpoint');
                setSplitPointTourType(tourType);
                setSplitPointStageNumber(stageNumber);
                splitPointCallbackRef.current = callback;
              } else {
                setEditMode('waypoint');
                splitPointCallbackRef.current = null;
              }
            }}
            splitPoints={splitPoints}
            locations={locations}
            selectedLocationId={selectedLocationId}
            onSplitPointChange={setSplitPoints}
            onLocationChange={setSelectedLocationId}
          />
        )}

        {/* POIs Section */}
        <POIsList
          pois={pois}
          onEdit={onPoiEdit}
          onRemove={onPoiRemove}
          onReorder={onPoiReorder}
        />

        {/* Route Points */}
        <RoutePointsList
          ref={waypointListRef}
          map={map}
          startPoint={startPoint}
          endPoint={endPoint}
          waypoints={waypoints}
          distanceKm={routeStats.distance}
          selectedWaypointIndex={selectedWaypointIndex}
          setStartPoint={setStartPoint}
          setEndPoint={setEndPoint}
          setEditMode={setEditMode}
          setSelectedWaypointIndex={setSelectedWaypointIndex}
          setIsGpxRoute={setIsGpxRoute}
          setRouteGeometry={setRouteGeometry}
          onRemoveWaypoint={onRemoveWaypoint}
        />

        {/* Stats - Editable */}
        <RouteStatsPanel routeStats={routeStats} setRouteStats={setRouteStats} />

        {/* Back */}
        <button
          onClick={() => navigate('/admin')}
          className="mt-auto w-full flex items-center justify-center gap-2 py-2.5 border border-[#1e2a33] text-gray-400 hover:text-white hover:border-[#088d95] rounded-lg transition-all text-sm"
        >
          <i className="fas fa-arrow-left"></i> {t('back')}
        </button>
      </div>
    </div>
  );
}
