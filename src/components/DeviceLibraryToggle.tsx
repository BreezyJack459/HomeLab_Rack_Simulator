import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

// Shared device-library toggle (classic ActionBar context slot and the
// new-shell CanvasHeader). Testid and styling must stay identical.
export function DeviceLibraryToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      data-testid="toggle-device-library"
      aria-expanded={open}
      aria-label="Device library"
      title="Device library · 設備"
      onClick={onToggle}
      className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition ${
        open
          ? 'border-accent/40 bg-accent-subtle text-accent-fg'
          : 'border-edge bg-surface text-content-secondary hover:border-accent hover:text-accent-fg dark:border-edge-strong dark:bg-surface-raised dark:text-content-secondary dark:hover:border-accent dark:hover:text-accent-fg'
      }`}
    >
      {open ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
      <span className="hidden sm:inline">Device library</span>
    </button>
  );
}
