import type { EditMode } from '../types';

interface ModeInfoOverlayProps {
  editMode: EditMode;
  modeLabels: Record<string, string>;
}

export default function ModeInfoOverlay({
  editMode,
  modeLabels,
}: ModeInfoOverlayProps) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-[#080e11] border border-[#1e2a33] rounded-lg text-white text-sm shadow-lg">
      <i className="fas fa-info-circle text-[#088d95] mr-2"></i>
      {modeLabels[editMode]}
    </div>
  );
}
