import { describe, it, expect } from 'vitest';
import type { PlacedDevice, RackLayout } from '../types/rack';
import {
  generatePortfolioMarkdown,
  DEFAULT_PORTFOLIO_OPTIONS,
  exportPortfolioMarkdown,
} from './portfolioExport';

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

describe('generatePortfolioMarkdown', () => {
  it('includes rack overview with default options', () => {
    const layout = makeLayout();
    const md = generatePortfolioMarkdown(layout);
    expect(md).toContain('# Test Rack — Homelab Portfolio');
    expect(md).toContain('## Rack Overview');
    expect(md).toContain('| Rack Type | 19-inch |');
    expect(md).toContain('| Devices | 0 |');
  });

  it('excludes overview when toggled off', () => {
    const layout = makeLayout();
    const md = generatePortfolioMarkdown(layout, {
      ...DEFAULT_PORTFOLIO_OPTIONS,
      includeOverview: false,
    });
    expect(md).not.toContain('## Rack Overview');
  });

  it('includes device inventory with categories', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'd1',
          name: 'Core Switch',
          category: 'switch',
          positionU: 1,
          sizeU: 1,
          depthMm: 300,
          widthType: '19in',
          weightKg: 5,
          powerW: 50,
          heatLevel: 2,
          color: '#333',
        },
        {
          id: 'd2',
          name: 'Router',
          category: 'router',
          positionU: 2,
          sizeU: 1,
          depthMm: 250,
          widthType: '19in',
          weightKg: 3,
          powerW: 30,
          heatLevel: 1,
          color: '#555',
        },
      ],
    });
    const md = generatePortfolioMarkdown(layout, {
      ...DEFAULT_PORTFOLIO_OPTIONS,
      redactSensitive: false,
    });
    expect(md).toContain('## Device Inventory');
    expect(md).toContain('🔀 Switch (1)');
    expect(md).toContain('🌐 Router (1)');
    expect(md).toContain('**Core Switch** @ U1');
    expect(md).toContain('**Router** @ U2');
  });

  it('redacts sensitive values when enabled', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'd1',
          name: 'SecretDevice',
          category: 'server',
          positionU: 1,
          sizeU: 1,
          depthMm: 400,
          widthType: '19in',
          weightKg: 8,
          powerW: 100,
          heatLevel: 2,
          color: '#222',
          serialNumber: 'SN12345678',
          assetTag: 'AT-999',
        },
      ],
    });
    const md = generatePortfolioMarkdown(layout, {
      ...DEFAULT_PORTFOLIO_OPTIONS,
      redactSensitive: true,
    });
    expect(md).toContain('**Se***ce**');
    expect(md).toContain('Serial: SN***78');
    expect(md).toContain('Asset: AT***99');
  });

  it('does not redact when redactSensitive is false', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'd1',
          name: 'MyServer',
          category: 'server',
          positionU: 1,
          sizeU: 1,
          depthMm: 400,
          widthType: '19in',
          weightKg: 8,
          powerW: 100,
          heatLevel: 2,
          color: '#222',
          serialNumber: 'ABC123',
          assetTag: 'TAG01',
        },
      ],
    });
    const md = generatePortfolioMarkdown(layout, {
      ...DEFAULT_PORTFOLIO_OPTIONS,
      redactSensitive: false,
    });
    expect(md).toContain('**MyServer**');
    expect(md).toContain('Serial: ABC123');
    expect(md).toContain('Asset: TAG01');
  });

  it('includes topology section', () => {
    const layout = makeLayout({
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'd1',
          fromPort: { type: 'ethernet', index: 0 },
          toDeviceId: 'd2',
          toPort: { type: 'ethernet', index: 1 },
          type: 'ethernet',
          color: '#3b82f6',
          lengthMm: 1000,
        },
      ],
    });
    const md = generatePortfolioMarkdown(layout);
    expect(md).toContain('## Network Topology');
    expect(md).toContain('**Cable Connections:** 1');
    expect(md).toContain('### Cable Breakdown');
    expect(md).toContain('- ethernet: 1');
  });

  it('includes power & energy section', () => {
    const layout = makeLayout();
    const md = generatePortfolioMarkdown(layout);
    expect(md).toContain('## Power & Energy');
    expect(md).toContain('| Attributed Input |');
    expect(md).toContain('| Monthly kWh |');
  });

  it('includes redundancy section', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'ups1',
          name: 'UPS',
          category: 'ups',
          positionU: 1,
          sizeU: 2,
          depthMm: 400,
          widthType: '19in',
          weightKg: 15,
          powerW: 0,
          heatLevel: 1,
          color: '#000',
        },
      ],
    });
    const md = generatePortfolioMarkdown(layout);
    expect(md).toContain('## Redundancy & Resilience');
    expect(md).toContain('| UPS Units | 1 |');
  });

  it('does not infer redundancy from boot dependencies or cable counts', () => {
    const common = { sizeU: 1, positionU: 1, widthType: '19in' as const, depthMm: 100, weightKg: 1, powerW: 10, heatLevel: 1 as const, color: '#333' };
    const devices: PlacedDevice[] = [
      { ...common, id: 'a', name: 'A', category: 'pdu', circuit: 'A', ports: { power: 1 } },
      { ...common, id: 'b', name: 'B', category: 'pdu', circuit: 'B', ports: { power: 1 } },
      { ...common, id: 'load', name: 'Load', category: 'server', ports: { power: 2 }, bootDependsOn: ['a'] },
    ];
    const layout = makeLayout({ devices, cables: [0, 1, 2].map(index => ({ id: `data${index}`, type: 'ethernet', fromDeviceId: 'a', toDeviceId: 'load', color: '#333' })) });
    const report = generatePortfolioMarkdown(layout);
    expect(report).toContain('| Devices with modeled A/B power paths | 0 |');
    expect(report).toContain('| Network redundancy | Not verified |');
    expect(report).not.toContain('Dual-PSU Devices');
    layout.cables = ['a', 'b'].map((id, index) => ({ id, type: 'power', fromDeviceId: id, toDeviceId: 'load', color: '#333', fromPort: { type: 'power', index: 0 }, toPort: { type: 'power', index } }));
    expect(generatePortfolioMarkdown(layout)).toContain('| Devices with modeled A/B power paths | 1 |');
    layout.devices[1].circuit = 'A';
    expect(generatePortfolioMarkdown(layout)).toContain('| Devices with modeled A/B power paths | 0 |');
  });

  it('includes backup posture section', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'nas1',
          name: 'NAS',
          category: 'nas',
          positionU: 1,
          sizeU: 1,
          depthMm: 350,
          widthType: '19in',
          weightKg: 6,
          powerW: 50,
          heatLevel: 1,
          color: '#444',
          backups: [
            {
              id: 'b1',
              destination: 'External Drive',
              notes: 'Daily backup',
              lastRestoreTestDate: '2026-05-01',
            },
          ],
        },
      ],
    });
    const md = generatePortfolioMarkdown(layout);
    expect(md).toContain('## Backup Posture');
    expect(md).toContain('| Devices with Backups | 1 / 1 |');
  });

  it('includes cable summary section', () => {
    const layout = makeLayout({
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
    const md = generatePortfolioMarkdown(layout);
    expect(md).toContain('## Cable Summary');
    expect(md).toContain('**Total Cables:** 1');
  });

  it('includes skills demonstrated section', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'sw1',
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
    const md = generatePortfolioMarkdown(layout);
    expect(md).toContain('## Planning Topics');
    expect(md).toContain('- Network design (VLANs, routing, switching)');
  });

  it('excludes skills when toggled off', () => {
    const layout = makeLayout();
    const md = generatePortfolioMarkdown(layout, {
      ...DEFAULT_PORTFOLIO_OPTIONS,
      includeSkills: false,
    });
    expect(md).not.toContain('## Planning Topics');
  });

  it('produces valid markdown for empty layout', () => {
    const layout = makeLayout();
    const md = generatePortfolioMarkdown(layout);
    expect(md).toContain('*Generated by Homelab Rack Simulator*');
    expect(md).toContain('*Sensitive values redacted*');
  });

  it('shows full data export note when redaction disabled', () => {
    const layout = makeLayout();
    const md = generatePortfolioMarkdown(layout, {
      ...DEFAULT_PORTFOLIO_OPTIONS,
      redactSensitive: false,
    });
    expect(md).toContain('*Full data export*');
  });
});

describe('exportPortfolioMarkdown', () => {
  it('returns the same output as generatePortfolioMarkdown', () => {
    const layout = makeLayout();
    expect(exportPortfolioMarkdown(layout)).toBe(
      generatePortfolioMarkdown(layout)
    );
  });
});
