import type { ChainPlan } from '../utils/patchChain';
import { installationRoleError } from '../utils/cableInstallation';
import { validateABPlan, abFingerprint, toABPlan, type ABPlan } from '../utils/abCablePlanner';
import { tidyPanelCables } from '../utils/panelCableTidy';
import { placedDeviceFromTemplate } from '../utils/placedDeviceFromTemplate';
import { invalidateChangedPowerReviews } from '../utils/powerReview';
import { checkConnectorCompatibility } from '../utils/connectorCompatibility';
import { getPowerReference } from '../utils/powerAssumptions';
import { create } from 'zustand';
import { getTemplateById } from '../data/deviceTemplateRegistry';
import { beginnerSample, getSampleDefinition } from '../data/sampleLayouts';
import type { CableRoute, DeviceTemplate, PlacedDevice, RackDebtItem, RackLayout, RackPolicy, RackReservation, RackType, ViewMode, ViewSide, Workspace, InterRackCable } from '../types/rack';
import type { PairingSource, PairingStage, PortHit3D } from '../types/pairing';
import { shouldHideDevice } from '../utils/featureFlags';
import { findAvailableDeviceSlot, getPlacementFeedback } from '../utils/devicePlacement';
import { calculateCableNodes } from '../utils/routing';
import {
  clampDeviceX,
  clampDevicePosition,
  defaultWeightLimit,
  getDefaultDeviceX,
  getDeviceMountSide,
  getDeviceWidthMm,
  hasOverlap,
  isDeviceWithinRack,
  isZeroU,
  zeroUHeightMm,
  U_HEIGHT_MM,
  RACK_SPECS
} from '../utils/rackMath';
import { deviceOverlapsReservations, normalizeReservation } from '../utils/reservations';
import { pruneInvalidInterRackCables, routeUsesInterRackPort, validateInterRackCable } from '../utils/interRackCables';

import { validateImportedLayout } from '../utils/layoutValidation';
import type { FindingIdentity } from '../utils/findingExceptions';
import { normalizePlanningGoals } from '../utils/planningGoals';

let lastABApplication: { plan: ABPlan; fingerprint: string } | null = null;

const MAX_SAVED_JSON_LENGTH = 10 * 1024 * 1024;
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
  return placedDeviceFromTemplate(template, newId('dev'), positionU, xMm, mountSide);
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
      if (layout.devices.some(d => shouldHideDevice(d) && (d.id === cable.fromDeviceId || d.id === cable.toDeviceId))) return cable;
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
  const validation = validateImportedLayout(layout);
  if (!validation.valid) throw new Error(`Invalid layout: ${validation.errors.join('; ')}`);
  const visibleLayout = layout;
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
    // Missing legacy goals remain absent; reading them supplies neutral defaults.
    ...(visibleLayout.planningGoals ? { planningGoals: { ...visibleLayout.planningGoals, ...normalizePlanningGoals(visibleLayout.planningGoals) } } : {}),
    updatedAt: layout.updatedAt ?? new Date().toISOString()
  };
  const normalized = {
    ...base,
    devices: (visibleLayout.devices ?? []).map((device) => {
      // Preserve legacy 0U records verbatim; geometry supplies read-only defaults.
      if (isZeroU(device)) return device;
      return { ...device, mountSide: getDeviceMountSide(device), xMm: device.xMm ?? getDefaultDeviceX(base, device) };
    }),
    reservations: visibleLayout.reservations ?? []
  };
  return normalized;
}

