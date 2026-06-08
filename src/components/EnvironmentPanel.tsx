import { Download, Thermometer, Droplets, Volume2, AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { RackEnvironment } from '../types/rack';
import { exportEnvironmentMarkdown, getEnvironmentStatus } from '../utils/environment';

export function EnvironmentPanel() {
  const layout = useRackStore((state) => state.layout);
  const updateRack = useRackStore((state) => state.updateRack);
  const env = layout.environment;
  const status = useMemo(() => getEnvironmentStatus(env), [env]);

  const [temp, setTemp] = useState(env?.roomTempC?.toString() ?? '');
  const [humidity, setHumidity] = useState(env?.roomHumidityPercent?.toString() ?? '');
  const [noise, setNoise] = useState(env?.ambientNoiseDb?.toString() ?? '');
  const [notes, setNotes] = useState(env?.notes ?? '');

  function save() {
    const next: RackEnvironment = {
      roomTempC: temp ? Number(temp) : undefined,
      roomHumidityPercent: humidity ? Number(humidity) : undefined,
      ambientNoiseDb: noise ? Number(noise) : undefined,
      recordedAt: new Date().toISOString(),
      notes: notes || undefined,
    };
    updateRack({ environment: next });
  }

  const statusBadge = (s: 'good' | 'warning' | 'critical') => {
    if (s === 'good') return 'bg-green-500/10 text-green-700 dark:text-green-300';
    if (s === 'warning') return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
    return 'bg-red-500/10 text-red-700 dark:text-red-300';
  };

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
          Environment
        </div>
        <button
          type="button"
          onClick={() => {
            const md = exportEnvironmentMarkdown(env);
            const blob = new Blob([md], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'environment.md';
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

      {/* Readings */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div
          className={`rounded-md border p-2 text-center ${statusBadge(status.tempStatus)}`}
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <Thermometer size={16} className="mx-auto mb-1 opacity-70" />
          <div className="text-lg font-bold">{env?.roomTempC ?? '-'}°C</div>
          <div className="text-[10px] uppercase tracking-wider opacity-70">Temperature</div>
        </div>
        <div
          className={`rounded-md border p-2 text-center ${statusBadge(status.humidityStatus)}`}
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <Droplets size={16} className="mx-auto mb-1 opacity-70" />
          <div className="text-lg font-bold">{env?.roomHumidityPercent ?? '-'}%</div>
          <div className="text-[10px] uppercase tracking-wider opacity-70">Humidity</div>
        </div>
        <div
          className={`rounded-md border p-2 text-center ${statusBadge(status.noiseStatus)}`}
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <Volume2 size={16} className="mx-auto mb-1 opacity-70" />
          <div className="text-lg font-bold">{env?.ambientNoiseDb ?? '-'} dB</div>
          <div className="text-[10px] uppercase tracking-wider opacity-70">Noise</div>
        </div>
      </div>

      {/* Recommendations */}
      {status.recommendations.length > 0 && (
        <div className="mb-3 space-y-1">
          {status.recommendations.map((r, i) => (
            <div
              key={i}
              className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300"
            >
              <AlertTriangle size={12} className="inline mr-1" />
              {r}
            </div>
          ))}
        </div>
      )}

      {/* Inputs */}
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Temp °C
            <input
              type="number"
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
              onBlur={save}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </label>
          <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Humidity %
            <input
              type="number"
              value={humidity}
              onChange={(e) => setHumidity(e.target.value)}
              onBlur={save}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </label>
          <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Noise dB
            <input
              type="number"
              value={noise}
              onChange={(e) => setNoise(e.target.value)}
              onBlur={save}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </label>
        </div>
        <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
          Notes
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={save}
            className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-primary)',
              color: 'var(--theme-text-primary)',
            }}
          />
        </label>
        {env?.recordedAt && (
          <div className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
            Last recorded: {new Date(env.recordedAt).toLocaleString()}
          </div>
        )}
      </div>
    </section>
  );
}
