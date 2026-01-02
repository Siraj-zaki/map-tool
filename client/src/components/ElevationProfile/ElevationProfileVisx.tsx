import { AxisBottom, AxisLeft } from '@visx/axis';
import { Brush } from '@visx/brush';
import { curveMonotoneX } from '@visx/curve';
import { localPoint } from '@visx/event';
import { LinearGradient } from '@visx/gradient';
import { Group } from '@visx/group';
import { PatternLines } from '@visx/pattern';
import { ParentSize } from '@visx/responsive';
import { scaleLinear } from '@visx/scale';
import { AreaClosed } from '@visx/shape';
import { TooltipWithBounds, defaultStyles, useTooltip } from '@visx/tooltip';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { POI, Route } from '../../api';
import { useColorSettings } from '../../contexts/ColorSettingsContext';
import { getRouteElevations } from '../../utils/elevation';
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

// POI icon mapping
const POI_ICONS: Record<string, string> = {
  gipfel: '⛰️',
  highlight: '⭐',
  hotel: '🏨',
  restaurant: '🍽️',
  viewpoint: '👁️',
  peak: '🏔️',
};

// Margins for chart
const margin = { top: 20, right: 30, bottom: 50, left: 60 };

// Brush height
const BRUSH_HEIGHT = 30;
const BRUSH_MARGIN = { top: 10, bottom: 15 };

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
  const [brushDomain, setBrushDomain] = useState<{
    x0: number;
    x1: number;
  } | null>(null);

  const {
    showTooltip,
    hideTooltip,
    tooltipOpen,
    tooltipData,
    tooltipLeft,
    tooltipTop,
  } = useTooltip<ElevationPoint>();

  // Inner dimensions
  const innerWidth = width - margin.left - margin.right;
  const chartHeight =
    height - BRUSH_HEIGHT - BRUSH_MARGIN.top - BRUSH_MARGIN.bottom;
  const innerHeight = chartHeight - margin.top - margin.bottom;

  // Get filtered data based on brush domain
  const displayData = useMemo(() => {
    if (!brushDomain) return data;
    return data.filter(
      d => d.distance >= brushDomain.x0 && d.distance <= brushDomain.x1
    );
  }, [data, brushDomain]);

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

  // Full scale for brush
  const xScaleFull = useMemo(
    () =>
      scaleLinear<number>({
        domain: [
          Math.min(...data.map(d => d.distance)),
          Math.max(...data.map(d => d.distance)),
        ],
        range: [0, innerWidth],
      }),
    [data, innerWidth]
  );

  const yScaleBrush = useMemo(
    () =>
      scaleLinear<number>({
        domain: [
          Math.min(...data.map(d => d.elevation)),
          Math.max(...data.map(d => d.elevation)),
        ],
        range: [BRUSH_HEIGHT - 5, 0],
      }),
    [data]
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

        // Calculate cumulative elevation (sum of all elevations from start to current point)
        let totalElevation = 0;
        for (let i = 0; i <= idx; i++) {
          totalElevation += allData[i].elevation;
        }
        setCumulativeAscent(totalElevation);

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

  // Handle brush change
  const handleBrushChange = useCallback((domain: any) => {
    if (!domain) {
      setBrushDomain(null);
      return;
    }
    const { x0, x1 } = domain;
    setBrushDomain({ x0, x1 });
  }, []);

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
                <circle
                  r={isHovered ? 14 : 12}
                  fill="#0b1215"
                  stroke={isHovered ? '#fff' : '#088d95'}
                  strokeWidth={isHovered ? 3 : 2}
                  style={{ transition: 'all 0.15s ease' }}
                />
                <text
                  textAnchor="middle"
                  dy="0.35em"
                  fontSize={isHovered ? 16 : 14}
                  style={{ pointerEvents: 'none' }}
                >
                  {POI_ICONS[poiData.poi.type || ''] || '📍'}
                </text>
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
                <circle
                  r={isHovered ? 14 : 12}
                  fill="#0b1215"
                  stroke={isHovered ? '#fff' : '#088d95'}
                  strokeWidth={isHovered ? 3 : 2}
                  style={{ transition: 'all 0.15s ease' }}
                />
                <text
                  textAnchor="middle"
                  dy="0.35em"
                  fontSize={isHovered ? 16 : 14}
                  style={{ pointerEvents: 'none' }}
                >
                  {POI_ICONS[poiData.poi.type || ''] || '📍'}
                </text>
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
            numTicks={6}
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

      {/* Brush for zoom */}
      <svg
        width={width}
        height={BRUSH_HEIGHT + BRUSH_MARGIN.top + BRUSH_MARGIN.bottom}
      >
        <PatternLines
          id="brush-pattern"
          height={8}
          width={8}
          stroke="#088d95"
          strokeWidth={1}
          orientation={['diagonal']}
        />
        <Group left={margin.left} top={BRUSH_MARGIN.top}>
          <AreaClosed<ElevationPoint>
            data={data}
            x={d => xScaleFull(d.distance)}
            y={d => yScaleBrush(d.elevation)}
            yScale={yScaleBrush}
            curve={curveMonotoneX}
            fill="#088d95"
            fillOpacity={0.3}
          />
          <Brush
            xScale={xScaleFull}
            yScale={yScaleBrush}
            width={innerWidth}
            height={BRUSH_HEIGHT}
            handleSize={8}
            resizeTriggerAreas={['left', 'right']}
            brushDirection="horizontal"
            onChange={handleBrushChange}
            selectedBoxStyle={{
              fill: 'url(#brush-pattern)',
              stroke: '#088d95',
            }}
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
          <div>
            <strong>{t('distance')}:</strong> {tooltipData.distance.toFixed(1)}{' '}
            km
          </div>
          <div>
            <strong>{t('elevation')}:</strong> {tooltipData.elevation} m
          </div>
          <div>
            <strong>{t('grade', 'Grade')}:</strong> {currentGrade.toFixed(1)}%
          </div>
          <div>
            <strong>{t('totalAscent', 'Total Elevation')}:</strong>{' '}
            {Math.round(cumulativeAscent).toLocaleString()} m
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
          <span className="poi-tooltip-icon">
            {POI_ICONS[hoveredPoi.type || ''] || '📍'}
          </span>
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
  const [elevationsLoading, setElevationsLoading] = useState(false);

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

  return (
    <div ref={containerRef} className="elevation-profile-visx-container">
      <ParentSize>
        {({ width, height }) => (
          <ElevationChart
            width={width}
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
        )}
      </ParentSize>
    </div>
  );
}