export function normalizeWorkspace(workspace: Workspace): Workspace {
  if (!workspace || typeof workspace.id !== 'string' || typeof workspace.name !== 'string' ||
      !Array.isArray(workspace.racks) || workspace.racks.length === 0 ||
      (workspace.interRackCables !== undefined && !Array.isArray(workspace.interRackCables))) throw new Error('Invalid workspace');
  return pruneInvalidInterRackCables({
    ...workspace,
    racks: (workspace.racks ?? []).map((rack, index) => {
      try { return normalizeLayout(rack); }
      catch (error) { throw new Error(`racks[${index}]: ${error instanceof Error ? error.message : 'Invalid rack'}`); }
    }),
    interRackCables: (workspace.interRackCables ?? []).map((cable) => ({
      ...cable,
      type: cable.type ?? 'cat6a',
      lengthM: cable.lengthM ?? undefined,
      label: cable.label ?? undefined,
      color: cable.color ?? undefined,
      notes: cable.notes ?? undefined,
    })),
    updatedAt: workspace.updatedAt ?? new Date().toISOString(),
  });
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
  persistenceError: string | null;
  recoverySource: string | null;
  persistenceBlocked: boolean;
  pendingRackResize: { layout: RackLayout; patch: Partial<RackLayout> & { heightU: number } } | null;
  resolveRackResize: (resolution: 'cancel' | 'retain') => void;
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
  addDeviceToInventory: (templateId: string) => void;
  placeInventoryDevice: (deviceId: string, positionU?: number, xMm?: number) => boolean;
  moveDeviceToInventory: (deviceId: string) => boolean;
  removeInventoryDevice: (deviceId: string) => void;
  moveDevice: (deviceId: string, positionU: number, xMm?: number) => boolean;
  updateDevice: (deviceId: string, patch: Partial<PlacedDevice>) => boolean;
  removeDevice: (deviceId: string) => void;
  selectDevice: (deviceId: string | null) => void;
  selectCable: (cableId: string | null) => void;
  selectInterRackCable: (cableId: string | null) => void;
  addCable: (route: Omit<CableRoute, 'id'>) => void;
  applyPatchChain: (plan: ChainPlan) => boolean;
  applyABPlan: (plan: ABPlan) => boolean;
  tidyPatchPanel: (panelId: string) => void;
  addCables: (routes: Omit<CableRoute, 'id'>[]) => void;
  updateCable: (cableId: string, patch: Partial<CableRoute>) => void;
  removeCable: (cableId: string) => void;
  addReservation: (reservation: Omit<RackReservation, 'id'>) => void;
  updateReservation: (reservationId: string, patch: Partial<RackReservation>) => void;
  removeReservation: (reservationId: string) => void;
  updateRack: (patch: Partial<RackLayout>) => void;
  acceptFindingException: (identity: FindingIdentity, reason: string) => boolean;
  removeFindingException: (exceptionId: string) => void;
  reopenFindingException: (exceptionId: string) => void;
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
  addInterRackCable: (cable: Omit<InterRackCable, 'id'>) => boolean;
  removeInterRackCable: (cableId: string) => void;
  updateInterRackCable: (cableId: string, patch: Partial<InterRackCable>) => void;
  saveWorkspace: () => void;
  loadWorkspace: () => boolean;
  setWorkspace: (workspace: Workspace) => boolean;
}

const MAX_HISTORY = 50;
// This is only a fresh-browser fallback. Saved workspaces and legacy layouts
// are restored below before consumers can use the store, without saving this
// example over existing or unreadable data.
const initialLayout = normalizeLayout(cloneLayout(beginnerSample));

const initialWorkspace: Workspace = {
  id: `workspace-${Date.now()}`,
  name: 'My Lab',
  racks: [initialLayout],
  interRackCables: [],
  updatedAt: new Date().toISOString(),
};

