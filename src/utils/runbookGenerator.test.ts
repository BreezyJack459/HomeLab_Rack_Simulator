import { describe, it, expect } from 'vitest';
import type { RackLayout } from '../types/rack';
import {
  generateInternetDownRunbook,
  generateNasUnreachableRunbook,
  generateWifiDownRunbook,
  generateUpsBeepingRunbook,
  generateNoManagementAccessRunbook,
  generateSlowPerformanceRunbook,
  generateAllRunbooks,
  exportRunbooksMarkdown,
  findRunbookById,
} from './runbookGenerator';

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

describe('generateInternetDownRunbook', () => {
  it('generates steps for empty layout', () => {
    const layout = makeLayout();
    const runbook = generateInternetDownRunbook(layout);
    expect(runbook.id).toBe('internet-down');
    expect(runbook.title).toBe('Internet Down');
    expect(runbook.steps.length).toBeGreaterThan(0);
    expect(runbook.steps.some((s) => s.riskLevel === 'stop')).toBe(true);
  });

  it('references actual modem and router names', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'm1',
          name: 'ISP Modem',
          category: 'modem',
          positionU: 1,
          sizeU: 1,
          depthMm: 200,
          widthType: '19in',
          weightKg: 2,
          powerW: 20,
          heatLevel: 1,
          color: '#333',
        },
        {
          id: 'r1',
          name: 'EdgeRouter',
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
    const runbook = generateInternetDownRunbook(layout);
    expect(runbook.steps.some((s) => s.text.includes('ISP Modem'))).toBe(true);
    expect(runbook.steps.some((s) => s.text.includes('EdgeRouter'))).toBe(true);
  });

  it('includes firewall check when firewall present', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'f1',
          name: 'pfSense',
          category: 'firewall',
          positionU: 1,
          sizeU: 1,
          depthMm: 300,
          widthType: '19in',
          weightKg: 4,
          powerW: 40,
          heatLevel: 2,
          color: '#222',
        },
      ],
    });
    const runbook = generateInternetDownRunbook(layout);
    expect(runbook.steps.some((s) => s.text.includes('pfSense'))).toBe(true);
  });
});

describe('generateNasUnreachableRunbook', () => {
  it('references NAS device', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'nas1',
          name: 'TrueNAS',
          category: 'nas',
          positionU: 1,
          sizeU: 2,
          depthMm: 400,
          widthType: '19in',
          weightKg: 10,
          powerW: 80,
          heatLevel: 2,
          color: '#444',
        },
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'nas1',
          fromPort: { type: 'ethernet', index: 0 },
          toDeviceId: 'sw1',
          toPort: { type: 'ethernet', index: 1 },
          type: 'ethernet',
          color: '#3b82f6',
        },
      ],
    });
    const runbook = generateNasUnreachableRunbook(layout);
    expect(runbook.steps.some((s) => s.text.includes('TrueNAS'))).toBe(true);
    expect(runbook.steps.some((s) => s.riskLevel === 'stop')).toBe(true);
  });
});

describe('generateWifiDownRunbook', () => {
  it('lists all access points', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'ap1',
          name: 'AP-Living',
          category: 'access-point',
          positionU: 1,
          sizeU: 1,
          depthMm: 150,
          widthType: '19in',
          weightKg: 1,
          powerW: 15,
          heatLevel: 1,
          color: '#fff',
        },
        {
          id: 'ap2',
          name: 'AP-Office',
          category: 'access-point',
          positionU: 2,
          sizeU: 1,
          depthMm: 150,
          widthType: '19in',
          weightKg: 1,
          powerW: 15,
          heatLevel: 1,
          color: '#fff',
        },
      ],
    });
    const runbook = generateWifiDownRunbook(layout);
    expect(runbook.steps.filter((s) => s.text.includes('AP-Living')).length).toBeGreaterThan(0);
    expect(runbook.steps.filter((s) => s.text.includes('AP-Office')).length).toBeGreaterThan(0);
  });
});

describe('generateUpsBeepingRunbook', () => {
  it('generates UPS-specific steps', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'ups1',
          name: 'APC-1500',
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
    const runbook = generateUpsBeepingRunbook(layout);
    expect(runbook.steps.some((s) => s.text.includes('APC-1500'))).toBe(true);
    expect(runbook.steps.some((s) => s.text.includes('overload'))).toBe(true);
    expect(runbook.steps.some((s) => s.riskLevel === 'stop')).toBe(true);
  });
});

describe('generateNoManagementAccessRunbook', () => {
  it('includes KVM fallback when available', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'kvm1',
          name: 'IP-KVM',
          category: 'ip-kvm',
          positionU: 1,
          sizeU: 1,
          depthMm: 200,
          widthType: '19in',
          weightKg: 2,
          powerW: 20,
          heatLevel: 1,
          color: '#333',
        },
      ],
    });
    const runbook = generateNoManagementAccessRunbook(layout);
    expect(runbook.steps.some((s) => s.text.includes('IP-KVM'))).toBe(true);
  });
});

describe('generateSlowPerformanceRunbook', () => {
  it('includes thermal and reboot warnings', () => {
    const layout = makeLayout();
    const runbook = generateSlowPerformanceRunbook(layout);
    expect(runbook.steps.some((s) => s.text.includes('thermal'))).toBe(true);
    expect(runbook.steps.some((s) => s.text.includes('DO NOT reboot everything'))).toBe(true);
  });
});

describe('generateAllRunbooks', () => {
  it('returns 6 runbooks', () => {
    const layout = makeLayout();
    const runbooks = generateAllRunbooks(layout);
    expect(runbooks).toHaveLength(6);
    const ids = runbooks.map((r) => r.id);
    expect(ids).toContain('internet-down');
    expect(ids).toContain('nas-unreachable');
    expect(ids).toContain('wifi-down');
    expect(ids).toContain('ups-beeping');
    expect(ids).toContain('no-management');
    expect(ids).toContain('slow-performance');
  });
});

describe('exportRunbooksMarkdown', () => {
  it('includes all runbooks', () => {
    const layout = makeLayout();
    const runbooks = generateAllRunbooks(layout);
    const md = exportRunbooksMarkdown(runbooks, 'Test Rack');
    expect(md).toContain('# Emergency Runbooks — Test Rack');
    expect(md).toContain('## Internet Down');
    expect(md).toContain('## UPS Beeping');
  });
});

describe('findRunbookById', () => {
  it('finds runbook by id', () => {
    const layout = makeLayout();
    const runbooks = generateAllRunbooks(layout);
    expect(findRunbookById(runbooks, 'internet-down')?.title).toBe('Internet Down');
    expect(findRunbookById(runbooks, 'nonexistent')).toBeUndefined();
  });
});
