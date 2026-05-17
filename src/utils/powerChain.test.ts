import { describe, expect, it } from 'vitest';
import type { DeviceCategory, RackLayout } from '../types/rack';
import {
  buildPowerChains,
  checkPowerRedundancy,
  formatWatts,
  getCircuitLoads,
  getDeviceCapacityW,
  getDeviceCircuit,
  getPduOutletMap,
  getPduOutletUsage,
  getUpsCapacityW,
  simulateOutletFailure,
  validatePduOutletAssignments,
} from './powerChain';

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

function makeDevice(id: string, category: DeviceCategory, powerW: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    category,
    name: id,
    positionU: 1,
    sizeU: 1,
    depthMm: 300,
    widthType: '19in' as const,
    weightKg: 5,
    powerW,
    heatLevel: 2 as const,
    color: '#333',
    ...overrides,
  };
}

describe('formatWatts', () => {
  it('formats watts', () => {
    expect(formatWatts(500)).toBe('500W');
    expect(formatWatts(1000)).toBe('1.00kW');
    expect(formatWatts(2500)).toBe('2.50kW');
  });
});

describe('getUpsCapacityW', () => {
  it('returns undefined for non-UPS', () => {
    expect(getUpsCapacityW(makeDevice('d', 'server', 100))).toBeUndefined();
  });

  it('estimates capacity by outlet count', () => {
    expect(getUpsCapacityW(makeDevice('d', 'ups', 0, { ports: { power: 4 } }))).toBe(600);
    expect(getUpsCapacityW(makeDevice('d', 'ups', 0, { ports: { power: 6 } }))).toBe(900);
    expect(getUpsCapacityW(makeDevice('d', 'ups', 0, { ports: { power: 8 } }))).toBe(1500);
    expect(getUpsCapacityW(makeDevice('d', 'ups', 0, { ports: { power: 10 } }))).toBe(2200);
    expect(getUpsCapacityW(makeDevice('d', 'ups', 0, { ports: { power: 16 } }))).toBe(3000);
  });

  it('defaults to 4 outlets', () => {
    expect(getUpsCapacityW(makeDevice('d', 'ups', 0))).toBe(600);
  });
});

describe('getDeviceCapacityW', () => {
  it('returns PDU capacity for PDU', () => {
    expect(getDeviceCapacityW(makeDevice('d', 'pdu', 0, { ports: { power: 8 } }))).toBe(3680);
    expect(getDeviceCapacityW(makeDevice('d', 'pdu', 0, { ports: { power: 12 } }))).toBe(4600);
    expect(getDeviceCapacityW(makeDevice('d', 'pdu', 0, { ports: { power: 20 } }))).toBe(7360);
  });

  it('returns UPS capacity for UPS', () => {
    expect(getDeviceCapacityW(makeDevice('d', 'ups', 0, { ports: { power: 4 } }))).toBe(600);
  });

  it('returns undefined for other devices', () => {
    expect(getDeviceCapacityW(makeDevice('d', 'server', 100))).toBeUndefined();
  });
});

