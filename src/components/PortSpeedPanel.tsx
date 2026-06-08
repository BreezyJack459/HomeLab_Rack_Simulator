import { Download, Gauge, ShieldAlert } from 'lucide-react';
import { useMemo } from 'react';
import { useRackStore } from '../store/rackStore';
import {
  exportPortSpeedMarkdown,
  findSpeedMismatches,
  getCableSpeedEntries,
  getDevicePortSpeeds,
  summarizePortSpeeds,
} from '../utils/portSpeed';

export function PortSpeedPanel() {
  const layout = useRackStore((state) => state.layout);
  const devices = layout.devices;
  const cables = layout.cables;

  const portSpeeds = useMemo(() => getDevicePortSpeeds(devices), [devices]);
  const cableEntries = useMemo(() => getCableSpeedEntries(cables, devices), [cables, devices]);
  const mismatches = useMemo(() => findSpeedMismatches(cables, devices), [cables, devices]);
  const summary = useMemo(() => summarizePortSpeeds(devices, cables), [devices, cables]);

  const hasData = summary.portsWithSpeed > 0 || summary.cablesWithSpeed > 0;

  return (
    <section
      className="rounded-lg border p-4"
      style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border)' }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <Gauge size={15} />
          Port Speed / Media
        </div>
        <button
          type="button"
          onClick={() => {
            const md = exportPortSpeedMarkdown(devices, cables);
            const blob = new Blob([md], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'port-speed-report.md';
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
          style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
        >
          <Download size={11} />
          MD
        </button>
      </div>

      {/* Summary */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
            {summary.portsWithSpeed}
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Ports w/ Speed
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
            {summary.cablesWithSpeed}
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Cables w/ Speed
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className={`text-lg font-bold ${mismatches.length > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
            {mismatches.length}
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Mismatches
          </div>
        </div>
      </div>

      {/* Mismatches */}
      {mismatches.length > 0 && (
        <div className="mb-3 space-y-1">
          {mismatches.map((m) => (
            <div
              key={m.id}
              className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300"
            >
              <ShieldAlert size={12} className="inline mr-1" />
              <span className="font-medium">{m.title}:</span> {m.detail}
            </div>
          ))}
        </div>
      )}

      {/* Speed distribution */}
      {Object.keys(summary.speedCounts).length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Speed Distribution
          </div>
          <div className="space-y-1">
            {Object.entries(summary.speedCounts).map(([speed, count]) => (
              <div key={speed} className="flex items-center gap-2">
                <div className="w-12 shrink-0 text-[11px] font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                  {speed}
                </div>
                <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--theme-bg-primary)' }}>
                  <div
                    className="h-full rounded-full bg-cyan-500"
                    style={{ width: `${summary.totalPorts > 0 ? (count / summary.totalPorts) * 100 : 0}%` }}
                  />
                </div>
                <div className="w-6 text-right text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>
                  {count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Media distribution */}
      {Object.keys(summary.mediaCounts).length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Media Distribution
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(summary.mediaCounts).map(([media, count]) => (
              <span
                key={media}
                className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-700 dark:text-cyan-300"
              >
                {media}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Device ports table */}
      {portSpeeds.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Device Ports
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1 thin-scrollbar">
            {portSpeeds.map((p, idx) => (
              <div
                key={`${p.deviceId}-${p.face}-${p.portType}-${idx}`}
                className="flex items-center justify-between rounded border px-2 py-1 text-[11px]"
                style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
              >
                <span className="truncate" style={{ color: 'var(--theme-text-primary)' }}>
                  {p.deviceName}
                </span>
                <div className="flex gap-1.5">
                  {p.speed && (
                    <span className="rounded bg-cyan-500/10 px-1 py-0.5 text-[10px] text-cyan-700 dark:text-cyan-300">
                      {p.speed}
                    </span>
                  )}
                  {p.mediaType && (
                    <span className="rounded bg-violet-500/10 px-1 py-0.5 text-[10px] text-violet-700 dark:text-violet-300">
                      {p.mediaType}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cable entries */}
      {cableEntries.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Cables
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1 thin-scrollbar">
            {cableEntries.map((c) => (
              <div
                key={c.cableId}
                className="flex items-center justify-between rounded border px-2 py-1 text-[11px]"
                style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
              >
                <span className="truncate" style={{ color: 'var(--theme-text-primary)' }}>
                  {c.fromDevice} → {c.toDevice}
                </span>
                <div className="flex gap-1.5">
                  {c.speed && (
                    <span className="rounded bg-cyan-500/10 px-1 py-0.5 text-[10px] text-cyan-700 dark:text-cyan-300">
                      {c.speed}
                    </span>
                  )}
                  {c.mediaType && (
                    <span className="rounded bg-violet-500/10 px-1 py-0.5 text-[10px] text-violet-700 dark:text-violet-300">
                      {c.mediaType}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasData && (
        <div className="text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>
          No port speed or media type data set yet. Edit device port layouts or cable properties to add speed and media metadata.
        </div>
      )}
    </section>
  );
}
