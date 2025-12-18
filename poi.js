// poi.js - POI management and UI interactions

// POI carousel state
let currentImageIndex = 0;
let carouselImages = [];

/**
 * Creates a POI marker on the map
 */

function createPOIsInBatches(pois, batchSize = 20) {
    let index = 0;
    
    function processBatch() {
        const endIndex = Math.min(index + batchSize, pois.length);
        const batch = pois.slice(index, endIndex);
        
        // Process this batch
        batch.forEach(poi => createPOI(poi));
        
        // Update the index
        index = endIndex;
        
        // If there are more POIs to process, schedule the next batch
        if (index < pois.length) {
            setTimeout(processBatch, 0);
        } else {
            // Final cluster update when all batches are done
            updateClusters();
        }
    }
    
    // Start processing the first batch
    processBatch();
}

function createPOI(poi) {
    // Skip processing if marker already exists
    if (poiMarkers.has(poi.id)) {
        return poiMarkers.get(poi.id);
    }

    const el = document.createElement('div');
    el.className = 'poi-marker';

    const poiIcons = {
        'hotel': 'images/hotel.png',
        'restaurant': 'images/restaurant.png',
        'gipfel': 'images/gipfel.png',
        'highlight': 'images/highlight.png'
    };
    
    // Create elements more efficiently using innerHTML instead of DOM manipulation
    el.innerHTML = `
        <div style="position: absolute; width: 40px; height: 15px; bottom: -8px; left: 50%; 
                    transform: translateX(-50%); background: rgba(0, 0, 0, 0.3); border-radius: 50%; 
                    filter: blur(5px); z-index: 1;"></div>
        <img src="${poiIcons[poi.type] || '/iconbike.png'}" 
             style="width: 48px; height: 48px; position: relative; z-index: 2;">
    `;

    const marker = new maptilersdk.Marker({
        element: el,
        draggable: false,
        offset: [0, -24]
    })
    .setLngLat([parseFloat(poi.lng), parseFloat(poi.lat)])
    .addTo(map);

    poi.marker = marker;
    poiMarkers.set(poi.id, marker);

    el.addEventListener('click', () => openSidebar(poi));

    // Don't update clusters for every POI - we'll do a single update after batch
    return marker;
}

/**
 * Updates clusters on the map based on POI proximity
 */
function updateClusters() {
    // Exit early for high zoom levels
    if (map.getZoom() > minClusterZoom) {
        poiMarkers.forEach(marker => {
            marker.getElement().classList.remove('clustered');
            marker.getElement().style.display = 'block';
        });
        
        // Remove existing clusters
        clusters.forEach(cluster => cluster.marker.remove());
        clusters.clear();
        return;
    }

    // Remove existing clusters
    clusters.forEach(cluster => cluster.marker.remove());
    clusters.clear();

    const pixelClusters = new Map();
    const markersArray = Array.from(poiMarkers.entries());
    
    // Use spatial hashing for faster clustering
    const gridSize = clusterRadius;
    const gridCells = new Map();
    
    // First pass: assign markers to grid cells
    markersArray.forEach(([id, marker]) => {
        const coords = map.project(marker.getLngLat());
        
        // Calculate grid cell coordinates
        const cellX = Math.floor(coords.x / gridSize);
        const cellY = Math.floor(coords.y / gridSize);
        const cellKey = `${cellX}:${cellY}`;
        
        if (!gridCells.has(cellKey)) {
            gridCells.set(cellKey, []);
        }
        
        gridCells.get(cellKey).push({ id, marker, coords });
    });
    
    // Second pass: check neighboring cells for clusters
    const processed = new Set();
    
    gridCells.forEach((cellMarkers, cellKey) => {
        cellMarkers.forEach(markerData => {
            if (processed.has(markerData.id)) return;
            
            const [cellX, cellY] = cellKey.split(':').map(Number);
            const nearbyMarkers = [markerData];
            processed.add(markerData.id);
            
            // Check only immediate neighboring cells
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue; // Skip self
                    
                    const neighborKey = `${cellX + dx}:${cellY + dy}`;
                    const neighborCell = gridCells.get(neighborKey);
                    
                    if (!neighborCell) continue;
                    
                    // Check each marker in the neighboring cell
                    neighborCell.forEach(neighborData => {
                        if (processed.has(neighborData.id)) return;
                        
                        const dx = markerData.coords.x - neighborData.coords.x;
                        const dy = markerData.coords.y - neighborData.coords.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance < clusterRadius) {
                            nearbyMarkers.push(neighborData);
                            processed.add(neighborData.id);
                        }
                    });
                }
            }
            
            // Create a cluster if we have multiple markers
            if (nearbyMarkers.length > 1) {
                // Calculate center position
                let sumX = 0, sumY = 0;
                nearbyMarkers.forEach(data => {
                    sumX += data.coords.x;
                    sumY += data.coords.y;
                });
                
                const centerX = sumX / nearbyMarkers.length;
                const centerY = sumY / nearbyMarkers.length;
                const lngLat = map.unproject([centerX, centerY]);
                
                // Create cluster element
                const clusterEl = document.createElement('div');
                clusterEl.className = 'maptiler-cluster';
                clusterEl.innerHTML = `<span class="poi-cluster-count">${nearbyMarkers.length}</span>`;
                
                const clusterMarker = new maptilersdk.Marker({
                    element: clusterEl,
                    offset: [0, 0]
                })
                .setLngLat(lngLat)
                .addTo(map);
                
                // Handle click event
                clusterEl.addEventListener('click', () => {
                    map.easeTo({
                        center: lngLat,
                        zoom: map.getZoom() + 2
                    });
                });
                
                // Hide individual markers
                nearbyMarkers.forEach(data => {
                    data.marker.getElement().classList.add('clustered');
                    data.marker.getElement().style.display = 'none';
                });
                
                // Store the cluster
                clusters.set(markerData.id, {
                    marker: clusterMarker,
                    markers: nearbyMarkers.map(data => ({ id: data.id, marker: data.marker }))
                });
            } else {
                // Single marker, make it visible
                markerData.marker.getElement().classList.remove('clustered');
                markerData.marker.getElement().style.display = 'block';
            }
        });
    });
}


