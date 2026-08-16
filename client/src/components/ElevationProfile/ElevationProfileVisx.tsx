// @ts-ignore
import { AxisBottom, AxisLeft } from '@visx/axis';
import { Brush } from '@visx/brush';
// @ts-ignore
import type { BaseBrush, Bounds, BrushHandleRenderProps } from '@visx/brush/lib/types';
import { curveMonotoneX } from '@visx/curve';
import { localPoint } from '@visx/event';
import { LinearGradient } from '@visx/gradient';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';
import { scaleLinear } from '@visx/scale';
import { AreaClosed, LinePath } from '@visx/shape';
import { useTooltip } from '@visx/tooltip';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import mapboxgl from 'mapbox-gl';
import type { POI, Route } from '../../api';
import { getCategoryOrFallback } from '../../constants/poiCategories';
import { useColorSettings } from '../../contexts/ColorSettingsContext';
import './ElevationProfileVisx.css';

// --- Assets ---
// POI icons rendered inline as SVG pill markers via the shared category
// registry — no PNG assets required for new categories.
const POI_ICON_SIZE = 34;

// --- Interfaces ---
interface SplitPoint {
  stageNumber: number;
  locationName: string;
  lng: number;
  lat: number;
  distanceKm: number;
}

interface ElevationProfileVisxProps {
  route: Route | null;
  pois?: POI[];
  tourType?: 'gold' | 'silver' | 'bronze';
  onPositionChange?: (pos: any) => void;
  highlightDistance?: number;
  onPoiClick?: (poi: POI) => void;
  splitPoints?: SplitPoint[];
}

interface ElevationPoint {
  distance: number;
  elevation: number;
  index: number;
  coordinates: [number, number];
  stage?: number;
  grade?: number;
  cumulativeGain?: number;
}

// --- Helper Functions ---

// --- Custom Brush Handle (like the working reference) ---
function BrushHandle({ x, height, isBrushActive }: BrushHandleRenderProps) {
  const pathWidth = 8;
  const pathHeight = 15;
  if (!isBrushActive) {
    return null;
  }
  return (
    <Group left={x + pathWidth / 2} top={(height - pathHeight) / 2}>
      <path
        fill="var(--brand-primary, #088d95)"
        d="M -4.5 0.5 L 3.5 0.5 L 3.5 15.5 L -4.5 15.5 L -4.5 0.5 M -1.5 4 L -1.5 12 M 0.5 4 L 0.5 12"
        stroke="#0b1215"
        strokeWidth="1"
        style={{ cursor: 'ew-resize' }}
      />
    </Group>
  );
}

// --- Selected brush style ---
const selectedBrushStyle = {
  fill: 'rgba(8, 141, 149, 0.15)',
  stroke: 'var(--brand-primary, #088d95)',
  strokeWidth: 1,
  rx: 10,
  ry: 10,
};

