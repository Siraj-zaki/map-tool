import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { DrawingMode, EditMode, ElevationSample, LngLat } from '../types';

interface EditorToolbarProps {
  editMode: EditMode;
  setEditMode: (mode: EditMode) => void;

  drawingMode: DrawingMode;
  setDrawingMode: (mode: DrawingMode) => void;

  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  saving: boolean;
  calculatingElevation: boolean;
  routeGeometry: LngLat[] | null;
  elevationData: ElevationSample[] | null;
  gpxInputRef: RefObject<HTMLInputElement>;
  onSave: () => void;
  onClear: () => void;
  onCalculateElevation: () => void;
  onGPXUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;

  onShowShortcuts: () => void;
}

interface ToolButtonProps {
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'danger' | 'success' | 'warning' | 'accent';
  loading?: boolean;
  shortcut?: string;
}

function ToolButton({
  icon,
  label,
  onClick,
  active = false,
  disabled = false,
  variant = 'default',
  loading = false,
  shortcut,
}: ToolButtonProps) {
  // The `default` and `primary` variants respect the brand primary color
  // via the global `.brand-primary-*` utility classes so editor CTAs pick
  // up admin white-label settings without prop drilling.
  const variantClasses: Record<NonNullable<ToolButtonProps['variant']>, string> = {
    default: active
      ? 'brand-primary-bg text-white shadow-lg'
      : 'bg-transparent text-gray-400 hover:bg-[#1e2a33] hover:text-white',
    primary: active
      ? 'brand-primary-bg text-white shadow-lg'
      : 'brand-primary-fill-soft brand-primary-text brand-primary-hover-border',
    danger: 'bg-transparent text-red-400 hover:bg-red-500/15 hover:text-red-300',
    success: active
      ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
      : 'bg-transparent text-gray-400 hover:bg-green-500/15 hover:text-green-400',
    warning: active
      ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-500/30'
      : 'bg-transparent text-gray-400 hover:bg-yellow-500/15 hover:text-yellow-400',
    accent: active
      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
      : 'bg-transparent text-gray-400 hover:bg-orange-500/15 hover:text-orange-400',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative w-9 h-9 flex items-center justify-center rounded-md transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent ${variantClasses[variant]}`}
    >
      <i
        className={`fas ${loading ? 'fa-spinner fa-spin' : icon} text-[0.85rem]`}
      ></i>
      {/* Tooltip */}
      <span className="pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 -translate-y-1/2 z-50 whitespace-nowrap px-2.5 py-1.5 rounded-md bg-[#0b1215] border border-[#1e2a33] text-white text-xs opacity-0 translate-x-[-4px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 shadow-lg">
        {label}
        {shortcut && (
          <span className="ml-2 text-gray-500 text-[0.65rem]">{shortcut}</span>
        )}
      </span>
    </button>
  );
}

function Divider() {
  return <div className="w-6 h-px bg-[#1e2a33] my-1 self-center" />;
}

export default function EditorToolbar({
  editMode,
  setEditMode,
  drawingMode,
  setDrawingMode,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  saving,
  calculatingElevation,
  routeGeometry,
  elevationData,
  gpxInputRef,
  onSave,
  onClear,
  onCalculateElevation,
  onGPXUpload,
  onShowShortcuts,
}: EditorToolbarProps) {
  const { t } = useTranslation();
  const hasElevation = !!(elevationData && elevationData.length > 0);
  const canCalcElevation = !calculatingElevation && !!(routeGeometry && routeGeometry.length > 0);

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-40 w-12 bg-[#080e11]/95 backdrop-blur-sm border border-[#1e2a33] rounded-xl shadow-2xl shadow-black/50 flex flex-col items-center py-1.5 gap-0.5">
      {/* Navigation */}
      <ToolButton
        icon="fa-hand-paper"
        label={t('pan') || 'Pan / Navigate'}
        onClick={() => setEditMode('pan')}
        active={editMode === 'pan'}
        shortcut="V"
      />

      <Divider />

      {/* History */}
      <ToolButton
        icon="fa-undo"
        label={t('undo') || 'Undo'}
        onClick={onUndo}
        disabled={!canUndo}
        shortcut="⌘Z"
      />
      <ToolButton
        icon="fa-redo"
        label={t('redo') || 'Redo'}
        onClick={onRedo}
        disabled={!canRedo}
        shortcut="⌘⇧Z"
      />

      <Divider />

      {/* Point placement modes */}
      <ToolButton
        icon="fa-play"
        label={t('start') || 'Set start point'}
        onClick={() => setEditMode('start')}
        active={editMode === 'start'}
        variant="success"
        shortcut="S"
      />
      <ToolButton
        icon="fa-flag-checkered"
        label={t('end') || 'Set end point'}
        onClick={() => setEditMode('end')}
        active={editMode === 'end'}
        variant="danger"
        shortcut="E"
      />
      <ToolButton
        icon="fa-plus"
        label={t('waypoint') || 'Add waypoint'}
        onClick={() => setEditMode('waypoint')}
        active={editMode === 'waypoint'}
        variant="primary"
        shortcut="W"
      />
      <ToolButton
        icon="fa-map-marker-alt"
        label={t('addPoi') || 'Add point of interest'}
        onClick={() => setEditMode('poi')}
        active={editMode === 'poi'}
        variant="warning"
        shortcut="P"
      />

      <Divider />

      {/* Routing mode */}
      <ToolButton
        icon="fa-route"
        label={t('snapToTrail') || 'Snap to trail'}
        onClick={() => setDrawingMode('auto')}
        active={drawingMode === 'auto'}
        variant="primary"
        shortcut="A"
      />
      <ToolButton
        icon="fa-pen"
        label={t('directLine') || 'Direct line'}
        onClick={() => setDrawingMode('manual')}
        active={drawingMode === 'manual'}
        variant="accent"
        shortcut="D"
      />

      <Divider />

      {/* Import / Elevation */}
      <input
        type="file"
        ref={gpxInputRef}
        accept=".gpx"
        className="hidden"
        onChange={onGPXUpload}
      />
      <ToolButton
        icon="fa-upload"
        label={t('uploadGPX') || 'Upload GPX'}
        onClick={() => gpxInputRef.current?.click()}
        shortcut="U"
      />
      <ToolButton
        icon={hasElevation ? 'fa-check-circle' : 'fa-mountain'}
        label={
          calculatingElevation
            ? 'Calculating elevation…'
            : hasElevation
              ? 'Elevation ready'
              : 'Calculate elevation'
        }
        onClick={onCalculateElevation}
        disabled={!canCalcElevation}
        loading={calculatingElevation}
        variant={hasElevation ? 'success' : 'default'}
        active={hasElevation}
        shortcut="L"
      />

      <Divider />

      {/* Save + Delete */}
      <ToolButton
        icon="fa-save"
        label={t('saveRoute') || 'Save route'}
        onClick={onSave}
        disabled={saving}
        loading={saving}
        variant="primary"
        active
        shortcut="⌘S"
      />
      <ToolButton
        icon="fa-trash"
        label={t('deleteRoute') || 'Clear route'}
        onClick={onClear}
        variant="danger"
        shortcut="⌘⇧⌫"
      />

      <Divider />

      <ToolButton
        icon="fa-keyboard"
        label={t('keyboardShortcuts') || 'Keyboard shortcuts'}
        onClick={onShowShortcuts}
        shortcut="?"
      />
    </div>
  );
}
