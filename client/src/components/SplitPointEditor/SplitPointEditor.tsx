import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { splitPointsApi, type SplitPoint, type RouteLocation } from '../../api';
import './SplitPointEditor.css';

type TourType = 'gold' | 'silver' | 'bronze';

interface SplitPointEditorProps {
  routeId: number | null;
  routeGeometry: [number, number][] | null;
  totalDistance: number;
  splitPoints: Record<TourType, SplitPoint[]>;
  locations: RouteLocation[];
  selectedLocationId: number | null;
  onSplitPointChange: (splitPoints: Record<TourType, SplitPoint[]>) => void;
  onLocationChange: (locationId: number | null) => void;
  onTourTypeChange?: (tourType: TourType) => void;
  onSetSplitPointMode?: (
    active: boolean,
    tourType: TourType,
    stageNumber: number,
    callback: ((lng: number, lat: number, distanceKm: number) => void) | null
  ) => void;
}

const TOUR_CONFIG = {
  gold: { label: 'Gold', color: '#FFD700', icon: 'fa-crown', maxStages: 1 },
  silver: { label: 'Silver', color: '#C0C0C0', icon: 'fa-medal', maxStages: 2 },
  bronze: { label: 'Bronze', color: '#CD7F32', icon: 'fa-award', maxStages: 3 },
} as const;

