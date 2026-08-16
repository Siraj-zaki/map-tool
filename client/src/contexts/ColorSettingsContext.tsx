import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  settingsApi,
  type RouteSettings,
  type StageColorSetting,
} from '../api';

interface ColorSettings {
  routeSettings: RouteSettings;
  stageColors: {
    gold: StageColorSetting[];
    silver: StageColorSetting[];
    bronze: StageColorSetting[];
  };
  loading: boolean;
  // Helper functions
  getStageColor: (
    tourType: 'gold' | 'silver' | 'bronze',
    stageIndex: number
  ) => string;
  getStageOpacity: (
    tourType: 'gold' | 'silver' | 'bronze',
    stageIndex: number
  ) => number;
  /**
   * Force-refetch settings from the server. Callers invoke this after
   * mutating settings (e.g. from the admin Settings page) so live consumers
   * pick up the change without a hard refresh.
   */
  refresh: () => Promise<void>;
}

// Product defaults — used when the server hasn't been reached yet, or when
// branding fields aren't set. Keep in sync with server DB defaults.
export const DEFAULT_BRAND_PRIMARY = '#088D95';
export const DEFAULT_BRAND_ACCENT = '#2dd4bf';
export const DEFAULT_BRAND_LOGO = '/images/header-logo.svg';

// Default values matching the original hardcoded colors
const defaultSettings: ColorSettings = {
  routeSettings: {
    mainColor: DEFAULT_BRAND_PRIMARY,
    lineWidth: 5,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    brandLogoUrl: null,
    primaryColor: null,
    accentColor: null,
  },
  stageColors: {
    gold: [
      {
        stageNumber: 1,
        lineColor: '#088D95',
        lineOpacity: 1,
        areaColor: null,
        areaOpacity: 0.3,
      },
    ],
    silver: [
      {
        stageNumber: 1,
        lineColor: '#088D95',
        lineOpacity: 1,
        areaColor: null,
        areaOpacity: 0.3,
      },
      {
        stageNumber: 2,
        lineColor: '#076873',
        lineOpacity: 1,
        areaColor: null,
        areaOpacity: 0.25,
      },
    ],
    bronze: [
      {
        stageNumber: 1,
        lineColor: '#088D95',
        lineOpacity: 1,
        areaColor: null,
        areaOpacity: 0.3,
      },
      {
        stageNumber: 2,
        lineColor: '#076873',
        lineOpacity: 1,
        areaColor: null,
        areaOpacity: 0.25,
      },
      {
        stageNumber: 3,
        lineColor: '#5CB7BB',
        lineOpacity: 1,
        areaColor: null,
        areaOpacity: 0.25,
      },
    ],
  },
  loading: true,
  getStageColor: () => '#088D95',
  getStageOpacity: () => 1,
  refresh: async () => {},
};

const ColorSettingsContext = createContext<ColorSettings>(defaultSettings);

export function ColorSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<
    Omit<ColorSettings, 'getStageColor' | 'getStageOpacity' | 'loading' | 'refresh'>
  >({
    routeSettings: defaultSettings.routeSettings,
    stageColors: defaultSettings.stageColors,
  });
  const [loading, setLoading] = useState(true);

  // Extracted so we can also call it on demand from `refresh()` — the
  // admin Settings page invokes it after a successful save so the CSS var
  // effect below re-fires with fresh values.
  const loadSettings = React.useCallback(async () => {
    try {
      const result = await settingsApi.getAll();
      if (result.success) {
        setSettings({
          routeSettings:
            result.routeSettings || defaultSettings.routeSettings,
          stageColors: result.stageColors,
        });
      }
    } catch (error) {
      console.error('Failed to load color settings:', error);
      // Keep default settings on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Apply branding as CSS variables on the document root so any consumer
  // that references `var(--brand-primary)` / `var(--brand-accent)` /
  // `var(--brand-logo)` reflects the current settings without prop drilling.
  // Set values re-apply whenever routeSettings changes (e.g. after saving in
  // the admin settings panel).
  useEffect(() => {
    const root = document.documentElement;
    const primary = settings.routeSettings.primaryColor || DEFAULT_BRAND_PRIMARY;
    const accent = settings.routeSettings.accentColor || DEFAULT_BRAND_ACCENT;
    const logo = settings.routeSettings.brandLogoUrl || DEFAULT_BRAND_LOGO;
    root.style.setProperty('--brand-primary', primary);
    root.style.setProperty('--brand-accent', accent);
    // `--brand-logo` is a `url(...)` value for CSS `background-image` uses;
    // JSX consumers should just read `routeSettings.brandLogoUrl` directly.
    root.style.setProperty('--brand-logo', `url("${logo}")`);
    // Marker class so the `html.brand-scope .bg-[#088d95]` overrides in
    // style.css win specificity against Tailwind's own `.bg-[#088d95]` rule.
    // Applied once on mount and left in place — no runtime toggling.
    root.classList.add('brand-scope');
  }, [
    settings.routeSettings.primaryColor,
    settings.routeSettings.accentColor,
    settings.routeSettings.brandLogoUrl,
  ]);

  // Helper to get stage color by tour type and stage index (0-based)
  // Maps 0-based index to 1-based stageNumber for database lookup
  const getStageColor = (
    tourType: 'gold' | 'silver' | 'bronze',
    stageIndex: number
  ): string => {
    const stages = settings.stageColors[tourType];
    const stageNumber = stageIndex + 1; // Convert 0-based index to 1-based stageNumber

    // Find stage by stageNumber property
    const stage = stages?.find(s => s.stageNumber === stageNumber);
    if (stage) {
      return stage.lineColor;
    }

    // Fallback: try default settings (cycle through if stage index exceeds defined colors)
    const defaultStages = defaultSettings.stageColors[tourType];
    if (defaultStages && defaultStages.length > 0) {
      return defaultStages[stageIndex % defaultStages.length].lineColor;
    }

    // Ultimate fallback
    return '#088D95';
  };

  // Helper to get stage opacity by tour type and stage index (0-based)
  const getStageOpacity = (
    tourType: 'gold' | 'silver' | 'bronze',
    stageIndex: number
  ): number => {
    const stages = settings.stageColors[tourType];
    const stageNumber = stageIndex + 1; // Convert 0-based index to 1-based stageNumber

    // Find stage by stageNumber property
    const stage = stages?.find(s => s.stageNumber === stageNumber);
    if (stage) {
      return stage.lineOpacity;
    }
    // Fallback: cycle through default opacities
    const defaultStages = defaultSettings.stageColors[tourType];
    if (defaultStages && defaultStages.length > 0) {
      return defaultStages[stageIndex % defaultStages.length].lineOpacity;
    }
    return 1;
  };

  const value: ColorSettings = {
    ...settings,
    loading,
    getStageColor,
    getStageOpacity,
    refresh: loadSettings,
  };

  return (
    <ColorSettingsContext.Provider value={value}>
      {children}
    </ColorSettingsContext.Provider>
  );
}

export function useColorSettings() {
  return useContext(ColorSettingsContext);
}

// Export for use in non-React contexts (like routeStyles.ts helpers)
export { ColorSettingsContext };
