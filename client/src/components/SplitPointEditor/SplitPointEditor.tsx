import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { splitPointsApi, type POI, type SplitPoint } from '../../api';
import { useColorSettings } from '../../contexts/ColorSettingsContext';
import './SplitPointEditor.css';

type TourType = 'silver' | 'bronze';

interface SplitPointEditorProps {
  routeId: number | null;
  routeGeometry: [number, number][] | null;
  elevationData: { elevation: number; distance: number }[] | null;
  totalDistance: number;
  splitPoints: Record<TourType, SplitPoint[]>;
  pois: POI[];
  onSplitPointChange: (splitPoints: Record<TourType, SplitPoint[]>) => void;
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

// Calculate segment stats (distance, elevation gain/loss, time)

export default function SplitPointEditor({
  routeId,
  routeGeometry,
  elevationData,
  totalDistance: _totalDistance,
  splitPoints,
  pois,
  onSplitPointChange,
  onSetSplitPointMode,
}: SplitPointEditorProps) {
  const { t } = useTranslation();
  const { getStageColor } = useColorSettings();
  const [selectedTourType, setSelectedTourType] = useState<TourType>('silver');
  const [saving, setSaving] = useState(false);
  const [editingStage, setEditingStage] = useState<number | null>(null);
  const [selectedStartPoiId, setSelectedStartPoiId] = useState<number | null>(
    null
  );

  // Filter cities for dropdown
  const cities = useMemo(
    () =>
      pois.filter(
        p =>
          p.type?.toLowerCase() === 'city' ||
          p.type?.toLowerCase() === 'start_city'
      ),
    [pois]
  );

  // Set initial start city if available
  useMemo(() => {
    if (cities.length > 0 && selectedStartPoiId === null) {
      // Don't auto select here to allow "Default" (no ID) state if needed
      // But requirement says "Admin selects Wernigerode".
    }
  }, [cities, selectedStartPoiId]);

  const handleSave = async () => {
    if (!routeId) return;
    setSaving(true);
    try {
      // We need to save split points, including startPoiId
      // splitPoints state contains ALL points.
      // But currently splitPoints state is Record<TourType, SplitPoint[]>.
      // We should probably filter before saving? No, we save what's in the state.
      // Wait, if we edit for City A, then switch to City B, we load diff points?

      // Since splitPoints prop comes from parent, we modify parent state.
      // We should probably allow parent to manage filtering or we assume splitPoints contains ALL variants?
      // Currently API returns ALL splits for the route (grouped by tourType).
      // We should save ALL of them.

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
    const prev = splitPoints;
    const existingIndex = prev[tourType].findIndex(
      sp =>
        sp.stageNumber === stageNumber &&
        sp.startPoiId === (selectedStartPoiId || undefined)
    );

    let newPoints: SplitPoint[];

    if (existingIndex >= 0) {
      newPoints = [...prev[tourType]];
      newPoints[existingIndex] = { ...newPoints[existingIndex], ...updates };
    } else {
      const newPoint: SplitPoint = {
        stageNumber,
        startPoiId: selectedStartPoiId || undefined,
        locationName: '',
        lng: 0,
        lat: 0,
        distanceKm: 0,
        ...updates,
      };
      // Add and sort
      newPoints = [...prev[tourType], newPoint].sort(
        (a, b) => a.stageNumber - b.stageNumber
      );
    }

    const newSplitPoints = { ...prev, [tourType]: newPoints };
    onSplitPointChange(newSplitPoints);
  };

  const removeSplitPoint = (tourType: TourType, stageNumber: number) => {
    const prev = splitPoints;
    // Remove only for current start city
    const newPoints = prev[tourType].filter(
      sp =>
        !(
          sp.stageNumber === stageNumber &&
          sp.startPoiId === (selectedStartPoiId || undefined)
        )
    );
    const newSplitPoints = { ...prev, [tourType]: newPoints };
    onSplitPointChange(newSplitPoints);
  };

  // Called when user clicks on map to set split point
  const handleMapClick = (lng: number, lat: number) => {
    if (editingStage === null || !routeGeometry) return;

    // Find closest point on route
    let minDist = Infinity;
    let closestIndex = 0;

    for (let i = 0; i < routeGeometry.length; i++) {
      const d = haversineDistance(
        lat,
        lng,
        routeGeometry[i][1],
        routeGeometry[i][0]
      );
      if (d < minDist) {
        minDist = d;
        closestIndex = i;
      }
    }

    const closestCoord = routeGeometry[closestIndex];

    // Calculate stats for this segment
    // Segment logic:
    // If Stage 1: Start (Start City or Route Start) -> This Split
    // If Stage 2: Previous Split -> This Split

    // We need coordinates reordered based on Start City if selected

    // Simple logic:
    // We just calculate distance from Start of ROUTE to this point for now?
    // Or if we have a Start City, we should calculate from there?
    // Implementing full reordering logic here might be complex.
    // Let's rely on finding indices in the original geometry for now.

    // Wait, if it's a loop, calculating "Distance along route" depends on start point.
    // If selectedStartPoiId is set, we find that POI index.

    let startIdx = 0;
    if (selectedStartPoiId) {
      const city = pois.find(p => p.poi_id === selectedStartPoiId);
      if (city) {
        // Find closest index for city
        let minD = Infinity;
        for (let i = 0; i < routeGeometry.length; i++) {
          const d = haversineDistance(
            city.lngLat[1],
            city.lngLat[0],
            routeGeometry[i][1],
            routeGeometry[i][0]
          );
          if (d < minD) {
            minD = d;
            startIdx = i;
          }
        }
      }
    }

    // Now calculate distance/stats from startIdx to closestIndex (handling loop wrap)
    // Distance calculation should wrap around
    let dist = 0;
    let asc = 0;
    let desc = 0;

    // Iterate from startIdx to closestIndex
    let curr = startIdx;
    while (curr !== closestIndex) {
      let next = (curr + 1) % routeGeometry.length;
      // Don't loop infinitely if single point
      if (routeGeometry.length < 2) break;

      const p1 = routeGeometry[curr];
      const p2 = routeGeometry[next];
      dist += haversineDistance(p1[1], p1[0], p2[1], p2[0]);

      if (elevationData && elevationData[curr] && elevationData[next]) {
        // Elevation data might not match re-indexed geometry directly indices?
        // elevationData corresponds to routeGeometry indices usually.
        const eleDiff =
          elevationData[next].elevation - elevationData[curr].elevation;
        // Handle wrap around jump? Elevation usually discontinuous at wrap?
        // For a loop, start/end elevation should be same.
        // If we wrap from last to first, assuming contiguous.
        if (next !== 0) {
          if (eleDiff > 0) asc += eleDiff;
          else desc += Math.abs(eleDiff);
        }
      }

      curr = next;
    }

    // DIN 33466
    const tH = dist / 4;
    const tV = asc / 300;
    const time = Math.max(tH, tV) + Math.min(tH, tV) / 2;
    const durMins = Math.round(time * 60);

    // This calculated distance is "Distance from Start City to this Split".
    // Is that what we want?
    // Usually Split Point stores "Cumulative Distance from Start"?
    // Or "Distance of this Stage"?
    // The DB schema has `distance_km` in `stage_split_points`.
    // And `elevation_gain` etc. as new columns.
    // If `stage_number` is 1, it's Stage 1 stats?
    // Typically `stage_split_points` defines the END of the stage.
    // So for Stage 1 (Start -> Split 1), the stats stored in Split 1 row should be for Stage 1.
    // Yes.

    updateSplitPoint(selectedTourType, editingStage, {
      lng: closestCoord[0],
      lat: closestCoord[1],
      distanceKm: dist,
      elevationGain: asc,
      elevationLoss: desc,
      durationMinutes: durMins,
    });

    setEditingStage(null);
    onSetSplitPointMode?.(false, selectedTourType, editingStage, null);
  };

  // Expose handleMapClick for parent to call
  (window as any).__splitPointMapClick = handleMapClick;

  const numStages = stageConfig[selectedTourType];
  const numSplitPoints = numStages - 1; // e.g., 2 stages = 1 split point

  // Filter split points for display
  const currentSplitPoints = splitPoints[selectedTourType]
    .filter(sp => sp.startPoiId === (selectedStartPoiId || undefined))
    .sort((a, b) => a.stageNumber - b.stageNumber);

  return (
    <div className="split-point-editor">
      <div className="split-point-header">
        <i className="fas fa-scissors"></i>
        <span>{t('stageSplitPoints') || 'Stage Split Points'}</span>
      </div>

      {/* Start City Selector */}
      {cities.length > 0 && (
        <div className="mb-4 px-3">
          <label className="block text-xs text-gray-400 mb-1">
            {t('startLocation') || 'Start Location'} (Context)
          </label>
          <select
            className="w-full bg-[#1e2a33] border border-[#2c3e50] rounded px-2 py-1 text-white text-sm"
            value={selectedStartPoiId || ''}
            onChange={e =>
              setSelectedStartPoiId(
                e.target.value ? Number(e.target.value) : null
              )
            }
          >
            <option value="">{t('originalStart') || 'Original Start'}</option>
            {cities.map(c => (
              <option key={c.poi_id} value={c.poi_id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

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
            const splitPoint = currentSplitPoints.find(
              sp => sp.stageNumber === splitNum
            );
            const isEditing = editingStage === splitNum;
            const stageLabel = splitPoint?.startPoiId
              ? `${t('stage') || 'Stage'} ${splitNum} (${t('from') || 'from'} ${cities.find(c => c.poi_id === splitPoint.startPoiId)?.name || 'Start'})`
              : `${t('stage') || 'Stage'} ${splitNum}`;

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
                  <div className="text-xs text-gray-400 mb-1 font-medium">
                    {stageLabel}
                  </div>
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
                    <div className="split-point-stats text-xs text-gray-400 mt-1">
                      <span title="Distance">
                        <i className="fas fa-ruler-horizontal ml-1"></i>{' '}
                        {splitPoint.distanceKm.toFixed(1)} km
                      </span>
                      {splitPoint.elevationGain !== undefined && (
                        <span title="Ascent" className="ml-2">
                          <i className="fas fa-arrow-up ml-1"></i>{' '}
                          {Math.round(splitPoint.elevationGain)}m
                        </span>
                      )}
                      {splitPoint.durationMinutes !== undefined && (
                        <span title="Duration" className="ml-2">
                          <i className="fas fa-clock ml-1"></i>{' '}
                          {Math.round(splitPoint.durationMinutes / 60)}h{' '}
                          {splitPoint.durationMinutes % 60}m
                        </span>
                      )}
                    </div>
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
                        // Callback wrapper to bridge plain coords to our logic
                        // But actually we have handleMapClick handling the logic now.
                        // We just need to tell parent (Editor) we are in split mode.
                        // The parent calls window.__splitPointMapClick.

                        onSetSplitPointMode?.(
                          true,
                          selectedTourType,
                          splitNum,
                          null // No direct callback needed as we use window global or local logic
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
