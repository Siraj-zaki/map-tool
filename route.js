// route.js - Route calculation and display functionality

/**
 * Loads a route from the database
 */
async function loadRoute(routeId) {
    try {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) loadingIndicator.style.display = 'flex';

        await waitForMapLoad();

        const routePromise = fetch(`php/get-route.php?route_id=${routeId}`).then(res => res.json());

        const tasks = [];

        tasks.push(routePromise.then(result => {
            if (!result.success) {
                throw new Error(result.error || 'Failed to load route');
            }

            const routeData = result.route;
            console.log('Loaded route data:', routeData);
            
            document.getElementById('routeTitle').textContent = routeData.name || routeData.title || '';

            const startPoint = routeData.startPoint;
            const endPoint = routeData.endPoint;
            const waypoints = routeData.waypoints || [];

            createMarker(startPoint, 'start');
            createMarker(endPoint, 'end');

            if (routeData.pois && routeData.pois.length > 0) {
                poiMarkers.forEach(marker => marker.remove());
                poiMarkers.clear();
                pois.length = 0;

                routeData.pois.forEach(poi => {
                    const processedPoi = {
                        ...poi,
                        id: Date.now() + Math.random(),
                        images: Array.isArray(poi.images) ? poi.images : [],
                        amenities: Array.isArray(poi.amenities) ? poi.amenities : []
                    };
                    pois.push(processedPoi);
                });
            }

            return routeData;
        }));

        const [routeData] = await Promise.all(tasks);

        const calculatedRoute = await getRouteFast(
            routeData.startPoint, 
            routeData.waypoints || [], 
            routeData.endPoint
        );
        
        if (!calculatedRoute) {
            throw new Error('Failed to calculate route');
        }

        const routePromises = [
            addRouteToMap(calculatedRoute),
            updateRouteStats(calculatedRoute, routeData)
        ];

        await Promise.all(routePromises);

        fitMapToRoute([routeData.startPoint, ...(routeData.waypoints || []), routeData.endPoint]);

        setTimeout(() => {
            createPOIsInBatches(pois, 20);
        }, 10);

        if (loadingIndicator) loadingIndicator.style.display = 'none';
    } catch (error) {
        console.error('Error loading route:', error);
        alert('Failed to load route: ' + error.message);
        
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/**
 * Updates route statistics in the UI
 */
function updateRouteStats(calculatedRoute, routeData) {
    const totalDistance = calculatedRoute.features[0].properties.distance / 1000;
    document.getElementById('route-distance').textContent = `${totalDistance.toFixed(1)} km`;
    
    const hours = Math.floor(routeData.duration / 3600);
    const minutes = Math.floor((routeData.duration % 3600) / 60);
    document.getElementById('route-duration').textContent = `${hours}h ${minutes}m`;
    
    document.getElementById('route-highest').textContent = `${Math.round(routeData.highestPoint || 0)} m`;
    document.getElementById('route-lowest').textContent = `${Math.round(routeData.lowest_point || routeData.lowestPoint || 0)} m`;
    document.getElementById('route-ascent').textContent = `${Math.round(routeData.totalAscent || 0)} m`;
    document.getElementById('route-descent').textContent = `${Math.round(routeData.totalDescent || 0)} m`;
}

/**
 * Fits map view to the route
 */
function fitMapToRoute(coordinates) {
    const bounds = coordinates.reduce(
        (bounds, coord) => bounds.extend(coord),
        new maptilersdk.LngLatBounds(coordinates[0], coordinates[0])
    );

    const isMobile = window.innerWidth < 768;
    
    const padding = isMobile ? 
        { top: 50, bottom: 50, left: 20, right: 20 } : 
        { top: 50, bottom: 50, left: 50, right: 50 };

    setTimeout(() => {
        map.fitBounds(bounds, {
            padding: padding,
            maxZoom: 15,
            duration: 100
        });
    }, 1);
}

/**
 * Gets a route from start to end via waypoints
 */
async function getRouteFast(start, waypoints, end) {
    if (waypoints.length < 5) {
        return await getRoute(start, waypoints, end);
    }
    
    const MAX_WAYPOINTS_PER_BATCH = 23;
    console.log("Using optimized batch routing approach");
    
    if (waypoints.length <= MAX_WAYPOINTS_PER_BATCH) {
        return await buildEfficientHybridRoute(start, waypoints, end);
    }
    
    const routeSegments = [];
    const batchPromises = [];
    let currentStart = start;
    
    for (let i = 0; i < waypoints.length; i += MAX_WAYPOINTS_PER_BATCH) {
        const batchWaypoints = waypoints.slice(i, i + MAX_WAYPOINTS_PER_BATCH);
        const isLastSegment = i + MAX_WAYPOINTS_PER_BATCH >= waypoints.length;
        const currentEnd = isLastSegment ? end : waypoints[i + MAX_WAYPOINTS_PER_BATCH];
        
        const batchStart = currentStart;
        
        const batchPromise = buildEfficientHybridRoute(batchStart, batchWaypoints, currentEnd)
            .then(segmentRoute => {
                if (!segmentRoute) {
                    throw new Error('Failed to calculate route segment');
                }
                
                return { index: i, segment: segmentRoute.features[0] };
            });
        
        batchPromises.push(batchPromise);
        
        currentStart = currentEnd;
    }
    
    try {
        const results = await Promise.all(batchPromises);
        
        results.sort((a, b) => a.index - b.index);
        
        const orderedSegments = results.map(result => result.segment);
        
        return mergeRouteSegments(orderedSegments);
    } catch (error) {
        console.error('Error in batch route calculation:', error);
        document.getElementById('info').innerHTML = 'Error: Failed to calculate route segment';
        return null;
    }
}

async function getRoute(start, waypoints, end) {
    const MAX_WAYPOINTS = 23;
    
    console.log("Using direct hybrid approach for faster route drawing");
    
    if (waypoints.length <= MAX_WAYPOINTS) {
        return await buildEfficientHybridRoute(start, waypoints, end);
    }
    
    const routeSegments = [];
    let currentStart = start;
    
    for (let i = 0; i < waypoints.length; i += MAX_WAYPOINTS) {
        const batchWaypoints = waypoints.slice(i, i + MAX_WAYPOINTS);
        const isLastSegment = i + MAX_WAYPOINTS >= waypoints.length;
        const currentEnd = isLastSegment ? end : waypoints[i + MAX_WAYPOINTS];
        
        const segmentRoute = await buildEfficientHybridRoute(currentStart, batchWaypoints, currentEnd);
        if (!segmentRoute) {
            document.getElementById('info').innerHTML = 'Error: Failed to calculate route segment';
            return null;
        }
        
        routeSegments.push(segmentRoute.features[0]);
        currentStart = currentEnd;
    }
    
    return mergeRouteSegments(routeSegments);
}

/**
 * Efficient hybrid route builder that immediately switches to cycling when walking fails
 */
async function buildEfficientHybridRoute(start, waypoints, end) {
    const points = [start, ...waypoints, end];
    const segments = [];
    
    for (let i = 0; i < points.length - 1; i++) {
        const segmentStart = points[i];
        const segmentEnd = points[i + 1];
        
        let segmentData = null;
        
        try {
            const walkingUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${segmentStart[0]},${segmentStart[1]};${segmentEnd[0]},${segmentEnd[1]}?geometries=geojson&access_token=${MAPBOX_ACCESS_TOKEN}&overview=full`;
            
            const walkingResponse = await fetch(walkingUrl);
            const walkingData = await walkingResponse.json();
            
            if (walkingData.code === 'Ok' && walkingData.routes && walkingData.routes.length > 0) {
                const haversineDistance = calculateHaversineDistance(
                    segmentStart[1], segmentStart[0], 
                    segmentEnd[1], segmentEnd[0]
                ) * 1000;
                
                const routeDistance = walkingData.routes[0].distance;
                const detourRatio = routeDistance / haversineDistance;
                
                if (detourRatio < 2.0) {
                    const duration = calculateDurationBasedOnSpeed(routeDistance / 1000, 5);
                    
                    segmentData = {
                        geometry: walkingData.routes[0].geometry,
                        distance: routeDistance,
                        duration: duration,
                        profile: 'walking'
                    };
                }
            }
        } catch (error) {
            console.error(`Error with walking route for segment ${i+1}:`, error);
        }
        
        if (!segmentData) {
            try {
                const cyclingUrl = `https://api.mapbox.com/directions/v5/mapbox/cycling/${segmentStart[0]},${segmentStart[1]};${segmentEnd[0]},${segmentEnd[1]}?geometries=geojson&access_token=${MAPBOX_ACCESS_TOKEN}&overview=full`;
                
                const cyclingResponse = await fetch(cyclingUrl);
                const cyclingData = await cyclingResponse.json();
                
                if (cyclingData.code === 'Ok' && cyclingData.routes && cyclingData.routes.length > 0) {
                    const duration = calculateDurationBasedOnSpeed(cyclingData.routes[0].distance / 1000, 10);
                    
                    segmentData = {
                        geometry: cyclingData.routes[0].geometry,
                        distance: cyclingData.routes[0].distance,
                        duration: duration,
                        profile: 'cycling'
                    };
                }
            } catch (error) {
                console.error(`Error with cycling route for segment ${i+1}:`, error);
            }
        }
        
        if (!segmentData) {
            const distanceKm = calculateHaversineDistance(
                segmentStart[1], segmentStart[0], 
                segmentEnd[1], segmentEnd[0]
            );
            
            segmentData = {
                geometry: {
                    type: 'LineString',
                    coordinates: [segmentStart, segmentEnd]
                },
                distance: distanceKm * 1000,
                duration: calculateDurationBasedOnSpeed(distanceKm, 3),
                profile: 'direct'
            };
        }
        
        segments.push(segmentData);
    }
    
    return combineRouteSegments(segments);
}

