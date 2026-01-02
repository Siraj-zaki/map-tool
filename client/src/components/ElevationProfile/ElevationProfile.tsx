import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  Brush,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { POI, Route } from '../../api';
import { useColorSettings } from '../../contexts/ColorSettingsContext';
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
  stage?: number;
}

interface PoiDataPoint {
  distance: number;
  elevation: number;
  poi: POI;
  x: number;
  y: number;
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

export default function ElevationProfile({
  route,
  pois = [],
  tourType = 'gold',
  onPositionChange,
  highlightDistance,
  onPoiClick,
}: ElevationProfileProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  // Real elevation data state
  const [realElevations, setRealElevations] = useState<number[] | null>(null);
  const [elevationsLoading, setElevationsLoading] = useState(false);

  // Brush (zoom) state
  const [brushDomain, setBrushDomain] = useState<{
    startIndex?: number;
    endIndex?: number;
  }>({});

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

    console.log('[ElevationProfile] Coords length:', coords.length);
    console.log(
      '[ElevationProfile] RealElevations length:',
      realElevations?.length
    );
    if (realElevations) {
      console.log(
        '[ElevationProfile] Length mismatch?',
        coords.length !== realElevations.length
      );
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

      // Prioritize stored elevation data (interpolating if needed)
      if (route.elevationData && route.elevationData.length > 0) {
        // If exact match (rare unless unsampled), use directly
        if (route.elevationData.length === coords.length) {
          elevation = route.elevationData[i].elevation;
        } else {
          // Interpolate based on distance matches
          // This handles the sampled vs full geometry mismatch

          // Normalize current position
          // Use locally calculated accumulatedDistance vs local total, OR
          // map local accumulatedDistance to the stored data's distance scale

          // Simple linear search interpolation (optimization: confirm sorted)
          // route.elevationData is sorted by distance

          const targetDist = accumulatedDistance;

          // Find surrounding points
          // Optimization: Start search from last found index if performance is an issue,
          // but for <200 points simple find is fast enough.
          const data = route.elevationData;

          // Handle edge cases
          if (targetDist <= data[0].distance) elevation = data[0].elevation;
          else if (targetDist >= data[data.length - 1].distance)
            elevation = data[data.length - 1].elevation;
          else {
            // Find index where data[j].distance <= targetDist < data[j+1].distance
            let found = false;
            // Optimized search could start from previous I, but let's keep it safe
            for (let j = 0; j < data.length - 1; j++) {
              if (
                targetDist >= data[j].distance &&
                targetDist <= data[j + 1].distance
              ) {
                const p1 = data[j];
                const p2 = data[j + 1];
                const range = p2.distance - p1.distance;
                if (range === 0) {
                  elevation = p1.elevation;
                } else {
                  const t = (targetDist - p1.distance) / range;
                  elevation = p1.elevation + t * (p2.elevation - p1.elevation);
                }
                found = true;
                break;
              }
            }
            if (!found) elevation = data[data.length - 1].elevation; // Should be covered by >= check, but fallback
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

      // Create point with stage-specific elevation keys for colored segments
      const point: any = {
        distance: Math.round(accumulatedDistance * 100) / 100,
        elevation: Math.round(elevation),
        index: i,
        coordinates: coords[i],
        stage: stageIndex,
      };

      // Add stage-specific elevation keys (only the current stage has value, others are null)
      for (let s = 0; s < numStages; s++) {
        point[`elevation_stage${s}`] =
          s === stageIndex ? Math.round(elevation) : null;
      }

      data.push(point);
    }

    return data;
  }, [route, realElevations, tourType]);

  // Calculate POI positions along the route
  // Find the point on the route closest to each POI and use its accumulated distance
  const poiDataPoints = useMemo((): PoiDataPoint[] => {
    if (!elevationData.length || !pois.length) return [];

    // Get the start point of the route
    const startPoint = elevationData[0];

    const result = pois.map(poi => {
      // Method 1: Find the closest point on the route to this POI
      // and use its accumulated distance value
      let minDist = Infinity;
      let closestPoint = startPoint;

      for (const point of elevationData) {
        if (!point.coordinates || point.coordinates.length < 2) continue;

        let poiLat: number, poiLng: number;

        // Handle both array [lng, lat] and object {lng, lat} formats
        // Runtime data from Mapbox geocoder or DB might vary
        if (Array.isArray(poi.lngLat)) {
          poiLat = Number(poi.lngLat[1]);
          poiLng = Number(poi.lngLat[0]);
        } else if (typeof poi.lngLat === 'object' && poi.lngLat !== null) {
          // @ts-ignore - Handle runtime object shape
          poiLat = Number(poi.lngLat.lat || poi.lngLat[1]);
          // @ts-ignore
          poiLng = Number(poi.lngLat.lng || poi.lngLat[0]);
        } else {
          console.warn('[ElevationProfile] Invalid POI format:', poi);
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

        // Debug log for first few points to check values
        if (point.index < 3) {
          console.log(
            `[ElevationProfile] Checking POI ${poi.name} vs Point ${point.index}: Dist=${dist}, Coords1=[${poi.lngLat}], Coords2=[${point.coordinates}]`
          );
        }
      }

      console.log(
        `[ElevationProfile] Final POI ${poi.name}: ClosestIdx=${closestPoint.index}, RouteDist=${closestPoint.distance}, MinDist=${minDist}`
      );

      // Use the accumulated distance of the closest point on the route
      // This gives us the distance along the route from start to where the POI is
      return {
        distance: closestPoint.distance,
        elevation: closestPoint.elevation,
        poi,
        minDistToRoute: minDist,
        x: closestPoint.distance,
        y: closestPoint.elevation,
      };
    });

    // Filter out POIs that are too far from the route (> 2km) and invalid coords
    return result.filter(
      p => p.minDistToRoute < 2 && !isNaN(p.x) && !isNaN(p.y)
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
        console.error('[ElevationProfile] Failed to fetch elevations:', err);
        setRealElevations(null);
      })
      .finally(() => setElevationsLoading(false));
  }, [route]);

  // Custom tooltip - DO NOT call setState/onPositionChange here to avoid infinite loop
  const CustomTooltip = useCallback(
    ({ active, payload }: any) => {
      if (!active || !payload || !payload.length) return null;

      const data = payload[0].payload as ElevationPoint;

      // Calculate grade
      let grade = 0;
      const idx = data.index;
      if (idx > 0 && elevationData[idx - 1]) {
        const prev = elevationData[idx - 1];
        const elevChange = data.elevation - prev.elevation;
        const distChange = (data.distance - prev.distance) * 1000;
        if (distChange > 0) {
          grade = (elevChange / distChange) * 100;
        }
      }

      return (
        <div
          className="recharts-custom-tooltip"
          style={{ pointerEvents: 'none' }}
        >
          <div>
            <strong>{t('distance')}:</strong> {data.distance.toFixed(1)} km
          </div>
          <div>
            <strong>{t('elevation')}:</strong> {data.elevation} m
          </div>
          <div>
            <strong>{t('grade', 'Grade')}:</strong> {grade.toFixed(1)}%
          </div>
        </div>
      );
    },
    [elevationData, t]
  );

  // Handle chart mouse move - update map marker position
  const handleChartMouseMove = useCallback(
    (state: any) => {
      if (state && state.activePayload && state.activePayload.length > 0) {
        const data = state.activePayload[0].payload as ElevationPoint;

        // Calculate grade
        let grade = 0;
        const idx = data.index;
        if (idx > 0 && elevationData[idx - 1]) {
          const prev = elevationData[idx - 1];
          const elevChange = data.elevation - prev.elevation;
          const distChange = (data.distance - prev.distance) * 1000;
          if (distChange > 0) {
            grade = (elevChange / distChange) * 100;
          }
        }

        onPositionChange?.({
          lng: data.coordinates[0],
          lat: data.coordinates[1],
          distance: data.distance,
          elevation: data.elevation,
          grade,
        });
      }
    },
    [elevationData, onPositionChange]
  );

  // Handle brush change (zoom)
  const handleBrushChange = useCallback((domain: any) => {
    if (domain) {
      setBrushDomain({
        startIndex: domain.startIndex,
        endIndex: domain.endIndex,
      });
    }
  }, []);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    onPositionChange?.(null);
  }, [onPositionChange]);

