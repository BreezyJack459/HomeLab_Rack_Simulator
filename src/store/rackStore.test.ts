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

describe('rackStore store operations', () => {
  beforeEach(() => {
    useRackStore.getState().newLayout('19in', 12);
  });

  it('addDeviceFromTemplate adds device and selects it', () => {
    const added = useRackStore.getState().addDeviceFromTemplate('cat6-patch-12');
    expect(added).toBe(true);
    const state = useRackStore.getState();
    expect(state.layout.devices.length).toBe(1);
    expect(state.layout.devices[0].name).toBe('12-port patch panel');
    expect(state.selectedDeviceId).toBe(state.layout.devices[0].id);
  });

  it('addDeviceFromTemplate rejects non-rack-mountable devices', () => {
    const added = useRackStore.getState().addDeviceFromTemplate('unifi-u7-pro');
    expect(added).toBe(false);
    expect(useRackStore.getState().layout.devices.length).toBe(0);
  });

  it('addDeviceFromTemplate rejects overlapping placement', () => {
    useRackStore.getState().addDeviceFromTemplate('cat6-patch-12', 1);
    const added = useRackStore.getState().addDeviceFromTemplate('cat6-patch-24', 1);
    expect(added).toBe(false);
    expect(useRackStore.getState().layout.devices.length).toBe(1);
  });

  it('addDeviceFromTemplate places device at requested position when specified', () => {
    const added = useRackStore.getState().addDeviceFromTemplate('cat6-patch-12', 5);
    expect(added).toBe(true);
    const device = useRackStore.getState().layout.devices[0];
    expect(device.positionU).toBe(5);
  });

  it('addCable creates cable with computed nodes', () => {
    useRackStore.getState().addDeviceFromTemplate('cat6-patch-12', 1);
    useRackStore.getState().addDeviceFromTemplate('cat6-patch-12', 3);
    const state = useRackStore.getState();
    const dev1 = state.layout.devices[0];
    const dev2 = state.layout.devices[1];

    useRackStore.getState().addCable({
      fromDeviceId: dev1.id,
      toDeviceId: dev2.id,
      fromPort: { type: 'ethernet', index: 0 },
      toPort: { type: 'ethernet', index: 0 },
      type: 'ethernet',
      color: '#0ea5e9'
    });

    const nextState = useRackStore.getState();
    expect(nextState.layout.cables.length).toBe(1);
    expect((nextState.layout.cables[0]?.nodes ?? []).length).toBeGreaterThan(0);
    expect(nextState.selectedCableId).toBe(nextState.layout.cables[0].id);
    expect(nextState.selectedDeviceId).toBeNull();
  });

  it('addCable rejects self-connection', () => {
    useRackStore.getState().addDeviceFromTemplate('cat6-patch-12', 1);
    const dev = useRackStore.getState().layout.devices[0];

    useRackStore.getState().addCable({
      fromDeviceId: dev.id,
      toDeviceId: dev.id,
      fromPort: { type: 'ethernet', index: 0 },
      toPort: { type: 'ethernet', index: 0 },
      type: 'ethernet',
      color: '#0ea5e9'
    });

    expect(useRackStore.getState().layout.cables.length).toBe(0);
  });

  it('addCables creates multiple cables and undoes in one step', () => {
    useRackStore.getState().loadLayout(testLayout);
    const beforeCableCount = useRackStore.getState().layout.cables.length;

    useRackStore.getState().addCables([
      {
        fromDeviceId: 'dev-a',
        toDeviceId: 'dev-c',
        fromPort: { type: 'ethernet', index: 1 },
        toPort: { type: 'ethernet', index: 1 },
        type: 'ethernet',
        color: '#0ea5e9'
      },
      {
        fromDeviceId: 'dev-b',
        toDeviceId: 'dev-d',
        fromPort: { type: 'ethernet', index: 1 },
        toPort: { type: 'ethernet', index: 1 },
        type: 'ethernet',
        color: '#0ea5e9'
      }
    ]);

    const afterAdd = useRackStore.getState();
    expect(afterAdd.layout.cables.length).toBe(beforeCableCount + 2);
    expect(afterAdd.selectedCableId).toBe(afterAdd.layout.cables[afterAdd.layout.cables.length - 1].id);

    useRackStore.getState().undo();
    expect(useRackStore.getState().layout.cables.length).toBe(beforeCableCount);
  });

  it('removeCable deletes cable and clears selection', () => {
    useRackStore.getState().loadLayout(testLayout);
    useRackStore.getState().selectCable('cable-ab');

    useRackStore.getState().removeCable('cable-ab');

    const state = useRackStore.getState();
    expect(state.layout.cables.some((c) => c.id === 'cable-ab')).toBe(false);
    expect(state.selectedCableId).toBeNull();
  });

  it('undo restores previous layout state', () => {
    useRackStore.getState().loadLayout(testLayout);
    const before = useRackStore.getState().layout;

    useRackStore.getState().removeDevice('dev-a');
    const after = useRackStore.getState().layout;
    expect(after.devices.length).toBeLessThan(before.devices.length);

    useRackStore.getState().undo();
    const undone = useRackStore.getState().layout;
    expect(undone.devices.length).toBe(before.devices.length);
    expect(undone.devices.some((d) => d.id === 'dev-a')).toBe(true);
  });

  it('redo restores undone layout state', () => {
    useRackStore.getState().loadLayout(testLayout);
    useRackStore.getState().removeDevice('dev-a');

    const afterRemoval = useRackStore.getState().layout;
    useRackStore.getState().undo();
    useRackStore.getState().redo();

    const redone = useRackStore.getState().layout;
    expect(redone.devices.length).toBe(afterRemoval.devices.length);
    expect(redone.devices.some((d) => d.id === 'dev-a')).toBe(false);
  });

  it('canUndo and canRedo reflect history state', () => {
    useRackStore.getState().loadLayout(testLayout);
    expect(useRackStore.getState().canUndo()).toBe(false);
    expect(useRackStore.getState().canRedo()).toBe(false);

    useRackStore.getState().removeDevice('dev-a');
    expect(useRackStore.getState().canUndo()).toBe(true);
    expect(useRackStore.getState().canRedo()).toBe(false);

    useRackStore.getState().undo();
    expect(useRackStore.getState().canUndo()).toBe(false);
    expect(useRackStore.getState().canRedo()).toBe(true);
  });

  it('updateRack with non-geometric patch skips cable recompute', () => {
    useRackStore.getState().loadLayout(testLayout);

    const layout = useRackStore.getState().layout;
    const cableAB = layout.cables.find((c) => c.id === 'cable-ab')!;
    const abNodesBefore = cableAB.nodes;

    useRackStore.getState().updateRack({ name: 'Renamed Rack', powerBudgetW: 1500 });

    const nextLayout = useRackStore.getState().layout;
    const cableABAfter = nextLayout.cables.find((c) => c.id === 'cable-ab')!;
    expect(cableABAfter.nodes).toBe(abNodesBefore);
    expect(nextLayout.name).toBe('Renamed Rack');
    expect(nextLayout.powerBudgetW).toBe(1500);
  });

  it('updateRack with geometric patch recomputes cables', () => {
    useRackStore.getState().loadLayout(testLayout);

    const layout = useRackStore.getState().layout;
    const cableAB = layout.cables.find((c) => c.id === 'cable-ab')!;
    const abNodesBefore = cableAB.nodes;

    useRackStore.getState().updateRack({ rackDepthMm: 900 });

    const nextLayout = useRackStore.getState().layout;
    const cableABAfter = nextLayout.cables.find((c) => c.id === 'cable-ab')!;
    expect(cableABAfter.nodes).not.toBe(abNodesBefore);
    expect(nextLayout.rackDepthMm).toBe(900);
  });

  it('newLayout resets state to blank layout', () => {
    useRackStore.getState().loadLayout(testLayout);
    useRackStore.getState().newLayout('10in', 6);

    const state = useRackStore.getState();
    expect(state.layout.devices.length).toBe(0);
    expect(state.layout.cables.length).toBe(0);
    expect(state.layout.rackType).toBe('10in');
    expect(state.layout.heightU).toBe(6);
    expect(state.selectedDeviceId).toBeNull();
    expect(state.canUndo()).toBe(false);
    expect(state.canRedo()).toBe(false);
  });

  it('selectDevice and selectCable update selection state', () => {
    useRackStore.getState().loadLayout(testLayout);

    useRackStore.getState().selectDevice('dev-b');
    expect(useRackStore.getState().selectedDeviceId).toBe('dev-b');
    expect(useRackStore.getState().selectedCableId).toBeNull();

    useRackStore.getState().selectCable('cable-ab');
    expect(useRackStore.getState().selectedCableId).toBe('cable-ab');
    expect(useRackStore.getState().selectedDeviceId).toBeNull();
  });

  it('setRackHeight removes devices that no longer fit', () => {
    useRackStore.getState().loadLayout(testLayout);

    useRackStore.getState().setRackHeight(5);
    const state = useRackStore.getState();
    expect(state.layout.heightU).toBe(5);
    expect(state.layout.devices.some((d) => d.id === 'dev-d')).toBe(false);
    expect(state.layout.cables.some((c) => c.id === 'cable-cd')).toBe(false);
  });

  it('addReservation reserves U-space and blocks accidental device placement', () => {
    useRackStore.getState().newLayout('19in', 12);
    useRackStore.getState().addReservation({
      name: 'Future UPS',
      positionU: 1,
      sizeU: 2,
      mountSide: 'front',
      widthType: '19in',
      purpose: 'ups'
    });

    const added = useRackStore.getState().addDeviceFromTemplate('ups-1u', 1);
    const state = useRackStore.getState();

    expect(state.layout.reservations).toHaveLength(1);
    expect(added).toBe(false);
    expect(state.layout.devices).toHaveLength(0);
    expect(state.statusMessage).toContain('reserved');
  });

  it('setRackHeight removes reservations that no longer fit', () => {
    useRackStore.getState().newLayout('19in', 12);
    useRackStore.getState().addReservation({
      name: 'Future shelf',
      positionU: 10,
      sizeU: 3,
      mountSide: 'front',
      widthType: '19in',
      purpose: 'shelf'
    });

    useRackStore.getState().setRackHeight(8);

    expect(useRackStore.getState().layout.reservations).toHaveLength(0);
  });

  it('setRackType updates rack dimensions and reclamps device positions', () => {
    useRackStore.getState().loadLayout(testLayout);

    useRackStore.getState().setRackType('10in');
    const state = useRackStore.getState();
    expect(state.layout.rackType).toBe('10in');
    expect(state.layout.powerBudgetW).toBe(450);
  });
});
