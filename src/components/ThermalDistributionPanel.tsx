import { Download, Flame, Plus, Thermometer, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { ThermalZone } from '../types/rack';
import {
  exportThermalDistributionMarkdown,
  findHotSpots,
  summarizeThermalDistribution,
  wattsToBtuH,
} from '../utils/thermalDistribution';

export function ThermalDistributionPanel() {
  const layout = useRackStore((state) => state.layout);
  const updateRack = useRackStore((state) => state.updateRack);
  const devices = layout.devices ?? [];
  const thermalZones = layout.thermalZones ?? [];
  const summary = useMemo(
    () => summarizeThermalDistribution(devices, thermalZones),
    [devices, thermalZones]
  );
  const hotspots = useMemo(
    () => findHotSpots(devices, layout.heightU),
    [devices, layout.heightU]
  );

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formStartU, setFormStartU] = useState('');
  const [formEndU, setFormEndU] = useState('');
  const [formTargetTemp, setFormTargetTemp] = useState('');
  const [formCooling, setFormCooling] = useState('');
  const [formNotes, setFormNotes] = useState('');

  function resetForm() {
    setFormName('');
    setFormStartU('');
    setFormEndU('');
    setFormTargetTemp('');
    setFormCooling('');
    setFormNotes('');
  }

  function addZone() {
    if (!formName.trim() || !formStartU.trim() || !formEndU.trim() || !formTargetTemp.trim()) return;
    const newZone: ThermalZone = {
      id: `zone-${Date.now()}`,
      name: formName.trim(),
      startU: parseInt(formStartU, 10),
      endU: parseInt(formEndU, 10),
      targetTempC: parseFloat(formTargetTemp),
      coolingCapacityW: formCooling ? parseFloat(formCooling) : undefined,
      notes: formNotes.trim() || undefined,
    };
    updateRack({ thermalZones: [...thermalZones, newZone] });
    resetForm();
    setShowForm(false);
  }

  function removeZone(id: string) {
    updateRack({ thermalZones: thermalZones.filter((z) => z.id !== id) });
  }

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
          <Thermometer size={15} />
          Thermal Distribution
        </div>
        <button
          type="button"
          onClick={() => {
            const md = exportThermalDistributionMarkdown(devices, thermalZones, layout.heightU);
            const blob = new Blob([md], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'thermal-distribution.md';
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
            {summary.totalPowerW.toFixed(0)}W
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Heat Load
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
            {summary.totalBtuH.toFixed(0)}
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            BTU/h
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
            {summary.totalCoolingW.toFixed(0)}W
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Cooling
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{
            borderColor: summary.coolingDeficitW > 0 ? 'rgba(239,68,68,0.4)' : 'var(--theme-border)',
            backgroundColor: summary.coolingDeficitW > 0 ? 'rgba(239,68,68,0.08)' : 'var(--theme-bg-primary)',
          }}
        >
          <div className="text-lg font-bold" style={{ color: summary.coolingDeficitW > 0 ? '#ef4444' : 'var(--theme-text-primary)' }}>
            {summary.coolingDeficitW.toFixed(0)}W
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Deficit
          </div>
        </div>
      </div>

      {/* Hottest device */}
      {summary.hottestDevice && (
        <div
          className="mb-3 rounded-md border p-2.5 text-xs"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="mb-1 font-medium" style={{ color: 'var(--theme-text-muted)' }}>Hottest Device</div>
          <div className="flex items-center gap-2">
            <Flame size={13} className="text-orange-500" />
            <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
              {summary.hottestDevice.deviceName}
            </span>
            <span style={{ color: 'var(--theme-text-secondary)' }}>
              {summary.hottestDevice.powerW}W ({wattsToBtuH(summary.hottestDevice.powerW).toFixed(0)} BTU/h)
            </span>
          </div>
        </div>
      )}

      {/* Hot spots */}
      {hotspots.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {hotspots.slice(0, 5).map((h) => (
            <div
              key={h.u}
              className="flex items-center gap-2 rounded-md border p-2 text-xs"
              style={{
                borderColor: h.severity === 'critical' ? 'rgba(239,68,68,0.4)' : 'rgba(234,179,8,0.4)',
                backgroundColor: h.severity === 'critical' ? 'rgba(239,68,68,0.08)' : 'rgba(234,179,8,0.08)',
              }}
            >
              <Flame size={13} className={h.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'} />
              <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                U{h.u}
              </span>
              <span style={{ color: 'var(--theme-text-secondary)' }}>
                {h.powerW.toFixed(0)}W · {h.deviceCount} device{h.deviceCount !== 1 ? 's' : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Zone list */}
      <div className="mb-2 space-y-2">
        {thermalZones.map((zone) => {
          let zonePowerW = 0;
          const seen = new Set<string>();
          for (const d of devices) {
            if (!d.powerW || d.powerW <= 0) continue;
            const startU = d.positionU;
            const endU = startU + d.sizeU;
            if (startU < zone.endU && endU > zone.startU) {
              zonePowerW += d.powerW;
              seen.add(d.id);
            }
          }
          const overloaded = zone.coolingCapacityW && zonePowerW > zone.coolingCapacityW;
          return (
            <div
              key={zone.id}
              className="rounded-md border p-2.5 text-sm"
              style={{
                borderColor: overloaded ? 'rgba(239,68,68,0.4)' : 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex-1 truncate font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                  {zone.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeZone(zone.id)}
                  className="opacity-60 transition hover:opacity-100"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>
                <span>U{zone.startU}–U{zone.endU - 1}</span>
                <span>Target {zone.targetTempC}°C</span>
                <span>{zonePowerW.toFixed(0)}W load</span>
                {zone.coolingCapacityW !== undefined && (
                  <span>{zone.coolingCapacityW.toFixed(0)}W cap</span>
                )}
              </div>
              {overloaded && (
                <div className="mt-1 text-[10px] font-medium text-red-500">
                  Overloaded — {zonePowerW.toFixed(0)}W &gt; {zone.coolingCapacityW?.toFixed(0)}W
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-3 space-y-2 rounded-md border p-2.5" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">New Zone</span>
            <button type="button" onClick={() => setShowForm(false)} className="opacity-60 hover:opacity-100">
              <X size={13} />
            </button>
          </div>
          <input
            type="text"
            placeholder="Zone name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="w-full rounded border px-2 py-1 text-xs"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-primary)',
              color: 'var(--theme-text-primary)',
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Start U"
              value={formStartU}
              onChange={(e) => setFormStartU(e.target.value)}
              className="w-full rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
                color: 'var(--theme-text-primary)',
              }}
            />
            <input
              type="number"
              placeholder="End U (exclusive)"
              value={formEndU}
              onChange={(e) => setFormEndU(e.target.value)}
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
              placeholder="Target temp (°C)"
              value={formTargetTemp}
              onChange={(e) => setFormTargetTemp(e.target.value)}
              className="w-full rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
                color: 'var(--theme-text-primary)',
              }}
            />
            <input
              type="number"
              placeholder="Cooling cap (W)"
              value={formCooling}
              onChange={(e) => setFormCooling(e.target.value)}
              className="w-full rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
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
            onClick={addZone}
            className="inline-flex items-center gap-1 rounded bg-cyan-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-cyan-700"
          >
            <Plus size={11} />
            Add
          </button>
        </div>
      )}

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-1 inline-flex w-full items-center justify-center gap-1 rounded border py-1.5 text-[11px] font-medium transition hover:bg-cyan-500/10"
          style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
        >
          <Plus size={12} />
          Add Zone
        </button>
      )}
    </section>
  );
}
