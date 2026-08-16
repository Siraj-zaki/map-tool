import { useEffect } from 'react';

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

const isMac =
  typeof navigator !== 'undefined' &&
  /mac|iphone|ipad|ipod/i.test(navigator.platform);

const mod = isMac ? '⌘' : 'Ctrl';
const shift = isMac ? '⇧' : 'Shift';
const del = isMac ? '⌫' : 'Backspace';

interface Shortcut {
  keys: string[];
  label: string;
}

interface ShortcutGroup {
  title: string;
  items: Shortcut[];
}

const groups: ShortcutGroup[] = [
  {
    title: 'Tools',
    items: [
      { keys: ['V'], label: 'Pan / navigate' },
      { keys: ['S'], label: 'Set start point' },
      { keys: ['E'], label: 'Set end point' },
      { keys: ['W'], label: 'Add waypoint' },
      { keys: ['P'], label: 'Add point of interest' },
    ],
  },
  {
    title: 'Routing mode',
    items: [
      { keys: ['A'], label: 'Snap to trail (auto)' },
      { keys: ['D'], label: 'Direct line (manual)' },
    ],
  },
  {
    title: 'Actions',
    items: [
      { keys: [mod, 'S'], label: 'Save route' },
      { keys: ['U'], label: 'Upload GPX file' },
      { keys: ['L'], label: 'Calculate elevation' },
      { keys: [mod, shift, del], label: 'Clear route' },
    ],
  },
  {
    title: 'History',
    items: [
      { keys: [mod, 'Z'], label: 'Undo' },
      { keys: [mod, shift, 'Z'], label: 'Redo' },
      { keys: [mod, 'Y'], label: 'Redo (alt)' },
    ],
  },
  {
    title: 'Selection',
    items: [
      { keys: [del], label: 'Delete selected waypoint' },
      { keys: ['Esc'], label: 'Deselect waypoint' },
    ],
  },
  {
    title: 'Help',
    items: [{ keys: ['?'], label: 'Show this dialog' }],
  },
];

export default function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-[42rem] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-4rem)] bg-[#080e11] border border-[#1e2a33] rounded-xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2a33]">
          <div className="flex items-center gap-3">
            <i className="fas fa-keyboard text-[#088d95]"></i>
            <h2 className="text-white text-lg font-semibold">
              Keyboard shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:bg-[#1e2a33] hover:text-white transition-all"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 grid grid-cols-2 gap-x-8 gap-y-6 overflow-y-auto">
          {groups.map(group => (
            <div key={group.title}>
              <h3 className="text-[#088d95] text-[0.7rem] uppercase tracking-widest font-semibold mb-3">
                {group.title}
              </h3>
              <div className="flex flex-col gap-2">
                {group.items.map(item => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-gray-300 text-sm">{item.label}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && (
                            <span className="text-gray-600 text-xs">+</span>
                          )}
                          <kbd className="min-w-[1.75rem] h-7 px-2 flex items-center justify-center rounded-md bg-[#0b1215] border border-[#1e2a33] text-white text-xs font-mono shadow-inner">
                            {k}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-3 border-t border-[#1e2a33] bg-[#0b1215] text-xs text-gray-500">
          Shortcuts are disabled while typing in a text field.
        </div>
      </div>
    </div>
  );
}
