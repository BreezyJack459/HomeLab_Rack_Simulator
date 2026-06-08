import { describe, it, expect } from 'vitest';
import type { CableRoute, PlacedDevice } from '../types/rack';
import {
  generatePortLabel,
  generateCableLabel,
  generateAllCableLabels,
  detectLabelInconsistencies,
  exportCableLabelsCsv,
  exportCableLabelsMarkdown,
} from './cableLabeling';

function makeDevice(overrides: Partial<PlacedDevice> = {}): PlacedDevice {
  return {
    id: 'dev-1',
    name: 'Switch-A',
    category: 'switch',
    positionU: 1,
    sizeU: 1,
    depthMm: 400,
    widthType: '19in',
    weightKg: 5,
    powerW: 100,
    heatLevel: 2,
    color: '#333',
    ...overrides,
  };
}

function makeCable(overrides: Partial<CableRoute> = {}): CableRoute {
  return {
    id: 'c1',
    fromDeviceId: 'dev-1',
    fromPort: { type: 'ethernet', index: 0 },
    toDeviceId: 'dev-2',
    toPort: { type: 'ethernet', index: 1 },
    type: 'ethernet',
    color: '#3b82f6',
    ...overrides,
  };
}

describe('generatePortLabel', () => {
  it('formats port label with uppercase type and 1-based index', () => {
    expect(generatePortLabel('Switch-A', { type: 'ethernet', index: 0 })).toBe('Switch-A:ETHERNET1');
    expect(generatePortLabel('NAS-1', { type: 'power', index: 2 })).toBe('NAS-1:POWER3');
  });

  it('returns question mark for missing port', () => {
    expect(generatePortLabel('Device-A', undefined)).toBe('Device-A:?');
  });
});

describe('generateCableLabel', () => {
  it('generates full label with rack prefix', () => {
    const cable = makeCable();
    const devices = [makeDevice(), { ...makeDevice(), id: 'dev-2', name: 'Server-1' }];
    const map = new Map(devices.map((d) => [d.id, d]));
    const label = generateCableLabel(cable, map, 'R1');

    expect(label.cableId).toBe('c1');
    expect(label.fromLabel).toBe('Switch-A:ETHERNET1');
    expect(label.toLabel).toBe('Server-1:ETHERNET2');
    expect(label.bothEnds).toBe('R1-Switch-A:ETHERNET1 <-> R1-Server-1:ETHERNET2');
    expect(label.type).toBe('ethernet');
  });

  it('falls back to device ID when device not found', () => {
    const cable = makeCable();
    const map = new Map<string, PlacedDevice>();
    const label = generateCableLabel(cable, map, 'R1');

    expect(label.fromLabel).toBe('dev-1:ETHERNET1');
    expect(label.toLabel).toBe('dev-2:ETHERNET2');
  });
});

describe('generateAllCableLabels', () => {
  it('generates labels for all cables', () => {
    const cables: CableRoute[] = [
      makeCable(),
      { ...makeCable(), id: 'c2', fromPort: { type: 'fiber', index: 3 } },
    ];
    const devices = [makeDevice(), { ...makeDevice(), id: 'dev-2', name: 'Server-1' }];
    const labels = generateAllCableLabels(cables, devices, 'R1');

    expect(labels).toHaveLength(2);
    expect(labels[0].bothEnds).toContain('Switch-A:ETHERNET1');
    expect(labels[1].bothEnds).toContain('Switch-A:FIBER4');
  });
});

describe('detectLabelInconsistencies', () => {
  it('returns empty for valid cables', () => {
    const cables: CableRoute[] = [makeCable()];
    const devices = [makeDevice(), { ...makeDevice(), id: 'dev-2', name: 'Server-1' }];
    const issues = detectLabelInconsistencies(cables, devices);
    expect(issues).toHaveLength(0);
  });

  it('detects self-loops', () => {
    const cables: CableRoute[] = [makeCable({ toDeviceId: 'dev-1' })];
    const devices = [makeDevice()];
    const issues = detectLabelInconsistencies(cables, devices);
    expect(issues.some((i) => i.issue === 'self-loop')).toBe(true);
  });

  it('detects orphaned devices', () => {
    const cables: CableRoute[] = [makeCable()];
    const devices: PlacedDevice[] = [makeDevice()]; // dev-2 missing
    const issues = detectLabelInconsistencies(cables, devices);
    expect(issues.some((i) => i.issue === 'orphaned-device')).toBe(true);
  });

  it('detects missing ports', () => {
    const cables: CableRoute[] = [makeCable({ fromPort: undefined })];
    const devices = [makeDevice(), { ...makeDevice(), id: 'dev-2', name: 'Server-1' }];
    const issues = detectLabelInconsistencies(cables, devices);
    expect(issues.some((i) => i.issue === 'missing-port')).toBe(true);
  });

  it('detects duplicate source ports', () => {
    const cables: CableRoute[] = [
      makeCable({ id: 'c1' }),
      makeCable({ id: 'c2', toDeviceId: 'dev-3', toPort: { type: 'ethernet', index: 5 } }),
    ];
    const devices = [
      makeDevice(),
      { ...makeDevice(), id: 'dev-2', name: 'Server-1' },
      { ...makeDevice(), id: 'dev-3', name: 'Server-2' },
    ];
    const issues = detectLabelInconsistencies(cables, devices);
    expect(issues.filter((i) => i.issue === 'duplicate-source')).toHaveLength(2);
  });
});

describe('exportCableLabelsCsv', () => {
  it('produces header row', () => {
    const csv = exportCableLabelsCsv([]);
    expect(csv).toContain('Cable ID,From,To,Both Ends,Type,Length');
  });

  it('includes cable labels', () => {
    const labels = [
      {
        cableId: 'c1',
        fromLabel: 'A:ETH1',
        toLabel: 'B:ETH2',
        bothEnds: 'R1-A:ETH1 <-> R1-B:ETH2',
        type: 'ethernet',
        length: '1m',
      },
    ];
    const csv = exportCableLabelsCsv(labels);
    expect(csv).toContain('c1');
    expect(csv).toContain('A:ETH1');
    expect(csv).toContain('R1-A:ETH1 <-> R1-B:ETH2');
  });
});

describe('exportCableLabelsMarkdown', () => {
  it('includes summary', () => {
    const md = exportCableLabelsMarkdown([], []);
    expect(md).toContain('# Cable Label Protocol');
    expect(md).toContain('**Total Cables:** 0');
  });

  it('includes inconsistency section', () => {
    const md = exportCableLabelsMarkdown(
      [],
      [{ cableId: 'c1', issue: 'self-loop', message: 'Self connection' }]
    );
    expect(md).toContain('## Inconsistencies');
    expect(md).toContain('Self connection');
  });
});
