// utils.js - Utility functions for calculations and markers

/**
 * Calculate distance using Haversine formula (more accurate than simple Euclidean distance)
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c; // Distance in km
    return d;
}

/**
 * Convert degrees to radians
 */
function deg2rad(deg) {
    return deg * (Math.PI/180);
}

/**
 * Calculate bearing between two points
 */
function getBearing(start, end) {
    const startLat = deg2rad(start[0]);
    const startLng = deg2rad(start[1]);
    const endLat = deg2rad(end[0]);
    const endLng = deg2rad(end[1]);
    const deltaLng = endLng - startLng;
    const y = Math.sin(deltaLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) - 
             Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLng);
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
}

/**
 * Convert degrees to radians
 */
function toRad(value) {
    return value * Math.PI / 180;
}

/**
 * Calculate haversine distance between two points (in meters)
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

/**
 * Find the closest point on a route to a given POI
 */
function findClosestPointOnRoute(poi, routeGeometry) {
    if (!routeGeometry || !routeGeometry.coordinates) return null;

    let minDistance = Infinity;
    let closestPoint = null;

    routeGeometry.coordinates.forEach(coord => {
        const distance = calculateHaversineDistance(poi.lat, poi.lng, coord[1], coord[0]);
        if (distance < minDistance) {
            minDistance = distance;
            closestPoint = coord;
        }
    });

    return {
        distance: minDistance,
        point: closestPoint
    };
}

/**
 * Create a marker at a given location with a specific type
 */
function createMarker(lngLat, type) {
    const el = document.createElement('div');
    el.className = 'marker';
    el.style.backgroundColor = markerTypes[type].color;
    el.style.width = `${markerTypes[type].size}px`;
    el.style.height = `${markerTypes[type].size}px`;
    
    if (type === 'via') {
        const waypointNumber = document.createElement('div');
        waypointNumber.className = 'waypoint-number';
        waypointNumber.textContent = '';
        el.appendChild(waypointNumber);
    } else {
        const icon = document.createElement('i');
        icon.className = `fa-solid fa-${markerTypes[type].icon}`;
        icon.style.fontSize = `${markerTypes[type].iconSize}px`;
        icon.style.color = 'white';
        el.appendChild(icon);
    }

    const marker = new maptilersdk.Marker({
        element: el,
        draggable: false
    })
    .setLngLat(lngLat)
    .addTo(map);

    return marker;
}

/**
 * Create a hover marker at a given location
 */
function createHoverMarker(lngLat) {
    if (hoverMarker) {
        hoverMarker.remove();
    }

    const el = document.createElement('div');
    el.className = 'hover-marker';
    el.style.width = '18px';
    el.style.height = '18px';
    el.style.backgroundColor = 'rgb(8, 14, 17, 0.8)';
    el.style.borderRadius = '50%';
    el.style.border = '2px solid white';
    el.style.boxShadow = '0 0 5px rgba(255, 0, 0, 0.5)';

    hoverMarker = new maptilersdk.Marker({
        element: el,
        offset: [0, 0]
    })
    .setLngLat(lngLat)
    .addTo(map);

    return hoverMarker;
}

/**
 * Creates a custom elevation profile
 */
function createCustomElevationProfile(routeData) {
    // Implementation would be added here based on your specific needs
    // This is a placeholder for the custom elevation profile function
    console.log("Creating custom elevation profile");
    return true;
}