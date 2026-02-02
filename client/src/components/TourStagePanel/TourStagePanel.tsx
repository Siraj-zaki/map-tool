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
  const [isCollapsed, setIsCollapsed] = useState(false);

  const numStages = stageConfig[tourType];

  // Reset to stage 1 and show all stages when tour type changes
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

  // Calculate stats for a specific stage
  const getStageStatsForStage = (stage: number) => {
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
      color: getStageColor(tourType, stage - 1),
    };
  };

  return (
    <div className="tour-stage-panel">
      {/* Header with toggle button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: isCollapsed ? 0 : '0.5rem',
          padding: '0 0.25rem',
        }}
      >
        <span
          style={{
            fontSize: '0.6875rem',
            textTransform: 'uppercase',
            color: '#088d95',
            fontWeight: 600,
            letterSpacing: '0.0313rem',
          }}
        >
          {t('tourStages')}
        </span>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            padding: '0.125rem 0.375rem',
            fontSize: '0.75rem',
            borderRadius: '0.25rem',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#088d95')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
          title={isCollapsed ? 'Show' : 'Hide'}
        >
          <i className={`fas fa-chevron-${isCollapsed ? 'down' : 'up'}`}></i>
        </button>
      </div>

      {/* Collapsible content */}
      {!isCollapsed && (
        <>
          {/* Difficulty Section */}
          <div style={{ padding: '0 0.25rem', marginBottom: '0.75rem' }}>
            <div
              style={{
                fontSize: '0.625rem',
                textTransform: 'uppercase',
                color: '#6b7280', // gray-500
                fontWeight: 600,
                marginBottom: '0.375rem',
                letterSpacing: '0.0313rem',
              }}
            >
              {t('difficultyLevel')}
            </div>
            <div className="tour-type-row">
              {(['gold', 'silver', 'bronze'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => handleTourClick(type)}
                  className={`tour-type-btn ${
                    tourType === type ? 'active' : ''
                  }`}
                  data-type={type}
                >
                  <span className="tour-label">{t(`${type}Simple`)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Days Section */}
          <div style={{ padding: '0 0.25rem', marginBottom: '0.25rem' }}>
            <div
              style={{
                fontSize: '0.625rem',
                textTransform: 'uppercase',
                color: '#6b7280', // gray-500
                fontWeight: 600,
                marginBottom: '0.375rem',
                letterSpacing: '0.0313rem',
              }}
            >
              {t('days')}
            </div>
            <div className="stage-tabs-row">
              {Array.from({ length: numStages }, (_, i) => i + 1).map(stage => (
                <button
                  key={stage}
                  onClick={() => handleStageClick(stage)}
                  className={`stage-tab ${
                    activeStage === stage ? 'active' : ''
                  }`}
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
          </div>

          {/* Stage Details - Show only active stage */}
          {route && (
            <div className="all-stages-container">
              {(() => {
                const stageStats = getStageStatsForStage(activeStage);
                if (!stageStats) return null;

                return (
                  <>
                    <div
                      key={activeStage}
                      className="stage-details-content active"
                      onClick={() => handleStageClick(activeStage)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div
                        className="stage-indicator"
                        style={{ backgroundColor: stageStats.color }}
                      />
                      <div className="stage-info">
                        <div
                          className="stage-title"
                          style={{ color: stageStats.color }}
                        >
                          {t('stage')} {activeStage}
                        </div>
                        <div className="stage-stats-grid">
                          <div className="stat-item">
                            <i className="fas fa-route" />
                            <span>{stageStats.distance.toFixed(1)} km</span>
                          </div>
                          <div className="stat-item ascent">
                            <i className="fas fa-arrow-up" />
                            <span>{stageStats.ascent}m</span>
                          </div>
                          <div className="stat-item descent">
                            <i className="fas fa-arrow-down" />
                            <span>{stageStats.descent}m</span>
                          </div>
                          <div className="stat-item elevation">
                            <i className="fas fa-mountain" />
                            <span>
                              {stageStats.lowestPoint}m -{' '}
                              {stageStats.highestPoint}m
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Next Stage Button */}
                    {activeStage < numStages && (
                      <button
                        className="stage-nav-btn"
                        onClick={e => {
                          e.stopPropagation();
                          handleStageClick(activeStage + 1);
                        }}
                        title={t('nextStage', 'Next Stage')}
                      >
                        <i className="fas fa-chevron-down" />
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
