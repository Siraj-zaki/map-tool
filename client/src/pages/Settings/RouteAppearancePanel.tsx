import { useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ColorPicker from '@/components/ui/color-picker';
import type { RouteSettings } from '@/api';

const ROUTE_PRESET_COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

const SHADOW_PRESET_COLORS = [
  '#000000', '#18181b', '#27272a', '#1e293b', '#0f172a',
  '#1e1b4b', '#1c1917', '#44403c', '#3f3f46', '#52525b',
];

interface RouteAppearancePanelProps {
  settings: RouteSettings;
  onChange: (updates: Partial<RouteSettings>) => void;
}

function SliderWithInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
  colorPickers,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  colorPickers?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-zinc-500 text-xs">{label}</Label>
        {colorPickers}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-1 bg-white/[0.06] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_0_2px_rgba(255,255,255,0.1)]"
        />
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-14 h-7 text-[11px] font-mono text-center bg-white/[0.03] border border-white/[0.06] rounded-md text-zinc-300 focus:outline-none focus:border-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          {unit && <span className="text-[10px] text-zinc-600">{unit}</span>}
        </div>
      </div>
    </div>
  );
}

export default function RouteAppearancePanel({ settings, onChange }: RouteAppearancePanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Route Appearance</h3>
        <div className="space-y-4">
          {/* Colors row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-zinc-500 text-xs mb-1.5 block">Line Color</Label>
              <div className="flex items-center gap-2">
                <ColorPicker
                  value={settings.mainColor}
                  onChange={(color) => onChange({ mainColor: color })}
                  presetColors={ROUTE_PRESET_COLORS}
                />
                <Input
                  type="text"
                  value={settings.mainColor}
                  onChange={(e) => onChange({ mainColor: e.target.value })}
                  className="flex-1 h-7 text-[11px] font-mono bg-white/[0.03] border-white/[0.06]"
                />
              </div>
            </div>
            <div>
              <Label className="text-zinc-500 text-xs mb-1.5 block">Shadow</Label>
              <div className="flex items-center gap-2">
                <ColorPicker
                  value={settings.shadowColor}
                  onChange={(color) => onChange({ shadowColor: color })}
                  presetColors={SHADOW_PRESET_COLORS}
                />
                <Input
                  type="text"
                  value={settings.shadowColor}
                  onChange={(e) => onChange({ shadowColor: e.target.value })}
                  className="flex-1 h-7 text-[11px] font-mono bg-white/[0.03] border-white/[0.06]"
                />
              </div>
            </div>
          </div>

          {/* Sliders */}
          <SliderWithInput
            label="Line Width"
            value={settings.lineWidth}
            onChange={(v) => onChange({ lineWidth: v })}
            min={2}
            max={12}
            unit="px"
          />
          <SliderWithInput
            label="Shadow Opacity"
            value={Math.round(settings.shadowOpacity * 100)}
            onChange={(v) => onChange({ shadowOpacity: v / 100 })}
            min={0}
            max={100}
            unit="%"
          />
        </div>
      </div>
    </div>
  );
}