/**
 * Opens the sidebar with POI information
 */
function openSidebar(poi) {
    const sidebar = document.getElementById('poi-sidebar');
    const content = document.getElementById('poi-content');
    
    currentImageIndex = 0;
    carouselImages = poi.images || [];
    
    let imageCarouselHtml = '';
    if (carouselImages.length > 0) {
        imageCarouselHtml = `
            <div class="poi-hero">
                <button class="close-button" onclick="closeSidebar()">
                    <i class="fas fa-times"></i>
                </button>
                <div class="image-carousel" id="imageCarousel">
                    <div class="carousel-container">
                        ${carouselImages.map((image, index) => `
                            <img src="${image}" 
                                 alt="${poi.name}" 
                                 class="carousel-image" 
                                 style="display: ${index === 0 ? 'block' : 'none'}" 
                                 data-index="${index}"
                                 onerror="this.src='/api/placeholder/400/320'">
                        `).join('')}
                    </div>
                    ${carouselImages.length > 1 ? `
                        <button class="carousel-button prev" onclick="prevImage()">❮</button>
                        <button class="carousel-button next" onclick="nextImage()">❯</button>
                        <div class="carousel-dots">
                            ${carouselImages.map((_, index) => `
                                <span class="dot ${index === 0 ? 'active' : ''}" 
                                      onclick="showImage(${index})"></span>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="poi-hero-overlay">
                    <h1 class="poi-hero-title">${poi.name}</h1>
                    ${poi.elevation ? `<div class="poi-hero-elevation">${poi.elevation} m</div>` : ''}
                </div>
            </div>`;
    } else {
        imageCarouselHtml = `
            <div class="poi-hero">
                <button class="close-button" onclick="closeSidebar()">
                    <i class="fas fa-times"></i>
                </button>
                <img src="/api/placeholder/400/320" alt="${poi.name}">
                <div class="poi-hero-overlay">
                    <h1 class="poi-hero-title">${poi.name}</h1>
                    ${poi.elevation ? `<div class="poi-hero-elevation">${poi.elevation} m</div>` : ''}
                </div>
            </div>`;
    }

    let routeDistance = null;
    if (mainTrackLayer && mainTrackLayer.polylineSourceId) {
        const routeSource = map.getSource(mainTrackLayer.polylineSourceId);
        if (routeSource) {
            const routeData = routeSource._data;
            const closestPointInfo = findClosestPointOnRoute(poi, routeData.features[0].geometry);
            if (closestPointInfo) {
                routeDistance = closestPointInfo.distance.toFixed(1);
            }
        }
    }

    const bestTimeTranslations = {
        'morning': 'Morgens',
        'noon': 'Mittags',
        'afternoon': 'Nachmittags',
        'evening': 'Abends',
        'allday': 'Ganztägig'
    };

    const translatedBestTime = bestTimeTranslations[poi.best_time] || poi.best_time;

    content.innerHTML = `
        ${imageCarouselHtml}
        <div class="poi-category-nav">
            <div class="category-buttons">
                <button class="category-btn active" data-category="overview">
                    <i class="fas fa-info-circle"></i>
                    <span>Überblick</span>
                </button>
                <button class="category-btn" data-category="facilities">
                    <i class="fas fa-wrench"></i>
                    <span>Ausstattung & Service</span>
                </button>
                <button class="category-btn" data-category="location">
                    <i class="fas fa-map-pin"></i>
                    <span>Standort</span>
                </button>
            </div>
            <div class="category-content">
                <div class="category-panel active" id="overview-panel">
                    <p class="poi-description">${poi.description || 'Keine Beschreibung verfügbar.'}</p>
                    ${poi.best_time ? `
                        <div class="poi-additional-info">
                            <div class="poi-info-item">
                                <i class="fas fa-clock"></i>
                                <span>Beste Besuchszeit: ${translatedBestTime}</span>
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="category-panel" id="facilities-panel">
                    ${poi.amenities && poi.amenities.length > 0 ? `
                        <div class="poi-amenities-grid">
                            ${poi.amenities.map(amenity => `
                                <div class="poi-amenity-item">
                                    <i class="fas ${getAmenityIcon(amenity)}"></i>
                                    <span>${getAmenityLabel(amenity)}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : 'Keine Ausstattungsinformationen verfügbar.'}
                </div>
                <div class="category-panel" id="location-panel">
                    <div class="location-coordinates">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>Koordinaten: ${poi.lng.toFixed(2)}, ${poi.lat.toFixed(2)}</span>
                    </div>
                    ${routeDistance !== null ? `
                        <div class="route-distance-info">
                            <p><i class="fas fa-route"></i>Entfernung zur Route: ${routeDistance} km</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    const categoryButtons = content.querySelectorAll('.category-btn');
    const categoryPanels = content.querySelectorAll('.category-panel');

    categoryButtons.forEach(button => {
        button.addEventListener('click', () => {
            const category = button.getAttribute('data-category');
            categoryButtons.forEach(btn => btn.classList.remove('active'));
            categoryPanels.forEach(panel => panel.classList.remove('active'));
            button.classList.add('active');
            content.querySelector(`#${category}-panel`).classList.add('active');
        });
    });

    sidebar.classList.add('visible');
}

