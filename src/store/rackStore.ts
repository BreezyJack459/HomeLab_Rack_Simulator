import { create } from 'zustand';
import { deviceCatalog } from '../data/deviceCatalog';
import { sampleLayouts } from '../data/sampleLayouts';
import type { CableRoute, DeviceTemplate, PlacedDevice, RackLayout, RackType, ViewMode, ViewSide } from '../types/rack';
import { shouldHideDevice, withoutHiddenZeroUPdu } from '../utils/featureFlags';
import { calculateCableNodes } from '../utils/routing';
import {
  clampDeviceX,
  clampDevicePosition,
  defaultWeightLimit,
  getDefaultDeviceX,
  findFirstFreeSlot,
  getDeviceMountSide,
  getDeviceWidthMm,
  hasOverlap,
  isDeviceWithinRack,
  isZeroU,
  RACK_SPECS
} from '../utils/rackMath';

const STORAGE_KEY = 'homelab-rack-simulator-layout';

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneLayout(layout: RackLayout): RackLayout {
  return JSON.parse(JSON.stringify(layout)) as RackLayout;
}

function historyFor(layout: RackLayout): Pick<RackState, 'history' | 'historyIndex' | 'skipNextHistory'> {
  return {
    history: [cloneLayout(layout)],
    historyIndex: 0,
    skipNextHistory: false
  };
}

function templateToDevice(template: DeviceTemplate, positionU: number, xMm?: number, mountSide: ViewSide = 'front'): PlacedDevice {
  return {
    id: newId('dev'),
    templateId: template.id,
    category: template.category,
    name: template.name,
    mountSide,
    positionU,
    xMm,
    sizeU: template.defaultU,
    depthMm: template.depthMm,
    widthType: template.widthType,
    customWidthMm: template.customWidthMm,
    weightKg: template.weightKg,
    powerW: template.powerW,
    heatLevel: template.heatLevel,
    ports: template.ports,
    portFaceOverrides: template.portFaceOverrides,
    portLayouts: template.portLayouts,
    mountType: template.category === 'pdu-0u' ? (template.mountType ?? 'rear-rail') : template.mountType,
    mountSide0U: template.mountSide0U,
    outletFacing: template.outletFacing,
    color: template.color,
    description: template.description
  };
}

function createBlankLayout(rackType: RackType = '19in', heightU = 12): RackLayout {
  return {
    id: newId('layout'),
    name: 'Untitled homelab rack',
    rackType,
    heightU,
    rackDepthMm: RACK_SPECS[rackType].defaultDepthMm,
    weightLimitKg: defaultWeightLimit(rackType, heightU),
    powerBudgetW: rackType === '10in' ? 450 : 1200,
    viewSide: 'front',
    devices: [],
    cables: [],
    updatedAt: new Date().toISOString()
  };
}

function withCableNodes(layout: RackLayout, changedDeviceIds?: Set<string>): RackLayout {
  return {
    ...layout,
    cables: (layout.cables ?? []).map((cable) => {
      if (!changedDeviceIds) {
        return { ...cable, nodes: calculateCableNodes(cable, layout) };
      }
      if (changedDeviceIds.has(cable.fromDeviceId) || changedDeviceIds.has(cable.toDeviceId)) {
        return { ...cable, nodes: calculateCableNodes(cable, layout) };
      }
      return cable;
    })
  };
}

