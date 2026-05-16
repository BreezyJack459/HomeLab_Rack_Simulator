#!/usr/bin/env python3
"""Patch rackStore.ts to add workspace support."""

import re

with open('src/store/rackStore.ts', 'r') as f:
    content = f.read()

# 1. Update imports
content = content.replace(
    "import type { CableRoute, DeviceTemplate, PlacedDevice, RackLayout, RackReservation, RackType, ViewMode, ViewSide } from '../types/rack';",
    "import type { CableRoute, DeviceTemplate, PlacedDevice, RackLayout, RackReservation, RackType, ViewMode, ViewSide, Workspace, InterRackCable } from '../types/rack';"
)

# 2. Update storage keys
content = content.replace(
    "const STORAGE_KEY = 'homelab-rack-simulator-layout';",
    "const STORAGE_KEY = 'homelab-rack-simulator-workspace';\nconst LEGACY_STORAGE_KEY = 'homelab-rack-simulator-layout';"
)

# 3. Add workspace helpers after createBlankLayout
workspace_helpers = '''
function createDefaultWorkspace(initialLayout?: RackLayout): Workspace {
  const layout = initialLayout ?? createBlankLayout();
  return {
    id: newId('workspace'),
    name: 'My Lab',
    racks: [layout],
    interRackCables: [],
    updatedAt: new Date().toISOString(),
  };
}

function syncWorkspace(workspace: Workspace, currentRackId: string, layout: RackLayout): Workspace {
  return {
    ...workspace,
    racks: workspace.racks.map((r) => (r.id === currentRackId ? layout : r)),
    updatedAt: new Date().toISOString(),
  };
}

function saveWorkspace(workspace: Workspace) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    // Ignore storage quota errors
  }
}
'''

content = content.replace(
    'function withCableNodes(layout: RackLayout, changedDeviceIds?: Set<string>): RackLayout {',
    workspace_helpers + 'function withCableNodes(layout: RackLayout, changedDeviceIds?: Set<string>): RackLayout {'
)

# 4. Update touch() to not save directly
content = content.replace(
    '''function touch(layout: RackLayout, changedDeviceIds?: Set<string>): RackLayout {
  const updated = { ...withCableNodes(layout, changedDeviceIds), updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
  return updated;
}''',
    '''function touch(layout: RackLayout, changedDeviceIds?: Set<string>): RackLayout {
  return { ...withCableNodes(layout, changedDeviceIds), updatedAt: new Date().toISOString() };
}'''
)

# 5. Add workspace fields to RackState interface
content = content.replace(
    'interface RackState {\n  layout: RackLayout;',
    'interface RackState {\n  workspace: Workspace;\n  currentRackId: string;\n  layout: RackLayout;'
)

# 6. Add workspace actions to interface
content = content.replace(
    '''  registerPortPick3D: (handler: ((hit: PortHit3D) => void) | null) => void;
}''',
    '''  registerPortPick3D: (handler: ((hit: PortHit3D) => void) | null) => void;
  // ── Workspace actions ──
  createRack: (name: string, rackType?: RackType, heightU?: number) => void;
  deleteRack: (rackId: string) => void;
  duplicateRack: (rackId: string, newName: string) => void;
  switchRack: (rackId: string) => void;
  renameRack: (rackId: string, name: string) => void;
  renameWorkspace: (name: string) => void;
  addInterRackCable: (cable: Omit<InterRackCable, 'id'>) => void;
  removeInterRackCable: (cableId: string) => void;
  updateInterRackCable: (cableId: string, patch: Partial<InterRackCable>) => void;
}'''
)

# 7. Update store initialization
content = content.replace(
    '''const MAX_HISTORY = 50;
const initialLayout = normalizeLayout(sampleLayouts[1]);

export const useRackStore = create<RackState>((set, get) => ({
  layout: initialLayout,
  selectedDeviceId: initialLayout.devices[0]?.id ?? null,''',
    '''const MAX_HISTORY = 50;
const initialLayout = normalizeLayout(sampleLayouts[1]);
const initialWorkspace = createDefaultWorkspace(initialLayout);

export const useRackStore = create<RackState>((set, get) => ({
  workspace: initialWorkspace,
  currentRackId: initialWorkspace.racks[0].id,
  layout: initialLayout,
  selectedDeviceId: initialLayout.devices[0]?.id ?? null,'''
)

# 8. Update saveLocal
content = content.replace(
    '''  saveLocal: () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(get().layout));
    set({ statusMessage: 'Layout saved locally.' });
  },''',
    '''  saveLocal: () => {
    const { workspace, currentRackId, layout } = get();
    const synced = syncWorkspace(workspace, currentRackId, layout);
    saveWorkspace(synced);
    set({ statusMessage: 'Workspace saved locally.' });
  },'''
)

