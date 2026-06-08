import { describe, expect, it } from 'vitest';
import type { RackLayout } from '../types/rack';
import { getConnectedCableIds, traceCable } from './cableTrace';

const baseLayout: RackLayout = {
  id: 'test',
  name: 'Test',
  rackType: '19in',
  heightU: 12,
  rackDepthMm: 600,
  weightLimitKg: 200,
  powerBudgetW: 1200,
  electricityRatePerKwh: 0.15,
  viewSide: 'front',
  devices: [],
  cables: [],
  updatedAt: new Date().toISOString(),
};

describe('traceCable', () => {
  it('returns null for unknown cable id', () => {
    expect(traceCable(baseLayout, 'nonexistent')).toBeNull();
  });

  it('traces a simple device-to-device cable', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        {
          id: 'sw', category: 'switch', name: 'Switch', positionU: 1, sizeU: 1,
          depthMm: 200, widthType: '19in', weightKg: 3, powerW: 20, heatLevel: 2, color: '#333',
        },
        {
          id: 'srv', category: 'server', name: 'Server', positionU: 2, sizeU: 1,
          depthMm: 400, widthType: '19in', weightKg: 8, powerW: 200, heatLevel: 3, color: '#555',
        },
      ],
      cables: [
        {
          id: 'c1', fromDeviceId: 'sw', fromPort: { type: 'ethernet', index: 0 },
          toDeviceId: 'srv', toPort: { type: 'ethernet', index: 0 },
          type: 'ethernet', color: '#0ea5e9', nodes: [],
        },
      ],
    };

    const result = traceCable(layout, 'c1');
    expect(result).not.toBeNull();
    expect(result!.startDevice.id).toBe('sw');
    expect(result!.endDevice.id).toBe('srv');
    expect(result!.complete).toBe(true);
    expect(result!.hops).toHaveLength(1);
  });

  it('traces through a patch panel with front and rear cables', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        {
          id: 'sw', category: 'switch', name: 'Switch', positionU: 1, sizeU: 1,
          depthMm: 200, widthType: '19in', weightKg: 3, powerW: 20, heatLevel: 2, color: '#333',
        },
        {
          id: 'patch', category: 'patch-panel', name: 'Patch Panel', positionU: 2, sizeU: 1,
          depthMm: 65, widthType: '19in', weightKg: 1.7, powerW: 0, heatLevel: 1,
          ports: { ethernet: 24, layoutColumns: 24 }, color: '#64748b',
        },
        {
          id: 'pc', category: 'mini-pc', name: 'Mini PC', positionU: 3, sizeU: 1,
          depthMm: 150, widthType: '19in', weightKg: 2, powerW: 30, heatLevel: 2, color: '#666',
        },
      ],
      cables: [
        {
          id: 'front-cable', fromDeviceId: 'sw', fromPort: { type: 'ethernet', index: 0, side: 'front' },
          toDeviceId: 'patch', toPort: { type: 'ethernet', index: 0, side: 'front' },
          type: 'patch', color: '#0ea5e9', nodes: [],
        },
        {
          id: 'rear-cable', fromDeviceId: 'pc', fromPort: { type: 'ethernet', index: 0, side: 'rear' },
          toDeviceId: 'patch', toPort: { type: 'ethernet', index: 0, side: 'rear' },
          type: 'structured', color: '#475569', nodes: [],
        },
      ],
    };

    // Trace from the front cable
    const result = traceCable(layout, 'front-cable');
    expect(result).not.toBeNull();
    expect(result!.startDevice.id).toBe('sw');
    expect(result!.endDevice.id).toBe('pc');
    expect(result!.complete).toBe(true);
    expect(result!.hops.length).toBeGreaterThanOrEqual(2);

    // Should include patch panel hop
    const panelHop = result!.hops.find((h) => h.panelJack);
    expect(panelHop).toBeDefined();
    expect(panelHop!.panelJack!.panel.id).toBe('patch');
    expect(panelHop!.panelJack!.index).toBe(0);
  });

  it('detects incomplete trace when patch panel jack is open on one side', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        {
          id: 'sw', category: 'switch', name: 'Switch', positionU: 1, sizeU: 1,
          depthMm: 200, widthType: '19in', weightKg: 3, powerW: 20, heatLevel: 2, color: '#333',
        },
        {
          id: 'patch', category: 'patch-panel', name: 'Patch Panel', positionU: 2, sizeU: 1,
          depthMm: 65, widthType: '19in', weightKg: 1.7, powerW: 0, heatLevel: 1,
          ports: { ethernet: 24, layoutColumns: 24 }, color: '#64748b',
        },
      ],
      cables: [
        {
          id: 'front-only', fromDeviceId: 'sw', fromPort: { type: 'ethernet', index: 0, side: 'front' },
          toDeviceId: 'patch', toPort: { type: 'ethernet', index: 0, side: 'front' },
          type: 'patch', color: '#0ea5e9', nodes: [],
        },
      ],
    };

    const result = traceCable(layout, 'front-only');
    expect(result).not.toBeNull();
    expect(result!.complete).toBe(false);
    expect(result!.brokenReason).toContain('open');
  });

  it('detects circular references', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        {
          id: 'patch1', category: 'patch-panel', name: 'Patch 1', positionU: 1, sizeU: 1,
          depthMm: 65, widthType: '19in', weightKg: 1.7, powerW: 0, heatLevel: 1,
          ports: { ethernet: 24, layoutColumns: 24 }, color: '#64748b',
        },
        {
          id: 'patch2', category: 'patch-panel', name: 'Patch 2', positionU: 2, sizeU: 1,
          depthMm: 65, widthType: '19in', weightKg: 1.7, powerW: 0, heatLevel: 1,
          ports: { ethernet: 24, layoutColumns: 24 }, color: '#64748b',
        },
      ],
      cables: [
        {
          id: 'c1', fromDeviceId: 'patch1', fromPort: { type: 'ethernet', index: 0, side: 'front' },
          toDeviceId: 'patch2', toPort: { type: 'ethernet', index: 0, side: 'front' },
          type: 'patch', color: '#0ea5e9', nodes: [],
        },
        {
          id: 'c2', fromDeviceId: 'patch2', fromPort: { type: 'ethernet', index: 0, side: 'rear' },
          toDeviceId: 'patch1', toPort: { type: 'ethernet', index: 0, side: 'rear' },
          type: 'structured', color: '#475569', nodes: [],
        },
      ],
    };

    const result = traceCable(layout, 'c1');
    expect(result).not.toBeNull();
    expect(result!.complete).toBe(false);
    expect(result!.brokenReason).toContain('Circular');
  });
});

