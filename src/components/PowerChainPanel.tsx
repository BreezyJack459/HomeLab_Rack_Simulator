import { BatteryCharging, Cable, ChevronDown, ChevronRight, Plug, ShieldAlert, ShieldCheck, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import {
  buildPowerChains,
  checkPowerRedundancy,
  formatWatts,
  getDeviceCapacityW,
  getCircuitLoads,
  getPduOutletUsage,
  isPowerSource,
} from '../utils/powerChain';
import type { PowerChainNode } from '../utils/powerChain';
import type { PlacedDevice } from '../types/rack';

function CapacityBar({ used, capacity }: { used: number; capacity: number }) {
  const pct = Math.min(100, Math.max(0, (used / capacity) * 100));
  const color =
    pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : pct > 50 ? 'bg-yellow-400' : 'bg-emerald-500';
  return (
    <div className="mt-1">
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>{Math.round(pct)}%</span>
        <span>
          {formatWatts(used)} / {formatWatts(capacity)}
        </span>
      </div>
      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function OutletBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0;
  const color = pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-cyan-500';
  return (
    <div className="mt-1">
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>Outlets</span>
        <span>
          {used} / {total}
        </span>
      </div>
      <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-slate-800">
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
      {isRedundant ? 'Redundant' : 'Single feed'}
    </span>
  );
}

function NodeRow({
  node,
  depth,
  redundancyMap,
}: {
  node: PowerChainNode;
  depth: number;
  redundancyMap: Map<string, boolean>;
}) {
  const selectDevice = useRackStore((state) => state.selectDevice);
  const selectCable = useRackStore((state) => state.selectCable);
  const [expanded, setExpanded] = useState(true);

  const hasChildren = node.children.length > 0;
  const capacity = getDeviceCapacityW(node.device);
  const isOverCapacity = capacity !== undefined && node.totalW > capacity;
  const isSource = isPowerSource(node.device);
  const outletUsage = isSource ? getPduOutletUsage(useRackStore.getState().layout, node.device.id) : null;

  const iconByCategory = (cat: string) => {
    if (cat === 'ups') return <BatteryCharging size={14} className="text-amber-400" />;
    if (cat === 'pdu' || cat === 'pdu-0u') return <Plug size={14} className="text-orange-400" />;
    return <Zap size={14} className="text-slate-400" />;
  };

  const isRedundant = redundancyMap.get(node.device.id) ?? false;
  const showRedundancy = (node.device.ports?.power ?? 0) >= 2;

  return (
    <div>
      <div
        className={`flex w-full cursor-pointer items-center gap-2 rounded-md border p-2.5 text-left transition hover:bg-slate-800/60 ${
          isOverCapacity ? 'border-red-500/40 bg-red-500/5' : 'border-slate-800 bg-slate-950/50'
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
            className="shrink-0 text-slate-500 hover:text-slate-300"
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
            <div className="truncate text-xs font-medium text-slate-200">{node.device.name}</div>
            {isSource && <CircuitBadge circuit={node.device.circuit} />}
            {showRedundancy && <RedundancyBadge isRedundant={isRedundant} />}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
            <span>{formatWatts(node.loadW)}</span>
            {node.downstreamW > 0 && (
              <>
                <span>·</span>
                <span className="text-slate-400">downstream {formatWatts(node.downstreamW)}</span>
              </>
            )}
            <span>·</span>
            <span className="font-semibold text-slate-300">total {formatWatts(node.totalW)}</span>
          </div>
          {capacity !== undefined && <CapacityBar used={node.totalW} capacity={capacity} />}
          {outletUsage && <OutletBar used={outletUsage.usedOutlets} total={outletUsage.totalOutlets} />}
        </div>

        {node.cable && (
          <button
            className="shrink-0 text-slate-600 hover:text-slate-400"
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

      {expanded && hasChildren && (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => (
            <NodeRow key={child.device.id} node={child} depth={depth + 1} redundancyMap={redundancyMap} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PowerChainPanel() {
  const layout = useRackStore((state) => state.layout);
  const chains = useMemo(() => buildPowerChains(layout), [layout]);
  const circuitLoads = useMemo(() => getCircuitLoads(layout), [layout]);
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
  const totalPowerCableW = layout.cables
    .filter((c) => c.type === 'power')
    .reduce((sum, c) => {
      const from = deviceById.get(c.fromDeviceId);
      const to = deviceById.get(c.toDeviceId);
      const consumer = from && !isPowerSource(from) ? from : to && !isPowerSource(to) ? to : null;
      return sum + (consumer?.powerW ?? 0);
    }, 0);

  const [isOpen, setIsOpen] = useState(true);
  const safeBreakerPct = 80;

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/78 p-4">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="mb-3 flex w-full items-center justify-between gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400 transition hover:text-slate-200"
      >
        <div className="flex items-center gap-2">
          <BatteryCharging size={15} />
          Power Chain
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-950 px-2 py-1 text-xs text-slate-300">
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
            <div className="rounded-md border border-slate-800 bg-slate-950 p-2">
              <div className="text-slate-500">Total devices</div>
              <div className="mt-1 font-semibold text-white">{formatWatts(totalDevicePower)}</div>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950 p-2">
              <div className="text-slate-500">Cabled load</div>
              <div className="mt-1 font-semibold text-white">{formatWatts(totalPowerCableW)}</div>
            </div>
          </div>

          {circuitLoads.some((c) => c.sources.length > 0) && (
            <div className="mb-3 space-y-2">
              {circuitLoads.map((cl) => {
                if (cl.sources.length === 0) return null;
                const totalCapacity = cl.sources.reduce((sum, s) => sum + (getDeviceCapacityW(s) ?? 0), 0);
                const pct = totalCapacity > 0 ? (cl.totalW / totalCapacity) * 100 : 0;
                const overSafe = pct > safeBreakerPct;
                return (
                  <div
                    key={cl.circuit}
                    className="rounded-md border p-2"
                    style={{
                      backgroundColor: 'var(--theme-bg-input)',
                      borderColor: overSafe ? 'rgba(239,68,68,0.4)' : 'var(--theme-border)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CircuitBadge circuit={cl.circuit} />
                        <span className="text-xs text-slate-500">{cl.sources.length} source(s)</span>
                      </div>
                      <span className="text-xs font-semibold text-white">
                        {formatWatts(cl.totalW)} / {formatWatts(totalCapacity)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full ${overSafe ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    {overSafe && (
                      <div className="mt-1 text-[10px] text-red-400">
                        Exceeds {safeBreakerPct}% safe breaker utilization
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {chains.length === 0 ? (
            <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-500">
              No power sources (UPS/PDU) found. Add a UPS or PDU and connect power cables to build a power chain.
            </div>
          ) : (
            <div className="space-y-3">
              {chains.map((chain, idx) => (
                <div key={`${chain.root.device.id}-${idx}`}>
                  <NodeRow node={chain.root} depth={0} redundancyMap={redundancyMap} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
