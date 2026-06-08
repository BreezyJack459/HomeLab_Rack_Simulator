import { describe, expect, it } from 'vitest';
import type { RackLayout, RackPolicy } from '../types/rack';
import {
  evaluatePolicies,
  getDefaultPolicies,
  getPolicyPreset,
  getPresetDescription,
  getPresetLabel,
  POLICY_PRESETS,
  policyDescription,
  policyLabel,
} from './policyEngine';

function makeLayout(overrides?: Partial<RackLayout>): RackLayout {
  return {
    id: 'test',
    name: 'Test',
    rackType: '19in',
    heightU: 42,
    rackDepthMm: 600,
    weightLimitKg: 800,
    powerBudgetW: 3000,
    viewSide: 'front',
    devices: [],
    cables: [],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makePolicy(type: RackPolicy['type'], overrides?: Partial<RackPolicy>): RackPolicy {
  return {
    id: `p-${type}`,
    type,
    enabled: true,
    severity: 'warning',
    params: {},
    ...overrides,
  };
}

describe('getDefaultPolicies', () => {
  it('returns 8 policies all disabled by default', () => {
    const policies = getDefaultPolicies();
    expect(policies).toHaveLength(8);
    expect(policies.every((p) => !p.enabled)).toBe(true);
    expect(policies.every((p) => p.severity === 'warning')).toBe(true);
  });

  it('includes default params for each policy type', () => {
    const policies = getDefaultPolicies();
    const ups = policies.find((p) => p.type === 'ups-bottom-zone');
    expect(ups?.params.maxPercent).toBe(25);
    const heavy = policies.find((p) => p.type === 'heavy-device-bottom-zone');
    expect(heavy?.params.weightThresholdKg).toBe(8);
    expect(heavy?.params.maxPercent).toBe(50);
  });
});

describe('policyLabel', () => {
  it('returns human-readable labels', () => {
    expect(policyLabel('ups-bottom-zone')).toBe('UPS Bottom Zone');
    expect(policyLabel('heat-separation')).toBe('Heat Separation');
    expect(policyLabel('power-budget-headroom')).toBe('Power Budget Headroom');
  });
});

describe('policyDescription', () => {
  it('returns descriptions for all types', () => {
    const types = getDefaultPolicies().map((p) => p.type);
    for (const type of types) {
      expect(policyDescription(type)).toBeTruthy();
      expect(policyDescription(type).length).toBeGreaterThan(10);
    }
  });
});

describe('POLICY_PRESETS', () => {
  it('contains all three preset names', () => {
    expect(POLICY_PRESETS).toHaveLength(3);
    expect(POLICY_PRESETS).toContain('home-lab-minimal');
    expect(POLICY_PRESETS).toContain('soho-best-practice');
    expect(POLICY_PRESETS).toContain('datacenter-standard');
  });
});

describe('getPresetLabel', () => {
  it('returns correct labels', () => {
    expect(getPresetLabel('home-lab-minimal')).toBe('Home Lab Minimal');
    expect(getPresetLabel('soho-best-practice')).toBe('SOHO Best Practice');
    expect(getPresetLabel('datacenter-standard')).toBe('Datacenter Standard');
  });
});

describe('getPresetDescription', () => {
  it('returns non-empty descriptions for all presets', () => {
    for (const name of POLICY_PRESETS) {
      expect(getPresetDescription(name)).toBeTruthy();
      expect(getPresetDescription(name).length).toBeGreaterThan(10);
    }
  });
});

describe('getPolicyPreset', () => {
  it('returns correct number of policies for each preset', () => {
    const homeLab = getPolicyPreset('home-lab-minimal');
    expect(homeLab).toHaveLength(3);

    const soho = getPolicyPreset('soho-best-practice');
    expect(soho).toHaveLength(5);

    const dc = getPolicyPreset('datacenter-standard');
    expect(dc).toHaveLength(8);
  });

  it('returns correct policy types for home-lab-minimal', () => {
    const policies = getPolicyPreset('home-lab-minimal');
    const types = policies.map((p) => p.type);
    expect(types).toContain('ups-bottom-zone');
    expect(types).toContain('free-u-percent');
    expect(types).toContain('power-budget-headroom');
  });

  it('returns correct policy types for soho-best-practice', () => {
    const policies = getPolicyPreset('soho-best-practice');
    const types = policies.map((p) => p.type);
    expect(types).toContain('ups-bottom-zone');
    expect(types).toContain('heavy-device-bottom-zone');
    expect(types).toContain('free-u-percent');
    expect(types).toContain('switch-port-free-percent');
    expect(types).toContain('power-budget-headroom');
  });

  it('returns correct policy types for datacenter-standard', () => {
    const policies = getPolicyPreset('datacenter-standard');
    const types = policies.map((p) => p.type);
    expect(types).toContain('ups-bottom-zone');
    expect(types).toContain('heavy-device-bottom-zone');
    expect(types).toContain('free-u-percent');
    expect(types).toContain('switch-port-free-percent');
    expect(types).toContain('dual-psu-circuit-split');
    expect(types).toContain('heat-separation');
    expect(types).toContain('power-budget-headroom');
    expect(types).toContain('no-endpoint-switch-direct');
  });

  it('returns policies with unique ids', () => {
    const policies = getPolicyPreset('datacenter-standard');
    const ids = policies.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns policies with correct severities', () => {
    const homeLab = getPolicyPreset('home-lab-minimal');
    expect(homeLab.every((p) => p.severity === 'warning')).toBe(true);

    const dc = getPolicyPreset('datacenter-standard');
    const criticalTypes = new Set([
      'ups-bottom-zone',
      'heavy-device-bottom-zone',
      'free-u-percent',
      'switch-port-free-percent',
      'dual-psu-circuit-split',
      'power-budget-headroom',
    ]);
    for (const policy of dc) {
      if (criticalTypes.has(policy.type)) {
        expect(policy.severity).toBe('critical');
      } else {
        expect(policy.severity).toBe('warning');
      }
    }
  });

  it('returns policies with correct params', () => {
    const homeLab = getPolicyPreset('home-lab-minimal');
    const ups = homeLab.find((p) => p.type === 'ups-bottom-zone');
    expect(ups?.params.maxPercent).toBe(30);

    const soho = getPolicyPreset('soho-best-practice');
    const heavy = soho.find((p) => p.type === 'heavy-device-bottom-zone');
    expect(heavy?.params.weightThresholdKg).toBe(8);
    expect(heavy?.params.maxPercent).toBe(50);

    const dc = getPolicyPreset('datacenter-standard');
    const heat = dc.find((p) => p.type === 'heat-separation');
    expect(heat?.params.minGapU).toBe(2);
  });

  it('returns enabled policies', () => {
    const policies = getPolicyPreset('soho-best-practice');
    expect(policies.every((p) => p.enabled)).toBe(true);
  });
});

describe('evaluatePolicies', () => {
  it('returns no issues when no policies are enabled', () => {
    const layout = makeLayout({
      policies: getDefaultPolicies(),
    });
    expect(evaluatePolicies(layout)).toHaveLength(0);
  });

  it('returns no issues when policies array is missing', () => {
    const layout = makeLayout();
    expect(evaluatePolicies(layout)).toHaveLength(0);
  });
});

describe('ups-bottom-zone', () => {
  it('passes when UPS is in bottom 25%', () => {
    const layout = makeLayout({
      heightU: 42,
      policies: [makePolicy('ups-bottom-zone')],
      devices: [
        {
          id: 'ups1',
          name: 'UPS',
          category: 'ups',
          positionU: 1,
          sizeU: 4,
          depthMm: 600,
          widthType: '19in',
          weightKg: 50,
          powerW: 0,
          heatLevel: 1,
          color: '#333',
        },
      ],
    });
    expect(evaluatePolicies(layout)).toHaveLength(0);
  });

  it('fails when UPS is above bottom 25%', () => {
    const layout = makeLayout({
      heightU: 42,
      policies: [makePolicy('ups-bottom-zone')],
      devices: [
        {
          id: 'ups1',
          name: 'UPS',
          category: 'ups',
          positionU: 20,
          sizeU: 4,
          depthMm: 600,
          widthType: '19in',
          weightKg: 50,
          powerW: 0,
          heatLevel: 1,
          color: '#333',
        },
      ],
    });
    const issues = evaluatePolicies(layout);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].deviceIds).toContain('ups1');
  });
});

