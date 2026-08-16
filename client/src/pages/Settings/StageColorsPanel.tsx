import { useState, useCallback, memo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ColorPicker from '@/components/ui/color-picker';
import { Plus, X, ChevronDown, Crown, Medal, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StageColorSetting } from '@/api';

type TourType = 'gold' | 'silver' | 'bronze';

interface StageColorsPanelProps {
  stageColors: Record<TourType, StageColorSetting[]>;
  onUpdateStage: (tourType: TourType, stageNumber: number, updates: Partial<StageColorSetting>) => void;
  onAddStage: (tourType: TourType) => void;
  onRemoveStage: (tourType: TourType, stageNumber: number) => void;
}

const tourConfig: Record<TourType, { label: string; icon: React.ElementType; minStages: number; color: string }> = {
  gold: { label: 'Gold', icon: Crown, minStages: 1, color: '#f59e0b' },
  silver: { label: 'Silver', icon: Medal, minStages: 2, color: '#94a3b8' },
  bronze: { label: 'Bronze', icon: Award, minStages: 3, color: '#d97706' },
};

const STAGE_PRESETS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

const StageRow = memo(function StageRow({
  stage,
  canDelete,
  onColorChange,
  onOpacityChange,
  onDelete,
}: {
  stage: StageColorSetting;
  canDelete: boolean;
  onColorChange: (color: string) => void;
  onOpacityChange: (opacity: number) => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-2 py-1.5">
      {/* Number badge */}
      <div
        className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0"
        style={{ backgroundColor: stage.lineColor, opacity: stage.lineOpacity }}
      >
        {stage.stageNumber}
      </div>

      {/* Color picker */}
      <ColorPicker
        value={stage.lineColor}
        onChange={onColorChange}
        presetColors={STAGE_PRESETS}
      />

      {/* Hex input */}
      <Input
        type="text"
        value={stage.lineColor}
        onChange={(e) => onColorChange(e.target.value)}
        className="w-[72px] h-6 px-1.5 text-[10px] font-mono bg-white/[0.03] border-white/[0.06]"
      />

      {/* Opacity input */}
      <div className="flex items-center gap-0.5">
        <input
          type="number"
          min={0}
          max={100}
          value={Math.round(stage.lineOpacity * 100)}
          onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
          className="w-10 h-6 text-[10px] font-mono text-center bg-white/[0.03] border border-white/[0.06] rounded text-zinc-400 focus:outline-none focus:border-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-[9px] text-zinc-600">%</span>
      </div>

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        disabled={!canDelete}
        className="size-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-red-400 hover:bg-red-400/10"
      >
        <X className="size-3" />
      </Button>
    </div>
  );
});

export default function StageColorsPanel({
  stageColors,
  onUpdateStage,
  onAddStage,
  onRemoveStage,
}: StageColorsPanelProps) {
  const [openTours, setOpenTours] = useState<TourType[]>(['gold']);

  const toggleTour = useCallback((tour: TourType) => {
    setOpenTours((prev) =>
      prev.includes(tour) ? prev.filter((t) => t !== tour) : [...prev, tour]
    );
  }, []);

  const handleColorChange = useCallback(
    (tourType: TourType, stageNumber: number) => (color: string) => {
      onUpdateStage(tourType, stageNumber, { lineColor: color });
    },
    [onUpdateStage]
  );

  const handleOpacityChange = useCallback(
    (tourType: TourType, stageNumber: number) => (opacity: number) => {
      onUpdateStage(tourType, stageNumber, { lineOpacity: opacity });
    },
    [onUpdateStage]
  );

  const handleDelete = useCallback(
    (tourType: TourType, stageNumber: number) => () => {
      onRemoveStage(tourType, stageNumber);
    },
    [onRemoveStage]
  );

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Tour Stages</h3>

      <div className="space-y-2">
        {(Object.keys(tourConfig) as TourType[]).map((tourType) => {
          const config = tourConfig[tourType];
          const stages = stageColors[tourType] || [];
          const isOpen = openTours.includes(tourType);
          const Icon = config.icon;

          return (
            <div
              key={tourType}
              className={cn(
                'rounded-lg border transition-colors',
                isOpen ? 'border-white/[0.08] bg-white/[0.02]' : 'border-white/[0.04] bg-transparent hover:bg-white/[0.02]'
              )}
            >
              {/* Accordion header */}
              <button
                type="button"
                onClick={() => toggleTour(tourType)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: config.color + '20' }}
                >
                  <Icon className="size-3" style={{ color: config.color }} />
                </div>
                <span className="text-sm font-medium text-zinc-200 flex-1">{config.label}</span>
                <span className="text-[10px] text-zinc-600 font-mono mr-1">
                  {stages.length}
                </span>
                <ChevronDown
                  className={cn(
                    'size-3.5 text-zinc-600 transition-transform',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>

              {/* Accordion content */}
              {isOpen && (
                <div className="px-3 pb-3 border-t border-white/[0.04]">
                  <div className="pt-2 space-y-0.5">
                    {stages.map((stage) => (
                      <StageRow
                        key={stage.stageNumber}
                        stage={stage}
                        canDelete={stages.length > config.minStages}
                        onColorChange={handleColorChange(tourType, stage.stageNumber)}
                        onOpacityChange={handleOpacityChange(tourType, stage.stageNumber)}
                        onDelete={handleDelete(tourType, stage.stageNumber)}
                      />
                    ))}
                  </div>

                  {stages.length < 10 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2 h-7 text-[11px] text-zinc-500 hover:text-zinc-300 border border-dashed border-white/[0.06] hover:border-white/[0.12]"
                      onClick={() => onAddStage(tourType)}
                    >
                      <Plus className="size-3 mr-1" />
                      Add Stage
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
