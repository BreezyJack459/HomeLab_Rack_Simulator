import { create } from 'zustand';

const STORAGE_KEY = 'homelab-rack-simulator-layout-prefs';

type LayoutPrefs = {
  deviceLibraryOpen: boolean;
  rackSummaryOpen: boolean;
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
  setRackSummaryOpen: (open: boolean) => void;
  toggleRackSummary: () => void;
}

const saved = readPrefs();

export const useLayoutPrefsStore = create<LayoutPrefsState>((set) => ({
  deviceLibraryOpen: saved.deviceLibraryOpen ?? false,
  rackSummaryOpen: saved.rackSummaryOpen ?? false,

  setDeviceLibraryOpen: (open) =>
    set((state) => {
      const next = { deviceLibraryOpen: open, rackSummaryOpen: state.rackSummaryOpen };
      writePrefs(next);
      return { deviceLibraryOpen: open };
    }),

  toggleDeviceLibrary: () =>
    set((state) => {
      const open = !state.deviceLibraryOpen;
      const next = { deviceLibraryOpen: open, rackSummaryOpen: state.rackSummaryOpen };
      writePrefs(next);
      return { deviceLibraryOpen: open };
    }),

  setRackSummaryOpen: (open) =>
    set((state) => {
      const next = { deviceLibraryOpen: state.deviceLibraryOpen, rackSummaryOpen: open };
      writePrefs(next);
      return { rackSummaryOpen: open };
    }),

  toggleRackSummary: () =>
    set((state) => {
      const open = !state.rackSummaryOpen;
      const next = { deviceLibraryOpen: state.deviceLibraryOpen, rackSummaryOpen: open };
      writePrefs(next);
      return { rackSummaryOpen: open };
    }),
}));
