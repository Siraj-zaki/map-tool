import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { splitPointsApi, type SplitPoint } from '../../api';
import { useColorSettings } from '../../contexts/ColorSettingsContext';
import './LocationFilter.css';

type TourType = 'gold' | 'silver' | 'bronze';

interface LocationFilterProps {
  routeId: number;
  tourType: TourType;
  onFilterChange?: (selectedLocation: string | null) => void;
}

export default function LocationFilter({
  routeId,
  tourType,
  onFilterChange,
}: LocationFilterProps) {
  const { t } = useTranslation();
  const { getStageColor } = useColorSettings();
  const [splitPoints, setSplitPoints] = useState<SplitPoint[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!routeId || tourType === 'gold') {
      setLoading(false);
      return;
    }

    const loadSplitPoints = async () => {
      try {
        const result = await splitPointsApi.getByRoute(routeId);
        if (result.success) {
          const points =
            result.splitPoints[tourType as 'silver' | 'bronze'] || [];
          setSplitPoints(points);
        }
      } catch (error) {
        console.error('Failed to load split points:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSplitPoints();
  }, [routeId, tourType]);

  const handleLocationClick = (locationName: string) => {
    const newSelection =
      selectedLocation === locationName ? null : locationName;
    setSelectedLocation(newSelection);
    onFilterChange?.(newSelection);
  };

  // Don't show for gold tour (only 1 stage)
  if (tourType === 'gold' || splitPoints.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <div className="location-filter loading">
        <i className="fas fa-spinner fa-spin"></i>
      </div>
    );
  }

  return (
    <div className="location-filter">
      <div className="location-filter-header">
        <i className="fas fa-map-marker-alt"></i>
        <span>{t('filterByLocation') || 'Stage Locations'}</span>
      </div>

      <div className="location-tags">
        {splitPoints.map((sp, index) => (
          <button
            key={sp.stageNumber}
            className={`location-tag ${
              selectedLocation === sp.locationName ? 'active' : ''
            }`}
            onClick={() => handleLocationClick(sp.locationName)}
            style={{
              borderColor:
                selectedLocation === sp.locationName
                  ? getStageColor(
                      tourType as 'silver' | 'bronze',
                      sp.stageNumber
                    )
                  : undefined,
              backgroundColor:
                selectedLocation === sp.locationName
                  ? `${getStageColor(
                      tourType as 'silver' | 'bronze',
                      sp.stageNumber
                    )}20`
                  : undefined,
            }}
          >
            <span
              className="location-dot"
              style={{
                backgroundColor: getStageColor(
                  tourType as 'silver' | 'bronze',
                  sp.stageNumber
                ),
              }}
            />
            {sp.locationName ||
              `${t('stage')} ${sp.stageNumber} → ${sp.stageNumber + 1}`}
          </button>
        ))}

        {selectedLocation && (
          <button
            className="location-tag clear"
            onClick={() => {
              setSelectedLocation(null);
              onFilterChange?.(null);
            }}
          >
            <i className="fas fa-times"></i>
            {t('clearFilter') || 'Clear'}
          </button>
        )}
      </div>
    </div>
  );
}