  // Get stage colors for gradient
  const stageColors = useMemo(() => {
    const config = { gold: 1, silver: 2, bronze: 3 };
    const numStages = config[tourType];
    return Array.from({ length: numStages }, (_, i) =>
      getStageColor(tourType, i)
    );
  }, [tourType, getStageColor]);

  // Stage info for rendering multiple colored areas
  // The dataKeys are already in elevationData (elevation_stage0, elevation_stage1, etc.)
  const stageDataSets = useMemo(() => {
    const config = { gold: 1, silver: 2, bronze: 3 };
    const numStages = config[tourType];

    return Array.from({ length: numStages }, (_, stageIdx) => ({
      stageIndex: stageIdx,
      dataKey: numStages === 1 ? 'elevation' : `elevation_stage${stageIdx}`,
    }));
  }, [tourType]);

  // Calculate stage boundary points (for divider lines and dots)
  const stageBoundaries = useMemo(() => {
    const config = { gold: 1, silver: 2, bronze: 3 };
    const numStages = config[tourType];

    if (numStages <= 1) return [];

    const boundaries: {
      distance: number;
      elevation: number;
      stageIndex: number;
    }[] = [];

    for (let i = 1; i < elevationData.length; i++) {
      if (elevationData[i].stage !== elevationData[i - 1].stage) {
        boundaries.push({
          distance: elevationData[i].distance,
          elevation: elevationData[i].elevation,
          stageIndex: elevationData[i].stage!,
        });
      }
    }

    return boundaries;
  }, [elevationData, tourType]);

