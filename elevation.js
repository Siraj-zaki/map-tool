// Enhanced createCustomElevationProfile function with hover functionality and proper clipping
function createCustomElevationProfile(routeData) {
    const container = document.getElementById('customProfileContainer');
    const loadingIndicator = document.getElementById('profileLoadingIndicator');

    const COLORS = window.ROUTE_STYLES ? {
        MAIN_ROUTE: window.ROUTE_STYLES.MAIN.COLOR,
        ZOOM_ROUTE: window.ROUTE_STYLES.ZOOM.COLOR,
        PROFILE_LINE: window.ROUTE_STYLES.ELEVATION.PROFILE_LINE,
        PROFILE_AREA: window.ROUTE_STYLES.ELEVATION.PROFILE_AREA,
        CROSSHAIR: window.ROUTE_STYLES.ELEVATION.CROSSHAIR,
        OUT_OF_VIEW_LINE: window.ROUTE_STYLES.ELEVATION.OUT_OF_VIEW_LINE,
        OUT_OF_VIEW_AREA: window.ROUTE_STYLES.ELEVATION.OUT_OF_VIEW_AREA,
        MARKER_FILL: window.ROUTE_STYLES.ELEVATION.MARKER_FILL,
        MARKER_STROKE: window.ROUTE_STYLES.ELEVATION.MARKER_STROKE,
        GRID_LINES: window.ROUTE_STYLES.ELEVATION.GRID_LINES,
        TEXT_COLOR: window.ROUTE_STYLES.ELEVATION.TEXT_COLOR,
        TOOLTIP_BG: window.ROUTE_STYLES.ELEVATION.TOOLTIP_BG,
        TOOLTIP_TEXT: window.ROUTE_STYLES.ELEVATION.TOOLTIP_TEXT,
        POI_LINE: window.ROUTE_STYLES.ELEVATION.POI_LINE
    } : {
        MAIN_ROUTE: '#088373',
        ZOOM_ROUTE: '#808080',
        PROFILE_LINE: '#088373',
        PROFILE_AREA: 'rgba(8, 131, 115, 0.15)',
        CROSSHAIR: '#088D95',
        OUT_OF_VIEW_LINE: '#808080',
        OUT_OF_VIEW_AREA: 'rgba(128, 128, 128, 0.15)',
        MARKER_FILL: '#088D95',
        MARKER_STROKE: '#FFFFFF',
        GRID_LINES: 'rgba(255, 255, 255, 0.1)',
        TEXT_COLOR: 'var(--text-secondary)',
        TOOLTIP_BG: 'rgba(11, 18, 21, 0.9)',
        TOOLTIP_TEXT: '#FFFFFF',
        POI_LINE: 'rgba(255, 255, 255, 0.3)'
    };

    // Preserve loading indicator if it exists
    if (loadingIndicator) {
        // Remove everything except the loading indicator
        Array.from(container.children).forEach(child => {
            if (child.id !== 'profileLoadingIndicator') {
                child.remove();
            }
        });
    } else {
        // If no loading indicator, just clear everything
        container.innerHTML = '';
    }
    
    // Add tooltip container back after clearing
    container.insertAdjacentHTML('beforeend', '<div class="custom-tooltip"></div>');
    
    // Ensure the container is visible
    container.style.display = 'block';

    // Get container dimensions with fallbacks
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 140;
    
    // Professional margins for proper axis display
    const margin = { top: 10, right: 10, bottom: 25, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Get route details from the existing MapTiler profile
    const routeDistance = parseFloat(document.getElementById('route-distance')?.textContent) || 0;
    const lowestPoint = parseInt(document.getElementById('route-lowest')?.textContent) || 0;
    const highestPoint = parseInt(document.getElementById('route-highest')?.textContent) || 0;
    
    // Get elevation data directly from the MapTiler profile
    let elevationData = [];
    
    // Try to access route coordinates from the global variable
    if (epc) {
        try {
            // Extract the coordinates with elevation
            let coordinates = [];
            
            // First try window._currentRouteCoordinates which should contain the current view
            if (window._currentRouteCoordinates && window._currentRouteCoordinates.length > 0) {
                coordinates = window._currentRouteCoordinates;
            } 
            // Fall back to original coordinates
            else if (window._originalRouteCoordinates && window._originalRouteCoordinates.length > 0) {
                coordinates = window._originalRouteCoordinates;
            }
            
            // Process coordinates to match MapTiler's visualization
            const sampleStep = coordinates.length > 2000 ? Math.floor(coordinates.length / 2000) : 1;
            let accumulatedDistance = 0;
            
            for (let i = 0; i < coordinates.length; i += sampleStep) {
                if (i > 0) {
                    const prev = coordinates[i - sampleStep];
                    const curr = coordinates[i];
                    // Calculate real distances if we have lat/lng
                    if (prev.length >= 2 && curr.length >= 2) {
                        const segmentDist = calculateDistance(prev[1], prev[0], curr[1], curr[0]);
                        accumulatedDistance += segmentDist;
                    } else {
                        // Otherwise use proportional distance
                        accumulatedDistance = (i / coordinates.length) * routeDistance;
                    }
                }
                
                // Get elevation data (third coordinate)
                let elevation = coordinates[i].length > 2 ? coordinates[i][2] : null;
                
                // If no elevation, use MapTiler's value if available
                if (elevation === null || isNaN(elevation)) {
                    elevation = lowestPoint + (Math.random() * (highestPoint - lowestPoint));
                }
                
                elevationData.push({
                    distance: accumulatedDistance / 1000, // km
                    elevation: elevation,
                    index: i,
                    original: {
                        distance: accumulatedDistance / 1000
                    }
                });
            }
            
            // Ensure our data spans the full route distance
            const dataMaxDist = elevationData[elevationData.length - 1].distance;
            if (Math.abs(dataMaxDist - routeDistance) > 0.5) {
                // Rescale all distances to match exactly
                const scaleFactor = routeDistance / dataMaxDist;
                elevationData.forEach(d => {
                    d.distance *= scaleFactor;
                    d.original.distance = d.distance; // Store original distance for zooming
                });
            }
        } catch (error) {
            console.error("Error accessing MapTiler elevation data:", error);
            // Handle fallback - empty elevation data will be filled with fallback below
        }
    }
    
    // Fallback if we couldn't get MapTiler's data
    if (elevationData.length === 0) {
        console.log("Using fallback elevation data");
        // Generate synthetic data points to match the route distance
        const pointCount = 1000;
        for (let i = 0; i < pointCount; i++) {
            const dist = (i / (pointCount - 1)) * routeDistance;
            const ele = generateSyntheticElevation(dist, routeDistance, lowestPoint, highestPoint);
            elevationData.push({
                distance: dist,
                elevation: ele,
                index: i,
                original: {
                    distance: dist
                }
            });
        }
    }

    // Create responsive SVG that will resize with container
    const svg = d3.select(container)
        .append('svg')
        .attr('class', 'custom-profile-svg')
        .attr('width', '100%')  // Use percentage for width
        .attr('height', '100%') // Use percentage for height
        .attr('viewBox', `0 0 ${width} ${height}`) // Set viewBox for scaling
        .attr('preserveAspectRatio', 'xMidYMid meet') // Preserve aspect ratio
        .style('overflow', 'visible');
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Create a clip path for chart elements, but maintain the same chart container
    // This ensures we don't cut off elements at the boundary, only clip what's inside
    svg.append('defs')
        .append('clipPath')
        .attr('id', 'chart-area-clip')
        .append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', innerWidth)
        .attr('height', innerHeight);
    
    // Create a chart content group with clipping applied
    const chartContent = g.append('g')
        .attr('class', 'chart-content')
        .attr('clip-path', 'url(#chart-area-clip)');
    
    // Calculate actual elevation range from data
    const minElevation = Math.min(lowestPoint, d3.min(elevationData, d => d.elevation));
    const maxElevation = Math.max(highestPoint, d3.max(elevationData, d => d.elevation));
    
    // Add padding to elevation range (10%)
    const elevationRange = maxElevation - minElevation;
    const paddedMin = Math.max(0, minElevation - elevationRange * 0.05);
    const paddedMax = maxElevation + elevationRange * 0.05;

    // =====================
    // ZOOM FUNCTIONALITY
    // =====================
    
    // Store the visible domain (what part of the chart is shown)
    const visibleDomain = {
        x: [0, routeDistance], // Initial domain shows full route
        y: [paddedMin, paddedMax]
    };
    
    // Maximum zoom level (e.g. 10x zoom)
    const MAX_ZOOM = 10; 
    
    // Current zoom level
    let zoomLevel = 1;
    
    // Create scales with the initial domain
    const xScale = d3.scaleLinear()
        .domain(visibleDomain.x)
        .range([0, innerWidth]);
    
    const yScale = d3.scaleLinear()
        .domain(visibleDomain.y)
        .range([innerHeight, 0]);
    
    // Create axis groups that will be updated during zoom
    const xAxisGroup = g.append('g')
        .attr('class', 'axis x-axis')
        .attr('transform', `translate(0,${innerHeight})`);
    
    const yAxisGroup = g.append('g')
        .attr('class', 'axis y-axis');
    
    const gridGroup = chartContent.append('g')
        .attr('class', 'grid y-grid');

        // Add zoom indicator text to top right
        const zoomText = svg.append('text')
    .attr('class', 'zoom-text')
    .attr('x', width - 15)
    .attr('y', 25)
    .attr('text-anchor', 'end')
    .attr('fill', 'rgba(255, 255, 255, 0.6)') // Text color
    .attr('stroke', 'black') // Outline color
    .attr('stroke-width', 2) // Thickness of the outline
    .attr('paint-order', 'stroke') // Ensures stroke appears outside
    .style('font-size', '14px')
    .style('cursor', 'pointer')
    .text('Zoom');

    
// Function to update the chart with new domain
// Modified updateChart function to handle mobile view
function updateChart() {
    // Update scales with new domains
    xScale.domain(visibleDomain.x);
    
    // Generate nicer tick values
    function generateNiceTicks(min, max, count = 5) {
        const range = max - min;
        const roughStep = range / (count - 1);
        const goodSteps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
        
        // Find nice step size
        let step = goodSteps[0];
        for (let i = 1; i < goodSteps.length; i++) {
            if (goodSteps[i] < roughStep) {
                step = goodSteps[i];
            } else {
                break;
            }
        }
        
        // Generate ticks
        const firstTick = Math.ceil(min / step) * step;
        const ticks = [];
        for (let i = firstTick; i <= max; i += step) {
            ticks.push(i);
        }
        return ticks;
    }
    
    // Detect if we're in mobile view
    const isMobile = window.innerWidth < 768;
    
    // Generate x-axis ticks based on current domain width and device width
    const domainWidth = visibleDomain.x[1] - visibleDomain.x[0];
    let xTickInterval;
    
    if (isMobile) {
        // Use larger intervals for mobile (approximately half as many ticks)
        if (domainWidth > 100) xTickInterval = 40;
        else if (domainWidth > 50) xTickInterval = 20;
        else if (domainWidth > 20) xTickInterval = 10;
        else if (domainWidth > 10) xTickInterval = 4;
        else if (domainWidth > 5) xTickInterval = 2;
        else if (domainWidth > 2) xTickInterval = 1;
        else xTickInterval = 0.5;
    } else {
        // Desktop tick intervals (unchanged)
        if (domainWidth > 100) xTickInterval = 20;
        else if (domainWidth > 50) xTickInterval = 10;
        else if (domainWidth > 20) xTickInterval = 5;
        else if (domainWidth > 10) xTickInterval = 2;
        else if (domainWidth > 5) xTickInterval = 1;
        else if (domainWidth > 2) xTickInterval = 0.5;
        else xTickInterval = 0.2;
    }
    
    const xTicks = [];
    const startTick = Math.ceil(visibleDomain.x[0] / xTickInterval) * xTickInterval;
    for (let i = startTick; i <= visibleDomain.x[1]; i += xTickInterval) {
        xTicks.push(i);
    }
    
    // Generate y-axis ticks
    const yTicks = generateNiceTicks(visibleDomain.y[0], visibleDomain.y[1]);
    
    // Create new line and area generators
    const line = d3.line()
        .x(d => xScale(d.distance))
        .y(d => yScale(d.elevation))
        .curve(d3.curveCatmullRom.alpha(0.5));
    
    const area = d3.area()
        .x(d => xScale(d.distance))
        .y0(innerHeight)
        .y1(d => yScale(d.elevation))
        .curve(d3.curveCatmullRom.alpha(0.5));
    
    // Update axes with mobile optimization
    xAxisGroup.call(d3.axisBottom(xScale)
        .tickValues(xTicks)
        .tickFormat(d => `${d.toFixed(isMobile ? 0 : 1)} km`) // Remove decimal on mobile
        .tickSize(0))
        .call(g => g.select('.domain').remove())
        .call(g => g.selectAll('text')
            .attr('fill', 'var(--text-secondary)')
            .attr('dy', '1em')
            .attr('font-size', isMobile ? '9px' : '10px')); // Slightly smaller font on mobile
    
    // Rest of the function remains the same
    yAxisGroup.call(d3.axisLeft(yScale)
        .tickValues(yTicks)
        .tickFormat(d => `${Math.round(d)} m`)
        .tickSize(0))
        .call(g => g.select('.domain').remove())
        .call(g => g.selectAll('text')
            .attr('fill', 'var(--text-secondary)')
            .attr('font-size', '10px'));
    
    // Update grid lines
    gridGroup.call(d3.axisLeft(yScale)
        .tickValues(yTicks)
        .tickSize(-innerWidth)
        .tickFormat(''))
        .call(g => g.select('.domain').remove())
        .call(g => g.selectAll('.tick line')
            .attr('stroke', 'rgba(255,255,255,0.1)')
            .attr('stroke-dasharray', '2,2'));
    
    // Filter data into three sets: pre-view, in-view, and post-view
    const preViewData = elevationData.filter(d => d.distance < visibleDomain.x[0]);
    const inViewData = elevationData.filter(d => 
        d.distance >= visibleDomain.x[0] && d.distance <= visibleDomain.x[1]
    );
    const postViewData = elevationData.filter(d => d.distance > visibleDomain.x[1]);
    
    // Include buffer points at domain boundaries to ensure smooth transitions
    if (preViewData.length > 0 && inViewData.length > 0) {
        const lastPrePoint = preViewData[preViewData.length - 1];
        inViewData.unshift(lastPrePoint); // Add last pre-view point to start of in-view
    }
    
    if (postViewData.length > 0 && inViewData.length > 0) {
        const firstPostPoint = postViewData[0];
        inViewData.push(firstPostPoint); // Add first post-view point to end of in-view
    }
    
    // Remove existing paths
    chartContent.selectAll('.line, .area, .out-of-view-line').remove();
    
    // Add out-of-view (gray) area for pre-view
    if (preViewData.length > 0) {
        // Create the connecting point at the boundary
        const boundaryPointPre = {...preViewData[preViewData.length - 1]};
        boundaryPointPre.distance = visibleDomain.x[0]; // Extend to exact boundary
        
        const preViewDataWithBoundary = [...preViewData, boundaryPointPre];
        
        chartContent.append('path')
            .datum(preViewDataWithBoundary)
            .attr('class', 'area out-of-view-area pre-view')
            .attr('fill', 'rgba(128, 128, 128, 0.15)') // Gray with transparency
            .attr('d', area);
            
            chartContent.append('path')
            .datum(elevationData)
            .attr('class', 'line')
            .attr('fill', 'none')
            .attr('stroke', COLORS.PROFILE_LINE) 
            .attr('stroke-width', 2)
            .attr('d', line);
    }
    
    // Add out-of-view (gray) area for post-view
    if (postViewData.length > 0) {
        // Create the connecting point at the boundary
        const boundaryPointPost = {...postViewData[0]};
        boundaryPointPost.distance = visibleDomain.x[1]; 
        
        const postViewDataWithBoundary = [boundaryPointPost, ...postViewData];
        
        chartContent.append('path')
            .datum(postViewDataWithBoundary)
            .attr('class', 'area out-of-view-area post-view')
            .attr('fill', 'rgba(128, 128, 128, 0.15)') 
            .attr('d', area);
            
        chartContent.append('path')
            .datum(postViewDataWithBoundary)
            .attr('class', 'line out-of-view-line post-view')
            .attr('fill', 'none')
            .attr('stroke', '#808080') 
            .attr('stroke-width', 2)
            .attr('d', line);
    }
    
    // Add in-view area (normal color)
    chartContent.append('path')
        .datum(inViewData)
        .attr('class', 'area')
        .attr('fill', 'rgba(8, 131, 115, 0.15)') 
        .attr('d', area);
    
    // Add in-view line (normal color)
    chartContent.append('path')
        .datum(inViewData)
        .attr('class', 'line')
        .attr('fill', 'none')
        .attr('stroke', '#088373') 
        .attr('stroke-width', 2)
        .attr('d', line);
    
    // Add boundary indicators at zoom edges if zoomed in
    if (zoomLevel > 1) {
        g.selectAll('.boundary-indicator').remove();
        
        // Add invisible boundary indicators - functionality is maintained without visible lines
        g.append('line')
            .attr('class', 'boundary-indicator left')
            .attr('x1', xScale(visibleDomain.x[0]))
            .attr('y1', 0)
            .attr('x2', xScale(visibleDomain.x[0]))
            .attr('y2', innerHeight)
            .attr('stroke', 'transparent') // Make invisible but keep it in the DOM
            .attr('stroke-width', 2);
            
        // Right boundary indicator (invisible)
        g.append('line')
            .attr('class', 'boundary-indicator right')
            .attr('x1', xScale(visibleDomain.x[1]))
            .attr('y1', 0)
            .attr('x2', xScale(visibleDomain.x[1]))
            .attr('y2', innerHeight)
            .attr('stroke', 'transparent') // Make invisible but keep it in the DOM
            .attr('stroke-width', 2);
            
        // Change the indicator text to "Reset"
        zoomText.text("Reset")
            .attr('class', 'zoom-text reset')
            .on('click', resetZoom);
    } else {
        // Remove indicators at zoom level 1
        g.selectAll('.boundary-indicator').remove();
        
        // Change indicator text to "Zoom"
        zoomText.text("Zoom")
            .attr('class', 'zoom-text')
            .on('click', null); // Remove click handler at zoom level 1
    }
    
    // Update POI markers if they exist - immediate update without delay
    g.selectAll('.poi-marker').each(function() {
        const marker = d3.select(this);
        const markerData = marker.datum();
        
        if (markerData) {
            // Calculate new position
            const xPos = xScale(markerData.distance);
            const yPos = yScale(markerData.elevation);
            
            // Apply transform immediately without transition
            marker.attr('transform', `translate(${xPos},${yPos})`);
            
            // Update vertical line length based on new scale
            marker.select('line')
                .attr('y2', yScale.range()[0] - yScale(markerData.elevation));
            
            // Calculate if the POI is in view
            const isInView = markerData.distance >= visibleDomain.x[0] && 
                             markerData.distance <= visibleDomain.x[1];
            
            // Show/hide based on visibility - immediate
            marker.style('display', isInView ? 'block' : 'none');
        }
    });
    
    // Update the crosshair and marker position too if they're visible
    if (crosshair.style('opacity') > 0) {
        // Find the closest point to the current mouse position
        const mouseX = parseFloat(crosshair.attr('x1'));
        const mouseDistance = xScale.invert(mouseX);
        
        // Find closest point
        let closestPoint = elevationData[0];
        let minDist = Math.abs(closestPoint.distance - mouseDistance);
        
        for (let i = 1; i < elevationData.length; i++) {
            const dist = Math.abs(elevationData[i].distance - mouseDistance);
            if (dist < minDist) {
                closestPoint = elevationData[i];
                minDist = dist;
            }
        }
        
        // Update position
        const xPos = xScale(closestPoint.distance);
        const yPos = yScale(closestPoint.elevation);
        
        crosshair.attr('x1', xPos).attr('x2', xPos);
        marker.attr('cx', xPos).attr('cy', yPos);
    }
}

// Function to handle zoom
function handleZoom(event) {
    if (!event) return;
    
    event.preventDefault();
    
    // Get mouse position relative to the chart
    let mouseX;
    if (event.clientX !== undefined) {
        const svgPoint = svg.node().createSVGPoint();
        svgPoint.x = event.clientX;
        svgPoint.y = 0; // Y doesn't matter much for this profile
        
        // Transform client coordinates to SVG coordinates
        const transformedPoint = svgPoint.matrixTransform(g.node().getScreenCTM().inverse());
        mouseX = transformedPoint.x;
    } else {
        [mouseX] = d3.pointer(event, overlay.node());
    }
    
    const mouseDistance = xScale.invert(mouseX);
    
    // Calculate new zoom level
    const zoomChange = event.deltaY < 0 ? 1.2 : 0.8; // Zoom in or out
    const newZoomLevel = Math.max(1, Math.min(MAX_ZOOM, zoomLevel * zoomChange));
    
    // If zoom level didn't change (hit min/max), return
    if (newZoomLevel === zoomLevel && newZoomLevel === 1) return;
    
    // Calculate new domain width
    const fullDomainWidth = routeDistance;
    const newDomainWidth = fullDomainWidth / newZoomLevel;
    
    // Calculate new domain centered on mouse position
    let newDomainMin = mouseDistance - (newDomainWidth / 2);
    let newDomainMax = mouseDistance + (newDomainWidth / 2);
    
    // Make sure domain doesn't go beyond the data range
    if (newDomainMin < 0) {
        newDomainMin = 0;
        newDomainMax = newDomainWidth;
    }
    if (newDomainMax > routeDistance) {
        newDomainMax = routeDistance;
        newDomainMin = routeDistance - newDomainWidth;
    }
    
    // Final check for valid domain
    if (newDomainMin < 0) newDomainMin = 0;
    
    // Update visible domain
    visibleDomain.x = [newDomainMin, newDomainMax];
    
    // Update zoom level
    zoomLevel = newZoomLevel;
    
    // Update the chart
    updateChart();
    

        
        // Show zoom controls if zoomed in (controls are hidden but function kept for compatibility)
        if (zoomLevel > 1) {            
            // Update map view to match profile view if applicable
            if (zoomTrackLayer && zoomTrackLayer.polylineSourceId && window._originalRouteCoordinates) {
                // Find the visible portion of the route
                const startPercent = visibleDomain.x[0] / routeDistance;
                const endPercent = visibleDomain.x[1] / routeDistance;
                
                // Calculate indices in the original coordinates array
                const startIndex = Math.floor(startPercent * (window._originalRouteCoordinates.length - 1));
                const endIndex = Math.ceil(endPercent * (window._originalRouteCoordinates.length - 1));
                
                // Get visible coordinates
                const visibleCoordinates = window._originalRouteCoordinates.slice(
                    Math.max(0, startIndex),
                    Math.min(window._originalRouteCoordinates.length, endIndex + 1)
                );
                
                // Create a feature from these coordinates
                const feature = {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: visibleCoordinates
                    }
                };
                
                // Update the map layer
                const source = map.getSource(zoomTrackLayer.polylineSourceId);
                if (source) {
                    source.setData({
                        type: 'FeatureCollection',
                        features: [feature]
                    });
                }
                
                // Update main line to show the whole route in gray
                const mainSource = map.getSource(mainTrackLayer.polylineSourceId);
                if (mainSource) {
                    // Only change color if not already changed
                    map.setPaintProperty(
                        mainTrackLayer.polylineLayerId,
                        'line-color',
                        COLORS.ZOOM_ROUTE  // Use the color from your COLORS object
                    );
                }
            }
        } else {
            // Reset map view to show full route when zoom is 1
            if (zoomTrackLayer && mainTrackLayer && window._originalRouteCoordinates) {
                // Reset both layers to show the full route
                const fullFeature = {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: window._originalRouteCoordinates
                    }
                };
                
                const featureCollection = {
                    type: 'FeatureCollection',
                    features: [fullFeature]
                };
                
                // Update both layers
                const zoomSource = map.getSource(zoomTrackLayer.polylineSourceId);
                if (zoomSource) {
                    zoomSource.setData(featureCollection);
                }
                
                const mainSource = map.getSource(mainTrackLayer.polylineSourceId);
                if (mainSource) {
                    mainSource.setData(featureCollection);
                }
                
                map.setPaintProperty(
                    mainTrackLayer.polylineLayerId,
                    'line-color',
                    COLORS.ZOOM_ROUTE
                );
                
                map.setPaintProperty(
                    zoomTrackLayer.polylineLayerId,
                    'line-color',
                    COLORS.MAIN_ROUTE
                );
            }
        }
    }

    function handlePan(dx) {
        if (zoomLevel <= 1) return; 
        
        const domainWidth = visibleDomain.x[1] - visibleDomain.x[0];
        const panAmount = domainWidth * 0.1 * dx; 
        
        let newDomainMin = visibleDomain.x[0] - panAmount;
        let newDomainMax = visibleDomain.x[1] - panAmount;

        if (newDomainMin < 0) {
            newDomainMin = 0;
            newDomainMax = domainWidth;
        }
        if (newDomainMax > routeDistance) {
            newDomainMax = routeDistance;
            newDomainMin = routeDistance - newDomainWidth;
        }

        visibleDomain.x = [newDomainMin, newDomainMax];

        updateChart();

        if (zoomTrackLayer && zoomTrackLayer.polylineSourceId && window._originalRouteCoordinates) {

            const startPercent = visibleDomain.x[0] / routeDistance;
            const endPercent = visibleDomain.x[1] / routeDistance;

            const startIndex = Math.floor(startPercent * (window._originalRouteCoordinates.length - 1));
            const endIndex = Math.ceil(endPercent * (window._originalRouteCoordinates.length - 1));

            const visibleCoordinates = window._originalRouteCoordinates.slice(
                Math.max(0, startIndex),
                Math.min(window._originalRouteCoordinates.length, endIndex + 1)
            );

            const feature = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: visibleCoordinates
                }
            };

            const source = map.getSource(zoomTrackLayer.polylineSourceId);
            if (source) {
                source.setData({
                    type: 'FeatureCollection',
                    features: [feature]
                });
            }
        }
    }

    function resetZoom() {
        zoomLevel = 1;
        visibleDomain.x = [0, routeDistance];
        updateChart();

        if (zoomTrackLayer && mainTrackLayer && window._originalRouteCoordinates) {
            const fullFeature = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: window._originalRouteCoordinates
                }
            };
            
            const featureCollection = {
                type: 'FeatureCollection',
                features: [fullFeature]
            };
            
            // Update both layers
            const zoomSource = map.getSource(zoomTrackLayer.polylineSourceId);
            if (zoomSource) {
                zoomSource.setData(featureCollection);
            }
            
            const mainSource = map.getSource(mainTrackLayer.polylineSourceId);
            if (mainSource) {
                mainSource.setData(featureCollection);
            }
            
            map.setPaintProperty(
                mainTrackLayer.polylineLayerId,
                'line-color',
                COLORS.ZOOM_ROUTE
            );
            
            map.setPaintProperty(
                zoomTrackLayer.polylineLayerId,
                'line-color',
                COLORS.MAIN_ROUTE
            );
        }
    }

    const zoomControls = svg.append('g')
        .attr('class', 'zoom-controls')
        .attr('transform', `translate(${width - 60}, 25)`)
        .style('opacity', 0) 
        .style('display', 'none') 
        .style('transition', 'opacity 0.2s ease');
    
    function generateNiceTicks(min, max, count = 5) {
        const range = max - min;
        const roughStep = range / (count - 1);
        const goodSteps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

        let step = goodSteps[0];
        for (let i = 1; i < goodSteps.length; i++) {
            if (goodSteps[i] < roughStep) {
                step = goodSteps[i];
            } else {
                break;
            }
        }

        const firstTick = Math.ceil(min / step) * step;
        const ticks = [];
        for (let i = firstTick; i <= max; i += step) {
            ticks.push(i);
        }
        return ticks;
    }

    const xTickInterval = routeDistance > 100 ? 20 : routeDistance > 50 ? 10 : routeDistance > 20 ? 5 : 2;
    const xTicks = [];
    for (let i = 0; i <= routeDistance; i += xTickInterval) {
        xTicks.push(i);
    }
    
    const yTicks = generateNiceTicks(paddedMin, paddedMax);
    
    const line = d3.line()
        .x(d => xScale(d.distance))
        .y(d => yScale(d.elevation))
        .curve(d3.curveCatmullRom.alpha(0.5)); 
    
    const area = d3.area()
        .x(d => xScale(d.distance))
        .y0(innerHeight)
        .y1(d => yScale(d.elevation))
        .curve(d3.curveCatmullRom.alpha(0.5)); 
    
    gridGroup.call(d3.axisLeft(yScale)
        .tickValues(yTicks)
        .tickSize(-innerWidth)
        .tickFormat(''))
        .call(g => g.select('.domain').remove())
        .call(g => g.selectAll('.tick line')
            .attr('stroke', 'rgba(255,255,255,0.1)')
            .attr('stroke-dasharray', '2,2'));
    
    xAxisGroup.call(d3.axisBottom(xScale)
        .tickValues(xTicks)
        .tickFormat(d => `${d} km`)
        .tickSize(0))
        .call(g => g.select('.domain').remove())
        .call(g => g.selectAll('text')
            .attr('fill', 'var(--text-secondary)')
            .attr('dy', '1em')
            .attr('font-size', '10px'));
    

    yAxisGroup.call(d3.axisLeft(yScale)
        .tickValues(yTicks)
        .tickFormat(d => `${Math.round(d)} m`)
        .tickSize(0))
        .call(g => g.select('.domain').remove())
        .call(g => g.selectAll('text')
            .attr('fill', 'var(--text-secondary)')
            .attr('font-size', '10px'));

    chartContent.append('path')
        .datum(elevationData)
        .attr('class', 'area out-of-view-area')
        .attr('fill', 'rgba(128, 128, 128, 0.1)') 
        .attr('d', area);

    chartContent.append('path')
        .datum(elevationData)
        .attr('class', 'line out-of-view-line')
        .attr('fill', 'none')
        .attr('stroke', '#808080') 
        .attr('stroke-width', 2)
        .attr('d', line);

    chartContent.append('path')
        .datum(elevationData)
        .attr('class', 'area')
        .attr('fill', 'rgba(8, 131, 115, 0.15)') 
        .attr('d', area);

    chartContent.append('path')
        .datum(elevationData)
        .attr('class', 'line')
        .attr('fill', 'none')
        .attr('stroke', '#088373') 
        .attr('stroke-width', 2)
        .attr('d', line);
    
    const crosshair = chartContent.append('line')
        .attr('class', 'custom-crosshair')
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', '#088D95')
        .attr('stroke-width', 1)
        .attr('opacity', 0); 
    
    const marker = chartContent.append('circle')
        .attr('class', 'custom-marker')
        .attr('r', 5)
        .attr('fill', '#088D95')
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .attr('opacity', 0); 
    
    const tooltip = d3.select(container).select('.custom-tooltip')
        .style('pointer-events', 'none')
        .style('position', 'absolute')
        .style('background', 'rgba(11, 18, 21, 0.9)')
        .style('color', '#fff')
        .style('padding', '6px 10px')
        .style('border-radius', '4px')
        .style('font-size', '12px')
        .style('z-index', '10')
        .style('white-space', 'nowrap')
        .style('opacity', '0')
        .style('transition', 'opacity 0.1s ease')
        .style('box-shadow', '0 2px 4px rgba(0,0,0,0.3)');
    
    let isHovering = false;
    let mapMarkerTimer = null;
    
    const overlay = g.append('rect')
        .attr('width', innerWidth)
        .attr('height', innerHeight)
        .attr('fill', 'none')
        .attr('pointer-events', 'all'); 
    
 
    overlay.on('mouseenter', function() {
        isHovering = true;
        crosshair.attr('opacity', 1);
        marker.attr('opacity', 1);
        tooltip.style('opacity', '1');
    });
    

