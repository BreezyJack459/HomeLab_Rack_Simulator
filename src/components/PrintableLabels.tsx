import { useMemo, useState } from 'react';
import type { RackLayout } from '../types/rack';
import { isZeroU } from '../utils/rackMath';
import { getPatchPanelJacks } from '../utils/patchPanel';
import { calculateCablePlan } from '../utils/routing';

interface PrintableLabelsProps {
  layout: RackLayout;
}

type LabelType = 'ru' | 'device' | 'patch-panel' | 'all';
type LabelPreset = 'generic-a4' | 'brady-m210' | 'panduit-mp300';

function formatPresetLabel(text: string, index: number): string {
  return `${text}:${String(index + 1).padStart(2, '0')}`;
}

function portLabel(port: { type: string; index: number } | undefined): string {
  if (!port) return '';
  const typeUpper = port.type.toUpperCase();
  return `${typeUpper}${port.index}`;
}

export function PrintableLabels({ layout }: PrintableLabelsProps) {
  const [labelType, setLabelType] = useState<LabelType>('all');
  const [includeBlank, setIncludeBlank] = useState(true);
  const [labelPreset, setLabelPreset] = useState<LabelPreset>('generic-a4');

  const ruLabels = useMemo(() => {
    const labels: { text: string; sub?: string; type: 'ru' | 'device' | 'patch-panel'; length?: string }[] = [];
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
    const blanks: { text: string; sub?: string; type: 'ru' | 'device' | 'patch-panel'; length?: string }[] = [];
    for (let unit = layout.heightU; unit >= 1; unit -= 1) {
      if (!usedUnits.has(unit)) {
        blanks.push({ text: `U${unit}`, sub: 'Blank', type: 'ru' });
      }
    }
    return blanks;
  }, [layout.devices, layout.heightU, includeBlank]);

  const patchPanelLabels = useMemo(() => {
    const labels: { text: string; sub?: string; type: 'ru' | 'device' | 'patch-panel'; length?: string }[] = [];
    const panels = layout.devices.filter((d) => d.category === 'patch-panel');
    for (const panel of panels) {
      const jacks = getPatchPanelJacks(layout, panel.id);
      for (const jack of jacks) {
        if (jack.frontCable && jack.frontPeer) {
          const plan = calculateCablePlan(jack.frontCable, layout);
          const length = plan ? `${Math.ceil(plan.standardLengthMm / 100) / 10}m` : undefined;
          const frontPort = jack.frontCable.fromDeviceId === panel.id ? jack.frontCable.toPort : jack.frontCable.fromPort;
          labels.push({
            text: `${formatPresetLabel(panel.name, jack.index)} → ${jack.frontPeer.name}:${portLabel(frontPort)}`,
            type: 'patch-panel',
            length
          });
        }
        if (jack.rearCable && jack.rearPeer) {
          const plan = calculateCablePlan(jack.rearCable, layout);
          const length = plan ? `${Math.ceil(plan.standardLengthMm / 100) / 10}m` : undefined;
          const rearPort = jack.rearCable.fromDeviceId === panel.id ? jack.rearCable.toPort : jack.rearCable.fromPort;
          labels.push({
            text: `${formatPresetLabel(panel.name, jack.index)} → ${jack.rearPeer.name}:${portLabel(rearPort)}`,
            type: 'patch-panel',
            length
          });
        }
      }
    }
    return labels;
  }, [layout]);

  const visibleLabels = useMemo(() => {
    let labels: { text: string; sub?: string; type: 'ru' | 'device' | 'patch-panel'; length?: string }[] = [];
    if (labelType === 'ru' || labelType === 'all') labels = [...labels, ...ruLabels];
    if (labelType === 'device' || labelType === 'all') labels = [...labels, ...deviceLabels];
    if ((labelType === 'ru' || labelType === 'all') && includeBlank) labels = [...labels, ...blankLabels];
    if (labelType === 'patch-panel' || labelType === 'all') labels = [...labels, ...patchPanelLabels];
    return labels;
  }, [labelType, ruLabels, deviceLabels, blankLabels, patchPanelLabels, includeBlank]);

  const presetClass = labelPreset === 'generic-a4' ? '' : `print-label-preset-${labelPreset}`;

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
          <option value="all">All labels</option>
          <option value="ru">RU numbers only</option>
          <option value="device">Device labels only</option>
          <option value="patch-panel">Patch panel labels only</option>
        </select>
        <select
          className="h-8 rounded-md border px-2.5 text-sm outline-none"
          style={{
            backgroundColor: 'var(--theme-bg-input)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-primary)'
          }}
          value={labelPreset}
          onChange={(e) => setLabelPreset(e.target.value as LabelPreset)}
        >
          <option value="generic-a4">Generic A4</option>
          <option value="brady-m210">Brady M210 (19×38mm)</option>
          <option value="panduit-mp300">Panduit MP300 (12×45mm)</option>
        </select>
        {(labelType === 'ru' || labelType === 'all') && (
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
        )}
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

      <div className={`print-label-grid ${presetClass}`}>
        {visibleLabels.map((label, index) => (
          <div
            key={index}
            className={`print-label ${label.type === 'device' ? 'print-label-device' : ''} ${label.type === 'patch-panel' ? 'print-label-device' : ''}`}
          >
            <div className="print-label-text">{label.text}</div>
            {label.sub && <div className="print-label-sub">{label.sub}</div>}
            {label.length && <div className="print-label-length">{label.length}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