describe('heavy-device-bottom-zone', () => {
  it('passes when heavy device is in bottom 50%', () => {
    const layout = makeLayout({
      heightU: 42,
      policies: [makePolicy('heavy-device-bottom-zone')],
      devices: [
        {
          id: 'srv1',
          name: 'Server',
          category: 'server',
          positionU: 5,
          sizeU: 2,
          depthMm: 600,
          widthType: '19in',
          weightKg: 20,
          powerW: 300,
          heatLevel: 3,
          color: '#333',
        },
      ],
    });
    expect(evaluatePolicies(layout)).toHaveLength(0);
  });

  it('fails when heavy device is above bottom 50%', () => {
    const layout = makeLayout({
      heightU: 42,
      policies: [makePolicy('heavy-device-bottom-zone')],
      devices: [
        {
          id: 'srv1',
          name: 'Server',
          category: 'server',
          positionU: 30,
          sizeU: 2,
          depthMm: 600,
          widthType: '19in',
          weightKg: 20,
          powerW: 300,
          heatLevel: 3,
          color: '#333',
        },
      ],
    });
    const issues = evaluatePolicies(layout);
    expect(issues).toHaveLength(1);
    expect(issues[0].deviceIds).toContain('srv1');
  });
});

describe('free-u-percent', () => {
  it('passes when enough U is free', () => {
    const layout = makeLayout({
      heightU: 10,
      policies: [makePolicy('free-u-percent', { params: { minPercent: 10 } })],
      devices: [
        {
          id: 'd1',
          name: 'Dev',
          category: 'server',
          positionU: 1,
          sizeU: 2,
          depthMm: 400,
          widthType: '19in',
          weightKg: 10,
          powerW: 100,
          heatLevel: 3,
          color: '#333',
        },
      ],
    });
    expect(evaluatePolicies(layout)).toHaveLength(0);
  });

  it('fails when too little U is free', () => {
    const layout = makeLayout({
      heightU: 10,
      policies: [makePolicy('free-u-percent', { params: { minPercent: 50 } })],
      devices: [
        {
          id: 'd1',
          name: 'Dev',
          category: 'server',
          positionU: 1,
          sizeU: 8,
          depthMm: 400,
          widthType: '19in',
          weightKg: 10,
          powerW: 100,
          heatLevel: 3,
          color: '#333',
        },
      ],
    });
    const issues = evaluatePolicies(layout);
    expect(issues).toHaveLength(1);
    expect(issues[0].title).toContain('Free U space');
  });
});