overlay.on('mousemove', function(event) {
    if (!isHovering) return;
    
    const [mouseX] = d3.pointer(event);
    const hoverDistance = xScale.invert(mouseX);
    
    const isZoomed = zoomLevel > 1;
    const padding = isZoomed ? (visibleDomain.x[1] - visibleDomain.x[0]) * 0.01 : 0;
    
    const availablePoints = isZoomed 
        ? elevationData.filter(d => 
            d.distance >= visibleDomain.x[0] - padding && 
            d.distance <= visibleDomain.x[1] + padding)
        : elevationData;
    
    if (availablePoints.length === 0) return;
    
    let closestPoint = availablePoints[0];
    let minDist = Math.abs(closestPoint.distance - hoverDistance);
    let hoveredIndex = 0;
    let dataIndex = 0;
    
    for (let i = 1; i < availablePoints.length; i++) {
        const dist = Math.abs(availablePoints[i].distance - hoverDistance);
        if (dist < minDist) {
            closestPoint = availablePoints[i];
            minDist = dist;
            hoveredIndex = i;
        }
    }
    
    if (isZoomed) {
        dataIndex = elevationData.findIndex(d => d.distance === closestPoint.distance);
    } else {
        dataIndex = hoveredIndex;
    }
    

    const xPos = xScale(closestPoint.distance);
    const yPos = yScale(closestPoint.elevation);
    
    crosshair
        .attr('x1', xPos)
        .attr('x2', xPos);
    
    marker
        .attr('cx', xPos)
        .attr('cy', yPos);
    
    let grade = 0;
    if (hoveredIndex > 0 && hoveredIndex < availablePoints.length) {
        const lookBack = Math.min(5, hoveredIndex);
        const prevPoint = availablePoints[hoveredIndex - lookBack];
        const elevationChange = closestPoint.elevation - prevPoint.elevation;
        const distanceChange = (closestPoint.distance - prevPoint.distance) * 1000; 
        
        if (distanceChange > 0) {
            grade = (elevationChange / distanceChange) * 100;
        }
    }
    

    const isFirstHalf = xPos < innerWidth / 2;
    const estimatedTooltipHeight = 70; 
    
    tooltip
        .style('left', isFirstHalf 
            ? `${xPos + margin.left + 10}px`
            : `${xPos + margin.left - 10}px`
        )
        .style('top', `${yPos + margin.top - (estimatedTooltipHeight/2)}px`)
        .style('transform', isFirstHalf 
            ? 'translate(0, 0)'
            : 'translate(-100%, 0)'
        )
        .html(`<div style="padding: 3px 0">
            <div><strong>Entfernung:</strong> ${closestPoint.distance.toFixed(1)} km</div>
            <div><strong>Höhenmeter:</strong> ${Math.round(closestPoint.elevation)} m</div>
            <div><strong>Steigung:</strong> ${grade.toFixed(1)}%</div>
        </div>`);
    

    if (mapMarkerTimer) clearTimeout(mapMarkerTimer);
    mapMarkerTimer = setTimeout(() => {

        let mapCoordinates = null;
        
        const routeCoordinates = window._currentRouteCoordinates || window._originalRouteCoordinates;
        if (routeCoordinates && routeCoordinates.length > 0) {
            if (isZoomed && window._originalRouteCoordinates) {
                const startPercent = visibleDomain.x[0] / routeDistance;
                const endPercent = visibleDomain.x[1] / routeDistance;

                const hoverPercent = (closestPoint.distance - visibleDomain.x[0]) / 
                                    (visibleDomain.x[1] - visibleDomain.x[0]);

                const startIndex = Math.floor(startPercent * window._originalRouteCoordinates.length);
                const endIndex = Math.ceil(endPercent * window._originalRouteCoordinates.length);
                const visibleLength = endIndex - startIndex;

                const visibleIndex = Math.floor(startIndex + (hoverPercent * visibleLength));

                const validIndex = Math.max(0, Math.min(window._originalRouteCoordinates.length - 1, visibleIndex));

                const coordAtIndex = window._originalRouteCoordinates[validIndex];
                if (coordAtIndex && coordAtIndex.length >= 2) {
                    mapCoordinates = [coordAtIndex[0], coordAtIndex[1]];
                }
            } else {
                const routeIndex = Math.floor((dataIndex / elevationData.length) * routeCoordinates.length);
                if (routeIndex >= 0 && routeIndex < routeCoordinates.length) {
                    const coord = routeCoordinates[routeIndex];
                    if (coord && coord.length >= 2) {
                        mapCoordinates = [coord[0], coord[1]];
                    }
                }
            }
        }

        if (mapCoordinates) {
            createHoverMarker(mapCoordinates);
        }
    }, 0);
});
    

    overlay.on('mouseleave', function() {
        isHovering = false;
        crosshair.attr('opacity', 0);
        marker.attr('opacity', 0);
        tooltip.style('opacity', '0');
        
        if (mapMarkerTimer) {
            clearTimeout(mapMarkerTimer);
            mapMarkerTimer = null;
        }
        
        if (hoverMarker) {
            hoverMarker.remove();
            hoverMarker = null;
        }
    });
    
    overlay.on('wheel', handleZoom);


