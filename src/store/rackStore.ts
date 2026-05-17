import { create } from 'zustand';
import { deviceCatalog } from '../data/deviceCatalog';
import { sampleLayouts } from '../data/sampleLayouts';
import type { CableRoute, DeviceTemplate, PlacedDevice, RackDebtItem, RackLayout, RackPolicy, RackReservation, RackType, ViewMode, ViewSide, Workspace, InterRackCable, PortRef } from '../types/rack';
import type { PairingSource, PairingStage, PortHit3D } from '../types/pairing';
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
import { deviceOverlapsReservations, normalizeReservation } from '../utils/reservations';
import { getPortFaceMap, buildPortLayout } from '../utils/portLayout';

const STORAGE_KEY = 'homelab-rack-simulator-workspace';
const LEGACY_STORAGE_KEY = 'homelab-rack-simulator-layout';

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
    mountEnvelopeMm: template.mountEnvelopeMm,
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
    reservations: [],
    procurementItems: [],
    readinessChecks: [],
    commissioningChecks: [],
    changeEvents: [],
    debtItems: [],
    updatedAt: new Date().toISOString()
  };
}

export function createDefaultWorkspace(): Workspace {
  return {
    id: `workspace-${Date.now()}`,
    name: 'My Lab',
    racks: [createBlankLayout()],
    interRackCables: [],
    updatedAt: new Date().toISOString(),
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
  return { ...withCableNodes(layout, changedDeviceIds), updatedAt: new Date().toISOString() };
}

function normalizeLayout(layout: RackLayout): RackLayout {
  const visibleLayout = withoutHiddenZeroUPdu(layout);
  const base = {
    ...createBlankLayout(visibleLayout.rackType, visibleLayout.heightU),
    ...visibleLayout,
    cables: visibleLayout.cables ?? [],
    reservations: visibleLayout.reservations ?? [],
    procurementItems: visibleLayout.procurementItems ?? [],
    readinessChecks: visibleLayout.readinessChecks ?? [],
    commissioningChecks: visibleLayout.commissioningChecks ?? [],
    changeEvents: visibleLayout.changeEvents ?? [],
    policies: visibleLayout.policies ?? [],
    debtItems: visibleLayout.debtItems ?? [],
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
    }),
    reservations: (visibleLayout.reservations ?? []).map((reservation) => normalizeReservation(base, reservation))
  };
  return withCableNodes(normalized);
}

export function normalizeWorkspace(workspace: Workspace): Workspace {
  return {
    ...workspace,
    racks: (workspace.racks ?? []).map((rack) => normalizeLayout(rack)),
    interRackCables: (workspace.interRackCables ?? []).map((cable) => ({
      ...cable,
      type: cable.type ?? 'cat6a',
      lengthM: cable.lengthM ?? undefined,
      label: cable.label ?? undefined,
      color: cable.color ?? undefined,
      notes: cable.notes ?? undefined,
    })),
    updatedAt: workspace.updatedAt ?? new Date().toISOString(),
  };
}

function removeCablesForDevice(layout: RackLayout, deviceId: string) {
  return layout.cables.filter((cable) => cable.fromDeviceId !== deviceId && cable.toDeviceId !== deviceId);
}

function syncWorkspace(state: RackState): Workspace {
  let changed = false;
  const racks = state.workspace.racks.map((r) => {
    if (r.id === state.currentRackId && r !== state.layout) {
      changed = true;
      return state.layout;
    }
    return r;
  });
  if (!changed) {
    return state.workspace;
  }
  return {
    ...state.workspace,
    racks,
    updatedAt: new Date().toISOString(),
  };
}

