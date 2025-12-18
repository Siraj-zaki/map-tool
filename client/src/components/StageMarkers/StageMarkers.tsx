import mapboxgl from 'mapbox-gl';
import { useEffect, useRef } from 'react';
import type { Route } from '../../api';

interface StageMarkersProps {
  map: mapboxgl.Map | null;
  route: Route;
  tourType: 'gold' | 'silver' | 'bronze';
}

type TourType = 'gold' | 'silver' | 'bronze';

const stageConfig: Record<TourType, { stages: number; colors: string[] }> = {
  gold: { stages: 1, colors: ['#FFD700'] },
  silver: { stages: 2, colors: ['#C0C0C0', '#A0A0A0'] },
  bronze: { stages: 3, colors: ['#CD7F32', '#B87333', '#A0522D'] },
};

export default function StageMarkers({
  map,
  route,
  tourType,
}: StageMarkersProps) {
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!map || !route) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const config = stageConfig[tourType];
    const allCoords = [route.startPoint, ...route.waypoints, route.endPoint];
    const totalPoints = allCoords.length;

    // Calculate stage break points
    const stageBreaks: number[] = [];
    for (let i = 1; i < config.stages; i++) {
      const breakIndex = Math.floor((i / config.stages) * totalPoints);
      stageBreaks.push(breakIndex);
    }

    // Add stage markers
    stageBreaks.forEach((breakIndex, stageNum) => {
      const coord = allCoords[breakIndex];

      // Stage end marker
      const endEl = document.createElement('div');
      endEl.innerHTML = `
        <div style="
          position: relative;
          width: 32px;
          height: 32px;
        ">
          <div style="
            width: 32px;
            height: 32px;
            background: ${config.colors[stageNum % config.colors.length]};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            font-weight: bold;
            color: ${tourType === 'gold' ? '#000' : '#fff'};
            font-size: 12px;
          ">
            ${stageNum + 1}
          </div>
          <div style="
            position: absolute;
            top: -24px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--background-dark);
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 10px;
            white-space: nowrap;
            color: white;
          ">
            Etappe ${stageNum + 1} Ende
          </div>
        </div>
      `;

      const marker = new mapboxgl.Marker({ element: endEl })
        .setLngLat(coord)
        .addTo(map);

      markersRef.current.push(marker);

      // Stage start marker (for next stage)
      if (stageNum < config.stages - 1) {
        const startEl = document.createElement('div');
        startEl.innerHTML = `
          <div style="
            width: 24px;
            height: 24px;
            background: ${config.colors[(stageNum + 1) % config.colors.length]};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid white;
            font-size: 12px;
            font-weight: bold;
            color: ${tourType === 'gold' ? '#000' : '#fff'};
          ">
            ${stageNum + 2}
          </div>
        `;

        // Place start marker slightly offset
        const nextCoord = allCoords[Math.min(breakIndex + 1, totalPoints - 1)];
        const startMarker = new mapboxgl.Marker({ element: startEl })
          .setLngLat(nextCoord)
          .addTo(map);

        markersRef.current.push(startMarker);
      }
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
    };
  }, [map, route, tourType]);

  return null; // This component only manages map state
}

// Function to add stage cuts to elevation profile (Feature 6)
export function getStageBreakpoints(
  route: Route,
  tourType: TourType
): { distance: number; stageNumber: number }[] {
  const config = stageConfig[tourType];
  const breakpoints: { distance: number; stageNumber: number }[] = [];

  if (config.stages <= 1) return breakpoints;

  const totalDistance = route.distance || 0;

  for (let i = 1; i < config.stages; i++) {
    breakpoints.push({
      distance: (i / config.stages) * totalDistance,
      stageNumber: i,
    });
  }

  return breakpoints;
}

// Add stage lines to elevation profile SVG
export function renderStageLines(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  breakpoints: { distance: number; stageNumber: number }[],
  xScale: d3.ScaleLinear<number, number>,
  height: number,
  tourType: TourType
) {
  const config = stageConfig[tourType];

  breakpoints.forEach((bp, index) => {
    const x = xScale(bp.distance);

    // Vertical stage break line
    svg
      .append('line')
      .attr('x1', x)
      .attr('x2', x)
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', config.colors[index % config.colors.length])
      .attr('stroke-width', 3)
      .attr('stroke-dasharray', '8,4');

    // Stage label
    svg
      .append('text')
      .attr('x', x)
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .attr('fill', config.colors[index % config.colors.length])
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .text(`Etappe ${bp.stageNumber}`);
  });
}
