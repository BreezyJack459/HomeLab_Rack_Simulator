import { describe, expect, it } from 'vitest';
import { calculateUpsRuntimes } from './upsRuntime';
import { validateImportedLayout } from './layoutValidation';
import { validateRackLayout } from './validation';
import type { DeviceCategory, RackLayout } from '../types/rack';
import {
  buildPowerChains,
  buildPowerTopology,
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

  it('does not invent an output rating from socket count', () => {
    for (const power of [4, 6, 8, 10, 16]) {
      expect(getUpsCapacityW(makeDevice('d', 'ups', 0, { ports: { power } }))).toBeUndefined();
    }
  });
});

describe('getDeviceCapacityW', () => {
  it('uses only explicit positive finite ratings for power sources', () => {
    for (const category of ['ups', 'pdu', 'pdu-0u'] as const) {
      expect(getDeviceCapacityW(makeDevice('d', category, 0, { powerCapacityW: 750 }))).toBe(750);
      for (const powerCapacityW of [undefined, 0, -1, NaN, Infinity]) {
        expect(getDeviceCapacityW(makeDevice('d', category, 0, { powerCapacityW }))).toBeUndefined();
      }
    }
    expect(getDeviceCapacityW(makeDevice('d', 'server', 100, { powerCapacityW: 750 }))).toBeUndefined();
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
    expect(chains[0].root.children[0].children[0].children).toHaveLength(0);
    expect(buildPowerTopology(layout).warnings.some(w => w.includes('cycle'))).toBe(true);
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
          toPort: { type: 'power', index: 0 },
          fromDeviceId: 'pdu1',
          toDeviceId: 'srv1',
          type: 'power',
          color: '#fb923c',
          nodes: [],
        },
        {
          id: 'c2',
          toPort: { type: 'power', index: 1 },
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
      planningGoals: { version: 1, power: 'independent-ab', remoteRecovery: 'optional', serviceMotion: 'unspecified' },
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


describe('endpoint-based outlet assignment', () => {
  const layout: RackLayout = {
    ...baseLayout,
    devices: [makeDevice('pdu', 'pdu', 0, { ports: { power: 8 }, circuit: 'A' }), makeDevice('server', 'server', 100, { ports: { power: 2 } })],
    cables: [{ id: 'c', type: 'power', color: '#fff', fromDeviceId: 'server', toDeviceId: 'pdu',
      fromPort: { type: 'power', index: 0 }, toPort: { type: 'power', index: 3 } }],
  };
  it('uses the PDU endpoint in either direction for usage and failure simulation', () => {
    expect(validatePduOutletAssignments(layout)).toEqual([]);
    expect(getPduOutletUsage(layout, 'pdu')?.usedOutlets).toBe(1);
    expect(getPduOutletMap(layout, 'pdu')[3].assignedDeviceId).toBe('server');
    expect(simulateOutletFailure(layout, 'pdu', 3)?.affectedDevices.map(d => d.id)).toEqual(['server']);
    const c = layout.cables[0];
    const reversed = { ...layout, cables: [{ ...c, fromDeviceId: c.toDeviceId, toDeviceId: c.fromDeviceId, fromPort: c.toPort, toPort: c.fromPort }] };
    expect(getPduOutletMap(reversed, 'pdu')).toEqual(getPduOutletMap(layout, 'pdu'));
  });
  it('reports conflicting legacy data without losing the explicit socket', () => {
    const conflict = { ...layout, cables: [{ ...layout.cables[0], outletIndex: 1 }] };
    expect(validatePduOutletAssignments(conflict).map(i => i.type)).toContain('conflicting-assignment');
    expect(getPduOutletMap(conflict, 'pdu')[3].assignedDeviceId).toBe('server');
  });
  it('detects duplicate sockets and invalid endpoint indices', () => {
    const duplicate = { ...layout, cables: [...layout.cables, { ...layout.cables[0], id: 'duplicate' }] };
    expect(validatePduOutletAssignments(duplicate).map(i => i.type)).toContain('duplicate-assignment');
    const invalid = { ...layout, cables: [{ ...layout.cables[0], toPort: { type: 'power' as const, index: 8 } }] };
    expect(validatePduOutletAssignments(invalid).map(i => i.type)).toContain('outlet-overload');
  });
  it('does not claim both PSUs share a circuit when only one is connected', () => {
    expect(validatePduOutletAssignments(layout).some(i => i.type === 'ab-mismatch')).toBe(false);
  });
});


describe('explicit power rating persistence and validation', () => {
  it('preserves a rated output through JSON export/import validation', () => {
    const layout = { ...baseLayout, devices: [makeDevice('pdu', 'pdu', 0, { powerCapacityW: 2300 })] };
    const result = validateImportedLayout(JSON.parse(JSON.stringify(layout)));
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.layout.devices[0].powerCapacityW).toBe(2300);
  });

  it('rejects invalid ratings but accepts legacy layouts without ratings', () => {
    for (const powerCapacityW of [0, -1, Infinity, NaN, '2300']) {
      const result = validateImportedLayout({ ...baseLayout, devices: [makeDevice('pdu', 'pdu', 0, { powerCapacityW })] });
      expect(result.valid).toBe(false);
    }
    expect(validateImportedLayout({ ...baseLayout, devices: [makeDevice('pdu', 'pdu', 0)] }).valid).toBe(true);
  });

  it('surfaces unknown ratings and does not infer breaker limits from source ratings', () => {
    const unknown = makeDevice('pdu', 'pdu', 0, { circuit: 'A' });
    expect(validateRackLayout({ ...baseLayout, devices: [unknown] }).some(i => i.id === 'power-capacity-unknown-pdu')).toBe(true);
    const known = { ...unknown, powerCapacityW: 2300 };
    const issues = validateRackLayout({ ...baseLayout, devices: [known] });
    expect(issues.some(i => i.id.startsWith('power-capacity-unknown-'))).toBe(false);
    expect(issues.some(i => i.id.startsWith('circuit-overload-'))).toBe(false);
  });
});


describe('directed power reachability', () => {
  const cable = (id: string, fromDeviceId: string, toDeviceId: string, extras = {}) => ({
    id, fromDeviceId, toDeviceId, type: 'power' as const, color: '#000', ...extras,
  });
  it('checks surviving stages against full unique downstream load, excluding their own consumption', () => {
    const layout: RackLayout = { ...baseLayout, devices: [
      makeDevice('a', 'pdu', 0, { powerCapacityW: 400 }),
      makeDevice('ups', 'ups', 30, { powerCapacityW: 220 }),
      makeDevice('b', 'pdu', 20, { powerCapacityW: 150 }),
      makeDevice('load', 'server', 200),
    ], cables: [
      cable('al', 'a', 'load', { outletIndex: 0 }),
      cable('ub', 'ups', 'b', { powerSourceDeviceId: 'ups' }),
      cable('bl', 'b', 'load'), cable('bl2', 'b', 'load'),
    ] };
    const result = simulateOutletFailure(layout, 'a', 0)!;
    expect(result.survivingDevices.map(d => d.id)).toContain('load');
    expect(result.remainingSupplies).toEqual([
      { id: 'a', name: 'a', loadW: 0, capacityW: 400, status: 'within-rating' },
      { id: 'ups', name: 'ups', loadW: 220, capacityW: 220, status: 'within-rating' },
      { id: 'b', name: 'b', loadW: 200, capacityW: 150, status: 'overload' },
    ]);
    layout.devices[2].powerCapacityW = undefined;
    expect(simulateOutletFailure(layout, 'a', 0)!.remainingSupplies[2].status).toBe('unknown');
    const cascadeFailure = simulateOutletFailure({ ...layout, cables: layout.cables.map(c => c.id === 'ub' ? { ...c, outletIndex: 1 } : c) }, 'ups', 1)!;
    expect(cascadeFailure.remainingSupplies.map(s => s.id)).not.toContain('b');
  });
  it('normalizes consumer-first picks and traces multiple distribution levels', () => {
    const layout: RackLayout = { ...baseLayout,
      devices: [makeDevice('a', 'pdu', 0, { circuit: 'A' }), makeDevice('b', 'pdu', 0), makeDevice('c', 'pdu', 0), makeDevice('load', 'server', 200)],
      cables: [cable('ab', 'b', 'a', { powerSourceDeviceId: 'a', outletIndex: 0 }), cable('bc', 'b', 'c', { powerSourceDeviceId: 'b' }), cable('cl', 'load', 'c')],
    };
    expect(buildPowerChains(layout)[0].root.totalW).toBe(200);
    expect(getDeviceCircuit(layout, 'load')).toBe('A');
    expect(getCircuitLoads(layout)[0].totalW).toBe(200);
    expect(getPduOutletMap(layout, 'a')[0].assignedDeviceId).toBe('b');
    expect(getPduOutletMap(layout, 'a')[0].loadW).toBe(200);
    expect(getPduOutletMap(layout, 'b').some(outlet => outlet.assignedDeviceId === 'a')).toBe(false);
    const failure = simulateOutletFailure(layout, 'a', 0)!;
    expect(failure.affectedDevices.map(d => d.id)).toEqual(['b']);
    expect(new Set(failure.downstreamDevices.map(d => d.id))).toEqual(new Set(['c', 'load']));
    expect(failure.totalLostW).toBe(200);
  });

  it('preserves a dual-fed consumer when one outlet fails and counts shared load once', () => {
    const layout: RackLayout = { ...baseLayout,
      devices: [makeDevice('root', 'ups', 0), makeDevice('a', 'pdu', 0), makeDevice('b', 'pdu', 0), makeDevice('load', 'server', 200)],
      cables: [cable('ra', 'root', 'a', { powerSourceDeviceId: 'root' }), cable('rb', 'root', 'b', { powerSourceDeviceId: 'root' }), cable('al', 'a', 'load', { outletIndex: 0 }), cable('bl', 'load', 'b', { outletIndex: 0 })],
    };
    expect(buildPowerChains(layout)[0].root.totalW).toBe(200);
    const failure = simulateOutletFailure(layout, 'a', 0)!;
    expect(failure.totalLostW).toBe(0);
    expect(failure.survivingDevices.map(d => d.id)).toContain('load');
    expect(checkPowerRedundancy(layout)[0].isRedundant).toBe(false);
  });

  it('does not energize a rootless cycle or recurse forever', () => {
    const layout: RackLayout = { ...baseLayout,
      devices: [makeDevice('a', 'pdu', 0), makeDevice('b', 'pdu', 0)],
      cables: [cable('ab', 'a', 'b', { powerSourceDeviceId: 'a' }), cable('ba', 'b', 'a', { powerSourceDeviceId: 'b' })],
    };
    expect(buildPowerChains(layout)).toEqual([]);
    expect(getDeviceCircuit(layout, 'a')).toBeUndefined();
    expect(buildPowerTopology(layout).warnings.some(w => w.includes('cycle'))).toBe(true);
    expect(simulateOutletFailure(layout, 'a', 0)?.totalLostW).toBe(0);
  });

  it('requires distinct documented inlets before claiming A/B paths', () => {
    const layout: RackLayout = { ...baseLayout,
      devices: [makeDevice('a', 'pdu', 0, { circuit: 'A' }), makeDevice('b', 'pdu', 0, { circuit: 'B' }), makeDevice('load', 'server', 200, { ports: { power: 2 } })],
      cables: [cable('al', 'a', 'load', { toPort: { type: 'power', index: 0 } }), cable('bl', 'b', 'load', { toPort: { type: 'power', index: 0 } })],
    };
    expect(checkPowerRedundancy(layout)[0].isRedundant).toBe(false);
    layout.cables[1].toPort = { type: 'power', index: 1 };
    expect(checkPowerRedundancy(layout)[0].isRedundant).toBe(true);
    expect(getDeviceCircuit(layout, 'load')).toBeUndefined();
  });
});


it('includes nested UPS loads and deduplicates runtime groups across shared descendants', () => {
  const layout: RackLayout = { ...baseLayout,
    devices: [makeDevice('pdu', 'pdu', 0), makeDevice('ups', 'ups', 5, { batteryWh: 100, portConnectionSpecs: { 'power:rear:1': { upsBackup: 'battery' }, 'power:rear:2': { upsBackup: 'battery' } } }), makeDevice('a', 'pdu', 0), makeDevice('b', 'pdu', 0), makeDevice('load', 'server', 200)],
    cables: [['pdu','ups'], ['ups','a'], ['ups','b'], ['a','load'], ['b','load']].map(([fromDeviceId, toDeviceId], index) => ({ id: String(index), fromPort: { type: 'power', index, side: 'rear' }, fromDeviceId, toDeviceId, powerSourceDeviceId: fromDeviceId, type: 'power', color: '#000' })),
  };
  const runtime = calculateUpsRuntimes(layout)[0];
  expect(runtime.loadW).toBe(205);
  expect(runtime.groups.gracefulW).toBe(200);
  expect(runtime.shutdownPlan).toHaveLength(1);
});


describe('unknown outlet inventory', () => {
  const layout: RackLayout = {
    ...baseLayout,
    devices: [makeDevice('pdu', 'pdu', 0), makeDevice('server', 'server', 200)],
    cables: [{ id: 'recorded', fromDeviceId: 'pdu', toDeviceId: 'server',
      type: 'power', color: '#fff', nodes: [], outletIndex: 9 }],
  };

  it('retains recorded connections and load without inventing free sockets or a range limit', () => {
    expect(getPduOutletUsage(layout, 'pdu')).toMatchObject({
      totalOutlets: null, freeOutlets: null, usedOutlets: 1, loadW: 200,
    });
    expect(getPduOutletMap(layout, 'pdu').map(outlet => outlet.outletIndex)).toEqual([9]);
    const issues = validatePduOutletAssignments(layout);
    expect(issues.some(issue => issue.type === 'unknown-count')).toBe(true);
    expect(issues.some(issue => issue.type === 'outlet-overload')).toBe(false);
  });

  it('still flags duplicate assignments and distinguishes explicit zero capacity', () => {
    const duplicate = { ...layout, cables: [...layout.cables, { ...layout.cables[0], id: 'duplicate' }] };
    expect(validatePduOutletAssignments(duplicate).some(issue => issue.type === 'duplicate-assignment')).toBe(true);
    const zero = { ...layout, devices: layout.devices.map(device => device.id === 'pdu'
      ? { ...device, ports: { power: 0 } } : device) };
    expect(getPduOutletUsage(zero, 'pdu')).toMatchObject({ totalOutlets: 0, freeOutlets: 0, loadW: 200 });
    expect(validatePduOutletAssignments(zero).some(issue => issue.type === 'outlet-overload')).toBe(true);
    expect(validatePduOutletAssignments(zero).some(issue => issue.type === 'unknown-count')).toBe(false);
  });
});
