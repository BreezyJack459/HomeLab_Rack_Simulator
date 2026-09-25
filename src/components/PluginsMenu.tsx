import { useEffect, useRef, useState } from 'react';
import { Blocks, ChevronDown } from 'lucide-react';

export type PluginToggleItem = {
  id: string;
  label: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

// Shared plugins dropdown (used by TopContextBar and the new ShellTopBar).
// The On/Off/Blocked state pill is derived from enabled/disabled; the label
// stays the bare plugin name.
export function PluginsMenu({ pluginToggles, inline = false }: { pluginToggles: PluginToggleItem[]; inline?: boolean }) {
  const [pluginMenuOpen, setPluginMenuOpen] = useState(false);
  const pluginMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pluginMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!pluginMenuRef.current?.contains(event.target as Node)) setPluginMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [pluginMenuOpen]);
  const enabledPluginCount = pluginToggles.filter((plugin) => plugin.enabled).length;

  return (
    <div className={inline ? 'w-full min-w-0' : 'relative'} ref={pluginMenuRef}>
      <button
        type="button"
        aria-expanded={pluginMenuOpen}
        onClick={() => setPluginMenuOpen((value) => !value)}
        className={`inline-flex h-8 items-center gap-1.5 rounded-full border border-edge bg-surface px-3 text-xs font-medium text-content-secondary transition hover:border-accent hover:text-accent-fg dark:border-edge-strong dark:bg-surface-raised dark:text-content-secondary dark:hover:border-accent dark:hover:text-accent-fg ${inline ? 'w-full justify-center' : ''}`}
      >
        <Blocks size={14} />
        Plugins
        <span className="rounded-full bg-fill px-1.5 py-0.5 text-[10px] text-content-faint dark:bg-fill dark:text-content-faint">
          {enabledPluginCount}/{pluginToggles.length}
        </span>
        <ChevronDown
          size={13}
          className={`shrink-0 text-content-faint transition ${pluginMenuOpen ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {pluginMenuOpen ? (
        <div
          role="group"
          aria-label="Plugin switches"
          className={`${inline ? 'mt-2 w-full' : 'absolute right-0 top-full z-30 mt-2 w-64 shadow-xl'} rounded-2xl border border-edge bg-surface p-2 dark:border-edge dark:bg-surface`}
        >
          <div className="mb-1 px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-content-faint">
            Plugins
          </div>
          {pluginToggles.map((plugin) => (
            <button
              key={plugin.id}
              type="button"
              aria-pressed={plugin.enabled}
              disabled={plugin.disabled}
              onClick={plugin.onToggle}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-xs text-content-secondary transition hover:bg-fill disabled:cursor-not-allowed disabled:text-content-faint dark:text-content-secondary dark:hover:bg-surface-raised"
            >
              <span className="min-w-0 break-words">{plugin.label}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  plugin.disabled
                    ? 'bg-fill text-content-faint dark:bg-surface-raised dark:text-content-faint'
                    : plugin.enabled
                      ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                      : 'bg-fill text-content-muted dark:bg-surface-raised dark:text-content-muted'
                }`}
              >
                {plugin.disabled ? 'Blocked' : plugin.enabled ? 'On' : 'Off'}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
