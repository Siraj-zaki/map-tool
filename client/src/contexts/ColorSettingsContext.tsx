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
}

// Default values matching the original hardcoded colors
const defaultSettings: ColorSettings = {
  routeSettings: {
    mainColor: '#088D95',
    lineWidth: 5,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
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
};

const ColorSettingsContext = createContext<ColorSettings>(defaultSettings);

export function ColorSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<
    Omit<ColorSettings, 'getStageColor' | 'getStageOpacity' | 'loading'>
  >({
    routeSettings: defaultSettings.routeSettings,
    stageColors: defaultSettings.stageColors,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
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
    };
    loadSettings();
  }, []);

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

    // Fallback: try default settings
    const defaultStages = defaultSettings.stageColors[tourType];
    const defaultStage = defaultStages?.find(
      s => s.stageNumber === stageNumber
    );
    if (defaultStage) {
      return defaultStage.lineColor;
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
    return 1;
  };

  const value: ColorSettings = {
    ...settings,
    loading,
    getStageColor,
    getStageOpacity,
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