let touchStartX = 0;
let touchStartY = 0;
let initialPinchDistance = 0;
let lastTouchTime = 0;
let lastDoubleTapTime = 0;
let isMultiTouch = false;
let activeFingers = 0;
let touchMoveCount = 0;


overlay.on('touchstart', function(event) {
    const touches = event.touches;
    activeFingers = touches.length;
    touchMoveCount = 0;

    if (touches.length === 2) {
        event.preventDefault();
        
        isMultiTouch = true;
        initialPinchDistance = Math.hypot(
            touches[0].clientX - touches[1].clientX,
            touches[0].clientY - touches[1].clientY
        );

        const midX = (touches[0].clientX + touches[1].clientX) / 2;
        const svgPoint = overlay.node().ownerSVGElement.createSVGPoint();
        svgPoint.x = midX;
        svgPoint.y = touches[0].clientY;

        const transformedPoint = svgPoint.matrixTransform(overlay.node().getScreenCTM().inverse());
        touchStartX = transformedPoint.x;
    }

    else if (touches.length === 1) {
        touchStartX = touches[0].clientX;
        touchStartY = touches[0].clientY;
        lastTouchTime = new Date().getTime();
        isMultiTouch = false;
    }
});


overlay.on('touchmove', function(event) {
    const touches = event.touches;
    touchMoveCount++;

    if (touches.length === 2) {

        event.preventDefault();
        
        const currentPinchDistance = Math.hypot(
            touches[0].clientX - touches[1].clientX,
            touches[0].clientY - touches[1].clientY
        );
        
        if (initialPinchDistance > 0 && currentPinchDistance > 0) {
            const zoomFactor = currentPinchDistance / initialPinchDistance;

            if (Math.abs(zoomFactor - 1) > 0.05) {
                const midX = (touches[0].clientX + touches[1].clientX) / 2;
                const svgPoint = overlay.node().ownerSVGElement.createSVGPoint();
                svgPoint.x = midX;
                svgPoint.y = touches[0].clientY;

                const transformedPoint = svgPoint.matrixTransform(overlay.node().getScreenCTM().inverse());

                handleZoom({
                    preventDefault: () => {},
                    deltaY: zoomFactor < 1 ? 100 : -100, 
                    clientX: midX
                });

                initialPinchDistance = currentPinchDistance;
            }
        }
    }
    else if (touches.length === 1 && zoomLevel > 1) {
        event.preventDefault();
        
        const dx = touches[0].clientX - touchStartX;

        if (Math.abs(dx) > 5) {
            const panDirection = dx > 0 ? -1 : 1;
            handlePan(panDirection);
            touchStartX = touches[0].clientX;
        }
    }
});