describe('buildPowerChains', () => {
  it('returns empty when no power sources', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [makeDevice('sw', 'switch', 20)],
    };
    expect(buildPowerChains(layout)).toHaveLength(0);
  });

  it('treats UPS as root', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [makeDevice('ups1', 'ups', 0)],
    };
    const chains = buildPowerChains(layout);
    expect(chains).toHaveLength(1);
    expect(chains[0].root.device.id).toBe('ups1');
  });

  it('treats PDU with no incoming cable as root', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [makeDevice('pdu1', 'pdu', 0)],
    };
    const chains = buildPowerChains(layout);
    expect(chains).toHaveLength(1);
    expect(chains[0].root.device.id).toBe('pdu1');
  });

  it('builds tree from UPS -> PDU -> server', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('ups1', 'ups', 0),
        makeDevice('pdu1', 'pdu', 0),
        makeDevice('srv1', 'server', 200),
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'ups1',
          toDeviceId: 'pdu1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
        },
        {
          id: 'c2',
          fromDeviceId: 'pdu1',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
        },
      ],
    };
    const chains = buildPowerChains(layout);
    expect(chains).toHaveLength(1);
    expect(chains[0].root.device.id).toBe('ups1');
    expect(chains[0].root.children).toHaveLength(1);
    expect(chains[0].root.children[0].device.id).toBe('pdu1');
    expect(chains[0].root.children[0].children).toHaveLength(1);
    expect(chains[0].root.children[0].children[0].device.id).toBe('srv1');
    expect(chains[0].root.totalW).toBe(200);
  });

  it('handles circular reference guard', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('ups1', 'ups', 0),
        makeDevice('pdu1', 'pdu', 0),
        makeDevice('pdu2', 'pdu', 0),
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'ups1',
          toDeviceId: 'pdu1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
        },
        {
          id: 'c2',
          fromDeviceId: 'pdu1',
          toDeviceId: 'pdu2',
          type: 'power',
          color: '#fb923c',
          nodes: [],
        },
        {
          id: 'c3',
          fromDeviceId: 'pdu2',
          toDeviceId: 'pdu1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
        },
      ],
    };
    const chains = buildPowerChains(layout);
    expect(chains).toHaveLength(1);
    expect(chains[0].root.device.id).toBe('ups1');
    // pdu1 -> pdu2 circular reference should be guarded (pdu2 won't re-expand pdu1)
    expect(chains[0].root.children[0].children).toHaveLength(1);
    expect(chains[0].root.children[0].children[0].device.id).toBe('pdu2');
    // pdu2 -> pdu1 is circular; guard returns pdu1 with empty children
    expect(chains[0].root.children[0].children[0].children).toHaveLength(1);
    expect(chains[0].root.children[0].children[0].children[0].device.id).toBe('pdu1');
    expect(chains[0].root.children[0].children[0].children[0].children).toHaveLength(0);
  });

  it('includes orphaned PDUs as empty roots', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [makeDevice('pdu1', 'pdu', 0)],
    };
    const chains = buildPowerChains(layout);
    expect(chains).toHaveLength(1);
    expect(chains[0].root.children).toHaveLength(0);
  });
});

describe('getCircuitLoads', () => {
  it('returns zero loads for empty layout', () => {
    const loads = getCircuitLoads(baseLayout);
    expect(loads).toHaveLength(2);
    expect(loads[0].circuit).toBe('A');
    expect(loads[0].totalW).toBe(0);
    expect(loads[1].circuit).toBe('B');
    expect(loads[1].totalW).toBe(0);
  });

  it('tracks power sources per circuit', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('pduA', 'pdu', 0, { circuit: 'A' }),
        makeDevice('pduB', 'pdu', 0, { circuit: 'B' }),
      ],
    };
    const loads = getCircuitLoads(layout);
    expect(loads[0].sources).toHaveLength(1);
    expect(loads[1].sources).toHaveLength(1);
  });

  it('tracks powered device watts per circuit', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('pduA', 'pdu', 0, { circuit: 'A' }),
        makeDevice('srv1', 'server', 150),
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'pduA',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
        },
      ],
    };
    const loads = getCircuitLoads(layout);
    expect(loads[0].totalW).toBe(150);
    expect(loads[0].deviceCount).toBe(1);
  });
});

describe('getPduOutletUsage', () => {
  it('returns null for non-PDU', () => {
    expect(getPduOutletUsage(baseLayout, 'no-such-id')).toBeNull();
    const layout: RackLayout = {
      ...baseLayout,
      devices: [makeDevice('srv1', 'server', 100)],
    };
    expect(getPduOutletUsage(layout, 'srv1')).toBeNull();
  });

  it('calculates outlet usage', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('pdu1', 'pdu', 0, { ports: { power: 8 } }),
        makeDevice('srv1', 'server', 200),
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'pdu1',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
          outletIndex: 0,
        },
      ],
    };
    const usage = getPduOutletUsage(layout, 'pdu1')!;
    expect(usage.totalOutlets).toBe(8);
    expect(usage.usedOutlets).toBe(1);
    expect(usage.freeOutlets).toBe(7);
    expect(usage.loadW).toBe(200);
  });
});

