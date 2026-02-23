import './ElevationProfileVisx.css'; // Reuse existing or add new styles

interface ElevationTooltipProps {
  data: {
    distance: number;
    elevation: number;
    gradient?: number;
    surface?: string;
  };
  totalDistance?: number;
  totalAscent?: number;
}

export default function ElevationTooltip({
  data,
  totalAscent,
}: ElevationTooltipProps) {
  // const { t } = useTranslation(); // Unused for now

  return (
    <div
      className="absolute w-64 p-3 bg-black/95 rounded-xl border border-gray-600 shadow-2xl backdrop-blur-sm z-50 pointer-events-none transform -translate-x-1/2 -translate-y-[120%]"
      style={{ left: '50%', top: '50%' }} // Position needs to be controlled by parent
    >
      <div className="grid grid-cols-[1fr,auto] gap-x-4 gap-y-1 text-xs">
        {/* To / Distance */}
        <div className="text-slate-400 font-medium">To:</div>
        <div className="text-slate-200 text-right">
          {data.distance.toFixed(1)} km
          <span className="text-slate-500 ml-1">
            ({data.elevation.toFixed(0)} m)
          </span>
        </div>

        {/* Elevation Gain */}
        <div className="text-slate-400 font-medium">Elevation gain:</div>
        <div className="text-slate-200 text-right">
          {totalAscent ? `${Math.round(totalAscent)} m` : '-'}
        </div>

        {/* Gradient */}
        <div className="text-slate-400 font-medium">Gradient:</div>
        <div className="text-slate-200 text-right">
          ~ {data.gradient ? data.gradient : 0}%
        </div>

        {/* Trail Condition */}
        <div className="text-slate-400 font-medium">Trail condition:</div>
        <div className="text-slate-200 text-right">
          {data.surface || 'Choose'}
        </div>

        {/* Trail Type */}
        <div className="text-slate-400 font-medium">Trail Type:</div>
        <div className="text-slate-200 text-right">Trail</div>
      </div>
    </div>
  );
}