overlay.on('touchend', function(event) {
    const currentTime = new Date().getTime();
    const touchDuration = currentTime - lastTouchTime;

    if (touchDuration < 300 && touchMoveCount < 5 && activeFingers === 1) {

        if (currentTime - lastDoubleTapTime < 300) {
            event.preventDefault();

            const touch = event.changedTouches[0];
            const svgPoint = overlay.node().ownerSVGElement.createSVGPoint();
            svgPoint.x = touch.clientX;
            svgPoint.y = touch.clientY;

            const transformedPoint = svgPoint.matrixTransform(overlay.node().getScreenCTM().inverse());

            if (zoomLevel === 1) {
                handleZoom({
                    preventDefault: () => {},
                    deltaY: -100, 
                    clientX: transformedPoint.x
                });
            } else {
                resetZoom();
            }
        }
        
        lastDoubleTapTime = currentTime;
    }
    
    activeFingers = event.touches.length;
    isMultiTouch = false;
});
    

    let routeGeometry = null;
    let routeCoordinates = [];
    
    if (mainTrackLayer && mainTrackLayer.polylineSourceId) {
        const source = map.getSource(mainTrackLayer.polylineSourceId);
        if (source && source._data) {
            routeGeometry = source._data.features[0].geometry;
            routeCoordinates = routeGeometry.coordinates || [];
            console.log("Got route data from MapTiler source, coords:", routeCoordinates.length);
        }
    }
    
    if (!routeCoordinates || routeCoordinates.length === 0) {
        routeCoordinates = window._currentRouteCoordinates || window._originalRouteCoordinates || [];
        console.log("Using fallback route coordinates:", routeCoordinates.length);
    }

    if (pois && pois.length > 0) {
        const relevantPOIs = pois.filter(poi => 
            poi.type === 'highlight' || poi.type === 'gipfel'
        );

        const segmentDistances = [];
        let cumulativeDistance = 0;
        
        for (let i = 0; i < routeCoordinates.length - 1; i++) {
            const start = routeCoordinates[i];
            const end = routeCoordinates[i + 1];
            
            if (start.length < 2 || end.length < 2) {
                segmentDistances.push(0);
                continue;
            }
            
            const segmentDistance = calculateDistance(
                start[1], start[0],
                end[1], end[0]
            );
            
            segmentDistances.push(segmentDistance);
            cumulativeDistance += segmentDistance;
        }

        const accumulatedDistances = [0];
        let runningTotal = 0;
        
        for (let i = 0; i < segmentDistances.length; i++) {
            runningTotal += segmentDistances[i];
            accumulatedDistances.push(runningTotal);
        }

        const distanceScale = routeDistance / Math.max(0.001, cumulativeDistance);
        
        relevantPOIs.forEach(poi => {
            let minDistance = Infinity;
            let closestSegmentIndex = -1;
            let projectionOnSegment = null;
            
            for (let i = 0; i < routeCoordinates.length - 1; i++) {
                const start = routeCoordinates[i];
                const end = routeCoordinates[i + 1];
                
                if (start.length < 2 || end.length < 2) continue;

                const projection = projectPointOnSegment(
                    poi.lat, poi.lng,
                    start[1], start[0],
                    end[1], end[0]
                );
                
                if (!projection) continue;

                const distance = calculateDistance(
                    poi.lat, poi.lng,
                    projection.lat, projection.lng
                );
                
                if (distance < minDistance) {
                    minDistance = distance;
                    closestSegmentIndex = i;
                    projectionOnSegment = projection;
                }
            }

            let distanceAlongRoute;
            
            if (closestSegmentIndex >= 0 && projectionOnSegment) {
                const distanceToSegmentStart = accumulatedDistances[closestSegmentIndex];

                const segmentLength = segmentDistances[closestSegmentIndex];
                const distanceAlongSegment = segmentLength * projectionOnSegment.ratio;

                distanceAlongRoute = (distanceToSegmentStart + distanceAlongSegment) * distanceScale;
            } else {

                let minPointDistance = Infinity;
                let closestPointIndex = -1;
                
                for (let i = 0; i < routeCoordinates.length; i++) {
                    const point = routeCoordinates[i];
                    if (point.length < 2) continue;
                    
                    const distance = calculateDistance(
                        poi.lat, poi.lng,
                        point[1], point[0]
                    );
                    
                    if (distance < minPointDistance) {
                        minPointDistance = distance;
                        closestPointIndex = i;
                    }
                }
                
                if (closestPointIndex === -1) return;

                distanceAlongRoute = accumulatedDistances[closestPointIndex] * distanceScale;
            }

            let profileElevation;

            const closestDataPoint = elevationData.reduce((prev, curr) => {
                return Math.abs(curr.distance - distanceAlongRoute) < 
                       Math.abs(prev.distance - distanceAlongRoute) ? curr : prev;
            }, elevationData[0]);
            
            profileElevation = closestDataPoint.elevation;

            let actualElevation = poi.elevation;

            if (actualElevation === undefined || actualElevation === null) {

                if (closestSegmentIndex >= 0 && projectionOnSegment && routeCoordinates[closestSegmentIndex].length > 2) {
                    const startElevation = routeCoordinates[closestSegmentIndex][2];

                    if (routeCoordinates[closestSegmentIndex + 1].length > 2) {
                        const endElevation = routeCoordinates[closestSegmentIndex + 1][2];
                        // Interpolate based on segment position
                        actualElevation = startElevation + (endElevation - startElevation) * projectionOnSegment.ratio;
                    } else {
                        actualElevation = startElevation;
                    }
                } 

                else {

                    let nearestElevation = null;
                    let minPointDistance = Infinity;
                    
                    for (let i = 0; i < routeCoordinates.length; i++) {
                        const point = routeCoordinates[i];
                        
                        if (point.length >= 3) { 
                            const distanceToPoint = calculateDistance(
                                poi.lat, poi.lng,
                                point[1], point[0]
                            );
                            
                            if (distanceToPoint < minPointDistance) {
                                minPointDistance = distanceToPoint;
                                nearestElevation = point[2];
                            }
                        }
                    }

                    if (nearestElevation !== null) {
                        actualElevation = nearestElevation;
                    } else {
                        actualElevation = profileElevation;
                    }
                }
            }

            const markerGroup = g.append('g') 
                .attr('class', 'poi-marker')
                .attr('transform', `translate(${xScale(distanceAlongRoute)},${yScale(profileElevation)})`)
                .style('cursor', 'pointer')
                .datum({
                    poi: poi,
                    distance: distanceAlongRoute,
                    elevation: profileElevation,
                    actualElevation: actualElevation
                });


            markerGroup.append('line')
                .attr('x1', 0)
                .attr('y1', 0)
                .attr('x2', 0)
                .attr('y2', yScale.range()[0] - yScale(profileElevation))
                .attr('stroke', 'rgba(255,255,255,0.3)')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '2,2');


            const iconUrl = poi.type === 'gipfel' ? 'images/gipfel_profil1.png' : 'images/highlight_profil1.png';
            markerGroup.append('image')
                .attr('href', iconUrl)
                .attr('width', 20)
                .attr('height', 20)
                .attr('x', -10) 
                .attr('y', -10) 
                .attr('preserveAspectRatio', 'xMidYMid meet')
                .style('pointer-events', 'all'); 

            // Add interaction
            markerGroup
                .on('mouseenter', function(event, d) {
                    d3.select(this).select('image').transition().duration(200)
                        .attr('width', 24)
                        .attr('height', 24)
                        .attr('x', -12)
                        .attr('y', -12);
                    
                    const poiData = d3.select(this).datum();
                    
                    const xPos = xScale(poiData.distance);
                    const isFirstHalf = xPos < innerWidth / 2;
                    const estimatedTooltipHeight = 50; 
                    
                    tooltip
                        .style('left', isFirstHalf 
                            ? `${xPos + margin.left + 10}px` 
                            : `${xPos + margin.left - 10}px`
                        )
                        .style('top', `${yScale(poiData.elevation) + margin.top - (estimatedTooltipHeight/2)}px`) 
                        .style('transform', isFirstHalf 
                            ? 'translate(0, 0)' 
                            : 'translate(-100%, 0)'
                        )
                        .style('opacity', 1)
                        .html(`<div style="padding: 3px 0">
                            <div><strong>${poiData.poi.name}</strong></div>
                            <div><strong>Höhenmeter:</strong> ${Math.round(poiData.actualElevation)} m</div>
                            <div><strong>Entfernung:</strong> ${poiData.distance.toFixed(1)} km</div>
                        </div>`);
                    
                    if (hoverMarker) hoverMarker.remove();
                    createHoverMarker([poiData.poi.lng, poiData.poi.lat]);
                    
                    event.stopPropagation();
                })
                .on('mouseleave', function(event) {
                    d3.select(this).select('image').transition().duration(200)
                        .attr('width', 20)
                        .attr('height', 20)
                        .attr('x', -10)
                        .attr('y', -10);
                    
                    if (!isHovering) {
                        tooltip.style('opacity', 0);
                        
                        if (hoverMarker) {
                            hoverMarker.remove();
                            hoverMarker = null;
                        }
                    }
                    
                    event.stopPropagation();
                })
                .on('click', function(event, d) {
                    const poiData = d3.select(this).datum();
                    map.flyTo({
                        center: [poiData.poi.lng, poiData.poi.lat],
                        zoom: 14,
                        duration: 1000
                    });

                    event.stopPropagation();
                });
        });
    }

    updateChart();
    

