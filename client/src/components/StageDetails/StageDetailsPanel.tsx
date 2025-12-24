import { useTranslation } from 'react-i18next';
import type { Route } from '../../api';
import { useColorSettings } from '../../contexts/ColorSettingsContext';
import './StageDetailsPanel.css';

type TourType = 'gold' | 'silver' | 'bronze';

interface StageDetailsPanelProps {
  route: Route | null;
  tourType: TourType;
  selectedStage?: number | null;
}

// Stage count per tour type
const stageConfig: Record<TourType, number> = {
  gold: 1,
  silver: 2,
  bronze: 3,
};

export default function StageDetailsPanel({
  route,
  tourType,
  selectedStage,
}: StageDetailsPanelProps) {
  const { t } = useTranslation();
  const { getStageColor } = useColorSettings();

  if (!route) return null;

  const numStages = stageConfig[tourType];
  const totalDistance = parseFloat(String(route.distance || 0));
  const totalAscent = Math.round(parseFloat(String(route.totalAscent || 0)));
  const totalDescent = Math.round(parseFloat(String(route.totalDescent || 0)));
  const highestPoint = Math.round(parseFloat(String(route.highestPoint || 0)));
  const lowestPoint = Math.round(parseFloat(String(route.lowestPoint || 0)));

  // Calculate per-stage stats (evenly divided for now)
  const getStageStats = (stageIndex: number) => {
    const stageDistance = totalDistance / numStages;
    const stageAscent = Math.round(totalAscent / numStages);
    const stageDescent = Math.round(totalDescent / numStages);

    return {
      distance: stageDistance,
      ascent: stageAscent,
      descent: stageDescent,
      color: getStageColor(tourType, stageIndex),
    };
  };

  // If a specific stage is selected, show only that stage's details
  const stagesToShow = selectedStage
    ? [selectedStage - 1]
    : Array.from({ length: numStages }, (_, i) => i);

  return (
    <div className="stage-details-panel">
      <div className="stage-details-header">
        <i className="fas fa-info-circle"></i>
        <span>{t('routeDetails') || 'Route Details'}</span>
      </div>

      {/* Total Stats */}
      <div className="stage-details-totals">
        <div className="stat-item">
          <i className="fas fa-route"></i>
          <span className="stat-value">{totalDistance.toFixed(1)} km</span>
        </div>
        <div className="stat-item">
          <i className="fas fa-arrow-up" style={{ color: '#22c55e' }}></i>
          <span className="stat-value">{totalAscent} m</span>
        </div>
        <div className="stat-item">
          <i className="fas fa-arrow-down" style={{ color: '#ef4444' }}></i>
          <span className="stat-value">{totalDescent} m</span>
        </div>
      </div>

      {/* Elevation Range */}
      <div className="stage-details-elevation">
        <span className="elevation-range">
          <i className="fas fa-mountain"></i>
          {lowestPoint}m - {highestPoint}m
        </span>
      </div>

      {/* Stage-wise breakdown - only show for multi-stage tours */}
      {numStages > 1 && (
        <div className="stage-details-stages">
          <div className="stages-header">
            {t('stageBreakdown') || 'Stage Breakdown'}
          </div>
          {stagesToShow.map(stageIndex => {
            const stats = getStageStats(stageIndex);
            return (
              <div
                key={stageIndex}
                className="stage-row"
                style={{ borderLeftColor: stats.color }}
              >
                <div className="stage-name" style={{ color: stats.color }}>
                  {t('stage')} {stageIndex + 1}
                </div>
                <div className="stage-stats">
                  <span>{stats.distance.toFixed(1)} km</span>
                  <span className="ascent">↑{stats.ascent}m</span>
                  <span className="descent">↓{stats.descent}m</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