/**
 * Combines route segments into a single route
 */
function combineRouteSegments(segments) {
    const combinedGeometry = {
        type: 'LineString',
        coordinates: []
    };
    
    let totalDistance = 0;
    let totalDuration = 0;
    let allSegmentTypes = [];
    
    segments.forEach((segment, index) => {
        const coords = segment.geometry.coordinates;
        const coordsToAdd = index > 0 ? coords.slice(1) : coords;
        
        combinedGeometry.coordinates = combinedGeometry.coordinates.concat(coordsToAdd);
        totalDistance += segment.distance;
        totalDuration += segment.duration;
        
        allSegmentTypes.push(segment.profile);
    });
    
    let routeType = 'hybrid';
    if (allSegmentTypes.every(type => type === 'walking')) {
        routeType = 'walking';
    } else if (allSegmentTypes.every(type => type === 'cycling')) {
        routeType = 'cycling';
    }
    
    return {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            properties: {
                name: 'Calculated Route',
                distance: totalDistance,
                duration: totalDuration,
                routeType: routeType,
                segments: allSegmentTypes
            },
            geometry: combinedGeometry
        }]
    };
}

/**
 * Merges route segments into a single route
 */
function mergeRouteSegments(routeSegments) {
    if (routeSegments.length === 0) {
        return null;
    }
    
    const combinedGeometry = {
        type: 'LineString',
        coordinates: []
    };
    
    let totalDistance = 0;
    let totalDuration = 0;
    let allSegmentTypes = [];
    
    routeSegments.forEach((segment, index) => {
        const coords = segment.geometry.coordinates;
        const coordsToAdd = index > 0 ? coords.slice(1) : coords;
        
        combinedGeometry.coordinates = combinedGeometry.coordinates.concat(coordsToAdd);
        totalDistance += segment.properties.distance;
        totalDuration += segment.properties.duration;
        
        if (segment.properties.segments) {
            allSegmentTypes = allSegmentTypes.concat(segment.properties.segments);
        } else if (segment.properties.routeType) {
            allSegmentTypes.push(segment.properties.routeType);
        }
    });
    
    let routeType = 'hybrid';
    if (allSegmentTypes.every(type => type === 'walking')) {
        routeType = 'walking';
    } else if (allSegmentTypes.every(type => type === 'cycling')) {
        routeType = 'cycling';
    }
    
    return {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            properties: {
                name: 'Calculated Route',
                distance: totalDistance,
                duration: totalDuration,
                routeType: routeType,
                segments: allSegmentTypes
            },
            geometry: combinedGeometry
        }]
    };
}

