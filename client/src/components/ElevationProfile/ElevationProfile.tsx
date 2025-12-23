import * as d3 from 'd3';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { POI, Route } from '../../api';
import {
  getElevationStageColor,
  getStageAreaColor,
  POI_PROFILE_ICONS,
  ROUTE_STYLES,
} from '../../constants/routeStyles';
import { getRouteElevations } from '../../utils/elevation';
import './ElevationProfile.css';

interface ElevationProfileProps {
  route: Route | null;
  pois?: POI[];
  tourType?: 'gold' | 'silver' | 'bronze';
  onPositionChange?: (
    position: {
      lng: number;
      lat: number;
      distance: number;
      elevation: number;
      grade: number;
    } | null
  ) => void;
  highlightDistance?: number;
  onPoiClick?: (poi: POI) => void;
}

interface ElevationPoint {
  distance: number;
  elevation: number;
  index: number;
  coordinates: [number, number];
}

// Calculate distance between two points in km
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
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

export default function ElevationProfile({
  route,
  pois = [],
  tourType = 'gold',
  onPositionChange,
  highlightDistance,
  onPoiClick,
}: ElevationProfileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 140 });

  // Real elevation data state
  const [realElevations, setRealElevations] = useState<number[] | null>(null);
  const [_elevationsLoading, setElevationsLoading] = useState(false);

  // Zoom state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [visibleDomain, setVisibleDomain] = useState<{ x: [number, number] }>({
    x: [0, 0],
  });
  const elevationDataRef = useRef<ElevationPoint[]>([]);
  const routeDistanceRef = useRef(0);

  const COLORS = ROUTE_STYLES.ELEVATION;
  const MAX_ZOOM = 10;
  const margin = { top: 10, right: 15, bottom: 25, left: 45 };

  // Generate elevation data from route - uses real elevations if available
  const generateElevationData = useCallback(
    (elevations: number[] | null): ElevationPoint[] => {
      if (!route) return [];

      // Use stored routeGeometry if available, otherwise fall back to waypoints
      let coords: [number, number][];
      if (route.routeGeometry && route.routeGeometry.length > 0) {
        coords = route.routeGeometry;
        console.log(
          '[ElevationProfile] Using stored routeGeometry:',
          coords.length,
          'points'
        );
      } else {
        coords = [route.startPoint, ...route.waypoints, route.endPoint] as [
          number,
          number
        ][];
        console.log(
          '[ElevationProfile] No routeGeometry, using waypoints:',
          coords.length,
          'points'
        );
      }

      const data: ElevationPoint[] = [];
      let accumulatedDistance = 0;

      const hasRealElevations =
        elevations && elevations.length === coords.length;

      if (hasRealElevations) {
        console.log('[ElevationProfile] Using REAL elevation data from API');
      } else {
        console.log('[ElevationProfile] Using synthetic elevation data');
      }

      for (let i = 0; i < coords.length; i++) {
        if (i > 0) {
          const dist = calculateDistance(
            coords[i - 1][1],
            coords[i - 1][0],
            coords[i][1],
            coords[i][0]
          );
          accumulatedDistance += dist;
        }

        let elevation: number;

        if (hasRealElevations) {
          // Use real elevation data from API
          elevation = elevations[i];
        } else {
          // Fallback: Generate synthetic elevation using sine waves
          const elevRange = route.highestPoint - route.lowestPoint;
          const normalizedPos = accumulatedDistance / (route.distance || 1);
          const base = route.lowestPoint + elevRange * 0.3;
          const wave1 = Math.sin(normalizedPos * Math.PI * 2) * elevRange * 0.3;
          const wave2 =
            Math.sin(normalizedPos * Math.PI * 4) * elevRange * 0.15;
          const wave3 =
            Math.sin(normalizedPos * Math.PI * 8) * elevRange * 0.05;
          const curve = Math.sin(normalizedPos * Math.PI) * elevRange * 0.2;

          elevation = Math.max(
            route.lowestPoint,
            Math.min(route.highestPoint, base + wave1 + wave2 + wave3 + curve)
          );
        }

        data.push({
          distance: accumulatedDistance,
          elevation,
          index: i,
          coordinates: coords[i],
        });
      }

      return data;
    },
    [route]
  );

  // Fetch real elevation data from API
  useEffect(() => {
    if (!route) return;

    const coords =
      route.routeGeometry && route.routeGeometry.length > 0
        ? route.routeGeometry
        : ([route.startPoint, ...route.waypoints, route.endPoint] as [
            number,
            number
          ][]);

    // Only fetch if we have coordinates
    if (coords.length < 2) return;

    setElevationsLoading(true);
    console.log('[ElevationProfile] Fetching real elevation data...');

    getRouteElevations(coords)
      .then(elevations => {
        console.log(
          '[ElevationProfile] Received',
          elevations.length,
          'elevation points'
        );
        setRealElevations(elevations);
      })
      .catch(err => {
        console.error('[ElevationProfile] Failed to fetch elevations:', err);
        setRealElevations(null);
      })
      .finally(() => {
        setElevationsLoading(false);
      });
  }, [route]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;

    let resizeTimeout: ReturnType<typeof setTimeout>;

    const resizeObserver = new ResizeObserver(
      (entries: ResizeObserverEntry[]) => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            setDimensions({ width: width || 800, height: height || 140 });
          }
        }, 100);
      }
    );

    resizeObserver.observe(containerRef.current);
    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
    };
  }, []);

  // Main chart rendering - matching elevation.js createCustomElevationProfile
  useEffect(() => {
    if (!svgRef.current || !route) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    const elevationData = generateElevationData(realElevations);
    if (elevationData.length === 0) return;
    elevationDataRef.current = elevationData;

    const routeDistance =
      route.distance || elevationData[elevationData.length - 1].distance;
    routeDistanceRef.current = routeDistance;

    // Calculate elevation bounds with padding
    const minElevation = Math.min(
      route.lowestPoint,
      d3.min(elevationData, d => d.elevation) || 0
    );
    const maxElevation = Math.max(
      route.highestPoint,
      d3.max(elevationData, d => d.elevation) || 1000
    );
    const elevationRange = maxElevation - minElevation;
    const paddedMin = Math.max(0, minElevation - elevationRange * 0.05);
    const paddedMax = maxElevation + elevationRange * 0.05;

    // Initialize visible domain
    if (visibleDomain.x[0] === 0 && visibleDomain.x[1] === 0) {
      setVisibleDomain({ x: [0, routeDistance] });
    }

    const currentDomain =
      visibleDomain.x[1] > 0 ? visibleDomain.x : [0, routeDistance];

    // Create scales
    const xScale = d3
      .scaleLinear()
      .domain(currentDomain)
      .range([0, innerWidth]);
    const yScale = d3
      .scaleLinear()
      .domain([paddedMin, paddedMax])
      .range([innerHeight, 0]);

    // Create main group
    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create clip path
    svg
      .append('defs')
      .append('clipPath')
      .attr('id', 'chart-clip')
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight);

    const chartContent = g
      .append('g')
      .attr('class', 'chart-content')
      .attr('clip-path', 'url(#chart-clip)');

    // Generate nice ticks for Y axis - matching elevation.js generateNiceTicks
    const generateNiceTicks = (min: number, max: number): number[] => {
      const goodSteps = [50, 100, 200, 250, 500, 1000];
      const idealStepCount = 5;
      const range = max - min;
      const approximateStep = range / idealStepCount;

      let step = goodSteps[0];
      for (let i = 0; i < goodSteps.length; i++) {
        if (approximateStep <= goodSteps[i]) {
          step = goodSteps[i];
          break;
        }
      }

      const firstTick = Math.ceil(min / step) * step;
      const ticks: number[] = [];
      for (let i = firstTick; i <= max; i += step) {
        ticks.push(i);
      }
      return ticks;
    };

    // X axis ticks - matching elevation.js
    const isMobile = window.innerWidth < 768;
    const domainWidth = currentDomain[1] - currentDomain[0];
    let xTickInterval: number;

    if (isMobile) {
      if (domainWidth > 100) xTickInterval = 40;
      else if (domainWidth > 50) xTickInterval = 20;
      else if (domainWidth > 20) xTickInterval = 10;
      else if (domainWidth > 10) xTickInterval = 4;
      else if (domainWidth > 5) xTickInterval = 2;
      else if (domainWidth > 2) xTickInterval = 1;
      else xTickInterval = 0.5;
    } else {
      if (domainWidth > 100) xTickInterval = 20;
      else if (domainWidth > 50) xTickInterval = 10;
      else if (domainWidth > 20) xTickInterval = 5;
      else if (domainWidth > 10) xTickInterval = 2;
      else if (domainWidth > 5) xTickInterval = 1;
      else if (domainWidth > 2) xTickInterval = 0.5;
      else xTickInterval = 0.2;
    }

    const xTicks: number[] = [];
    const startTick =
      Math.ceil(currentDomain[0] / xTickInterval) * xTickInterval;
    for (let i = startTick; i <= currentDomain[1]; i += xTickInterval) {
      xTicks.push(i);
    }

    const yTicks = generateNiceTicks(paddedMin, paddedMax);

    // Draw grid lines
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(yScale)
          .tickValues(yTicks)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      )
      .call(g => g.select('.domain').remove())
      .call(g =>
        g
          .selectAll('.tick line')
          .attr('stroke', 'rgba(255,255,255,0.1)')
          .attr('stroke-dasharray', '2,2')
      );

    // Line and area generators - matching elevation.js curve
    const line = d3
      .line<ElevationPoint>()
      .x(d => xScale(d.distance))
      .y(d => yScale(d.elevation))
      .curve(d3.curveCatmullRom.alpha(0.5));

    const area = d3
      .area<ElevationPoint>()
      .x(d => xScale(d.distance))
      .y0(innerHeight)
      .y1(d => yScale(d.elevation))
      .curve(d3.curveCatmullRom.alpha(0.5));

    // Draw out-of-view (gray) background area and line first
    chartContent
      .append('path')
      .datum(elevationData)
      .attr('class', 'area out-of-view-area')
      .attr('fill', 'rgba(128, 128, 128, 0.1)')
      .attr('d', area);

    chartContent
      .append('path')
      .datum(elevationData)
      .attr('class', 'line out-of-view-line')
      .attr('fill', 'none')
      .attr('stroke', '#808080')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Stage configuration
    const stageConfigLocal = {
      gold: 1,
      silver: 2,
      bronze: 3,
    };
    const numStages = stageConfigLocal[tourType];

    console.log('[ElevationProfile] Drawing stages:', {
      tourType,
      numStages,
      dataPoints: elevationData.length,
    });

    // Split elevation data into stage segments
    const pointsPerStage = Math.ceil(elevationData.length / numStages);

    // Draw each stage with its color (area then line)
    for (let stageIndex = 0; stageIndex < numStages; stageIndex++) {
      const startIdx = stageIndex * pointsPerStage;
      const endIdx = Math.min(
        (stageIndex + 1) * pointsPerStage,
        elevationData.length
      );

      // Get stage data with overlap for smooth joins
      const stageData = elevationData.slice(
        startIdx,
        Math.min(endIdx + 1, elevationData.length)
      );

      if (stageData.length < 2) continue;

      const stageColor = getElevationStageColor(stageIndex);
      const stageAreaColor = getStageAreaColor(stageIndex);

      console.log(`[ElevationProfile] Stage ${stageIndex + 1}:`, {
        stageColor,
        stageAreaColor,
        points: stageData.length,
        startDist: stageData[0]?.distance.toFixed(2),
        endDist: stageData[stageData.length - 1]?.distance.toFixed(2),
      });

      // Draw stage area
      chartContent
        .append('path')
        .datum(stageData)
        .attr('class', `area stage-${stageIndex}`)
        .attr('fill', stageAreaColor)
        .attr('d', area);

      // Draw stage line
      chartContent
        .append('path')
        .datum(stageData)
        .attr('class', `line stage-${stageIndex}`)
        .attr('fill', 'none')
        .attr('stroke', stageColor)
        .attr('stroke-width', 2.5)
        .attr('d', line);
    }

    // Draw stage boundary markers (vertical lines with numbers)
    if (numStages > 1) {
      for (let i = 1; i < numStages; i++) {
        const boundaryIdx = Math.min(
          i * pointsPerStage,
          elevationData.length - 1
        );
        const boundaryPoint = elevationData[boundaryIdx];

        if (boundaryPoint) {
          const boundaryX = xScale(boundaryPoint.distance);
          const stageColor = getElevationStageColor(i);

          // Draw vertical dashed line at stage boundary
          chartContent
            .append('line')
            .attr('class', `stage-boundary stage-boundary-${i}`)
            .attr('x1', boundaryX)
            .attr('x2', boundaryX)
            .attr('y1', 0)
            .attr('y2', innerHeight)
            .attr('stroke', stageColor)
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '4,3')
            .attr('opacity', 0.8);

          // Draw stage number circle at top
          chartContent
            .append('circle')
            .attr('class', `stage-marker-circle stage-marker-${i}`)
            .attr('cx', boundaryX)
            .attr('cy', 12)
            .attr('r', 10)
            .attr('fill', stageColor)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);

          // Draw stage number text
          chartContent
            .append('text')
            .attr('class', `stage-marker-text`)
            .attr('x', boundaryX)
            .attr('y', 16)
            .attr('text-anchor', 'middle')
            .attr('fill', '#fff')
            .attr('font-size', '10px')
            .attr('font-weight', 'bold')
            .text(i + 1);
        }
      }
    }

    // Draw axes - matching elevation.js styling
    g.append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickValues(xTicks)
          .tickFormat(d => `${(d as number).toFixed(isMobile ? 0 : 1)} km`)
          .tickSize(0)
      )
      .call(g => g.select('.domain').remove())
      .call(g =>
        g
          .selectAll('text')
          .attr('fill', COLORS.TEXT_COLOR)
          .attr('dy', '1em')
          .attr('font-size', isMobile ? '9px' : '10px')
      );

    g.append('g')
      .attr('class', 'axis y-axis')
      .call(
        d3
          .axisLeft(yScale)
          .tickValues(yTicks)
          .tickFormat(d => `${Math.round(d as number)} m`)
          .tickSize(0)
      )
      .call(g => g.select('.domain').remove())
      .call(g =>
        g
          .selectAll('text')
          .attr('fill', COLORS.TEXT_COLOR)
          .attr('font-size', '10px')
      );

    // Crosshair and marker - matching elevation.js
    const crosshair = chartContent
      .append('line')
      .attr('class', 'custom-crosshair')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', COLORS.CROSSHAIR)
      .attr('stroke-width', 1)
      .attr('opacity', 0);

    const marker = chartContent
      .append('circle')
      .attr('class', 'custom-marker')
      .attr('r', 5)
      .attr('fill', COLORS.MARKER_FILL)
      .attr('stroke', COLORS.MARKER_STROKE)
      .attr('stroke-width', 2)
      .attr('opacity', 0);

    // Create overlay for mouse events FIRST (so POI markers render on top)
    const overlay = g
      .append('rect')
      .attr('class', 'overlay')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .style('cursor', 'crosshair');

    // Create POI layer ON TOP of overlay
    const poiLayer = g.append('g').attr('class', 'poi-layer');

    // Add POI markers on profile - matching elevation.js
    const relevantPois = pois.filter(
      poi => poi.type === 'highlight' || poi.type === 'gipfel'
    );

    relevantPois.forEach(poi => {
      // Find distance along route for this POI
      let minDist = Infinity;
      let closestDataPoint = elevationData[0];

      for (const point of elevationData) {
        const dist = calculateDistance(
          poi.lngLat[1],
          poi.lngLat[0],
          point.coordinates[1],
          point.coordinates[0]
        );
        if (dist < minDist) {
          minDist = dist;
          closestDataPoint = point;
        }
      }

      const distanceAlongRoute = closestDataPoint.distance;
      const profileElevation = closestDataPoint.elevation;

      if (
        distanceAlongRoute >= currentDomain[0] &&
        distanceAlongRoute <= currentDomain[1]
      ) {
        const xPos = xScale(distanceAlongRoute);
        const yPos = yScale(profileElevation);

        const markerGroup = poiLayer
          .append('g')
          .attr('class', 'poi-marker')
          .attr('transform', `translate(${xPos},${yPos})`)
          .style('cursor', 'pointer')
          .style('pointer-events', 'all');

        // Vertical line from marker to bottom
        markerGroup
          .append('line')
          .attr('x1', 0)
          .attr('y1', 0)
          .attr('x2', 0)
          .attr('y2', innerHeight - yPos)
          .attr('stroke', 'rgba(255,255,255,0.3)')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '2,2');

        // POI icon - matching elevation.js
        const iconUrl =
          poi.type === 'gipfel'
            ? POI_PROFILE_ICONS.gipfel
            : POI_PROFILE_ICONS.highlight;

        markerGroup
          .append('image')
          .attr('href', iconUrl)
          .attr('width', 20)
          .attr('height', 20)
          .attr('x', -10)
          .attr('y', -10)
          .attr('preserveAspectRatio', 'xMidYMid meet')
          .style('pointer-events', 'all');

        // Hover interaction - matching elevation.js
        markerGroup
          .on('mouseenter', function () {
            d3.select(this)
              .select('image')
              .transition()
              .duration(200)
              .attr('width', 24)
              .attr('height', 24)
              .attr('x', -12)
              .attr('y', -12);

            if (tooltipRef.current) {
              const isFirstHalf = xPos < innerWidth / 2;
              tooltipRef.current.style.opacity = '1';
              tooltipRef.current.style.left = isFirstHalf
                ? `${xPos + margin.left + 10}px`
                : `${xPos + margin.left - 10}px`;
              tooltipRef.current.style.top = `${yPos + margin.top - 25}px`;
              tooltipRef.current.style.transform = isFirstHalf
                ? 'translate(0, 0)'
                : 'translate(-100%, 0)';
              tooltipRef.current.innerHTML = `
                <div style="padding: 3px 0">
                  <div><strong>${poi.name}</strong></div>
                  <div><strong>Höhenmeter:</strong> ${Math.round(
                    profileElevation
                  )} m</div>
                  <div><strong>Entfernung:</strong> ${distanceAlongRoute.toFixed(
                    1
                  )} km</div>
                </div>
              `;
            }

            // Update map marker
            onPositionChange?.({
              lng: poi.lngLat[0],
              lat: poi.lngLat[1],
              distance: distanceAlongRoute,
              elevation: profileElevation,
              grade: 0,
            });
          })
          .on('mouseleave', function () {
            d3.select(this)
              .select('image')
              .transition()
              .duration(200)
              .attr('width', 20)
              .attr('height', 20)
              .attr('x', -10)
              .attr('y', -10);

            if (tooltipRef.current) {
              tooltipRef.current.style.opacity = '0';
            }
            onPositionChange?.(null);
          })
          .on('click', function (event: any) {
            // Stop event from propagating to overlay
            event.stopPropagation();
            console.log('[ElevationProfile] POI clicked:', poi.name);
            // Call onPoiClick callback to zoom to POI on map and open sidebar
            if (onPoiClick) {
              onPoiClick(poi);
            } else {
              console.warn('[ElevationProfile] onPoiClick not provided');
            }
          });
      }
    });

    // Overlay mouse events (overlay was created earlier, before POI layer)
    let isHovering = false;

    // Mouse enter
    overlay.on('mouseenter', () => {
      isHovering = true;
      crosshair.attr('opacity', 1);
      marker.attr('opacity', 1);
      if (tooltipRef.current) tooltipRef.current.style.opacity = '1';
    });

    // Mouse move - matching elevation.js
    overlay.on('mousemove', function (event) {
      if (!isHovering) return;

      const [mouseX] = d3.pointer(event);
      const hoverDistance = xScale.invert(mouseX);

      // Find closest point
      let closestPoint = elevationData[0];
      let minDist = Math.abs(closestPoint.distance - hoverDistance);
      let hoveredIndex = 0;

      for (let i = 1; i < elevationData.length; i++) {
        const dist = Math.abs(elevationData[i].distance - hoverDistance);
        if (dist < minDist) {
          closestPoint = elevationData[i];
          minDist = dist;
          hoveredIndex = i;
        }
      }

      const xPos = xScale(closestPoint.distance);
      const yPos = yScale(closestPoint.elevation);

      crosshair.attr('x1', xPos).attr('x2', xPos);
      marker.attr('cx', xPos).attr('cy', yPos);

      // Calculate grade (slope) - matching elevation.js
      let grade = 0;
      if (hoveredIndex > 0) {
        const lookBack = Math.min(5, hoveredIndex);
        const prevPoint = elevationData[hoveredIndex - lookBack];
        const elevationChange = closestPoint.elevation - prevPoint.elevation;
        const distanceChange =
          (closestPoint.distance - prevPoint.distance) * 1000;

        if (distanceChange > 0) {
          grade = (elevationChange / distanceChange) * 100;
        }
      }

      // Update tooltip - matching elevation.js
      if (tooltipRef.current) {
        const isFirstHalf = xPos < innerWidth / 2;
        tooltipRef.current.style.left = isFirstHalf
          ? `${xPos + margin.left + 10}px`
          : `${xPos + margin.left - 10}px`;
        tooltipRef.current.style.top = `${yPos + margin.top - 35}px`;
        tooltipRef.current.style.transform = isFirstHalf
          ? 'translate(0, 0)'
          : 'translate(-100%, 0)';
        tooltipRef.current.innerHTML = `
          <div style="padding: 3px 0">
            <div><strong>Entfernung:</strong> ${closestPoint.distance.toFixed(
              1
            )} km</div>
            <div><strong>Höhenmeter:</strong> ${Math.round(
              closestPoint.elevation
            )} m</div>
            <div><strong>Steigung:</strong> ${grade.toFixed(1)}%</div>
          </div>
        `;
      }

      // Update map marker
      onPositionChange?.({
        lng: closestPoint.coordinates[0],
        lat: closestPoint.coordinates[1],
        distance: closestPoint.distance,
        elevation: closestPoint.elevation,
        grade,
      });
    });

    // Mouse leave
    overlay.on('mouseleave', () => {
      isHovering = false;
      crosshair.attr('opacity', 0);
      marker.attr('opacity', 0);
      if (tooltipRef.current) tooltipRef.current.style.opacity = '0';
      onPositionChange?.(null);
    });

    // Wheel zoom - matching elevation.js handleZoom
    overlay.on('wheel', event => {
      event.preventDefault();
      const [mouseX] = d3.pointer(event);
      const mouseDistance = xScale.invert(mouseX);

      const zoomChange = event.deltaY < 0 ? 1.2 : 0.8;
      const newZoomLevel = Math.max(
        1,
        Math.min(MAX_ZOOM, zoomLevel * zoomChange)
      );

      if (newZoomLevel === 1) {
        setZoomLevel(1);
        setVisibleDomain({ x: [0, routeDistance] });
        return;
      }

      const newDomainWidth = routeDistance / newZoomLevel;
      let newMin = mouseDistance - newDomainWidth / 2;
      let newMax = mouseDistance + newDomainWidth / 2;

      if (newMin < 0) {
        newMin = 0;
        newMax = newDomainWidth;
      }
      if (newMax > routeDistance) {
        newMax = routeDistance;
        newMin = Math.max(0, routeDistance - newDomainWidth);
      }

      setZoomLevel(newZoomLevel);
      setVisibleDomain({ x: [newMin, newMax] });
    });

    // Zoom text - matching elevation.js
    svg
      .append('text')
      .attr('class', `zoom-text${zoomLevel > 1 ? ' reset' : ''}`)
      .attr('x', width - 15)
      .attr('y', 22)
      .attr('text-anchor', 'end')
      .attr('fill', zoomLevel > 1 ? '#088373' : 'rgba(255, 255, 255, 0.6)')
      .attr('stroke', 'black')
      .attr('stroke-width', 2)
      .attr('paint-order', 'stroke')
      .style('font-size', '14px')
      .style('cursor', zoomLevel > 1 ? 'pointer' : 'default')
      .text(zoomLevel > 1 ? 'Reset' : 'Zoom')
      .on('click', () => {
        if (zoomLevel > 1) {
          setZoomLevel(1);
          setVisibleDomain({ x: [0, routeDistance] });
        }
      });

    // Highlight distance indicator from map hover
    if (highlightDistance !== undefined) {
      const highlightX = xScale(highlightDistance);
      if (highlightX >= 0 && highlightX <= innerWidth) {
        let closestPoint = elevationData[0];
        for (const point of elevationData) {
          if (
            Math.abs(point.distance - highlightDistance) <
            Math.abs(closestPoint.distance - highlightDistance)
          ) {
            closestPoint = point;
          }
        }

        g.append('line')
          .attr('class', 'highlight-crosshair')
          .attr('x1', highlightX)
          .attr('x2', highlightX)
          .attr('y1', 0)
          .attr('y2', innerHeight)
          .attr('stroke', COLORS.CROSSHAIR)
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '4,4');

        g.append('circle')
          .attr('class', 'highlight-marker')
          .attr('cx', highlightX)
          .attr('cy', yScale(closestPoint.elevation))
          .attr('r', 8)
          .attr('fill', COLORS.MARKER_FILL)
          .attr('stroke', COLORS.MARKER_STROKE)
          .attr('stroke-width', 2);
      }
    }
  }, [
    route,
    pois,
    dimensions,
    visibleDomain,
    zoomLevel,
    highlightDistance,
    onPositionChange,
    generateElevationData,
    realElevations,
    tourType,
    COLORS,
    margin,
  ]);

  const { t } = useTranslation();

  if (!route) {
    return (
      <div ref={containerRef} className="custom-profile-container">
        <div className="loading-indicator">
          <i
            className="fas fa-mountain"
            style={{ animation: 'bounce 1.5s ease-in-out infinite' }}
          ></i>
          <span>{t('routeLoading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      id="customProfileContainer"
      className="custom-profile-container"
      style={{ position: 'relative' }}
    >
      {/* Zoom Controls */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(11, 18, 21, 0.9)',
          padding: '6px 10px',
          borderRadius: '8px',
          border: '1px solid #1e2a33',
        }}
      >
        <button
          onClick={() => setZoomLevel(Math.max(1, zoomLevel - 0.5))}
          disabled={zoomLevel <= 1}
          style={{
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: zoomLevel <= 1 ? '#1e2a33' : '#088d95',
            color: zoomLevel <= 1 ? '#666' : '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: zoomLevel <= 1 ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          −
        </button>
        <input
          type="range"
          min="1"
          max={MAX_ZOOM}
          step="0.5"
          value={zoomLevel}
          onChange={e => setZoomLevel(parseFloat(e.target.value))}
          style={{
            width: '80px',
            height: '4px',
            appearance: 'none',
            background: `linear-gradient(to right, #088d95 0%, #088d95 ${
              ((zoomLevel - 1) / (MAX_ZOOM - 1)) * 100
            }%, #1e2a33 ${
              ((zoomLevel - 1) / (MAX_ZOOM - 1)) * 100
            }%, #1e2a33 100%)`,
            borderRadius: '2px',
            cursor: 'pointer',
          }}
        />
        <button
          onClick={() => setZoomLevel(Math.min(MAX_ZOOM, zoomLevel + 0.5))}
          disabled={zoomLevel >= MAX_ZOOM}
          style={{
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: zoomLevel >= MAX_ZOOM ? '#1e2a33' : '#088d95',
            color: zoomLevel >= MAX_ZOOM ? '#666' : '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: zoomLevel >= MAX_ZOOM ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          +
        </button>
        {zoomLevel > 1 && (
          <button
            onClick={() => setZoomLevel(1)}
            style={{
              padding: '4px 8px',
              background: 'transparent',
              color: '#088d95',
              border: '1px solid #088d95',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px',
            }}
          >
            1:1
          </button>
        )}
      </div>

      <svg
        ref={svgRef}
        className="custom-profile-svg"
        width="100%"
        height="100%"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        preserveAspectRatio="xMidYMid meet"
      />
      <div
        ref={tooltipRef}
        className="custom-tooltip"
        style={{
          position: 'absolute',
          background: 'rgba(11, 18, 21, 0.9)',
          color: '#fff',
          padding: '6px 10px',
          borderRadius: '4px',
          fontSize: '12px',
          pointerEvents: 'none',
          zIndex: 10,
          whiteSpace: 'nowrap',
          opacity: 0,
          transition: 'opacity 0.1s ease',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  );
}