function touch(layout: RackLayout, changedDeviceIds?: Set<string>): RackLayout {
  const updated = { ...withCableNodes(layout, changedDeviceIds), updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
  return updated;
}

function normalizeLayout(layout: RackLayout): RackLayout {
  const visibleLayout = withoutHiddenZeroUPdu(layout);
  const base = {
    ...createBlankLayout(visibleLayout.rackType, visibleLayout.heightU),
    ...visibleLayout,
    cables: visibleLayout.cables ?? [],
    updatedAt: new Date().toISOString()
  };
  const normalized = {
    ...base,
    devices: (visibleLayout.devices ?? []).map((device) => {
      // Migrate legacy 0U devices without mountType
      const migrated = isZeroU(device) && !device.mountType
        ? {
            ...device,
            mountType: 'rear-rail' as const,
            mountSide0U: device.mountSide0U ?? ((device.xMm ?? 0) < 0 ? 'left' : 'right'),
          }
        : device;
      return {
        ...migrated,
        mountSide: getDeviceMountSide(migrated),
        xMm: clampDeviceX(
          base,
          migrated,
          migrated.xMm ?? getDefaultDeviceX(base, migrated)
        )
      };
    })
  };
  return withCableNodes(normalized);
}

function removeCablesForDevice(layout: RackLayout, deviceId: string) {
  return layout.cables.filter((cable) => cable.fromDeviceId !== deviceId && cable.toDeviceId !== deviceId);
}

interface RackState {
  layout: RackLayout;
  selectedDeviceId: string | null;
  selectedCableId: string | null;
  viewMode: ViewMode;
  editorZoom: number;
  editorPan: { x: number; y: number };
  statusMessage: string | null;
  debugMode: boolean;
  cableRoutingMode: 'clean' | 'realistic';
  history: RackLayout[];
  historyIndex: number;
  skipNextHistory: boolean;
  addDeviceFromTemplate: (templateId: string, positionU?: number, xMm?: number) => boolean;
  moveDevice: (deviceId: string, positionU: number, xMm?: number) => boolean;
  updateDevice: (deviceId: string, patch: Partial<PlacedDevice>) => boolean;
  removeDevice: (deviceId: string) => void;
  selectDevice: (deviceId: string | null) => void;
  selectCable: (cableId: string | null) => void;
  addCable: (route: Omit<CableRoute, 'id'>) => void;
  removeCable: (cableId: string) => void;
  updateRack: (patch: Partial<RackLayout>) => void;
  setRackType: (rackType: RackType) => void;
  setRackHeight: (heightU: number) => void;
  setViewSide: (viewSide: ViewSide) => void;
  setViewMode: (viewMode: ViewMode) => void;
  setEditorZoom: (zoom: number) => void;
  setEditorPan: (pan: { x: number; y: number }) => void;
  clearStatus: () => void;
  newLayout: (rackType?: RackType, heightU?: number) => void;
  loadLayout: (layout: RackLayout) => void;
  loadSample: (sampleId: string) => void;
  saveLocal: () => void;
  loadLocal: () => boolean;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  toggleDebugMode: () => void;
  setCableRoutingMode: (mode: 'clean' | 'realistic') => void;
}

const MAX_HISTORY = 50;
const initialLayout = normalizeLayout(sampleLayouts[1]);

export const useRackStore = create<RackState>((set, get) => ({
  layout: initialLayout,
  selectedDeviceId: initialLayout.devices[0]?.id ?? null,
  selectedCableId: null,
  viewMode: '2d',
  editorZoom: 1,
  editorPan: { x: 0, y: 0 },
  statusMessage: null,
  debugMode: false,
  cableRoutingMode: 'clean',
  ...historyFor(initialLayout),

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      set({
        layout: cloneLayout(history[nextIndex]),
        historyIndex: nextIndex,
        skipNextHistory: true,
        statusMessage: 'Undo.'
      });
    }
  },
  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      set({
        layout: cloneLayout(history[nextIndex]),
        historyIndex: nextIndex,
        skipNextHistory: true,
        statusMessage: 'Redo.'
      });
    }
  },
  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  addDeviceFromTemplate: (templateId, requestedPositionU, requestedXMm) => {
    const template = deviceCatalog.find((item) => item.id === templateId);
    if (!template) return false;
    if (shouldHideDevice(template)) {
      set({ statusMessage: `${template.name} is hidden until 0U PDU support is redesigned.` });
      return false;
    }
    if (template.rackMountable === false) {
      set({ statusMessage: `${template.name} is an external device and should not be placed inside the rack.` });
      return false;
    }
    const layout = get().layout;
    const mountSide = layout.viewSide;
    const draftDevice = templateToDevice(template, requestedPositionU ?? 1, requestedXMm, mountSide);
    const slot =
      requestedPositionU !== undefined
        ? {
            positionU: clampDevicePosition(layout, template.defaultU, requestedPositionU),
            xMm: clampDeviceX(
              layout,
              draftDevice,
              requestedXMm ?? getDefaultDeviceX(layout, draftDevice)
            )
          }
        : findFirstFreeSlot(layout, draftDevice);
    if (slot === null) {
      set({ statusMessage: `No free ${template.defaultU}U space for ${template.name}.` });
      return false;
    }
    const device = templateToDevice(template, slot.positionU, slot.xMm, mountSide);
    if (hasOverlap(layout, layout.devices, device)) {
      set({ statusMessage: `${template.name} would overlap another component.` });
      return false;
    }
    if (!isDeviceWithinRack(layout, device)) {
      set({ statusMessage: `${template.name} does not fit inside this rack height.` });
      return false;
    }
    // Placement mutations are centralized here so 2D and 3D views can share one reliable layout model.
    set({
      layout: touch({ ...layout, devices: [...layout.devices, device] }),
      selectedDeviceId: device.id,
      selectedCableId: null,
      statusMessage: `${template.name} added to ${mountSide} side at U${slot.positionU}.`
    });
    return true;
  },

  moveDevice: (deviceId, positionU, xMm) => {
    const layout = get().layout;
    const device = layout.devices.find((item) => item.id === deviceId);
    if (!device) return false;
    const nextDevice = {
      ...device,
      positionU: clampDevicePosition(layout, device.sizeU, positionU),
      xMm: clampDeviceX(
        layout,
        device,
        xMm ??
          device.xMm ??
          (RACK_SPECS[layout.rackType].usableWidthMm - Math.min(getDeviceWidthMm(device), RACK_SPECS[layout.rackType].usableWidthMm)) / 2
      )
    };
    if (hasOverlap(layout, layout.devices, nextDevice)) {
      set({ statusMessage: `${device.name} cannot move there; space is occupied.` });
      return false;
    }
    set({
      layout: touch(
        {
          ...layout,
          devices: layout.devices.map((item) => (item.id === deviceId ? nextDevice : item))
        },
        new Set([deviceId])
      ),
      selectedDeviceId: deviceId,
      statusMessage: null
    });
    return true;
  },

  updateDevice: (deviceId, patch) => {
    const layout = get().layout;
    const device = layout.devices.find((item) => item.id === deviceId);
    if (!device) return false;
    const sizeU = Math.max(0, Math.min(layout.heightU, Number(patch.sizeU ?? device.sizeU)));
    const deviceWithPatch = { ...device, ...patch, sizeU };
    const shouldResetZeroUX = isZeroU(deviceWithPatch) && (patch.mountType !== undefined || patch.mountSide0U !== undefined) && patch.xMm === undefined;
    const candidate = {
      ...device,
      ...patch,
      sizeU,
      positionU: clampDevicePosition(layout, sizeU, Number(patch.positionU ?? device.positionU)),
      xMm: clampDeviceX(
        layout,
        {
          widthType: patch.widthType ?? device.widthType,
          customWidthMm: patch.customWidthMm ?? device.customWidthMm,
          sizeU,
          mountType: patch.mountType ?? device.mountType,
          mountSide0U: patch.mountSide0U ?? device.mountSide0U
        },
        shouldResetZeroUX
          ? getDefaultDeviceX(layout, deviceWithPatch)
          : Number(patch.xMm ?? device.xMm ?? getDefaultDeviceX(layout, deviceWithPatch))
      )
    };
    // Resizing can move the effective top edge, so bounds and overlap are checked after clamping.
    if (!isDeviceWithinRack(layout, candidate)) {
      set({ statusMessage: `${candidate.name} does not fit inside the rack.` });
      return false;
    }
    if (hasOverlap(layout, layout.devices, candidate)) {
      set({ statusMessage: `${candidate.name} would overlap another component.` });
      return false;
    }
    set({
      layout: touch(
        {
          ...layout,
          devices: layout.devices.map((item) => (item.id === deviceId ? candidate : item))
        },
        new Set([deviceId])
      ),
      selectedDeviceId: deviceId,
      statusMessage: null
    });
    return true;
  },

  removeDevice: (deviceId) => {
    const layout = get().layout;
    set({
      layout: touch(
        {
          ...layout,
          devices: layout.devices.filter((device) => device.id !== deviceId),
          cables: removeCablesForDevice(layout, deviceId)
        },
        new Set() // remaining cables unchanged; removed ones already filtered out
      ),
      selectedDeviceId: get().selectedDeviceId === deviceId ? null : get().selectedDeviceId,
      selectedCableId: null,
      statusMessage: 'Component removed.'
    });
  },

  selectDevice: (deviceId) => set({ selectedDeviceId: deviceId, selectedCableId: null }),
  selectCable: (cableId) => set({ selectedCableId: cableId, selectedDeviceId: null }),

  addCable: (route) => {
    const layout = get().layout;
    if (route.fromDeviceId === route.toDeviceId) {
      set({ statusMessage: 'Cable route needs two different devices.' });
      return;
    }
    const cableId = newId('cable');
    const cable = { ...route, id: cableId, nodes: calculateCableNodes({ ...route, id: cableId }, layout) };
    const changedIds = new Set([route.fromDeviceId, route.toDeviceId]);
    set({
      layout: touch({ ...layout, cables: [...layout.cables, cable] }, changedIds),
      selectedCableId: cable.id,
      selectedDeviceId: null,
      statusMessage: 'Cable route added.'
    });
  },

  removeCable: (cableId) => {
    const layout = get().layout;
    const next = { ...layout, cables: layout.cables.filter((cable) => cable.id !== cableId) };
    const updated = { ...next, updatedAt: new Date().toISOString() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage quota errors
    }
    set({
      layout: updated,
      selectedCableId: null,
      statusMessage: 'Cable route removed.'
    });
  },

  updateRack: (patch) => {
    const layout = get().layout;
    const geometricKeys = new Set(['rackDepthMm', 'rearClearanceMm', 'railMinDepthMm', 'railMaxDepthMm', 'devices', 'cables', 'rackType', 'heightU', 'viewSide']);
    const needsRecompute = Object.keys(patch).some((key) => geometricKeys.has(key));
    const next = { ...layout, ...patch };
    if (needsRecompute) {
      set({ layout: touch(next), statusMessage: null });
    } else {
      const updated = { ...next, updatedAt: new Date().toISOString() };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage quota errors
      }
      set({ layout: updated, statusMessage: null });
    }
  },

  setRackType: (rackType) => {
    const layout = get().layout;
    const nextLayout = {
      ...layout,
      rackType,
      rackDepthMm: RACK_SPECS[rackType].defaultDepthMm,
      weightLimitKg: defaultWeightLimit(rackType, layout.heightU),
      powerBudgetW: rackType === '10in' ? 450 : 1200
    };
    set({
      layout: touch({
        ...nextLayout,
        devices: layout.devices.map((device) => ({
          ...device,
          xMm: clampDeviceX(nextLayout, device, device.xMm ?? 0)
        }))
      }),
      statusMessage: `Rack changed to ${RACK_SPECS[rackType].label}.`
    });
  },

  setRackHeight: (heightU) => {
    const layout = get().layout;
    const devices = layout.devices.filter((device) => device.positionU + device.sizeU - 1 <= heightU);
    const removed = layout.devices.length - devices.length;
    set({
      layout: touch({
        ...layout,
        heightU,
        devices,
        cables: layout.cables.filter(
          (cable) =>
            devices.some((device) => device.id === cable.fromDeviceId) &&
            devices.some((device) => device.id === cable.toDeviceId)
        ),
        weightLimitKg: defaultWeightLimit(layout.rackType, heightU)
      }),
      selectedDeviceId: devices.some((device) => device.id === get().selectedDeviceId) ? get().selectedDeviceId : null,
      selectedCableId: null,
      statusMessage: removed ? `${removed} component(s) removed because they no longer fit.` : null
    });
  },

  setViewSide: (viewSide) => {
    const layout = get().layout;
    set({ layout: touch({ ...layout, viewSide }) });
  },

  setViewMode: (viewMode) => set({ viewMode }),
  setEditorZoom: (zoom) => set({ editorZoom: Math.max(0.45, Math.min(1.8, zoom)) }),
  setEditorPan: (pan) => set({ editorPan: pan }),
  clearStatus: () => set({ statusMessage: null }),

  newLayout: (rackType = '19in', heightU = 12) => {
    const layout = createBlankLayout(rackType, heightU);
    set({
      layout,
      selectedDeviceId: null,
      selectedCableId: null,
      statusMessage: 'New layout created.',
      ...historyFor(layout),
      skipNextHistory: true
    });
  },

  loadLayout: (layout) => {
    const normalized = normalizeLayout(layout);
    set({
      layout: normalized,
      selectedDeviceId: normalized.devices[0]?.id ?? null,
      selectedCableId: null,
      statusMessage: `${layout.name} loaded.`,
      ...historyFor(normalized),
      skipNextHistory: true
    });
  },

  loadSample: (sampleId) => {
    const sample = sampleLayouts.find((layout) => layout.id === sampleId);
    if (!sample) return;
    const layout = normalizeLayout(sample);
    set({
      layout,
      selectedDeviceId: layout.devices[0]?.id ?? null,
      selectedCableId: null,
      statusMessage: `${sample.name} loaded.`,
      ...historyFor(layout),
      skipNextHistory: true
    });
  },

  saveLocal: () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(get().layout));
    set({ statusMessage: 'Layout saved locally.' });
  },

  loadLocal: () => {
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
  },

  toggleDebugMode: () => set((state) => ({ debugMode: !state.debugMode })),
  setCableRoutingMode: (mode) => set({ cableRoutingMode: mode })
}));

// Track layout changes for undo/redo
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
});
