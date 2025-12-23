import { useTranslation } from 'react-i18next';
import './TourSelector.css';

type TourType = 'gold' | 'silver' | 'bronze';

interface TourSelectorProps {
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

export default function TourSelector({
  tourType,
  onTourTypeChange,
  selectedStage,
  onStageSelect,
}: TourSelectorProps) {
  const { t } = useTranslation();

  const handleTourClick = (type: TourType) => {
    onTourTypeChange(type);
    // Reset stage selection when changing tour type
    if (onStageSelect) {
      onStageSelect(null);
    }
  };

  const handleStageClick = (stage: number) => {
    if (onStageSelect) {
      // Toggle stage selection
      onStageSelect(selectedStage === stage ? null : stage);
    }
  };

  return (
    <div className="tour-selector-overlay">
      {(['gold', 'silver', 'bronze'] as const).map(type => (
        <div key={type} className="tour-group">
          <button
            onClick={() => handleTourClick(type)}
            className={`tour-btn ${tourType === type ? 'active' : ''}`}
            data-type={type}
          >
            {t(type)}
          </button>

          {/* Stage buttons - show when this tour type is active */}
          {tourType === type && stageConfig[type] > 1 && (
            <div className="stage-buttons">
              {Array.from({ length: stageConfig[type] }, (_, i) => i + 1).map(
                stage => (
                  <button
                    key={stage}
                    onClick={() => handleStageClick(stage)}
                    className={`stage-btn ${
                      selectedStage === stage ? 'active' : ''
                    }`}
                    title={`${t('stage')} ${stage}`}
                  >
                    {stage}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
