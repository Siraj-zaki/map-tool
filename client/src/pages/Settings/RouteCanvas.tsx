import { useMemo } from 'react';
import type { RouteSettings, StageColorSetting } from '@/api';

type TourType = 'gold' | 'silver' | 'bronze';

interface RouteCanvasProps {
  routeSettings: RouteSettings;
  stageColors: Record<TourType, StageColorSetting[]>;
}

// Generate a smooth curved path for the route
function generateRoutePath(
  width: number,
  height: number,
  segments: number
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const padding = 40;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = padding + t * usableWidth;
    // Create a smooth S-curve
    const baseY = usableHeight / 2;
    const amplitude = usableHeight * 0.3;
    const y = baseY + Math.sin(t * Math.PI * 1.5) * amplitude * (0.6 + Math.sin(t * Math.PI) * 0.4);
    points.push({ x, y });
  }
  return points;
}

// Build SVG path from points
function pointsToPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx1 = prev.x + (curr.x - prev.x) * 0.5;
    const cpx2 = prev.x + (curr.x - prev.x) * 0.5;
    d += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

export default function RouteCanvas({ routeSettings, stageColors }: RouteCanvasProps) {
  const canvasWidth = 480;
  const canvasHeight = 360;

  const routePoints = useMemo(
    () => generateRoutePath(canvasWidth, canvasHeight, 60),
    [canvasWidth, canvasHeight]
  );

  const routePath = useMemo(() => pointsToPath(routePoints), [routePoints]);

  // Create stage segments for the colored preview
  const stageSegments = useMemo(() => {
    const allStages = [
      ...stageColors.gold.map((s) => ({ ...s, tour: 'gold' as const })),
      ...stageColors.silver.map((s) => ({ ...s, tour: 'silver' as const })),
      ...stageColors.bronze.map((s) => ({ ...s, tour: 'bronze' as const })),
    ];

    const totalStages = allStages.length || 1;
    const segments: { path: string; color: string; opacity: number }[] = [];

    const pointsPerSegment = Math.ceil(routePoints.length / totalStages);

    for (let i = 0; i < totalStages; i++) {
      const startIdx = Math.floor((i / totalStages) * routePoints.length);
      const endIdx = Math.floor(((i + 1) / totalStages) * routePoints.length);
      const segmentPoints = routePoints.slice(startIdx, endIdx + 1);

      if (segmentPoints.length >= 2) {
        segments.push({
          path: pointsToPath(segmentPoints),
          color: allStages[i]?.lineColor || '#3b82f6',
          opacity: allStages[i]?.lineOpacity ?? 1,
        });
      }
    }

    return segments;
  }, [routePoints, stageColors]);

  const shadowOffset = Math.max(routeSettings.lineWidth * 0.4, 2);
  const shadowBlur = routeSettings.lineWidth * 1.2;

  return (
    <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-white/[0.06] bg-zinc-900/50">
      {/* Map grid pattern background */}
      <svg
        width="100%"
        height="100%"
        className="absolute inset-0"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path
              d="M 32 0 L 0 0 0 32"
              fill="none"
              stroke="rgba(255,255,255,0.03)"
              strokeWidth="0.5"
            />
          </pattern>
          {/* Glow filter for route */}
          <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Subtle terrain hints */}
        <circle cx="120" cy="280" r="80" fill="rgba(255,255,255,0.015)" />
        <circle cx="380" cy="100" r="60" fill="rgba(255,255,255,0.01)" />
        <circle cx="300" cy="300" r="50" fill="rgba(255,255,255,0.012)" />
      </svg>

      {/* Route SVG overlay */}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        className="absolute inset-0"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy={shadowOffset}
              stdDeviation={shadowBlur}
              floodColor={routeSettings.shadowColor}
              floodOpacity={routeSettings.shadowOpacity}
            />
          </filter>
        </defs>

        {/* Shadow layer */}
        {stageSegments.length > 0 && (
          <g filter="url(#shadow)">
            {stageSegments.map((seg, i) => (
              <path
                key={`shadow-${i}`}
                d={seg.path}
                fill="none"
                stroke={seg.color}
                strokeWidth={routeSettings.lineWidth + 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={seg.opacity * 0.5}
              />
            ))}
          </g>
        )}

        {/* Main route line */}
        {stageSegments.length > 0 ? (
          stageSegments.map((seg, i) => (
            <path
              key={`route-${i}`}
              d={seg.path}
              fill="none"
              stroke={seg.color}
              strokeWidth={routeSettings.lineWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={seg.opacity}
            />
          ))
        ) : (
          <path
            d={routePath}
            fill="none"
            stroke={routeSettings.mainColor}
            strokeWidth={routeSettings.lineWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#shadow)"
          />
        )}

        {/* Route glow effect */}
        {stageSegments.length > 0 && (
          <g opacity="0.3" filter="url(#routeGlow)">
            {stageSegments.map((seg, i) => (
              <path
                key={`glow-${i}`}
                d={seg.path}
                fill="none"
                stroke={seg.color}
                strokeWidth={Math.max(routeSettings.lineWidth - 2, 1)}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={seg.opacity}
              />
            ))}
          </g>
        )}

        {/* Start marker */}
        {routePoints.length > 0 && (
          <g>
            <circle
              cx={routePoints[0].x}
              cy={routePoints[0].y}
              r="6"
              fill="#10b981"
              stroke="#0f1117"
              strokeWidth="2"
            />
            <text
              x={routePoints[0].x}
              y={routePoints[0].y - 12}
              textAnchor="middle"
              fill="#a1a1aa"
              fontSize="9"
              fontFamily="system-ui"
            >
              Start
            </text>
          </g>
        )}

        {/* End marker */}
        {routePoints.length > 1 && (
          <g>
            <circle
              cx={routePoints[routePoints.length - 1].x}
              cy={routePoints[routePoints.length - 1].y}
              r="6"
              fill="#ef4444"
              stroke="#0f1117"
              strokeWidth="2"
            />
            <text
              x={routePoints[routePoints.length - 1].x}
              y={routePoints[routePoints.length - 1].y - 12}
              textAnchor="middle"
              fill="#a1a1aa"
              fontSize="9"
              fontFamily="system-ui"
            >
              End
            </text>
          </g>
        )}
      </svg>

      {/* Legend overlay */}
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
        {stageColors.gold.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-zinc-400">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stageColors.gold[0]?.lineColor }} />
            Gold
          </div>
        )}
        {stageColors.silver.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-zinc-400">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stageColors.silver[0]?.lineColor }} />
            Silver
          </div>
        )}
        {stageColors.bronze.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-zinc-400">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stageColors.bronze[0]?.lineColor }} />
            Bronze
          </div>
        )}
      </div>

      {/* Stats overlay */}
      <div className="absolute top-3 right-3 px-2.5 py-1.5 rounded-md bg-black/60 backdrop-blur-sm">
        <div className="text-[10px] text-zinc-500 font-mono">
          {routeSettings.lineWidth}px · {Math.round(routeSettings.shadowOpacity * 100)}% shadow
        </div>
      </div>
    </div>
  );
}