describe('getConnectedCableIds', () => {
  it('returns all cables connected to a device', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        {
          id: 'a', category: 'switch', name: 'A', positionU: 1, sizeU: 1,
          depthMm: 200, widthType: '19in', weightKg: 3, powerW: 20, heatLevel: 2, color: '#333',
        },
        {
          id: 'b', category: 'server', name: 'B', positionU: 2, sizeU: 1,
          depthMm: 400, widthType: '19in', weightKg: 8, powerW: 200, heatLevel: 3, color: '#555',
        },
      ],
      cables: [
        {
          id: 'c1', fromDeviceId: 'a', fromPort: { type: 'ethernet', index: 0 },
          toDeviceId: 'b', toPort: { type: 'ethernet', index: 0 },
          type: 'ethernet', color: '#0ea5e9', nodes: [],
        },
        {
          id: 'c2', fromDeviceId: 'a', fromPort: { type: 'ethernet', index: 1 },
          toDeviceId: 'b', toPort: { type: 'ethernet', index: 1 },
          type: 'ethernet', color: '#0ea5e9', nodes: [],
        },
      ],
    };

    expect(getConnectedCableIds(layout, 'a')).toEqual(['c1', 'c2']);
    expect(getConnectedCableIds(layout, 'b')).toEqual(['c1', 'c2']);
  });

  it('filters by port type and index', () => {
    const layout: RackLayout = {
      ...baseLayout,
      devices: [
        {
          id: 'a', category: 'switch', name: 'A', positionU: 1, sizeU: 1,
          depthMm: 200, widthType: '19in', weightKg: 3, powerW: 20, heatLevel: 2, color: '#333',
        },
        {
          id: 'b', category: 'server', name: 'B', positionU: 2, sizeU: 1,
          depthMm: 400, widthType: '19in', weightKg: 8, powerW: 200, heatLevel: 3, color: '#555',
        },
      ],
      cables: [
        {
          id: 'eth', fromDeviceId: 'a', fromPort: { type: 'ethernet', index: 0 },
          toDeviceId: 'b', toPort: { type: 'ethernet', index: 0 },
          type: 'ethernet', color: '#0ea5e9', nodes: [],
        },
        {
          id: 'pwr', fromDeviceId: 'a', fromPort: { type: 'power', index: 0 },
          toDeviceId: 'b', toPort: { type: 'power', index: 0 },
          type: 'power', color: '#fb923c', nodes: [],
        },
      ],
    };

    expect(getConnectedCableIds(layout, 'a', 'ethernet')).toEqual(['eth']);
    expect(getConnectedCableIds(layout, 'a', 'power')).toEqual(['pwr']);
    expect(getConnectedCableIds(layout, 'a', 'ethernet', 0)).toEqual(['eth']);
    expect(getConnectedCableIds(layout, 'a', 'ethernet', 1)).toEqual([]);
  });
});
