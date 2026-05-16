import { Activity, AlertTriangle, Download, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { DeviceSensorReading } from '../types/rack';
import { exportSensorReadingsMarkdown, getSensorAlerts, summarizeSensorReadings } from '../utils/deviceSensors';

export function DeviceSensorPanel() {
  const layout = useRackStore((state) => state.layout);
  const updateRack = useRackStore((state) => state.updateRack);
  const readings = layout.sensorReadings ?? [];
  const devices = layout.devices ?? [];
  const summary = useMemo(() => summarizeSensorReadings(readings), [readings]);
  const alerts = useMemo(() => getSensorAlerts(readings, devices), [readings, devices]);

  const deviceOptions = useMemo(() => {
    return devices
      .filter((d) => d.powerW && d.powerW > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [devices]);

  const [showForm, setShowForm] = useState(false);
  const [formDeviceId, setFormDeviceId] = useState('');
  const [formPowerActual, setFormPowerActual] = useState('');
  const [formPowerPlanned, setFormPowerPlanned] = useState('');
  const [formTempActual, setFormTempActual] = useState('');
  const [formTempPlanned, setFormTempPlanned] = useState('');
  const [formFanActual, setFormFanActual] = useState('');
  const [formFanPlanned, setFormFanPlanned] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formNotes, setFormNotes] = useState('');

  function resetForm() {
    setFormDeviceId('');
    setFormPowerActual('');
    setFormPowerPlanned('');
    setFormTempActual('');
    setFormTempPlanned('');
    setFormFanActual('');
    setFormFanPlanned('');
    setFormDate('');
    setFormNotes('');
  }

  function addReading() {
    if (!formDeviceId) return;
    const newReading: DeviceSensorReading = {
      id: `sensor-${Date.now()}`,
      deviceId: formDeviceId,
      powerActualW: formPowerActual ? parseFloat(formPowerActual) : undefined,
      powerPlannedW: formPowerPlanned ? parseFloat(formPowerPlanned) : undefined,
      tempActualC: formTempActual ? parseFloat(formTempActual) : undefined,
      tempPlannedC: formTempPlanned ? parseFloat(formTempPlanned) : undefined,
      fanActualRpm: formFanActual ? parseInt(formFanActual, 10) : undefined,
      fanPlannedRpm: formFanPlanned ? parseInt(formFanPlanned, 10) : undefined,
      recordedAt: formDate || undefined,
      notes: formNotes.trim() || undefined,
    };
    updateRack({ sensorReadings: [...readings, newReading] });
    resetForm();
    setShowForm(false);
  }

  function removeReading(id: string) {
    updateRack({ sensorReadings: readings.filter((r) => r.id !== id) });
  }

  const deviceMap = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);

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
          <Activity size={15} />
          Sensor Readings
        </div>
        <button
          type="button"
          onClick={() => {
            const md = exportSensorReadingsMarkdown(readings, devices);
            const blob = new Blob([md], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'sensor-readings.md';
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
      <div className="mb-3 grid grid-cols-4 gap-2">
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
            {summary.total}
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Readings
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
            {summary.withPower}
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Power
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
            {summary.withTemp}
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Temp
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
            {summary.withFan}
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Fan
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {alerts.map((alert, idx) => (
            <div
              key={`${alert.readingId}-${alert.deviceId}-${idx}`}
              className="flex items-start gap-2 rounded-md border p-2 text-xs"
              style={{
                borderColor: alert.severity === 'warning' ? 'rgba(234,179,8,0.4)' : 'var(--theme-border)',
                backgroundColor: alert.severity === 'warning' ? 'rgba(234,179,8,0.08)' : 'var(--theme-bg-primary)',
              }}
            >
              {alert.severity === 'warning' && <AlertTriangle size={13} className="mt-0.5 shrink-0 text-yellow-500" />}
              <div className="min-w-0">
                <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                  {alert.deviceName}
                </span>
                <span className="ml-1" style={{ color: 'var(--theme-text-secondary)' }}>
                  {alert.message}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="mb-3 space-y-2 rounded-md border p-2.5" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">New Reading</span>
            <button type="button" onClick={() => setShowForm(false)} className="opacity-60 hover:opacity-100">
              <X size={13} />
            </button>
          </div>
          <select
            value={formDeviceId}
            onChange={(e) => setFormDeviceId(e.target.value)}
            className="w-full rounded border px-2 py-1 text-xs"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-primary)',
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
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Power actual (W)"
              value={formPowerActual}
              onChange={(e) => setFormPowerActual(e.target.value)}
              className="w-full rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
                color: 'var(--theme-text-primary)',
              }}
            />
            <input
              type="number"
              placeholder="Power planned (W)"
              value={formPowerPlanned}
              onChange={(e) => setFormPowerPlanned(e.target.value)}
              className="w-full rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Temp actual (°C)"
              value={formTempActual}
              onChange={(e) => setFormTempActual(e.target.value)}
              className="w-full rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
                color: 'var(--theme-text-primary)',
              }}
            />
            <input
              type="number"
              placeholder="Temp planned (°C)"
              value={formTempPlanned}
              onChange={(e) => setFormTempPlanned(e.target.value)}
              className="w-full rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Fan actual (RPM)"
              value={formFanActual}
              onChange={(e) => setFormFanActual(e.target.value)}
              className="w-full rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
                color: 'var(--theme-text-primary)',
              }}
            />
            <input
              type="number"
              placeholder="Fan planned (RPM)"
              value={formFanPlanned}
              onChange={(e) => setFormFanPlanned(e.target.value)}
              className="w-full rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
          <input
            type="date"
            value={formDate}
            onChange={(e) => setFormDate(e.target.value)}
            className="w-full rounded border px-2 py-1 text-xs"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-primary)',
              color: 'var(--theme-text-primary)',
            }}
          />
          <input
            type="text"
            placeholder="Notes"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            className="w-full rounded border px-2 py-1 text-xs"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-primary)',
              color: 'var(--theme-text-primary)',
            }}
          />
          <button
            type="button"
            onClick={addReading}
            className="inline-flex items-center gap-1 rounded bg-cyan-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-cyan-700"
          >
            <Plus size={11} />
            Add
          </button>
        </div>
      )}

      {/* Reading list */}
      <div className="space-y-2">
        {readings.map((reading) => {
          const device = deviceMap.get(reading.deviceId);
          return (
            <div
              key={reading.id}
              className="rounded-md border p-2.5 text-sm"
              style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex-1 truncate font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                  {device?.name ?? reading.deviceId}
                </span>
                <button
                  type="button"
                  onClick={() => removeReading(reading.id)}
                  className="opacity-60 transition hover:opacity-100"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>
                {reading.powerActualW !== undefined && (
                  <span>
                    {reading.powerActualW}W
                    {reading.powerPlannedW !== undefined && (
                      <span className="opacity-60"> / {reading.powerPlannedW}W</span>
                    )}
                  </span>
                )}
                {reading.tempActualC !== undefined && (
                  <span>
                    {reading.tempActualC}°C
                    {reading.tempPlannedC !== undefined && (
                      <span className="opacity-60"> / {reading.tempPlannedC}°C</span>
                    )}
                  </span>
                )}
                {reading.fanActualRpm !== undefined && (
                  <span>
                    {reading.fanActualRpm} RPM
                    {reading.fanPlannedRpm !== undefined && (
                      <span className="opacity-60"> / {reading.fanPlannedRpm}</span>
                    )}
                  </span>
                )}
              </div>
              {(reading.recordedAt || reading.notes) && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {reading.recordedAt && (
                    <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-slate-400">
                      {reading.recordedAt}
                    </span>
                  )}
                  {reading.notes && (
                    <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-slate-400">
                      {reading.notes}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded border py-1.5 text-[11px] font-medium transition hover:bg-cyan-500/10"
          style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
        >
          <Plus size={12} />
          Add Reading
        </button>
      )}
    </section>
  );
}