interface RackState {
  workspace: Workspace;
  currentRackId: string;
  layout: RackLayout;
  selectedDeviceId: string | null;
  selectedCableId: string | null;
  selectedInterRackCableId: string | null;
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
  selectInterRackCable: (cableId: string | null) => void;
  addCable: (route: Omit<CableRoute, 'id'>) => void;
  updateCable: (cableId: string, patch: Partial<CableRoute>) => void;
  removeCable: (cableId: string) => void;
  addReservation: (reservation: Omit<RackReservation, 'id'>) => void;
  updateReservation: (reservationId: string, patch: Partial<RackReservation>) => void;
  removeReservation: (reservationId: string) => void;
  updateRack: (patch: Partial<RackLayout>) => void;
  addPolicy: (policy: Omit<RackPolicy, 'id'>) => void;
  updatePolicy: (policyId: string, patch: Partial<RackPolicy>) => void;
  removePolicy: (policyId: string) => void;
  addDebtItem: (item: Omit<RackDebtItem, 'id' | 'createdAt'>) => void;
  updateDebtItem: (itemId: string, patch: Partial<RackDebtItem>) => void;
  removeDebtItem: (itemId: string) => void;
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
  previewCable: CableRoute | null;
  setPreviewCable: (cable: CableRoute | null) => void;
  // ── Pairing state (shared between CablePlanner 2D and CableViewer3D 3D raycast) ──
  pairingStage: PairingStage;
  pairingSource: PairingSource | null;
  setPairingStage: (stage: PairingStage) => void;
  setPairingSource: (source: PairingSource | null) => void;
  onPortPick3D: ((hit: PortHit3D) => void) | null;
  registerPortPick3D: (handler: ((hit: PortHit3D) => void) | null) => void;
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
  saveWorkspace: () => void;
  loadWorkspace: () => boolean;
  setWorkspace: (workspace: Workspace) => boolean;
}

const MAX_HISTORY = 50;
const initialLayout = normalizeLayout(sampleLayouts[1]);

const initialWorkspace: Workspace = {
  id: `workspace-${Date.now()}`,
  name: 'My Lab',
  racks: [initialLayout],
  interRackCables: [],
  updatedAt: new Date().toISOString(),
};

function validateInterRackCablePort(
  device: PlacedDevice,
  portRef: PortRef
): { valid: boolean; error?: string } {
  const count = device.ports?.[portRef.type];
  if (typeof count !== 'number' || count <= 0) {
    return { valid: false, error: `Device "${device.name}" has no ${portRef.type} ports.` };
  }
  if (portRef.index < 0 || portRef.index >= count) {
    return { valid: false, error: `Port index ${portRef.index} out of range for ${device.name} ${portRef.type} ports (0–${count - 1}).` };
  }
  const faceMap = getPortFaceMap(device.category, device.portFaceOverrides);
  const face = portRef.side ?? faceMap[portRef.type] ?? 'rear';
  const widthMm = getDeviceWidthMm(device);
  const heightMm = device.sizeU * 44.45;
  const layout = buildPortLayout(device, widthMm, heightMm, face);
  const found = layout.some((group) =>
    group.slots.some((slot) => slot.type === portRef.type && slot.index === portRef.index)
  );
  if (!found) {
    return { valid: false, error: `Device "${device.name}" does not have ${portRef.type} port at index ${portRef.index} on ${face} face.` };
  }
  return { valid: true };
}

