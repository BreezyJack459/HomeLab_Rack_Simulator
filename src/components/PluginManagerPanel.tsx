import { AlertTriangle, CheckCircle2, PlugZap, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  getPluginCatalogState,
  type PluginCatalogEntry,
} from '../plugins/pluginCatalog';
import { getLocalPackageAdapter } from '../plugins/localPackageRegistry';
import type { RackPluginManifest } from '../plugins/types';

const capabilityLabel: Record<
  RackPluginManifest['capabilities'][number],
  string
> = {
  'view-modes': 'Views',
  panels: 'Panels',
  commands: 'Commands',
  'toolbar-actions': 'Toolbar',
  'layout-read': 'Reads Layout',
};

type PluginManagerPanelProps = {
  plugins: PluginCatalogEntry[];
  enabledPluginIds: string[];
  approvedLocalPluginIds: string[];
  incompatibleReasons: Record<string, string>;
  onTogglePlugin: (pluginId: string) => void;
  onToggleApproval: (pluginId: string) => void;
};

export function PluginManagerPanel({
  plugins,
  enabledPluginIds,
  approvedLocalPluginIds,
  incompatibleReasons,
  onTogglePlugin,
  onToggleApproval,
}: PluginManagerPanelProps) {
  const enabledCount = plugins.filter((plugin) => {
    const state = getPluginCatalogState({
      entry: plugin,
      enabledPluginIds,
      approvedLocalPluginIds,
      incompatibleReasons,
    });

    return state.runtimeStatus === 'active';
  }).length;

  return (
    <section
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--theme-bg-secondary)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div
            className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            <PlugZap size={15} />
            Plugin Manager
          </div>
          <p
            className="mt-1 text-xs leading-5"
            style={{ color: 'var(--theme-text-secondary)' }}
          >
            Enable optional workflows without changing the core rack editor.
          </p>
        </div>
        <div
          className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-muted)',
          }}
        >
          {enabledCount}/{plugins.length} enabled
        </div>
      </div>

      <div className="space-y-2.5">
        {plugins.map((pluginEntry) => {
          const { manifest: plugin } = pluginEntry;
          const enabled = enabledPluginIds.includes(plugin.id);
          const adapter = getLocalPackageAdapter(pluginEntry.loaderKey);
          const catalogState = getPluginCatalogState({
            entry: pluginEntry,
            enabledPluginIds,
            approvedLocalPluginIds,
            incompatibleReasons,
          });
          const incompatibleReason =
            catalogState.runtimeStatus === 'incompatible'
              ? catalogState.summary
              : undefined;

          return (
            <div
              key={plugin.id}
              className="rounded-lg border p-3"
              style={{
                borderColor: incompatibleReason
                  ? 'rgba(245,158,11,0.35)'
                  : 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
              }}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  disabled={!catalogState.canToggle}
                  onClick={() => onTogglePlugin(plugin.id)}
                  className="mt-0.5 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`${enabled ? 'Disable' : 'Enable'} ${plugin.name}`}
                >
                  {enabled ? (
                    <ToggleRight size={22} className="text-emerald-400" />
                  ) : (
                    <ToggleLeft size={22} style={{ color: 'var(--theme-text-muted)' }} />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="truncate text-sm font-semibold"
                      style={{ color: 'var(--theme-text-primary)' }}
                    >
                      {plugin.name}
                    </span>
                    <span
                      className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]"
                      style={{
                        borderColor: enabled
                          ? 'rgba(16,185,129,0.35)'
                          : 'var(--theme-border)',
                        color: enabled
                          ? 'rgb(52 211 153)'
                          : 'var(--theme-text-muted)',
                      }}
                    >
                      {enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <span
                      className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]"
                      style={{
                        borderColor: 'var(--theme-border)',
                        color: 'var(--theme-text-muted)',
                      }}
                    >
                      v{plugin.version}
                    </span>
                  </div>

                  <p
                    className="mt-1 text-xs leading-5"
                    style={{ color: 'var(--theme-text-secondary)' }}
                  >
                    {plugin.description}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    <span
                      className="rounded-full border px-2 py-0.5"
                      style={{
                        borderColor: 'var(--theme-border)',
                        color: 'var(--theme-text-muted)',
                      }}
                    >
                      Requires app {plugin.requiresAppVersion}
                    </span>
                    {plugin.defaultEnabled ? (
                      <span
                        className="rounded-full border px-2 py-0.5"
                        style={{
                          borderColor: 'rgba(34,197,94,0.25)',
                          color: 'rgb(74 222 128)',
                        }}
                      >
                        Default enabled
                      </span>
                    ) : null}
                    <span
                      className="rounded-full border px-2 py-0.5"
                      style={{
                        borderColor:
                          plugin.origin === 'built-in'
                            ? 'rgba(56,189,248,0.25)'
                            : 'var(--theme-border)',
                        color:
                          plugin.origin === 'built-in'
                            ? 'rgb(125 211 252)'
                            : 'var(--theme-text-muted)',
                      }}
                    >
                      {plugin.origin === 'built-in' ? 'Built-in' : 'Local package'}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5"
                      style={{
                        borderColor:
                          plugin.trustLevel === 'trusted'
                            ? 'rgba(34,197,94,0.25)'
                            : 'rgba(245,158,11,0.25)',
                        color:
                          plugin.trustLevel === 'trusted'
                            ? 'rgb(74 222 128)'
                            : 'rgb(252 211 77)',
                      }}
                    >
                      <ShieldCheck size={10} />
                      {plugin.trustLevel === 'trusted' ? 'Trusted' : 'Review required'}
                    </span>
                    {plugin.origin === 'local-package' && pluginEntry.loaderKey ? (
                      <span
                        className="rounded-full border px-2 py-0.5"
                        style={{
                          borderColor: adapter
                            ? 'rgba(34,197,94,0.25)'
                            : 'rgba(245,158,11,0.25)',
                          color: adapter
                            ? 'rgb(74 222 128)'
                            : 'rgb(252 211 77)',
                        }}
                      >
                        {adapter ? `Adapter ready: ${adapter.label}` : `Adapter missing: ${pluginEntry.loaderKey}`}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {plugin.capabilities.map((capability) => (
                      <span
                        key={capability}
                        className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]"
                        style={{
                          borderColor: 'var(--theme-border)',
                          color: 'var(--theme-text-muted)',
                        }}
                      >
                        {capabilityLabel[capability]}
                      </span>
                    ))}
                  </div>

                  {pluginEntry.activationMode !== 'hosted' ? (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => onToggleApproval(plugin.id)}
                        className="rounded-full border px-3 py-1 text-[11px] font-medium transition"
                        style={{
                          borderColor:
                            catalogState.runtimeStatus === 'reviewed'
                              ? 'rgba(34,197,94,0.25)'
                              : 'rgba(245,158,11,0.25)',
                          color:
                            catalogState.runtimeStatus === 'reviewed'
                              ? 'rgb(74 222 128)'
                              : 'rgb(252 211 77)',
                        }}
                      >
                        {catalogState.runtimeStatus === 'reviewed'
                          ? 'Revoke review approval'
                          : 'Mark reviewed'}
                      </button>
                    </div>
                  ) : null}

                  {pluginEntry.statusNote ? (
                    <div
                      className="mt-2 rounded-md border px-2.5 py-2 text-xs"
                      style={{
                        borderColor: 'var(--theme-border)',
                        backgroundColor: 'var(--theme-bg-secondary)',
                        color: 'var(--theme-text-secondary)',
                      }}
                    >
                      {pluginEntry.statusNote}
                    </div>
                  ) : null}

                  {incompatibleReason ? (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/8 px-2.5 py-2 text-xs text-amber-300">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      <div>
                        <div className="font-medium">Unavailable in this app version</div>
                        <div className="mt-0.5 opacity-80">{incompatibleReason}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/6 px-2.5 py-2 text-xs text-emerald-300/90">
                      <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
                      <div>{catalogState.summary}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
