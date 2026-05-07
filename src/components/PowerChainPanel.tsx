import { BatteryCharging, Cable, ChevronDown, ChevronRight, Plug, Zap } from 'lucide-react';
import { useState } from 'react';
import { useRackStore } from '../store/rackStore';
import { buildPowerChains, formatWatts, getDeviceCapacityW } from '../utils/powerChain';
import type { PowerChainNode } from '../utils/powerChain';
import { ENABLE_ZERO_U_PDU } from '../utils/featureFlags';

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

function NodeRow({
  node,
  depth,
}: {
  node: PowerChainNode;
  depth: number;
}) {
  const selectDevice = useRackStore((state) => state.selectDevice);
  const selectCable = useRackStore((state) => state.selectCable);
  const [expanded, setExpanded] = useState(true);

  const hasChildren = node.children.length > 0;
  const capacity = getDeviceCapacityW(node.device);
  const isOverCapacity = capacity !== undefined && node.totalW > capacity;

  const iconByCategory = (cat: string) => {
    if (cat === 'ups') return <BatteryCharging size={14} className="text-amber-400" />;
    if (cat === 'pdu' || (ENABLE_ZERO_U_PDU && cat === 'pdu-0u')) return <Plug size={14} className="text-orange-400" />;
    return <Zap size={14} className="text-slate-400" />;
  };

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
          <div className="truncate text-xs font-medium text-slate-200">{node.device.name}</div>
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
          {capacity !== undefined && (
            <CapacityBar used={node.totalW} capacity={capacity} />
          )}
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
            <NodeRow key={child.device.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PowerChainPanel() {
  const layout = useRackStore((state) => state.layout);
  const chains = buildPowerChains(layout);

  const totalDevicePower = layout.devices.reduce((sum, d) => sum + d.powerW, 0);
  const totalPowerCableW = layout.cables
    .filter((c) => c.type === 'power')
    .reduce((sum, c) => {
      const from = layout.devices.find((d) => d.id === c.fromDeviceId);
      const to = layout.devices.find((d) => d.id === c.toDeviceId);
      // Add the consuming device's power (avoid double counting sources)
      const consumer = from && !isPowerSource(from) ? from : to && !isPowerSource(to) ? to : null;
      return sum + (consumer?.powerW ?? 0);
    }, 0);

  function isPowerSource(d: { category: string }) {
    return d.category === 'ups' || d.category === 'pdu' || (ENABLE_ZERO_U_PDU && d.category === 'pdu-0u');
  }

  const [isOpen, setIsOpen] = useState(true);

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

      {chains.length === 0 ? (
        <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-500">
          No power sources (UPS/PDU) found. Add a UPS or PDU and connect power cables to build a power chain.
        </div>
      ) : (
        <div className="space-y-3">
          {chains.map((chain, idx) => (
            <div key={`${chain.root.device.id}-${idx}`}>
              <NodeRow node={chain.root} depth={0} />
            </div>
          ))}
        </div>
      )}
      </div>
      </div>
    </section>
  );
}
