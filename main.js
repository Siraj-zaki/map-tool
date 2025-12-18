// main.js - Core initialization and configuration

// Global variables
let mainTrackLayer = null;
let zoomTrackLayer = null;
let epc = null;
let poiMarkers = new Map(); // To store individual POI markers
const pois = [];
let hoverMarker = null; // To store the hover marker for cleanup

// API Configuration
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoicHVuY2hpbmdtYW4iLCJhIjoiY2p1cjcyMmh2M3NpZDQ5bnEwMDV6ZTE1OSJ9.ef8y6l9fsKFMX91m_Rt2ng';
maptilersdk.config.apiKey = 'V2Q0BdoLHOZBlB3x3AvW';

// Marker configuration
const markerTypes = {
    start: { icon: 'play', color: '#0b1215', size: 36, iconSize: 14 },
    end: { icon: 'flag-checkered', color: '#0b1215', size: 36, iconSize: 14 },
    via: { icon: '', color: '#06599c', size: 0, iconSize: 0 }
};

// Custom clustering variables
const clusterRadius = 60;
const minClusterZoom = 10;
let clusters = new Map();

// Initialize the map
const map = new maptilersdk.Map({
    container: 'map',
    style: 'https://api.maptiler.com/maps/d8ad8b28-d066-4ca5-b809-ec0d8cd488a1/style.json?key=V2Q0BdoLHOZBlB3x3AvW',
    center: [10.34, 51.62],
    zoom: 3,
    terrain: false,
    terrainControl: true
});

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function waitForMapLoad() {
    return new Promise((resolve) => {
        if (map.loaded()) {
            resolve();
        } else {
            map.on('load', resolve);
        }
    });
}

// Map load event
map.on('load', async () => {
    // Add arrow image
    const arrowImage = new Image(24, 24);
    arrowImage.onload = () => {
        map.addImage('route-arrow', arrowImage, { sdf: true });
    };
    arrowImage.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
    <svg id="uuid-527162f2-e3b1-4745-8b5e-f0ec08871d95" data-name="Icons" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">
      <polygon points="14 1 1 27 14 22 27 27 14 1" fill="#fff" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
    </svg>
    `);

    map.on('zoom', debounce(updateClusters, 100));
    updateClusters();

    // Load route from URL parameter after map is loaded
    const urlParams = new URLSearchParams(window.location.search);
    const routeId = urlParams.get('route');
    if (routeId) {
        await loadRoute(routeId);
    }
});

// Initialize event handlers for profile UI components
window.addEventListener('DOMContentLoaded', () => {
    // Expose global functions
    window.closeSidebar = closeSidebar;
    window.prevImage = prevImage;
    window.nextImage = nextImage;
    window.showImage = showImage;
});