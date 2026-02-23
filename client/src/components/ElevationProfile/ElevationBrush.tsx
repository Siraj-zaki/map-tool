import { Brush } from '@visx/brush';
import { LinearGradient } from '@visx/gradient';
import { scaleLinear } from '@visx/scale';
import { AreaClosed } from '@visx/shape';
import { useMemo } from 'react';

interface ElevationBrushProps {
  data: { distance: number; elevation: number }[];
  width: number;
  height: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  onChange: (domain: [number, number]) => void;
  selectedBoxStyle?: React.CSSProperties;
}

export default function ElevationBrush({
  data,
  width,
  height,
  margin = { top: 0, right: 0, bottom: 0, left: 0 },
  onChange,
}: ElevationBrushProps) {
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Scales
  const xScale = useMemo(
    () =>
      scaleLinear({
        domain: [
          Math.min(...data.map(d => d.distance)),
          Math.max(...data.map(d => d.distance)),
        ],
        range: [0, innerWidth],
      }),
    [data, innerWidth]
  );

  const yScale = useMemo(
    () =>
      scaleLinear({
        domain: [
          Math.min(...data.map(d => d.elevation)),
          Math.max(...data.map(d => d.elevation)),
        ],
        range: [innerHeight, 0],
      }),
    [data, innerHeight]
  );

  if (width < 10) return null;

  return (
    <div className="absolute top-4 left-4 z-20">
      <svg width={width} height={height}>
        <LinearGradient
          id="brush_gradient"
          from="#059669" // emerald-600
          to="#06b6d4" // cyan-500
          fromOpacity={0.8}
          toOpacity={0.4}
        />

        {/* Minimap Background Chart */}
        <AreaClosed
          data={data}
          x={d => xScale(d.distance)}
          y={d => yScale(d.elevation)}
          yScale={yScale}
          fill="url(#brush_gradient)"
          stroke="transparent"
        />

        {/* The Brush */}
        <Brush
          xScale={xScale}
          yScale={yScale}
          width={innerWidth}
          height={innerHeight}
          handleSize={8}
          resizeTriggerAreas={['left', 'right']}
          brushDirection="horizontal"
          onChange={brush => {
            if (!brush) return;
            const { x0, x1 } = brush;
            const start = xScale.invert(x0);
            const end = xScale.invert(x1);
            onChange([start, end]);
          }}
          onClick={() => {
            onChange(null as any); // Reset
          }}
          selectedBoxStyle={{
            fill: 'rgba(255, 255, 255, 0.1)',
            stroke: '#fff',
            strokeWidth: 1,
          }}
          useWindowMoveEvents
        />
      </svg>
    </div>
  );
}
