import { Download, RefreshCw, ShieldCheck, AlertTriangle, Minus, Pencil, X, Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { PlacedDevice } from '../types/rack';
import {
  exportFirmwareCsv,
  exportFirmwareMarkdown,
  firmwareStatusBg,
  firmwareStatusColor,
  firmwareStatusLabel,
  getFirmwareStatus,
  summarizeFirmware,
} from '../utils/firmwareTracker';

function FirmwareRow({
  device,
  onUpdate,
}: {
  device: PlacedDevice;
  onUpdate: (patch: Partial<PlacedDevice>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [version, setVersion] = useState(device.firmwareVersion ?? '');
  const [latest, setLatest] = useState(device.firmwareLatest ?? '');
  const [notes, setNotes] = useState(device.firmwareNotes ?? '');
  const status = getFirmwareStatus(device);

  function save() {
    onUpdate({
      firmwareVersion: version.trim() || undefined,
      firmwareLatest: latest.trim() || undefined,
      firmwareNotes: notes.trim() || undefined,
    });
    setEditing(false);
  }

  function cancel() {
    setVersion(device.firmwareVersion ?? '');
    setLatest(device.firmwareLatest ?? '');
    setNotes(device.firmwareNotes ?? '');
    setEditing(false);
  }

  return (
    <div className={`rounded-md border text-sm ${firmwareStatusBg(status)}`}>
      <div className="flex items-center gap-2 p-2">
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${firmwareStatusColor(status)}`}>
          {status === 'current' && <ShieldCheck size={11} className="inline mr-1" />}
          {status === 'update-available' && <AlertTriangle size={11} className="inline mr-1" />}
          {status === 'unknown' && <Minus size={11} className="inline mr-1" />}
          {firmwareStatusLabel(status)}
        </span>
        <span className="flex-1 truncate font-medium">{device.name}</span>
        {!editing && (
          <span className="text-[10px] opacity-60">
            {device.firmwareVersion ?? '-'}
            {device.firmwareLatest ? ` → ${device.firmwareLatest}` : ''}
          </span>
        )}
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="opacity-60 transition hover:opacity-100"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          {editing ? <X size={12} /> : <Pencil size={12} />}
        </button>
      </div>

      {editing && (
        <div className="grid grid-cols-3 gap-2 border-t px-3 py-2 text-xs" style={{ borderColor: 'var(--theme-border)' }}>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Current</div>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g. 1.0.0"
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Latest</div>
            <input
              type="text"
              value={latest}
              onChange={(e) => setLatest(e.target.value)}
              placeholder="e.g. 2.0.0"
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Notes</div>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="CVE, changelog..."
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
            />
          </div>
          <div className="col-span-3 flex gap-2">
            <button
              type="button"
              onClick={save}
              className="inline-flex items-center gap-1 rounded bg-cyan-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-cyan-700"
            >
              <Check size={11} />
              Save
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded border px-2 py-0.5 text-[11px]"
              style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function FirmwareTrackerPanel() {
  const layout = useRackStore((state) => state.layout);
  const updateDevice = useRackStore((state) => state.updateDevice);
  const devices = layout.devices;
  const summary = useMemo(() => summarizeFirmware(devices), [devices]);
  const [filter, setFilter] = useState<'all' | 'tracked' | 'outdated' | 'unknown'>('all');

  const filteredDevices = useMemo(() => {
    switch (filter) {
      case 'tracked':
        return devices.filter((d) => d.firmwareVersion !== undefined || d.firmwareLatest !== undefined);
      case 'outdated':
        return devices.filter((d) => getFirmwareStatus(d) === 'update-available');
      case 'unknown':
        return devices.filter((d) => getFirmwareStatus(d) === 'unknown');
      default:
        return devices;
    }
  }, [devices, filter]);

  return (
    <section
      className="rounded-lg border p-4"
      style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border)' }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-text-muted)' }}>
          <RefreshCw size={15} />
          Firmware Tracker
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              const csv = exportFirmwareCsv(devices);
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'firmware-tracker.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
            style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
          >
            <Download size={11} />
            CSV
          </button>
          <button
            type="button"
            onClick={() => {
              const md = exportFirmwareMarkdown(devices);
              const blob = new Blob([md], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'firmware-tracker.md';
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
      </div>

      {/* Summary */}
      <div className="mb-3 grid grid-cols-4 gap-2">
        <div className="rounded-md border p-2 text-center" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
          <div className="text-lg font-bold text-slate-900 dark:text-white">{summary.trackedCount}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Tracked</div>
        </div>
        <div className="rounded-md border p-2 text-center" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{summary.currentCount}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Current</div>
        </div>
        <div className="rounded-md border p-2 text-center" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{summary.updateAvailableCount}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Updates</div>
        </div>
        <div className="rounded-md border p-2 text-center" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
          <div className="text-lg font-bold text-slate-600 dark:text-slate-400">{summary.unknownCount}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Unknown</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-2 flex flex-wrap gap-1">
        {(['all', 'tracked', 'outdated', 'unknown'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider transition ${
              filter === f ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' : 'opacity-60'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Device list */}
      <div className="space-y-1.5">
        {filteredDevices.map((device) => (
          <FirmwareRow
            key={device.id}
            device={device}
            onUpdate={(patch) => updateDevice(device.id, patch)}
          />
        ))}
      </div>

      {filteredDevices.length === 0 && (
        <div className="rounded-md border p-3 text-center text-xs opacity-60" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
          No devices match this filter. Click the pencil icon on any device to track its firmware.
        </div>
      )}
    </section>
  );
}
