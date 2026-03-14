import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
    routesApi,
    locationsApi,
    splitPointsApi,
    type Route,
    type RouteLocation,
    type SplitPoint
} from '../api';
import SplitPointEditor from '../components/SplitPointEditor/SplitPointEditor';
import './StageManager.css';

mapboxgl.accessToken = 'pk.eyJ1IjoicHVuY2hpbmdtYW4iLCJhIjoiY2p1cjcyMmh2M3NpZDQ5bnEwMDV6ZTE1OSJ9.ef8y6l9fsKFMX91m_Rt2ng';

const TOUR_TYPES = [
    { id: 'gold', name: 'Gold (1 Day)', color: '#22c55e', stages: 1 },
    { id: 'silver', name: 'Silver (2 Days)', color: '#3b82f6', stages: 2 },
    { id: 'bronze', name: 'Bronze (3 Days)', color: '#f59e0b', stages: 3 },
] as const;

// Calculate distance between coordinates in km
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function StageManager() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const routeId = parseInt(id || '0');

    const [route, setRoute] = useState<Route | null>(null);
    const [locations, setLocations] = useState<RouteLocation[]>([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [newLocationName, setNewLocationName] = useState('');
    const [tempCoords, setTempCoords] = useState<[number, number] | null>(null);
    const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
    const [selectedCity, setSelectedCity] = useState('Wernigerode');

    // Split points state - for all tour types
    const [splitPoints, setSplitPoints] = useState<{
        gold: SplitPoint[];
        silver: SplitPoint[];
        bronze: SplitPoint[];
    }>({
        gold: [],
        silver: [],
        bronze: [],
    });

    // Split point picker mode state
    const [splitPointMode, setSplitPointMode] = useState<{
        active: boolean;
        tourType: 'gold' | 'silver' | 'bronze';
        stageNumber: number;
        callback: ((lng: number, lat: number, distanceKm: number) => void) | null;
    }>({
        active: false,
        tourType: 'silver',
        stageNumber: 1,
        callback: null,
    });

    // Currently selected tour type for map markers
    const [selectedTourType, setSelectedTourType] = useState<'gold' | 'silver' | 'bronze'>('silver');

    // Location picker mode
    const [locationPickerMode, setLocationPickerMode] = useState(false);

    // Track unsaved changes
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const pendingSaveRef = useRef(false);
    const prevLocationIdRef = useRef<number | null>(null);
    const splitPointsRef = useRef(splitPoints);

    const mapContainer = useRef<HTMLDivElement>(null);

    // Keep ref in sync with state
    useEffect(() => {
        splitPointsRef.current = splitPoints;
    }, [splitPoints]);
    const map = useRef<mapboxgl.Map | null>(null);
    const markers = useRef<mapboxgl.Marker[]>([]);
    const mountedRef = useRef(true);

    // Refs to store latest state for map click handler (avoids stale closures)
    const splitPointModeRef = useRef(splitPointMode);
    const locationPickerModeRef = useRef(locationPickerMode);
    const routeRef = useRef(route);

    // Update refs when state changes
    useEffect(() => {
        splitPointModeRef.current = splitPointMode;
    }, [splitPointMode]);

    useEffect(() => {
        locationPickerModeRef.current = locationPickerMode;
    }, [locationPickerMode]);

    useEffect(() => {
        routeRef.current = route;
    }, [route]);

    // Fetch route and locations on mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [routeRes, locRes] = await Promise.all([
                    routesApi.getById(routeId),
                    locationsApi.getByRoute(routeId)
                ]);

                if (routeRes.success) {
                    setRoute(routeRes.route);
                }
                if (locRes.success) {
                    // Parse coordinates to numbers (API may return strings)
                    const parsedLocations = locRes.data.map((loc: any) => ({
                        ...loc,
                        lat: typeof loc.lat === 'string' ? parseFloat(loc.lat) : loc.lat,
                        lng: typeof loc.lng === 'string' ? parseFloat(loc.lng) : loc.lng,
                    }));
                    setLocations(parsedLocations);
                }
            } catch (err) {
                console.error('Failed to fetch data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [routeId]);

    // Load split points when location changes (with auto-save)
    useEffect(() => {
        const loadSplits = async () => {
            if (!routeId) return;
            
            // Check if we're switching locations (not initial load)
            const isLocationSwitch = prevLocationIdRef.current !== selectedLocationId;
            
            // Auto-save any unsaved changes before switching locations
            if (isLocationSwitch && pendingSaveRef.current) {
                const prevLocId = prevLocationIdRef.current;
                const currentSplits = splitPointsRef.current;
                try {
                    // For generic/default: pass 'Route Start' as startLocation, no locationId
                    // For specific location: pass locationId and empty string for startLocation
                    const startLoc = prevLocId ? '' : 'Route Start';
                    const locId = prevLocId || undefined;
                    
                    await Promise.all([
                        splitPointsApi.save(routeId, 'gold', currentSplits.gold || [], startLoc, locId),
                        splitPointsApi.save(routeId, 'silver', currentSplits.silver || [], startLoc, locId),
                        splitPointsApi.save(routeId, 'bronze', currentSplits.bronze || [], startLoc, locId),
                    ]);
                    console.log('[StageManager] Auto-saved split points before location switch');
                } catch (err) {
                    console.error('[StageManager] Auto-save failed:', err);
                }
            }
            
            // Update ref to current location
            prevLocationIdRef.current = selectedLocationId;
            pendingSaveRef.current = false;
            
            // Now load split points for the new location
            try {
                // Use consistent startLocation values with save operation
                const startLoc = selectedLocationId ? '' : 'Route Start';
                const res = await splitPointsApi.getByRoute(
                    routeId,
                    startLoc,
                    selectedLocationId || undefined
                );
                if (res.success) {
                    setSplitPoints(res.splitPoints);
                    setHasUnsavedChanges(false);
                }
            } catch (err) {
                console.error('Error loading splits:', err);
            }
        };
        loadSplits();
    }, [routeId, selectedLocationId]);

    // Initialize map
    useEffect(() => {
        mountedRef.current = true;

        if (!mapContainer.current) {
            console.log('[StageManager] No map container ref');
            return;
        }
        if (!route) {
            console.log('[StageManager] Waiting for route data...');
            return;
        }
        if (map.current) return;

        const style = 'mapbox://styles/sirajmuneer/cmjh1h0wb000b01se721kbl7m';

        console.log('[StageManager] Initializing Mapbox');

        try {
            map.current = new mapboxgl.Map({
                container: mapContainer.current,
                style: style,
                center: route.startPoint,
                zoom: 12,
                pitch: 45,
            });

            map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

            map.current.on('error', (e) => {
                console.error('[StageManager] Mapbox error:', e);
            });

            map.current.on('load', () => {
                console.log('[StageManager] Mapbox loaded');
                if (!mountedRef.current || !map.current || !route.routeGeometry) return;

                // Enable terrain
                map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

                // Add route line with arrows
                map.current.addSource('route', {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        properties: {},
                        geometry: {
                            type: 'LineString',
                            coordinates: route.routeGeometry,
                        },
                    },
                });

                // Main route line
                map.current.addLayer({
                    id: 'route-line',
                    type: 'line',
                    source: 'route',
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: {
                        'line-color': '#088d95',
                        'line-width': 6,
                        'line-opacity': 0.9,
                    },
                });

                // Direction arrows using text symbols
                map.current.addLayer({
                    id: 'route-arrows',
                    type: 'symbol',
                    source: 'route',
                    layout: {
                        'symbol-placement': 'line',
                        'symbol-spacing': 80,
                        'text-field': '▶',
                        'text-size': 14,
                        'text-rotation-alignment': 'map',
                        'text-allow-overlap': true,
                    },
                    paint: {
                        'text-color': '#ffffff',
                        'text-opacity': 0.9,
                        'text-halo-color': '#088d95',
                        'text-halo-width': 2,
                    },
                });

                // Add start marker
                const startEl = document.createElement('div');
                startEl.className = 'route-start-marker';
                startEl.innerHTML = '<i class="fas fa-play"></i>';
                new mapboxgl.Marker({ element: startEl, anchor: 'center' })
                    .setLngLat(route.startPoint)
                    .setPopup(new mapboxgl.Popup({ offset: 15 }).setHTML('<b>Start</b>'))
                    .addTo(map.current);

                // Add end marker
                const endEl = document.createElement('div');
                endEl.className = 'route-end-marker';
                endEl.innerHTML = '<i class="fas fa-flag-checkered"></i>';
                new mapboxgl.Marker({ element: endEl, anchor: 'center' })
                    .setLngLat(route.endPoint)
                    .setPopup(new mapboxgl.Popup({ offset: 15 }).setHTML('<b>Finish</b>'))
                    .addTo(map.current);

                // Fit bounds
                const bounds = new mapboxgl.LngLatBounds();
                route.routeGeometry.forEach(coord => bounds.extend(coord as [number, number]));
                map.current.fitBounds(bounds, { padding: 80 });
            });

            // Handle map clicks for split points and locations
            // Using refs to access latest state (avoids stale closure issues)
            map.current.on('click', (e) => {
                const currentSplitMode = splitPointModeRef.current;
                const currentLocationMode = locationPickerModeRef.current;
                const currentRoute = routeRef.current;

                // Handle split point picker mode
                if (currentSplitMode.active && currentSplitMode.callback && currentRoute?.routeGeometry) {
                    const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];

                    // Find closest point on route and calculate distance
                    let minDist = Infinity;
                    let closestCoord = coord;
                    let distanceKm = 0;
                    let accumulatedDistance = 0;

                    for (let i = 0; i < currentRoute.routeGeometry.length; i++) {
                        const rc = currentRoute.routeGeometry[i];
                        const d = Math.sqrt(
                            Math.pow(coord[0] - rc[0], 2) + Math.pow(coord[1] - rc[1], 2)
                        );
                        if (i > 0) {
                            const prev = currentRoute.routeGeometry[i - 1];
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

                    // Call the callback with the snapped point
                    currentSplitMode.callback(closestCoord[0], closestCoord[1], distanceKm);
                    
                    // Reset mode
                    setSplitPointMode({
                        active: false,
                        tourType: 'silver',
                        stageNumber: 1,
                        callback: null,
                    });
                    return;
                }

                // Handle location picker mode
                // Note: Locations can be placed ANYWHERE (cities, malls, etc.), not just on route
                if (currentLocationMode) {
                    // Use the exact clicked coordinates
                    const clickedCoord: [number, number] = [e.lngLat.lng, e.lngLat.lat];

                    setTempCoords(clickedCoord);
                    setLocationPickerMode(false);
                    setShowLocationModal(true);
                }
            });
        } catch (err) {
            console.error('[StageManager] Mapbox initialization failed:', err);
        }

        return () => {
            mountedRef.current = false;
        };
    }, [route]);

    // Update markers when locations or split points change
    useEffect(() => {
        if (!map.current) return;

        // Clear old markers
        markers.current.forEach(m => m.remove());
        markers.current = [];

        // Add existing locations
        locations.forEach(loc => {
            const el = document.createElement('div');
            el.className = `marker location-marker ${selectedLocationId === loc.id ? 'selected' : ''}`;

            const popup = new mapboxgl.Popup({ 
                offset: 15,
                closeButton: false,
                className: 'location-popup'
            }).setHTML(`<div class="popup-content">${loc.name}</div>`);

            const marker = new mapboxgl.Marker(el)
                .setLngLat([Number(loc.lng), Number(loc.lat)])
                .setPopup(popup)
                .addTo(map.current!);

            marker.getElement().addEventListener('click', () => {
                setSelectedLocationId(loc.id);
            });

            markers.current.push(marker);
        });

        // Add split point markers for selected tour type
        const currentSplits = splitPoints[selectedTourType] || [];
        currentSplits.forEach((sp) => {
            if (sp.lng && sp.lat) {
                const el = document.createElement('div');
                const color = TOUR_TYPES.find(t => t.id === selectedTourType)?.color || '#fff';
                el.className = 'marker split-marker';
                el.style.backgroundColor = color;
                el.innerHTML = String(sp.stageNumber);

                const marker = new mapboxgl.Marker(el)
                    .setLngLat([Number(sp.lng), Number(sp.lat)])
                    .addTo(map.current!);

                markers.current.push(marker);
            }
        });

        // Add temp picker marker for location
        if (tempCoords && !locationPickerMode) {
            const el = document.createElement('div');
            el.style.cssText = `
                width: 1.5rem;
                height: 1.5rem;
                background: #22c55e;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                border: 2px solid white;
                box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.3);
                animation: pulse 1.5s infinite;
            `;
            el.innerHTML = '<i class="fas fa-check" style="font-size: 0.625rem;"></i>';

            const marker = new mapboxgl.Marker(el)
                .setLngLat(tempCoords)
                .addTo(map.current!);

            markers.current.push(marker);
        }
    }, [locations, splitPoints, selectedLocationId, selectedTourType, tempCoords, locationPickerMode]);

    const handleAddLocation = async () => {
        if (!tempCoords || !newLocationName.trim()) return;

        try {
            // First save any pending split points for current location
            if (pendingSaveRef.current) {
                const currentLocId = selectedLocationId;
                const currentSplits = splitPointsRef.current;
                await Promise.all([
                    splitPointsApi.save(routeId, 'gold', currentSplits.gold || [], undefined, currentLocId || undefined),
                    splitPointsApi.save(routeId, 'silver', currentSplits.silver || [], undefined, currentLocId || undefined),
                    splitPointsApi.save(routeId, 'bronze', currentSplits.bronze || [], undefined, currentLocId || undefined),
                ]);
                console.log('[StageManager] Auto-saved split points before adding location');
                pendingSaveRef.current = false;
            }

            const res = await locationsApi.create({
                route_id: routeId,
                name: newLocationName.trim(),
                lng: tempCoords[0],
                lat: tempCoords[1]
            });

            if (res.success) {
                const fresh = await locationsApi.getByRoute(routeId);
                // Parse coordinates to numbers
                const parsedLocations = fresh.data.map((loc: any) => ({
                    ...loc,
                    lat: typeof loc.lat === 'string' ? parseFloat(loc.lat) : loc.lat,
                    lng: typeof loc.lng === 'string' ? parseFloat(loc.lng) : loc.lng,
                }));
                setLocations(parsedLocations);
                setShowLocationModal(false);
                setNewLocationName('');
                setTempCoords(null);
            }
        } catch (err) {
            console.error('Error creating location:', err);
        }
    };

    const handleDeleteLocation = async (locId: number) => {
        if (!confirm('Are you sure you want to delete this location? Split points tied to it will lose their association.')) return;

        try {
            const res = await locationsApi.delete(locId, routeId);
            if (res.success) {
                setLocations(locations.filter(l => l.id !== locId));
                if (selectedLocationId === locId) {
                    setSelectedLocationId(null);
                }
            }
        } catch (err) {
            console.error('Error deleting location:', err);
        }
    };

    // Handle split point mode from SplitPointEditor
    const handleSetSplitPointMode = useCallback((
        active: boolean,
        tourType: 'gold' | 'silver' | 'bronze',
        stageNumber: number,
        callback: ((lng: number, lat: number, distanceKm: number) => void) | null
    ) => {
        setSplitPointMode({
            active,
            tourType,
            stageNumber,
            callback,
        });
        setSelectedTourType(tourType);
    }, []);

    // Handle split points change from SplitPointEditor
    const handleSplitPointsChange = useCallback((newSplitPoints: {
        gold: SplitPoint[];
        silver: SplitPoint[];
        bronze: SplitPoint[];
    }) => {
        setSplitPoints(newSplitPoints);
        setHasUnsavedChanges(true);
        pendingSaveRef.current = true;
    }, []);

    if (loading) return <div className="loading-screen">Loading Stage Manager...</div>;

    return (
        <div className="stage-manager">
            {/* Sidebar */}
            <div className="sidebar">
                <div className="sidebar-header">
                    <button onClick={() => navigate('/admin')} className="back-btn">
                        <i className="fas fa-chevron-left"></i>
                        {t('back')}
                    </button>
                    <h1>Stage Manager</h1>
                    <p className="route-name">{route?.name}</p>
                </div>

                <div className="sidebar-content">
                    {/* Locations Section */}
                    <section className="locations-section">
                        <div className="section-header">
                            <h2>Locations ({locations.length}/10)</h2>
                            <button
                                className="add-btn"
                                onClick={() => {
                                    setNewLocationName('');
                                    setTempCoords(null);
                                    setLocationPickerMode(true);
                                }}
                                disabled={locations.length >= 10 || locationPickerMode}
                            >
                                <i className="fas fa-plus"></i>
                                {locationPickerMode ? 'Click anywhere on map...' : 'Add Location'}
                            </button>
                        </div>

                        <div className="locations-list">
                            {/* Generic Path Option */}
                            <div
                                className={`location-card ${selectedLocationId === null ? 'selected' : ''}`}
                                onClick={() => setSelectedLocationId(null)}
                            >
                                <div className="info">
                                    <span className="name">Generic (Default Path)</span>
                                    <span className="coords">Start point from route</span>
                                </div>
                            </div>

                            {locations.map(loc => (
                                <div
                                    key={loc.id}
                                    className={`location-card ${selectedLocationId === loc.id ? 'selected' : ''}`}
                                    onClick={() => setSelectedLocationId(loc.id)}
                                >
                                    <div className="info">
                                        <span className="name">{loc.name}</span>
                                        <span className="coords">{Number(loc.lat).toFixed(4)}, {Number(loc.lng).toFixed(4)}</span>
                                    </div>
                                    <button className="delete-btn" onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteLocation(loc.id);
                                    }}>
                                        <i className="fas fa-trash"></i>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Split Points Section using SplitPointEditor */}
                    <section className="splits-section">
                        <SplitPointEditor
                            routeId={routeId}
                            routeGeometry={route?.routeGeometry || null}
                            totalDistance={route?.distance || 0}
                            splitPoints={splitPoints}
                            locations={locations}
                            selectedLocationId={selectedLocationId}
                            onSplitPointChange={handleSplitPointsChange}
                            onLocationChange={setSelectedLocationId}
                            onTourTypeChange={setSelectedTourType}
                            onSetSplitPointMode={handleSetSplitPointMode}
                        />
                    </section>
                </div>
            </div>

            {/* Main Map Content */}
            <div className="map-view">
                <div ref={mapContainer} className="map-container" />

                {/* Overlay for picker modes */}
                {(splitPointMode.active || locationPickerMode) && (
                    <div className="picker-overlay">
                        <div className="overlay-content">
                            <i className="fas fa-crosshairs pulse"></i>
                            <span>
                                {splitPointMode.active 
                                    ? `Click on route to set Stage ${splitPointMode.stageNumber}` 
                                    : 'Click anywhere on map to place location'}
                            </span>
                            <button 
                                className="confirm-btn" 
                                onClick={() => {
                                    if (splitPointMode.active) {
                                        setSplitPointMode({
                                            active: false,
                                            tourType: 'silver',
                                            stageNumber: 1,
                                            callback: null,
                                        });
                                    }
                                    if (locationPickerMode) {
                                        setLocationPickerMode(false);
                                    }
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Location Modal */}
            {showLocationModal && (
                <div className="modal-backdrop">
                    <div className="modal">
                        <h2>Add New Location</h2>
                        <div className="form-group">
                            <label>City / Location Name</label>
                            <input
                                type="text"
                                value={newLocationName}
                                onChange={(e) => setNewLocationName(e.target.value)}
                                placeholder="e.g. Wernigerode"
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label>Coordinates</label>
                            <div className="coord-display">
                                {tempCoords ? (
                                    <span className="text-success">
                                        {tempCoords[1].toFixed(5)}, {tempCoords[0].toFixed(5)}
                                    </span>
                                ) : (
                                    <span className="text-muted">Not selected</span>
                                )}
                                <button
                                    className="pick-inline-btn"
                                    onClick={() => {
                                        setShowLocationModal(false);
                                        setLocationPickerMode(true);
                                    }}
                                >
                                    <i className="fas fa-map-marked-alt"></i>
                                    {tempCoords ? 'Change' : 'Pick from Map'}
                                </button>
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button 
                                onClick={() => {
                                    setShowLocationModal(false);
                                    setTempCoords(null);
                                }} 
                                className="cancel-pill"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleAddLocation} 
                                className="save-pill" 
                                disabled={!newLocationName || !tempCoords}
                            >
                                Save Location
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
