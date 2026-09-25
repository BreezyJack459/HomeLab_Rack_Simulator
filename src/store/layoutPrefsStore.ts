import { create } from 'zustand';
import {
  builtInPackPluginIds,
  defaultEnabledPluginIds,
} from '../plugins/builtInPlugins';

const STORAGE_KEY = 'homelab-rack-simulator-layout-prefs';

type LayoutPrefs = {
  deviceLibraryOpen: boolean;
  inspectorOpen: boolean;
  rackSummaryOpen: boolean;
  bottomTrayOpen: boolean;
  enabledPluginIds: string[];
  approvedLocalPluginIds: string[];
};

type PersistedPrefs = Partial<LayoutPrefs>;

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
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

// Fresh installs get the default set (workspace packs off). Returning users
// already have a saved list — append any built-in workspace packs they are
// missing so the operate/plan/portfolio workspaces don't silently disappear.
function resolveEnabledPluginIds(savedIds: string[] | undefined): string[] {
  if (!savedIds) {
    return defaultEnabledPluginIds;
  }
  const missingPackIds = builtInPackPluginIds.filter(
    (pluginId) => !savedIds.includes(pluginId),
  );
  return missingPackIds.length > 0
    ? [...savedIds, ...missingPackIds]
    : savedIds;
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