const style = document.createElement('style');
style.textContent = `
    .custom-tooltip {
        opacity: 0;
        transition: opacity 0.15s ease;
        pointer-events: none;
        z-index: 1000;
    }
    .custom-tooltip strong {
        color: #fff;
        font-weight: 500;
    }
    .custom-tooltip div {
        margin: 2px 0;
    }
    .custom-crosshair {
        transition: opacity 0.15s ease;
    }
    .custom-marker {
        transition: opacity 0.15s ease;
    }
    .out-of-view-line {
        opacity: 0.5;
    }
    .out-of-view-area {
        opacity: 0.3;
    }
    .boundary-indicator {
        opacity: 0.7;
    }
    .zoom-text {
    margin-top: 10px;
        opacity: 1;
        transition: opacity 0.2s ease;
    }
    .zoom-text:hover {
        color: #088D95;
    }
    .zoom-text.reset {
        color: #088373;
    }
`;
document.head.appendChild(style);

    const updateChartOnResize = debounce(() => {
        recreateChart();
    }, 300); 
    
    function recreateChart() {
        d3.select(container).select('svg').remove();
        customElevationProfile = createCustomElevationProfile(routeData);
    }

    window.addEventListener('resize', updateChartOnResize);
    

    container._checkInterval = setInterval(() => {
        if (window._currentRouteCoordinates && 
            (!window._lastProcessedCoordinates || 
             window._currentRouteCoordinates.length !== window._lastProcessedCoordinates.length)) {
            window._lastProcessedCoordinates = window._currentRouteCoordinates.slice();
            recreateChart();
        }
    }, 1000); 
    
    return {
        svg: svg,
        data: elevationData,
        update: function(newData) {
            if (newData) {
                elevationData = newData;
                recreateChart();
            }
        },
        cleanup: function() {
    window.removeEventListener('resize', updateChartOnResize);
    
    overlay.on('touchstart', null);
    overlay.on('touchmove', null);
    overlay.on('touchend', null);
    
    if (container._checkInterval) {
        clearInterval(container._checkInterval);
    }
},

        zoom: {
            reset: resetZoom,
            in: () => handleZoom({ preventDefault: () => {}, deltaY: -100 }),
            out: () => handleZoom({ preventDefault: () => {}, deltaY: 100 }),
            panLeft: () => handlePan(-1),
            panRight: () => handlePan(1)
        }
    };
}

