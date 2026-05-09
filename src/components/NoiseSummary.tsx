import type { RackLayout } from '../types/rack';
import { calculateNoiseSummary, suitabilityLabel } from '../utils/noiseCalc';

interface NoiseSummaryProps {
  layout: RackLayout;
}

const SUITABILITY_COLORS: Record<string, { bg: string; text: string }> = {
  bedroom: { bg: 'bg-emerald-500/15', text: 'text-emerald-100' },
  office: { bg: 'bg-sky-500/15', text: 'text-sky-100' },
  closet: { bg: 'bg-amber-500/15', text: 'text-amber-100' },
  garage: { bg: 'bg-orange-500/15', text: 'text-orange-100' },
  basement: { bg: 'bg-red-500/15', text: 'text-red-100' },
  unknown: { bg: 'bg-slate-500/15', text: 'text-slate-100' },
};

export function NoiseSummary({ layout }: NoiseSummaryProps) {
  const summary = calculateNoiseSummary(layout);
  const colors = SUITABILITY_COLORS[summary.suitability] ?? SUITABILITY_COLORS.unknown;

  return (
    <section
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--theme-bg-secondary)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-text-muted)' }}>
        Noise Planner
      </div>

      <div className="flex items-center gap-3">
        <div className="text-3xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
          {summary.totalDb > 0 ? `${summary.totalDb} dB` : '—'}
        </div>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${colors.bg} ${colors.text}`}>
          {suitabilityLabel(summary.suitability)}
        </span>
      </div>

      {summary.totalDb > 0 && (
        <div className="mt-3 space-y-1.5 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
          <div className="flex justify-between">
            <span>Loudest device</span>
            <span style={{ color: 'var(--theme-text-primary)' }}>
              {summary.loudestDeviceName} ({summary.maxDeviceDb} dB)
            </span>
          </div>
          <div className="flex justify-between">
            <span>Noisy devices</span>
            <span style={{ color: 'var(--theme-text-primary)' }}>{summary.deviceCountWithNoise}</span>
          </div>
          <div className="mt-2 rounded border p-2" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}>
            <div className="mb-1 font-semibold" style={{ color: 'var(--theme-text-muted)' }}>Room suitability</div>
            <div className="flex flex-wrap gap-1.5">
              {(['bedroom', 'office', 'closet', 'garage', 'basement'] as const).map((room) => {
                const roomColors = SUITABILITY_COLORS[room];
                const isOk =
                  (room === 'bedroom' && summary.totalDb <= 35) ||
                  (room === 'office' && summary.totalDb <= 45) ||
                  (room === 'closet' && summary.totalDb <= 55) ||
                  (room === 'garage' && summary.totalDb <= 70) ||
                  (room === 'basement' && summary.totalDb > 0);
                return (
                  <span
                    key={room}
                    className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${isOk ? roomColors.bg + ' ' + roomColors.text : 'opacity-30'}`}
                    style={{ color: isOk ? undefined : 'var(--theme-text-muted)' }}
                  >
                    {room}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
