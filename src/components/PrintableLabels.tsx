import { useMemo, useState } from 'react';
import type { RackLayout } from '../types/rack';
import { isZeroU } from '../utils/rackMath';

interface PrintableLabelsProps {
  layout: RackLayout;
}

type LabelType = 'ru' | 'device' | 'both';

export function PrintableLabels({ layout }: PrintableLabelsProps) {
  const [labelType, setLabelType] = useState<LabelType>('both');
  const [includeBlank, setIncludeBlank] = useState(true);

  const ruLabels = useMemo(() => {
    const labels: { text: string; sub?: string; type: 'ru' | 'device' }[] = [];
    for (let unit = layout.heightU; unit >= 1; unit -= 1) {
      labels.push({ text: `U${unit}`, type: 'ru' });
    }
    return labels;
  }, [layout.heightU]);

  const deviceLabels = useMemo(() => {
    return layout.devices
      .filter((d) => !isZeroU(d))
      .map((device) => ({
        text: device.label || device.name,
        sub: `${device.positionU}U–${device.positionU + device.sizeU - 1}U · ${device.sizeU}U`,
        type: 'device' as const
      }))
      .sort((a, b) => {
        const aU = parseInt(a.sub.split('U')[0], 10);
        const bU = parseInt(b.sub.split('U')[0], 10);
        return bU - aU;
      });
  }, [layout.devices]);

  const blankLabels = useMemo(() => {
    if (!includeBlank) return [];
    const usedUnits = new Set<number>();
    layout.devices.forEach((d) => {
      if (isZeroU(d)) return;
      for (let u = d.positionU; u < d.positionU + d.sizeU; u += 1) {
        usedUnits.add(u);
      }
    });
    const blanks: { text: string; sub?: string; type: 'ru' }[] = [];
    for (let unit = layout.heightU; unit >= 1; unit -= 1) {
      if (!usedUnits.has(unit)) {
        blanks.push({ text: `U${unit}`, sub: 'Blank', type: 'ru' });
      }
    }
    return blanks;
  }, [layout.devices, layout.heightU, includeBlank]);

  const visibleLabels = useMemo(() => {
    let labels = [] as { text: string; sub?: string; type: 'ru' | 'device' }[];
    if (labelType === 'ru' || labelType === 'both') labels = [...labels, ...ruLabels];
    if (labelType === 'device' || labelType === 'both') labels = [...labels, ...deviceLabels];
    if (labelType === 'ru' || labelType === 'both') labels = [...labels, ...blankLabels];
    return labels;
  }, [labelType, ruLabels, deviceLabels, blankLabels]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="h-8 rounded-md border px-2.5 text-sm outline-none"
          style={{
            backgroundColor: 'var(--theme-bg-input)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-primary)'
          }}
          value={labelType}
          onChange={(e) => setLabelType(e.target.value as LabelType)}
        >
          <option value="both">RU + Device labels</option>
          <option value="ru">RU numbers only</option>
          <option value="device">Device labels only</option>
        </select>
        <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
          <input
            type="checkbox"
            checked={includeBlank}
            onChange={(e) => setIncludeBlank(e.target.checked)}
            className="rounded border"
            style={{ borderColor: 'var(--theme-border)' }}
          />
          Include blank slots
        </label>
        <button
          className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm hover:opacity-80"
          style={{
            backgroundColor: 'var(--theme-bg-input)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-secondary)'
          }}
          onClick={() => window.print()}
          type="button"
        >
          Print
        </button>
      </div>

      <div className="print-label-grid">
        {visibleLabels.map((label, index) => (
          <div
            key={index}
            className={`print-label ${label.type === 'device' ? 'print-label-device' : ''}`}
          >
            <div className="print-label-text">{label.text}</div>
            {label.sub && <div className="print-label-sub">{label.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
