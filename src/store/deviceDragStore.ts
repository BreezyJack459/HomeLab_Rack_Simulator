import { create } from 'zustand';

export type LibraryDragSource = { kind: 'template' | 'inventory'; id: string };
// DataTransfer payloads are protected during dragover. Keep only the source id
// in transient UI state so previews work in real browsers without reading it.
export const useDeviceDragStore = create<{
  source: LibraryDragSource | null;
  start: (source: LibraryDragSource) => void;
  end: () => void;
}>((set) => ({
  source: null,
  start: (source) => set({ source }),
  end: () => set({ source: null }),
}));