export const useRackStore = create<RackState>((set, get) => ({
  persistenceError: null,
  recoverySource: null,
  persistenceBlocked: false,
  pendingRackResize: null,
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
    const template = getTemplateById(templateId);
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
    const mountSide = template.defaultU === 0 ? 'rear' : layout.viewSide;
    let draftDevice = templateToDevice(template, requestedPositionU ?? 1, requestedXMm, mountSide);
    const dimensions = getPlacementFeedback({ ...layout, devices: [], reservations: [] }, { ...draftDevice, positionU: 1 });
    if (!dimensions.allowed) { set({ statusMessage: dimensions.problem!.message }); return false; }
    if (isZeroU(draftDevice) && requestedPositionU === undefined && !findAvailableDeviceSlot(layout, draftDevice)) {
      draftDevice = { ...draftDevice, mountSide0U: draftDevice.mountSide0U === 'right' ? 'left' : 'right' };
    }
    const slot =
      requestedPositionU !== undefined
        ? {
            positionU: clampDevicePosition(layout, isZeroU(draftDevice) ? zeroUHeightMm(layout, draftDevice) / U_HEIGHT_MM : template.defaultU, requestedPositionU),
            xMm: clampDeviceX(
              layout,
              draftDevice,
              requestedXMm ?? getDefaultDeviceX(layout, draftDevice)
            )
          }
        : findAvailableDeviceSlot(layout, draftDevice);
    if (slot === null) {
      set({ statusMessage: isZeroU(draftDevice) ? 'No free 0U mounting lane. Move an existing PDU or choose a shorter model.' : `No free ${template.defaultU}U space for ${template.name}.` });
      return false;
    }
    const device = { ...draftDevice, ...slot };
    const feedback = getPlacementFeedback(layout, device);
    if (!feedback.allowed) { set({ statusMessage: feedback.problem!.message }); return false; }
    set({
      layout: touch({ ...layout, devices: [...layout.devices, device] }),
      selectedDeviceId: device.id,
      selectedCableId: null,
      statusMessage: isZeroU(device) ? `${template.name} added to the ${device.mountSide0U} rear mounting lane (0U).` : `${template.name} added to ${mountSide} side at U${slot.positionU}.`
    });
    return true;
  },

  addDeviceToInventory: (templateId) => {
    const template = getTemplateById(templateId);
    if (!template || shouldHideDevice(template)) return;
    const layout = get().layout;
    const device = templateToDevice(template, 1, undefined, layout.viewSide);
    set({
      layout: touch(
        {
          ...layout,
          unplacedDevices: [...(layout.unplacedDevices ?? []), device],
        },
        device.category === 'shelf' ? undefined : new Set(),
      ),
      statusMessage: `${device.name} saved to My devices.`,
    });
  },
  placeInventoryDevice: (deviceId, requestedPositionU, requestedXMm) => {
    const layout = get().layout;
    const stored = layout.unplacedDevices?.find((d) => d.id === deviceId);
    if (!stored || shouldHideDevice(stored)) return false;
    if (stored.rackMountable === false) {
      set({
        statusMessage:
          'This device is external and cannot be placed in the rack.',
      });
      return false;
    }
    let draft = { ...stored, mountSide: isZeroU(stored) ? 'rear' as const : layout.viewSide };
    if (isZeroU(draft) && requestedPositionU === undefined && !findAvailableDeviceSlot(layout, draft)) {
      draft = { ...draft, spatialZone: undefined, mountSide0U: draft.mountSide0U === 'right' ? 'left' : 'right' };
    }
    const dimensions = getPlacementFeedback({ ...layout, devices: [], reservations: [] }, { ...draft, positionU: 1 });
    if (!dimensions.allowed) { set({ statusMessage: dimensions.problem!.message }); return false; }
    const slot =
      requestedPositionU === undefined
        ? findAvailableDeviceSlot(layout, draft)
        : {
            positionU: clampDevicePosition(
              layout,
              draft.sizeU,
              requestedPositionU,
            ),
            xMm: clampDeviceX(
              layout,
              draft,
              requestedXMm ?? getDefaultDeviceX(layout, draft),
            ),
          };
    if (!slot) {
      set({
        statusMessage: `No free ${draft.sizeU}U space for ${draft.name}.`,
      });
      return false;
    }
    const device = { ...draft, ...slot };
    const feedback = getPlacementFeedback(layout, device);
    if (!feedback.allowed) { set({ statusMessage: feedback.problem!.message }); return false; }
    set({
      layout: touch({
        ...layout,
        devices: [...layout.devices, device],
        unplacedDevices: layout.unplacedDevices?.filter(
          (d) => d.id !== deviceId,
        ),
      }),
      selectedDeviceId: deviceId,
      selectedCableId: null,
      statusMessage: `${device.name} placed at U${slot.positionU}.`,
    });
    return true;
  },
  moveDeviceToInventory: (deviceId) => {
    const { layout, workspace } = get();
    const device = layout.devices.find((d) => d.id === deviceId);
    if (!device || shouldHideDevice(device)) return false;
    const connected =
      layout.cables.some(
        (c) => c.fromDeviceId === deviceId || c.toDeviceId === deviceId,
      ) ||
      workspace.interRackCables.some(
        (c) => c.fromDeviceId === deviceId || c.toDeviceId === deviceId,
      );
    if (connected) {
      set({
        statusMessage:
          'Disconnect this device’s cables before moving it to My devices.',
      });
      return false;
    }
    set({
      layout: touch(
        {
          ...layout,
          devices: layout.devices.filter((d) => d.id !== deviceId),
          unplacedDevices: [...(layout.unplacedDevices ?? []), device],
        },
        new Set(),
      ),
      selectedDeviceId: null,
      statusMessage: `${device.name} moved to My devices.`,
    });
    return true;
  },
  removeInventoryDevice: (deviceId) => {
    const layout = get().layout;
    set({
      layout: touch(
        {
          ...layout,
          unplacedDevices: layout.unplacedDevices?.filter(
            (d) => d.id !== deviceId,
          ),
        },
        new Set(),
      ),
      statusMessage: 'Device removed from inventory. Undo to restore it.',
    });
  },

  moveDevice: (deviceId, positionU, xMm) => {
    const layout = get().layout;
    const device = layout.devices.find((item) => item.id === deviceId);
    if (!device || shouldHideDevice(device)) return false;
    const nextDevice = {
      ...device,
      positionU: clampDevicePosition(layout, isZeroU(device) ? zeroUHeightMm(layout, device) / U_HEIGHT_MM : device.sizeU, positionU),
      xMm: clampDeviceX(
        layout,
        device,
        xMm ??
          device.xMm ??
          (RACK_SPECS[layout.rackType].usableWidthMm - Math.min(getDeviceWidthMm(device), RACK_SPECS[layout.rackType].usableWidthMm)) / 2
      )
    };
    const feedback = getPlacementFeedback(layout, nextDevice);
    if (!feedback.allowed) { set({ statusMessage: feedback.problem!.message }); return false; }
    set({
      layout: touch(
        {
          ...layout,
          devices: layout.devices.map((item) => (item.id === deviceId ? nextDevice : item))
        },
        device.category === 'shelf' ? undefined : new Set([deviceId])
      ),
      selectedDeviceId: deviceId,
      statusMessage: null
    });
    return true;
  },

  updateDevice: (deviceId, patch) => {
    const layout = get().layout;
    const device = layout.devices.find((item) => item.id === deviceId);
    if (!device || shouldHideDevice(device)) return false;
    if (patch.powerW !== undefined && (!Number.isFinite(patch.powerW) || patch.powerW < 0)) return false;
    const powerChanged = (patch.powerW !== undefined && patch.powerW !== device.powerW) ||
      (patch.powerBasis !== undefined && patch.powerBasis !== device.powerBasis) ||
      ('powerPlanningNote' in patch && patch.powerPlanningNote !== device.powerPlanningNote);
    if (powerChanged) patch = {
      ...patch,
      powerReference: device.powerReference ?? getPowerReference(device),
      powerReviewed: false,
    };
    const sizeU = device.category === 'pdu-0u' ? 0 : Math.max(0, Math.min(layout.heightU, Number(patch.sizeU ?? device.sizeU)));
    const deviceWithPatch = { ...device, ...patch, sizeU };
    const shouldResetZeroUX = isZeroU(deviceWithPatch) && (patch.mountType !== undefined || patch.mountSide0U !== undefined) && patch.xMm === undefined;
    const candidate = {
      ...device,
      ...patch,
      spatialZone: patch.mountType !== undefined || patch.mountSide0U !== undefined ? undefined : deviceWithPatch.spatialZone,
      sizeU,
      positionU: sizeU === 0 ? Number(patch.positionU ?? device.positionU) : clampDevicePosition(layout, sizeU, Number(patch.positionU ?? device.positionU)),
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
        device.category === 'shelf' || candidate.category === 'shelf' ? undefined : new Set([deviceId])
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
        layout.devices.find(device => device.id === deviceId)?.category === 'shelf' ? undefined : new Set()
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
    if (layout.devices.some(d => shouldHideDevice(d) && (d.id === route.fromDeviceId || d.id === route.toDeviceId))) {
      set({ statusMessage: '0U physical planning is disabled. Existing data is preserved for JSON export.' });
      return;
    }
    if (route.fromDeviceId === route.toDeviceId) {
      set({ statusMessage: 'Cable route needs two different devices.' });
      return;
    }
    if (routeUsesInterRackPort(get().workspace, layout.id, route)) {
      set({ statusMessage: 'Endpoint port is already used by an inter-rack cable.' });
      return;
    }
    const roleError = installationRoleError(layout, { ...route, id: 'new-cable' });
    if (roleError) { set({ statusMessage: roleError }); return; }
    const compatibility = checkConnectorCompatibility(layout, { ...route, id: 'new-cable' });
    if (compatibility.status === 'conflict') {
      set({ statusMessage: `Cable not added: ${compatibility.conflicts.join(' ')}` });
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

  applyPatchChain: (plan) => get().applyABPlan(toABPlan(plan)),

  applyABPlan: (plan) => {
    const state = get();
    // Repeated clicks are harmless only when the entire resulting layout matches.
    if (lastABApplication?.plan === plan && lastABApplication.fingerprint === abFingerprint(state.layout, state.workspace)) {
      set({ statusMessage: 'A–B connection is already present. No duplicate cables added.' });
      return true;
    }
    const validated = validateABPlan(state.layout, state.workspace, plan);
    if (!validated) {
      set({ statusMessage: 'A–B preview is stale or invalid. Refresh the preview; no cables were added.' });
      return false;
    }
    const added = validated.steps.filter(step => step.kind === 'new').map(step => ({ ...step.cable!, id: newId('cable') }));
    if (!added.length) {
      set({ statusMessage: 'A–B connection is already present. No duplicate cables added.' });
      return true;
    }
    // All checks finish before a single store mutation. Existing physical records retain their identity.
    const layout = { ...state.layout, cables: [...state.layout.cables, ...added] };
    const next = { ...layout, cables: layout.cables.map(c => added.includes(c) ? { ...c, nodes: calculateCableNodes(c, layout) } : c), updatedAt: new Date().toISOString() };
    set({ layout: next, selectedCableId: added[added.length - 1].id, selectedDeviceId: null, statusMessage: `A–B connected: ${added.length} planned segment(s) added, ${validated.reusedCount} existing cable(s) reused. One Undo removes all added segments.` });
    lastABApplication = { plan, fingerprint: abFingerprint(get().layout, get().workspace) };
    return true;
  },

  tidyPatchPanel: (panelId) => {
    const state = get();
    const result = tidyPanelCables(state.layout, panelId);
    if (result.changed) set({ layout: { ...state.layout, cables: result.cables, updatedAt: new Date().toISOString() }, statusMessage: result.message });
    else set({ statusMessage: result.message });
  },

  addCables: (routes) => {
    const layout = get().layout;
    const newCables: CableRoute[] = [];
    const changedIds = new Set<string>();

    for (const route of routes) {
      if (route.fromDeviceId === route.toDeviceId || routeUsesInterRackPort(get().workspace, layout.id, route)) continue;
      const from = layout.devices.find((d) => d.id === route.fromDeviceId);
      const to = layout.devices.find((d) => d.id === route.toDeviceId);
      if (!from || !to || shouldHideDevice(from) || shouldHideDevice(to)) continue;
      if (installationRoleError(layout, { ...route, id: 'new-cable' })) continue;
      const cableId = newId('cable');
      const cable: CableRoute = {
        ...route,
        id: cableId,
        nodes: calculateCableNodes({ ...route, id: cableId }, layout)
      };
      newCables.push(cable);
      changedIds.add(route.fromDeviceId);
      changedIds.add(route.toDeviceId);
    }

    if (newCables.length === 0) {
      set({ statusMessage: 'Auto-wire found no new cables to add.' });
      return;
    }

    set({
      layout: touch({ ...layout, cables: [...layout.cables, ...newCables] }, changedIds),
      selectedCableId: newCables[newCables.length - 1].id,
      selectedDeviceId: null,
      statusMessage: `Auto-wired ${newCables.length} cable route(s).`
    });
  },

  updateCable: (cableId, patch) => {
    const layout = get().layout;
    const current = layout.cables.find((cable) => cable.id === cableId);
    if (!current) return;
    if (layout.devices.some(d => shouldHideDevice(d) && (d.id === current.fromDeviceId || d.id === current.toDeviceId))) return;
    const nextCable = { ...current, ...patch, ...(Object.prototype.hasOwnProperty.call(patch, 'manualPath') ? { routingOrigin: undefined } : {}), id: cableId };
    const roleError = installationRoleError(layout, nextCable);
    if (roleError) { set({ statusMessage: roleError }); return; }
    if (routeUsesInterRackPort(get().workspace, layout.id, nextCable)) {
      set({ statusMessage: 'Endpoint port is already used by an inter-rack cable.' });
      return;
    }
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

  acceptFindingException: (identity, reason) => {
    if (!reason.trim() || ![identity.ruleId, identity.targetKey, identity.fingerprint].every(value => typeof value === 'string' && value.trim())) return false;
    const layout = get().layout;
    const exception = { ...identity, id: newId('exception'), reason: reason.trim(), acceptedAt: new Date().toISOString() };
    set({
      layout: {
        ...layout,
        findingReviewVersion: 1,
        findingExceptions: [...(layout.findingExceptions ?? []).filter(record =>
          record.ruleId !== identity.ruleId || record.targetKey !== identity.targetKey), exception],
        updatedAt: new Date().toISOString(),
      },
      statusMessage: 'Exception accepted with a reason. It will reopen if the cause changes.',
    });
    return true;
  },

  removeFindingException: (exceptionId) => {
    const layout = get().layout;
    if (!(layout.findingExceptions ?? []).some(record => record.id === exceptionId)) return;
    set({
      layout: { ...layout, findingExceptions: layout.findingExceptions!.filter(record => record.id !== exceptionId), updatedAt: new Date().toISOString() },
      statusMessage: 'Accepted exception removed.',
    });
  },

  reopenFindingException: (exceptionId) => {
    get().removeFindingException(exceptionId);
    set({ statusMessage: 'Finding reopened for review.' });
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
    if (patch.heightU !== undefined) {
      if (!Number.isInteger(patch.heightU) || patch.heightU < 1) return;
      if (patch.heightU < layout.heightU) {
        set({ pendingRackResize: { layout, patch: { ...patch, heightU: patch.heightU } } });
        return;
      }
    }
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
    get().updateRack({ heightU, weightLimitKg: defaultWeightLimit(layout.rackType, heightU) });
  },

  resolveRackResize: (resolution) => {
    const { pendingRackResize, layout } = get();
    set({ pendingRackResize: null });
    if (resolution === 'cancel' || !pendingRackResize) return;
    if (pendingRackResize.layout !== layout) {
      set({ statusMessage: 'Layout changed. Review the rack height change again.' });
      return;
    }
    set({
      layout: touch({ ...layout, ...pendingRackResize.patch }),
      statusMessage: 'Rack resized. All planning data retained; review out-of-bounds issues. Undo is available until reload.',
    });
  },

  setViewSide: (viewSide) => {
    const layout = get().layout;
    set({ layout: touch({ ...layout, viewSide }) });
  },

  setViewMode: (viewMode) => set({ viewMode }),
  setEditorZoom: (zoom) => set({ editorZoom: Math.max(0.15, Math.min(1.8, zoom)) }),
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
    const { workspace, currentRackId } = get();
    // An imported file can originate from another rack in this workspace.
    // Give the replacement its own identity so edits cannot alias that rack.
    if (workspace.racks.some(rack => rack.id !== currentRackId && rack.id === normalized.id)) {
      normalized.id = newId('layout');
    }
    set({
      layout: normalized,
      selectedDeviceId: normalized.devices.find(d => !shouldHideDevice(d))?.id ?? null,
      selectedCableId: null,
      statusMessage: `${layout.name} loaded.`,
      ...historyFor(normalized),
      skipNextHistory: true
    });
  },

  loadSample: (sampleId) => {
    const sample = getSampleDefinition(sampleId)?.layout;
    if (!sample) return;
    // Normalization copies some fields, but nested records must never share
    // references with the canonical example or another loaded instance.
    const layout = normalizeLayout(cloneLayout(sample));
    const { workspace, currentRackId } = get();
    // A sample ID names its canonical content, not every workspace instance.
    // Reusing it in another slot must not alias an existing sibling rack.
    if (workspace.racks.some(rack => rack.id !== currentRackId && rack.id === layout.id)) {
      layout.id = newId('layout');
    }
    set({
      layout,
      selectedDeviceId: layout.devices.find(d => !shouldHideDevice(d))?.id ?? null,
      selectedCableId: null,
      statusMessage: `${sample.name} loaded.`,
      ...historyFor(layout),
      skipNextHistory: true
    });
  },

  saveLocal: () => get().saveWorkspace(),

  loadLocal: () => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return get().loadWorkspace();
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return false;
      try {
        if (raw.length > MAX_SAVED_JSON_LENGTH) throw new Error('Oversized saved layout');
        const legacyLayout = normalizeLayout(JSON.parse(raw));
        const workspace = { ...createDefaultWorkspace(), racks: [legacyLayout] };
        get().setWorkspace(workspace);
        return true;
      } catch (error) {
        set({ persistenceError: `Saved layout could not be read. ${error instanceof Error ? error.message : 'Invalid saved data'}. Autosave is paused to protect the original. Download the saved data for recovery.`, recoverySource: raw, persistenceBlocked: true });
        return false;
      }
    } catch {
      set({ persistenceError: 'Browser storage could not be read. Download your workspace before closing this tab.', persistenceBlocked: true });
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
    const cableIdMap = new Map<string, string>();
    const clonedCables = (sourceRack.cables ?? []).map((cable) => {
      const newCableId = newId('cable');
      cableIdMap.set(cable.id, newCableId);
      return {
        ...cable,
        id: newCableId,
        fromDeviceId: idMap.get(cable.fromDeviceId) ?? cable.fromDeviceId,
        toDeviceId: idMap.get(cable.toDeviceId) ?? cable.toDeviceId,
        powerSourceDeviceId: cable.powerSourceDeviceId ? idMap.get(cable.powerSourceDeviceId) : undefined,
      };
    });
    // Remap device/cable-id-keyed collections through the id maps; drop
    // entries whose referenced ids do not exist in the cloned rack.
    const mapDeviceIds = (ids?: string[]) =>
      ids?.map((id) => idMap.get(id)).filter((id): id is string => Boolean(id));
    const mapCableIds = (ids?: string[]) =>
      ids?.map((id) => cableIdMap.get(id)).filter((id): id is string => Boolean(id));
    const clonedServices = (sourceRack.services ?? [])
      .filter((service) => !service.hostDeviceId || idMap.has(service.hostDeviceId))
      .map((service) => ({
        ...service,
        hostDeviceId: service.hostDeviceId ? idMap.get(service.hostDeviceId) : undefined,
        storageDeviceIds: mapDeviceIds(service.storageDeviceIds),
        networkDeviceIds: mapDeviceIds(service.networkDeviceIds),
        powerDeviceIds: mapDeviceIds(service.powerDeviceIds),
        backupDeviceId: service.backupDeviceId ? idMap.get(service.backupDeviceId) : undefined,
      }));
    const clonedPortReservations = (sourceRack.portReservations ?? [])
      .filter((reservation) => idMap.has(reservation.deviceId))
      .map((reservation) => ({ ...reservation, deviceId: idMap.get(reservation.deviceId)! }));
    const clonedPatchPanelDocs = (sourceRack.patchPanelDocs ?? [])
      .filter((doc) => idMap.has(doc.deviceId))
      .map((doc) => ({
        ...doc,
        deviceId: idMap.get(doc.deviceId)!,
        cableId: doc.cableId ? cableIdMap.get(doc.cableId) : undefined,
      }));
    const clonedDebtItems = (sourceRack.debtItems ?? []).map((item) => ({
      ...item,
      deviceIds: mapDeviceIds(item.deviceIds),
      cableIds: mapCableIds(item.cableIds),
    }));
    const clonedDomainAssignments = (sourceRack.domainAssignments ?? []).map((assignment) => ({
      ...assignment,
      deviceIds: mapDeviceIds(assignment.deviceIds),
      cableIds: mapCableIds(assignment.cableIds),
    }));
    const clonedSensorReadings = (sourceRack.sensorReadings ?? [])
      .filter((reading) => idMap.has(reading.deviceId))
      .map((reading) => ({ ...reading, deviceId: idMap.get(reading.deviceId)! }));
    const newRackBase: RackLayout = {
      ...sourceRack,
      id: `rack-${Date.now()}`,
      name: newName,
      devices: clonedDevices,
      unplacedDevices: sourceRack.unplacedDevices?.map(d => ({ ...d, id: newId('device') })),
      cables: clonedCables,
      services: clonedServices,
      portReservations: clonedPortReservations,
      patchPanelDocs: clonedPatchPanelDocs,
      debtItems: clonedDebtItems,
      domainAssignments: clonedDomainAssignments,
      sensorReadings: clonedSensorReadings,
      // New target IDs need a new review; never transfer accepted evidence
      // from the original rack onto its newly created devices and cables.
      findingExceptions: [],
    };
    const newRack: RackLayout = {
      ...withCableNodes(newRackBase),
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
    const error = validateInterRackCable(workspace, cable);
    if (error) {
      set({ statusMessage: error });
      return false;
    }
    const newCable: InterRackCable = { ...cable, id: newId('irc') };
    set({
      workspace: { ...workspace, interRackCables: [...workspace.interRackCables, newCable] },
      statusMessage: 'Inter-rack cable added.',
    });
    return true;
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
    const nextCable = { ...current, ...patch, id: cableId };
    const error = validateInterRackCable(workspace, nextCable, cableId);
    if (error) {
      set({ statusMessage: error });
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
    persistWorkspace(syncWorkspace(get()));
  },

  loadWorkspace: () => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      if (raw.length > MAX_SAVED_JSON_LENGTH) throw new Error('Oversized saved workspace');
      const workspace = normalizeWorkspace(JSON.parse(raw));
      const layout = workspace.racks[0];
      set({
        workspace,
        currentRackId: layout.id,
        layout,
        pendingRackResize: null,
        persistenceBlocked: false,
        persistenceError: null,
        recoverySource: null,
        selectedDeviceId: layout.devices.find(d => !shouldHideDevice(d))?.id ?? null,
        selectedCableId: null,
        statusMessage: 'Workspace loaded.',
        ...historyFor(layout),
        skipNextHistory: true,
      });
      return true;
    } catch (error) {
      set({ persistenceError: `Saved workspace could not be read. ${error instanceof Error ? error.message : 'Invalid saved data'}. Autosave is paused to protect the original. Download the saved data for recovery.`, recoverySource: raw, persistenceBlocked: true });
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
      selectedDeviceId: layout.devices.find(d => !shouldHideDevice(d))?.id ?? null,
      selectedCableId: null,
      statusMessage: `${normalized.name} loaded.`,
      ...historyFor(layout),
      skipNextHistory: true,
    });
    return true;
  },
}));