/**
 * Adds a route to the map
 */
async function addRouteToMap(routeData) {
    currentRouteData = routeData;
    try {
        const cleanupTasks = [];
        
        if (mainTrackLayer) {
            if (map.getLayer(mainTrackLayer.polylineLayerId)) {
                cleanupTasks.push(new Promise(resolve => {
                    map.removeLayer(mainTrackLayer.polylineLayerId);
                    resolve();
                }));
            }
            if (map.getSource(mainTrackLayer.polylineSourceId)) {
                cleanupTasks.push(new Promise(resolve => {
                    map.removeSource(mainTrackLayer.polylineSourceId);
                    resolve();
                }));
            }
        }
        if (zoomTrackLayer) {
            if (map.getLayer(zoomTrackLayer.polylineLayerId)) {
                cleanupTasks.push(new Promise(resolve => {
                    map.removeLayer(zoomTrackLayer.polylineLayerId);
                    resolve();
                }));
            }
            if (map.getSource(zoomTrackLayer.polylineSourceId)) {
                cleanupTasks.push(new Promise(resolve => {
                    map.removeSource(zoomTrackLayer.polylineSourceId);
                    resolve();
                }));
            }
        }
        if (map.getLayer('routeArrows')) {
            cleanupTasks.push(new Promise(resolve => {
                map.removeLayer('routeArrows');
                resolve();
            }));
        }
        if (map.getSource('arrow-source')) {
            cleanupTasks.push(new Promise(resolve => {
                map.removeSource('arrow-source');
                resolve();
            }));
        }
        
        await Promise.all(cleanupTasks);
        
        if (epc) {
            map.removeControl(epc);
        }

        const [mainTrackResponse, zoomTrackResponse] = await Promise.all([
            maptilersdk.helpers.addPolyline(map, {
                data: routeData,
                lineColor: window.ROUTE_STYLES.ZOOM.COLOR,
                lineWidth: window.ROUTE_STYLES.ZOOM.WIDTH,
                outline: window.ROUTE_STYLES.ZOOM.OUTLINE,
                outlineWidth: window.ROUTE_STYLES.ZOOM.OUTLINE_WIDTH,
                outlineColor: window.ROUTE_STYLES.ZOOM.OUTLINE_COLOR
            }),
            maptilersdk.helpers.addPolyline(map, {
                data: routeData,
                lineColor: window.ROUTE_STYLES.MAIN.COLOR,
                lineWidth: window.ROUTE_STYLES.MAIN.WIDTH,
                outline: window.ROUTE_STYLES.MAIN.OUTLINE,
                outlineWidth: window.ROUTE_STYLES.MAIN.OUTLINE_WIDTH,
                outlineColor: window.ROUTE_STYLES.MAIN.OUTLINE_COLOR
            })
        ]);

        mainTrackLayer = {
            polylineLayerId: mainTrackResponse.polylineLayerId,
            polylineSourceId: mainTrackResponse.polylineSourceId
        };

        zoomTrackLayer = {
            polylineLayerId: zoomTrackResponse.polylineLayerId,
            polylineSourceId: zoomTrackResponse.polylineSourceId
        };

        if (map.hasImage('route-arrow')) {
            createPreciseArrowsSource(routeData);
            map.addLayer({
                id: 'routeArrows',
                type: 'symbol',
                source: 'arrow-source',
                layout: {
                    'icon-image': 'route-arrow',
                    'icon-size': 0.5,
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true,
                    'icon-rotate': ['get', 'bearing'],
                    'icon-rotation-alignment': 'map',
                    'icon-offset': [0, -2]
                },
                paint: {
                    'icon-opacity': 1,
                    'icon-color': '#FFFFFF'
                }
            });
        } else {
            const imageLoadedHandler = () => {
                if (map.hasImage('route-arrow')) {
                    createPreciseArrowsSource(routeData);
                    map.addLayer({
                        id: 'routeArrows',
                        type: 'symbol',
                        source: 'arrow-source',
                        layout: {
                            'icon-image': 'route-arrow',
                            'icon-size': 0.5,
                            'icon-allow-overlap': true,
                            'icon-ignore-placement': true,
                            'icon-rotate': ['get', 'bearing'],
                            'icon-rotation-alignment': 'map',
                            'icon-offset': [0, -2]
                        },
                        paint: {
                            'icon-opacity': 1,
                            'icon-color': '#FFFFFF'
                        }
                    });
                    map.off('data', imageLoadedHandler);
                }
            };
            
            map.on('data', imageLoadedHandler);
        }

        setTimeout(async () => {
            try {
                epc = new maptilerelevationprofilecontrol.ElevationProfileControl({
                    container: "hiddenProfileStorage",
                    visible: true,
                    showButton: false,
                    tooltipTextColor: "#fff",
                    tooltipBackgroundColor: "#0b1215",
                    profileLineColor: "#088373",
                    profileBackgroundColor: "#08837319",
                    elevationGridColor: "#FFF1",
                    crosshairColor: "#088d95",
                    labelColor: "#FFF6",
                    paddingBottom: 0,
                    displayTooltip: true,
                    tooltipDisplayDPlus: false,
                    unit: "metric",
                    onChangeView: (route) => {
                        window._currentRouteCoordinates = route.coordinates;
                        if (zoomTrackLayer?.polylineSourceId) {
                            const source = map.getSource(zoomTrackLayer.polylineSourceId);
                            if (source) {
                                source.setData(route);
                            }
                        }
                    },
                });
        
                map.addControl(epc);
                await epc.setData(routeData);
        
                window._originalRouteCoordinates = routeData.features[0].geometry.coordinates;
        
                requestAnimationFrame(() => {
                    createCustomElevationProfile(routeData);
                    
                    requestAnimationFrame(() => {
                        const loadingIndicator = document.getElementById('profileLoadingIndicator');
                        if (loadingIndicator) {
                            loadingIndicator.style.opacity = '0';
                            loadingIndicator.style.transition = 'opacity 0.2s ease';
                            
                            setTimeout(() => {
                                loadingIndicator.style.display = 'none';
                            }, 200);
                        }
                    });
                });
            } catch (error) {
                console.error('Error creating elevation profile:', error);
            }
        }, 0);

    } catch (error) {
        console.error('Error setting up route visualization:', error);
    }
}