export const useRackStore = create<RackState>((set, get) => ({
  workspace: initialWorkspace,
  currentRackId: initialLayout.id,
  layout: initialLayout,
  selectedDeviceId: initialLayout.devices[0]?.id ?? null,
  selectedCableId: null,
  selectedInterRackCableId: null,
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
    const reservation = deviceOverlapsReservations(layout, device);
    if (reservation) {
      set({ statusMessage: `${template.name} overlaps reserved space "${reservation.name}".` });
      return false;
    }
    if (!isDeviceWithinRack(layout, device)) {
      set({ statusMessage: `${template.name} does not fit inside this rack height.` });
      return false;
    }
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
    const reservation = deviceOverlapsReservations(layout, nextDevice);
    if (reservation) {
      set({ statusMessage: `${device.name} cannot move there; "${reservation.name}" is reserved.` });
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
    if (!isDeviceWithinRack(layout, candidate)) {
      set({ statusMessage: `${candidate.name} does not fit inside the rack.` });
      return false;
    }
    if (hasOverlap(layout, layout.devices, candidate)) {
      set({ statusMessage: `${candidate.name} would overlap another component.` });
      return false;
    }
    const reservation = deviceOverlapsReservations(layout, candidate);
    if (reservation) {
      set({ statusMessage: `${candidate.name} would overlap reserved space "${reservation.name}".` });
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
        new Set()
      ),
      selectedDeviceId: get().selectedDeviceId === deviceId ? null : get().selectedDeviceId,
      selectedCableId: null,
      statusMessage: 'Component removed.'
    });
  },

  selectDevice: (deviceId) => set({ selectedDeviceId: deviceId, selectedCableId: null }),
  selectCable: (cableId) => set({ selectedCableId: cableId, selectedDeviceId: null }),
  selectInterRackCable: (cableId) => set({ selectedInterRackCableId: cableId }),

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

  updateCable: (cableId, patch) => {
    const layout = get().layout;
    const current = layout.cables.find((cable) => cable.id === cableId);
    if (!current) return;
    const nextCable = { ...current, ...patch, id: cableId };
    const changedIds = new Set([nextCable.fromDeviceId, nextCable.toDeviceId]);
    set({
      layout: touch({
        ...layout,
        cables: layout.cables.map((cable) => (cable.id === cableId ? nextCable : cable)),
      }, changedIds),
      selectedCableId: cableId,
      statusMessage: 'Cable route updated.'
    });
  },

  removeCable: (cableId) => {
    const layout = get().layout;
    const next = { ...layout, cables: layout.cables.filter((cable) => cable.id !== cableId) };
    const updated = { ...next, updatedAt: new Date().toISOString() };
    set({
      layout: updated,
      selectedCableId: null,
      statusMessage: 'Cable route removed.'
    });
  },

  addReservation: (reservation) => {
    const layout = get().layout;
    const nextReservation = normalizeReservation(layout, {
      ...reservation,
      id: newId('res')
    });
    set({
      layout: touch({ ...layout, reservations: [...(layout.reservations ?? []), nextReservation] }),
      selectedDeviceId: null,
      selectedCableId: null,
      statusMessage: `${nextReservation.name} reserved at U${nextReservation.positionU}.`
    });
  },

  updateReservation: (reservationId, patch) => {
    const layout = get().layout;
    const reservations = layout.reservations ?? [];
    const current = reservations.find((reservation) => reservation.id === reservationId);
    if (!current) return;
    const nextReservation = normalizeReservation(layout, { ...current, ...patch, id: reservationId });
    set({
      layout: touch({
        ...layout,
        reservations: reservations.map((reservation) => (reservation.id === reservationId ? nextReservation : reservation))
      }),
      statusMessage: null
    });
  },

  removeReservation: (reservationId) => {
    const layout = get().layout;
    set({
      layout: touch({
        ...layout,
        reservations: (layout.reservations ?? []).filter((reservation) => reservation.id !== reservationId)
      }),
      statusMessage: 'Reservation removed.'
    });
  },

  addPolicy: (policy) => {
    const layout = get().layout;
    const newPolicy: RackPolicy = { ...(policy as RackPolicy), id: `policy-${Date.now()}` };
    set({
      layout: {
        ...layout,
        policies: [...(layout.policies ?? []), newPolicy],
        updatedAt: new Date().toISOString(),
      },
      statusMessage: 'Policy added.',
    });
  },

  updatePolicy: (policyId, patch) => {
    const layout = get().layout;
    set({
      layout: {
        ...layout,
        policies: (layout.policies ?? []).map((p) => (p.id === policyId ? { ...p, ...patch } : p)),
        updatedAt: new Date().toISOString(),
      },
      statusMessage: null,
    });
  },

  removePolicy: (policyId) => {
    const layout = get().layout;
    set({
      layout: {
        ...layout,
        policies: (layout.policies ?? []).filter((p) => p.id !== policyId),
        updatedAt: new Date().toISOString(),
      },
      statusMessage: 'Policy removed.',
    });
  },

  addDebtItem: (item) => {
    const layout = get().layout;
    const newItem: RackDebtItem = {
      ...(item as RackDebtItem),
      id: `debt-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    set({
      layout: {
        ...layout,
        debtItems: [...(layout.debtItems ?? []), newItem],
        updatedAt: new Date().toISOString(),
      },
      statusMessage: 'Debt item added.',
    });
  },

  updateDebtItem: (itemId, patch) => {
    const layout = get().layout;
    const resolvedAt = patch.status === 'fixed' || patch.status === 'accepted' || patch.status === 'ignored'
      ? new Date().toISOString()
      : undefined;
    set({
      layout: {
        ...layout,
        debtItems: (layout.debtItems ?? []).map((item) =>
          item.id === itemId
            ? { ...item, ...patch, ...(resolvedAt ? { resolvedAt } : {}) }
            : item
        ),
        updatedAt: new Date().toISOString(),
      },
      statusMessage: null,
    });
  },

  removeDebtItem: (itemId) => {
    const layout = get().layout;
    set({
      layout: {
        ...layout,
        debtItems: (layout.debtItems ?? []).filter((item) => item.id !== itemId),
        updatedAt: new Date().toISOString(),
      },
      statusMessage: 'Debt item removed.',
    });
  },

  updateRack: (patch) => {
    const layout = get().layout;
    const geometricKeys = new Set(['rackDepthMm', 'rearClearanceMm', 'frontDoorClearanceMm', 'rearDoorClearanceMm', 'railMinDepthMm', 'railMaxDepthMm', 'devices', 'cables', 'reservations', 'rackType', 'heightU', 'viewSide']);
    const needsRecompute = Object.keys(patch).some((key) => geometricKeys.has(key));
    const next = { ...layout, ...patch };
    if (needsRecompute) {
      set({ layout: touch(next), statusMessage: null });
    } else {
      const updated = { ...next, updatedAt: new Date().toISOString() };
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
    const reservations = (layout.reservations ?? []).filter((reservation) => reservation.positionU + reservation.sizeU - 1 <= heightU);
    const removed = layout.devices.length - devices.length;
    const removedReservations = (layout.reservations ?? []).length - reservations.length;
    set({
      layout: touch({
        ...layout,
        heightU,
        devices,
        reservations,
        cables: layout.cables.filter(
          (cable) =>
            devices.some((device) => device.id === cable.fromDeviceId) &&
            devices.some((device) => device.id === cable.toDeviceId)
        ),
        weightLimitKg: defaultWeightLimit(layout.rackType, heightU)
      }),
      selectedDeviceId: devices.some((device) => device.id === get().selectedDeviceId) ? get().selectedDeviceId : null,
      selectedCableId: null,
      statusMessage:
        removed || removedReservations
          ? `${removed} component(s) and ${removedReservations} reservation(s) removed because they no longer fit.`
          : null
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
    const state = get();
    const workspace = syncWorkspace(state);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
      set({ workspace, statusMessage: 'Workspace saved locally.' });
    } catch {
      set({ statusMessage: 'Failed to save workspace.' });
    }
  },

  loadLocal: () => {
    const rawWorkspace = localStorage.getItem(STORAGE_KEY);
    if (rawWorkspace) {
      try {
        return get().loadWorkspace();
      } catch {
        // fall through to legacy
      }
    }
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      set({ statusMessage: 'No saved local layout found.' });
      return false;
    }
    try {
      const legacyLayout = normalizeLayout(JSON.parse(raw));
      const workspace = createDefaultWorkspace();
      workspace.racks = [legacyLayout];
      workspace.name = 'My Lab';
      const layout = legacyLayout;
      set({
        workspace,
        currentRackId: layout.id,
        layout,
        selectedDeviceId: layout.devices[0]?.id ?? null,
        selectedCableId: null,
        statusMessage: 'Legacy layout migrated to workspace.',
        ...historyFor(layout),
        skipNextHistory: true,
      });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
      } catch {}
      return true;
    } catch {
      set({ statusMessage: 'Saved layout could not be read.' });
      return false;
    }
  },

  toggleDebugMode: () => set((state) => ({ debugMode: !state.debugMode })),
  setCableRoutingMode: (mode) => set({ cableRoutingMode: mode }),
  previewCable: null,
  setPreviewCable: (cable) => set({ previewCable: cable }),
  // ── Pairing state ──
  pairingStage: 'idle',
  pairingSource: null,
  setPairingStage: (stage) => set({ pairingStage: stage }),
  setPairingSource: (source) => set({ pairingSource: source }),
  onPortPick3D: null,
  registerPortPick3D: (handler) => set({ onPortPick3D: handler }),

  // ── Workspace actions ──
  createRack: (name, rackType = '19in', heightU = 12) => {
    const { workspace, layout, currentRackId } = get();
    const syncedRacks = workspace.racks.map((r) => (r.id === currentRackId ? layout : r));
    const newLayout = { ...createBlankLayout(rackType, heightU), id: `rack-${Date.now()}`, name };
    const updatedWorkspace = { ...workspace, racks: [...syncedRacks, newLayout] };
    set({
      workspace: updatedWorkspace,
      currentRackId: newLayout.id,
      layout: newLayout,
      history: [],
      historyIndex: -1,
      selectedDeviceId: null,
      selectedCableId: null,
      statusMessage: `Rack "${name}" created.`,
      skipNextHistory: true,
    });
  },

  deleteRack: (rackId) => {
    const { workspace, layout, currentRackId } = get();
    const syncedRacks = workspace.racks.map((r) => (r.id === currentRackId ? layout : r));
    const remainingRacks = syncedRacks.filter((r) => r.id !== rackId);
    if (remainingRacks.length === 0) {
      const defaultRack = createBlankLayout();
      const updatedWorkspace = { ...workspace, racks: [defaultRack] };
      set({
        workspace: updatedWorkspace,
        currentRackId: defaultRack.id,
        layout: defaultRack,
        history: [],
        historyIndex: -1,
        selectedDeviceId: null,
        selectedCableId: null,
        statusMessage: 'Last rack deleted. Created default rack.',
        skipNextHistory: true,
      });
    } else {
      const isCurrent = rackId === currentRackId;
      const nextCurrentId = isCurrent ? remainingRacks[0].id : currentRackId;
      const nextLayout = remainingRacks.find((r) => r.id === nextCurrentId)!;
      set({
        workspace: { ...workspace, racks: remainingRacks },
        currentRackId: nextCurrentId,
        layout: nextLayout,
        history: isCurrent ? [] : get().history,
        historyIndex: isCurrent ? -1 : get().historyIndex,
        selectedDeviceId: null,
        selectedCableId: null,
        statusMessage: 'Rack deleted.',
        skipNextHistory: true,
      });
    }
  },

  duplicateRack: (rackId, newName) => {
    const { workspace, layout, currentRackId } = get();
    const syncedRacks = workspace.racks.map((r) => (r.id === currentRackId ? layout : r));
    const sourceRack = syncedRacks.find((r) => r.id === rackId);
    if (!sourceRack) return;
    const idMap = new Map<string, string>();
    const clonedDevices = (sourceRack.devices ?? []).map((device) => {
      const newDeviceId = newId('dev');
      idMap.set(device.id, newDeviceId);
      return { ...device, id: newDeviceId };
    });
    const clonedCables = (sourceRack.cables ?? []).map((cable) => ({
      ...cable,
      id: newId('cable'),
      fromDeviceId: idMap.get(cable.fromDeviceId) ?? cable.fromDeviceId,
      toDeviceId: idMap.get(cable.toDeviceId) ?? cable.toDeviceId,
    }));
    const newRack: RackLayout = {
      ...sourceRack,
      id: `rack-${Date.now()}`,
      name: newName,
      devices: clonedDevices,
      cables: clonedCables,
      updatedAt: new Date().toISOString(),
    };
    const updatedWorkspace = { ...workspace, racks: [...syncedRacks, newRack] };
    set({
      workspace: updatedWorkspace,
      currentRackId: newRack.id,
      layout: newRack,
      history: [],
      historyIndex: -1,
      selectedDeviceId: null,
      selectedCableId: null,
      statusMessage: `Rack "${newName}" duplicated.`,
      skipNextHistory: true,
    });
  },

  switchRack: (rackId) => {
    const { workspace, layout, currentRackId } = get();
    const updatedRacks = workspace.racks.map((r) => (r.id === currentRackId ? layout : r));
    const newWorkspace = { ...workspace, racks: updatedRacks };
    const newLayout = updatedRacks.find((r) => r.id === rackId);
    if (!newLayout) return;
    set({
      workspace: newWorkspace,
      currentRackId: rackId,
      layout: newLayout,
      history: [],
      historyIndex: -1,
      selectedDeviceId: null,
      selectedCableId: null,
    });
  },

  renameRack: (rackId, name) => {
    const { workspace, layout } = get();
    const updatedRacks = workspace.racks.map((r) => (r.id === rackId ? { ...r, name } : r));
    const updatedWorkspace = { ...workspace, racks: updatedRacks };
    const updatedLayout = layout.id === rackId ? { ...layout, name } : layout;
    set({
      workspace: updatedWorkspace,
      layout: updatedLayout,
      statusMessage: 'Rack renamed.',
    });
  },

  renameWorkspace: (name) => {
    set({ workspace: { ...get().workspace, name }, statusMessage: 'Workspace renamed.' });
  },

  addInterRackCable: (cable) => {
    const { workspace } = get();
    const fromRack = workspace.racks.find((r) => r.id === cable.fromRackId);
    const toRack = workspace.racks.find((r) => r.id === cable.toRackId);
    if (!fromRack) {
      set({ statusMessage: `Source rack not found.` });
      return;
    }
    if (!toRack) {
      set({ statusMessage: `Target rack not found.` });
      return;
    }
    const fromDevice = fromRack.devices.find((d) => d.id === cable.fromDeviceId);
    const toDevice = toRack.devices.find((d) => d.id === cable.toDeviceId);
    if (!fromDevice) {
      set({ statusMessage: `Source device not found in rack "${fromRack.name}".` });
      return;
    }
    if (!toDevice) {
      set({ statusMessage: `Target device not found in rack "${toRack.name}".` });
      return;
    }
    const fromValidation = validateInterRackCablePort(fromDevice, cable.fromPort);
    if (!fromValidation.valid) {
      set({ statusMessage: fromValidation.error! });
      return;
    }
    const toValidation = validateInterRackCablePort(toDevice, cable.toPort);
    if (!toValidation.valid) {
      set({ statusMessage: toValidation.error! });
      return;
    }
    const newCable: InterRackCable = { ...cable, id: newId('irc') };
    set({
      workspace: { ...workspace, interRackCables: [...workspace.interRackCables, newCable] },
      statusMessage: 'Inter-rack cable added.',
    });
  },

  removeInterRackCable: (cableId) => {
    const { workspace } = get();
    set({
      workspace: { ...workspace, interRackCables: workspace.interRackCables.filter((c) => c.id !== cableId) },
      statusMessage: 'Inter-rack cable removed.',
    });
  },

  updateInterRackCable: (cableId, patch) => {
    const { workspace } = get();
    const current = workspace.interRackCables.find((c) => c.id === cableId);
    if (!current) return;
    const nextCable = { ...current, ...patch };
    const fromRack = workspace.racks.find((r) => r.id === nextCable.fromRackId);
    const toRack = workspace.racks.find((r) => r.id === nextCable.toRackId);
    if (!fromRack) {
      set({ statusMessage: `Source rack not found.` });
      return;
    }
    if (!toRack) {
      set({ statusMessage: `Target rack not found.` });
      return;
    }
    const fromDevice = fromRack.devices.find((d) => d.id === nextCable.fromDeviceId);
    const toDevice = toRack.devices.find((d) => d.id === nextCable.toDeviceId);
    if (!fromDevice) {
      set({ statusMessage: `Source device not found in rack "${fromRack.name}".` });
      return;
    }
    if (!toDevice) {
      set({ statusMessage: `Target device not found in rack "${toRack.name}".` });
      return;
    }
    const fromValidation = validateInterRackCablePort(fromDevice, nextCable.fromPort);
    if (!fromValidation.valid) {
      set({ statusMessage: fromValidation.error! });
      return;
    }
    const toValidation = validateInterRackCablePort(toDevice, nextCable.toPort);
    if (!toValidation.valid) {
      set({ statusMessage: toValidation.error! });
      return;
    }
    set({
      workspace: {
        ...workspace,
        interRackCables: workspace.interRackCables.map((c) => (c.id === cableId ? nextCable : c)),
      },
      statusMessage: 'Inter-rack cable updated.',
    });
  },

  saveWorkspace: () => {
    const state = get();
    const workspace = syncWorkspace(state);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
      set({ workspace, statusMessage: 'Workspace saved locally.' });
    } catch {
      set({ statusMessage: 'Failed to save workspace.' });
    }
  },

  loadWorkspace: () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      const workspace = normalizeWorkspace(parsed);
      const currentRackId = workspace.racks[0]?.id;
      if (!currentRackId) return false;
      const layout = workspace.racks.find((r) => r.id === currentRackId) ?? workspace.racks[0];
      set({
        workspace,
        currentRackId,
        layout,
        selectedDeviceId: layout.devices[0]?.id ?? null,
        selectedCableId: null,
        statusMessage: 'Workspace loaded.',
        ...historyFor(layout),
        skipNextHistory: true,
      });
      return true;
    } catch {
      set({ statusMessage: 'Saved workspace could not be read.' });
      return false;
    }
  },

  setWorkspace: (workspace) => {
    const normalized = normalizeWorkspace(workspace);
    const currentRackId = normalized.racks[0]?.id;
    if (!currentRackId) return false;
    const layout = normalized.racks.find((r) => r.id === currentRackId) ?? normalized.racks[0];
    set({
      workspace: normalized,
      currentRackId,
      layout,
      selectedDeviceId: layout.devices[0]?.id ?? null,
      selectedCableId: null,
      statusMessage: `${normalized.name} loaded.`,
      ...historyFor(layout),
      skipNextHistory: true,
    });
    return true;
  },
}));

// Track layout changes for undo/redo and sync workspace
useRackStore.subscribe((state, prevState) => {
  try {
    const updates: Partial<RackState> = {};
    if (!state.skipNextHistory && state.layout !== prevState.layout) {
      const history = state.history.slice(0, state.historyIndex + 1);
      history.push(cloneLayout(state.layout));
      const trimmedHistory = history.length > MAX_HISTORY ? history.slice(1) : history;
      const historyIndex = trimmedHistory.length - 1;
      updates.history = trimmedHistory;
      updates.historyIndex = historyIndex;
    }
    if (state.skipNextHistory) {
      updates.skipNextHistory = false;
    }
    const syncedWorkspace = syncWorkspace({ ...state, ...updates });
    if (syncedWorkspace !== state.workspace) {
      updates.workspace = syncedWorkspace;
    }
    if (Object.keys(updates).length > 0) {
      useRackStore.setState(updates);
    }
    if (state.layout !== prevState.layout || state.workspace !== prevState.workspace || state.currentRackId !== prevState.currentRackId) {
      const workspaceToSave = updates.workspace ?? state.workspace;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaceToSave));
      } catch {
        // Ignore storage quota errors
      }
    }
  } catch (error) {
    console.error('[rackStore] Failed to record history', error);
  }
});

// Initialize: try workspace first, fallback to legacy layout migration
if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
  if (!useRackStore.getState().loadWorkspace()) {
    useRackStore.getState().loadLocal();
  }
}