  if (!route) {
    return (
      <div ref={containerRef} className="custom-profile-container">
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

  // State to track if user is interacting with POI to disable overlapped tooltips
  const [hoveringPoi, setHoveringPoi] = useState(false);

  if (elevationsLoading) {
    return (
      <div ref={containerRef} className="custom-profile-container">
        <div className="loading-indicator">
          <i className="fas fa-spinner fa-spin" />
          <span>{t('loading')}</span>
        </div>
      </div>
    );
  }

  const minElevation = Math.min(...elevationData.map(d => d.elevation)) - 50;
  const maxElevation = Math.max(...elevationData.map(d => d.elevation)) + 50;

  return (
    <div
      ref={containerRef}
      className="custom-profile-container recharts-container"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={elevationData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          onMouseMove={e => {
            if (hoveringPoi) return; // Ignore chart hover if on POI
            handleChartMouseMove(e);
          }}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="elevationGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#088d95" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#088d95" stopOpacity={0.1} />
            </linearGradient>
            {stageColors.map((color, i) => (
              <linearGradient
                key={i}
                id={`stageGradient${i}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={color} stopOpacity={0.6} />
                <stop offset="95%" stopColor={color} stopOpacity={0.1} />
              </linearGradient>
            ))}
          </defs>

          <XAxis
            dataKey="distance"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={value => {
              const range = route?.distance || 10;
              if (range < 10) return `${value.toFixed(1)} km`;
              return `${value.toFixed(0)} km`;
            }}
            stroke="#a0a0a0"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: '#1e2a33' }}
            allowDecimals={true}
            allowDuplicatedCategory={false}
          />
          <YAxis
            domain={[minElevation, maxElevation]}
            tickFormatter={value => `${value} m`}
            stroke="#a0a0a0"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: '#1e2a33' }}
            width={50}
          />

          {!hoveringPoi && (
            <Tooltip
              content={<CustomTooltip />}
              wrapperStyle={{ pointerEvents: 'none' }}
            />
          )}

          {/* Stage-colored elevation areas - each stage has its own colored segment */}
          {stageDataSets.map(({ stageIndex, dataKey }) => (
            <Area
              key={`stage-${stageIndex}`}
              type="monotone"
              dataKey={dataKey}
              stroke={stageColors[stageIndex] || '#088d95'}
              strokeWidth={2}
              fill={`url(#stageGradient${stageIndex})`}
              fillOpacity={0.7}
              isAnimationActive={false}
              connectNulls={false}
            />
          ))}

          {/* Stage boundary divider lines */}
          {stageBoundaries.map((boundary, idx) => (
            <ReferenceLine
              key={`stage-divider-${idx}`}
              x={boundary.distance}
              stroke={stageColors[boundary.stageIndex] || '#fff'}
              strokeWidth={2}
              strokeDasharray="4 2"
            />
          ))}

          {/* Stage boundary dots */}
          {stageBoundaries.map((boundary, idx) => (
            <ReferenceDot
              key={`stage-dot-${idx}`}
              x={boundary.distance}
              y={boundary.elevation}
              r={6}
              fill={stageColors[boundary.stageIndex] || '#088d95'}
              stroke="#fff"
              strokeWidth={2}
            />
          ))}

          {/* Start marker (A) */}
          {elevationData.length > 0 && (
            <ReferenceDot
              x={elevationData[0].distance}
              y={elevationData[0].elevation}
              r={8}
              fill="#10B981"
              stroke="#fff"
              strokeWidth={2}
              label={{
                value: 'A',
                fill: '#fff',
                fontSize: 10,
                fontWeight: 'bold',
              }}
            />
          )}

          {/* End marker (B) */}
          {elevationData.length > 0 && (
            <ReferenceDot
              x={elevationData[elevationData.length - 1].distance}
              y={elevationData[elevationData.length - 1].elevation}
              r={8}
              fill="#EF4444"
              stroke="#fff"
              strokeWidth={2}
              label={{
                value: 'B',
                fill: '#fff',
                fontSize: 10,
                fontWeight: 'bold',
              }}
            />
          )}

          {/* POI markers - Visual Layer (non-interactive) */}
          {poiDataPoints.map((poiData, idx) => (
            <ReferenceDot
              key={`poi-visual-${idx}-${poiData.distance}`}
              x={poiData.distance}
              y={poiData.elevation}
              r={10}
              fill="#0b1215"
              stroke="#088d95"
              strokeWidth={2}
              style={{ pointerEvents: 'none' }}
              label={{
                value: POI_ICONS[poiData.poi.type || ''] || '📍',
                position: 'center',
                fontSize: 14,
              }}
            />
          ))}

          {/* POI markers - Interaction Layer (Invisible, larger hit area) */}
          {poiDataPoints.map((poiData, idx) => (
            <ReferenceDot
              key={`poi-hit-${idx}-${poiData.distance}`}
              x={poiData.distance}
              y={poiData.elevation}
              r={50} // Large hit radius for easy clicking/hovering
              fill="transparent"
              stroke="none"
              onClick={(props: any, event: any) => {
                const e = event || props;
                if (e && typeof e.stopPropagation === 'function') {
                  e.stopPropagation();
                }
                onPoiClick?.(poiData.poi);
              }}
              onMouseEnter={() => setHoveringPoi(true)}
              onMouseLeave={() => setHoveringPoi(false)}
              style={{
                cursor: 'pointer',
                // padding: '40px',
              }}
            />
          ))}

          {/* POI vertical lines */}
          {poiDataPoints.map((poiData, idx) => (
            <ReferenceLine
              key={`line-${idx}`}
              x={poiData.distance}
              stroke="rgba(255,255,255,0.2)"
              strokeDasharray="3 3"
            />
          ))}

          {/* Highlight marker from map hover */}
          {highlightDistance !== undefined && (
            <ReferenceLine
              x={highlightDistance}
              stroke="#088d95"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          )}

          {/* Brush for zoom/scroll */}
          <Brush
            dataKey="distance"
            height={20}
            stroke="#088d95"
            fill="#0b1215"
            tickFormatter={value => `${value.toFixed(0)} km`}
            onChange={handleBrushChange}
            startIndex={brushDomain.startIndex}
            endIndex={brushDomain.endIndex}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
