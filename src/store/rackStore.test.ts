import { beforeEach, describe, expect, it } from 'vitest';
import { useRackStore } from './rackStore';
import type { RackLayout } from '../types/rack';

const testLayout: RackLayout = {
  id: 'test-incr',
  name: 'Incremental Test',
  rackType: '19in',
  heightU: 12,
  rackDepthMm: 600,
  weightLimitKg: 200,
  powerBudgetW: 1200,
  viewSide: 'front',
  devices: [
    {
      id: 'dev-a',
      category: 'switch',
      name: 'Switch A',
      mountSide: 'front',
      positionU: 1,
      sizeU: 1,
      depthMm: 300,
      widthType: '19in',
      weightKg: 5,
      powerW: 50,
      heatLevel: 2,
      ports: { ethernet: 4 },
      color: '#334155'
    },
    {
      id: 'dev-b',
      category: 'server',
      name: 'Server B',
      mountSide: 'front',
      positionU: 3,
      sizeU: 1,
      depthMm: 400,
      widthType: '19in',
      weightKg: 8,
      powerW: 100,
      heatLevel: 3,
      ports: { ethernet: 2 },
      color: '#475569'
    },
    {
      id: 'dev-c',
      category: 'nas',
      name: 'NAS C',
      mountSide: 'front',
      positionU: 5,
      sizeU: 1,
      depthMm: 350,
      widthType: '19in',
      weightKg: 6,
      powerW: 80,
      heatLevel: 2,
      ports: { ethernet: 2 },
      color: '#64748b'
    },
    {
      id: 'dev-d',
      category: 'router',
      name: 'Router D',
      mountSide: 'front',
      positionU: 6,
      sizeU: 1,
      depthMm: 250,
      widthType: '19in',
      weightKg: 3,
      powerW: 30,
      heatLevel: 1,
      ports: { ethernet: 4 },
      color: '#94a3b8'
    }
  ],
  cables: [
    {
      id: 'cable-ab',
      fromDeviceId: 'dev-a',
      toDeviceId: 'dev-b',
      fromPort: { type: 'ethernet', index: 0 },
      toPort: { type: 'ethernet', index: 0 },
      type: 'ethernet',
      color: '#0ea5e9',
      nodes: []
    },
    {
      id: 'cable-cd',
      fromDeviceId: 'dev-c',
      toDeviceId: 'dev-d',
      fromPort: { type: 'ethernet', index: 0 },
      toPort: { type: 'ethernet', index: 0 },
      type: 'ethernet',
      color: '#0ea5e9',
      nodes: []
    }
  ],
  updatedAt: new Date().toISOString()
};

describe('rackStore incremental cable recompute', () => {
  beforeEach(() => {
    useRackStore.getState().newLayout('19in', 12);
  });

  it('moveDevice only recomputes cables connected to the moved device', () => {
    useRackStore.getState().loadLayout(testLayout);

    const layout = useRackStore.getState().layout;
    const cableAB = layout.cables.find((c) => c.id === 'cable-ab')!;
    const cableCD = layout.cables.find((c) => c.id === 'cable-cd')!;

    const abNodesBefore = cableAB.nodes;
    const cdNodesBefore = cableCD.nodes;

    // Move dev-a from U1 to U9 (no overlap with dev-b at U3)
    const moved = useRackStore.getState().moveDevice('dev-a', 9);
    expect(moved).toBe(true);

    const nextLayout = useRackStore.getState().layout;
    const cableABAfter = nextLayout.cables.find((c) => c.id === 'cable-ab')!;
    const cableCDAfter = nextLayout.cables.find((c) => c.id === 'cable-cd')!;

    // Cable connected to moved device should be recomputed (new node reference)
    expect(cableABAfter.nodes).not.toBe(abNodesBefore);

    // Cable NOT connected to moved device should keep same node reference
    expect(cableCDAfter.nodes).toBe(cdNodesBefore);
  });

  it('updateDevice only recomputes cables connected to the updated device', () => {
    useRackStore.getState().loadLayout(testLayout);

    const layout = useRackStore.getState().layout;
    const cableAB = layout.cables.find((c) => c.id === 'cable-ab')!;
    const cableCD = layout.cables.find((c) => c.id === 'cable-cd')!;

    const abNodesBefore = cableAB.nodes;
    const cdNodesBefore = cableCD.nodes;

    // Resize dev-a from 1U to 2U at same position (no overlap)
    const updated = useRackStore.getState().updateDevice('dev-a', { sizeU: 2 });
    expect(updated).toBe(true);

    const nextLayout = useRackStore.getState().layout;
    const cableABAfter = nextLayout.cables.find((c) => c.id === 'cable-ab')!;
    const cableCDAfter = nextLayout.cables.find((c) => c.id === 'cable-cd')!;

    // Cable connected to updated device should be recomputed
    expect(cableABAfter.nodes).not.toBe(abNodesBefore);

    // Cable NOT connected should keep same reference
    expect(cableCDAfter.nodes).toBe(cdNodesBefore);
  });

  it('removeDevice deletes related cables and does not recompute remaining', () => {
    useRackStore.getState().loadLayout(testLayout);

    const layout = useRackStore.getState().layout;
    const cableCD = layout.cables.find((c) => c.id === 'cable-cd')!;
    const cdNodesBefore = cableCD.nodes;

    // Remove dev-a (connected to cable-ab)
    useRackStore.getState().removeDevice('dev-a');

    const nextLayout = useRackStore.getState().layout;
    expect(nextLayout.cables.some((c) => c.id === 'cable-ab')).toBe(false);

    const cableCDAfter = nextLayout.cables.find((c) => c.id === 'cable-cd')!;
    // Remaining cable should keep same node reference
    expect(cableCDAfter.nodes).toBe(cdNodesBefore);
  });

  it('setRackHeight still performs full recompute when geometry changes', () => {
    useRackStore.getState().loadLayout(testLayout);

    const layout = useRackStore.getState().layout;
    const cableCD = layout.cables.find((c) => c.id === 'cable-cd')!;
    const cdNodesBefore = cableCD.nodes;

    // Reduce rack height (triggers full recompute per Codex plan)
    useRackStore.getState().setRackHeight(6);

    const nextLayout = useRackStore.getState().layout;
    const cableCDAfter = nextLayout.cables.find((c) => c.id === 'cable-cd')!;

    // After full recompute, nodes should be a new reference even if unchanged
    expect(cableCDAfter.nodes).not.toBe(cdNodesBefore);
  });

  it('selects the first normalized visible device after hidden 0U PDU cleanup', () => {
    useRackStore.getState().loadLayout({
      ...testLayout,
      devices: [
        {
          id: 'hidden-zero-u',
          category: 'pdu-0u',
          name: 'Hidden 0U PDU',
          mountSide: 'front',
          mountType: 'rear-rail',
          mountSide0U: 'left',
          positionU: 1,
          sizeU: 0,
          depthMm: 600,
          widthType: 'custom',
          customWidthMm: 55,
          weightKg: 2.5,
          powerW: 0,
          heatLevel: 1,
          ports: { power: 16 },
          color: '#111827'
        },
        ...testLayout.devices
      ]
    });

    const state = useRackStore.getState();

    expect(state.layout.devices.some((device) => device.id === 'hidden-zero-u')).toBe(false);
    expect(state.selectedDeviceId).toBe('dev-a');
  });
});
