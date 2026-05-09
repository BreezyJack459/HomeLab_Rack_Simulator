import { describe, expect, it } from 'vitest';
import type { DeviceCategory, RackLayout } from '../types/rack';
import {
  getCableStrainRisks,
  getFrontRearCollisions,
  getHeavyOverLightIssues,
  getServiceabilityIssues,
} from './serviceability';

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
    ...overrides,
  };
}

describe('getCableStrainRisks', () => {
  it('returns empty when no cables', () => {
    expect(getCableStrainRisks(baseLayout)).toHaveLength(0);
  });

  it('flags cable shorter than device depth + service slack', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('srv1', 'server', { depthMm: 500 }),
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
          lengthMm: 100,
        },
      ],
    };
    const risks = getCableStrainRisks(layout);
    expect(risks.length).toBeGreaterThan(0);
    expect(risks.some((r) => r.deviceId === 'srv1')).toBe(true);
  });

  it('passes when cable is long enough', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('srv1', 'server', { depthMm: 300 }),
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
    expect(getCableStrainRisks(layout)).toHaveLength(0);
  });
});

describe('getFrontRearCollisions', () => {
  it('returns empty when no front/rear overlap', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('srv1', 'server', { mountSide: 'front', positionU: 1 }),
        makeDevice('srv2', 'server', { mountSide: 'rear', positionU: 5 }),
      ],
    };
    expect(getFrontRearCollisions(layout)).toHaveLength(0);
  });

  it('detects front+rear devices with overlapping U and combined depth exceeding rack', () => {
    const layout: RackLayout = {
      ...baseLayout,
      rackDepthMm: 500,
      devices: [
        makeDevice('front1', 'server', { mountSide: 'front', positionU: 1, depthMm: 350 }),
        makeDevice('rear1', 'server', { mountSide: 'rear', positionU: 1, depthMm: 200 }),
      ],
    };
    const collisions = getFrontRearCollisions(layout);
    expect(collisions).toHaveLength(1);
    expect(collisions[0].frontDeviceId).toBe('front1');
    expect(collisions[0].rearDeviceId).toBe('rear1');
    expect(collisions[0].combinedDepthMm).toBe(550);
  });

  it('ignores when combined depth fits within rack', () => {
    const layout: RackLayout = {
      ...baseLayout,
      rackDepthMm: 600,
      devices: [
        makeDevice('front1', 'server', { mountSide: 'front', positionU: 1, depthMm: 300 }),
        makeDevice('rear1', 'server', { mountSide: 'rear', positionU: 1, depthMm: 200 }),
      ],
    };
    expect(getFrontRearCollisions(layout)).toHaveLength(0);
  });
});

describe('getHeavyOverLightIssues', () => {
  it('returns empty when no heavy-over-light stacking', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('light1', 'switch', { positionU: 1, weightKg: 2 }),
        makeDevice('light2', 'switch', { positionU: 2, weightKg: 2 }),
      ],
    };
    expect(getHeavyOverLightIssues(layout)).toHaveLength(0);
  });

  it('detects heavy device directly above lighter device', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('heavy1', 'server', { positionU: 1, sizeU: 2, weightKg: 15 }),
        makeDevice('light1', 'switch', { positionU: 3, weightKg: 2 }),
      ],
    };
    const issues = getHeavyOverLightIssues(layout);
    expect(issues).toHaveLength(1);
    expect(issues[0].upperDeviceId).toBe('heavy1');
    expect(issues[0].lowerDeviceId).toBe('light1');
    expect(issues[0].gapU).toBe(0);
  });

  it('ignores heavy device far above lighter device', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('heavy1', 'server', { positionU: 1, sizeU: 2, weightKg: 15 }),
        makeDevice('light1', 'switch', { positionU: 5, weightKg: 2 }),
      ],
    };
    expect(getHeavyOverLightIssues(layout)).toHaveLength(0);
  });

  it('ignores devices on different mount sides', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('heavy1', 'server', { positionU: 1, sizeU: 2, weightKg: 15, mountSide: 'front' }),
        makeDevice('light1', 'switch', { positionU: 3, weightKg: 2, mountSide: 'rear' }),
      ],
    };
    expect(getHeavyOverLightIssues(layout)).toHaveLength(0);
  });
});

describe('getServiceabilityIssues', () => {
  it('returns empty for empty layout', () => {
    expect(getServiceabilityIssues(baseLayout)).toHaveLength(0);
  });

  it('returns cable strain issues', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('srv1', 'server', { depthMm: 500 }),
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
          lengthMm: 100,
        },
      ],
    };
    const issues = getServiceabilityIssues(layout);
    expect(issues.some((i) => i.id.startsWith('cable-strain-'))).toBe(true);
  });

  it('returns front-rear collision as critical', () => {
    const layout: RackLayout = {
      ...baseLayout,
      rackDepthMm: 500,
      devices: [
        makeDevice('front1', 'server', { mountSide: 'front', positionU: 1, depthMm: 350 }),
        makeDevice('rear1', 'server', { mountSide: 'rear', positionU: 1, depthMm: 200 }),
      ],
    };
    const issues = getServiceabilityIssues(layout);
    const collision = issues.find((i) => i.id.startsWith('front-rear-collision-'));
    expect(collision).toBeDefined();
    expect(collision!.severity).toBe('critical');
  });

  it('returns heavy-over-light as info', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('heavy1', 'server', { positionU: 1, sizeU: 2, weightKg: 15 }),
        makeDevice('light1', 'switch', { positionU: 3, weightKg: 2 }),
      ],
    };
    const issues = getServiceabilityIssues(layout);
    const issue = issues.find((i) => i.id.startsWith('heavy-over-light-'));
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('info');
  });
});
