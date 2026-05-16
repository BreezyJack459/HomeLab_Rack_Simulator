import { describe, it, expect } from 'vitest';
import type { RackLayout } from '../types/rack';
import {
  calculateLabelDebt,
  exportLabelDebtCsv,
  exportLabelDebtMarkdown,
} from './labelDebt';

function makeLayout(overrides: Partial<RackLayout> = {}): RackLayout {
  return {
    id: 'rack-1',
    name: 'Test Rack',
    rackType: '19in',
    heightU: 12,
    rackDepthMm: 600,
    powerBudgetW: 1000,
    weightLimitKg: 200,
    viewSide: 'front',
    devices: [],
    cables: [],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('calculateLabelDebt', () => {
  it('returns perfect score for empty layout', () => {
    const layout = makeLayout();
    const report = calculateLabelDebt(layout);
    expect(report.overallScore).toBe(100);
    expect(report.totalIssues).toBe(0);
    expect(report.issues).toHaveLength(0);
  });

  it('flags device missing label', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'd1',
          name: 'Switch',
          category: 'switch',
          positionU: 1,
          sizeU: 1,
          depthMm: 300,
          widthType: '19in',
          weightKg: 4,
          powerW: 40,
          heatLevel: 2,
          color: '#333',
          serialNumber: 'SN123',
          assetTag: 'AT001',
        },
      ],
    });
    const report = calculateLabelDebt(layout);
    expect(report.issues.some((i) => i.type === 'device-missing-label')).toBe(true);
    expect(report.totalIssues).toBeGreaterThan(0);
  });

  it('flags device missing serial and asset tag', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'd1',
          name: 'Router',
          category: 'router',
          positionU: 1,
          sizeU: 1,
          depthMm: 250,
          widthType: '19in',
          weightKg: 3,
          powerW: 30,
          heatLevel: 1,
          color: '#555',
          label: 'RTR-01',
        },
      ],
    });
    const report = calculateLabelDebt(layout);
    expect(report.issues.some((i) => i.type === 'device-missing-serial')).toBe(true);
    expect(report.issues.some((i) => i.type === 'device-missing-asset-tag')).toBe(true);
    expect(report.issues.some((i) => i.type === 'device-missing-label')).toBe(false);
  });

  it('flags cable missing port assignment', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'd1',
          name: 'Switch',
          category: 'switch',
          positionU: 1,
          sizeU: 1,
          depthMm: 300,
          widthType: '19in',
          weightKg: 4,
          powerW: 40,
          heatLevel: 2,
          color: '#333',
          label: 'SW-01',
          serialNumber: 'SN1',
          assetTag: 'AT1',
        },
        {
          id: 'd2',
          name: 'Server',
          category: 'server',
          positionU: 2,
          sizeU: 1,
          depthMm: 400,
          widthType: '19in',
          weightKg: 8,
          powerW: 100,
          heatLevel: 2,
          color: '#222',
          label: 'SRV-01',
          serialNumber: 'SN2',
          assetTag: 'AT2',
        },
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'd1',
          toDeviceId: 'd2',
          type: 'ethernet',
          color: '#3b82f6',
        },
      ],
    });
    const report = calculateLabelDebt(layout);
    expect(report.issues.some((i) => i.type === 'cable-missing-port')).toBe(true);
  });

  it('flags cable self-loop', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'd1',
          name: 'Switch',
          category: 'switch',
          positionU: 1,
          sizeU: 1,
          depthMm: 300,
          widthType: '19in',
          weightKg: 4,
          powerW: 40,
          heatLevel: 2,
          color: '#333',
          label: 'SW-01',
          serialNumber: 'SN1',
          assetTag: 'AT1',
        },
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'd1',
          fromPort: { type: 'ethernet', index: 0 },
          toDeviceId: 'd1',
          toPort: { type: 'ethernet', index: 1 },
          type: 'ethernet',
          color: '#3b82f6',
        },
      ],
    });
    const report = calculateLabelDebt(layout);
    expect(report.issues.some((i) => i.type === 'cable-self-loop')).toBe(true);
  });

  it('flags orphaned cable', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'd1',
          name: 'Switch',
          category: 'switch',
          positionU: 1,
          sizeU: 1,
          depthMm: 300,
          widthType: '19in',
          weightKg: 4,
          powerW: 40,
          heatLevel: 2,
          color: '#333',
          label: 'SW-01',
          serialNumber: 'SN1',
          assetTag: 'AT1',
        },
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'd1',
          fromPort: { type: 'ethernet', index: 0 },
          toDeviceId: 'd2',
          toPort: { type: 'ethernet', index: 1 },
          type: 'ethernet',
          color: '#3b82f6',
        },
      ],
    });
    const report = calculateLabelDebt(layout);
    expect(report.issues.some((i) => i.type === 'cable-orphaned')).toBe(true);
  });

  it('flags reservation missing name', () => {
    const layout = makeLayout({
      reservations: [
        {
          id: 'r1',
          name: '',
          positionU: 5,
          sizeU: 1,
          mountSide: 'front',
          widthType: '19in',
          purpose: 'future-device',
        },
      ],
    });
    const report = calculateLabelDebt(layout);
    expect(report.issues.some((i) => i.type === 'reservation-missing-name')).toBe(true);
  });

  it('assigns correct zones based on U position', () => {
    const layout = makeLayout({
      heightU: 12,
      devices: [
        {
          id: 'd1',
          name: 'TopSwitch',
          category: 'switch',
          positionU: 12,
          sizeU: 1,
          depthMm: 300,
          widthType: '19in',
          weightKg: 4,
          powerW: 40,
          heatLevel: 2,
          color: '#333',
          label: 'SW-01',
          serialNumber: 'SN1',
          assetTag: 'AT1',
        },
        {
          id: 'd2',
          name: 'MidServer',
          category: 'server',
          positionU: 6,
          sizeU: 1,
          depthMm: 400,
          widthType: '19in',
          weightKg: 8,
          powerW: 100,
          heatLevel: 2,
          color: '#222',
          label: 'SRV-01',
          serialNumber: 'SN2',
          assetTag: 'AT2',
        },
        {
          id: 'd3',
          name: 'BotRouter',
          category: 'router',
          positionU: 1,
          sizeU: 1,
          depthMm: 250,
          widthType: '19in',
          weightKg: 3,
          powerW: 30,
          heatLevel: 1,
          color: '#555',
          label: 'RTR-01',
          serialNumber: 'SN3',
          assetTag: 'AT3',
        },
      ],
    });
    const report = calculateLabelDebt(layout);
    expect(report.overallScore).toBe(100);
    expect(report.zoneScores.find((z) => z.zone === 'upper')?.totalEntities).toBe(1);
    expect(report.zoneScores.find((z) => z.zone === 'middle')?.totalEntities).toBe(1);
    expect(report.zoneScores.find((z) => z.zone === 'lower')?.totalEntities).toBe(1);
  });

  it('returns perfect score when everything is labeled', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'd1',
          name: 'Switch',
          category: 'switch',
          positionU: 1,
          sizeU: 1,
          depthMm: 300,
          widthType: '19in',
          weightKg: 4,
          powerW: 40,
          heatLevel: 2,
          color: '#333',
          label: 'SW-01',
          serialNumber: 'SN1',
          assetTag: 'AT1',
        },
      ],
      cables: [],
    });
    const report = calculateLabelDebt(layout);
    expect(report.overallScore).toBe(100);
    expect(report.totalIssues).toBe(0);
  });
});

