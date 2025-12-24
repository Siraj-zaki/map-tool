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
  gold: 'Gold (1 Stage)',
  silver: 'Silver (2 Stages)',
  bronze: 'Bronze (3 Stages)',
};

export default function Settings() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Route settings
  const [routeSettings, setRouteSettings] = useState<RouteSettings>({
    mainColor: '#088D95',
    lineWidth: 5,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
  });

  // Stage colors
  const [stageColors, setStageColors] = useState<
    Record<TourType, StageColorSetting[]>
  >({
    gold: [],
    silver: [],
    bronze: [],
  });

  // Check auth & load settings
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
          setStageColors(result.stageColors);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [navigate]);

  const handleSaveRouteSettings = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const result = await settingsApi.updateRouteSettings(routeSettings);
      if (result.success) {
        setMessage({ type: 'success', text: 'Route settings saved!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to save route settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error saving settings' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleSaveStageColor = async (
    tourType: TourType,
    stage: StageColorSetting
  ) => {
    setSaving(true);
    setMessage(null);
    try {
      const result = await settingsApi.updateStageColor(
        tourType,
        stage.stageNumber,
        {
          lineColor: stage.lineColor,
          lineOpacity: stage.lineOpacity,
          areaColor: stage.areaColor,
          areaOpacity: stage.areaOpacity,
        }
      );
      if (result.success) {
        setMessage({
          type: 'success',
          text: `${tourType} Stage ${stage.stageNumber} saved!`,
        });
      } else {
        setMessage({ type: 'error', text: 'Failed to save stage color' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error saving stage color' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const updateStageColor = (
    tourType: TourType,
    stageNumber: number,
    updates: Partial<StageColorSetting>
  ) => {
    setStageColors(prev => ({
      ...prev,
      [tourType]: prev[tourType].map(stage =>
        stage.stageNumber === stageNumber ? { ...stage, ...updates } : stage
      ),
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1215] flex items-center justify-center">
        <i className="fas fa-spinner fa-spin text-3xl text-[#088d95]"></i>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1215] text-white">
      {/* Header */}
      <div className="bg-[#080e11] border-b border-[#1e2a33] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <i className="fas fa-arrow-left"></i>
              <span>{t('back')}</span>
            </button>
            <h1 className="text-xl font-semibold">
              <i className="fas fa-palette text-[#088d95] mr-2"></i>
              Route Color Settings
            </h1>
          </div>
        </div>
      </div>

      {/* Message toast */}
      {message && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
            message.type === 'success'
              ? 'bg-green-500/20 border border-green-500/50 text-green-400'
              : 'bg-red-500/20 border border-red-500/50 text-red-400'
          }`}
        >
          <i
            className={`fas ${
              message.type === 'success'
                ? 'fa-check-circle'
                : 'fa-exclamation-circle'
            } mr-2`}
          ></i>
          {message.text}
        </div>
      )}

      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Route Settings Section */}
        <section className="bg-[#080e11] border border-[#1e2a33] rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <i className="fas fa-route text-[#088d95]"></i>
            Main Route Appearance
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Main Color */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Route Line Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={routeSettings.mainColor}
                  onChange={e =>
                    setRouteSettings(prev => ({
                      ...prev,
                      mainColor: e.target.value,
                    }))
                  }
                  className="w-12 h-12 rounded-lg border-2 border-[#1e2a33] cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={routeSettings.mainColor}
                  onChange={e =>
                    setRouteSettings(prev => ({
                      ...prev,
                      mainColor: e.target.value,
                    }))
                  }
                  className="flex-1 px-3 py-2 bg-[#0b1215] border border-[#1e2a33] rounded-lg text-white focus:border-[#088d95] focus:outline-none"
                />
              </div>
            </div>

            {/* Line Width */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Line Width: {routeSettings.lineWidth}px
              </label>
              <input
                type="range"
                min="2"
                max="10"
                value={routeSettings.lineWidth}
                onChange={e =>
                  setRouteSettings(prev => ({
                    ...prev,
                    lineWidth: Number(e.target.value),
                  }))
                }
                className="w-full h-2 bg-[#1e2a33] rounded-lg appearance-none cursor-pointer accent-[#088d95]"
              />
            </div>

            {/* Shadow Color */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Shadow Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={routeSettings.shadowColor}
                  onChange={e =>
                    setRouteSettings(prev => ({
                      ...prev,
                      shadowColor: e.target.value,
                    }))
                  }
                  className="w-12 h-12 rounded-lg border-2 border-[#1e2a33] cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={routeSettings.shadowColor}
                  onChange={e =>
                    setRouteSettings(prev => ({
                      ...prev,
                      shadowColor: e.target.value,
                    }))
                  }
                  className="flex-1 px-3 py-2 bg-[#0b1215] border border-[#1e2a33] rounded-lg text-white focus:border-[#088d95] focus:outline-none"
                />
              </div>
            </div>

            {/* Shadow Opacity */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Shadow Opacity: {Math.round(routeSettings.shadowOpacity * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={routeSettings.shadowOpacity * 100}
                onChange={e =>
                  setRouteSettings(prev => ({
                    ...prev,
                    shadowOpacity: Number(e.target.value) / 100,
                  }))
                }
                className="w-full h-2 bg-[#1e2a33] rounded-lg appearance-none cursor-pointer accent-[#088d95]"
              />
            </div>
          </div>

          <button
            onClick={handleSaveRouteSettings}
            disabled={saving}
            className="mt-6 px-6 py-2.5 bg-[#088d95] hover:bg-[#0da6ae] text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : (
              <i className="fas fa-save"></i>
            )}
            Save Route Settings
          </button>
        </section>

        {/* Stage Colors Section */}
        <section className="bg-[#080e11] border border-[#1e2a33] rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <i className="fas fa-layer-group text-[#088d95]"></i>
            Tour Stage Colors
          </h2>

          <div className="space-y-6">
            {(['gold', 'silver', 'bronze'] as TourType[]).map(tourType => (
              <div
                key={tourType}
                className="border border-[#1e2a33] rounded-lg p-4"
              >
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      tourType === 'gold'
                        ? 'bg-yellow-500'
                        : tourType === 'silver'
                        ? 'bg-gray-400'
                        : 'bg-amber-700'
                    }`}
                  ></span>
                  {tourTypeLabels[tourType]}
                </h3>

                <div className="space-y-4">
                  {stageColors[tourType].map(stage => (
                    <div
                      key={stage.stageNumber}
                      className="flex flex-wrap items-center gap-4 p-3 bg-[#0b1215] rounded-lg"
                    >
                      <span className="text-sm text-gray-400 w-20">
                        Stage {stage.stageNumber}
                      </span>

                      {/* Line Color */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">Line:</label>
                        <input
                          type="color"
                          value={stage.lineColor}
                          onChange={e =>
                            updateStageColor(tourType, stage.stageNumber, {
                              lineColor: e.target.value,
                            })
                          }
                          className="w-8 h-8 rounded border border-[#1e2a33] cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={stage.lineColor}
                          onChange={e =>
                            updateStageColor(tourType, stage.stageNumber, {
                              lineColor: e.target.value,
                            })
                          }
                          className="w-24 px-2 py-1 text-sm bg-[#0b1215] border border-[#1e2a33] rounded text-white focus:border-[#088d95] focus:outline-none"
                        />
                      </div>

                      {/* Line Opacity */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">
                          Opacity:
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={stage.lineOpacity * 100}
                          onChange={e =>
                            updateStageColor(tourType, stage.stageNumber, {
                              lineOpacity: Number(e.target.value) / 100,
                            })
                          }
                          className="w-20 h-1.5 bg-[#1e2a33] rounded appearance-none cursor-pointer accent-[#088d95]"
                        />
                        <span className="text-xs text-gray-500 w-10">
                          {Math.round(stage.lineOpacity * 100)}%
                        </span>
                      </div>

                      {/* Save Button */}
                      <button
                        onClick={() => handleSaveStageColor(tourType, stage)}
                        disabled={saving}
                        className="ml-auto px-3 py-1.5 text-sm bg-[#088d95]/20 hover:bg-[#088d95]/40 text-[#088d95] rounded transition-colors disabled:opacity-50"
                      >
                        <i className="fas fa-save mr-1"></i>
                        Save
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Preview Section */}
        <section className="bg-[#080e11] border border-[#1e2a33] rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <i className="fas fa-eye text-[#088d95]"></i>
            Preview
          </h2>
          <div className="flex items-center gap-4 p-4 bg-[#0b1215] rounded-lg">
            <div className="flex-1 space-y-2">
              {(['gold', 'silver', 'bronze'] as TourType[]).map(tourType => (
                <div key={tourType} className="flex items-center gap-2">
                  <span className="text-sm text-gray-400 w-16 capitalize">
                    {tourType}:
                  </span>
                  <div className="flex-1 h-4 rounded-full flex overflow-hidden">
                    {stageColors[tourType].map((stage, idx) => (
                      <div
                        key={idx}
                        className="flex-1 h-full"
                        style={{
                          backgroundColor: stage.lineColor,
                          opacity: stage.lineOpacity,
                        }}
                      ></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
