import { create } from 'zustand';
import {
  defaultEnabledPluginIds,
} from '../plugins/builtInPlugins';

const STORAGE_KEY = 'homelab-rack-simulator-layout-prefs';
const PREFS_VERSION = 1;

type LayoutPrefs = {
  deviceLibraryOpen: boolean;
  inspectorOpen: boolean;
  rackSummaryOpen: boolean;
  bottomTrayOpen: boolean;
  enabledPluginIds: string[];
  approvedLocalPluginIds: string[];
};

type PersistedPrefs = Partial<LayoutPrefs> & { prefsVersion?: number };

function readPrefs(): PersistedPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PersistedPrefs;
  } catch {
    return {};
  }
}

function writePrefs(prefs: LayoutPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prefs, prefsVersion: PREFS_VERSION }));
  } catch {
    // ignore quota / private mode
  }
}

interface LayoutPrefsState extends LayoutPrefs {
  deviceLibraryDrawerOpen: boolean;
  setDeviceLibraryOpen: (open: boolean) => void;
  setDeviceLibraryDrawerOpen: (open: boolean) => void;
  toggleDeviceLibrary: () => void;
  setInspectorOpen: (open: boolean) => void;
  toggleInspector: () => void;
  setRackSummaryOpen: (open: boolean) => void;
  toggleRackSummary: () => void;
  setBottomTrayOpen: (open: boolean) => void;
  toggleBottomTray: () => void;
  setEnabledPluginIds: (pluginIds: string[]) => void;
  setApprovedLocalPluginIds: (pluginIds: string[]) => void;
}

const saved = readPrefs();

// A saved list is authoritative: missing packs may have been explicitly
// disabled. Unversioned data cannot distinguish that choice from legacy defaults.
// Checkpoint it once without re-enabling packs; fresh installs stay core-only.
function resolveEnabledPluginIds(savedIds: string[] | undefined): string[] {
  return Array.isArray(savedIds)
    ? savedIds.filter((id): id is string => typeof id === 'string')
    : defaultEnabledPluginIds;
}

function snapshot(state: LayoutPrefs): LayoutPrefs {
  return {
    deviceLibraryOpen: state.deviceLibraryOpen,
    inspectorOpen: state.inspectorOpen,
    rackSummaryOpen: state.rackSummaryOpen,
    bottomTrayOpen: state.bottomTrayOpen,
    enabledPluginIds: state.enabledPluginIds,
    approvedLocalPluginIds: state.approvedLocalPluginIds,
  };
}

export const useLayoutPrefsStore = create<LayoutPrefsState>((set) => ({
  deviceLibraryOpen: saved.deviceLibraryOpen ?? true,
  deviceLibraryDrawerOpen: false,
  inspectorOpen: saved.inspectorOpen ?? true,
  rackSummaryOpen: saved.rackSummaryOpen ?? false,
  bottomTrayOpen: saved.bottomTrayOpen ?? false,
  enabledPluginIds: resolveEnabledPluginIds(saved.enabledPluginIds),
  approvedLocalPluginIds: saved.approvedLocalPluginIds ?? [],

  setDeviceLibraryOpen: (open) =>
    set((state) => {
      const next = { ...snapshot(state), deviceLibraryOpen: open };
      writePrefs(next);
      return { deviceLibraryOpen: open };
    }),

  setDeviceLibraryDrawerOpen: (open) => set({ deviceLibraryDrawerOpen: open }),

  toggleDeviceLibrary: () =>
    set((state) => {
      const isDrawer = typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(max-width: 1023px)').matches;
      if (isDrawer) {
        return { deviceLibraryDrawerOpen: !state.deviceLibraryDrawerOpen };
      }
      const open = !state.deviceLibraryOpen;
      const next = { ...snapshot(state), deviceLibraryOpen: open };
      writePrefs(next);
      return { deviceLibraryOpen: open };
    }),

  setInspectorOpen: (open) =>
    set((state) => {
      const next = { ...snapshot(state), inspectorOpen: open };
      writePrefs(next);
      return { inspectorOpen: open };
    }),

  toggleInspector: () =>
    set((state) => {
      const open = !state.inspectorOpen;
      const next = { ...snapshot(state), inspectorOpen: open };
      writePrefs(next);
      return { inspectorOpen: open };
    }),

  setRackSummaryOpen: (open) =>
    set((state) => {
      const next = { ...snapshot(state), rackSummaryOpen: open };
      writePrefs(next);
      return { rackSummaryOpen: open };
    }),

  toggleRackSummary: () =>
    set((state) => {
      const open = !state.rackSummaryOpen;
      const next = { ...snapshot(state), rackSummaryOpen: open };
      writePrefs(next);
      return { rackSummaryOpen: open };
    }),

  setBottomTrayOpen: (open) =>
    set((state) => {
      const next = { ...snapshot(state), bottomTrayOpen: open };
      writePrefs(next);
      return { bottomTrayOpen: open };
    }),

  toggleBottomTray: () =>
    set((state) => {
      const open = !state.bottomTrayOpen;
      const next = { ...snapshot(state), bottomTrayOpen: open };
      writePrefs(next);
      return { bottomTrayOpen: open };
    }),

  setEnabledPluginIds: (enabledPluginIds) =>
    set((state) => {
      const next = { ...snapshot(state), enabledPluginIds };
      writePrefs(next);
      return { enabledPluginIds };
    }),

  setApprovedLocalPluginIds: (approvedLocalPluginIds) =>
    set((state) => {
      const next = { ...snapshot(state), approvedLocalPluginIds };
      writePrefs(next);
      return { approvedLocalPluginIds };
    }),
}));

if ((saved.prefsVersion ?? 0) < PREFS_VERSION) {
  writePrefs(snapshot(useLayoutPrefsStore.getState()));
}