describe('exportLabelDebtMarkdown', () => {
  it('includes report header', () => {
    const report = calculateLabelDebt(makeLayout());
    const md = exportLabelDebtMarkdown(report, 'Test Rack');
    expect(md).toContain('# Label Debt Report — Test Rack');
    expect(md).toContain('**Overall Score:**');
  });

  it('includes zone breakdown', () => {
    const report = calculateLabelDebt(makeLayout());
    const md = exportLabelDebtMarkdown(report, 'Test');
    expect(md).toContain('## Zone Breakdown');
    expect(md).toContain('| Zone | Entities | Issues | Score |');
  });
});

describe('exportLabelDebtCsv', () => {
  it('produces header row', () => {
    const report = calculateLabelDebt(makeLayout());
    const csv = exportLabelDebtCsv(report);
    expect(csv).toContain('ID,Type,Severity,Entity Type,Entity ID,Message,Zone');
  });

  it('includes issue rows', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'd1',
          name: 'Switch',
          category: 'switch',
          positionU: 1,
          sizeU: 1,
          depthMm: 300,
          widthType: '19in',
          weightKg: 4,
          powerW: 40,
          heatLevel: 2,
          color: '#333',
        },
      ],
    });
    const report = calculateLabelDebt(layout);
    const csv = exportLabelDebtCsv(report);
    expect(csv).toContain('device-missing-label');
  });
});
