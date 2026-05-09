import { describe, expect, it } from 'vitest';
import type { DeviceCategory, RackLayout } from '../types/rack';
import { getDocumentationIssues } from './documentationAudit';

const baseLayout: RackLayout = {
  id: 'test',
  name: 'Test',
  rackType: '19in',
  heightU: 12,
  rackDepthMm: 600,
  rearClearanceMm: 50,
  railMinDepthMm: 250,
  railMaxDepthMm: 575,
  weightLimitKg: 200,
  powerBudgetW: 1200,
  electricityRatePerKwh: 0.15,
  viewSide: 'front',
  devices: [],
  cables: [],
  updatedAt: new Date().toISOString(),
};

function makeDevice(id: string, category: DeviceCategory, overrides: Record<string, unknown> = {}) {
  return {
    id,
    category,
    name: id,
    positionU: 1,
    sizeU: 1,
    depthMm: 300,
    widthType: '19in' as const,
    weightKg: 5,
    powerW: 100,
    heatLevel: 2 as const,
    color: '#333',
    ports: {},
    ...overrides,
  };
}

describe('getDocumentationIssues', () => {
  it('returns empty for empty layout', () => {
    expect(getDocumentationIssues(baseLayout)).toHaveLength(0);
  });

  it('flags missing label on non-blank devices', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [makeDevice('srv1', 'server')],
    };
    const issues = getDocumentationIssues(layout);
    expect(issues.some((i) => i.id === 'missing-label-srv1')).toBe(true);
  });

  it('ignores missing label on blank panels', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [makeDevice('blank1', 'blank')],
    };
    const issues = getDocumentationIssues(layout);
    expect(issues.some((i) => i.id.startsWith('missing-label-'))).toBe(false);
  });

  it('does not flag devices with labels', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [makeDevice('srv1', 'server', { label: 'Web Server 1' })],
    };
    const issues = getDocumentationIssues(layout);
    expect(issues.some((i) => i.id.startsWith('missing-label-'))).toBe(false);
  });

  it('flags device with no power cable', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [makeDevice('srv1', 'server', { powerW: 200 })],
    };
    const issues = getDocumentationIssues(layout);
    expect(issues.some((i) => i.id === 'no-power-srv1')).toBe(true);
  });

  it('passes when power cable exists', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('srv1', 'server', { powerW: 200 }),
        makeDevice('pdu1', 'pdu'),
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'pdu1',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
          lengthMm: 1000,
        },
      ],
    };
    const issues = getDocumentationIssues(layout);
    expect(issues.some((i) => i.id.startsWith('no-power-'))).toBe(false);
  });

  it('flags device with unused network ports', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [makeDevice('srv1', 'server', { ports: { ethernet: 2 } })],
    };
    const issues = getDocumentationIssues(layout);
    expect(issues.some((i) => i.id === 'no-network-srv1')).toBe(true);
  });

  it('passes when network cable exists', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('srv1', 'server', { ports: { ethernet: 2 } }),
        makeDevice('sw1', 'switch'),
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'sw1',
          toDeviceId: 'srv1',
          type: 'ethernet',
          color: '#3b82f6',
          nodes: [],
          lengthMm: 500,
        },
      ],
    };
    const issues = getDocumentationIssues(layout);
    expect(issues.some((i) => i.id.startsWith('no-network-'))).toBe(false);
  });

  it('reports unused power ports when device has extra capacity', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('srv1', 'server', { powerW: 200, ports: { power: 2 } }),
        makeDevice('pdu1', 'pdu'),
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'pdu1',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
          lengthMm: 1000,
        },
      ],
    };
    const issues = getDocumentationIssues(layout);
    expect(issues.some((i) => i.id === 'unused-power-ports-srv1')).toBe(true);
  });

  it('ignores zero-U devices', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('pdu0u1', 'pdu-0u', { sizeU: 0, powerW: 0 }),
      ],
    };
    const issues = getDocumentationIssues(layout);
    expect(issues).toHaveLength(0);
  });
});
