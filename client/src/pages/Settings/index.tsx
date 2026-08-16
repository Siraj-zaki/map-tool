import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useColorSettings } from '@/contexts/ColorSettingsContext';
import {
  authApi,
  settingsApi,
  type RouteSettings,
  type StageColorSetting,
} from '@/api';
import BrandingPanel from './BrandingPanel';
import RouteAppearancePanel from './RouteAppearancePanel';
import StageColorsPanel from './StageColorsPanel';
import RouteCanvas from './RouteCanvas';

type TourType = 'gold' | 'silver' | 'bronze';

const getDefaultStageColor = (stageNumber: number): StageColorSetting => ({
  stageNumber,
  lineColor: '#3b82f6',
  lineOpacity: 1,
  areaColor: '#3b82f6',
  areaOpacity: 0.3,
});

const stageColorPalette = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

export default function Settings() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { refresh: refreshBrandSettings } = useColorSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [routeSettings, setRouteSettings] = useState<RouteSettings>({
    mainColor: '#3b82f6',
    lineWidth: 5,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    brandLogoUrl: null,
    primaryColor: null,
    accentColor: null,
  });

  const [stageColors, setStageColors] = useState<Record<TourType, StageColorSetting[]>>({
    gold: [getDefaultStageColor(1)],
    silver: [getDefaultStageColor(1), getDefaultStageColor(2)],
    bronze: [getDefaultStageColor(1), getDefaultStageColor(2), getDefaultStageColor(3)],
  });

  useEffect(() => {
    const init = async () => {
      try {
        const authResult = await authApi.getProfile();
        if (!authResult.success) {
          navigate('/admin/login');
          return;
        }
        const result = await settingsApi.getAll();
        if (result.success) {
          if (result.routeSettings) {
            setRouteSettings(result.routeSettings);
          }
          const loadedColors = result.stageColors;
          const ensureStages = (tourType: TourType, minStages: number) => {
            const existing = loadedColors[tourType] || [];
            const stages = [...existing];
            for (let i = stages.length; i < minStages; i++) {
              stages.push({
                ...getDefaultStageColor(i + 1),
                lineColor: stageColorPalette[i % stageColorPalette.length],
              });
            }
            return stages;
          };
          setStageColors({
            gold: ensureStages('gold', 1),
            silver: ensureStages('silver', 2),
            bronze: ensureStages('bronze', 3),
          });
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [navigate]);

  // Apply brand colors live
  useEffect(() => {
    const root = document.documentElement;
    const primary = routeSettings.primaryColor || '#3b82f6';
    const accent = routeSettings.accentColor || '#10b981';
    root.style.setProperty('--brand-primary', primary);
    root.style.setProperty('--brand-accent', accent);
    root.classList.add('brand-scope');
  }, [routeSettings.primaryColor, routeSettings.accentColor]);

  const handleRouteSettingsChange = useCallback((updates: Partial<RouteSettings>) => {
    setRouteSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Save route settings
      const routeResult = await settingsApi.updateRouteSettings(routeSettings);
      if (!routeResult.success) {
        toast.error('Failed to save route settings');
        return;
      }
      // Save all stage colors
      for (const tourType of ['gold', 'silver', 'bronze'] as TourType[]) {
        for (const stage of stageColors[tourType]) {
          await settingsApi.updateStageColor(tourType, stage.stageNumber, {
            lineColor: stage.lineColor,
            lineOpacity: stage.lineOpacity,
            areaColor: stage.areaColor,
            areaOpacity: stage.areaOpacity,
          });
        }
      }
      await refreshBrandSettings();
      toast.success('All settings saved');
    } catch (error) {
      toast.error('Error saving settings');
    } finally {
      setSaving(false);
    }
  }, [routeSettings, stageColors, refreshBrandSettings]);

  const updateStageColor = useCallback(
    (tourType: TourType, stageNumber: number, updates: Partial<StageColorSetting>) => {
      setStageColors((prev) => ({
        ...prev,
        [tourType]: prev[tourType].map((stage) =>
          stage.stageNumber === stageNumber ? { ...stage, ...updates } : stage
        ),
      }));
    },
    []
  );

  const addStage = useCallback((tourType: TourType) => {
    setStageColors((prev) => {
      const currentStages = prev[tourType];
      if (currentStages.length >= 10) {
        toast.error('Max 10 stages');
        return prev;
      }
      const newStageNumber = currentStages.length + 1;
      return {
        ...prev,
        [tourType]: [
          ...currentStages,
          {
            ...getDefaultStageColor(newStageNumber),
            lineColor: stageColorPalette[(newStageNumber - 1) % stageColorPalette.length],
          },
        ],
      };
    });
  }, []);

  const removeStage = useCallback((tourType: TourType, stageNumber: number) => {
    setStageColors((prev) => {
      const currentStages = prev[tourType];
      const minStages = tourType === 'gold' ? 1 : tourType === 'silver' ? 2 : 3;
      if (currentStages.length <= minStages) {
        toast.error(`Min ${minStages} stages required`);
        return prev;
      }
      const filtered = currentStages.filter((s) => s.stageNumber !== stageNumber);
      const renumbered = filtered.map((s, idx) => ({ ...s, stageNumber: idx + 1 }));
      return { ...prev, [tourType]: renumbered };
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <Loader2 className="size-5 text-zinc-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-zinc-300">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0f1117]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-[1600px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-all text-xs"
              >
                <ArrowLeft className="size-3.5" />
                {t('back')}
              </button>
              <div className="h-4 w-px bg-white/[0.06]" />
              <div>
                <h1 className="text-sm font-semibold text-zinc-100">Route Settings</h1>
                <p className="text-[10px] text-zinc-600">Configure branding, route geometry, and stage colors</p>
              </div>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              size="sm"
              className="gap-1.5 h-8 px-4 text-xs font-medium bg-primary hover:bg-primary/90"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Save Changes
            </Button>
          </div>
        </div>
      </header>

      {/* Two-column layout */}
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="flex gap-6">
          {/* Left: Controls */}
          <div className="w-[380px] shrink-0 space-y-5 overflow-y-auto max-h-[calc(100vh-80px)] pr-2 scrollbar-thin">
            <BrandingPanel settings={routeSettings} onChange={handleRouteSettingsChange} />
            <div className="h-px bg-white/[0.04]" />
            <RouteAppearancePanel settings={routeSettings} onChange={handleRouteSettingsChange} />
            <div className="h-px bg-white/[0.04]" />
            <StageColorsPanel
              stageColors={stageColors}
              onUpdateStage={updateStageColor}
              onAddStage={addStage}
              onRemoveStage={removeStage}
            />
          </div>

          {/* Right: Sticky Preview */}
          <div className="flex-1 min-w-0">
            <div className="sticky top-20">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Live Preview</h3>
                  <span className="text-[10px] text-zinc-600 font-mono">Map Canvas</span>
                </div>
                <RouteCanvas routeSettings={routeSettings} stageColors={stageColors} />

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="text-[10px] text-zinc-600 mb-0.5">Gold Stages</div>
                    <div className="text-sm font-mono text-amber-400/80">{stageColors.gold.length}</div>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="text-[10px] text-zinc-600 mb-0.5">Silver Stages</div>
                    <div className="text-sm font-mono text-zinc-400">{stageColors.silver.length}</div>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="text-[10px] text-zinc-600 mb-0.5">Bronze Stages</div>
                    <div className="text-sm font-mono text-amber-600/80">{stageColors.bronze.length}</div>
                  </div>
                </div>

                {/* Tips */}
                <div className="px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <p className="text-[11px] text-zinc-600 leading-relaxed">
                    Changes preview in real-time. Click <span className="text-zinc-400">Save Changes</span> to persist.
                    Min stages: Gold 1, Silver 2, Bronze 3. Max 10 per tier.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
