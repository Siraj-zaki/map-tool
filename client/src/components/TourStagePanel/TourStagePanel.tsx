import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Route } from '../../api';
import { useColorSettings } from '../../contexts/ColorSettingsContext';
import './TourStagePanel.css';

type TourType = 'gold' | 'silver' | 'bronze';

interface TourStagePanelProps {
  route: Route | null;
  tourType: TourType;
  onTourTypeChange: (type: TourType) => void;
  selectedStage?: number | null;
  onStageSelect?: (stage: number | null) => void;
}

// Stage count per tour type
const stageConfig: Record<TourType, number> = {
  gold: 1,
  silver: 2,
  bronze: 3,
};

export default function TourStagePanel({
  route,
  tourType,
  onTourTypeChange,
  selectedStage,
  onStageSelect,
}: TourStagePanelProps) {
  const { t } = useTranslation();
  const { getStageColor } = useColorSettings();
  const [activeStage, setActiveStage] = useState<number>(1);

  const numStages = stageConfig[tourType];

  // Reset to stage 1 when tour type changes
  useEffect(() => {
    setActiveStage(1);
    if (onStageSelect) {
      onStageSelect(1);
    }
  }, [tourType, onStageSelect]);

  // Update active stage when selectedStage prop changes
  useEffect(() => {
    if (selectedStage !== null && selectedStage !== undefined) {
      setActiveStage(selectedStage);
    }
  }, [selectedStage]);

  const handleTourClick = (type: TourType) => {
    onTourTypeChange(type);
  };

  const handleStageClick = (stage: number) => {
    setActiveStage(stage);
    if (onStageSelect) {
      onStageSelect(stage);
    }
  };

  // Calculate stats for the active stage
  const getStageStats = () => {
    if (!route) return null;

    const totalDistance = parseFloat(String(route.distance || 0));
    const totalAscent = Math.round(parseFloat(String(route.totalAscent || 0)));
    const totalDescent = Math.round(
      parseFloat(String(route.totalDescent || 0))
    );
    const highestPoint = Math.round(
      parseFloat(String(route.highestPoint || 0))
    );
    const lowestPoint = Math.round(parseFloat(String(route.lowestPoint || 0)));

    const stageDistance = totalDistance / numStages;
    const stageAscent = Math.round(totalAscent / numStages);
    const stageDescent = Math.round(totalDescent / numStages);

    return {
      distance: stageDistance,
      ascent: stageAscent,
      descent: stageDescent,
      highestPoint,
      lowestPoint,
      color: getStageColor(tourType, activeStage - 1),
    };
  };

  const stats = getStageStats();

  return (
    <div className="tour-stage-panel">
      {/* Tour Type Buttons */}
      <div className="tour-type-row">
        {(['gold', 'silver', 'bronze'] as const).map(type => (
          <button
            key={type}
            onClick={() => handleTourClick(type)}
            className={`tour-type-btn ${tourType === type ? 'active' : ''}`}
            data-type={type}
          >
            <span className="tour-icon">
              {type === 'gold' && '🥇'}
              {type === 'silver' && '🥈'}
              {type === 'bronze' && '🥉'}
            </span>
            <span className="tour-label">{t(type)}</span>
          </button>
        ))}
      </div>

      {/* Stage Tabs */}
      <div className="stage-tabs-row">
        {Array.from({ length: numStages }, (_, i) => i + 1).map(stage => (
          <button
            key={stage}
            onClick={() => handleStageClick(stage)}
            className={`stage-tab ${activeStage === stage ? 'active' : ''}`}
            style={
              {
                '--stage-color': getStageColor(tourType, stage - 1),
              } as React.CSSProperties
            }
          >
            {stage}
          </button>
        ))}
      </div>

      {/* Stage Details */}
      {route && stats && (
        <div className="stage-details-content">
          <div
            className="stage-indicator"
            style={{ backgroundColor: stats.color }}
          />
          <div className="stage-info">
            <div className="stage-title" style={{ color: stats.color }}>
              {t('stage')} {activeStage}
            </div>
            <div className="stage-stats-grid">
              <div className="stat-item">
                <i className="fas fa-route" />
                <span>{stats.distance.toFixed(1)} km</span>
              </div>
              <div className="stat-item ascent">
                <i className="fas fa-arrow-up" />
                <span>{stats.ascent}m</span>
              </div>
              <div className="stat-item descent">
                <i className="fas fa-arrow-down" />
                <span>{stats.descent}m</span>
              </div>
              <div className="stat-item elevation">
                <i className="fas fa-mountain" />
                <span>
                  {stats.lowestPoint}m - {stats.highestPoint}m
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
