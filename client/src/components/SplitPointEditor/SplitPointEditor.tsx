import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { splitPointsApi, type SplitPoint } from '../../api';
import { useColorSettings } from '../../contexts/ColorSettingsContext';
import './SplitPointEditor.css';

type TourType = 'silver' | 'bronze';

interface SplitPointEditorProps {
  routeId: number | null;
  routeGeometry: [number, number][] | null;
  totalDistance: number;
  onSplitPointChange?: (splitPoints: Record<TourType, SplitPoint[]>) => void;
  onSetSplitPointMode?: (
    active: boolean,
    tourType: TourType,
    stageNumber: number,
    callback: ((lng: number, lat: number, distanceKm: number) => void) | null
  ) => void;
}

const stageConfig: Record<TourType, number> = {
  silver: 2,
  bronze: 3,
};

// Calculate distance between coordinates in km
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function SplitPointEditor({
  routeId,
  routeGeometry,
  totalDistance,
  onSplitPointChange,
  onSetSplitPointMode,
}: SplitPointEditorProps) {
  const { t } = useTranslation();
  const { getStageColor } = useColorSettings();
  const [selectedTourType, setSelectedTourType] = useState<TourType>('silver');
  const [splitPoints, setSplitPoints] = useState<
    Record<TourType, SplitPoint[]>
  >({
    silver: [],
    bronze: [],
  });
  const [saving, setSaving] = useState(false);
  const [editingStage, setEditingStage] = useState<number | null>(null);

  // Load existing split points
  useEffect(() => {
    if (!routeId) return;

    const loadSplitPoints = async () => {
      try {
        const result = await splitPointsApi.getByRoute(routeId);
        if (result.success) {
          setSplitPoints(result.splitPoints);
          onSplitPointChange?.(result.splitPoints);
        }
      } catch (error) {
        console.error('Failed to load split points:', error);
      }
    };

    loadSplitPoints();
  }, [routeId, onSplitPointChange]);

  const handleSave = async () => {
    if (!routeId) return;
    setSaving(true);
    try {
      // Save both tour types
      await splitPointsApi.save(routeId, 'silver', splitPoints.silver);
      await splitPointsApi.save(routeId, 'bronze', splitPoints.bronze);
    } catch (error) {
      console.error('Failed to save split points:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateSplitPoint = (
    tourType: TourType,
    stageNumber: number,
    updates: Partial<SplitPoint>
  ) => {
    setSplitPoints(prev => {
      const existing = prev[tourType].find(
        sp => sp.stageNumber === stageNumber
      );
      let newPoints: SplitPoint[];

      if (existing) {
        newPoints = prev[tourType].map(sp =>
          sp.stageNumber === stageNumber ? { ...sp, ...updates } : sp
        );
      } else {
        const newPoint: SplitPoint = {
          stageNumber,
          locationName: '',
          lng: 0,
          lat: 0,
          distanceKm: 0,
          ...updates,
        };
        newPoints = [...prev[tourType], newPoint].sort(
          (a, b) => a.stageNumber - b.stageNumber
        );
      }

      const newSplitPoints = { ...prev, [tourType]: newPoints };
      onSplitPointChange?.(newSplitPoints);
      return newSplitPoints;
    });
  };

  const removeSplitPoint = (tourType: TourType, stageNumber: number) => {
    setSplitPoints(prev => {
      const newPoints = prev[tourType].filter(
        sp => sp.stageNumber !== stageNumber
      );
      const newSplitPoints = { ...prev, [tourType]: newPoints };
      onSplitPointChange?.(newSplitPoints);
      return newSplitPoints;
    });
  };

  // Called when user clicks on map to set split point
  const handleMapClick = (lng: number, lat: number) => {
    if (editingStage === null || !routeGeometry) return;

    // Find distance along route for this point
    let distanceKm = 0;
    let minDist = Infinity;
    let closestCoord: [number, number] = [lng, lat];
    let accumulatedDistance = 0;

    for (let i = 0; i < routeGeometry.length; i++) {
      const coord = routeGeometry[i];
      const d = haversineDistance(lat, lng, coord[1], coord[0]);

      if (i > 0) {
        accumulatedDistance += haversineDistance(
          routeGeometry[i - 1][1],
          routeGeometry[i - 1][0],
          coord[1],
          coord[0]
        );
      }

      if (d < minDist) {
        minDist = d;
        closestCoord = coord;
        distanceKm = accumulatedDistance;
      }
    }

    updateSplitPoint(selectedTourType, editingStage, {
      lng: closestCoord[0],
      lat: closestCoord[1],
      distanceKm,
    });

    setEditingStage(null);
    onSetSplitPointMode?.(false, selectedTourType, editingStage, null);
  };

  // Expose handleMapClick for parent to call
  (window as any).__splitPointMapClick = handleMapClick;

  const numStages = stageConfig[selectedTourType];
  const numSplitPoints = numStages - 1; // e.g., 2 stages = 1 split point

  return (
    <div className="split-point-editor">
      <div className="split-point-header">
        <i className="fas fa-scissors"></i>
        <span>{t('stageSplitPoints') || 'Stage Split Points'}</span>
      </div>

      {/* Tour Type Selector */}
      <div className="tour-type-tabs">
        {(['silver', 'bronze'] as TourType[]).map(type => (
          <button
            key={type}
            onClick={() => setSelectedTourType(type)}
            className={`tour-tab ${selectedTourType === type ? 'active' : ''}`}
            style={{
              borderColor:
                selectedTourType === type ? getStageColor(type, 0) : undefined,
            }}
          >
            {t(type)}
            <span className="stage-count">
              {stageConfig[type]} {t('stages') || 'stages'}
            </span>
          </button>
        ))}
      </div>

      {/* Split Points List */}
      <div className="split-points-list">
        {Array.from({ length: numSplitPoints }, (_, i) => i + 1).map(
          splitNum => {
            const splitPoint = splitPoints[selectedTourType].find(
              sp => sp.stageNumber === splitNum
            );
            const isEditing = editingStage === splitNum;

            return (
              <div key={splitNum} className="split-point-item">
                <div
                  className="split-point-badge"
                  style={{
                    backgroundColor: getStageColor(selectedTourType, splitNum),
                  }}
                >
                  {splitNum}↔{splitNum + 1}
                </div>

                <div className="split-point-content">
                  <input
                    type="text"
                    placeholder={`${
                      t('location') || 'Location'
                    } (e.g., City name)`}
                    value={splitPoint?.locationName || ''}
                    onChange={e =>
                      updateSplitPoint(selectedTourType, splitNum, {
                        locationName: e.target.value,
                      })
                    }
                    className="split-point-input"
                  />

                  {splitPoint?.distanceKm ? (
                    <span className="split-point-distance">
                      {splitPoint.distanceKm.toFixed(1)} km
                    </span>
                  ) : null}
                </div>

                <div className="split-point-actions">
                  <button
                    onClick={() => {
                      if (isEditing) {
                        setEditingStage(null);
                        onSetSplitPointMode?.(
                          false,
                          selectedTourType,
                          splitNum,
                          null
                        );
                      } else {
                        setEditingStage(splitNum);
                        // Pass a callback that updates this split point when map is clicked
                        const callback = (
                          lng: number,
                          lat: number,
                          distanceKm: number
                        ) => {
                          updateSplitPoint(selectedTourType, splitNum, {
                            lng,
                            lat,
                            distanceKm,
                          });
                          setEditingStage(null);
                        };
                        onSetSplitPointMode?.(
                          true,
                          selectedTourType,
                          splitNum,
                          callback
                        );
                      }
                    }}
                    className={`action-btn ${isEditing ? 'active' : ''}`}
                    title={t('clickOnMap') || 'Click on map to set'}
                  >
                    <i
                      className={`fas ${
                        isEditing ? 'fa-crosshairs' : 'fa-map-pin'
                      }`}
                    ></i>
                  </button>

                  {splitPoint && (
                    <button
                      onClick={() =>
                        removeSplitPoint(selectedTourType, splitNum)
                      }
                      className="action-btn delete"
                      title={t('remove') || 'Remove'}
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>

      {/* Save Button */}
      {routeId && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="save-split-points-btn"
        >
          {saving ? (
            <i className="fas fa-spinner fa-spin"></i>
          ) : (
            <i className="fas fa-save"></i>
          )}
          {t('saveSplitPoints') || 'Save Split Points'}
        </button>
      )}

      {/* Info */}
      <div className="split-point-info">
        <i className="fas fa-info-circle"></i>
        <span>
          {t('splitPointInfo') ||
            'Click on the route line to set stage boundaries'}
        </span>
      </div>
    </div>
  );
}