function persistWorkspace(workspace: Workspace) {
  const state = useRackStore.getState();
  if (state.persistenceBlocked) return;
  try {
    const json = JSON.stringify(workspace);
    if (json.length > MAX_SAVED_JSON_LENGTH) throw new Error('Workspace exceeds safe load size');
    localStorage.setItem(STORAGE_KEY, json);
    if (state.persistenceError) useRackStore.setState({ persistenceError: null });
  } catch {
    useRackStore.setState({ persistenceError: 'Changes are not saved in this browser. Download your workspace JSON now before refreshing or closing this tab, or free browser storage and retry.' });
  }
}

// Track layout changes for undo/redo and sync workspace
useRackStore.subscribe((state, prevState) => {
  try {
    const updates: Partial<RackState> = {};
    const synced = syncWorkspace(state);
    const pruned = state.layout !== prevState.layout || state.workspace !== prevState.workspace
      ? pruneInvalidInterRackCables(synced) : synced;
    const syncedWorkspace = state.skipNextHistory ? pruned : invalidateChangedPowerReviews(syncWorkspace(prevState), pruned);
    const effectiveLayout = syncedWorkspace.racks.find(r => r.id === state.layout.id) ?? state.layout;
    const reviewChangedLayout = effectiveLayout !== state.layout && syncedWorkspace !== pruned;
    if (reviewChangedLayout) {
      updates.layout = effectiveLayout;
      // The history entry below already contains the invalidated review state.
      updates.skipNextHistory = true;
    }
    if (!state.skipNextHistory && (state.layout !== prevState.layout || reviewChangedLayout)) {
      const history = state.history.slice(0, state.historyIndex + 1);
      history.push(cloneLayout(reviewChangedLayout ? effectiveLayout : state.layout));
      const trimmedHistory = history.length > MAX_HISTORY ? history.slice(1) : history;
      updates.history = trimmedHistory;
      updates.historyIndex = trimmedHistory.length - 1;
    }
    if (state.skipNextHistory) updates.skipNextHistory = false;
    const removedLinks = synced.interRackCables.length - syncedWorkspace.interRackCables.length;
    if (removedLinks > 0) {
      updates.statusMessage = `${state.statusMessage ?? ''} Removed ${removedLinks} invalid inter-rack cable(s).`.trim();
    }
    if (state.selectedInterRackCableId && !syncedWorkspace.interRackCables.some(c => c.id === state.selectedInterRackCableId)) {
      updates.selectedInterRackCableId = null;
    }
    if (syncedWorkspace !== state.workspace) {
      updates.workspace = syncedWorkspace;
      // New/imported layouts replace the current rack slot. Keep subsequent
      // inventory and device edits attached to that slot for persistence.
      if (syncedWorkspace.racks.includes(state.layout) && !syncedWorkspace.racks.some(r => r.id === state.currentRackId)) {
        updates.currentRackId = state.layout.id;
      }
    }
    if (Object.keys(updates).length > 0) {
      useRackStore.setState(updates);
    }
    if (state.layout !== prevState.layout || state.workspace !== prevState.workspace || state.currentRackId !== prevState.currentRackId) {
      const workspaceToSave = updates.workspace ?? state.workspace;
      persistWorkspace(workspaceToSave);
    }
  } catch {
    useRackStore.setState({ persistenceError: 'History or autosave failed. Download your workspace JSON before closing this tab.' });
  }
});

// Initialize: try workspace first, fallback to legacy layout migration
if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
  if (!useRackStore.getState().loadWorkspace() && !useRackStore.getState().persistenceBlocked) {
    useRackStore.getState().loadLocal();
  }
}