/**
 * Creates precise arrow markers along the route
 */
function createPreciseArrowsSource(routeData) {
    const coordinates = routeData.features[0].geometry.coordinates;
    const arrowFeatures = [];
    
    const currentZoom = map.getZoom();
    const zoomFactor = Math.pow(2.2, (14 - currentZoom));
    
    const baseDistance = 800 * zoomFactor;
    
    const minDistance = Math.max(Math.min(baseDistance, 5000), 150);
    
    const minSegmentLength = Math.max(30, 100 - (currentZoom * 5));
    
    let accumulatedDistance = 0;
    let lastArrowPosition = null;

    for (let i = 1; i < coordinates.length - 1; i++) {
        const prevPoint = coordinates[i - 1];
        const currentPoint = coordinates[i];
        const nextPoint = coordinates[i + 1];

        const segmentDistance = haversineDistance(
            prevPoint[1], prevPoint[0],
            currentPoint[1], currentPoint[0]
        );
        accumulatedDistance += segmentDistance;

        if (accumulatedDistance >= minDistance) {
            const bearing = getBearing(
                [currentPoint[1], currentPoint[0]],
                [nextPoint[1], nextPoint[0]]
            );
            const nextSegmentDistance = haversineDistance(
                currentPoint[1], currentPoint[0],
                nextPoint[1], nextPoint[0]
            );

            if (nextSegmentDistance > minSegmentLength && 
                (!lastArrowPosition || 
                 haversineDistance(
                     lastArrowPosition[1], lastArrowPosition[0],
                     currentPoint[1], currentPoint[0]
                 ) > minDistance / 2)) {
                arrowFeatures.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: currentPoint
                    },
                    properties: {
                        bearing: bearing
                    }
                });
                accumulatedDistance = 0;
                lastArrowPosition = currentPoint;
            }
        }
    }

    map.addSource('arrow-source', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: arrowFeatures
        }
    });
}

