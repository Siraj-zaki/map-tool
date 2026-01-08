import { AxisBottom, AxisLeft } from '@visx/axis';
import { curveMonotoneX } from '@visx/curve';
import { localPoint } from '@visx/event';
import { LinearGradient } from '@visx/gradient';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';
import { scaleLinear } from '@visx/scale';
import { AreaClosed } from '@visx/shape';
import { TooltipWithBounds, defaultStyles, useTooltip } from '@visx/tooltip';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { POI, Route } from '../../api';
import { useColorSettings } from '../../contexts/ColorSettingsContext';
import './ElevationProfileVisx.css';

interface ElevationProfileVisxProps {
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
  stage?: number;
}

interface PoiDataPoint {
  distance: number;
  elevation: number;
  poi: POI;
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

// POI icon images by type
const POI_ICONS: Record<string, string> = {
  highlight: '/images/highlight-ico.png',
  gipfel: '/images/mountsin-ico.png', // Note: typo in filename
  restaurant: '/images/resturant-ico.png', // Note: typo in filename
  hotel: '/images/hotel-ico.png',
};
const POI_ICON_FALLBACK = '/images/highlight-ico.png';
const POI_ICON_SIZE = 34; // Size in pixels

// Helper to get POI icon based on type
function getPoiIcon(poiType: string | undefined): string {
  if (!poiType) return POI_ICON_FALLBACK;
  return POI_ICONS[poiType.toLowerCase()] || POI_ICON_FALLBACK;
}

// Margins for chart - reduced bottom margin since brush is removed
const margin = { top: 15, right: 20, bottom: 35, left: 50 };

// Tooltip styles
const tooltipStyles = {
  ...defaultStyles,
  background: 'rgba(11, 18, 21, 0.95)',
  border: '1px solid #088d95',
  color: '#fff',
  padding: '8px 12px',
  borderRadius: '6px',
  fontSize: '12px',
};

interface ChartProps {
  width: number;
  height: number;
  data: ElevationPoint[];
  pois: PoiDataPoint[];
  stageColors: string[];
  tourType: 'gold' | 'silver' | 'bronze';
  onPositionChange?: ElevationProfileVisxProps['onPositionChange'];
  onPoiClick?: (poi: POI) => void;
  highlightDistance?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}

function ElevationChart({
  width,
  height,
  data,
  pois,
  stageColors,
  tourType,
  onPositionChange,
  onPoiClick,
  highlightDistance,
  t,
}: ChartProps) {
  const [hoveredPoi, setHoveredPoi] = useState<POI | null>(null);
  const [hoveredPoiPosition, setHoveredPoiPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [currentGrade, setCurrentGrade] = useState<number>(0);
  const [cumulativeAscent, setCumulativeAscent] = useState<number>(0);

  const {
    showTooltip,
    hideTooltip,
    tooltipOpen,
    tooltipData,
    tooltipLeft,
    tooltipTop,
  } = useTooltip<ElevationPoint>();

  // Inner dimensions - use full height since brush is removed
  const innerWidth = width - margin.left - margin.right;
  const chartHeight = height;
  const innerHeight = chartHeight - margin.top - margin.bottom;

  // Always use full data since brush is removed
  const displayData = data;

  // Scales
  const xScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: [
          Math.min(...displayData.map(d => d.distance)),
          Math.max(...displayData.map(d => d.distance)),
        ],
        range: [0, innerWidth],
      }),
    [displayData, innerWidth]
  );

  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: [
          Math.min(...displayData.map(d => d.elevation)) - 50,
          Math.max(...displayData.map(d => d.elevation)) + 50,
        ],
        range: [innerHeight, 0],
        nice: true,
      }),
    [displayData, innerHeight]
  );

  // Get stage segments
  const stageSegments = useMemo(() => {
    const config = { gold: 1, silver: 2, bronze: 3 };
    const numStages = config[tourType];
    const segments: ElevationPoint[][] = [];
    const pointsPerStage = Math.ceil(displayData.length / numStages);

    for (let i = 0; i < numStages; i++) {
      const start = i * pointsPerStage;
      const end = Math.min((i + 1) * pointsPerStage + 1, displayData.length);
      segments.push(displayData.slice(start, end));
    }

    return segments;
  }, [displayData, tourType]);

  // Stage boundaries for markers
  const stageBoundaries = useMemo(() => {
    const config = { gold: 1, silver: 2, bronze: 3 };
    const numStages = config[tourType];

    if (numStages <= 1) return [];

    const boundaries: {
      distance: number;
      elevation: number;
      stageIndex: number;
    }[] = [];

    for (let i = 1; i < displayData.length; i++) {
      if (displayData[i].stage !== displayData[i - 1].stage) {
        boundaries.push({
          distance: displayData[i].distance,
          elevation: displayData[i].elevation,
          stageIndex: displayData[i].stage!,
        });
      }
    }

    return boundaries;
  }, [displayData, tourType]);

  // Handle mouse move on chart
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGRectElement>) => {
      if (hoveredPoi) return; // Don't show tooltip if hovering POI

      const point = localPoint(event);
      if (!point) return;

      const x0 = xScale.invert(point.x - margin.left);

      // Find closest data point
      let closestPoint = displayData[0];
      let minDiff = Math.abs(x0 - closestPoint.distance);

      for (const d of displayData) {
        const diff = Math.abs(x0 - d.distance);
        if (diff < minDiff) {
          minDiff = diff;
          closestPoint = d;
        }
      }

      if (closestPoint) {
        // Calculate grade
        let grade = 0;
        const idx = closestPoint.index;
        const allData = data;
        if (idx > 0 && allData[idx - 1]) {
          const prev = allData[idx - 1];
          const elevChange = closestPoint.elevation - prev.elevation;
          const distChange = (closestPoint.distance - prev.distance) * 1000;
          if (distChange > 0) {
            grade = (elevChange / distChange) * 100;
          }
        }

        setCurrentGrade(grade);

        // Calculate cumulative elevation GAIN (sum of positive elevation changes from start to current point)
        let totalAscent = 0;
        for (let i = 1; i <= idx; i++) {
          const elevChange = allData[i].elevation - allData[i - 1].elevation;
          if (elevChange > 0) {
            totalAscent += elevChange;
          }
        }
        setCumulativeAscent(totalAscent);

        showTooltip({
          tooltipData: closestPoint,
          tooltipLeft: xScale(closestPoint.distance) + margin.left,
          tooltipTop: yScale(closestPoint.elevation) + margin.top,
        });

        onPositionChange?.({
          lng: closestPoint.coordinates[0],
          lat: closestPoint.coordinates[1],
          distance: closestPoint.distance,
          elevation: closestPoint.elevation,
          grade,
        });
      }
    },
    [
      displayData,
      data,
      xScale,
      yScale,
      showTooltip,
      onPositionChange,
      hoveredPoi,
    ]
  );

  const handleMouseLeave = useCallback(() => {
    hideTooltip();
    onPositionChange?.(null);
  }, [hideTooltip, onPositionChange]);

  if (width < 100 || data.length === 0) return null;

  return (
    <div className="elevation-chart-visx">
      <svg width={width} height={chartHeight}>
        {/* Gradients */}
        {stageColors.map((color, i) => (
          <LinearGradient
            key={`gradient-${i}`}
            id={`area-gradient-${i}`}
            from={color}
            to={color}
            fromOpacity={0.6}
            toOpacity={0.1}
          />
        ))}

        <Group left={margin.left} top={margin.top}>
          {/* Stage-colored area fills */}
          {stageSegments.map((segment, i) => (
            <AreaClosed<ElevationPoint>
              key={`area-${i}`}
              data={segment}
              x={d => xScale(d.distance)}
              y={d => yScale(d.elevation)}
              yScale={yScale}
              curve={curveMonotoneX}
              fill={`url(#area-gradient-${i})`}
              stroke={stageColors[i]}
              strokeWidth={2}
            />
          ))}

          {/* Stage boundary lines */}
          {stageBoundaries.map((boundary, idx) => (
            <line
              key={`boundary-line-${idx}`}
              x1={xScale(boundary.distance)}
              y1={0}
              x2={xScale(boundary.distance)}
              y2={innerHeight}
              stroke={stageColors[boundary.stageIndex]}
              strokeWidth={2}
              strokeDasharray="4 2"
            />
          ))}

          {/* Stage boundary dots */}
          {stageBoundaries.map((boundary, idx) => (
            <circle
              key={`boundary-dot-${idx}`}
              cx={xScale(boundary.distance)}
              cy={yScale(boundary.elevation)}
              r={6}
              fill={stageColors[boundary.stageIndex]}
              stroke="#fff"
              strokeWidth={2}
            />
          ))}

          {/* Highlight line from map hover */}
          {highlightDistance !== undefined && (
            <line
              x1={xScale(highlightDistance)}
              y1={0}
              x2={xScale(highlightDistance)}
              y2={innerHeight}
              stroke="#088d95"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          )}

          {/* POI vertical lines */}
          {pois.map((poiData, idx) => (
            <line
              key={`poi-line-${idx}`}
              x1={xScale(poiData.distance)}
              y1={0}
              x2={xScale(poiData.distance)}
              y2={innerHeight}
              stroke="rgba(255,255,255,0.2)"
              strokeDasharray="3 3"
            />
          ))}

          {/* Start marker */}
          {displayData.length > 0 && (
            <g
              transform={`translate(${xScale(
                displayData[0].distance
              )}, ${yScale(displayData[0].elevation)})`}
            >
              <circle r={8} fill="#10B981" stroke="#fff" strokeWidth={2} />
              <text
                textAnchor="middle"
                dy="0.35em"
                fill="#fff"
                fontSize={10}
                fontWeight="bold"
              >
                A
              </text>
            </g>
          )}

          {/* End marker */}
          {displayData.length > 0 && (
            <g
              transform={`translate(${xScale(
                displayData[displayData.length - 1].distance
              )}, ${yScale(displayData[displayData.length - 1].elevation)})`}
            >
              <circle r={8} fill="#EF4444" stroke="#fff" strokeWidth={2} />
              <text
                textAnchor="middle"
                dy="0.35em"
                fill="#fff"
                fontSize={10}
                fontWeight="bold"
              >
                B
              </text>
            </g>
          )}

          {/* POI markers - these have their own event handlers separate from chart */}
          {pois.map((poiData, idx) => {
            const isHovered = hoveredPoi === poiData.poi;
            return (
              <g
                key={`poi-${idx}`}
                transform={`translate(${xScale(poiData.distance)}, ${yScale(
                  poiData.elevation
                )})`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={e => {
                  e.stopPropagation();
                  setHoveredPoi(poiData.poi);
                  setHoveredPoiPosition({
                    x: xScale(poiData.distance) + margin.left,
                    y: yScale(poiData.elevation) + margin.top - 20,
                  });
                  hideTooltip();
                }}
                onMouseLeave={() => {
                  setHoveredPoi(null);
                  setHoveredPoiPosition(null);
                }}
                onClick={e => {
                  e.stopPropagation();
                  onPoiClick?.(poiData.poi);
                }}
              >
                {/* Transparent hit area for mouse events */}
                <circle
                  r={POI_ICON_SIZE / 2 + 4}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                />
                {/* Hover ring */}
                {isHovered && (
                  <circle
                    r={POI_ICON_SIZE / 2 + 2}
                    fill="none"
                    stroke="#088d95"
                    strokeWidth={2}
                    style={{ transition: 'all 0.15s ease' }}
                  />
                )}
                <image
                  href={getPoiIcon(poiData.poi.type)}
                  x={-POI_ICON_SIZE / 2}
                  y={-POI_ICON_SIZE / 2}
                  width={POI_ICON_SIZE}
                  height={POI_ICON_SIZE}
                  style={{
                    pointerEvents: 'none',
                    opacity: isHovered ? 1 : 0.85,
                    filter: isHovered ? 'drop-shadow(0 0 4px #088d95)' : 'none',
                    transition: 'opacity 0.15s ease, filter 0.15s ease',
                  }}
                />
              </g>
            );
          })}

          {/* Tooltip crosshair */}
          {tooltipOpen && tooltipData && !hoveredPoi && (
            <>
              <line
                x1={xScale(tooltipData.distance)}
                y1={0}
                x2={xScale(tooltipData.distance)}
                y2={innerHeight}
                stroke="#088d95"
                strokeWidth={1}
                strokeDasharray="3 3"
                pointerEvents="none"
              />
              <circle
                cx={xScale(tooltipData.distance)}
                cy={yScale(tooltipData.elevation)}
                r={6}
                fill="#088d95"
                stroke="#fff"
                strokeWidth={2}
                pointerEvents="none"
              />
            </>
          )}

          {/* Invisible overlay for mouse events - rendered AFTER POIs so POIs are on top */}
          <rect
            x={0}
            y={0}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: 'crosshair' }}
          />

          {/* Re-render POIs on top of the rect for proper event handling */}
          {pois.map((poiData, idx) => {
            const isHovered = hoveredPoi === poiData.poi;
            return (
              <g
                key={`poi-top-${idx}`}
                transform={`translate(${xScale(poiData.distance)}, ${yScale(
                  poiData.elevation
                )})`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={e => {
                  e.stopPropagation();
                  setHoveredPoi(poiData.poi);
                  setHoveredPoiPosition({
                    x: xScale(poiData.distance) + margin.left,
                    y: yScale(poiData.elevation) + margin.top - 20,
                  });
                  hideTooltip();
                }}
                onMouseLeave={() => {
                  setHoveredPoi(null);
                  setHoveredPoiPosition(null);
                }}
                onClick={e => {
                  e.stopPropagation();
                  onPoiClick?.(poiData.poi);
                }}
              >
                {/* Transparent hit area for mouse events */}
                <circle
                  r={POI_ICON_SIZE / 2 + 4}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                />
                {/* Hover ring */}
                {isHovered && (
                  <circle
                    r={POI_ICON_SIZE / 2 + 2}
                    fill="none"
                    stroke="#088d95"
                    strokeWidth={2}
                    style={{ transition: 'all 0.15s ease' }}
                  />
                )}
                <image
                  href={getPoiIcon(poiData.poi.type)}
                  x={-POI_ICON_SIZE / 2}
                  y={-POI_ICON_SIZE / 2}
                  width={POI_ICON_SIZE}
                  height={POI_ICON_SIZE}
                  style={{
                    pointerEvents: 'none',
                    opacity: isHovered ? 1 : 0.85,
                    filter: isHovered ? 'drop-shadow(0 0 4px #088d95)' : 'none',
                    transition: 'opacity 0.15s ease, filter 0.15s ease',
                  }}
                />
              </g>
            );
          })}

          {/* X Axis */}
          <AxisBottom
            scale={xScale}
            top={innerHeight}
            stroke="#a0a0a0"
            tickStroke="#a0a0a0"
            tickLabelProps={() => ({
              fill: '#a0a0a0',
              fontSize: 10,
              textAnchor: 'middle',
            })}
            tickFormat={value => `${Number(value).toFixed(0)} km`}
            numTicks={Math.min(20, Math.ceil(xScale.domain()[1] / 10))}
          />

          {/* Y Axis */}
          <AxisLeft
            scale={yScale}
            stroke="#a0a0a0"
            tickStroke="#a0a0a0"
            tickLabelProps={() => ({
              fill: '#a0a0a0',
              fontSize: 10,
              textAnchor: 'end',
              dx: '-0.25em',
              dy: '0.25em',
            })}
            tickFormat={value => `${value} m`}
            numTicks={5}
          />
        </Group>
      </svg>
      {/* Tooltip - rendered outside SVG */}
      {tooltipOpen && tooltipData && !hoveredPoi && (
        <TooltipWithBounds
          top={tooltipTop}
          left={tooltipLeft}
          style={tooltipStyles}
        >
          {/* Nach: distance (time, ↗ cumulative ascent) */}
          <div style={{ marginBottom: '4px' }}>
            <strong>{t('to', 'Nach')}:</strong>{' '}
            <span style={{ color: '#088d95' }}>
              {tooltipData.distance.toFixed(1)} km
            </span>
            <span style={{ color: '#9ca3af', marginLeft: '6px' }}>
              (↗ {Math.round(cumulativeAscent).toLocaleString()} m)
            </span>
          </div>
          {/* Höhenmeter (current elevation) */}
          <div>
            <strong>{t('elevation', 'Höhenmeter')}:</strong>{' '}
            <span>{Math.round(tooltipData.elevation).toLocaleString()} m</span>
          </div>
          {/* Steigung (grade) */}
          <div>
            <strong>{t('grade', 'Steigung')}:</strong>{' '}
            <span style={{ color: currentGrade >= 0 ? '#22c55e' : '#ef4444' }}>
              {currentGrade >= 0 ? '↗' : '↘'}{' '}
              {Math.abs(currentGrade).toFixed(1)}%
            </span>
          </div>
        </TooltipWithBounds>
      )}

      {/* POI info tooltip - positioned above the POI */}
      {hoveredPoi && hoveredPoiPosition && (
        <div
          className="poi-tooltip-visx"
          style={{
            position: 'absolute',
            left: hoveredPoiPosition.x,
            top: hoveredPoiPosition.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <img
            src={getPoiIcon(hoveredPoi?.type)}
            alt=""
            className="poi-tooltip-icon"
            style={{ width: '18px', height: '18px' }}
          />
          <span className="poi-tooltip-name">{hoveredPoi.name || 'POI'}</span>
        </div>
      )}
    </div>
  );
}

export default function ElevationProfileVisx({
  route,
  pois = [],
  tourType = 'gold',
  onPositionChange,
  highlightDistance,
  onPoiClick,
}: ElevationProfileVisxProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  // Real elevation data state
  const [realElevations, setRealElevations] = useState<number[] | null>(null);
  const [elevationsLoading, _setElevationsLoading] = useState(false);

  // Get dynamic colors from context
  const { getStageColor } = useColorSettings();

  // Generate elevation data from route
  const elevationData = useMemo((): ElevationPoint[] => {
    if (!route) return [];

    // Use stored routeGeometry if available
    let coords: [number, number][];
    if (route.routeGeometry && route.routeGeometry.length > 0) {
      coords = route.routeGeometry;
    } else {
      coords = [route.startPoint, ...route.waypoints, route.endPoint] as [
        number,
        number
      ][];
    }

    const data: ElevationPoint[] = [];
    let accumulatedDistance = 0;

    const hasRealElevations =
      realElevations && realElevations.length === coords.length;

    // Stage configuration
    const stageConfig = { gold: 1, silver: 2, bronze: 3 };
    const numStages = stageConfig[tourType];
    const pointsPerStage = Math.ceil(coords.length / numStages);

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

      let elevation = 0;

      // Prioritize stored elevation data
      if (route.elevationData && route.elevationData.length > 0) {
        if (route.elevationData.length === coords.length) {
          elevation = route.elevationData[i].elevation;
        } else {
          const targetDist = accumulatedDistance;
          const elevData = route.elevationData;

          if (targetDist <= elevData[0].distance)
            elevation = elevData[0].elevation;
          else if (targetDist >= elevData[elevData.length - 1].distance)
            elevation = elevData[elevData.length - 1].elevation;
          else {
            for (let j = 0; j < elevData.length - 1; j++) {
              if (
                targetDist >= elevData[j].distance &&
                targetDist <= elevData[j + 1].distance
              ) {
                const p1 = elevData[j];
                const p2 = elevData[j + 1];
                const range = p2.distance - p1.distance;
                if (range === 0) {
                  elevation = p1.elevation;
                } else {
                  const interpolation = (targetDist - p1.distance) / range;
                  elevation =
                    p1.elevation +
                    interpolation * (p2.elevation - p1.elevation);
                }
                break;
              }
            }
          }
        }
      } else if (hasRealElevations) {
        elevation = realElevations![i];
      } else {
        // Synthetic elevation
        const elevRange = route.highestPoint - route.lowestPoint;
        const normalizedPos =
          accumulatedDistance / (route.distance / 1000 || 1);
        const base = route.lowestPoint + elevRange * 0.3;
        const wave1 = Math.sin(normalizedPos * Math.PI * 2) * elevRange * 0.3;
        const wave2 = Math.sin(normalizedPos * Math.PI * 4) * elevRange * 0.15;
        const wave3 = Math.sin(normalizedPos * Math.PI * 8) * elevRange * 0.05;
        const curve = Math.sin(normalizedPos * Math.PI) * elevRange * 0.2;
        elevation = Math.max(
          route.lowestPoint,
          Math.min(route.highestPoint, base + wave1 + wave2 + wave3 + curve)
        );
      }

      const stageIndex = Math.floor(i / pointsPerStage);

      data.push({
        distance: Math.round(accumulatedDistance * 100) / 100,
        elevation: Math.round(elevation),
        index: i,
        coordinates: coords[i],
        stage: stageIndex,
      });
    }

    return data;
  }, [route, realElevations, tourType]);

  // Calculate POI positions along the route
  const poiDataPoints = useMemo((): PoiDataPoint[] => {
    if (!elevationData.length || !pois.length) return [];

    const startPoint = elevationData[0];

    const result = pois.map(poi => {
      let minDist = Infinity;
      let closestPoint = startPoint;

      for (const point of elevationData) {
        if (!point.coordinates || point.coordinates.length < 2) continue;

        let poiLat: number, poiLng: number;

        if (Array.isArray(poi.lngLat)) {
          poiLat = Number(poi.lngLat[1]);
          poiLng = Number(poi.lngLat[0]);
        } else if (typeof poi.lngLat === 'object' && poi.lngLat !== null) {
          // @ts-ignore
          poiLat = Number(poi.lngLat.lat || poi.lngLat[1]);
          // @ts-ignore
          poiLng = Number(poi.lngLat.lng || poi.lngLat[0]);
        } else {
          continue;
        }

        const dist = calculateDistance(
          poiLat,
          poiLng,
          Number(point.coordinates[1]),
          Number(point.coordinates[0])
        );

        if (!isNaN(dist) && dist < minDist) {
          minDist = dist;
          closestPoint = point;
        }
      }

      return {
        distance: closestPoint.distance,
        elevation: closestPoint.elevation,
        poi,
        minDistToRoute: minDist,
      };
    });

    return result.filter(
      p => p.minDistToRoute < 2 && !isNaN(p.distance) && !isNaN(p.elevation)
    );
  }, [elevationData, pois]);

  // Fetch real elevation data
  useEffect(() => {
    if (!route) return;

    if (route.elevationData && route.elevationData.length > 0) {
      const elevations = route.elevationData.map(p => p.elevation);
      setRealElevations(elevations);
      return;
    }

    // DISABLED: Editor now handles elevation calculation explicitly
    // The elevation profile will use synthetic data until elevation is calculated
    // This prevents redundant API calls since Editor uses Mapbox client-side method

    /* 
    const coords =
      route.routeGeometry && route.routeGeometry.length > 0
        ? route.routeGeometry
        : ([route.startPoint, ...route.waypoints, route.endPoint] as [
            number,
            number
          ][]);

    if (coords.length < 2) return;

    setElevationsLoading(true);
    getRouteElevations(coords)
      .then(elevations => setRealElevations(elevations))
      .catch(err => {
        console.error(
          '[ElevationProfileVisx] Failed to fetch elevations:',
          err
        );
        setRealElevations(null);
      })
      .finally(() => setElevationsLoading(false));
    */
  }, [route]);

  // Get stage colors
  const stageColors = useMemo(() => {
    const config = { gold: 1, silver: 2, bronze: 3 };
    const numStages = config[tourType];
    return Array.from({ length: numStages }, (_, i) =>
      getStageColor(tourType, i)
    );
  }, [tourType, getStageColor]);

  if (!route) {
    return (
      <div ref={containerRef} className="elevation-profile-visx-container">
        <div className="loading-indicator">
          <i
            className="fas fa-mountain"
            style={{ animation: 'bounce 1.5s ease-in-out infinite' }}
          />
          <span>{t('routeLoading')}</span>
        </div>
      </div>
    );
  }

  if (elevationsLoading) {
    return (
      <div ref={containerRef} className="elevation-profile-visx-container">
        <div className="loading-indicator">
          <i className="fas fa-spinner fa-spin" />
          <span>{t('loading')}</span>
        </div>
      </div>
    );
  }

  // Calculate minimum chart width based on distance (40 pixels per km for readability)
  const minChartWidth = useMemo(() => {
    if (!route) return 800;
    const maxDistance =
      elevationData.length > 0
        ? Math.max(...elevationData.map(d => d.distance))
        : route.distance || 0;
    // Minimum 40 pixels per km, but at least 800px and max 8000px
    return Math.max(800, Math.min(8000, maxDistance * 40));
  }, [route, elevationData]);

  return (
    <div ref={containerRef} className="elevation-profile-visx-container">
      <ParentSize>
        {({ width: containerWidth, height }) => {
          // Use the larger of container width or calculated minimum
          const chartWidth = Math.max(containerWidth, minChartWidth);
          const needsScroll = chartWidth > containerWidth;

          return (
            <div
              className="elevation-chart-scroll-container"
              style={{
                width: `${containerWidth}px`,
                maxWidth: `${containerWidth}px`,
                height: '100%',
                overflowX: needsScroll ? 'auto' : 'hidden',
                overflowY: 'hidden',
              }}
            >
              <div style={{ width: chartWidth, height: '100%' }}>
                <ElevationChart
                  width={chartWidth}
                  height={height}
                  data={elevationData}
                  pois={poiDataPoints}
                  stageColors={stageColors}
                  tourType={tourType}
                  onPositionChange={onPositionChange}
                  onPoiClick={onPoiClick}
                  highlightDistance={highlightDistance}
                  t={t}
                />
              </div>
            </div>
          );
        }}
      </ParentSize>
    </div>
  );
}