function projectPointOnSegment(ptLat, ptLng, startLat, startLng, endLat, endLng) {

    const lat1 = startLat * Math.PI / 180;
    const lng1 = startLng * Math.PI / 180;
    const lat2 = endLat * Math.PI / 180;
    const lng2 = endLng * Math.PI / 180;
    const latP = ptLat * Math.PI / 180;
    const lngP = ptLng * Math.PI / 180;
    
    const R = 6371; 

    const cosLat1 = Math.cos(lat1);
    
    const x1 = 0; 
    const y1 = 0;
    
    const x2 = R * cosLat1 * (lng2 - lng1); 
    const y2 = R * (lat2 - lat1); 
    
    const xp = R * cosLat1 * (lngP - lng1);
    const yp = R * (latP - lat1);
    
const segmentLengthSquared = x2*x2 + y2*y2;
    
    if (segmentLengthSquared < 1e-10) {
        return {
            lat: startLat,
            lng: startLng,
            ratio: 0
        };
    }
    
    const dotProduct = xp*x2 + yp*y2;
    const ratio = dotProduct / segmentLengthSquared;
    
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    
    if (clampedRatio <= 0) {
        return {
            lat: startLat,
            lng: startLng,
            ratio: 0
        };
    }
    if (clampedRatio >= 1) {
        return {
            lat: endLat,
            lng: endLng,
            ratio: 1
        };
    }

    const projectedLat = startLat + clampedRatio * (endLat - startLat);
    const projectedLng = startLng + clampedRatio * (endLng - startLng);
    
    return {
        lat: projectedLat,
        lng: projectedLng,
        ratio: clampedRatio
    };
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; 
}

