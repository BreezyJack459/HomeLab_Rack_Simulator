import { beforeEach, describe, expect, it } from 'vitest';
import { useRackStore } from './rackStore';
import type { RackLayout, InterRackCable } from '../types/rack';

describe('workspace store', () => {
  beforeEach(() => {
    localStorage.removeItem('homelab-rack-simulator-workspace');
    localStorage.removeItem('homelab-rack-simulator-layout');
    useRackStore.getState().newLayout('19in', 12);
    const layout = useRackStore.getState().layout;
    useRackStore.setState({
      workspace: {
        id: 'ws-test',
        name: 'Test Lab',
        racks: [layout],
        interRackCables: [],
        updatedAt: new Date().toISOString(),
      },
      currentRackId: layout.id,
      history: [],
      historyIndex: -1,
      selectedDeviceId: null,
      selectedCableId: null,
    });
  });

  it('has a default workspace on init', () => {
    const state = useRackStore.getState();
    expect(state.workspace).toBeDefined();
    expect(state.workspace.racks.length).toBeGreaterThanOrEqual(1);
    expect(state.currentRackId).toBe(state.workspace.racks[0].id);
    expect(state.layout.id).toBe(state.currentRackId);
  });

  it('migrates legacy layout to workspace', () => {
    const legacyLayout: RackLayout = {
      id: 'legacy-layout',
      name: 'Legacy',
      rackType: '19in',
      heightU: 12,
      rackDepthMm: 600,
      weightLimitKg: 200,
      powerBudgetW: 1200,
      viewSide: 'front',
      devices: [],
      cables: [],
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem('homelab-rack-simulator-layout', JSON.stringify(legacyLayout));
    localStorage.removeItem('homelab-rack-simulator-workspace');
    const loaded = useRackStore.getState().loadLocal();
    expect(loaded).toBe(true);
    const state = useRackStore.getState();
    expect(state.workspace.racks.some((r) => r.id === 'legacy-layout')).toBe(true);
    expect(state.currentRackId).toBe('legacy-layout');
    localStorage.removeItem('homelab-rack-simulator-layout');
    localStorage.removeItem('homelab-rack-simulator-workspace');
  });

  it('createRack adds a rack and switches to it', () => {
    const initialRackCount = useRackStore.getState().workspace.racks.length;
    useRackStore.getState().createRack('New Rack', '19in', 12);
    const state = useRackStore.getState();
    expect(state.workspace.racks.length).toBe(initialRackCount + 1);
    expect(state.currentRackId).toBe(state.workspace.racks[state.workspace.racks.length - 1].id);
    expect(state.layout.name).toBe('New Rack');
  });

  it('deleteRack removes a rack and switches to another', () => {
    useRackStore.getState().createRack('Rack to Delete', '19in', 12);
    const stateBefore = useRackStore.getState();
    const rackIdToDelete = stateBefore.currentRackId;
    const remainingId = stateBefore.workspace.racks.find((r) => r.id !== rackIdToDelete)!.id;

    useRackStore.getState().deleteRack(rackIdToDelete);
    const state = useRackStore.getState();
    expect(state.workspace.racks.some((r) => r.id === rackIdToDelete)).toBe(false);
    expect(state.currentRackId).toBe(remainingId);
  });

  it('deleteRack creates default rack when deleting the last one', () => {
    const stateBefore = useRackStore.getState();
    const onlyRackId = stateBefore.currentRackId;
    stateBefore.workspace.racks.forEach((r) => {
      if (r.id !== onlyRackId) useRackStore.getState().deleteRack(r.id);
    });
    useRackStore.getState().deleteRack(onlyRackId);
    const state = useRackStore.getState();
    expect(state.workspace.racks.length).toBe(1);
    expect(state.currentRackId).toBe(state.workspace.racks[0].id);
  });

  it('duplicateRack creates a copy with new device IDs', () => {
    useRackStore.getState().addDeviceFromTemplate('cat6-patch-12', 1);
    const originalRack = useRackStore.getState().layout;
    const originalDeviceIds = originalRack.devices.map((d) => d.id);

    useRackStore.getState().duplicateRack(originalRack.id, 'Duplicated Rack');
    const state = useRackStore.getState();
    const duplicatedRack = state.workspace.racks.find((r) => r.name === 'Duplicated Rack');
    expect(duplicatedRack).toBeDefined();
    expect(duplicatedRack!.id).not.toBe(originalRack.id);
    const duplicatedDeviceIds = duplicatedRack!.devices.map((d) => d.id);
    expect(duplicatedDeviceIds).not.toEqual(originalDeviceIds);
    expect(duplicatedDeviceIds).toHaveLength(originalDeviceIds.length);
  });

  it('switchRack updates currentRackId and layout', () => {
    useRackStore.getState().createRack('Second Rack', '19in', 12);
    const stateAfterCreate = useRackStore.getState();
    const secondRackId = stateAfterCreate.workspace.racks.find((r) => r.name === 'Second Rack')!.id;
    const firstRackId = stateAfterCreate.workspace.racks.find((r) => r.name !== 'Second Rack')!.id;

    useRackStore.getState().switchRack(firstRackId);
    useRackStore.getState().addDeviceFromTemplate('cat6-patch-12', 1);
    const firstRackDeviceCount = useRackStore.getState().layout.devices.length;

    useRackStore.getState().switchRack(secondRackId);
    const state = useRackStore.getState();
    expect(state.currentRackId).toBe(secondRackId);
    expect(state.layout.name).toBe('Second Rack');
    expect(state.layout.devices.length).toBe(0);

    useRackStore.getState().switchRack(firstRackId);
    expect(useRackStore.getState().layout.devices.length).toBe(firstRackDeviceCount);
  });

  it('renameRack updates rack name', () => {
    const rackId = useRackStore.getState().currentRackId;
    useRackStore.getState().renameRack(rackId, 'Renamed Rack');
    const state = useRackStore.getState();
    expect(state.layout.name).toBe('Renamed Rack');
    expect(state.workspace.racks.find((r) => r.id === rackId)!.name).toBe('Renamed Rack');
  });

  it('renameWorkspace updates workspace name', () => {
    useRackStore.getState().renameWorkspace('Super Lab');
    expect(useRackStore.getState().workspace.name).toBe('Super Lab');
  });

  it('inter-rack cable CRUD', async () => {
    // Set up two racks with real devices that have ethernet ports
    useRackStore.getState().createRack('Rack A', '19in', 12);
    const rackA = useRackStore.getState().layout;
    useRackStore.getState().addDeviceFromTemplate('usw-flex-mini', 1);
    const devA = useRackStore.getState().layout.devices.find((d) => d.templateId === 'usw-flex-mini')!;

    await new Promise((r) => setTimeout(r, 10));

    useRackStore.getState().createRack('Rack B', '19in', 12);
    const rackB = useRackStore.getState().layout;
    useRackStore.getState().addDeviceFromTemplate('usw-flex-mini', 1);
    const devB = useRackStore.getState().layout.devices.find((d) => d.templateId === 'usw-flex-mini')!;

    // Make sure both racks are in the workspace before adding the cable
    const workspace = useRackStore.getState().workspace;

    const cable: Omit<InterRackCable, 'id'> = {
      fromRackId: rackA.id,
      fromDeviceId: devA.id,
      fromPort: { type: 'ethernet', index: 0 },
      toRackId: rackB.id,
      toDeviceId: devB.id,
      toPort: { type: 'ethernet', index: 0 },
      type: 'cat6a',
      lengthM: 5,
      label: 'Link A-B',
      color: '#ff0000',
      notes: 'Test cable',
    };
    // Debug: ensure racks and devices are distinct
    expect(rackA.id).not.toBe(rackB.id);
    expect(devA.id).not.toBe(devB.id);

    useRackStore.getState().addInterRackCable(cable);
    let state = useRackStore.getState();
    expect(state.workspace.interRackCables.length).toBe(1);
    const added = state.workspace.interRackCables[0];
    expect(added.type).toBe('cat6a');
    expect(added.label).toBe('Link A-B');

    useRackStore.getState().updateInterRackCable(added.id, { label: 'Updated Label' });
    state = useRackStore.getState();
    expect(state.workspace.interRackCables[0].label).toBe('Updated Label');

    useRackStore.getState().removeInterRackCable(added.id);
    state = useRackStore.getState();
    expect(state.workspace.interRackCables.length).toBe(0);
  });

  it('persistence round-trip', () => {
    localStorage.removeItem('homelab-rack-simulator-workspace');
    useRackStore.getState().createRack('Persisted Rack', '19in', 12);
    useRackStore.getState().addDeviceFromTemplate('cat6-patch-12', 1);
    const before = useRackStore.getState();

    useRackStore.getState().saveLocal();
    const savedJson = localStorage.getItem('homelab-rack-simulator-workspace');

    // Reset store state manually to simulate reload
    useRackStore.getState().newLayout('19in', 12);
    const blankLayout = useRackStore.getState().layout;
    useRackStore.setState({
      workspace: {
        id: 'reset',
        name: 'Reset',
        racks: [blankLayout],
        interRackCables: [],
        updatedAt: new Date().toISOString(),
      },
      currentRackId: blankLayout.id,
      history: [],
      historyIndex: -1,
      selectedDeviceId: null,
      selectedCableId: null,
    });

    // Restore saved workspace so loadLocal can find it
    localStorage.setItem('homelab-rack-simulator-workspace', savedJson!);
    const loaded = useRackStore.getState().loadLocal();
    expect(loaded).toBe(true);
    const after = useRackStore.getState();
    expect(after.workspace.name).toBe(before.workspace.name);
    expect(after.workspace.racks.length).toBe(before.workspace.racks.length);
    const totalDevicesAfter = after.workspace.racks.reduce((sum, r) => sum + r.devices.length, 0);
    const totalDevicesBefore = before.workspace.racks.reduce((sum, r) => sum + r.devices.length, 0);
    expect(totalDevicesAfter).toBe(totalDevicesBefore);

    localStorage.removeItem('homelab-rack-simulator-workspace');
  });

  it('workspace has correct structure after operations', () => {
    const state = useRackStore.getState();
    expect(state.workspace.id).toBeTruthy();
    expect(state.workspace.name).toBeTruthy();
    expect(Array.isArray(state.workspace.racks)).toBe(true);
    expect(Array.isArray(state.workspace.interRackCables)).toBe(true);
    expect(state.workspace.updatedAt).toBeTruthy();
  });
});
