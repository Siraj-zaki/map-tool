import { useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ColorPicker from '@/components/ui/color-picker';
import type { RouteSettings } from '@/api';

const BRAND_PRESET_COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

interface BrandingPanelProps {
  settings: RouteSettings;
  onChange: (updates: Partial<RouteSettings>) => void;
}

export default function BrandingPanel({ settings, onChange }: BrandingPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Branding</h3>
        <div className="space-y-3">
          {/* Logo URL */}
          <div>
            <Label className="text-zinc-500 text-xs mb-1.5 block">Logo URL</Label>
            <div className="flex items-center gap-2">
              <Input
                type="url"
                value={settings.brandLogoUrl ?? ''}
                onChange={(e) => onChange({ brandLogoUrl: e.target.value || null })}
                placeholder="https://.../logo.svg"
                className="flex-1 h-8 text-xs font-mono bg-white/[0.03] border-white/[0.06] focus:border-primary/50"
              />
              <div className="w-8 h-8 rounded-md border border-white/[0.06] flex items-center justify-center bg-white/[0.02] shrink-0 overflow-hidden">
                <img
                  key={settings.brandLogoUrl ?? 'default'}
                  src={settings.brandLogoUrl || '/images/header-logo.svg'}
                  alt=""
                  className="max-h-5 max-w-6 object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  onLoad={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'block'; }}
                />
              </div>
            </div>
          </div>

          {/* Color swatches */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-zinc-500 text-xs mb-1.5 block">Primary</Label>
              <div className="flex items-center gap-2">
                <ColorPicker
                  value={settings.primaryColor || '#3b82f6'}
                  onChange={(color) => onChange({ primaryColor: color })}
                  presetColors={BRAND_PRESET_COLORS}
                />
                <Input
                  type="text"
                  value={settings.primaryColor ?? ''}
                  onChange={(e) => onChange({ primaryColor: e.target.value || null })}
                  placeholder="#3b82f6"
                  className="flex-1 h-7 text-[11px] font-mono bg-white/[0.03] border-white/[0.06]"
                />
              </div>
            </div>
            <div>
              <Label className="text-zinc-500 text-xs mb-1.5 block">Accent</Label>
              <div className="flex items-center gap-2">
                <ColorPicker
                  value={settings.accentColor || '#10b981'}
                  onChange={(color) => onChange({ accentColor: color })}
                  presetColors={BRAND_PRESET_COLORS}
                />
                <Input
                  type="text"
                  value={settings.accentColor ?? ''}
                  onChange={(e) => onChange({ accentColor: e.target.value || null })}
                  placeholder="#10b981"
                  className="flex-1 h-7 text-[11px] font-mono bg-white/[0.03] border-white/[0.06]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