function generateSyntheticElevation(position, totalDistance, minElevation, maxElevation) {
    const range = maxElevation - minElevation;
    const base = minElevation + range * 0.3;

    const normalizedPos = position / totalDistance;

    const wave1 = Math.sin(normalizedPos * Math.PI * 2) * range * 0.3;

    const wave2 = Math.sin(normalizedPos * Math.PI * 4) * range * 0.15;
    const wave3 = Math.sin(normalizedPos * Math.PI * 8) * range * 0.05;

    const curve = Math.sin(normalizedPos * Math.PI) * range * 0.2;
    
    return base + wave1 + wave2 + wave3 + curve;
}

function findClosestPointOnRoute(poi, routeGeometry) {
    if (!routeGeometry || !routeGeometry.coordinates || routeGeometry.coordinates.length === 0) return null;

    let minDistance = Infinity;
    let closestPoint = null;
    let closestIndex = -1;
    let distanceAlongRoute = 0;
    let accumulatedDistance = 0;

    routeGeometry.coordinates.forEach((coord, index) => {
        if (coord.length < 2) return;
        
        const distance = calculateDistance(poi.lat, poi.lng, coord[1], coord[0]);
        if (distance < minDistance) {
            minDistance = distance;
            closestPoint = coord;
            closestIndex = index;
        }
    });

    for (let i = 1; i <= closestIndex; i++) {
        const prevCoord = routeGeometry.coordinates[i-1];
        const currCoord = routeGeometry.coordinates[i];
        
        if (prevCoord.length >= 2 && currCoord.length >= 2) {
            accumulatedDistance += calculateDistance(
                prevCoord[1], prevCoord[0],
                currCoord[1], currCoord[0]
            );
        }
    }

    return {
        distance: minDistance,
        point: closestPoint,
        index: closestIndex,
        distanceAlongRoute: accumulatedDistance
    };
}

