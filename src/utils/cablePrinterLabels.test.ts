import { describe, expect, it } from 'vitest';
import { cablePrinterLabels, printerLabelsCsv, printerLabelsText } from './cablePrinterLabels';
import type { CableRoute, PlacedDevice, RackLayout } from '../types/rack';
const devices = [
  { id: 'a', name: 'Server', label: 'Machine A', category: 'server', portAliases: { 'ethernet:1': 'Storage LAN' } },
  { id: 'b', name: 'Panel', category: 'patch-panel' },
] as PlacedDevice[];
const cable: CableRoute = { id: 'c', fromDeviceId: 'a', toDeviceId: 'b', fromPort: { type: 'ethernet', index: 1, side: 'rear' }, toPort: { type: 'ethernet', index: 3, side: 'front' }, type: 'ethernet', color: '#fff' };
const layout = { devices, cables: [cable] } as RackLayout;
describe('printer labels', () => {
  it('uses device labels, aliases, exact one-based ports and faces with real newlines', () => {
    expect(cablePrinterLabels(layout, cable, 'two-line')).toEqual(['Machine A · Storage LAN (rear)\nPanel · LAN 4 (front)']);
    expect(cablePrinterLabels(layout, cable, 'single-line')[0]).not.toContain('\n');
  });
  it('reverses both-end labels and separates batches without replacing line breaks', () => {
    const labels = cablePrinterLabels(layout, cable, 'both-ends');
    expect(labels[1]).toBe('Panel · LAN 4 (front)\n→ Machine A · Storage LAN (rear)');
    expect(printerLabelsText(labels)).toBe(labels.join('\n\n'));
    expect(printerLabelsText(labels, 'tab')).toBe(labels.join('\t'));
  });
  it('exports one CSV row per physical label with escaped device names', () => {
    const renamed = { ...layout, devices: [{ ...devices[0], label: 'Machine "A", lab' }, devices[1]] };
    const csv = printerLabelsCsv(renamed, [cable], 'both-ends');
    expect(csv.split('\r\n')).toHaveLength(3);
    expect(csv).toContain('Machine ""A"", lab');
  });
  it('keeps missing endpoints visible rather than inventing a port', () => {
    expect(cablePrinterLabels(layout, { ...cable, fromDeviceId: 'missing', fromPort: undefined }, 'two-line')[0]).toContain('missing · Port not assigned');
  });
});