describe('switch-port-free-percent', () => {
  it('passes when enough switch ports are free', () => {
    const layout = makeLayout({
      policies: [makePolicy('switch-port-free-percent', { params: { minPercent: 20 } })],
      devices: [
        {
          id: 'sw1',
          name: 'Switch',
          category: 'switch',
          positionU: 1,
          sizeU: 1,
          depthMm: 200,
          widthType: '19in',
          weightKg: 3,
          powerW: 30,
          heatLevel: 2,
          color: '#333',
          ports: { ethernet: 24 },
        },
      ],
    });
    expect(evaluatePolicies(layout)).toHaveLength(0);
  });

  it('fails when too few switch ports are free', () => {
    const layout = makeLayout({
      policies: [makePolicy('switch-port-free-percent', { params: { minPercent: 50 } })],
      devices: [
        {
          id: 'sw1',
          name: 'Switch',
          category: 'switch',
          positionU: 1,
          sizeU: 1,
          depthMm: 200,
          widthType: '19in',
          weightKg: 3,
          powerW: 30,
          heatLevel: 2,
          color: '#333',
          ports: { ethernet: 4 },
        },
        {
          id: 'srv1',
          name: 'Server',
          category: 'server',
          positionU: 3,
          sizeU: 1,
          depthMm: 400,
          widthType: '19in',
          weightKg: 10,
          powerW: 200,
          heatLevel: 3,
          color: '#555',
        },
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'srv1',
          fromPort: { type: 'ethernet', index: 0 },
          toDeviceId: 'sw1',
          toPort: { type: 'ethernet', index: 0 },
          type: 'ethernet',
          color: '#00f',
        },
        {
          id: 'c2',
          fromDeviceId: 'srv1',
          fromPort: { type: 'ethernet', index: 1 },
          toDeviceId: 'sw1',
          toPort: { type: 'ethernet', index: 1 },
          type: 'ethernet',
          color: '#00f',
        },
        {
          id: 'c3',
          fromDeviceId: 'srv1',
          fromPort: { type: 'ethernet', index: 2 },
          toDeviceId: 'sw1',
          toPort: { type: 'ethernet', index: 2 },
          type: 'ethernet',
          color: '#00f',
        },
      ],
    });
    const issues = evaluatePolicies(layout);
    expect(issues).toHaveLength(1);
    expect(issues[0].title).toContain('Switch port headroom');
  });
});

