import { useEffect, type RefObject } from 'react';
import type { DrawingMode, EditMode } from '../types';

interface UseEditorShortcutsArgs {
  setEditMode: (m: EditMode) => void;
  setDrawingMode: (m: DrawingMode) => void;
  onSave: () => void;
  onClear: () => void;
  onCalculateElevation: () => void;
  gpxInputRef: RefObject<HTMLInputElement>;
  openShortcutsDialog: () => void;
}

// Skip when the user is typing so shortcuts don't hijack text entry
function isTypingContext(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable === true;
}

export function useEditorShortcuts({
  setEditMode,
  setDrawingMode,
  onSave,
  onClear,
  onCalculateElevation,
  gpxInputRef,
  openShortcutsDialog,
}: UseEditorShortcutsArgs) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingContext()) return;

      const mod = e.ctrlKey || e.metaKey;

      // Cmd/Ctrl+S — save. Always intercept even if browser has its own save.
      if (mod && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        onSave();
        return;
      }

      // Cmd/Ctrl+Shift+Backspace — destructive, so guarded behind a modifier
      if (mod && e.shiftKey && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault();
        if (window.confirm('Clear the entire route?')) onClear();
        return;
      }

      // Shortcut help — `?` (Shift+/) or plain `/`
      if ((e.key === '?' || (e.shiftKey && e.key === '/')) && !mod) {
        e.preventDefault();
        openShortcutsDialog();
        return;
      }

      // Single-letter shortcuts — only when no modifier is held so we don't
      // eat things like Cmd+P (browser print) or Ctrl+V (paste).
      if (mod || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case 'v':
        case 'h':
          e.preventDefault();
          setEditMode('pan');
          break;
        case 's':
          e.preventDefault();
          setEditMode('start');
          break;
        case 'e':
          e.preventDefault();
          setEditMode('end');
          break;
        case 'w':
          e.preventDefault();
          setEditMode('waypoint');
          break;
        case 'p':
          e.preventDefault();
          setEditMode('poi');
          break;
        case 'a':
          e.preventDefault();
          setDrawingMode('auto');
          break;
        case 'd':
          e.preventDefault();
          setDrawingMode('manual');
          break;
        case 'u':
          e.preventDefault();
          gpxInputRef.current?.click();
          break;
        case 'l':
          e.preventDefault();
          onCalculateElevation();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    setEditMode,
    setDrawingMode,
    onSave,
    onClear,
    onCalculateElevation,
    gpxInputRef,
    openShortcutsDialog,
  ]);
}
