import {
  Calendar,
  ChevronDown,
  Download,
  Lock,
  Network,
  Plus,
  Trash2,
  Unlock,
  User,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { PlacedDevice, PortReservation, PortType } from '../types/rack';
import {
  exportPortReservationsCsv,
  exportPortReservationsMarkdown,
  summarizePortReservations,
  validatePortReservations,
} from '../utils/portReservations';

const portTypeOptions: { value: PortType; label: string }[] = [
  { value: 'ethernet', label: 'Ethernet' },
  { value: 'fiber', label: 'Fiber' },
  { value: 'power', label: 'Power' },
  { value: 'usb', label: 'USB' },
  { value: 'hdmi', label: 'HDMI' },
  { value: 'atx', label: 'ATX' },
  { value: 'coax', label: 'Coax' },
];

function getPortCount(device: PlacedDevice, portType: PortType): number {
  return device.ports?.[portType as keyof PlacedDevice['ports']] ?? 0;
}

function ReservationRow({
  reservation,
  deviceName,
  onUpdate,
  onRemove,
}: {
  reservation: PortReservation;
  deviceName: string;
  onUpdate: (patch: Partial<PortReservation>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isExpired = reservation.expiryDate && reservation.expiryDate < new Date().toISOString().slice(0, 10);

  return (
    <div
      className="rounded-md border text-sm"
      style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
    >
      <div className="flex items-center gap-2 p-2.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="opacity-70 transition hover:opacity-100"
        >
          <ChevronDown size={14} className={`transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
        </button>
        <Lock size={13} className="shrink-0 opacity-60" />
        <span className="flex-1 truncate font-medium">{reservation.purpose}</span>
        <span className="text-[10px] opacity-60">{deviceName}</span>
        <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-700 dark:text-cyan-300">
          {reservation.portType} {reservation.portIndex + 1}
        </span>
        {isExpired && (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
            Expired
          </span>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="opacity-60 transition hover:opacity-100"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <Trash2 size={13} />
        </button>
      </div>

      {expanded && (
        <div className="grid grid-cols-2 gap-2 border-t px-3 py-2.5 text-xs" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="col-span-2">
            <div className="text-[10px] uppercase tracking-wider opacity-60">Purpose</div>
            <input
              type="text"
              value={reservation.purpose}
              onChange={(e) => onUpdate({ purpose: e.target.value })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Expected Device</div>
            <input
              type="text"
              value={reservation.expectedDevice ?? ''}
              onChange={(e) => onUpdate({ expectedDevice: e.target.value || undefined })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
              placeholder="e.g. NAS-02"
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Owner</div>
            <input
              type="text"
              value={reservation.owner ?? ''}
              onChange={(e) => onUpdate({ owner: e.target.value || undefined })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
              placeholder="Your name"
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Expiry Date</div>
            <input
              type="date"
              value={reservation.expiryDate ?? ''}
              onChange={(e) => onUpdate({ expiryDate: e.target.value || undefined })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
          <div className="col-span-2">
            <div className="text-[10px] uppercase tracking-wider opacity-60">Notes</div>
            <input
              type="text"
              value={reservation.notes ?? ''}
              onChange={(e) => onUpdate({ notes: e.target.value || undefined })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
              placeholder="Any additional details..."
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function PortReservationPanel() {
  const layout = useRackStore((state) => state.layout);
  const updateRack = useRackStore((state) => state.updateRack);
  const reservations = layout.portReservations ?? [];
  const summary = useMemo(() => summarizePortReservations(reservations), [reservations]);
  const issues = useMemo(
    () => validatePortReservations(reservations, layout.devices, layout.cables),
    [reservations, layout.devices, layout.cables]
  );
  const [showForm, setShowForm] = useState(false);
  const [formDeviceId, setFormDeviceId] = useState('');
  const [formPortType, setFormPortType] = useState<PortType>('ethernet');
  const [formPortIndex, setFormPortIndex] = useState(0);
  const [formPurpose, setFormPurpose] = useState('');
  const [formExpectedDevice, setFormExpectedDevice] = useState('');
  const [formOwner, setFormOwner] = useState('');
  const [formExpiry, setFormExpiry] = useState('');

  const deviceOptions = useMemo(() => {
    return layout.devices
      .filter((d) => d.ports && Object.values(d.ports).some((c) => (c ?? 0) > 0))
      .map((d) => ({ id: d.id, name: d.name, device: d }));
  }, [layout.devices]);

  const selectedDevice = useMemo(
    () => layout.devices.find((d) => d.id === formDeviceId),
    [layout.devices, formDeviceId]
  );

  const maxPortIndex = useMemo(() => {
    if (!selectedDevice) return 0;
    return getPortCount(selectedDevice, formPortType);
  }, [selectedDevice, formPortType]);

  function addReservation() {
    if (!formDeviceId || !formPurpose.trim() || maxPortIndex === 0) return;
    const newReservation: PortReservation = {
      id: `pr-${Date.now()}`,
      deviceId: formDeviceId,
      portType: formPortType,
      portIndex: formPortIndex,
      purpose: formPurpose.trim(),
      expectedDevice: formExpectedDevice.trim() || undefined,
      owner: formOwner.trim() || undefined,
      expiryDate: formExpiry || undefined,
    };
    updateRack({ portReservations: [...reservations, newReservation] });
    setFormPurpose('');
    setFormExpectedDevice('');
    setFormOwner('');
    setFormExpiry('');
    setShowForm(false);
  }

  function updateReservation(id: string, patch: Partial<PortReservation>) {
    updateRack({
      portReservations: reservations.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  }

  function removeReservation(id: string) {
    updateRack({
      portReservations: reservations.filter((r) => r.id !== id),
    });
  }

  const deviceNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of layout.devices) {
      map[d.id] = d.name;
    }
    return map;
  }, [layout.devices]);

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
          <Network size={15} />
          Port Reservations
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              const csv = exportPortReservationsCsv(reservations, layout.devices);
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'port-reservations.csv';
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
              const md = exportPortReservationsMarkdown(reservations, layout.devices);
              const blob = new Blob([md], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'port-reservations.md';
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
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold text-slate-900 dark:text-white">{summary.totalCount}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Reserved
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{summary.expiredCount}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Expired
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold text-red-600 dark:text-red-400">{issues.filter((i) => i.severity === 'critical').length}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Conflicts
          </div>
        </div>
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="mb-3 space-y-1">
          {issues.slice(0, 3).map((issue) => (
            <div
              key={issue.id}
              className={`rounded-md border px-2.5 py-1.5 text-[11px] ${
                issue.severity === 'critical'
                  ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
                  : issue.severity === 'warning'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                  : 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300'
              }`}
            >
              <span className="font-medium">{issue.title}:</span> {issue.detail}
            </div>
          ))}
          {issues.length > 3 && (
            <div className="text-center text-[10px] opacity-60">+{issues.length - 3} more issues</div>
          )}
        </div>
      )}

      {/* Add form */}
      {showForm ? (
        <div className="mb-3 flex flex-col gap-2 rounded-md border p-2" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={formDeviceId}
              onChange={(e) => {
                setFormDeviceId(e.target.value);
                setFormPortIndex(0);
              }}
              className="col-span-2 rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            >
              <option value="">Select device...</option>
              {deviceOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              value={formPortType}
              onChange={(e) => {
                setFormPortType(e.target.value as PortType);
                setFormPortIndex(0);
              }}
              className="rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            >
              {portTypeOptions.map((pt) => (
                <option key={pt.value} value={pt.value}>
                  {pt.label}
                </option>
              ))}
            </select>
            <select
              value={formPortIndex}
              onChange={(e) => setFormPortIndex(Number(e.target.value))}
              className="rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            >
              {Array.from({ length: maxPortIndex }, (_, i) => (
                <option key={i} value={i}>
                  Port {i + 1}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Purpose (e.g. NAS uplink)"
              value={formPurpose}
              onChange={(e) => setFormPurpose(e.target.value)}
              className="col-span-2 rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
            <input
              type="text"
              placeholder="Expected device"
              value={formExpectedDevice}
              onChange={(e) => setFormExpectedDevice(e.target.value)}
              className="rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
            <input
              type="text"
              placeholder="Owner"
              value={formOwner}
              onChange={(e) => setFormOwner(e.target.value)}
              className="rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
            <input
              type="date"
              placeholder="Expiry"
              value={formExpiry}
              onChange={(e) => setFormExpiry(e.target.value)}
              className="col-span-2 rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addReservation}
              className="rounded bg-cyan-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-cyan-700"
            >
              Reserve Port
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded border px-2 py-1 text-[11px]"
              style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mb-3 flex w-full items-center justify-center gap-1 rounded-md border py-1.5 text-[11px] opacity-70 transition hover:opacity-100"
          style={{
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-secondary)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <Plus size={11} />
          Reserve port
        </button>
      )}

      {/* Reservation list */}
      <div className="space-y-1.5">
        {reservations.map((reservation) => (
          <ReservationRow
            key={reservation.id}
            reservation={reservation}
            deviceName={deviceNameMap[reservation.deviceId] ?? reservation.deviceId}
            onUpdate={(patch) => updateReservation(reservation.id, patch)}
            onRemove={() => removeReservation(reservation.id)}
          />
        ))}
      </div>

      {reservations.length === 0 && (
        <div
          className="rounded-md border p-3 text-center text-xs opacity-60"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          No ports reserved yet. Reserve switch ports, patch-panel ports, PDU outlets, or device interfaces for future use.
        </div>
      )}
    </section>
  );
}
