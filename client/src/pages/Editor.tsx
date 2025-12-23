import mapboxgl from 'mapbox-gl';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  authApi,
  getDirections,
  getElevationData,
  routesApi,
  type Route,
} from '../api';
import ElevationProfile from '../components/ElevationProfile/ElevationProfile';
import POIModal, { type POIData } from '../components/POI/POIModal';
import {
  getGPXRouteName,
  parseGPX,
  processGPXToRoute,
} from '../utils/gpxParser';

mapboxgl.accessToken =
  'pk.eyJ1IjoicHVuY2hpbmdtYW4iLCJhIjoiY2p1cjcyMmh2M3NpZDQ5bnEwMDV6ZTE1OSJ9.ef8y6l9fsKFMX91m_Rt2ng';

// POI type icons (Font Awesome)
const poiIcons: Record<string, { icon: string; color: string }> = {
  hotel: { icon: 'fa-hotel', color: '#3b82f6' },
  restaurant: { icon: 'fa-utensils', color: '#f97316' },
  gipfel: { icon: 'fa-mountain', color: '#22c55e' },
  highlight: { icon: 'fa-star', color: '#eab308' },
};

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
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

  const [startPoint, setStartPoint] = useState<[number, number] | null>(null);
  const [endPoint, setEndPoint] = useState<[number, number] | null>(null);
  const [waypoints, setWaypoints] = useState<[number, number][]>([]);
  const [routeGeometry, setRouteGeometry] = useState<[number, number][] | null>(
    null
  );
  const [pois, setPois] = useState<any[]>([]);
  const [editMode, setEditMode] = useState<
    'start' | 'end' | 'waypoint' | 'poi'
  >('start');

  // POI Modal state
  const [poiModalOpen, setPoiModalOpen] = useState(false);
  const [poiModalLngLat, setPoiModalLngLat] = useState<[number, number]>([
    0, 0,
  ]);

  const [routeStats, setRouteStats] = useState({
    distance: 0,
    duration: 0,
    highestPoint: 0,
    lowestPoint: 0,
    totalAscent: 0,
    totalDescent: 0,
  });

  // Bi-directional sync between map and elevation profile
  // Note: highlightDistance is used for map→elevation sync (not yet implemented in Editor's ad-hoc map)
  // For now we only have elevation→map sync via highlightPosition
  const [highlightDistance] = useState<number | undefined>();
  const [highlightPosition, setHighlightPosition] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const highlightMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // Mode labels for info overlay
  const modeLabels = {
    start: t('clickToSetStart'),
    waypoint: t('clickToAddWaypoint'),
    end: t('clickToSetEnd'),
    poi: t('clickToAddPoi'),
  };

  // Check auth
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await authApi.getProfile();
        if (!result.success) navigate('/admin/login');
      } catch {
        navigate('/admin/login');
      }
    };
    checkAuth();
  }, [navigate]);

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
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/sirajmuneer/cmjh1h0wb000b01se721kbl7m',
        center: [10.7865, 51.8054],
        zoom: 11,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      map.current.on('load', () => {
        console.log('[Editor] Map loaded');
        // Only set state if still mounted
        if (mountedRef.current) {
          setMapLoaded(true);
        }
      });

      map.current.on('error', e => {
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
  }, []);

  // Handle map click
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      if (editMode === 'start') {
        setStartPoint(coord);
        setEditMode('waypoint');
      } else if (editMode === 'end') {
        setEndPoint(coord);
        setEditMode('waypoint');
      } else if (editMode === 'poi') {
        // Open POI Modal
        setPoiModalLngLat(coord);
        setPoiModalOpen(true);
      } else {
        // Waypoint mode
        if (!startPoint) {
          setStartPoint(coord);
        } else if (!endPoint) {
          setWaypoints(prev => [...prev, coord]);
        } else {
          setWaypoints(prev => [...prev, coord]);
        }
      }
    };

    map.current.on('click', handleClick);
    return () => {
      map.current?.off('click', handleClick);
    };
  }, [mapLoaded, editMode, startPoint, endPoint]);
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
          '<i class="fa-solid fa-play" style="color: white; font-size: 12px;"></i>';
        el.className =
          'w-8 h-8 bg-green-500 rounded-full flex items-center justify-center border-2 border-white cursor-move pl-0.5';
        const marker = new mapboxgl.Marker({ element: el, draggable: true })
          .setLngLat(startPoint)
          .addTo(map.current);
        marker.on('dragend', () =>
          setStartPoint([marker.getLngLat().lng, marker.getLngLat().lat])
        );
        markersRef.current.push(marker);
      }

      // Waypoints
      waypoints.forEach((wp: [number, number], index: number) => {
        const el = document.createElement('div');
        el.textContent = String(index + 1);
        el.className =
          'w-7 h-7 bg-[#088d95] rounded-full flex items-center justify-center border-2 border-white text-white text-xs font-bold cursor-move';
        const marker = new mapboxgl.Marker({ element: el, draggable: true })
          .setLngLat(wp)
          .addTo(map.current!);
        marker.on('dragend', () => {
          setWaypoints(prev => {
            const newWp = [...prev];
            newWp[index] = [marker.getLngLat().lng, marker.getLngLat().lat];
            return newWp;
          });
        });
        markersRef.current.push(marker);
      });

      // End marker
      if (endPoint) {
        const el = document.createElement('div');
        el.innerHTML =
          '<i class="fa-solid fa-flag-checkered" style="color: white; font-size: 12px;"></i>';
        el.className =
          'w-8 h-8 bg-red-500 rounded-full flex items-center justify-center border-2 border-white cursor-move';
        const marker = new mapboxgl.Marker({ element: el, draggable: true })
          .setLngLat(endPoint)
          .addTo(map.current!);
        marker.on('dragend', () =>
          setEndPoint([marker.getLngLat().lng, marker.getLngLat().lat])
        );
        markersRef.current.push(marker);
      }

      // POI markers with type-specific Font Awesome icons
      pois.forEach((poi: { type: string; lngLat: [number, number] }) => {
        const el = document.createElement('div');
        const iconInfo = poiIcons[poi.type] || poiIcons.highlight;
        el.innerHTML = `
          <div style="position: relative;">
            <div style="position: absolute; width: 40px; height: 15px; bottom: -8px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.3); border-radius: 50%; filter: blur(5px);"></div>
            <div style="width: 40px; height: 40px; background: ${iconInfo.color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); position: relative; z-index: 2;">
              <i class="fas ${iconInfo.icon}" style="color: white; font-size: 16px;"></i>
            </div>
          </div>
        `;
        el.style.cursor = 'pointer';
        const marker = new mapboxgl.Marker({ element: el, offset: [0, -24] })
          .setLngLat(poi.lngLat)
          .addTo(map.current!);
        markersRef.current.push(marker);
      });
    };

    // Call addMarkers with a small delay to ensure map is ready
    const timer = setTimeout(addMarkers, 50);
    return () => clearTimeout(timer);
  }, [startPoint, waypoints, endPoint, pois, mapLoaded]);

  // Calculate route
  useEffect(() => {
    if (!map.current || !mapLoaded || !startPoint || !endPoint) return;

    const calculateRoute = async () => {
      try {
        // Wait for style to be fully loaded
        if (!map.current!.isStyleLoaded()) {
          // If style not loaded, wait and retry
          map.current!.once('style.load', () => {
            calculateRoute();
          });
          return;
        }

        const result = await getDirections(
          startPoint,
          waypoints,
          endPoint,
          'walking'
        );
        if (result.routes?.[0]) {
          const route = result.routes[0];

          // Save the complete route geometry for storage
          const geometry = route.geometry.coordinates as [number, number][];
          setRouteGeometry(geometry);
          console.log(
            '[Editor] Route geometry saved:',
            geometry.length,
            'coordinates'
          );

          // Fetch elevation data for the route
          const elevationData = await getElevationData(geometry);
          console.log('[Editor] Elevation data:', elevationData);

          setRouteStats(prev => ({
            ...prev,
            distance: Number((route.distance / 1000).toFixed(2)),
            duration: Math.round(route.duration / 60),
            highestPoint: elevationData.highestPoint,
            lowestPoint: elevationData.lowestPoint,
            totalAscent: elevationData.totalAscent,
            totalDescent: elevationData.totalDescent,
          }));

          // Clean up existing layers/sources
          if (map.current!.getLayer('route')) map.current!.removeLayer('route');
          if (map.current!.getSource('route'))
            map.current!.removeSource('route');

          map.current!.addSource('route', {
            type: 'geojson',
            lineMetrics: true,
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: route.geometry.coordinates,
              },
            },
          });
          map.current!.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#088D95', 'line-width': 4 },
          });
        }
      } catch (error) {
        console.error('Failed to calculate route:', error);
      }
    };

    // Small delay to ensure map is ready
    const timer = setTimeout(calculateRoute, 100);
    return () => clearTimeout(timer);
  }, [startPoint, waypoints, endPoint, mapLoaded]);

  // Load existing route
  useEffect(() => {
    console.log(
      '[Editor] Load route effect - id:',
      id,
      'mapLoaded:',
      mapLoaded
    );
    if (!id || !mapLoaded) return;

    const loadRoute = async () => {
      console.log('[Editor] Loading route data for id:', id);
      setLoading(true);
      try {
        const result = await routesApi.getById(Number(id));
        console.log('[Editor] Route API result:', result);
        if (result.success) {
          console.log('[Editor] Setting route data:', {
            startPoint: result.route.startPoint,
            endPoint: result.route.endPoint,
            waypoints: result.route.waypoints?.length,
            pois: result.route.pois?.length,
          });
          setName(result.route.name);
          setDescription(result.route.description || '');
          setStartPoint(result.route.startPoint);
          setEndPoint(result.route.endPoint);
          setWaypoints(result.route.waypoints || []);
          setRouteGeometry(result.route.routeGeometry || null);
          setPois(result.route.pois || []);
          setRouteStats({
            distance: result.route.distance || 0,
            duration: Math.round((result.route.duration || 0) / 60),
            highestPoint: result.route.highestPoint || 0,
            lowestPoint: result.route.lowestPoint || 0,
            totalAscent: result.route.totalAscent || 0,
            totalDescent: result.route.totalDescent || 0,
          });
          setEditMode('waypoint');
        }
      } catch (error) {
        console.error('[Editor] Failed to load route:', error);
      } finally {
        setLoading(false);
      }
    };
    loadRoute();
  }, [id, mapLoaded]);

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
  const handlePoiClickFromProfile = (poi: {
    lngLat: [number, number];
    name?: string;
  }) => {
    if (map.current && poi.lngLat) {
      map.current.flyTo({
        center: poi.lngLat,
        zoom: 15,
        duration: 1000,
      });
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

    setSaving(true);
    try {
      const routeData = {
        name,
        description,
        startPoint,
        endPoint,
        routeGeometry,
        waypoints,
        pois: pois.map(p => ({
          name: p.name,
          description: p.description,
          lngLat: p.lngLat,
          type: p.type,
          best_time: p.bestTime || p.best_time,
          images: p.images || [],
          amenities: p.amenities || [],
        })),
        distance: routeStats.distance,
        duration: routeStats.duration * 60,
        highestPoint: routeStats.highestPoint,
        lowestPoint: routeStats.lowestPoint,
        totalAscent: routeStats.totalAscent,
        totalDescent: routeStats.totalDescent,
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

  const handlePOISave = (poiData: POIData) => {
    setPois(prev => [...prev, { ...poiData, id: Date.now() } as any]);
    setPoiModalOpen(false);
    setEditMode('waypoint');
  };

  const handleGPXUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const points = parseGPX(text);
      const routeData = processGPXToRoute(points);
      const routeName = getGPXRouteName(text);

      clearRoute();
      setStartPoint(routeData.startPoint);
      setEndPoint(routeData.endPoint);
      setWaypoints(routeData.waypoints);
      // Save the complete geometry from GPX file
      setRouteGeometry(routeData.routeGeometry);
      console.log(
        '[Editor] GPX geometry saved:',
        routeData.routeGeometry.length,
        'coordinates'
      );

      if (routeName && !name) setName(routeName);
      setRouteStats(prev => ({
        ...prev,
        distance: Number(routeData.totalDistance.toFixed(2)),
        highestPoint: Math.round(routeData.highestPoint),
        lowestPoint: Math.round(routeData.lowestPoint),
        totalAscent: Math.round(routeData.elevationGain),
        totalDescent: Math.round(routeData.elevationLoss),
      }));

      if (map.current) {
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend(routeData.startPoint);
        bounds.extend(routeData.endPoint);
        routeData.waypoints.forEach(wp => bounds.extend(wp));
        map.current.fitBounds(bounds, { padding: 50 });
      }
      setEditMode('waypoint');
    } catch (error) {
      alert(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
    if (gpxInputRef.current) gpxInputRef.current.value = '';
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="h-screen flex flex-col bg-[#0b1215] relative">
      {/* Loading Overlay - shown OVER the map instead of replacing it */}
      {loading && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-[#0b1215]/80">
          <div className="flex flex-col items-center gap-3">
            <i className="fas fa-spinner fa-spin text-3xl text-[#088d95]"></i>
            <span className="text-gray-400">{t('loading')}</span>
          </div>
        </div>
      )}

      {/* Mode Info Overlay */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-[#080e11] border border-[#1e2a33] rounded-lg text-white text-sm shadow-lg">
        <i className="fas fa-info-circle text-[#088d95] mr-2"></i>
        {modeLabels[editMode]}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Map + Elevation */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative min-h-[300px]">
            <div
              ref={mapContainer}
              className="absolute h-[100%]  inset-0 z-10"
            />
          </div>

          {/* Elevation Profile */}
          <div className="h-[200px] bg-[#080e11] border-t border-[#1e2a33]">
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
        <div className="w-[300px] bg-[#080e11] border-l border-[#1e2a33] p-3 flex flex-col gap-3 overflow-y-auto">
          {/* Route Name */}
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('routeNamePlaceholder')}
            className="w-full px-3 py-2.5 bg-[#0b1215] border border-[#1e2a33] rounded-lg text-white placeholder-gray-500 focus:border-[#088d95] focus:outline-none"
          />

          {/* Mode Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setEditMode('start')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-all ${
                editMode === 'start'
                  ? 'bg-green-500 text-white'
                  : 'bg-[#0b1215] border border-[#1e2a33] text-gray-400 hover:border-green-500'
              }`}
            >
              <i className="fas fa-play"></i> {t('start')}
            </button>
            <button
              onClick={() => setEditMode('end')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-all ${
                editMode === 'end'
                  ? 'bg-red-500 text-white'
                  : 'bg-[#0b1215] border border-[#1e2a33] text-gray-400 hover:border-red-500'
              }`}
            >
              <i className="fas fa-flag-checkered"></i> {t('end')}
            </button>
            <button
              onClick={() => setEditMode('waypoint')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-all ${
                editMode === 'waypoint'
                  ? 'bg-[#088d95] text-white'
                  : 'bg-[#0b1215] border border-[#1e2a33] text-gray-400 hover:border-[#088d95]'
              }`}
            >
              <i className="fas fa-plus"></i> {t('waypoint')}
            </button>
            <button
              onClick={() => setEditMode('poi')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-all ${
                editMode === 'poi'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-[#0b1215] border border-[#1e2a33] text-gray-400 hover:border-yellow-500'
              }`}
            >
              <i className="fas fa-map-marker-alt"></i> POI
            </button>
          </div>

          {/* Action Buttons */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#088d95] hover:bg-[#0da6ae] text-white rounded-lg transition-all disabled:opacity-50"
          >
            {saving ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : (
              <i className="fas fa-save"></i>
            )}{' '}
            {t('saveRoute')}
          </button>
          <button
            onClick={clearRoute}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-all"
          >
            <i className="fas fa-trash"></i> {t('deleteRoute')}
          </button>

          {/* GPX Upload */}
          <div>
            <input
              type="file"
              ref={gpxInputRef}
              accept=".gpx"
              className="hidden"
              onChange={handleGPXUpload}
            />
            <button
              onClick={() => gpxInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-[#1e2a33] text-gray-400 hover:text-white hover:border-[#088d95] rounded-lg transition-all"
            >
              <i className="fas fa-upload"></i> {t('uploadGPX')}
            </button>
          </div>

          {/* POIs Section */}
          {pois.length > 0 && (
            <div className="bg-[#0b1215] border border-[#1e2a33] rounded-lg p-3">
              <h4 className="text-[#088d95] text-xs uppercase mb-2 font-semibold">
                Interessenpunkte ({pois.length})
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {pois.map((poi, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center py-1.5 px-2 bg-[#080e11] rounded border border-[#1e2a33]"
                  >
                    <span className="text-sm text-white flex items-center gap-2 truncate">
                      <i
                        className={`fas ${
                          (poiIcons[poi.type] || poiIcons.highlight).icon
                        }`}
                        style={{
                          color: (poiIcons[poi.type] || poiIcons.highlight)
                            .color,
                        }}
                      ></i>
                      {poi.name}
                    </span>
                    <button
                      onClick={() => removePoi(idx)}
                      className="text-red-400 hover:text-red-300 text-lg px-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Route Points */}
          <div className="bg-[#0b1215] border border-[#1e2a33] rounded-lg p-3">
            <h4 className="text-[#088d95] text-xs uppercase mb-2 font-semibold">
              {t('routePoints')}
            </h4>

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

            {waypoints.map((_, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center py-1.5 border-b border-[#1e2a33]"
              >
                <span className="text-sm text-white flex items-center gap-2">
                  <span className="w-5 h-5 bg-[#088d95] rounded-full flex items-center justify-center text-[11px] font-bold">
                    {idx + 1}
                  </span>
                  {t('waypoint')} {idx + 1}
                </span>
                <button
                  onClick={() => removeWaypoint(idx)}
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

            {!startPoint && !endPoint && waypoints.length === 0 && (
              <div className="text-gray-500 text-sm py-2">
                {t('clickOnMap')}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="bg-[#0b1215] border border-[#1e2a33] rounded-lg p-3">
            <h4 className="text-[#088d95] text-xs uppercase mb-2 font-semibold">
              {t('routeStatistics')}
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">{t('distance')}</span>
                <span className="text-[#088d95] font-semibold">
                  {routeStats.distance} km
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{t('duration')}</span>
                <span className="text-[#088d95] font-semibold">
                  {formatDuration(routeStats.duration)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{t('highestPoint')}</span>
                <span className="text-[#088d95] font-semibold">
                  {routeStats.highestPoint} m
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{t('lowestPoint')}</span>
                <span className="text-[#088d95] font-semibold">
                  {routeStats.lowestPoint} m
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{t('totalAscent')}</span>
                <span className="text-green-500 font-semibold">
                  ↑ {routeStats.totalAscent} m
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{t('totalDescent')}</span>
                <span className="text-red-400 font-semibold">
                  ↓ {routeStats.totalDescent} m
                </span>
              </div>
            </div>
          </div>

          {/* Back */}
          <button
            onClick={() => navigate('/admin')}
            className="mt-auto w-full flex items-center justify-center gap-2 py-2.5 border border-[#1e2a33] text-gray-400 hover:text-white hover:border-[#088d95] rounded-lg transition-all"
          >
            <i className="fas fa-arrow-left"></i> {t('back')}
          </button>
        </div>
      </div>

      {/* POI Modal */}
      <POIModal
        isOpen={poiModalOpen}
        lngLat={poiModalLngLat}
        onSave={handlePOISave}
        onClose={() => {
          setPoiModalOpen(false);
          setEditMode('waypoint');
        }}
      />
    </div>
  );
}
