import { ArrowRightLeft, ClipboardList } from 'lucide-react';
import { useMemo } from 'react';
import { useRackStore } from '../store/rackStore';

export function MigrationSummaryPanel() {
  const layout = useRackStore((state) => state.layout);

  const summary = useMemo(() => {
    const plannedDevices = layout.devices.filter((d) => d.lifecycleStatus === 'planned');
    const activeDevices = layout.devices.filter((d) => !d.lifecycleStatus || d.lifecycleStatus === 'active');
    const decommissioningDevices = layout.devices.filter((d) => d.lifecycleStatus === 'decommissioning');

    const plannedCables = layout.cables.filter((c) => c.lifecycleStatus === 'planned');
    const activeCables = layout.cables.filter((c) => !c.lifecycleStatus || c.lifecycleStatus === 'active');
    const decommissioningCables = layout.cables.filter((c) => c.lifecycleStatus === 'decommissioning');

    return {
      plannedDevices,
      activeDevices,
      decommissioningDevices,
      plannedCables,
      activeCables,
      decommissioningCables,
    };
  }, [layout]);

  const hasMigration = summary.plannedDevices.length > 0 || summary.decommissioningDevices.length > 0;

  return (
    <section
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--theme-bg-secondary)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-text-muted)' }}>
        <ArrowRightLeft size={14} />
        Migration Summary
      </div>

      {!hasMigration ? (
        <div className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
          No migration in progress. Set devices to Planned or Decommissioning to build a migration plan.
        </div>
      ) : (
        <div className="space-y-2">
          {summary.plannedDevices.length > 0 && (
            <div className="rounded border p-2" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}>
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--theme-text-muted)' }}>
                <ClipboardList size={10} />
                To install ({summary.plannedDevices.length})
              </div>
              <div className="space-y-0.5 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                {summary.plannedDevices.map((d) => (
                  <div key={d.id} className="truncate">{d.name}</div>
                ))}
              </div>
            </div>
          )}

          {summary.decommissioningDevices.length > 0 && (
            <div className="rounded border p-2" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}>
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--theme-text-muted)' }}>
                <ClipboardList size={10} />
                To remove ({summary.decommissioningDevices.length})
              </div>
              <div className="space-y-0.5 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                {summary.decommissioningDevices.map((d) => (
                  <div key={d.id} className="truncate">{d.name}</div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-2 flex items-center justify-between text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            <span>Active</span>
            <span>{summary.activeDevices.length} devices / {summary.activeCables.length} cables</span>
          </div>
        </div>
      )}
    </section>
  );
}