describe('dual-psu-circuit-split', () => {
  it('passes when dual PSU server splits across circuits', () => {
    const layout = makeLayout({
      policies: [makePolicy('dual-psu-circuit-split')],
      devices: [
        {
          id: 'srv1',
          name: 'Server',
          category: 'server',
          positionU: 1,
          sizeU: 2,
          depthMm: 600,
          widthType: '19in',
          weightKg: 20,
          powerW: 300,
          heatLevel: 3,
          color: '#333',
          ports: { power: 2 },
        },
        {
          id: 'pdu-a',
          name: 'PDU A',
          category: 'pdu',
          positionU: 10,
          sizeU: 1,
          depthMm: 100,
          widthType: '19in',
          weightKg: 2,
          powerW: 0,
          heatLevel: 1,
          color: '#f00',
          circuit: 'A',
        },
        {
          id: 'pdu-b',
          name: 'PDU B',
          category: 'pdu',
          positionU: 12,
          sizeU: 1,
          depthMm: 100,
          widthType: '19in',
          weightKg: 2,
          powerW: 0,
          heatLevel: 1,
          color: '#00f',
          circuit: 'B',
        },
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'srv1',
          toDeviceId: 'pdu-a',
          type: 'power',
          color: '#000',
        },
        {
          id: 'c2',
          fromDeviceId: 'srv1',
          toDeviceId: 'pdu-b',
          type: 'power',
          color: '#000',
        },
      ],
    });
    expect(evaluatePolicies(layout)).toHaveLength(0);
  });

  it('fails when dual PSU server uses same circuit', () => {
    const layout = makeLayout({
      policies: [makePolicy('dual-psu-circuit-split')],
      devices: [
        {
          id: 'srv1',
          name: 'Server',
          category: 'server',
          positionU: 1,
          sizeU: 2,
          depthMm: 600,
          widthType: '19in',
          weightKg: 20,
          powerW: 300,
          heatLevel: 3,
          color: '#333',
          ports: { power: 2 },
        },
        {
          id: 'pdu-a1',
          name: 'PDU A1',
          category: 'pdu',
          positionU: 10,
          sizeU: 1,
          depthMm: 100,
          widthType: '19in',
          weightKg: 2,
          powerW: 0,
          heatLevel: 1,
          color: '#f00',
          circuit: 'A',
        },
        {
          id: 'pdu-a2',
          name: 'PDU A2',
          category: 'pdu',
          positionU: 12,
          sizeU: 1,
          depthMm: 100,
          widthType: '19in',
          weightKg: 2,
          powerW: 0,
          heatLevel: 1,
          color: '#f00',
          circuit: 'A',
        },
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'srv1',
          toDeviceId: 'pdu-a1',
          type: 'power',
          color: '#000',
        },
        {
          id: 'c2',
          fromDeviceId: 'srv1',
          toDeviceId: 'pdu-a2',
          type: 'power',
          color: '#000',
        },
      ],
    });
    const issues = evaluatePolicies(layout);
    expect(issues).toHaveLength(1);
    expect(issues[0].title).toContain('Dual PSU');
    expect(issues[0].deviceIds).toContain('srv1');
  });
});

describe('heat-separation', () => {
  it('passes when high-heat devices are adequately separated', () => {
    const layout = makeLayout({
      policies: [makePolicy('heat-separation', { params: { minGapU: 1 } })],
      devices: [
        {
          id: 'd1',
          name: 'Hot1',
          category: 'server',
          positionU: 1,
          sizeU: 2,
          depthMm: 500,
          widthType: '19in',
          weightKg: 15,
          powerW: 300,
          heatLevel: 4,
          color: '#333',
        },
        {
          id: 'd2',
          name: 'Hot2',
          category: 'server',
          positionU: 5,
          sizeU: 2,
          depthMm: 500,
          widthType: '19in',
          weightKg: 15,
          powerW: 300,
          heatLevel: 4,
          color: '#555',
        },
      ],
    });
    expect(evaluatePolicies(layout)).toHaveLength(0);
  });

  it('fails when high-heat devices are too close', () => {
    const layout = makeLayout({
      policies: [makePolicy('heat-separation', { params: { minGapU: 2 } })],
      devices: [
        {
          id: 'd1',
          name: 'Hot1',
          category: 'server',
          positionU: 1,
          sizeU: 2,
          depthMm: 500,
          widthType: '19in',
          weightKg: 15,
          powerW: 300,
          heatLevel: 4,
          color: '#333',
        },
        {
          id: 'd2',
          name: 'Hot2',
          category: 'server',
          positionU: 3,
          sizeU: 1,
          depthMm: 500,
          widthType: '19in',
          weightKg: 10,
          powerW: 200,
          heatLevel: 4,
          color: '#555',
        },
      ],
    });
    const issues = evaluatePolicies(layout);
    expect(issues).toHaveLength(1);
    expect(issues[0].title).toContain('High-heat devices');
    expect(issues[0].deviceIds).toEqual(expect.arrayContaining(['d1', 'd2']));
  });
});

