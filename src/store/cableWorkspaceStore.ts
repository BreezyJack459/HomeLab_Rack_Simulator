import { create } from 'zustand';
import type { CableType } from '../types/rack';

export type CableWorkspaceSubview = '2d' | '3d' | 'table';
export type CableFocusMode = 'all' | 'dim' | 'hide';

type CableWorkspacePrefs = {
  subview: CableWorkspaceSubview;
  query: string;
  hiddenTypes: CableType[];
  focusMode: CableFocusMode;
};

type CableWorkspaceState = CableWorkspacePrefs & {
  abRequested: boolean;
  setABRequested: (open: boolean) => void;
  connectionRequested: boolean;
  requestConnection: () => void;
  consumeConnectionRequest: () => void;
  setSubview: (subview: CableWorkspaceSubview) => void;
  setQuery: (query: string) => void;
  setTypeVisible: (type: CableType, visible: boolean) => void;
  showAllTypes: () => void;
  setFocusMode: (focusMode: CableFocusMode) => void;
};

const STORAGE_KEY = 'homelab-rack-simulator-cable-workspace';
const DEFAULT_PREFS: CableWorkspacePrefs = {
  subview: '2d',
  query: '',
  hiddenTypes: [],
  focusMode: 'all',
};

function readPrefs(): CableWorkspacePrefs {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<CableWorkspacePrefs>;
    return {
      subview: parsed.subview === '3d' || parsed.subview === 'table' ? parsed.subview : '2d',
      query: typeof parsed.query === 'string' ? parsed.query : '',
      hiddenTypes: Array.isArray(parsed.hiddenTypes) ? parsed.hiddenTypes : [],
      focusMode: parsed.focusMode === 'dim' || parsed.focusMode === 'hide' ? parsed.focusMode : 'all',
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePrefs(prefs: CableWorkspacePrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage can be unavailable in private mode. Preferences remain in memory.
  }
}

function snapshot(state: CableWorkspacePrefs): CableWorkspacePrefs {
  return {
    subview: state.subview,
    query: state.query,
    hiddenTypes: state.hiddenTypes,
    focusMode: state.focusMode,
  };
}

const saved = readPrefs();

export const useCableWorkspaceStore = create<CableWorkspaceState>((set) => ({
  ...saved,
  abRequested: false,
  setABRequested: (open) => set({ abRequested: open }),
  connectionRequested: false,
  requestConnection: () => set({ connectionRequested: true }),
  consumeConnectionRequest: () => set({ connectionRequested: false }),
  setSubview: (subview) => set((state) => {
    writePrefs({ ...snapshot(state), subview });
    return { subview };
  }),
  setQuery: (query) => set((state) => {
    writePrefs({ ...snapshot(state), query });
    return { query };
  }),
  setTypeVisible: (type, visible) => set((state) => {
    const hiddenTypes = visible
      ? state.hiddenTypes.filter((item) => item !== type)
      : state.hiddenTypes.includes(type)
        ? state.hiddenTypes
        : [...state.hiddenTypes, type];
    writePrefs({ ...snapshot(state), hiddenTypes });
    return { hiddenTypes };
  }),
  showAllTypes: () => set((state) => {
    writePrefs({ ...snapshot(state), hiddenTypes: [] });
    return { hiddenTypes: [] };
  }),
  setFocusMode: (focusMode) => set((state) => {
    writePrefs({ ...snapshot(state), focusMode });
    return { focusMode };
  }),
}));

export const cableWorkspaceStorageKey = STORAGE_KEY;
export const defaultCableWorkspacePrefs = DEFAULT_PREFS;