/**
 * Closes the sidebar
 */
function closeSidebar() {
    const sidebar = document.getElementById('poi-sidebar');
    sidebar.classList.remove('visible');
    currentImageIndex = 0;
    carouselImages = [];
}

/**
 * Shows an image at the specified index in the carousel
 */
function showImage(index) {
    const images = document.querySelectorAll('.carousel-image');
    const dots = document.querySelectorAll('.dot');
    
    if (!images.length || index === currentImageIndex) return;
    
    images[currentImageIndex].style.display = 'none';
    if (dots[currentImageIndex]) {
        dots[currentImageIndex].classList.remove('active');
    }
    
    currentImageIndex = index;
    images[currentImageIndex].style.display = 'block';
    if (dots[currentImageIndex]) {
        dots[currentImageIndex].classList.add('active');
    }
}

/**
 * Moves to the next image in the carousel
 */
function nextImage() {
    const totalImages = carouselImages.length;
    if (totalImages <= 1) return;
    const nextIndex = (currentImageIndex + 1) % totalImages;
    showImage(nextIndex);
}

/**
 * Moves to the previous image in the carousel
 */
function prevImage() {
    const totalImages = carouselImages.length;
    if (totalImages <= 1) return;
    const prevIndex = (currentImageIndex - 1 + totalImages) % totalImages;
    showImage(prevIndex);
}

/**
 * Gets the appropriate icon for an amenity
 */
function getAmenityIcon(amenity) {
    const icons = {
        'wc': 'fa-restroom',
        'food': 'fa-utensils',
        'charging': 'fa-charging-station',
        'difficulty': 'fa-mountain'
    };
    return icons[amenity] || 'fa-circle';
}

/**
 * Gets the appropriate label for an amenity
 */
function getAmenityLabel(amenity) {
    const labels = {
        'wc': 'Toilette',
        'food': 'Verpflegung',
        'charging': 'E-Bike Ladestation',
        'difficulty': 'Schwierigkeit'
    };
    return labels[amenity] || amenity;
}