describe('checkPowerRedundancy', () => {
  it('returns empty when no dual-PSU devices', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('srv1', 'server', 100, { ports: { power: 1 } }),
        makeDevice('pdu1', 'pdu', 0, { circuit: 'A' }),
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'pdu1',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
        },
      ],
    };
    expect(checkPowerRedundancy(layout)).toHaveLength(0);
  });

  it('flags non-redundant dual-PSU on same circuit', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('srv1', 'server', 200, { ports: { power: 2 } }),
        makeDevice('pdu1', 'pdu', 0, { circuit: 'A' }),
        makeDevice('pdu2', 'pdu', 0, { circuit: 'A' }),
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'pdu1',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
        },
        {
          id: 'c2',
          fromDeviceId: 'pdu2',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
        },
      ],
    };
    const results = checkPowerRedundancy(layout);
    expect(results).toHaveLength(1);
    expect(results[0].device.id).toBe('srv1');
    expect(results[0].isRedundant).toBe(false);
    expect(results[0].circuits).toEqual(['A']);
  });

  it('passes redundant dual-PSU on different circuits', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('srv1', 'server', 200, { ports: { power: 2 } }),
        makeDevice('pdu1', 'pdu', 0, { circuit: 'A' }),
        makeDevice('pdu2', 'pdu', 0, { circuit: 'B' }),
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'pdu1',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
        },
        {
          id: 'c2',
          fromDeviceId: 'pdu2',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
        },
      ],
    };
    const results = checkPowerRedundancy(layout);
    expect(results).toHaveLength(1);
    expect(results[0].isRedundant).toBe(true);
    expect(results[0].circuits).toEqual(['A', 'B']);
  });

  it('ignores single-cable devices', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('srv1', 'server', 200, { ports: { power: 2 } }),
        makeDevice('pdu1', 'pdu', 0, { circuit: 'A' }),
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'pdu1',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
        },
      ],
    };
    expect(checkPowerRedundancy(layout)).toHaveLength(0);
  });
});

describe('getDeviceCircuit', () => {
  it('returns device own circuit for power sources', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [makeDevice('pdu1', 'pdu', 0, { circuit: 'A' })],
    };
    expect(getDeviceCircuit(layout, 'pdu1')).toBe('A');
  });

  it('traces upstream for non-power-source devices', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('pdu1', 'pdu', 0, { circuit: 'B' }),
        makeDevice('srv1', 'server', 200),
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'pdu1',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
        },
      ],
    };
    expect(getDeviceCircuit(layout, 'srv1')).toBe('B');
  });

  it('returns undefined for unassigned devices', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [makeDevice('srv1', 'server', 200)],
    };
    expect(getDeviceCircuit(layout, 'srv1')).toBeUndefined();
  });

  it('returns undefined for missing device', () => {
    expect(getDeviceCircuit(baseLayout, 'missing')).toBeUndefined();
  });
});

describe('getPduOutletMap', () => {
  it('returns empty for non-PDU', () => {
    expect(getPduOutletMap(baseLayout, 'no-such')).toEqual([]);
  });

  it('maps all outlets for a PDU', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('pdu1', 'pdu', 0, { ports: { power: 4 } }),
        makeDevice('srv1', 'server', 200),
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'pdu1',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
          outletIndex: 1,
        },
      ],
    };
    const map = getPduOutletMap(layout, 'pdu1');
    expect(map).toHaveLength(4);
    expect(map[0].assignedDeviceId).toBeNull();
    expect(map[1].assignedDeviceId).toBe('srv1');
    expect(map[1].loadW).toBe(200);
    expect(map[2].assignedDeviceId).toBeNull();
    expect(map[3].assignedDeviceId).toBeNull();
  });

  it('ignores out-of-range outlet indices', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('pdu1', 'pdu', 0, { ports: { power: 2 } }),
        makeDevice('srv1', 'server', 200),
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'pdu1',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
          outletIndex: 5,
        },
      ],
    };
    const map = getPduOutletMap(layout, 'pdu1');
    expect(map).toHaveLength(2);
    expect(map.every((o) => o.assignedDeviceId === null)).toBe(true);
  });
});

describe('getPduOutletUsage (with outlet map)', () => {
  it('includes outlet detail array', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('pdu1', 'pdu', 0, { ports: { power: 4 } }),
        makeDevice('srv1', 'server', 200),
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'pdu1',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
          outletIndex: 0,
        },
      ],
    };
    const usage = getPduOutletUsage(layout, 'pdu1')!;
    expect(usage.totalOutlets).toBe(4);
    expect(usage.usedOutlets).toBe(1);
    expect(usage.assignedOutlets).toBe(1);
    expect(usage.outlets).toHaveLength(4);
    expect(usage.outlets[0].assignedDeviceId).toBe('srv1');
  });
});