export default function SplitPointEditor({
  routeId,
  routeGeometry,
  splitPoints,
  locations,
  selectedLocationId,
  onSplitPointChange,
  onLocationChange,
  onTourTypeChange,
  onSetSplitPointMode,
}: SplitPointEditorProps) {
  const { t } = useTranslation();
  const [selectedTourType, setSelectedTourType] = useState<TourType>('silver');
  const [saving, setSaving] = useState(false);
  const [editingStage, setEditingStage] = useState<number | null>(null);
  const [showLocDropdown, setShowLocDropdown] = useState(false);

  const config = TOUR_CONFIG[selectedTourType];
  const points = splitPoints[selectedTourType] || [];

  const currentLocation = selectedLocationId 
    ? locations.find(l => l.id === selectedLocationId)
    : null;

  const progress = useMemo(() => ({
    completed: points.filter(sp => sp.lng && sp.lat).length,
    total: config.maxStages,
  }), [points, config.maxStages]);

  const handleSave = async () => {
    if (!routeId) return;
    setSaving(true);
    try {
      // For generic/default: pass 'Route Start' as startLocation, no locationId
      // For specific location: pass locationId and empty string for startLocation
      const startLoc = selectedLocationId ? '' : 'Route Start';
      const locId = selectedLocationId || undefined;
      
      await Promise.all([
        splitPointsApi.save(routeId, 'gold', splitPoints.gold || [], startLoc, locId),
        splitPointsApi.save(routeId, 'silver', splitPoints.silver || [], startLoc, locId),
        splitPointsApi.save(routeId, 'bronze', splitPoints.bronze || [], startLoc, locId),
      ]);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  const updatePoint = (tourType: TourType, stageNum: number, updates: Partial<SplitPoint>) => {
    const prev = splitPoints;
    const pts = prev[tourType] || [];
    const exists = pts.find(sp => sp.stageNumber === stageNum);
    let newPts: SplitPoint[];

    if (exists) {
      newPts = pts.map(sp => sp.stageNumber === stageNum ? { ...sp, ...updates } : sp);
    } else {
      newPts = [...pts, { stageNumber: stageNum, locationName: '', lng: 0, lat: 0, distanceKm: 0, ...updates }];
    }

    if ('distanceKm' in updates) {
      newPts.sort((a, b) => a.distanceKm - b.distanceKm);
      newPts = newPts.map((sp, i) => ({ ...sp, stageNumber: i + 1 }));
    }

    onSplitPointChange({ ...prev, [tourType]: newPts });
  };

  const removePoint = (tourType: TourType, stageNum: number) => {
    const prev = splitPoints;
    let newPts = (prev[tourType] || []).filter(sp => sp.stageNumber !== stageNum);
    newPts.sort((a, b) => a.distanceKm - b.distanceKm);
    newPts = newPts.map((sp, i) => ({ ...sp, stageNumber: i + 1 }));
    onSplitPointChange({ ...prev, [tourType]: newPts });
  };

  const handleAdd = () => {
    const maxStage = points.length > 0 ? Math.max(...points.map(p => p.stageNumber)) : 0;
    const newNum = maxStage + 1;
    setEditingStage(newNum);

    onSetSplitPointMode?.(true, selectedTourType, newNum, (lng, lat, distanceKm) => {
      updatePoint(selectedTourType, newNum, { lng, lat, distanceKm });
      setEditingStage(null);
    });
  };

  const handleEdit = (stageNum: number) => {
    if (editingStage === stageNum) {
      setEditingStage(null);
      onSetSplitPointMode?.(false, selectedTourType, stageNum, null);
    } else {
      setEditingStage(stageNum);
      onSetSplitPointMode?.(true, selectedTourType, stageNum, (lng, lat, distanceKm) => {
        updatePoint(selectedTourType, stageNum, { lng, lat, distanceKm });
        setEditingStage(null);
      });
    }
  };

  return (
    <div className="spe-container">
      {/* Compact Header */}
      <div className="spe-header-compact">
        <i className="fas fa-route"></i>
        <span>Stage Manager</span>
      </div>

      {/* Location Selector - Compact */}
      <div className="spe-loc-bar">
        <div className="spe-loc-label">Location</div>
        <button className="spe-loc-select" onClick={() => setShowLocDropdown(!showLocDropdown)}>
          <i className="fas fa-map-marker-alt"></i>
          <span>{currentLocation?.name || 'Route Start'}</span>
          <i className={`fas fa-chevron-${showLocDropdown ? 'up' : 'down'}`}></i>
        </button>
        
        {showLocDropdown && (
          <div className="spe-loc-dropdown">
            <button className={!selectedLocationId ? 'active' : ''} onClick={() => { onLocationChange(null); setShowLocDropdown(false); }}>
              <i className="fas fa-route"></i> Route Start
            </button>
            {locations.map(loc => (
              <button key={loc.id} className={selectedLocationId === loc.id ? 'active' : ''} onClick={() => { onLocationChange(loc.id); setShowLocDropdown(false); }}>
                <i className="fas fa-city"></i> {loc.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tour Tabs - Compact */}
      <div className="spe-tabs">
        {(Object.keys(TOUR_CONFIG) as TourType[]).map(type => {
          const cfg = TOUR_CONFIG[type];
          const isActive = selectedTourType === type;
          const pct = Math.round(((splitPoints[type]?.filter(s => s.lng).length || 0) / cfg.maxStages) * 100);
          
          return (
            <button key={type} className={`spe-tab ${isActive ? 'active' : ''}`} onClick={() => { setSelectedTourType(type); setEditingStage(null); onTourTypeChange?.(type); }}>
              <div className="spe-tab-icon" style={{ color: cfg.color }}>
                <i className={`fas ${cfg.icon}`}></i>
              </div>
              <div className="spe-tab-info">
                <span>{cfg.label}</span>
                <div className="spe-tab-bar"><div style={{ width: `${pct}%`, background: cfg.color }} /></div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Points List */}
      <div className="spe-list">
        <div className="spe-list-header">
          <span>{config.label} Split Points</span>
          <span className="spe-count">{progress.completed}/{progress.total}</span>
        </div>

        {points.length === 0 ? (
          <div className="spe-empty">
            <i className="fas fa-map-marker-alt"></i>
            <span>No split points</span>
          </div>
        ) : (
          points.map((sp, idx) => {
            const isEditing = editingStage === sp.stageNumber;
            const isSet = sp.lng && sp.lat;
            
            return (
              <div key={sp.stageNumber} className={`spe-item ${isEditing ? 'editing' : ''} ${isSet ? 'set' : ''}`}>
                <div className="spe-item-num" style={{ borderColor: config.color }}>
                  {isSet ? <i className="fas fa-check" style={{ color: config.color }}></i> : sp.stageNumber}
                </div>
                <div className="spe-item-body">
                  <input
                    type="text"
                    placeholder="Stage name"
                    value={sp.locationName || ''}
                    onChange={(e) => updatePoint(selectedTourType, sp.stageNumber, { locationName: e.target.value })}
                  />
                  {sp.distanceKm > 0 && (
                    <span className="spe-dist">{Number(sp.distanceKm).toFixed(1)} km</span>
                  )}
                </div>
                <div className="spe-item-actions">
                  <button 
                    className={isEditing ? 'active' : ''} 
                    onClick={() => handleEdit(sp.stageNumber)}
                    title={isEditing ? 'Cancel' : 'Set on map'}
                  >
                    <i className={`fas ${isEditing ? 'fa-times' : isSet ? 'fa-sync-alt' : 'fa-map-pin'}`}></i>
                  </button>
                  <button className="del" onClick={() => removePoint(selectedTourType, sp.stageNumber)}>
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* Add Button */}
        <button 
          className={`spe-add ${editingStage ? 'picking' : ''}`} 
          onClick={handleAdd} 
          disabled={editingStage !== null}
        >
          {editingStage ? (
            <><i className="fas fa-crosshairs fa-spin"></i> Click on route...</>
          ) : (
            <><i className="fas fa-plus"></i> Add Split Point</>
          )}
        </button>
      </div>

      {/* Save */}
      <button className="spe-save" onClick={handleSave} disabled={saving}>
        {saving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
        Save
      </button>
    </div>
  );
}
