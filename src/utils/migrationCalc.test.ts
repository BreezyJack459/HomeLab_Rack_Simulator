import { describe, expect, it } from 'vitest';
import type { RackLayout } from '../types/rack';
import { getFilteredLayoutByLifecycle, getMigrationSummary } from './migrationCalc';

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

describe('getMigrationSummary', () => {
  it('counts all devices as active by default', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        {
          id: 'a', category: 'switch', name: 'Switch', positionU: 1, sizeU: 1,
          depthMm: 200, widthType: '19in', weightKg: 3, powerW: 20, heatLevel: 2, color: '#333',
        },
        {
          id: 'b', category: 'server', name: 'Server', positionU: 2, sizeU: 1,
          depthMm: 400, widthType: '19in', weightKg: 8, powerW: 200, heatLevel: 3, color: '#555',
        },
      ],
    };

    const summary = getMigrationSummary(layout);
    expect(summary.activeDevices).toHaveLength(2);
    expect(summary.plannedDevices).toHaveLength(0);
    expect(summary.decommissioningDevices).toHaveLength(0);
  });

  it('separates planned and decommissioning devices', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        {
          id: 'a', category: 'switch', name: 'Old Switch', positionU: 1, sizeU: 1,
          depthMm: 200, widthType: '19in', weightKg: 3, powerW: 20, heatLevel: 2, color: '#333',
          lifecycleStatus: 'decommissioning',
        },
        {
          id: 'b', category: 'switch', name: 'New Switch', positionU: 2, sizeU: 1,
          depthMm: 200, widthType: '19in', weightKg: 3, powerW: 20, heatLevel: 2, color: '#333',
          lifecycleStatus: 'planned',
        },
        {
          id: 'c', category: 'server', name: 'Server', positionU: 3, sizeU: 1,
          depthMm: 400, widthType: '19in', weightKg: 8, powerW: 200, heatLevel: 3, color: '#555',
        },
      ],
    };

    const summary = getMigrationSummary(layout);
    expect(summary.activeDevices).toHaveLength(1);
    expect(summary.plannedDevices).toHaveLength(1);
    expect(summary.decommissioningDevices).toHaveLength(1);
    expect(summary.plannedDevices[0].name).toBe('New Switch');
    expect(summary.decommissioningDevices[0].name).toBe('Old Switch');
  });

  it('counts cables by lifecycle status', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        {
          id: 'a', category: 'switch', name: 'Switch', positionU: 1, sizeU: 1,
          depthMm: 200, widthType: '19in', weightKg: 3, powerW: 20, heatLevel: 2, color: '#333',
        },
        {
          id: 'b', category: 'server', name: 'Server', positionU: 2, sizeU: 1,
          depthMm: 400, widthType: '19in', weightKg: 8, powerW: 200, heatLevel: 3, color: '#555',
        },
      ],
      cables: [
        {
          id: 'c1', fromDeviceId: 'a', fromPort: { type: 'ethernet', index: 0 },
          toDeviceId: 'b', toPort: { type: 'ethernet', index: 0 },
          type: 'ethernet', color: '#0ea5e9', nodes: [], lifecycleStatus: 'planned',
        },
        {
          id: 'c2', fromDeviceId: 'a', fromPort: { type: 'power', index: 0 },
          toDeviceId: 'b', toPort: { type: 'power', index: 0 },
          type: 'power', color: '#fb923c', nodes: [],
        },
      ],
    };

    const summary = getMigrationSummary(layout);
    expect(summary.plannedCables).toHaveLength(1);
    expect(summary.activeCables).toHaveLength(1);
    expect(summary.decommissioningCables).toHaveLength(0);
  });

  it('filters layout to pending changes only', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        {
          id: 'a', category: 'switch', name: 'Active Switch', positionU: 1, sizeU: 1,
          depthMm: 200, widthType: '19in', weightKg: 3, powerW: 20, heatLevel: 2, color: '#333',
        },
        {
          id: 'b', category: 'switch', name: 'Planned Switch', positionU: 2, sizeU: 1,
          depthMm: 200, widthType: '19in', weightKg: 3, powerW: 20, heatLevel: 2, color: '#333',
          lifecycleStatus: 'planned',
        },
        {
          id: 'c', category: 'server', name: 'Old Server', positionU: 3, sizeU: 1,
          depthMm: 400, widthType: '19in', weightKg: 8, powerW: 200, heatLevel: 3, color: '#555',
          lifecycleStatus: 'decommissioning',
        },
      ],
      cables: [
        {
          id: 'c1', fromDeviceId: 'b', toDeviceId: 'c', type: 'ethernet', color: '#0ea5e9', lifecycleStatus: 'planned',
        },
        {
          id: 'c2', fromDeviceId: 'a', toDeviceId: 'b', type: 'power', color: '#fb923c',
        },
      ],
    };

    const filtered = getFilteredLayoutByLifecycle(layout, 'changes');
    expect(filtered.devices.map((device) => device.id)).toEqual(['b', 'c']);
    expect(filtered.cables.map((cable) => cable.id)).toEqual(['c1']);
  });
});
