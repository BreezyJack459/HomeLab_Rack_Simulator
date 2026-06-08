import { describe, it, expect } from 'vitest';
import type { CableLengthAuditEntry, CableRoute, PlacedDevice } from '../types/rack';
import {
  compareCableLengths,
  findExcessCables,
  summarizeCableLengthAudits,
  exportCableLengthAuditCsv,
  exportCableLengthAuditMarkdown,
} from './cableLengthAudit';

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

describe('compareCableLengths', () => {
  it('flags exact match', () => {
    const cables: CableRoute[] = [makeCable({ lengthMm: 1000 })];
    const audits: CableLengthAuditEntry[] = [{ cableId: 'c1', actualLengthMm: 1000 }];
    const devices = [makeDevice(), { ...makeDevice(), id: 'dev-2', name: 'Server-1' }];

    const result = compareCableLengths(cables, audits, devices);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('exact');
    expect(result[0].differenceMm).toBe(0);
    expect(result[0].differencePercent).toBe(0);
  });

  it('flags close match within tolerance', () => {
    const cables: CableRoute[] = [makeCable({ lengthMm: 1000 })];
    const audits: CableLengthAuditEntry[] = [{ cableId: 'c1', actualLengthMm: 1050 }];
    const devices = [makeDevice(), { ...makeDevice(), id: 'dev-2', name: 'Server-1' }];

    const result = compareCableLengths(cables, audits, devices);
    expect(result[0].status).toBe('close');
    expect(result[0].differenceMm).toBe(50);
    expect(result[0].differencePercent).toBe(5);
  });

  it('flags mismatch outside tolerance', () => {
    const cables: CableRoute[] = [makeCable({ lengthMm: 1000 })];
    const audits: CableLengthAuditEntry[] = [{ cableId: 'c1', actualLengthMm: 1200 }];
    const devices = [makeDevice(), { ...makeDevice(), id: 'dev-2', name: 'Server-1' }];

    const result = compareCableLengths(cables, audits, devices);
    expect(result[0].status).toBe('mismatch');
    expect(result[0].differencePercent).toBe(20);
  });

  it('flags missing actual length', () => {
    const cables: CableRoute[] = [makeCable({ lengthMm: 1000 })];
    const audits: CableLengthAuditEntry[] = [];
    const devices = [makeDevice(), { ...makeDevice(), id: 'dev-2', name: 'Server-1' }];

    const result = compareCableLengths(cables, audits, devices);
    expect(result[0].status).toBe('missing-actual');
  });

  it('flags missing planned length', () => {
    const cables: CableRoute[] = [makeCable()];
    const audits: CableLengthAuditEntry[] = [{ cableId: 'c1', actualLengthMm: 1000 }];
    const devices = [makeDevice(), { ...makeDevice(), id: 'dev-2', name: 'Server-1' }];

    const result = compareCableLengths(cables, audits, devices);
    expect(result[0].status).toBe('missing-planned');
  });

  it('falls back to device ID when name unknown', () => {
    const cables: CableRoute[] = [makeCable()];
    const audits: CableLengthAuditEntry[] = [];
    const devices: PlacedDevice[] = [];

    const result = compareCableLengths(cables, audits, devices);
    expect(result[0].fromDeviceName).toBe('dev-1');
    expect(result[0].toDeviceName).toBe('dev-2');
  });
});

describe('findExcessCables', () => {
  it('groups by rounded length', () => {
    const cables: CableRoute[] = [
      makeCable({ id: 'c1' }),
      makeCable({ id: 'c2' }),
      makeCable({ id: 'c3' }),
    ];
    const audits: CableLengthAuditEntry[] = [
      { cableId: 'c1', actualLengthMm: 1050 },
      { cableId: 'c2', actualLengthMm: 1080 },
      { cableId: 'c3', actualLengthMm: 2000 },
    ];

    const excess = findExcessCables(cables, audits);
    expect(excess).toHaveLength(2);
    expect(excess[0].lengthMm).toBe(1100); // 1050 and 1080 round to 1100
    expect(excess[0].count).toBe(2);
    expect(excess[1].lengthMm).toBe(2000);
    expect(excess[1].count).toBe(1);
  });
});

describe('summarizeCableLengthAudits', () => {
  it('returns correct counts', () => {
    const comparisons = [
      { status: 'exact' },
      { status: 'close' },
      { status: 'mismatch' },
      { status: 'missing-actual' },
    ] as ReturnType<typeof compareCableLengths>;

    const summary = summarizeCableLengthAudits(comparisons);
    expect(summary.totalCables).toBe(4);
    expect(summary.exactCount).toBe(1);
    expect(summary.closeCount).toBe(1);
    expect(summary.mismatchCount).toBe(1);
    expect(summary.missingActualCount).toBe(1);
  });
});

describe('exportCableLengthAuditCsv', () => {
  it('produces header row', () => {
    const csv = exportCableLengthAuditCsv([]);
    expect(csv).toContain('Cable ID,From,To,Planned,Actual,Difference');
  });

  it('includes comparisons', () => {
    const comparisons = [
      {
        cableId: 'c1',
        fromDeviceName: 'A',
        toDeviceName: 'B',
        plannedLengthDisplay: '1.00m',
        actualLengthDisplay: '1.05m',
        differenceMm: 50,
        differencePercent: 5,
        status: 'close',
      },
    ] as ReturnType<typeof compareCableLengths>;

    const csv = exportCableLengthAuditCsv(comparisons);
    expect(csv).toContain('c1');
    expect(csv).toContain('1.00m');
    expect(csv).toContain('close');
  });
});

describe('exportCableLengthAuditMarkdown', () => {
  it('includes summary', () => {
    const md = exportCableLengthAuditMarkdown([], []);
    expect(md).toContain('# Cable Length Audit');
    expect(md).toContain('**Total Cables:** 0');
  });

  it('includes excess cable inventory', () => {
    const md = exportCableLengthAuditMarkdown([], [{ lengthMm: 1000, count: 3 }]);
    expect(md).toContain('## Excess Cable Inventory');
    expect(md).toContain('1.0m: 3 cable(s)');
  });
});
