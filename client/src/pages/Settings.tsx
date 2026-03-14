import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  authApi,
  settingsApi,
  type RouteSettings,
  type StageColorSetting,
} from '../api';

type TourType = 'gold' | 'silver' | 'bronze';

const tourTypeLabels: Record<TourType, string> = {
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
};

const tourTypeBadges: Record<TourType, string> = {
  gold: 'bg-yellow-500',
  silver: 'bg-gray-400',
  bronze: 'bg-amber-700',
};

const getDefaultStageColor = (stageNumber: number): StageColorSetting => ({
  stageNumber,
  lineColor: '#088D95',
  lineOpacity: 1,
  areaColor: '#088D95',
  areaOpacity: 0.3,
});

const stageColorPalette = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
];

export default function Settings() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [routeSettings, setRouteSettings] = useState<RouteSettings>({
    mainColor: '#088D95',
    lineWidth: 5,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
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

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSaveRouteSettings = async () => {
    setSaving(true);
    try {
      const result = await settingsApi.updateRouteSettings(routeSettings);
      if (result.success) {
        showMessage('success', 'Settings saved');
      } else {
        showMessage('error', 'Failed to save');
      }
    } catch (error) {
      showMessage('error', 'Error saving');
    } finally {
      setSaving(false);
    }
  };

  const updateStageColor = (tourType: TourType, stageNumber: number, updates: Partial<StageColorSetting>) => {
    setStageColors((prev) => ({
      ...prev,
      [tourType]: prev[tourType].map((stage) =>
        stage.stageNumber === stageNumber ? { ...stage, ...updates } : stage
      ),
    }));
  };

  const addStage = (tourType: TourType) => {
    setStageColors((prev) => {
      const currentStages = prev[tourType];
      if (currentStages.length >= 10) {
        showMessage('error', 'Max 10 stages');
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
  };

  const removeStage = (tourType: TourType, stageNumber: number) => {
    setStageColors((prev) => {
      const currentStages = prev[tourType];
      const minStages = tourType === 'gold' ? 1 : tourType === 'silver' ? 2 : 3;
      if (currentStages.length <= minStages) {
        showMessage('error', `Min ${minStages} stages`);
        return prev;
      }
      const filtered = currentStages.filter((s) => s.stageNumber !== stageNumber);
      const renumbered = filtered.map((s, idx) => ({ ...s, stageNumber: idx + 1 }));
      return { ...prev, [tourType]: renumbered };
    });
  };

  const saveAllStageColors = async (tourType: TourType) => {
    setSaving(true);
    try {
      const stages = stageColors[tourType];
      for (const stage of stages) {
        await settingsApi.updateStageColor(tourType, stage.stageNumber, {
          lineColor: stage.lineColor,
          lineOpacity: stage.lineOpacity,
          areaColor: stage.areaColor,
          areaOpacity: stage.areaOpacity,
        });
      }
      showMessage('success', `${tourTypeLabels[tourType]} saved`);
    } catch (error) {
      showMessage('error', 'Error saving');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1215] flex items-center justify-center">
        <i className="fas fa-spinner fa-spin text-[#088d95] text-xl"></i>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1215] text-gray-200">
      {/* Header */}
      <header className="bg-[#080e11] border-b border-[#1e2a33]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center gap-2 px-4 py-2 bg-[#0b1215] border border-[#1e2a33] rounded-lg text-gray-400 hover:text-white hover:border-[#088d95]/50 transition-all"
              >
                <i className="fas fa-arrow-left text-sm"></i>
                <span className="text-sm">{t('back')}</span>
              </button>
              <div className="h-6 w-px bg-[#1e2a33]"></div>
              <div>
                <h1 className="text-lg font-semibold text-white">Route Settings</h1>
                <p className="text-xs text-gray-500">Customize colors and appearance</p>
              </div>
            </div>
            <button
              onClick={handleSaveRouteSettings}
              disabled={saving}
              className="px-5 py-2 bg-[#088d95] hover:bg-[#0da6ae] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
              Save Changes
            </button>
          </div>
        </div>
      </header>

      {/* Message */}
      {message && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-2 rounded-lg shadow-lg text-sm ${
          message.type === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          <i className={`fas ${message.type === 'success' ? 'fa-check' : 'fa-exclamation'} mr-2`}></i>
          {message.text}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Route Appearance */}
        <section className="bg-[#080e11] border border-[#1e2a33] rounded-xl">
          <div className="px-5 py-3 border-b border-[#1e2a33]">
            <h2 className="text-sm font-semibold text-[#088d95] flex items-center gap-2">
              <i className="fas fa-route"></i>
              Main Route Appearance
            </h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-4">
              {/* Left Column */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-400">Route Line Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={routeSettings.mainColor}
                      onChange={(e) => setRouteSettings((prev) => ({ ...prev, mainColor: e.target.value }))}
                      className="w-24 px-3 py-1.5 text-sm font-mono bg-[#0b1215] border border-[#1e2a33] rounded-lg text-gray-300 focus:border-[#088d95] focus:outline-none"
                    />
                    <div className="relative">
                      <input
                        type="color"
                        value={routeSettings.mainColor}
                        onChange={(e) => setRouteSettings((prev) => ({ ...prev, mainColor: e.target.value }))}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                        style={{ WebkitAppearance: 'none' }}
                      />
                      <div className="absolute inset-0 rounded-lg border border-white/10 pointer-events-none" style={{ backgroundColor: routeSettings.mainColor }} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-400">Shadow Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={routeSettings.shadowColor}
                      onChange={(e) => setRouteSettings((prev) => ({ ...prev, shadowColor: e.target.value }))}
                      className="w-24 px-3 py-1.5 text-sm font-mono bg-[#0b1215] border border-[#1e2a33] rounded-lg text-gray-300 focus:border-[#088d95] focus:outline-none"
                    />
                    <div className="relative">
                      <input
                        type="color"
                        value={routeSettings.shadowColor}
                        onChange={(e) => setRouteSettings((prev) => ({ ...prev, shadowColor: e.target.value }))}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                        style={{ WebkitAppearance: 'none' }}
                      />
                      <div className="absolute inset-0 rounded-lg border border-white/10 pointer-events-none" style={{ backgroundColor: routeSettings.shadowColor }} />
                    </div>
                  </div>
                </div>
              </div>
              {/* Right Column */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm text-gray-400">Line Width</label>
                    <span className="text-sm text-[#088d95]">{routeSettings.lineWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="10"
                    value={routeSettings.lineWidth}
                    onChange={(e) => setRouteSettings((prev) => ({ ...prev, lineWidth: Number(e.target.value) }))}
                    className="w-full h-1.5 bg-[#1e2a33] rounded-full appearance-none cursor-pointer accent-[#088d95]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm text-gray-400">Shadow Opacity</label>
                    <span className="text-sm text-[#088d95]">{Math.round(routeSettings.shadowOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={routeSettings.shadowOpacity * 100}
                    onChange={(e) => setRouteSettings((prev) => ({ ...prev, shadowOpacity: Number(e.target.value) / 100 }))}
                    className="w-full h-1.5 bg-[#1e2a33] rounded-full appearance-none cursor-pointer accent-[#088d95]"
                  />
                </div>
              </div>
            </div>
            {/* Preview */}
            <div className="mt-5 pt-4 border-t border-[#1e2a33]">
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Preview</span>
                <div
                  className="flex-1 rounded-full"
                  style={{
                    backgroundColor: routeSettings.mainColor,
                    boxShadow: `0 2px 12px ${routeSettings.shadowColor}${Math.round(routeSettings.shadowOpacity * 255).toString(16).padStart(2, '0')}`,
                    height: `${Math.max(routeSettings.lineWidth, 4)}px`,
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Tour Stage Colors */}
        <section className="bg-[#080e11] border border-[#1e2a33] rounded-xl">
          <div className="px-5 py-3 border-b border-[#1e2a33] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#088d95] flex items-center gap-2">
              <i className="fas fa-layer-group"></i>
              Tour Stage Colors
            </h2>
            <span className="text-xs text-gray-500 bg-[#0b1215] px-3 py-1 rounded-full border border-[#1e2a33]">
              Up to 10 stages per tour
            </span>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {(['gold', 'silver', 'bronze'] as TourType[]).map((tourType) => (
                <div key={tourType} className="bg-[#0b1215] border border-[#1e2a33] rounded-xl overflow-hidden">
                  {/* Header */}
                  <div className="px-4 py-2.5 bg-[#080e11] border-b border-[#1e2a33] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-md ${tourTypeBadges[tourType]} flex items-center justify-center`}>
                        <i className={`fas fa-${tourType === 'gold' ? 'crown' : tourType === 'silver' ? 'medal' : 'award'} text-white text-[10px]`}></i>
                      </div>
                      <span className="text-sm font-semibold text-white">{tourTypeLabels[tourType]}</span>
                    </div>
                    <span className="text-xs text-gray-500">{stageColors[tourType].length}/10</span>
                  </div>
                  {/* Stages - Compact Row Layout */}
                  <div className="p-3 space-y-2 max-h-[280px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                    {stageColors[tourType].map((stage) => (
                      <div key={stage.stageNumber} className="group flex items-center gap-2 p-2 bg-[#080e11] border border-[#1e2a33] rounded-lg">
                        {/* Number Badge */}
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{ backgroundColor: stage.lineColor, opacity: stage.lineOpacity }}
                        >
                          {stage.stageNumber}
                        </div>
                        {/* Color Picker Small */}
                        <div className="relative shrink-0">
                          <input
                            type="color"
                            value={stage.lineColor}
                            onChange={(e) => updateStageColor(tourType, stage.stageNumber, { lineColor: e.target.value })}
                            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                            style={{ WebkitAppearance: 'none' }}
                          />
                          <div className="absolute inset-0 rounded border border-white/10 pointer-events-none" style={{ backgroundColor: stage.lineColor }} />
                        </div>
                        {/* Hex Input */}
                        <input
                          type="text"
                          value={stage.lineColor}
                          onChange={(e) => updateStageColor(tourType, stage.stageNumber, { lineColor: e.target.value })}
                          className="w-16 px-2 py-1 text-xs font-mono bg-[#0b1215] border border-[#1e2a33] rounded text-gray-400 focus:border-[#088d95] focus:outline-none"
                        />
                        {/* Opacity Slider */}
                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={stage.lineOpacity * 100}
                            onChange={(e) => updateStageColor(tourType, stage.stageNumber, { lineOpacity: Number(e.target.value) / 100 })}
                            className="flex-1 h-1 bg-[#1e2a33] rounded-full appearance-none cursor-pointer accent-[#088d95]"
                          />
                          <span className="text-[10px] text-gray-500 w-6 text-right">{Math.round(stage.lineOpacity * 100)}%</span>
                        </div>
                        {/* Delete */}
                        <button
                          onClick={() => removeStage(tourType, stage.stageNumber)}
                          disabled={stageColors[tourType].length <= (tourType === 'gold' ? 1 : tourType === 'silver' ? 2 : 3)}
                          className="w-6 h-6 rounded flex items-center justify-center text-gray-600 hover:text-red-400 disabled:opacity-30 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <i className="fas fa-times text-xs"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                  {/* Actions */}
                  <div className="px-3 pb-3 space-y-2">
                    {stageColors[tourType].length < 10 && (
                      <button
                        onClick={() => addStage(tourType)}
                        className="w-full py-2 border border-dashed border-[#1e2a33] hover:border-[#088d95]/50 text-gray-500 hover:text-[#088d95] text-xs font-medium rounded-lg hover:bg-[#088d95]/5 transition-all flex items-center justify-center gap-1.5"
                      >
                        <i className="fas fa-plus text-[10px]"></i>
                        Add Stage {stageColors[tourType].length + 1}
                      </button>
                    )}
                    <button
                      onClick={() => saveAllStageColors(tourType)}
                      disabled={saving}
                      className="w-full py-2 bg-[#088d95]/10 hover:bg-[#088d95]/20 border border-[#088d95]/30 text-[#088d95] text-xs font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {saving ? <i className="fas fa-spinner fa-spin text-[10px]"></i> : <i className="fas fa-save text-[10px]"></i>}
                      Save Stages
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Visual Preview */}
        <section className="bg-[#080e11] border border-[#1e2a33] rounded-xl">
          <div className="px-5 py-3 border-b border-[#1e2a33]">
            <h2 className="text-sm font-semibold text-[#088d95] flex items-center gap-2">
              <i className="fas fa-eye"></i>
              Visual Preview
            </h2>
          </div>
          <div className="p-5 space-y-4">
            {(['gold', 'silver', 'bronze'] as TourType[]).map((tourType) => (
              <div key={tourType} className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-20 shrink-0">
                  <div className={`w-5 h-5 rounded ${tourTypeBadges[tourType]} flex items-center justify-center`}>
                    <i className={`fas fa-${tourType === 'gold' ? 'crown' : tourType === 'silver' ? 'medal' : 'award'} text-white text-[8px]`}></i>
                  </div>
                  <span className="text-xs text-gray-400 capitalize">{tourType}</span>
                </div>
                <div className="flex-1 h-8 rounded-lg flex overflow-hidden bg-[#0b1215] border border-[#1e2a33]">
                  {stageColors[tourType].map((stage, idx) => (
                    <div
                      key={idx}
                      className="h-full flex items-center justify-center text-[10px] font-bold text-white/90 border-r border-black/20 last:border-r-0"
                      style={{ backgroundColor: stage.lineColor, opacity: stage.lineOpacity, flex: 1 }}
                    >
                      {idx + 1}
                    </div>
                  ))}
                </div>
                <span className="text-xs text-gray-500 w-14 text-right">{stageColors[tourType].length} stages</span>
              </div>
            ))}
          </div>
        </section>

        {/* Info */}
        <section className="bg-[#080e11]/50 border border-[#1e2a33]/50 rounded-xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#088d95]/10 border border-[#088d95]/20 flex items-center justify-center shrink-0">
            <i className="fas fa-info-circle text-[#088d95] text-sm"></i>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-1">How to use</h3>
            <ul className="text-xs text-gray-500 space-y-0.5">
              <li>• Add up to 10 stages for each tour type</li>
              <li>• Each stage has custom color and opacity</li>
              <li>• Minimum stages: Gold = 1, Silver = 2, Bronze = 3</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
