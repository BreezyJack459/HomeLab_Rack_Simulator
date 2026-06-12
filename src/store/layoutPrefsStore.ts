import { create } from 'zustand';

const STORAGE_KEY = 'homelab-rack-simulator-layout-prefs';

type LayoutPrefs = {
  deviceLibraryOpen: boolean;
  inspectorOpen: boolean;
  rackSummaryOpen: boolean;
  bottomTrayOpen: boolean;
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
  setDeviceLibraryOpen: (open: boolean) => void;
  toggleDeviceLibrary: () => void;
  setInspectorOpen: (open: boolean) => void;
  toggleInspector: () => void;
  setRackSummaryOpen: (open: boolean) => void;
  toggleRackSummary: () => void;
  setBottomTrayOpen: (open: boolean) => void;
  toggleBottomTray: () => void;
}

const saved = readPrefs();

function snapshot(state: LayoutPrefs): LayoutPrefs {
  return {
    deviceLibraryOpen: state.deviceLibraryOpen,
    inspectorOpen: state.inspectorOpen,
    rackSummaryOpen: state.rackSummaryOpen,
    bottomTrayOpen: state.bottomTrayOpen,
  };
}

export const useLayoutPrefsStore = create<LayoutPrefsState>((set) => ({
  deviceLibraryOpen: saved.deviceLibraryOpen ?? false,
  inspectorOpen: saved.inspectorOpen ?? true,
  rackSummaryOpen: saved.rackSummaryOpen ?? false,
  bottomTrayOpen: saved.bottomTrayOpen ?? false,

  setDeviceLibraryOpen: (open) =>
    set((state) => {
      const next = { ...snapshot(state), deviceLibraryOpen: open };
      writePrefs(next);
      return { deviceLibraryOpen: open };
    }),

  toggleDeviceLibrary: () =>
    set((state) => {
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
}));
