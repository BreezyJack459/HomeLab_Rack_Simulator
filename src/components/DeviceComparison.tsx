import type { DeviceTemplate, RackLayout } from '../types/rack';
import { getDeviceDimensionProblems } from '../utils/devicePlacement';
import { getPowerReference, POWER_BASIS_LABELS } from '../utils/powerAssumptions';
import { PORT_TYPE_NAMES } from '../utils/cableEndpoints';
import { WorkspaceDialog } from './WorkspaceDialog';

export function DeviceComparison({ devices, layout, onClose }: {
  devices: DeviceTemplate[]; layout: RackLayout; onClose: () => void;
}) {
  const rows: { label: string; value: (d: DeviceTemplate) => string }[] = [
    { label: 'Rack size', value: d => d.rackMountable === false ? 'External device' : d.defaultU === 0 ? `0U · ${d.physicalHeightMm ?? 'Unknown'} mm long` : `${d.defaultU}U` },
    { label: 'Width / depth', value: d => `${d.customWidthMm !== undefined ? `${d.customWidthMm} mm` : d.widthType} / ${d.depthMm} mm` },
    { label: 'Weight', value: d => Number.isFinite(d.weightKg) ? `${d.weightKg.toFixed(2)} kg` : 'Unknown' },
    { label: 'Initial planning load', value: d => `${d.powerW} W · review for your workload` },
    { label: 'Power reference', value: d => { const r = getPowerReference(d); return `${r.watts} W · ${POWER_BASIS_LABELS[r.basis]} · ${r.source || 'Source not recorded'}`; } },
    { label: 'Rated output', value: d => ['ups', 'pdu', 'pdu-0u'].includes(d.category) ? d.powerCapacityW === undefined ? 'Unknown — not verified' : `${d.powerCapacityW} W` : 'Not a modeled supply' },
    { label: 'Output rating reference', value: d => { const r = d.powerCapacityReference; return r ? `${r.watts} W · ${r.model} · Checked ${r.checkedAt} · ${r.source}` : 'Source not recorded'; } },
    { label: 'Recorded ports', value: d => Object.entries(d.ports ?? {}).filter(([type, count]) => type in PORT_TYPE_NAMES && count > 0).map(([type, count]) => `${PORT_TYPE_NAMES[type as keyof typeof PORT_TYPE_NAMES]}: ${count}`).join(' · ') || 'Not recorded' },
    { label: 'Recorded port speeds', value: d => [...new Set(Object.values(d.portLayouts ?? {}).flat().map(p => p.speed).filter(Boolean))].join(' · ') || 'Unknown — not verified' },
    { label: 'Installation support', value: d => d.installationRequirements?.support === 'unknown' || !d.installationRequirements ? 'Unknown — not verified' : d.installationRequirements.support },
    { label: 'Rail spacing requirement', value: d => { const r = d.installationRequirements; return r?.support !== 'rails' ? 'Not specified' : `${r.railMinMm ?? 'Unknown'}–${r.railMaxMm ?? 'Unknown'} mm`; } },
    { label: 'Rear working clearance', value: d => d.installationRequirements?.rearClearanceMm === undefined ? 'Unknown — not verified' : `${d.installationRequirements.rearClearanceMm} mm` },
    { label: 'Installation source / kit', value: d => [d.installationRequirements?.source, d.installationKit].filter(Boolean).join(' · ') || 'Not recorded' },
    { label: 'Current rack dimensions', value: d => getDeviceDimensionProblems(layout, d).map(p => p.message).join(' ') || 'Fits recorded dimensions; space and installation still need checking' },
    { label: 'Catalog notes', value: d => d.description || 'Not recorded' },
  ];
  return <WorkspaceDialog title="Compare devices" onClose={onClose}>
    <p className="mb-3 text-sm text-content-muted">Catalog values are planning references. Unknown specifications are not passes. Verify your exact hardware, kit and workload before buying or installing.</p>
    <p className="mb-2 text-xs text-content-muted">Scroll horizontally to compare all selected devices.</p>
    <div className="overflow-x-auto" role="region" aria-label="Device specification comparison" tabIndex={0}>
      <table className="w-full border-collapse text-left text-xs">
        <caption className="sr-only">Catalog specifications compared against the current rack</caption>
        <thead><tr><th className="min-w-32 border-b border-edge p-2">Specification</th>{devices.map(d => <th key={d.id} scope="col" className="min-w-44 border-b border-edge p-2 align-top">{d.name}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.label}><th scope="row" className="border-b border-edge p-2 align-top font-medium">{row.label}</th>{devices.map(d => <td key={d.id} className="border-b border-edge p-2 align-top text-content-secondary">{row.value(d)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  </WorkspaceDialog>;
}
