import {
  Download,
  Network,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { NetworkInterface, PlacedDevice } from '../types/rack';
import {
  detectIpConflicts,
  exportIpTableCsv,
  exportIpTableMarkdown,
  summarizeIpAssignments,
} from '../utils/ipAssignment';

function InterfaceRow({
  iface,
  onUpdate,
  onRemove,
  hasConflict,
}: {
  iface: NetworkInterface;
  onUpdate: (patch: Partial<NetworkInterface>) => void;
  onRemove: () => void;
  hasConflict: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-md border text-sm"
      style={{
        borderColor: hasConflict ? 'var(--theme-error, #ef4444)' : 'var(--theme-border)',
        backgroundColor: 'var(--theme-bg-primary)',
      }}
    >
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="opacity-70 transition hover:opacity-100"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <span className="text-[10px] opacity-60">{iface.name}</span>
        <span className="flex-1 truncate font-mono text-xs">
          {iface.staticIp ?? 'No IP'}
        </span>
        {iface.vlanId != null && (
          <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600 dark:text-purple-400">
            VLAN {iface.vlanId}
          </span>
        )}
        {iface.dhcpReservation && (
          <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-600 dark:text-cyan-400">
            DHCP
          </span>
        )}
        {hasConflict && (
          <AlertTriangle size={13} className="shrink-0 text-red-500" />
        )}
        <button
          type="button"
          onClick={onRemove}
          className="opacity-60 transition hover:opacity-100"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <Trash2 size={12} />
        </button>
      </div>
      {expanded && (
        <div
          className="grid grid-cols-2 gap-2 border-t px-3 py-2 text-xs"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">
              Interface Name
            </div>
            <input
              type="text"
              value={iface.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">
              MAC Address
            </div>
            <input
              type="text"
              value={iface.macAddress ?? ''}
              onChange={(e) =>
                onUpdate({ macAddress: e.target.value || undefined })
              }
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
              placeholder="00:11:22:33:44:55"
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">
              Static IP
            </div>
            <input
              type="text"
              value={iface.staticIp ?? ''}
              onChange={(e) =>
                onUpdate({ staticIp: e.target.value || undefined })
              }
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
              placeholder="192.168.1.100"
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">
              VLAN ID
            </div>
            <input
              type="number"
              min={1}
              max={4094}
              value={iface.vlanId ?? ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined;
                onUpdate({ vlanId: val });
              }}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">
              Subnet
            </div>
            <input
              type="text"
              value={iface.subnet ?? ''}
              onChange={(e) =>
                onUpdate({ subnet: e.target.value || undefined })
              }
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
              placeholder="255.255.255.0"
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">
              Gateway
            </div>
            <input
              type="text"
              value={iface.gateway ?? ''}
              onChange={(e) =>
                onUpdate({ gateway: e.target.value || undefined })
              }
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
              placeholder="192.168.1.1"
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">
              DNS
            </div>
            <input
              type="text"
              value={iface.dns ?? ''}
              onChange={(e) =>
                onUpdate({ dns: e.target.value || undefined })
              }
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
              placeholder="192.168.1.1, 8.8.8.8"
            />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-1.5 text-[11px]">
              <input
                type="checkbox"
                checked={iface.dhcpReservation ?? false}
                onChange={(e) =>
                  onUpdate({ dhcpReservation: e.target.checked })
                }
              />
              DHCP Reservation
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function DeviceInterfaceCard({
  device,
  onUpdate,
  conflictIps,
  conflictMacs,
}: {
  device: PlacedDevice;
  onUpdate: (patch: Partial<PlacedDevice>) => void;
  conflictIps: Set<string>;
  conflictMacs: Set<string>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const interfaces = device.networkInterfaces ?? [];

  function addInterface() {
    if (!name.trim()) return;
    const newIface: NetworkInterface = {
      id: `iface-${Date.now()}`,
      name: name.trim(),
    };
    onUpdate({ networkInterfaces: [...interfaces, newIface] });
    setName('');
    setShowForm(false);
  }

  function updateInterface(id: string, patch: Partial<NetworkInterface>) {
    onUpdate({
      networkInterfaces: interfaces.map((i) =>
        i.id === id ? { ...i, ...patch } : i
      ),
    });
  }

  function removeInterface(id: string) {
    onUpdate({
      networkInterfaces: interfaces.filter((i) => i.id !== id),
    });
  }

  return (
    <div
      className="rounded-md border"
      style={{
        borderColor: 'var(--theme-border)',
        backgroundColor: 'var(--theme-bg-primary)',
      }}
    >
      <div className="flex items-center gap-2 p-2.5">
        <Network size={14} className="shrink-0 opacity-70" />
        <span className="flex-1 text-sm font-medium">{device.name}</span>
        <span className="text-[10px] opacity-60">
          {interfaces.length} interface{interfaces.length === 1 ? '' : 's'}
        </span>
      </div>
      {interfaces.length > 0 && (
        <div
          className="space-y-1 border-t px-2 pb-2 pt-1"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          {interfaces.map((iface) => (
            <InterfaceRow
              key={iface.id}
              iface={iface}
              onUpdate={(patch) => updateInterface(iface.id, patch)}
              onRemove={() => removeInterface(iface.id)}
              hasConflict={
                (!!iface.staticIp && conflictIps.has(iface.staticIp)) ||
                (!!iface.macAddress &&
                  conflictMacs.has(iface.macAddress.toLowerCase()))
              }
            />
          ))}
        </div>
      )}
      {showForm ? (
        <div
          className="flex gap-2 border-t p-2"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <input
            type="text"
            placeholder="Interface name (e.g. eth0)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded border px-2 py-1 text-xs"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-secondary)',
              color: 'var(--theme-text-primary)',
            }}
          />
          <button
            type="button"
            onClick={addInterface}
            className="rounded bg-cyan-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-cyan-700"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="rounded border px-2 py-1 text-[11px]"
            style={{
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-secondary)',
            }}
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex w-full items-center justify-center gap-1 border-t py-1.5 text-[11px] opacity-70 transition hover:opacity-100"
          style={{
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-secondary)',
          }}
        >
          <Plus size={11} />
          Add interface
        </button>
      )}
    </div>
  );
}

export function IpAssignmentPanel() {
  const layout = useRackStore((state) => state.layout);
  const updateDevice = useRackStore((state) => state.updateDevice);
  const devices = layout.devices;
  const summary = useMemo(() => summarizeIpAssignments(devices), [devices]);
  const conflicts = useMemo(() => detectIpConflicts(devices), [devices]);

  const conflictIps = useMemo(() => {
    const set = new Set<string>();
    for (const c of conflicts) {
      if (c.kind === 'duplicate-ip') set.add(c.value);
    }
    return set;
  }, [conflicts]);

  const conflictMacs = useMemo(() => {
    const set = new Set<string>();
    for (const c of conflicts) {
      if (c.kind === 'duplicate-mac') set.add(c.value.toLowerCase());
    }
    return set;
  }, [conflicts]);

  return (
    <section
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--theme-bg-secondary)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <Network size={15} />
          IP & VLAN
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              const csv = exportIpTableCsv(devices);
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'ip-assignment-table.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
            style={{
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-secondary)',
            }}
          >
            <Download size={11} />
            CSV
          </button>
          <button
            type="button"
            onClick={() => {
              const md = exportIpTableMarkdown(devices);
              const blob = new Blob([md], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'ip-assignment-table.md';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
            style={{
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-secondary)',
            }}
          >
            <Download size={11} />
            MD
          </button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-4 gap-2">
        <div
          className="rounded-md border p-2 text-center"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <div className="text-lg font-bold text-slate-900 dark:text-white">
            {summary.totalInterfaces}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Interfaces
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <div className="text-lg font-bold text-slate-900 dark:text-white">
            {summary.withStaticIp}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Static IPs
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <div className="text-lg font-bold text-slate-900 dark:text-white">
            {summary.withVlan}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            VLANs
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <div className="text-lg font-bold text-slate-900 dark:text-white">
            {summary.duplicateIps + summary.duplicateMacs + summary.conflictingVlans}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            Conflicts
          </div>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="mb-3 space-y-1">
          {conflicts.map((conflict) => (
            <div
              key={`${conflict.kind}-${conflict.value}`}
              className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-800 dark:text-red-100"
            >
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>{conflict.message}</span>
            </div>
          ))}
        </div>
      )}

      {conflicts.length === 0 && summary.totalInterfaces > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-800 dark:text-emerald-100">
          <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
          <span>No IP, MAC, or VLAN conflicts detected.</span>
        </div>
      )}

      <div className="space-y-2">
        {devices.map((device) => (
          <DeviceInterfaceCard
            key={device.id}
            device={device}
            onUpdate={(patch) => updateDevice(device.id, patch)}
            conflictIps={conflictIps}
            conflictMacs={conflictMacs}
          />
        ))}
      </div>
    </section>
  );
}
