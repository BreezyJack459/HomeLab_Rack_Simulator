import { needsPowerReview } from '../utils/powerAssumptions';
import { simulateWorkspaceOutletFailure } from '../utils/poeFailure';
import { projectPoeInputLoads } from '../utils/poeLoad';
import { AlertTriangle, BatteryCharging, Cable, ChevronDown, ChevronRight, Plug, ShieldAlert, ShieldCheck, X, Zap } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import {
  buildPowerChains,
  buildPowerTopology,
  checkPowerRedundancy,
  formatWatts,
  getDeviceCapacityW,
  getCircuitLoads,
  getPduOutletMap,
  getPduOutletUsage,
  isPowerSource,
  validatePduOutletAssignments,
} from '../utils/powerChain';
import type { PowerChainNode } from '../utils/powerChain';
import type { PlacedDevice } from '../types/rack';

const EnergySummary = lazy(() => import('./EnergySummary').then(m => ({ default: m.EnergySummary })));
const UpsRuntimePanel = lazy(() => import('./UpsRuntimePanel').then(m => ({ default: m.UpsRuntimePanel })));
const PoeBudgetPanel = lazy(() => import('./PoeBudgetPanel').then(m => ({ default: m.PoeBudgetPanel })));

function CapacityBar({ used, capacity, unverified, name }: { used: number; capacity: number; unverified: boolean; name: string }) {
  const pct = Math.max(0, (used / capacity) * 100);
  const status = used > capacity ? 'critical' : unverified ? 'unverified' : 'recorded';
  const color =
    unverified && used <= capacity ? 'bg-amber-500' : pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : pct > 50 ? 'bg-yellow-400' : 'bg-emerald-500';
  return (
    <div className="mt-1" role="group" aria-label={`${name} output capacity`} data-status={status}>
      {unverified && <p className="text-xs text-amber-400">Load or wiring needs review; available capacity is not verified.</p>}
      <div className="flex items-center justify-between text-[10px] text-content-faint">
        <span>{Math.round(pct)}% recorded load</span>
        <span>
          {formatWatts(used)} / {formatWatts(capacity)}
        </span>
      </div>
      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-fill-strong dark:bg-fill">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

function OutletBar({ used, total }: { used: number; total: number | null }) {
  if (total === null) return <p className="mt-1 text-xs text-amber-400">Outlet count unknown — free sockets unverified. {used} recorded socket assignments.</p>;
  const pct = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0;
  const color = pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-accent-solid';
  return (
    <div className="mt-1">
      <div className="flex items-center justify-between text-[10px] text-content-faint">
        <span>Outlets</span>
        <span>
          {used} / {total}
        </span>
      </div>
      <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-fill-strong dark:bg-fill">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CircuitBadge({ circuit }: { circuit?: 'A' | 'B' }) {
  if (!circuit) return null;
  return (
    <span
      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{
        backgroundColor: circuit === 'A' ? 'rgba(59,130,246,0.15)' : 'rgba(168,85,247,0.15)',
        color: circuit === 'A' ? '#60a5fa' : '#c084fc',
        border: `1px solid ${circuit === 'A' ? 'rgba(59,130,246,0.3)' : 'rgba(168,85,247,0.3)'}`,
      }}
    >
      Circuit {circuit}
    </span>
  );
}

function RedundancyBadge({ isRedundant }: { isRedundant: boolean }) {
  return (
    <span className="shrink-0 flex items-center gap-1 text-[10px]" style={{ color: isRedundant ? '#34d399' : '#fbbf24' }}>
      {isRedundant ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
      {isRedundant ? 'A/B paths modeled' : 'A/B paths unverified'}
    </span>
  );
}

function OutletGrid({ pduId, circuit }: { pduId: string; circuit?: 'A' | 'B' }) {
  const layout = useRackStore((state) => state.layout);
  const selectDevice = useRackStore((state) => state.selectDevice);
  const workspace = useRackStore(state => state.workspace);
  const projection = useMemo(() => projectPoeInputLoads(layout, workspace), [layout, workspace]);
  const outlets = useMemo(() => getPduOutletMap(projection.layout, pduId), [projection, pduId]);
  const [simOutlet, setSimOutlet] = useState<number | null>(null);
  const simResult = useMemo<ReturnType<typeof simulateWorkspaceOutletFailure>>(() => {
    if (simOutlet === null) return null;
    return simulateWorkspaceOutletFailure(layout, pduId, simOutlet, workspace);
  }, [layout, workspace, pduId, simOutlet]);
  const issues = useMemo(() => validatePduOutletAssignments(layout).filter((i) => i.pduId === pduId), [layout, pduId]);

  const cols = outlets.length <= 8 ? 4 : outlets.length <= 12 ? 4 : 6;

  return (
    <div className="mt-2">
      <div className="mb-1.5 flex flex-wrap gap-1">
        {outlets.map((o) => {
          const issue = issues.find((i) => i.outletIndex === o.outletIndex);
          const isUsed = o.assignedDeviceId !== null;
          const base = 'flex h-7 w-7 items-center justify-center rounded text-[10px] font-medium transition';
          const color = issue
            ? 'bg-red-500/15 text-red-500 border border-red-500/30'
            : isUsed
              ? circuit === 'A'
                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                : circuit === 'B'
                  ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                  : 'bg-accent-solid/15 text-accent border border-accent/30'
              : 'bg-fill-strong text-content-faint dark:bg-fill dark:text-content-faint';
          return (
            <button
              key={o.outletIndex}
              className={`${base} ${color} ${isUsed ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
              onClick={() => {
                if (isUsed) setSimOutlet(o.outletIndex);
              }}
              title={
                issue
                  ? `${issue.detail}`
                  : o.assignedDeviceName
                    ? `Outlet ${o.outletIndex + 1}: ${o.assignedDeviceName} · ${formatWatts(o.loadW)}`
                    : `Outlet ${o.outletIndex + 1} · Free`
              }
              type="button"
            >
              {o.outletIndex + 1}
            </button>
          );
        })}
      </div>
      {simResult && (
        <div className="relative rounded-md border border-red-500/30 bg-red-500/5 p-2.5">
          <button
            className="absolute right-1.5 top-1.5 text-content-faint hover:text-content-secondary dark:text-content-faint dark:hover:text-content-secondary"
            onClick={() => setSimOutlet(null)}
            type="button"
          >
            <X size={12} />
          </button>
          <div className="flex items-center gap-1.5 text-xs font-medium text-red-400">
            <AlertTriangle size={12} />
            Wired supply failure: Outlet {simResult.outletIndex + 1}
          </div>
          {simResult.warnings.map((warning, index) => <p key={index} className="mt-1 text-xs text-amber-400">{warning}</p>)}
          {simResult.survivingDevices.length > 0 && <p className="mt-1 text-xs text-content-muted">Still reachable through another supply path: {simResult.survivingDevices.map(d => d.name).join(', ')}</p>}
          <div className="mt-2 space-y-1 border-t border-edge pt-2" aria-label="Remaining supply capacity">
            <p className="text-xs font-medium text-content">Remaining supply output checks</p>
            {simResult.remainingSupplies.map(supply => (
              <p key={supply.id} className={`text-xs ${supply.status === 'overload' ? 'text-red-400' : supply.status === 'unknown' ? 'text-amber-400' : 'text-content-muted'}`}>
                {supply.name}: {formatWatts(supply.loadW)} output load — {supply.capacityW === undefined
                  ? 'rating unknown; capacity not verified'
                  : supply.status === 'overload'
                    ? `exceeds ${formatWatts(supply.capacityW)} rating by ${formatWatts(supply.loadW - supply.capacityW)}`
                    : supply.status === 'unknown'
                      ? `Load or wiring unverified; cannot confirm fit within ${formatWatts(supply.capacityW)} rating`
                      : `within recorded ${formatWatts(supply.capacityW)} rating`}
              </p>
            ))}
            {simResult.remainingSupplies.length === 0 && <p className="text-xs text-content-muted">No live supply outputs available to check.</p>}
          </div>
          {(simResult.poe.lost.length > 0 || simResult.poe.retained.length > 0 || simResult.poe.untraced.length > 0) && <section aria-label="PoE receivers affected by outlet failure" className="mt-2 space-y-1 border-t border-edge pt-2 text-xs">
            <p className="font-medium text-content">Downstream PoE receiver paths across racks</p>
            <p className="text-red-400">Lose recorded supply path: {simResult.poe.lost.map(d => d.name).join(', ') || 'None'}</p>
            <p className="text-content-muted">Retain another recorded path: {simResult.poe.retained.map(d => d.name).join(', ') || 'None'}</p>
            <p className="text-amber-400">No upstream path before failure: {simResult.poe.untraced.map(d => d.name).join(', ') || 'None'}</p>
            <p className="text-content-muted">Path presence is conditional on the warnings above. Receiver watts are already represented at the PoE source; do not add them to the wired load again.</p>
          </section>}
          {simResult.affectedDevices.length === 0 && simResult.downstreamDevices.length === 0 ? (
            <div className="mt-1 text-[10px] text-content-faint">{simResult.totalLostW > 0 ? 'Devices retain another recorded supply path; the failed wired feed is still unavailable.' : 'No additional devices lose their modeled wired supply.'}</div>
          ) : (
            <div className="mt-1.5 space-y-1">
              {simResult.affectedDevices.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-[10px]">
                  <button
                    className="text-left text-content-secondary hover:text-content-secondary dark:hover:text-content"
                    onClick={() => selectDevice(d.id)}
                    type="button"
                  >
                    {d.name}
                  </button>
                  <span className="text-content-faint">{formatWatts(d.powerW)}</span>
                </div>
              ))}
              {simResult.downstreamDevices.length > 0 && (
                <div className="mt-1 border-t border-edge pt-1 dark:border-edge">
                  <div className="mb-1 text-[10px] text-content-faint">Downstream</div>
                  {simResult.downstreamDevices.map((d) => (
                    <div key={d.id} className="flex items-center justify-between text-[10px]">
                      <button
                        className="text-left text-content-secondary hover:text-content-secondary dark:hover:text-content"
                        onClick={() => selectDevice(d.id)}
                        type="button"
                      >
                        {d.name}
                      </button>
                      <span className="text-content-faint">{formatWatts(d.powerW)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between border-t border-edge pt-1 text-[10px] font-medium dark:border-edge">
                <span className="text-content-muted">Load losing wired supply</span>
                <span className="text-red-400">{formatWatts(simResult.totalLostW)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NodeRow({
  node,
  depth,
  redundancyMap,
  unverifiedIds,
  wiringUnverified,
}: {
  node: PowerChainNode;
  depth: number;
  redundancyMap: Map<string, boolean>;
  unverifiedIds: Set<string>;
  wiringUnverified: boolean;
}) {
  const selectDevice = useRackStore((state) => state.selectDevice);
  const selectCable = useRackStore((state) => state.selectCable);
  const [expanded, setExpanded] = useState(true);

  const hasChildren = node.children.length > 0;
  const capacity = getDeviceCapacityW(node.device);
  const hasUnverifiedLoad = (current: PowerChainNode): boolean => unverifiedIds.has(current.device.id) || needsPowerReview(current.device) || current.children.some(hasUnverifiedLoad);
  const unverified = wiringUnverified || hasUnverifiedLoad(node);
  const isOverCapacity = capacity !== undefined && node.downstreamW > capacity;
  const isSource = isPowerSource(node.device);
  const outletUsage = isSource ? getPduOutletUsage(useRackStore.getState().layout, node.device.id) : null;

  const iconByCategory = (cat: string) => {
    if (cat === 'ups') return <BatteryCharging size={14} className="text-amber-400" />;
    if (cat === 'pdu' || cat === 'pdu-0u') return <Plug size={14} className="text-orange-400" />;
    return <Zap size={14} className="text-content-muted" />;
  };

  const isRedundant = redundancyMap.get(node.device.id) ?? false;
  const showRedundancy = (node.device.ports?.power ?? 0) >= 2;

  return (
    <div>
      <div
        className={`flex w-full cursor-pointer items-center gap-2 rounded-md border p-2.5 text-left transition hover:bg-fill-strong/60 dark:hover:bg-fill/60 ${
          isOverCapacity ? 'border-red-500/40 bg-red-500/5' : 'border-edge bg-fill/50 dark:border-edge dark:bg-surface/50'
        }`}
        style={{ marginLeft: depth * 16 }}
        onClick={() => selectDevice(node.device.id)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          selectDevice(node.device.id);
        }}
        role="button"
        tabIndex={0}
      >
        {hasChildren && (
          <button
            className="shrink-0 text-content-faint hover:text-content-secondary dark:text-content-faint dark:hover:text-content-secondary"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            type="button"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
        {!hasChildren && <span className="w-[14px] shrink-0" />}

        <span className="shrink-0">{iconByCategory(node.device.category)}</span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-xs font-medium text-content-secondary dark:text-content">{node.device.name}</div>
            {isSource && <CircuitBadge circuit={node.device.circuit} />}
            {showRedundancy && <RedundancyBadge isRedundant={isRedundant} />}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-content-faint">
            <span>{formatWatts(node.loadW)}</span>
            {node.downstreamW > 0 && (
              <>
                <span>·</span>
                <span className="text-content-muted">downstream {formatWatts(node.downstreamW)}</span>
              </>
            )}
            <span>·</span>
            <span className="font-semibold text-content-secondary">total {formatWatts(node.totalW)}</span>
          </div>
          {capacity !== undefined && <CapacityBar used={node.downstreamW} capacity={capacity} unverified={unverified} name={node.device.name} />}
          {isSource && capacity === undefined && <p className="mt-1 text-xs text-amber-400">Output capacity unverified — enter the equipment rating in device properties.</p>}
          {outletUsage && <OutletBar used={outletUsage.usedOutlets} total={outletUsage.totalOutlets} />}
        </div>

        {node.cable && (
          <button
            className="shrink-0 text-content-faint hover:text-content-muted dark:text-content-faint dark:hover:text-content-muted"
            onClick={(e) => {
              e.stopPropagation();
              selectCable(node.cable!.id);
            }}
            title="Select cable"
            type="button"
          >
            <Cable size={13} />
          </button>
        )}
      </div>

      {expanded && isSource && (
        <div style={{ marginLeft: depth * 16 + 24 }}>
          <OutletGrid pduId={node.device.id} circuit={node.device.circuit} />
        </div>
      )}
      {expanded && hasChildren && (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => (
            <NodeRow key={child.device.id} node={child} depth={depth + 1} redundancyMap={redundancyMap} unverifiedIds={unverifiedIds} wiringUnverified={wiringUnverified} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PowerChainPanel() {
  const layout = useRackStore((state) => state.layout);
  const workspace = useRackStore(state => state.workspace);
  const projection = useMemo(() => projectPoeInputLoads(layout, workspace), [layout, workspace]);
  const topologyWarnings = useMemo(() => buildPowerTopology(layout).warnings, [layout]);
  const unverifiedIds = useMemo(() => new Set(projection.warnings.keys()), [projection]);
  const chains = useMemo(() => buildPowerChains(projection.layout), [projection]);
  const circuitLoads = useMemo(() => getCircuitLoads(projection.layout), [projection]);
  const redundancyResults = useMemo(() => checkPowerRedundancy(layout), [layout]);

  const redundancyMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const r of redundancyResults) {
      map.set(r.device.id, r.isRedundant);
    }
    return map;
  }, [redundancyResults]);

  const totalDevicePower = layout.devices.reduce((sum, d) => sum + d.powerW, 0);
  const deviceById = useMemo(() => {
    const map = new Map<string, PlacedDevice>();
    for (const d of layout.devices) map.set(d.id, d);
    return map;
  }, [layout.devices]);
  const connectedConsumers = new Set(layout.cables.filter(c => c.type === 'power').flatMap(c => [c.fromDeviceId, c.toDeviceId]));
  const totalPowerCableW = [...connectedConsumers].reduce((sum, id) => {
    const device = deviceById.get(id);
    return sum + (device && !isPowerSource(device) ? device.powerW : 0);
  }, 0);

  const [isOpen, setIsOpen] = useState(true);

  return (
    <section className="rounded-lg border border-edge bg-fill/78 p-4 dark:border-edge dark:bg-surface-raised/78">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="mb-3 flex w-full items-center justify-between gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-content-muted transition hover:text-content-secondary dark:text-content-muted dark:hover:text-content"
      >
        <div className="flex items-center gap-2">
          <BatteryCharging size={15} />
          Power Chain
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-fill px-2 py-1 text-xs text-content-secondary dark:bg-surface dark:text-content-secondary">
            {chains.length ? `${chains.length} source${chains.length === 1 ? '' : 's'}` : 'None'}
          </span>
          <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
        </div>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="mb-3 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-md border border-edge bg-fill p-2 dark:border-edge dark:bg-surface">
              <div className="text-content-faint">Total devices</div>
              <div className="mt-1 font-semibold text-content">{formatWatts(totalDevicePower)}</div>
            </div>
            <div className="rounded-md border border-edge bg-fill p-2 dark:border-edge dark:bg-surface">
              <div className="text-content-faint">Cabled load</div>
              <div className="mt-1 font-semibold text-content">{formatWatts(totalPowerCableW)}</div>
            </div>
          </div>

          {topologyWarnings.map((warning, i) => <p key={i} className="mb-2 text-xs text-amber-400">{warning}</p>)}
          {!!projection.warnings.size && <div className="mb-3 text-xs text-amber-400"><p>PoE input totals are incomplete or unverified. Resolve these before relying on supply capacity:</p>{[...projection.warnings.values()].flat().map((w, i) => <p key={i}>{w}</p>)}</div>}
          <p className="mb-3 text-xs text-content-muted">Supply chains and circuit loads include declared PoE input assumptions. Device totals above are the raw planning values; they are not a wall-input measurement.</p>
          {circuitLoads.some((c) => c.sources.length > 0) && (
            <div className="mb-3 space-y-2">
              {circuitLoads.map((cl) => {
                if (cl.sources.length === 0) return null;
                return (
                  <div
                    key={cl.circuit}
                    className="rounded-md border p-2"
                    style={{
                      backgroundColor: 'var(--theme-bg-input)',
                      borderColor: 'var(--theme-border)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CircuitBadge circuit={cl.circuit} />
                        <span className="text-xs text-content-faint">{cl.sources.length} source(s)</span>
                      </div>
                      <span className="text-xs font-semibold text-content">
                        {formatWatts(cl.totalW)} estimated load
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-content-muted">Full reachable consumer load per circuit; A/B totals may include the same dual-fed device. Load sharing and breaker capacity are unverified.</p>
                  </div>
                );
              })}
            </div>
          )}

          {chains.length === 0 ? (
            <div className="rounded-md border border-edge bg-fill/60 p-3 text-xs text-content-faint dark:border-edge dark:bg-surface/60 dark:text-content-faint">
              No power sources (UPS/PDU) found. Add a UPS or PDU and connect power cables to build a power chain.
            </div>
          ) : (
            <div className="space-y-3">
              {chains.map((chain, idx) => (
                <div key={`${chain.root.device.id}-${idx}`}>
                  <NodeRow node={chain.root} depth={0} redundancyMap={redundancyMap} unverifiedIds={unverifiedIds} wiringUnverified={topologyWarnings.length > 0} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {layout.devices.some(d => d.category === 'ups') && <Suspense fallback={null}><UpsRuntimePanel /></Suspense>}
      <Suspense fallback={null}><PoeBudgetPanel /></Suspense>
      <Suspense fallback={null}><EnergySummary layout={layout} onRateChange={rate => useRackStore.getState().updateRack({ electricityRatePerKwh: rate })} /></Suspense>
    </section>
  );
}