describe('power-budget-headroom', () => {
  it('passes when power headroom is above threshold', () => {
    const layout = makeLayout({
      powerBudgetW: 1000,
      policies: [makePolicy('power-budget-headroom', { params: { minPercent: 10 } })],
      devices: [
        {
          id: 'd1',
          name: 'Dev',
          category: 'server',
          positionU: 1,
          sizeU: 1,
          depthMm: 400,
          widthType: '19in',
          weightKg: 10,
          powerW: 800,
          heatLevel: 3,
          color: '#333',
        },
      ],
    });
    expect(evaluatePolicies(layout)).toHaveLength(0);
  });

  it('fails when power headroom is below threshold', () => {
    const layout = makeLayout({
      powerBudgetW: 1000,
      policies: [makePolicy('power-budget-headroom', { params: { minPercent: 20 } })],
      devices: [
        {
          id: 'd1',
          name: 'Dev',
          category: 'server',
          positionU: 1,
          sizeU: 1,
          depthMm: 400,
          widthType: '19in',
          weightKg: 10,
          powerW: 850,
          heatLevel: 3,
          color: '#333',
        },
      ],
    });
    const issues = evaluatePolicies(layout);
    expect(issues).toHaveLength(1);
    expect(issues[0].title).toContain('Power budget headroom');
  });
});

describe('no-endpoint-switch-direct', () => {
  it('passes when endpoint connects via patch panel', () => {
    const layout = makeLayout({
      policies: [makePolicy('no-endpoint-switch-direct')],
      devices: [
        {
          id: 'srv1',
          name: 'Server',
          category: 'server',
          positionU: 1,
          sizeU: 1,
          depthMm: 400,
          widthType: '19in',
          weightKg: 10,
          powerW: 200,
          heatLevel: 3,
          color: '#333',
        },
        {
          id: 'pp1',
          name: 'Patch Panel',
          category: 'patch-panel',
          positionU: 3,
          sizeU: 1,
          depthMm: 100,
          widthType: '19in',
          weightKg: 1,
          powerW: 0,
          heatLevel: 1,
          color: '#555',
        },
        {
          id: 'sw1',
          name: 'Switch',
          category: 'switch',
          positionU: 5,
          sizeU: 1,
          depthMm: 200,
          widthType: '19in',
          weightKg: 3,
          powerW: 50,
          heatLevel: 2,
          color: '#777',
        },
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'srv1',
          toDeviceId: 'pp1',
          type: 'ethernet',
          color: '#00f',
        },
        {
          id: 'c2',
          fromDeviceId: 'pp1',
          toDeviceId: 'sw1',
          type: 'patch',
          color: '#00f',
        },
      ],
    });
    expect(evaluatePolicies(layout)).toHaveLength(0);
  });

  it('fails when endpoint connects directly to switch', () => {
    const layout = makeLayout({
      policies: [makePolicy('no-endpoint-switch-direct')],
      devices: [
        {
          id: 'srv1',
          name: 'Server',
          category: 'server',
          positionU: 1,
          sizeU: 1,
          depthMm: 400,
          widthType: '19in',
          weightKg: 10,
          powerW: 200,
          heatLevel: 3,
          color: '#333',
        },
        {
          id: 'sw1',
          name: 'Switch',
          category: 'switch',
          positionU: 3,
          sizeU: 1,
          depthMm: 200,
          widthType: '19in',
          weightKg: 3,
          powerW: 50,
          heatLevel: 2,
          color: '#777',
        },
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'srv1',
          toDeviceId: 'sw1',
          type: 'ethernet',
          color: '#00f',
        },
      ],
    });
    const issues = evaluatePolicies(layout);
    expect(issues).toHaveLength(1);
    expect(issues[0].title).toContain('Endpoint connected directly');
    expect(issues[0].deviceIds).toEqual(expect.arrayContaining(['srv1', 'sw1']));
  });
});