let currentRouteData = null;

map.on('zoom', debounce(() => {
    if (map.getSource('arrow-source') && currentRouteData) {
        if (map.getLayer('routeArrows')) {
            map.removeLayer('routeArrows');
        }
        map.removeSource('arrow-source');
        createPreciseArrowsSource(currentRouteData);
        
        const currentZoom = map.getZoom();
        const arrowSize = Math.max(0.12, Math.min(0.3, 0.12 + (currentZoom - 8) * 0.02));
        
        map.addLayer({
            id: 'routeArrows',
            type: 'symbol',
            source: 'arrow-source',
            layout: {
                'icon-image': 'route-arrow',
                'icon-size': arrowSize,
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'icon-rotate': ['get', 'bearing'],
                'icon-rotation-alignment': 'map',
                'icon-offset': [0, 0]
            },
            paint: {
                'icon-opacity': 1,
                'icon-color': '#FFFFFF'
            }
        });
    }
}, 200));

/**
 * Calculates duration based on distance and speed
 */
function calculateDurationBasedOnSpeed(distanceKm) {
    const speedKmh = 9.5;

    const distanceMeters = distanceKm * 1000;
    
    const speedInMetersPerSecond = speedKmh * 1000 / 3600;
    const durationSeconds = distanceMeters / speedInMetersPerSecond;
    
    return durationSeconds;
}