import { useEffect, useState } from 'react';
import { Keyboard, X } from 'lucide-react';

const shortcuts = [
  { keys: ['?'], description: 'Show / hide this help' },
  { keys: ['Ctrl', 'Z'], description: 'Undo last action' },
  { keys: ['Ctrl', 'Y'], description: 'Redo last action' },
  { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo last action (alt)' },
  { keys: ['Ctrl', 'S'], description: 'Save layout to localStorage' },
  { keys: ['Del'], description: 'Delete selected device' },
  { keys: ['Esc'], description: 'Clear selection / close panels' },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        event.preventDefault();
        setOpen((v) => !v);
      }
    }
    function handleToggle() {
      setOpen((v) => !v);
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('toggle-shortcuts', handleToggle);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('toggle-shortcuts', handleToggle);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener('keydown', handleEsc, true);
    return () => document.removeEventListener('keydown', handleEsc, true);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" aria-modal="true" role="dialog" aria-labelledby="kbd-title">
      <div
        className="w-80 rounded-lg border p-5 shadow-xl"
        style={{
          backgroundColor: 'var(--theme-bg-secondary)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div id="kbd-title" className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
            <Keyboard size={16} />
            Keyboard Shortcuts
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          >
            <X size={14} />
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map((shortcut) => (
            <div key={`${shortcut.keys.join('-')}-${shortcut.description}`} className="flex items-center justify-between text-sm">
              <span style={{ color: 'var(--theme-text-secondary)' }}>{shortcut.description}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, index) => (
                  <span key={key} className="flex items-center gap-1">
                    <kbd
                      className="rounded border px-1.5 py-0.5 text-xs font-mono"
                      style={{
                        backgroundColor: 'var(--theme-bg-input)',
                        borderColor: 'var(--theme-border)',
                        color: 'var(--theme-text-primary)'
                      }}
                    >
                      {key}
                    </kbd>
                    {index < shortcut.keys.length - 1 && (
                      <span style={{ color: 'var(--theme-text-muted)' }}>+</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