# 9. Update loadLocal
old_loadlocal = '''  loadLocal: () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      set({ statusMessage: 'No saved local layout found.' });
      return false;
    }
    try {
      const layout = normalizeLayout(JSON.parse(raw));
      set({
        layout,
        selectedDeviceId: layout.devices[0]?.id ?? null,
        selectedCableId: null,
        statusMessage: 'Local layout loaded.',
        ...historyFor(layout),
        skipNextHistory: true
      });
      return true;
    } catch {
      set({ statusMessage: 'Saved layout could not be read.' });
      return false;
    }
  },'''

new_loadlocal = '''  loadLocal: () => {
    // Try workspace format first
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.racks && Array.isArray(parsed.racks)) {
          const workspace: Workspace = {
            ...createDefaultWorkspace(),
            ...parsed,
            racks: parsed.racks.map((r: RackLayout) => normalizeLayout(r)),
            interRackCables: parsed.interRackCables ?? [],
          };
          const currentRackId = workspace.racks[0]?.id ?? workspace.racks[0]?.id;
          const layout = workspace.racks.find((r) => r.id === currentRackId) ?? workspace.racks[0];
          set({
            workspace,
            currentRackId: layout.id,
            layout,
            selectedDeviceId: layout.devices[0]?.id ?? null,
            selectedCableId: null,
            statusMessage: 'Workspace loaded.',
            ...historyFor(layout),
            skipNextHistory: true,
          });
          return true;
        }
      } catch {
        // Fall through to legacy format
      }
    }
    // Try legacy layout format
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      try {
        const layout = normalizeLayout(JSON.parse(legacyRaw));
        const workspace = createDefaultWorkspace(layout);
        set({
          workspace,
          currentRackId: workspace.racks[0].id,
          layout,
          selectedDeviceId: layout.devices[0]?.id ?? null,
          selectedCableId: null,
          statusMessage: 'Legacy layout migrated to workspace.',
          ...historyFor(layout),
          skipNextHistory: true,
        });
        saveWorkspace(workspace);
        return true;
      } catch {
        set({ statusMessage: 'Saved layout could not be read.' });
        return false;
      }
    }
    set({ statusMessage: 'No saved workspace found.' });
    return false;
  },'''

content = content.replace(old_loadlocal, new_loadlocal)

