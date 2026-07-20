import { BarChart3, FileText, Network, PlugZap } from 'lucide-react';
import { useRackStore } from '../store/rackStore';

export function RackReportsPanel() {
  const layout = useRackStore((state) => state.layout);
  const workspace = useRackStore((state) => state.workspace);

  const totalDevices = layout.devices.length;
  const totalCables = layout.cables.length;
  const workspaceRacks = workspace.racks.length;

  return (
    <section
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--theme-bg-secondary)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-text-muted)' }}>
        <FileText size={15} />
        Rack Reports
      </div>

      <p className="mb-4 text-xs leading-5" style={{ color: 'var(--theme-text-secondary)' }}>
        Local-package report workflow stub. This panel proves the host can promote a reviewed local package
        into a real plugin surface before arbitrary external bundles are allowed.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border p-3" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--theme-text-muted)' }}>
            <BarChart3 size={12} />
            Current Rack
          </div>
          <div className="mt-2 text-sm font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
            {totalDevices} devices
          </div>
          <div className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
            {totalCables} cables documented
          </div>
        </div>

        <div className="rounded-md border p-3" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--theme-text-muted)' }}>
            <Network size={12} />
            Workspace
          </div>
          <div className="mt-2 text-sm font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
            {workspaceRacks} racks
          </div>
          <div className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
            Ready for future multi-rack reporting exports
          </div>
        </div>
      </div>

      <div
        className="mt-4 rounded-md border px-3 py-2 text-xs"
        style={{
          borderColor: 'rgba(56,189,248,0.25)',
          backgroundColor: 'rgba(56,189,248,0.08)',
          color: 'rgb(186 230 253)',
        }}
      >
        <div className="flex items-center gap-2 font-medium">
          <PlugZap size={12} />
          Loader skeleton active
        </div>
        <div className="mt-1 opacity-80">
          This local plugin is served through a controlled host adapter, not arbitrary package execution.
        </div>
      </div>
    </section>
  );
}
