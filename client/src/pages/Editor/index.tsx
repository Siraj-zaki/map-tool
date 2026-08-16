import mapboxgl from 'mapbox-gl';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  routesApi,
  type Route,
  type RouteLocation,
  type SplitPoint,
} from '../../api';
import ElevationProfile from '../../components/ElevationProfile/ElevationProfileVisx';
import POIModal, { type POIData } from '../../components/POI/POIModal';
import { useColorSettings } from '../../contexts/ColorSettingsContext';
import { getMapboxElevation } from '../../utils/elevationMapbox';
// Register the mapbox access token (side effect)
import './constants';
import { citiesList } from './constants';
import EditorSidebar from './components/EditorSidebar';
import EditorToolbar from './components/EditorToolbar';
import LoadingOverlay from './components/LoadingOverlay';
import MapActivityIndicator from './components/MapActivityIndicator';
import ModeInfoOverlay from './components/ModeInfoOverlay';
import ShortcutsDialog from './components/ShortcutsDialog';
import { handleGPXUpload } from './handlers/handleGPXUpload';
import { useAuthCheck } from './hooks/useAuthCheck';
import { useAutoElevation } from './hooks/useAutoElevation';
import { useEditorHistory } from './hooks/useEditorHistory';
import { useEditorShortcuts } from './hooks/useEditorShortcuts';
import { useHighlightMarker } from './hooks/useHighlightMarker';
import { useKeyboardDelete } from './hooks/useKeyboardDelete';
import { useLoadRoute } from './hooks/useLoadRoute';
import { useMapClickHandler } from './hooks/useMapClickHandler';
import { useMapInit } from './hooks/useMapInit';
import { useMapMarkers } from './hooks/useMapMarkers';
import { useRouteDrawing } from './hooks/useRouteDrawing';
import type {
  AlternativeRoute,
  DrawingMode,
  EditMode,
  ElevationSample,
  LngLat,
  RouteStats,
  RoutingProfile,
  SplitPointCallback,
  SplitPointsState,
  TourType,
  Waypoint,
} from './types';

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { routeSettings } = useColorSettings();
  const isEditing = Boolean(id);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const gpxInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  const [startPoint, setStartPoint] = useState<LngLat | null>(null);
  const [endPoint, setEndPoint] = useState<LngLat | null>(null);
  // Updated waypoints to track routing mode for each point
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  // Drawing mode: 'auto' snaps to trails, 'manual' draws direct lines
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('auto');
  const [routeGeometry, setRouteGeometry] = useState<LngLat[] | null>(null);
  // Track if route came from GPX upload (to skip Directions API calls)
  const [isGpxRoute, setIsGpxRoute] = useState(false);
  // Store elevation data for persistence (avoids repeated API calls)
  const [elevationData, setElevationData] = useState<ElevationSample[] | null>(
    null
  );
  // Alternative routes from Directions API
  const [, setAlternativeRoutes] = useState<AlternativeRoute[]>([]);
  const [pois, setPois] = useState<any[]>([]);
  const [editMode, setEditMode] = useState<EditMode>('start');

  // Drawing mode labels
  const drawingModeLabels: Record<DrawingMode, string> = {
    auto: t('snapToTrail') || 'Snap to Trail',
    manual: t('directLine') || 'Direct Line',
  };
  // Silence unused warning (kept for future use)
  void drawingModeLabels;

  // Routing profile state (Fix for picking up trails)
  const [routingProfile] = useState<RoutingProfile>('walking');

  // Split point selection state
  const [_splitPointTourType, setSplitPointTourType] = useState<TourType>('silver');
  const [_splitPointStageNumber, setSplitPointStageNumber] = useState<number>(1);
  const splitPointCallbackRef = useRef<SplitPointCallback | null>(null);

  // POI Modal state
  const [poiModalOpen, setPoiModalOpen] = useState(false);
  const [poiModalLngLat, setPoiModalLngLat] = useState<LngLat>([0, 0]);
  const [editingPoiIndex, setEditingPoiIndex] = useState<number | null>(null);

  // Shortcuts help dialog
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const [routeStats, setRouteStats] = useState<RouteStats>({
    distance: 0,
    duration: 0,
    highestPoint: 0,
    lowestPoint: 0,
    totalAscent: 0,
    totalDescent: 0,
  });

  // Split points state
  const [splitPoints, setSplitPoints] = useState<SplitPointsState>({
    gold: [],
    silver: [],
    bronze: [],
  });

  // Start Location state for Dynamic Splitting
  const [selectedCity, setSelectedCity] = useState(citiesList[0]);
  const [locations, setLocations] = useState<RouteLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  // Silence unused warnings (kept for future use in commented-out UI section)
  void selectedCity;
  void setSelectedCity;

  // Bi-directional sync between map and elevation profile
  // Note: highlightDistance is used for map→elevation sync (not yet implemented in Editor's ad-hoc map)
  // For now we only have elevation→map sync via highlightPosition
  const [highlightDistance] = useState<number | undefined>();
  const [highlightPosition, setHighlightPosition] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const highlightMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // Selected waypoint state for click selection and keyboard delete
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState<
    number | null
  >(null);
  const waypointListRef = useRef<HTMLDivElement>(null);

  // Elevation calculation state - only calculate when user clicks button or saves
  const [calculatingElevation, setCalculatingElevation] = useState(false);
  // True while useRouteDrawing is fetching from the Mapbox Directions API
  const [routingLoading, setRoutingLoading] = useState(false);

  // Mode labels for info overlay
  const modeLabels: Record<string, string> = {
    pan: t('panMode') || 'Pan mode — drag the map to navigate',
    start: t('clickToSetStart'),
    waypoint: t('clickToAddWaypoint'),
    end: t('clickToSetEnd'),
    poi: t('clickToAddPoi'),
    splitpoint:
      t('clickToSetSplitPoint') || 'Click on route to set stage boundary',
  };

  // ================== Handlers (defined first because effects reference them) ==================

  const handlePoiEdit = (index: number) => {
    setEditingPoiIndex(index);
    setPoiModalLngLat(pois[index].lngLat);
    setPoiModalOpen(true);
  };

  // ================== Effects (custom hooks) ==================

  useAuthCheck();

  useMapInit({ mapContainer, map, setMapLoaded });

  useMapClickHandler({
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
  });

  useMapMarkers({
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
  });

  useRouteDrawing({
    map,
    mapLoaded,
    startPoint,
    endPoint,
    waypoints,
    routeGeometry,
    isGpxRoute,
    routeSettings,
    routingProfile,
    setRouteGeometry,
    setElevationData,
    setRouteStats,
    setAlternativeRoutes,
    setRoutingLoading,
  });

  useLoadRoute({
    id,
    mapLoaded,
    setLoading,
    setName,
    setDescription,
    setStartPoint,
    setEndPoint,
    setWaypoints,
    setRouteGeometry,
    setElevationData,
    setIsGpxRoute,
    setPois,
    setRouteStats,
    setEditMode,
    setLocations,
    setSplitPoints,
  });

  useKeyboardDelete({
    selectedWaypointIndex,
    setSelectedWaypointIndex,
    setIsGpxRoute,
    setRouteGeometry,
    setWaypoints,
  });

  useHighlightMarker({
    map,
    mapLoaded,
    highlightPosition,
    highlightMarkerRef,
  });

  useAutoElevation({
    map,
    mapLoaded,
    routeGeometry,
    isGpxRoute,
    elevationData,
    calculatingElevation,
    setCalculatingElevation,
    setElevationData,
    setRouteStats,
  });

  const { undo, redo, canUndo, canRedo } = useEditorHistory({
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
  });

  // ================== Remaining handlers ==================

  // Handler for elevation profile hover - updates map marker
  const handleElevationPositionChange = (
    pos: {
      lng: number;
      lat: number;
      distance: number;
      elevation: number;
      grade: number;
    } | null
  ) => {
    if (pos) {
      setHighlightPosition({ lng: pos.lng, lat: pos.lat });
    } else {
      setHighlightPosition(null);
    }
  };

  // Handler for POI click on elevation profile - zoom to POI on map
  const handlePoiClickFromProfile = ({
    lngLat,
  }: {
    lngLat: LngLat;
    name: string;
  }) => {
    if (!lngLat) return;

    // Pan to location. Use easeTo (linear) instead of flyTo — flyTo's
    // cinematic curve zooms out then back in for far distances.
    if (map.current) {
      const currentZoom = map.current.getZoom();
      map.current.easeTo({
        center: lngLat,
        zoom: currentZoom < 15 ? 16 : currentZoom,
        duration: 600,
        essential: true,
      });
    }

    // Open POI modal using coordinates to find the POI
    const poiIndex = pois.findIndex(p => {
      // Normalize p.lngLat which might be array or object
      let pLng, pLat;
      if (Array.isArray(p.lngLat)) {
        pLng = p.lngLat[0];
        pLat = p.lngLat[1];
      } else {
        pLng = p.lngLat.lng;
        pLat = p.lngLat.lat;
      }
      return (
        Math.abs(pLng - lngLat[0]) < 0.00001 &&
        Math.abs(pLat - lngLat[1]) < 0.00001
      );
    });

    if (poiIndex >= 0) {
      setPoiModalLngLat(lngLat);
      setPoiModalOpen(true);
    }
  };

  // Calculate elevation data manually (called from button or before save)
  const calculateElevation = async () => {
    // If we already have accurate elevation data from GPX, don't overwrite it
    // GPX data from Komoot/Strava is more accurate than Mapbox DEM
    if (elevationData && elevationData.length > 0 && isGpxRoute) {
      console.log(
        '[Editor] Using existing GPX elevation data, skipping Mapbox calculation'
      );
      return;
    }

    if (!routeGeometry || routeGeometry.length === 0) {
      alert('Please create a route first');
      return;
    }

    if (!map.current) {
      alert('Map not ready. Please try again.');
      return;
    }

    setCalculatingElevation(true);
    try {
      console.log(
        '[Editor] Calculating elevation using Mapbox for',
        routeGeometry.length,
        'coordinates'
      );
      const elevResult = await getMapboxElevation(map.current, routeGeometry);
      console.log('[Editor] Elevation data:', elevResult);

      // Use pre-computed elevationData with real Haversine distances & coordinates
      setElevationData(elevResult.elevationData);

      setRouteStats(prev => ({
        ...prev,
        distance: elevResult.totalDistanceKm || prev.distance,
        highestPoint: elevResult.highestPoint,
        lowestPoint: elevResult.lowestPoint,
        totalAscent: elevResult.totalAscent,
        totalDescent: elevResult.totalDescent,
      }));

      console.log('[Editor] Elevation calculated successfully');
    } catch (error) {
      console.error('[Editor] Failed to calculate elevation:', error);
      alert(
        'Failed to calculate elevation data. Please ensure the map terrain is loaded.'
      );
    } finally {
      setCalculatingElevation(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Route name is required');
      return;
    }
    if (!startPoint || !endPoint) {
      alert('Please set start and end points');
      return;
    }
    if (!routeGeometry || routeGeometry.length === 0) {
      alert('Please wait for route to be calculated');
      return;
    }

    setSaving(true);
    try {
      // Calculate elevation if not already done
      let finalElevationData = elevationData;
      let finalRouteStats = { ...routeStats };

      if (!elevationData || elevationData.length === 0) {
        console.log(
          '[Editor] Calculating elevation using Mapbox before save...'
        );

        if (!map.current) {
          alert('Map not ready. Cannot save without elevation data.');
          return;
        }

        const elevResult = await getMapboxElevation(map.current, routeGeometry);

        // Use pre-computed elevationData with real Haversine distances
        finalElevationData = elevResult.elevationData;

        // Always use freshly calculated stats — no stale preservation
        finalRouteStats = {
          ...routeStats,
          distance: elevResult.totalDistanceKm || routeStats.distance,
          highestPoint: elevResult.highestPoint,
          lowestPoint: elevResult.lowestPoint,
          totalAscent: elevResult.totalAscent,
          totalDescent: elevResult.totalDescent,
        };

        console.log('[Editor] Saving with stats:', finalRouteStats);

        // Update state for future reference
        setElevationData(finalElevationData);
        setRouteStats(finalRouteStats);
      }

      const routeData = {
        name,
        description,
        startPoint,
        endPoint,
        routeGeometry,
        elevationData: finalElevationData, // Use calculated elevation data
        waypoints,
        pois: pois.map(p => ({
          name: p.name,
          description: p.description,
          lngLat: p.lngLat,
          type: p.type,
          best_time: p.bestTime || p.best_time,
          images: p.images || [],
          amenities: p.amenities || [],
          metadata: p.metadata ?? null,
        })),
        distance: finalRouteStats.distance,
        duration: finalRouteStats.duration * 60,
        highestPoint: finalRouteStats.highestPoint,
        lowestPoint: finalRouteStats.lowestPoint,
        totalAscent: finalRouteStats.totalAscent,
        totalDescent: finalRouteStats.totalDescent,
      } as any;
      if (isEditing) await routesApi.update(Number(id), routeData);
      else await routesApi.create(routeData);
      navigate('/admin');
    } catch (error) {
      console.error('Failed to save route:', error);
      alert('Failed to save route');
    } finally {
      setSaving(false);
    }
  };

  const clearRoute = () => {
    setStartPoint(null);
    setEndPoint(null);
    setWaypoints([]);
    setPois([]);
    setRouteGeometry(null);
    setElevationData(null); // Clear stored elevation data
    setIsGpxRoute(false);
    setRouteStats({
      distance: 0,
      duration: 0,
      highestPoint: 0,
      lowestPoint: 0,
      totalAscent: 0,
      totalDescent: 0,
    });
    setEditMode('start');
    if (map.current?.getLayer('route')) map.current.removeLayer('route');
    if (map.current?.getSource('route')) map.current.removeSource('route');
  };

  const removeWaypoint = (index: number) =>
    setWaypoints(prev => prev.filter((_, i) => i !== index));
  const removePoi = (index: number) =>
    setPois(prev => prev.filter((_, i) => i !== index));
  const reorderPoi = (from: number, to: number) =>
    setPois(prev => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });

  const handlePOISave = (poiData: POIData) => {
    if (editingPoiIndex !== null) {
      // Edit existing
      setPois(prev => {
        const newPois = [...prev];
        newPois[editingPoiIndex] = { ...poiData, id: prev[editingPoiIndex].id };
        return newPois;
      });
    } else {
      // Create new
      setPois(prev => [...prev, { ...poiData, id: Date.now() } as any]);
    }
    setPoiModalOpen(false);
    setEditMode('waypoint');
    setEditingPoiIndex(null);
  };

  const onGPXUpload = (event: React.ChangeEvent<HTMLInputElement>) =>
    handleGPXUpload(event, {
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
    });

  // Keyboard shortcuts (V/S/E/W/P for modes, A/D for routing, ⌘S save, etc.)
  useEditorShortcuts({
    setEditMode,
    setDrawingMode,
    onSave: handleSave,
    onClear: clearRoute,
    onCalculateElevation: calculateElevation,
    gpxInputRef,
    openShortcutsDialog: () => setShortcutsOpen(true),
  });

  return (
    <div className="h-screen flex flex-col bg-[#0b1215] relative">
      {/* Loading Overlay - shown OVER the map instead of replacing it */}
      <LoadingOverlay visible={loading} />

      {/* Mode Info Overlay */}
      <ModeInfoOverlay editMode={editMode} modeLabels={modeLabels} />

      <div className="flex flex-1 overflow-hidden">
        {/* Map + Elevation */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 relative min-h-[18.75rem]">
            <div
              ref={mapContainer}
              className="absolute h-[100%]  inset-0 z-10"
            />

            {/* Non-blocking activity chip (routing / elevation) */}
            <MapActivityIndicator
              routing={routingLoading}
              calculatingElevation={calculatingElevation}
            />

            {/* Floating Left Toolbar (overlays the map) */}
            <EditorToolbar
              editMode={editMode}
              setEditMode={setEditMode}
              drawingMode={drawingMode}
              setDrawingMode={setDrawingMode}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              saving={saving}
              calculatingElevation={calculatingElevation}
              routeGeometry={routeGeometry}
              elevationData={elevationData}
              gpxInputRef={gpxInputRef}
              onSave={handleSave}
              onClear={clearRoute}
              onCalculateElevation={calculateElevation}
              onGPXUpload={onGPXUpload}
              onShowShortcuts={() => setShortcutsOpen(true)}
            />
          </div>

          {/* Elevation Profile */}
          <div className="h-[12.5rem] bg-[#080e11] border-t border-[#1e2a33]">
            {startPoint && endPoint ? (
              <ElevationProfile
                route={
                  {
                    id: id ? Number(id) : 0,
                    name,
                    description,
                    startPoint,
                    endPoint,
                    waypoints,
                    routeGeometry: routeGeometry || undefined,
                    elevationData: elevationData || undefined, // Pass stored elevation data
                    distance: routeStats.distance,
                    duration: routeStats.duration * 60,
                    highestPoint: routeStats.highestPoint,
                    lowestPoint: routeStats.lowestPoint,
                    totalAscent: routeStats.totalAscent,
                    totalDescent: routeStats.totalDescent,
                    pois: pois.map((p, i) => ({
                      poi_id: i,
                      name: p.name || `POI ${i + 1}`,
                      lngLat: p.lngLat,
                      type: p.type,
                      images: p.images || [],
                      amenities: p.amenities || [],
                    })),
                  } as Route
                }
                pois={pois.map((p, i) => ({
                  poi_id: i,
                  name: p.name || `POI ${i + 1}`,
                  lngLat: p.lngLat,
                  type: p.type,
                  images: p.images || [],
                  amenities: p.amenities || [],
                }))}
                onPositionChange={handleElevationPositionChange}
                highlightDistance={highlightDistance}
                onPoiClick={poi =>
                  handlePoiClickFromProfile({
                    lngLat: poi.lngLat,
                    name: poi.name,
                  })
                }
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                {t('setStartEndHint')}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <EditorSidebar
          map={map}
          waypointListRef={waypointListRef}
          name={name}
          setName={setName}
          setEditMode={setEditMode}
          isEditing={isEditing}
          id={id}
          routeGeometry={routeGeometry}
          routeStats={routeStats}
          setRouteStats={setRouteStats}
          splitPoints={splitPoints}
          setSplitPoints={setSplitPoints}
          locations={locations}
          selectedLocationId={selectedLocationId}
          setSelectedLocationId={setSelectedLocationId}
          splitPointCallbackRef={splitPointCallbackRef}
          setSplitPointTourType={setSplitPointTourType}
          setSplitPointStageNumber={setSplitPointStageNumber}
          pois={pois}
          onPoiEdit={handlePoiEdit}
          onPoiRemove={removePoi}
          onPoiReorder={reorderPoi}
          startPoint={startPoint}
          endPoint={endPoint}
          waypoints={waypoints}
          selectedWaypointIndex={selectedWaypointIndex}
          setStartPoint={setStartPoint}
          setEndPoint={setEndPoint}
          setSelectedWaypointIndex={setSelectedWaypointIndex}
          setIsGpxRoute={setIsGpxRoute}
          setRouteGeometry={setRouteGeometry as unknown as (v: null) => void}
          onRemoveWaypoint={removeWaypoint}
        />
      </div>

      {/* Keyboard Shortcuts Dialog */}
      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {/* POI Modal */}
      <POIModal
        isOpen={poiModalOpen}
        lngLat={poiModalLngLat}
        editingPoi={
          editingPoiIndex !== null
            ? pois[editingPoiIndex]
            : pois.find(
              p =>
                p.lngLat[0] === poiModalLngLat[0] &&
                p.lngLat[1] === poiModalLngLat[1]
            )
        }
        onSave={handlePOISave}
        onClose={() => {
          setPoiModalOpen(false);
          setEditMode('waypoint');
        }}
      />
    </div>
  );
}