// --- Main Chart Component ---
function ElevationChart({
  width,
  height,
  data,
  pois,
  onPositionChange,
  highlightDistance,
  onPoiClick,
  tourType = 'gold',
  splitPoints = [],
}: {
  width: number;
  height: number;
  data: ElevationPoint[];
  pois: any[];
  onPositionChange?: any;
  highlightDistance?: number;
  onPoiClick?: (poi: POI) => void;
  tourType?: 'gold' | 'silver' | 'bronze';
  splitPoints?: SplitPoint[];
}) {
  // Bounds
  const margin = { top: 20, right: 0, bottom: 30, left: 60 };
  const HEADER_HEIGHT =
    typeof window !== 'undefined' && window.innerWidth < 768 ? 85 : 60;
  const graphHeight = height - HEADER_HEIGHT;
  const svgHeight = graphHeight;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = graphHeight - margin.top - margin.bottom;

  // Stage colors from context
  const { getStageColor, stageColors } = useColorSettings();
  const numStages = stageColors[tourType]?.length ?? 1;

  // Derived Data
  const maxDistance = useMemo(
    () => Math.max(...data.map(d => d.distance), 1),
    [data]
  );

  // State — zoomDomain drives the main chart x-axis
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);
  const brushRef = useRef<BaseBrush | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Mobile touch panning state
  const touchStartRef = useRef<{ x: number; domain: [number, number] } | null>(null);
  const isTouchPanning = useRef(false);

  // Scales for main chart
  const xScale = useMemo(
    () =>
      scaleLinear({
        domain: zoomDomain || [0, maxDistance],
        range: [0, innerWidth],
        clamp: true,
      }),
    [innerWidth, zoomDomain, maxDistance]
  );

  const yScale = useMemo(
    () =>
      scaleLinear({
        domain: [
          Math.min(...data.map(d => d.elevation)) * 0.9,
          Math.max(...data.map(d => d.elevation)) * 1.1,
        ],
        range: [innerHeight, 0],
        nice: true,
      }),
    [data, innerHeight]
  );

  // Brush / Minimap dimensions
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const DEFAULT_VISIBLE_KM = isMobile ? 40 : 60;
  const brushHeight = isMobile ? 24 : 30;
  const brushWidth = isMobile ? window.innerWidth - 24 : 358;

  // Brush scales (always span full data range)
  const brushXScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, maxDistance],
        range: [0, brushWidth],
      }),
    [maxDistance, brushWidth]
  );

  const brushYScale = useMemo(() => {
    const min = Math.min(...data.map(d => d.elevation));
    const max = Math.max(...data.map(d => d.elevation));
    const range = max - min || 1;
    return scaleLinear({
      domain: [min - range * 0.1, max + range * 0.5],
      range: [brushHeight, 0],
    });
  }, [data, brushHeight]);

  // Initial brush position — apply default zoom for long routes
  const initialBrushPosition = useMemo(() => {
    if (maxDistance > DEFAULT_VISIBLE_KM) {
      return {
        start: { x: brushXScale(0) },
        end: { x: brushXScale(DEFAULT_VISIBLE_KM) },
      };
    }
    return undefined;
  }, [brushXScale, maxDistance, DEFAULT_VISIBLE_KM]);

  // Apply default zoom once data is available
  const hasAppliedDefaultZoom = useRef(false);
  if (
    !hasAppliedDefaultZoom.current &&
    maxDistance > 1 &&
    zoomDomain === null
  ) {
    hasAppliedDefaultZoom.current = true;
    if (maxDistance > DEFAULT_VISIBLE_KM) {
      setZoomDomain([0, DEFAULT_VISIBLE_KM]);
    }
  }

  // Handle Brush Change — Brush onChange drives zoomDomain
  const onBrushChange = useCallback(
    (domain: Bounds | null) => {
      if (!domain) return;
      const { x0, x1 } = domain;
      if (Math.abs(x1 - x0) > 0.1) {
        setZoomDomain([x0, x1]);
      }
    },
    []
  );

  // Clicking inside the brush area (but outside selection) resets zoom
  const handleBrushClick = useCallback(() => {
    setZoomDomain(null);
    if (brushRef.current) {
      brushRef.current.reset();
    }
  }, []);

  // Tooltip
  const {
    showTooltip,
    hideTooltip,
    tooltipOpen,
    tooltipData,
    tooltipLeft,
    tooltipTop,
  } = useTooltip<ElevationPoint>();

  const [trailInfo, setTrailInfo] = useState<{ condition: string; type: string } | null>(null);

  // Fetch surface data from Mapbox when hovering
  useEffect(() => {
    if (!tooltipOpen || !tooltipData) {
      setTrailInfo(null);
      return;
    }

    const { coordinates } = tooltipData;
    // Don't fetch if coordinates are empty [0,0]
    if (!coordinates || (coordinates[0] === 0 && coordinates[1] === 0)) return;

    const timer = setTimeout(async () => {
      try {
        const url = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${coordinates[0]},${coordinates[1]}.json?radius=50&layers=road&access_token=${mapboxgl.accessToken}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();

        let condition = 'Unknown';
        let type = 'Unknown';

        if (data && data.features && data.features.length > 0) {
          const props = data.features[0].properties;
          condition = props.surface || 'Paved';
          type = props.class || 'Path';

          condition = condition.charAt(0).toUpperCase() + condition.slice(1);
          type = type.charAt(0).toUpperCase() + type.slice(1);
        }

        setTrailInfo({ condition, type });
      } catch (e) {
        console.error('Tilequery error:', e);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [tooltipOpen, tooltipData]);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      const { x } = localPoint(event) || { x: 0 };
      const x0 = xScale.invert(x - margin.left);

      const index = data.findIndex(d => d.distance >= x0);
      const d0 = data[index - 1];
      const d1 = data[index];
      let d = d0;
      if (d1 && d0) {
        d = x0 - d0.distance > d1.distance - x0 ? d1 : d0;
      } else if (d1) {
        d = d1;
      }

      if (d && svgRef.current) {
        const xPos = xScale(d.distance);
        const yPos = yScale(d.elevation);
        const rect = svgRef.current.getBoundingClientRect();

        const screenX = rect.left + margin.left + xPos;
        const screenY = rect.top + margin.top + yPos;

        const tooltipOffset = 150;
        let finalTop = screenY - tooltipOffset;

        const tooltipWidth = 280;
        let finalLeft = screenX;
        if (finalLeft + tooltipWidth > window.innerWidth - 20) {
          finalLeft = window.innerWidth - tooltipWidth - 20;
        }
        if (finalLeft < 20) {
          finalLeft = 20;
        }

        showTooltip({
          tooltipData: d,
          tooltipLeft: finalLeft,
          tooltipTop: finalTop,
        });
        onPositionChange?.({
          lng: d.coordinates[0],
          lat: d.coordinates[1],
          distance: d.distance,
          elevation: d.elevation,
          grade: 0,
        });
      }
    },
    [xScale, yScale, data, margin.left, margin.top, showTooltip, onPositionChange]
  );

  // Helper to clamp zoom domain
  const clampZoom = (
    start: number,
    end: number,
    maxDist: number
  ): [number, number] => {
    let newStart = start;
    let newEnd = end;
    const span = newEnd - newStart;
    if (span >= maxDist) return [0, maxDist];
    if (newStart < 0) {
      newStart = 0;
      newEnd = span;
    }
    if (newEnd > maxDist) {
      newEnd = maxDist;
      newStart = maxDist - span;
    }
    return [newStart, newEnd];
  };

  // ─── Core sync function: programmatically move the brush selection ───
  // Converts data-space domain → pixel coords and calls updateBrush so
  // the minimap highlight tracks the main chart exactly.
  const moveBrushTo = useCallback(
    (newDomain: [number, number]) => {
      if (!brushRef.current) return;

      const x0Px = brushXScale(newDomain[0]);
      const x1Px = brushXScale(newDomain[1]);

      brushRef.current.updateBrush((prevBrush) => {
        const newExtent = brushRef.current!.getExtent(
          { x: x0Px },
          { x: x1Px }
        );
        return {
          ...prevBrush,
          start: { y: newExtent.y0, x: newExtent.x0 },
          end: { y: newExtent.y1, x: newExtent.x1 },
          extent: newExtent,
        };
      });
    },
    [brushXScale]
  );

  // ─── Arrow handler: shift the window by 20% of current span ───
  // Updates zoomDomain (main chart re-renders) AND calls moveBrushTo
  // (minimap selection slides) — this is identical to dragging the brush.
  const handleArrowShift = useCallback(
    (direction: 'left' | 'right') => {
      if (!zoomDomain) return;
      const span = zoomDomain[1] - zoomDomain[0];
      const shift = span * 0.2;
      const delta = direction === 'left' ? -shift : shift;
      const [start, end] = clampZoom(
        zoomDomain[0] + delta,
        zoomDomain[1] + delta,
        maxDistance
      );
      const newDomain: [number, number] = [start, end];
      setZoomDomain(newDomain);
      moveBrushTo(newDomain);
    },
    [zoomDomain, maxDistance, moveBrushTo]
  );

  // ─── Zoom controls (+/- buttons) ───
  const handleZoom = useCallback(
    (zoomFactor: number) => {
      const currentDomain = zoomDomain || [0, maxDistance];
      const center = (currentDomain[0] + currentDomain[1]) / 2;
      const span = currentDomain[1] - currentDomain[0];
      const newSpan = span * zoomFactor;
      const half = newSpan / 2;
      const [start, end] = clampZoom(center - half, center + half, maxDistance);
      const newDomain: [number, number] = [start, end];
      setZoomDomain(newDomain);
      moveBrushTo(newDomain);
    },
    [zoomDomain, maxDistance, moveBrushTo]
  );

  // ─── Slider handler ───
  const handleSliderChange = useCallback(
    (val: number) => {
      const newFactor = 1 - ((val - 10) / 90) * 0.8;
      const newSpan = maxDistance * newFactor;
      const center = zoomDomain
        ? (zoomDomain[0] + zoomDomain[1]) / 2
        : maxDistance / 2;
      const [start, end] = clampZoom(
        center - newSpan / 2,
        center + newSpan / 2,
        maxDistance
      );
      const newDomain: [number, number] = [start, end];
      setZoomDomain(newDomain);
      moveBrushTo(newDomain);
    },
    [zoomDomain, maxDistance, moveBrushTo]
  );

  // --- Mobile Touch Pan Handlers ---
  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      const currentDomain = zoomDomain || [0, maxDistance];
      // Only allow panning when zoomed in
      if (currentDomain[1] - currentDomain[0] >= maxDistance * 0.99) return;
      touchStartRef.current = { x: touch.clientX, domain: [...currentDomain] as [number, number] };
      isTouchPanning.current = false;
    },
    [zoomDomain, maxDistance]
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (!touchStartRef.current || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dxPx = touchStartRef.current.x - touch.clientX; // positive = swipe left = pan right
      const domain = touchStartRef.current.domain;
      const span = domain[1] - domain[0];
      const dxData = (dxPx / innerWidth) * span;

      // Small threshold to distinguish tap from swipe
      if (Math.abs(dxPx) > 5) {
        isTouchPanning.current = true;
      }

      if (isTouchPanning.current) {
        event.preventDefault();
        hideTooltip();

        let newStart = domain[0] + dxData;
        let newEnd = domain[1] + dxData;
        if (newStart < 0) { newStart = 0; newEnd = span; }
        if (newEnd > maxDistance) { newEnd = maxDistance; newStart = maxDistance - span; }

        const newDomain: [number, number] = [newStart, newEnd];
        setZoomDomain(newDomain);
        moveBrushTo(newDomain);
      }
    },
    [maxDistance, innerWidth, hideTooltip, moveBrushTo]
  );

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
    isTouchPanning.current = false;
  }, []);

  // --- Mobile Minimap Brush Fix ---
  // @visx/brush only listens to window.mousemove/up for useWindowMoveEvents,
  // so touch drags on the minimap are ignored. Proxy window touch events to
  // BaseBrush's internal handlers so dragging / resizing works on phones.
  useEffect(() => {
    const handleTouchMove = (event: TouchEvent) => {
      if (!brushRef.current?.state?.isBrushing) return;
      if (event.touches.length !== 1) return;
      event.preventDefault();
      const touch = event.touches[0];
      brushRef.current?.handleWindowPointerMove?.({
        pageX: touch.pageX,
        pageY: touch.pageY,
      } as MouseEvent);
    };

    const handleTouchEnd = () => {
      brushRef.current?.handleWindowPointerUp?.();
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleTouchMove as any);
      window.removeEventListener('touchend', handleTouchEnd as any);
      window.removeEventListener('touchcancel', handleTouchEnd as any);
    };
  }, []);

  // Derived Values for UI
  const currentSpan = zoomDomain ? zoomDomain[1] - zoomDomain[0] : maxDistance;
  const zoomPercentage = Math.round((maxDistance / currentSpan) * 100);
  const factor = currentSpan / maxDistance;
  const sliderValue = Math.max(
    10,
    Math.min(100, ((1 - factor) / 0.8) * 90 + 10)
  );

  if (width < 10) return null;

  // --- Minimap with Brush ---
  // Renders the same stage colors as the main graph
  const minimapContent = (
    <div
      className="relative bg-[#0b1215] border border-[#2a4e58] shadow-xl overflow-hidden shrink-0 mx-auto md:mx-0 rounded-[10px]"
      style={{ width: brushWidth, height: brushHeight + 2, touchAction: 'none' }}
    >
      <svg width={brushWidth} height={brushHeight}>
        <defs>
          {/* Static fallback gradient */}
          <linearGradient
            id="minimap-gradient-fallback"
            x1="0" y1="0" x2="0" y2="1"
          >
            <stop offset="0%" stopColor="var(--brand-primary, #088d95)" stopOpacity={0.8} />
            <stop offset="100%" stopColor="var(--brand-primary, #088d95)" stopOpacity={0.2} />
          </linearGradient>

          {/* Per-stage gradients - same as main graph */}
          {(() => {
            const maxDist = data.length > 0 ? data[data.length - 1].distance : 1;
            let stageBoundaries: number[] = [];
            if (splitPoints && splitPoints.length > 0) {
              const sortedPoints = [...splitPoints].sort((a, b) => a.distanceKm - b.distanceKm);
              stageBoundaries = sortedPoints.map(p => p.distanceKm);
            }
            const numStages = stageBoundaries.length + 1;

            return Array.from({ length: numStages }).map((_, index) => {
              const stageColor = getStageColor(tourType, index);
              return (
                <linearGradient
                  key={`minimap-grad-${index}`}
                  id={`minimap-stage-gradient-${index}`}
                  x1="0" y1="0" x2="0" y2="1"
                >
                  <stop offset="0%" stopColor={stageColor} stopOpacity={0.8} />
                  <stop offset="100%" stopColor={stageColor} stopOpacity={0.2} />
                </linearGradient>
              );
            });
          })()}
        </defs>

        {/* Per-Stage Areas - same coloring as main graph */}
        {(() => {
          const maxDist = data.length > 0 ? data[data.length - 1].distance : 1;
          let stageBoundaries: number[] = [];
          if (splitPoints && splitPoints.length > 0) {
            const sortedPoints = [...splitPoints].sort((a, b) => a.distanceKm - b.distanceKm);
            stageBoundaries = sortedPoints.map(p => p.distanceKm);
          }

          const stageRanges: { start: number; end: number; index: number }[] = [];
          const numStagesActual = stageBoundaries.length + 1;

          for (let i = 0; i < numStagesActual; i++) {
            const stageStart = i === 0 ? 0 : stageBoundaries[i - 1];
            const stageEnd = i === numStagesActual - 1 ? maxDist : stageBoundaries[i];
            stageRanges.push({ start: stageStart, end: stageEnd, index: i });
          }

          // If no split points, use single static gradient
          if (stageRanges.length === 0) {
            return (
              <AreaClosed
                data={data}
                x={d => brushXScale(d.distance)}
                y={d => brushYScale(d.elevation)}
                yScale={brushYScale}
                fill="url(#minimap-gradient-fallback)"
                stroke="var(--brand-primary, #088d95)"
                strokeOpacity={0.6}
                strokeWidth={1}
                pointerEvents="none"
              />
            );
          }

          // Render each stage with its color
          return stageRanges.map(({ start, end, index }) => {
            const stageColor = getStageColor(tourType, index);
            const stageData = data.filter(
              d => d.distance >= start - 0.01 && d.distance <= end + 0.01
            );
            if (stageData.length < 2) return null;

            return (
              <g key={`minimap-stage-${index}`}>
                <AreaClosed
                  data={stageData}
                  x={d => brushXScale(d.distance)}
                  y={d => brushYScale(d.elevation)}
                  yScale={brushYScale}
                  fill={`url(#minimap-stage-gradient-${index})`}
                  stroke={stageColor}
                  strokeOpacity={0.8}
                  strokeWidth={1}
                  pointerEvents="none"
                />
              </g>
            );
          });
        })()}

        {/* The single Brush instance — handles drag, resize, selection */}
        <Brush
          xScale={brushXScale}
          yScale={brushYScale}
          width={brushWidth}
          height={brushHeight}
          handleSize={8}
          innerRef={brushRef}
          resizeTriggerAreas={['left', 'right']}
          brushDirection="horizontal"
          initialBrushPosition={initialBrushPosition}
          onChange={onBrushChange}
          onClick={handleBrushClick}
          selectedBoxStyle={selectedBrushStyle}
          useWindowMoveEvents
          renderBrushHandle={(props) => <BrushHandle {...props} />}
        />
      </svg>
    </div>
  );

  return (
    <div className="flex flex-col w-full h-full select-none bg-transparent md:bg-[#0b1215] rounded-xl overflow-hidden">
      {/* --- Header: Minimap & Zoom Controls (Desktop) --- */}
      <div className="hidden md:flex h-[60px] w-full items-center px-4 gap-6 border-b border-gray-800/30 shrink-0 relative z-30">
        {minimapContent}

        {/* Zoom Controls */}
        <div className="hidden md:block w-72 h-6 relative">
          {/* Badge */}
          <div className="w-11 h-6 left-0 top-0 absolute bg-black rounded-lg shadow-[0px_2px_7px_0px_rgba(0,0,0,0.25)] border border-cyan-950 flex items-center justify-center">
            <div className="text-white text-[10px] font-semibold font-['Roboto']">
              {zoomPercentage}%
            </div>
          </div>

          {/* Minus Button */}
          <div
            className="size-6 left-[54px] top-0 absolute bg-teal-950 rounded-lg shadow-[0px_2px_7px_0px_rgba(0,0,0,0.25)] border border-cyan-950 cursor-pointer hover:bg-teal-900 active:scale-95 transition-all flex items-center justify-center"
            onClick={() => handleZoom(1.2)}
          >
            <div className="w-2.5 h-0.5 bg-white rounded-full" />
          </div>

          {/* Slider Track */}
          <div className="w-44 h-1 left-[86px] top-[10px] absolute bg-cyan-950 rounded-[50px]" />
          <div
            className="h-1 left-[86px] top-[10px] absolute bg-teal-400 rounded-[50px] pointer-events-none transition-all duration-75"
            style={{ width: `${((sliderValue - 10) / 90) * 176}px` }}
          />
          <div
            className="size-4 top-[3px] absolute bg-teal-400 rounded-full border-2 border-black shadow-sm pointer-events-none transition-all duration-75"
            style={{ left: `${86 + ((sliderValue - 10) / 90) * 176 - 8}px` }}
          />
          <input
            type="range"
            min="10"
            max="100"
            value={sliderValue || 10}
            onChange={e => handleSliderChange(parseInt(e.target.value))}
            className="w-44 h-6 left-[86px] top-0 absolute opacity-0 cursor-pointer z-10"
          />

          {/* Plus Button */}
          <div
            className="size-6 left-[274px] top-0 absolute bg-teal-950 rounded-lg shadow-[0px_2px_7px_0px_rgba(0,0,0,0.25)] border border-cyan-950 cursor-pointer hover:bg-teal-900 active:scale-95 transition-all flex items-center justify-center"
            onClick={() => handleZoom(0.8)}
          >
            <div className="relative w-2.5 h-2.5">
              <div className="absolute left-1/2 top-0 -translate-x-1/2 w-0.5 h-2.5 bg-white rounded-full" />
              <div className="absolute top-1/2 left-0 -translate-y-1/2 w-2.5 h-0.5 bg-white rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Top Controls */}
      <div className="md:hidden w-full h-[85px] pt-2 px-2 shrink-0 flex flex-col gap-3 relative z-30 border-b border-gray-800/30">
        {minimapContent}

        <div className="flex justify-between items-center mt-1">
          <div className="w-[52px] h-[28px] bg-[#0c191a] rounded-md border border-[#2b5963] flex justify-center items-center shrink-0">
            <div className="text-white text-[12px] font-normal font-['Roboto']">
              {zoomPercentage}%
            </div>
          </div>

          <div className="flex flex-1 max-w-[50%] justify-between items-center mt-1">
            <div
              className="size-[28px] bg-[#0c191a] rounded-lg shadow-sm cursor-pointer flex items-center justify-center shrink-0 ml-4 hover:bg-[#153033]"
              onClick={() => handleZoom(1.2)}
            >
              <div className="w-2.5 h-[2px] bg-white rounded-full"></div>
            </div>

            <div className="flex-1 h-full flex items-center justify-center relative px-3 mx-2">
              <div className="w-full h-[6px] bg-[#1e464a] rounded-full"></div>
              <div
                className="absolute left-[12px] h-[6px] bg-[#5ec4cd] rounded-full pointer-events-none"
                style={{ width: `${((sliderValue - 10) / 90) * 100}%` }}
              ></div>
              <div
                className="absolute size-4 bg-[#5dd4d8] rounded-full pointer-events-none shadow"
                style={{
                  left: `calc(12px + ${((sliderValue - 10) / 90) * 100}% - 8px)`,
                }}
              ></div>
              <input
                type="range"
                min="10"
                max="100"
                value={sliderValue || 10}
                onChange={e => handleSliderChange(parseInt(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
            </div>

            <div
              className="size-[28px] bg-[#0c191a] rounded-lg shadow-sm cursor-pointer flex items-center justify-center shrink-0 hover:bg-[#153033]"
              onClick={() => handleZoom(0.8)}
            >
              <div className="relative w-2.5 h-2.5">
                <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[2px] h-2.5 bg-white rounded-full" />
                <div className="absolute top-1/2 left-0 -translate-y-1/2 w-2.5 h-[2px] bg-white rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- Body: Chart & Arrows --- */}
      <div className="flex-1 w-full relative p-4 pb-0 pt-0">
        {/* Navigation Buttons - Left Arrow */}
        {/* {zoomDomain && (
          <button
            className="hidden md:flex absolute right-16 top-[-20%] -translate-y-1/2 z-30 w-8 h-8 items-center justify-center bg-[#115e59] hover:bg-[#0f766e] rounded-full text-white shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all border border-[#088d95] hover:shadow-[0_0_15px_rgba(8,141,149,0.4)]"
            onClick={() => handleArrowShift('left')}
          >
            <i className="fas fa-chevron-left text-sm"></i>
          </button>
        )} */}

        {/* Main Chart SVG */}
        <svg
          ref={svgRef}
          width={width}
          height={svgHeight}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => hideTooltip()}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => {
            handleTouchEnd();
            hideTooltip();
          }}
          style={{ touchAction: 'none' }}
        >
          <LinearGradient
            id="main-gradient"
            from="var(--brand-primary, #088d95)"
            to="var(--brand-primary, #088d95)"
            fromOpacity={0.8}
            toOpacity={0.0}
          />

          <Group left={margin.left} top={margin.top}>
            {/* Grid */}
            {yScale.ticks(5).map((tick, i) => (
              <line
                key={i}
                x1={0}
                x2={innerWidth}
                y1={yScale(tick)}
                y2={yScale(tick)}
                stroke="#374151"
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.6}
              />
            ))}
            {xScale.ticks(10).map((tick, i) => (
              <line
                key={`x-${i}`}
                x1={xScale(tick)}
                x2={xScale(tick)}
                y1={0}
                y2={innerHeight}
                stroke="#374151"
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.2}
              />
            ))}

            {/* Per-Stage Area & Line */}
            {(() => {
              const maxDist = data.length > 0 ? data[data.length - 1].distance : 1;

              // Calculate stage boundaries based on split points
              let stageBoundaries: number[] = [];
              if (splitPoints && splitPoints.length > 0) {
                // Sort split points by distance
                const sortedPoints = [...splitPoints].sort((a, b) => a.distanceKm - b.distanceKm);
                stageBoundaries = sortedPoints.map(p => p.distanceKm);
              }

              // Build stage ranges
              const stageRanges: { start: number; end: number; index: number }[] = [];
              const numStagesActual = stageBoundaries.length + 1;

              for (let i = 0; i < numStagesActual; i++) {
                const stageStart = i === 0 ? 0 : stageBoundaries[i - 1];
                const stageEnd = i === numStagesActual - 1 ? maxDist : stageBoundaries[i];
                stageRanges.push({ start: stageStart, end: stageEnd, index: i });
              }

              return stageRanges.map(({ start, end, index }) => {
                const stageColor = getStageColor(tourType, index);
                const gradId = `stage-gradient-${index}`;
                const stageData = data.filter(
                  d => d.distance >= start - 0.01 && d.distance <= end + 0.01
                );
                if (stageData.length < 2) return null;

                return (
                  <g key={index}>
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={stageColor} stopOpacity={0.7} />
                        <stop offset="100%" stopColor={stageColor} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <AreaClosed
                      data={stageData}
                      x={d => xScale(d.distance)}
                      y={d => yScale(d.elevation)}
                      yScale={yScale}
                      curve={curveMonotoneX}
                      fill={`url(#${gradId})`}
                      stroke="transparent"
                    />
                    <LinePath
                      data={stageData}
                      x={d => xScale(d.distance)}
                      y={d => yScale(d.elevation)}
                      curve={curveMonotoneX}
                      stroke={stageColor}
                      strokeWidth={2}
                    />
                  </g>
                );
              });
            })()}

            {/* Stage Divider Lines */}
            {splitPoints && splitPoints.length > 0 && (
              <>
                {splitPoints.map((point, idx) => {
                  const x = xScale(point.distanceKm);
                  if (x < 0 || x > innerWidth) return null;
                  return (
                    <g key={`divider-${idx}`}>
                      <line
                        x1={x}
                        x2={x}
                        y1={0}
                        y2={innerHeight}
                        stroke="#ffffff"
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        opacity={0.6}
                      />
                      {/* Stage number label */}
                      <text
                        x={x + 5}
                        y={15}
                        fill="#ffffff"
                        fontSize={10}
                        fontWeight="bold"
                        opacity={0.8}
                      >
                        S{idx + 1}
                      </text>
                    </g>
                  );
                })}
              </>
            )}

            {/* Axes */}
            <AxisBottom
              scale={xScale}
              top={innerHeight}
              stroke="transparent"
              tickStroke="transparent"
              tickLabelProps={() => ({
                fill: '#9ca3af',
                fontSize: 10,
                textAnchor: 'middle',
                fontFamily: 'Roboto',
              })}
              tickFormat={v => `${Number(v).toFixed(0)} km`}
            />
            <AxisLeft
              scale={yScale}
              stroke="transparent"
              tickStroke="transparent"
              tickLabelProps={() => ({
                fill: '#9ca3af',
                fontSize: 10,
                textAnchor: isMobile ? 'start' : 'end',
                dx: isMobile ? '-35' : '-10',
                dy: '0.1em',
                fontFamily: 'Roboto',
              })}
              tickFormat={v => (isMobile ? `${v} m -` : `${v} m`)}
              numTicks={6}
            />

            {/* Hover Indicator */}
            {tooltipOpen && tooltipData && (
              <circle
                cx={xScale(tooltipData.distance)}
                cy={yScale(tooltipData.elevation)}
                r={6}
                fill="#ffffff"
                stroke="var(--brand-primary, #088d95)"
                strokeWidth={2}
                pointerEvents="none"
              />
            )}

            {/* Highlight Distance */}
            {highlightDistance !== undefined &&
              (() => {
                const currentDomain = zoomDomain || [0, maxDistance];
                return highlightDistance >= currentDomain[0] && highlightDistance <= currentDomain[1];
              })() && (
                <line
                  x1={xScale(highlightDistance)}
                  x2={xScale(highlightDistance)}
                  y1={0}
                  y2={innerHeight}
                  stroke="var(--brand-primary, #088d95)"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              )}

            {/* POIs */}
            {pois.map((p, i) => {
              const currentDomain = zoomDomain || [0, maxDistance];
              if (p.distance < currentDomain[0] || p.distance > currentDomain[1]) return null;

              const x = xScale(p.distance);
              const y = yScale(p.elevation);

              const category = getCategoryOrFallback(p.poi.type);
              return (
                <g
                  key={i}
                  transform={`translate(${x}, ${y - POI_ICON_SIZE / 2})`}
                  onClick={e => {
                    e.stopPropagation();
                    onPoiClick?.(p.poi);
                  }}
                  className="cursor-pointer hover:opacity-100 opacity-80 transition-opacity"
                >
                  <foreignObject
                    x={-POI_ICON_SIZE / 2}
                    y={-POI_ICON_SIZE / 2}
                    width={POI_ICON_SIZE}
                    height={POI_ICON_SIZE}
                    style={{ overflow: 'visible' }}
                  >
                    <div
                      style={{
                        width: POI_ICON_SIZE,
                        height: POI_ICON_SIZE,
                        borderRadius: '50%',
                        background: category.color,
                        border: '2px solid white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                      }}
                    >
                      <i
                        className={`fas ${category.faIcon}`}
                        style={{ color: 'white', fontSize: '0.9rem' }}
                      />
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </Group>
        </svg>

        {/* Navigation Buttons - Right Arrow */}
        {/* {zoomDomain && (
          <button
            className="hidden md:flex absolute right-4 top-[-20%] -translate-y-1/2 z-30 w-8 h-8 items-center justify-center bg-[#115e59] hover:bg-[#0f766e] rounded-full text-white shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all border border-[#088d95] hover:shadow-[0_0_15px_rgba(8,141,149,0.4)]"
            onClick={() => handleArrowShift('right')}
          >
            <i className="fas fa-chevron-right text-sm"></i>
          </button>
        )} */}

        {/* Tooltip */}
        {tooltipOpen &&
          tooltipData &&
          createPortal(
            <div
              className="absolute pointer-events-none transition-all duration-75 ease-out"
              style={{
                top: tooltipTop,
                left: tooltipLeft,
                position: 'fixed',
                zIndex: 9999,
              }}
            >
              <div className="w-64 bg-[#0b1215]/95 rounded-xl border border-gray-700 p-4 shadow-2xl backdrop-blur-md">
                <div className="flex flex-col gap-2 text-[11px] text-gray-400 font-mono">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-2 mb-1">
                    <span className="font-semibold text-gray-500">To:</span>
                    <span className="text-white font-bold text-sm font-['Roboto']">
                      {tooltipData.distance.toFixed(1)} km{' '}
                      <span className="text-gray-500 font-normal">
                        ({tooltipData.cumulativeGain !== undefined
                          ? tooltipData.cumulativeGain.toFixed(0)
                          : '--'}{' '}   m )
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Elevation gain:</span>
                    <span className="text-gray-200 font-['Roboto']">
                      {tooltipData.elevation.toFixed(0)}
                      m
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Gradient:</span>
                    <span className="text-gray-200 font-['Roboto']">
                      {tooltipData.grade !== undefined
                        ? tooltipData.grade.toFixed(1)
                        : '--'}{' '}
                      %
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Trail condition:</span>
                    <span className="text-gray-200 font-['Roboto']">{trailInfo ? trailInfo.condition : '...'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Trail Type:</span>
                    <span className="text-gray-200 font-['Roboto']">{trailInfo ? trailInfo.type : '...'}</span>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </div>
  );
}

// --- Main Exported Component ---
export default function ElevationProfileVisx({
  route,
  pois = [],
  highlightDistance,
  onPositionChange,
  onPoiClick,
  tourType = 'gold',
  splitPoints,
}: ElevationProfileVisxProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Haversine distance helper (in km)
  const haversineDistanceKm = useCallback((coord1: [number, number], coord2: [number, number]): number => {
    const R = 6371; // Earth radius in km
    const dLat = ((coord2[1] - coord1[1]) * Math.PI) / 180;
    const dLon = ((coord2[0] - coord1[0]) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((coord1[1] * Math.PI) / 180) *
      Math.cos((coord2[1] * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Find closest point on route to POI coordinates
  const findClosestRoutePoint = useCallback((poiLngLat: [number, number]): { distance: number; elevation: number } | null => {
    if (!route?.elevationData || route.elevationData.length === 0) return null;
    
    let closestDist = Infinity;
    let closestIndex = 0;
    
    // Check against route geometry if available
    if (route.routeGeometry) {
      route.routeGeometry.forEach((coord, index) => {
        const dist = haversineDistanceKm(poiLngLat, coord);
        if (dist < closestDist) {
          closestDist = dist;
          closestIndex = index;
        }
      });
    }
    
    // Get elevation data at this index
    const elevationPoint = route.elevationData[closestIndex] || route.elevationData[0];
    return elevationPoint ? { distance: elevationPoint.distance, elevation: elevationPoint.elevation } : null;
  }, [route, haversineDistanceKm]);

  const processedPois = useMemo(() => {
    if (!route || !pois) return [];
    return pois.map(marker => {
      // Get POI coordinates - handle both array and object formats
      let poiLngLat: [number, number];
      if (Array.isArray(marker.lngLat)) {
        poiLngLat = marker.lngLat;
      } else if (marker.lngLat && typeof marker.lngLat === 'object') {
        poiLngLat = [marker.lngLat.lng || marker.lngLat[0], marker.lngLat.lat || marker.lngLat[1]];
      } else {
        poiLngLat = [0, 0];
      }
      
      // Find closest point on route
      const routePoint = findClosestRoutePoint(poiLngLat);
      
      return {
        distance: routePoint?.distance ?? 0,
        elevation: routePoint?.elevation ?? 0,
        poi: marker,
      };
    });
  }, [route, pois, findClosestRoutePoint]);

  const chartData: ElevationPoint[] = useMemo(() => {
    if (!route) return [];

    let points: ElevationPoint[] = [];
    if (route.elevationData && route.elevationData.length > 0) {
      let cumGain = 0;
      points = route.elevationData.map((d, i, arr) => {
        let grade = 0;
        if (i > 0) {
          const prev = arr[i - 1];
          const distDiff = d.distance - prev.distance;
          const eleDiff = d.elevation - prev.elevation;
          if (distDiff > 0.0001) {
            grade = (eleDiff / (distDiff * 1000)) * 100;
          }
          if (eleDiff > 0) {
            cumGain += eleDiff;
          }
        }
        return {
          distance: d.distance,
          elevation: d.elevation,
          index: i,
          // Fall back gracefully to routeGeometry if d.coordinates is undefined
          coordinates: d.coordinates || (route.routeGeometry && route.routeGeometry[i] ? route.routeGeometry[i] : ([0, 0] as [number, number])),
          grade,
          cumulativeGain: cumGain,
        };
      });
    } else {
      const dist = parseFloat(String(route.distance || 0));
      const step = dist / 100;
      let cumGain = 0;
      for (let i = 0; i < 100; i++) {
        const elevation = 500 + Math.sin(i / 10) * 200 + Math.random() * 50;
        let grade = 0;
        if (i > 0) {
          const prevEle = points[i - 1].elevation;
          const eleDiff = elevation - prevEle;
          grade = (eleDiff / (step * 1000)) * 100;
          if (eleDiff > 0) cumGain += eleDiff;
        }
        points.push({
          distance: i * step,
          elevation,
          index: i,
          coordinates: route.routeGeometry && route.routeGeometry[i] ? route.routeGeometry[i] : ([0, 0] as [number, number]),
          grade,
          cumulativeGain: cumGain,
        });
      }
    }
    return points;
  }, [route]);

  if (!route) return <div className="text-white">Loading...</div>;

  return (
    <div
      ref={containerRef}
      className="elevation-profile-visx-container w-full h-full"
    >
      <ParentSize>
        {({ width, height }) => (
          <ElevationChart
            width={Math.max(0, width - 30)}
            height={height}
            data={chartData}
            pois={processedPois}
            onPositionChange={onPositionChange}
            highlightDistance={highlightDistance}
            onPoiClick={onPoiClick}
            tourType={tourType}
            splitPoints={splitPoints}
          />
        )}
      </ParentSize>
    </div>
  );
}