describe('validatePduOutletAssignments', () => {
  it('flags duplicate outlet assignments', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('pdu1', 'pdu', 0, { ports: { power: 8 } }),
        makeDevice('srv1', 'server', 100),
        makeDevice('srv2', 'server', 150),
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'pdu1',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
          outletIndex: 0,
        },
        {
          id: 'c2',
          fromDeviceId: 'pdu1',
          toDeviceId: 'srv2',
          type: 'power',
          color: '#fb923c',
          nodes: [],
          outletIndex: 0,
        },
      ],
    };
    const issues = validatePduOutletAssignments(layout);
    expect(issues.some((i) => i.type === 'duplicate-assignment')).toBe(true);
  });

  it('flags unassigned cables', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('pdu1', 'pdu', 0, { ports: { power: 8 } }),
        makeDevice('srv1', 'server', 100),
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'pdu1',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
        },
      ],
    };
    const issues = validatePduOutletAssignments(layout);
    expect(issues.some((i) => i.type === 'unassigned-cable')).toBe(true);
  });

  it('flags outlet index out of range', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('pdu1', 'pdu', 0, { ports: { power: 4 } }),
        makeDevice('srv1', 'server', 100),
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'pdu1',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
          outletIndex: 10,
        },
      ],
    };
    const issues = validatePduOutletAssignments(layout);
    expect(issues.some((i) => i.type === 'outlet-overload')).toBe(true);
  });

  it('flags dual-PSU on same circuit', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('pduA', 'pdu', 0, { circuit: 'A', ports: { power: 8 } }),
        makeDevice('srv1', 'server', 200, { ports: { power: 2 } }),
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'pduA',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
          outletIndex: 0,
        },
        {
          id: 'c2',
          fromDeviceId: 'pduA',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
          outletIndex: 1,
        },
      ],
    };
    const issues = validatePduOutletAssignments(layout);
    expect(issues.some((i) => i.type === 'ab-mismatch')).toBe(true);
  });

  it('returns empty for valid assignments', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('pdu1', 'pdu', 0, { ports: { power: 8 } }),
        makeDevice('srv1', 'server', 100),
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'pdu1',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
          outletIndex: 2,
        },
      ],
    };
    const issues = validatePduOutletAssignments(layout);
    expect(issues).toHaveLength(0);
  });
});

describe('simulateOutletFailure', () => {
  it('returns empty for unused outlet', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [makeDevice('pdu1', 'pdu', 0, { ports: { power: 4 } })],
    };
    const result = simulateOutletFailure(layout, 'pdu1', 0);
    expect(result).not.toBeNull();
    expect(result!.affectedDevices).toHaveLength(0);
    expect(result!.totalLostW).toBe(0);
  });

  it('affects the device on the failed outlet', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('pdu1', 'pdu', 0, { ports: { power: 4 } }),
        makeDevice('srv1', 'server', 200),
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'pdu1',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
          outletIndex: 1,
        },
      ],
    };
    const result = simulateOutletFailure(layout, 'pdu1', 1);
    expect(result!.affectedDevices).toHaveLength(1);
    expect(result!.affectedDevices[0].id).toBe('srv1');
    expect(result!.totalLostW).toBe(200);
  });

  it('includes downstream devices when failing a chained PDU', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        makeDevice('pdu1', 'pdu', 0, { ports: { power: 4 } }),
        makeDevice('pdu2', 'pdu', 0, { ports: { power: 4 } }),
        makeDevice('srv1', 'server', 200),
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'pdu1',
          toDeviceId: 'pdu2',
          type: 'power',
          color: '#fb923c',
          nodes: [],
          outletIndex: 0,
        },
        {
          id: 'c2',
          fromDeviceId: 'pdu2',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
          outletIndex: 0,
        },
      ],
    };
    const result = simulateOutletFailure(layout, 'pdu1', 0);
    expect(result!.affectedDevices).toHaveLength(1);
    expect(result!.affectedDevices[0].id).toBe('pdu2');
    expect(result!.downstreamDevices).toHaveLength(1);
    expect(result!.downstreamDevices[0].id).toBe('srv1');
    expect(result!.totalLostW).toBe(200);
  });
});