/**
 * Add POI markers to elevation profile
 */
function addPOIMarkersToProfile(visibleRoute) {
    const relevantPOIs = pois.filter(poi => 
        poi.type === 'highlight' || poi.type === 'gipfel'
    );

    if (relevantPOIs.length === 0) return;

    const routeCoordinates = visibleRoute?.coordinates || (currentRouteData ? currentRouteData.features[0].geometry.coordinates : []);
    const totalPoints = routeCoordinates.length;

    const visibleStartIndex = visibleRoute?.startIndex || 0;
    const visibleEndIndex = visibleRoute?.endIndex || (routeCoordinates.length - 1);
    const visibleRange = visibleEndIndex - visibleStartIndex;

    if (visibleRange <= 0) return;

    let markerContainer = document.querySelector('.elevation-profile-markers');
    if (!markerContainer) {
        markerContainer = document.createElement('div');
        markerContainer.className = 'elevation-profile-markers';
        markerContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 5;
        `;
        document.getElementById('profileContainer').appendChild(markerContainer);
    }

    markerContainer.innerHTML = '';

    relevantPOIs.forEach(poi => {
        const routeGeometry = currentRouteData ? currentRouteData.features[0].geometry : null;
        const closestPointInfo = findClosestPointOnRoute(poi, routeGeometry);
        if (!closestPointInfo || !closestPointInfo.point) return;

        let visibleIndex = -1;
        for (let i = 0; i < routeCoordinates.length; i++) {
            if (routeCoordinates[i][0] === closestPointInfo.point[0] && 
                routeCoordinates[i][1] === closestPointInfo.point[1]) {
                visibleIndex = i;
                break;
            }
        }

        if (visibleIndex < visibleStartIndex || visibleIndex > visibleEndIndex) return;

        const relativeIndex = visibleIndex - visibleStartIndex;
        const positionPercent = (relativeIndex / visibleRange) * 100;

        const indicator = document.createElement('div');
        indicator.className = 'profile-poi-indicator';
        indicator.style.position = 'absolute';
        indicator.style.left = `${positionPercent}%`;
        indicator.style.bottom = '30px';
        indicator.style.zIndex = '10';
        indicator.style.width = '24px';
        indicator.style.height = '24px';
        indicator.style.cursor = 'pointer';
        indicator.style.transition = 'transform 0.2s ease';
        indicator.style.transform = 'translate(-50%, 0)';

        let iconUrl;
        if (poi.type === 'highlight') {
            iconUrl = 'images/highlight_profil.png';
        } else if (poi.type === 'gipfel') {
            iconUrl = 'images/gipfel_profil.png';
        }

        const img = document.createElement('img');
        img.src = iconUrl;
        img.alt = poi.name;
        img.title = poi.name;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';

        indicator.addEventListener('mouseover', () => {
            indicator.style.transform = 'translate(-50%, 0) scale(1.2)';
            const tooltip = document.createElement('div');
            tooltip.className = 'profile-poi-tooltip';
            tooltip.textContent = poi.name;
            tooltip.style.position = 'absolute';
            tooltip.style.bottom = '30px';
            tooltip.style.left = '50%';
            tooltip.style.transform = 'translateX(-50%)';
            tooltip.style.backgroundColor = '#0b1215';
            tooltip.style.color = '#fff';
            tooltip.style.padding = '4px 8px';
            tooltip.style.borderRadius = '4px';
            tooltip.style.fontSize = '12px';
            tooltip.style.whiteSpace = 'nowrap';
            tooltip.style.pointerEvents = 'none';
            tooltip.style.zIndex = '20';
            tooltip.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
            indicator.appendChild(tooltip);
            createHoverMarker([poi.lng, poi.lat]);
        });

        indicator.addEventListener('mouseout', () => {
            indicator.style.transform = 'translate(-50%, 0)';
            const tooltip = indicator.querySelector('.profile-poi-tooltip');
            if (tooltip) tooltip.remove();
            if (hoverMarker) {
                hoverMarker.remove();
                hoverMarker = null;
            }
        });

        indicator.addEventListener('click', () => {
            map.flyTo({
                center: [poi.lng, poi.lat],
                zoom: 14,
                duration: 1000
            });
        });

        indicator.addEventListener('touchend', (e) => {
            e.preventDefault();
            map.flyTo({
                center: [poi.lng, poi.lat],
                zoom: 14,
                duration: 1000
            });
        });

        indicator.appendChild(img);
        markerContainer.appendChild(indicator);
    });
}