# 10. Add workspace actions before the closing }));
workspace_actions = '''
  // ── Workspace actions ──
  createRack: (name, rackType = '19in', heightU = 12) => {
    const newLayout = createBlankLayout(rackType, heightU);
    newLayout.name = name;
    const { workspace } = get();
    const updatedWorkspace = {
      ...workspace,
      racks: [...workspace.racks, newLayout],
      updatedAt: new Date().toISOString(),
    };
    set({
      workspace: updatedWorkspace,
      currentRackId: newLayout.id,
      layout: newLayout,
      selectedDeviceId: null,
      selectedCableId: null,
      statusMessage: `Rack "${name}" created.`,
      ...historyFor(newLayout),
      skipNextHistory: true,
    });
    saveWorkspace(updatedWorkspace);
  },

  deleteRack: (rackId) => {
    const { workspace, currentRackId, layout } = get();
    const remaining = workspace.racks.filter((r) => r.id !== rackId);
    if (remaining.length === 0) {
      const newLayout = createBlankLayout();
      const updatedWorkspace = {
        ...workspace,
        racks: [newLayout],
        updatedAt: new Date().toISOString(),
      };
      set({
        workspace: updatedWorkspace,
        currentRackId: newLayout.id,
        layout: newLayout,
        selectedDeviceId: null,
        selectedCableId: null,
        statusMessage: 'Last rack deleted. New default rack created.',
        ...historyFor(newLayout),
        skipNextHistory: true,
      });
      saveWorkspace(updatedWorkspace);
      return;
    }
    const updatedWorkspace = {
      ...workspace,
      racks: remaining,
      updatedAt: new Date().toISOString(),
    };
    if (currentRackId === rackId) {
      const newLayout = remaining[0];
      set({
        workspace: updatedWorkspace,
        currentRackId: newLayout.id,
        layout: newLayout,
        selectedDeviceId: null,
        selectedCableId: null,
        statusMessage: 'Rack deleted.',
        ...historyFor(newLayout),
        skipNextHistory: true,
      });
    } else {
      set({
        workspace: updatedWorkspace,
        statusMessage: 'Rack deleted.',
      });
    }
    saveWorkspace(updatedWorkspace);
  },

  duplicateRack: (rackId, newName) => {
    const { workspace } = get();
    const source = workspace.racks.find((r) => r.id === rackId);
    if (!source) return;
    const cloned: RackLayout = JSON.parse(JSON.stringify(source));
    cloned.id = newId('layout');
    cloned.name = newName;
    cloned.devices = cloned.devices.map((d) => ({ ...d, id: newId('dev') }));
    cloned.cables = cloned.cables.map((c) => ({ ...c, id: newId('cable') }));
    const updatedWorkspace = {
      ...workspace,
      racks: [...workspace.racks, cloned],
      updatedAt: new Date().toISOString(),
    };
    set({
      workspace: updatedWorkspace,
      currentRackId: cloned.id,
      layout: cloned,
      selectedDeviceId: null,
      selectedCableId: null,
      statusMessage: `Rack "${newName}" duplicated.`,
      ...historyFor(cloned),
      skipNextHistory: true,
    });
    saveWorkspace(updatedWorkspace);
  },

  switchRack: (rackId) => {
    const { workspace, currentRackId, layout } = get();
    const target = workspace.racks.find((r) => r.id === rackId);
    if (!target || rackId === currentRackId) return;
    const syncedWorkspace = syncWorkspace(workspace, currentRackId, layout);
    set({
      workspace: syncedWorkspace,
      currentRackId: rackId,
      layout: cloneLayout(target),
      selectedDeviceId: null,
      selectedCableId: null,
      statusMessage: `Switched to "${target.name}".`,
      ...historyFor(target),
      skipNextHistory: true,
    });
    saveWorkspace(syncedWorkspace);
  },

  renameRack: (rackId, name) => {
    const { workspace, layout, currentRackId } = get();
    const updatedRacks = workspace.racks.map((r) => (r.id === rackId ? { ...r, name } : r));
    const updatedLayout = rackId === currentRackId ? { ...layout, name } : layout;
    const updatedWorkspace = { ...workspace, racks: updatedRacks, updatedAt: new Date().toISOString() };
    set({
      workspace: updatedWorkspace,
      layout: updatedLayout,
      statusMessage: `Rack renamed to "${name}".`,
    });
    saveWorkspace(updatedWorkspace);
  },

  renameWorkspace: (name) => {
    const { workspace } = get();
    const updated = { ...workspace, name, updatedAt: new Date().toISOString() };
    set({ workspace: updated, statusMessage: `Workspace renamed to "${name}".` });
    saveWorkspace(updated);
  },

  addInterRackCable: (cable) => {
    const { workspace } = get();
    const newCable: InterRackCable = { ...cable, id: newId('irc') };
    const updated = {
      ...workspace,
      interRackCables: [...workspace.interRackCables, newCable],
      updatedAt: new Date().toISOString(),
    };
    set({ workspace: updated, statusMessage: 'Inter-rack cable added.' });
    saveWorkspace(updated);
  },

  removeInterRackCable: (cableId) => {
    const { workspace } = get();
    const updated = {
      ...workspace,
      interRackCables: workspace.interRackCables.filter((c) => c.id !== cableId),
      updatedAt: new Date().toISOString(),
    };
    set({ workspace: updated, statusMessage: 'Inter-rack cable removed.' });
    saveWorkspace(updated);
  },

  updateInterRackCable: (cableId, patch) => {
    const { workspace } = get();
    const updated = {
      ...workspace,
      interRackCables: workspace.interRackCables.map((c) => (c.id === cableId ? { ...c, ...patch } : c)),
      updatedAt: new Date().toISOString(),
    };
    set({ workspace: updated, statusMessage: 'Inter-rack cable updated.' });
    saveWorkspace(updated);
  },
'''

content = content.replace(
    '  registerPortPick3D: (handler) => set({ onPortPick3D: handler })\n}));',
    workspace_actions + '  registerPortPick3D: (handler) => set({ onPortPick3D: handler }),\n}));'
)

# 11. Update subscriber to sync workspace
old_subscriber = '''// Track layout changes for undo/redo
useRackStore.subscribe((state, prevState) => {
  try {
    if (state.skipNextHistory) {
      useRackStore.setState({ skipNextHistory: false });
      return;
    }
    if (state.layout !== prevState.layout) {
      const history = state.history.slice(0, state.historyIndex + 1);
      history.push(cloneLayout(state.layout));
      const trimmedHistory = history.length > MAX_HISTORY ? history.slice(1) : history;
      const historyIndex = trimmedHistory.length - 1;
      useRackStore.setState({ history: trimmedHistory, historyIndex });
    }
  } catch (error) {
    console.error('[rackStore] Failed to record history', error);
  }
});'''

new_subscriber = '''// Track layout changes for undo/redo and sync workspace
useRackStore.subscribe((state, prevState) => {
  try {
    if (state.skipNextHistory) {
      useRackStore.setState({ skipNextHistory: false });
      return;
    }
    if (state.layout !== prevState.layout) {
      const history = state.history.slice(0, state.historyIndex + 1);
      history.push(cloneLayout(state.layout));
      const trimmedHistory = history.length > MAX_HISTORY ? history.slice(1) : history;
      const historyIndex = trimmedHistory.length - 1;
      useRackStore.setState({ history: trimmedHistory, historyIndex });
      // Sync workspace with updated layout
      const synced = syncWorkspace(state.workspace, state.currentRackId, state.layout);
      saveWorkspace(synced);
      useRackStore.setState({ workspace: synced });
    }
  } catch (error) {
    console.error('[rackStore] Failed to record history', error);
  }
});'''

content = content.replace(old_subscriber, new_subscriber)

with open('src/store/rackStore.ts', 'w') as f:
    f.write(content)

print('Done!')
