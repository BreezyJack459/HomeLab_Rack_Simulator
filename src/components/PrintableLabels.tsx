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
type PrintableLabel = {
  id: string;
  text: string;
  sub?: string;
  type: 'ru' | 'device' | 'patch-panel';
  length?: string;
};

function formatPresetLabel(text: string, index: number): string {
  return `${text}:${String(index + 1).padStart(2, '0')}`;
}

function portLabel(port: { type: string; index: number } | undefined): string {
  if (!port) return '';
  const typeUpper = port.type.toUpperCase();
  return `${typeUpper}${port.index}`;
}

function portSignature(port: { type: string; index: number; side?: string } | undefined): string {
  if (!port) return '';
  return `${port.type}:${port.index}:${port.side ?? ''}`;
}

export function PrintableLabels({ layout }: PrintableLabelsProps) {
  const [labelType, setLabelType] = useState<LabelType>('all');
  const [includeBlank, setIncludeBlank] = useState(true);
  const [labelPreset, setLabelPreset] = useState<LabelPreset>('generic-a4');

  const deviceLabelSignature = useMemo(() => {
    return layout.devices
      .map((device) => [
        device.id,
        device.name,
        device.label ?? '',
        device.category,
        device.positionU,
        device.sizeU,
        device.widthType,
        device.customWidthMm ?? '',
        device.mountType ?? '',
        device.mountSide0U ?? '',
        device.spatialZone ?? ''
      ].join(':'))
      .join('|');
  }, [layout.devices]);

  const patchPanelLabelSignature = useMemo(() => {
    const deviceSignature = layout.devices
      .map((device) => [
        device.id,
        device.name,
        device.category,
        device.positionU,
        device.sizeU,
        device.xMm ?? '',
        device.widthType,
        device.customWidthMm ?? '',
        device.mountSide ?? '',
        device.mountType ?? '',
        device.mountSide0U ?? '',
        device.spatialZone ?? '',
        device.portFaceOverrides ? JSON.stringify(device.portFaceOverrides) : ''
      ].join(':'))
      .join('|');
    const cableSignature = layout.cables
      .map((cable) => [
        cable.id,
        cable.type,
        cable.fromDeviceId,
        portSignature(cable.fromPort),
        cable.toDeviceId,
        portSignature(cable.toPort),
        cable.lengthMm ?? '',
        cable.nodes?.length ?? 0
      ].join(':'))
      .join('|');
    return [
      layout.rackType,
      layout.heightU,
      layout.rackDepthMm,
      layout.rearClearanceMm ?? '',
      layout.railMinDepthMm ?? '',
      layout.railMaxDepthMm ?? '',
      deviceSignature,
      cableSignature
    ].join('|');
  }, [
    layout.cables,
    layout.rackDepthMm,
    layout.devices,
    layout.heightU,
    layout.rackType,
    layout.railMaxDepthMm,
    layout.railMinDepthMm,
    layout.rearClearanceMm
  ]);

  const ruLabels = useMemo(() => {
    const labels: PrintableLabel[] = [];
    for (let unit = layout.heightU; unit >= 1; unit -= 1) {
      labels.push({ id: `ru-${unit}`, text: `U${unit}`, type: 'ru' });
    }
    return labels;
  }, [layout.heightU]);

  const deviceLabels = useMemo(() => {
    return layout.devices
      .filter((d) => !isZeroU(d))
      .map((device) => ({
        id: `device-${device.id}`,
        text: device.label || device.name,
        sub: `${device.positionU}U–${device.positionU + device.sizeU - 1}U · ${device.sizeU}U`,
        positionU: device.positionU,
        type: 'device' as const
      }))
      .sort((a, b) => b.positionU - a.positionU)
      .map((label) => ({
        id: label.id,
        text: label.text,
        sub: label.sub,
        type: label.type
      }));
  }, [deviceLabelSignature]);

  const blankLabels = useMemo(() => {
    if (!includeBlank) return [];
    const usedUnits = new Set<number>();
    layout.devices.forEach((d) => {
      if (isZeroU(d)) return;
      for (let u = d.positionU; u < d.positionU + d.sizeU; u += 1) {
        usedUnits.add(u);
      }
    });
    const blanks: PrintableLabel[] = [];
    for (let unit = layout.heightU; unit >= 1; unit -= 1) {
      if (!usedUnits.has(unit)) {
        blanks.push({ id: `blank-${unit}`, text: `U${unit}`, sub: 'Blank', type: 'ru' });
      }
    }
    return blanks;
  }, [deviceLabelSignature, layout.heightU, includeBlank]);

  const patchPanelLabels = useMemo(() => {
    const labels: PrintableLabel[] = [];
    const panels = layout.devices.filter((d) => d.category === 'patch-panel');
    for (const panel of panels) {
      const jacks = getPatchPanelJacks(layout, panel.id);
      for (const jack of jacks) {
        if (jack.frontCable && jack.frontPeer) {
          const plan = calculateCablePlan(jack.frontCable, layout);
          const length = plan ? `${Math.ceil(plan.standardLengthMm / 100) / 10}m` : undefined;
          const frontPort = jack.frontCable.fromDeviceId === panel.id ? jack.frontCable.toPort : jack.frontCable.fromPort;
          labels.push({
            id: `patch-${panel.id}-${jack.index}-front-${jack.frontCable.id}`,
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
            id: `patch-${panel.id}-${jack.index}-rear-${jack.rearCable.id}`,
            text: `${formatPresetLabel(panel.name, jack.index)} → ${jack.rearPeer.name}:${portLabel(rearPort)}`,
            type: 'patch-panel',
            length
          });
        }
      }
    }
    return labels;
  }, [patchPanelLabelSignature]);

  const visibleLabels = useMemo(() => {
    let labels: PrintableLabel[] = [];
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
        {visibleLabels.map((label) => (
          <div
            key={label.id}
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
