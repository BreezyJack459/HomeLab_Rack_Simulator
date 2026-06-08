import { AlertTriangle, Clock, Power, Route, Server } from 'lucide-react';
import { useRackStore } from '../store/rackStore';
import { analyzeBootOrder, formatBootTime } from '../utils/bootOrder';

export function BootSequencePanel() {
  const layout = useRackStore((state) => state.layout);
  const selectDevice = useRackStore((state) => state.selectDevice);
  const analysis = analyzeBootOrder(layout);

  const hasData = layout.devices.some(
    (d) => d.category !== 'blank' && d.category !== 'cable-management'
  );

  return (
    <section
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--theme-bg-secondary)',
        borderColor: 'var(--theme-border)'
      }}
    >
      <div
        className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]"
        style={{ color: 'var(--theme-text-muted)' }}
      >
        <Power size={15} />
        Boot Sequence
      </div>

      {!hasData && (
        <div className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
          No rackmount devices in this layout. Add devices to see boot dependency analysis.
        </div>
      )}

      {hasData && analysis.cycles.length > 0 && (
        <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 p-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-300">
            <AlertTriangle size={13} />
            Circular dependencies detected
          </div>
          {analysis.cycles.map((cycle, idx) => (
            <div key={idx} className="text-xs text-red-600 dark:text-red-400">
              {cycle.map((id, i) => {
                const device = layout.devices.find((d) => d.id === id);
                return (
                  <span key={id}>
                    {i > 0 && <span className="mx-1 text-red-400">→</span>}
                    <span className="font-medium">{device?.name ?? id.slice(0, 8)}</span>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {hasData && analysis.cycles.length === 0 && analysis.sequence.length > 0 && (
        <>
          {/* Total recovery time */}
          <div
            className="mb-3 flex items-center justify-between rounded-md border p-2.5"
            style={{
              backgroundColor: 'var(--theme-bg)',
              borderColor: 'var(--theme-border)'
            }}
          >
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
              <Clock size={13} />
              Total recovery time
            </div>
            <div className="text-lg font-semibold" style={{ color: 'var(--theme-text)' }}>
              {formatBootTime(analysis.totalTime)}
            </div>
          </div>

          {/* Critical path */}
          {analysis.criticalPath.length > 1 && (
            <div className="mb-3">
              <div
                className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                <Route size={11} />
                Critical path
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {analysis.criticalPath.map((deviceId, idx) => {
                  const device = layout.devices.find((d) => d.id === deviceId);
                  return (
                    <span key={deviceId} className="flex items-center gap-1">
                      {idx > 0 && (
                        <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
                          →
                        </span>
                      )}
                      <button
                        onClick={() => selectDevice(deviceId)}
                        className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-500/25 dark:text-amber-300"
                        type="button"
                      >
                        {device?.name ?? deviceId.slice(0, 8)}
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Boot levels */}
          <div className="space-y-2.5">
            {analysis.levels.map((levelNodes, levelIdx) => (
              <div key={levelIdx}>
                <div
                  className="mb-1 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  Stage {levelIdx + 1}
                  {levelNodes[0]?.level === -1 && (
                    <span className="ml-1.5 text-red-500">(cycle)</span>
                  )}
                </div>
                <div className="space-y-1">
                  {levelNodes.map((node) => {
                    const isCritical = analysis.criticalPath.includes(node.deviceId);
                    return (
                      <button
                        key={node.deviceId}
                        onClick={() => selectDevice(node.deviceId)}
                        className={`flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left transition hover:opacity-80 ${
                          isCritical
                            ? 'border-amber-500/30 bg-amber-500/10'
                            : ''
                        }`}
                        style={
                          !isCritical
                            ? {
                                backgroundColor: 'var(--theme-bg)',
                                borderColor: 'var(--theme-border)'
                              }
                            : undefined
                        }
                        type="button"
                      >
                        <div className="flex items-center gap-2">
                          <Server
                            size={12}
                            style={{ color: 'var(--theme-text-muted)' }}
                          />
                          <span className="text-xs font-medium" style={{ color: 'var(--theme-text)' }}>
                            {node.deviceName}
                          </span>
                          {node.dependencies.length > 0 && (
                            <span
                              className="text-[10px]"
                              style={{ color: 'var(--theme-text-muted)' }}
                            >
                              ({node.dependencies.length} dep{node.dependencies.length > 1 ? 's' : ''})
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>
                          t={node.startTime}s
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {analysis.sequence.length === 0 && (
            <div className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
              All devices are involved in circular dependencies. Fix dependencies to see boot sequence.
            </div>
          )}
        </>
      )}

      {hasData && analysis.sequence.length === 0 && analysis.cycles.length === 0 && (
        <div className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
          No boot dependencies configured. Use the Property Panel to set which devices must boot before others.
        </div>
      )}
    </section>
  );
}
