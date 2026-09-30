import type { CableRoute, RackLayout } from '../types/rack';
import { formatCableEndpoint } from './cableEndpoints';

export type PrinterLabelFormat = 'two-line' | 'single-line' | 'both-ends';
export const cablePrinterLabels = (layout: RackLayout, cable: CableRoute, format: PrinterLabelFormat): string[] => {
  const from = formatCableEndpoint(layout.devices.find(d => d.id === cable.fromDeviceId), cable.fromPort, cable.fromDeviceId);
  const to = formatCableEndpoint(layout.devices.find(d => d.id === cable.toDeviceId), cable.toPort, cable.toDeviceId);
  if (format === 'single-line') return [`${from} → ${to}`];
  if (format === 'both-ends') return [`${from}\n→ ${to}`, `${to}\n→ ${from}`];
  return [`${from}\n${to}`];
};
export const printerLabelsText = (labels: string[], separator: 'blank-line' | 'tab' = 'blank-line'): string => labels.join(separator === 'tab' ? '\t' : '\n\n');
const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
export const printerLabelsCsv = (layout: RackLayout, cables: CableRoute[], format: PrinterLabelFormat): string => [
  'Cable ID,Label,Line 1,Line 2',
  ...cables.flatMap(c => cablePrinterLabels(layout, c, format).map((label, i) => {
    const [line1, line2 = ''] = label.split('\n');
    return [c.id, String(i + 1), line1, line2].map(csvCell).join(',');
  })),
].join('\r\n');
