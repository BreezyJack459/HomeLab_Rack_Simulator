import { withoutHiddenZeroUPdu } from '../utils/featureFlags';
import { Bug, Move, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { DragEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTemplateById, templateFromDevice } from '../data/deviceCatalog';
import { useDeviceDragStore, type LibraryDragSource } from '../store/deviceDragStore';
import { getPlacementFeedback, placementDraft } from '../utils/devicePlacement';
import { useRackStore } from '../store/rackStore';
import type { DeviceCategory, DeviceTemplate, PlacedDevice, PortLayout, RackLayout, RackReservation, ViewSide } from '../types/rack';
import { clampDevicePosition, clampDeviceX, getCenterOfGravityU, getDeviceFaceSizeMm, getDeviceMountSide, getDeviceSpatialZone, getDeviceWidthMm, getDeviceXRange, getZeroUEarSide, isZeroU, RACK_SPECS, zeroUHeightMm, zeroUBottomMm } from '../utils/rackMath';
import { getPortFaceMap, type PortSlot } from '../utils/portLayout';
import { getPatchPanelLinkedCableIds } from '../utils/patchPanel';
import { getReservationXRange } from '../utils/reservations';
import { calculateCablePlan, pathDescription } from '../utils/routing';
import { getFaceplateArtifact, getHitRegions, resolveFaceplateUrl, type PortHitRegion } from '../utils/faceplateSvg';
import { NEW_SHELL } from '../utils/featureFlags';
import { isTrayShelf, getSupportingTray, shelfDeckHeight, shelfThickness, deviceBodyHeightMm, U_HEIGHT_MM } from '../utils/rackMath';

const BASE_UNIT_HEIGHT = 34;
const SIDE_LABEL_OFFSET = 78;
const SIDE_LABEL_WIDTH = 240;
const SIDE_LABEL_GROUP_GAP = 8;
const SIDE_LABEL_MIN_WIDTH = 170;
const SIDE_LABEL_ITEM_HEIGHT = 24;
const COMPACT_SIDE_PORT_MIN_WIDTH = 310;
const FIXED_PORT_CELL_WIDTH = 18;
const SIDE_STRIP_WIDTH = 110;
const SIDE_STRIP_GAP = 16;
const RACK_FRAME_BORDER_PX = 16;
const AUTO_FIT_WIDTH_RATIO = 0.75;
const MIN_EDITOR_ZOOM = 0.45;
const MAX_EDITOR_ZOOM = 1.8;
const CANVAS_HORIZONTAL_PADDING_PX = 64;
const EDITOR_TOOL_BUTTON_CLASS = 're-tb';
const EDITOR_TOOL_BUTTON_WITH_LABEL_CLASS = 're-tbl';
const EDITOR_TOGGLE_INACTIVE_CLASS = 're-ti';
const SIDE_LABEL_ITEM_CLASS = 'rs-li';

interface RackEditor2DProps {
  layoutOverride?: RackLayout;
  serviceabilityOverlay?: boolean;
  highlightedDeviceIds?: string[];
}

interface DragState {
  deviceId: string;
  sizeU: number;
  offsetX: number;
  offsetY: number;
  previewU: number;
  previewX: number;
}

interface PanState {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

interface SideLabelItem {
  device: PlacedDevice;
  visual: { left: number; width: number };
}

interface SideLabelGroup {
  key: string;
  uLabel: string;
  top: number;
  anchorY: number;
  labelY: number;
  height: number;
  sourceX: number;
  items: SideLabelItem[];
}

function getPdu0uMeta(device: PlacedDevice, layout: RackLayout) {
  const outlets = device.ports?.power ?? 0;
  const powerCables = layout.cables.filter(
    (c) => c.toDeviceId === device.id && c.toPort?.type === 'power'
  );
  const used = powerCables.length;
  const powerBudget = powerCables.reduce((sum, c) => {
    const src = layout.devices.find((d) => d.id === c.fromDeviceId);
    return sum + (src?.powerW ?? 0);
  }, 0);
  const zone = getDeviceSpatialZone(device);
  const earSide = getZeroUEarSide(device);
  const side = earSide === 'left' ? 'Left' : 'Right';
  const feed = earSide === 'left' ? 'A' : 'B';
  return { outlets, used, powerBudget, side, feed };
}

function portItems(ports?: PortLayout) {
  if (!ports) return [];
  return [
    ...Array.from({ length: ports.ethernet ?? 0 }, () => 'ethernet'),
    ...Array.from({ length: ports.fiber ?? 0 }, () => 'fiber'),
    ...Array.from({ length: ports.usb ?? 0 }, () => 'usb'),
    ...Array.from({ length: ports.hdmi ?? 0 }, () => 'hdmi'),
    ...Array.from({ length: ports.power ?? 0 }, () => 'power'),
    ...Array.from({ length: ports.atx ?? 0 }, () => 'atx'),
    ...Array.from({ length: ports.coax ?? 0 }, () => 'coax')
  ];
}

function getDeviceSpeedBreakdown(device: PlacedDevice): { speed: string; count: number }[] {
  if (!device.portLayouts) return [];
  const counts = new Map<string, number>();
  for (const face of ['front', 'rear'] as const) {
    const layout = device.portLayouts[face];
    if (!layout) continue;
    for (const config of layout) {
      if (!config.speed) continue;
      const key = `${config.speed}${config.mediaType && config.mediaType !== 'rj45' ? ` ${config.mediaType}` : ''}`;
      const count = config.count ?? (device.ports?.[config.type] ?? 0);
      counts.set(key, (counts.get(key) ?? 0) + count);
    }
  }
  return Array.from(counts.entries()).map(([speed, count]) => ({ speed, count }));
}

function portsForView(
  ports: PortLayout | undefined,
  viewSide: ViewSide,
  category: DeviceCategory,
  portFaceOverrides?: Record<string, 'front' | 'rear'>,
  isSideZoneDevice?: boolean
) {
  if (!ports) return undefined;

  // Patch panels show ports on both front and rear views
  if (category === 'patch-panel') {
    return ports;
  }

  // Side-mounted devices show ports on both front and rear views
  if (isSideZoneDevice) {
    return ports;
  }

  const faceMap = getPortFaceMap(category, portFaceOverrides);
  const frontPorts: PortLayout = { layoutColumns: ports.layoutColumns };
  const rearPorts: PortLayout = { layoutColumns: Math.min(ports.layoutColumns ?? 4, 6) };

  (Object.entries(ports) as [string, number | undefined][])
    .filter(([key]) => key !== 'layoutColumns' && key !== 'undefined')
    .forEach(([type, count]) => {
      if (!count || count <= 0) return;
      const face = faceMap[type] ?? 'rear';
      if (face === 'front') (frontPorts as Record<string, number>)[type] = count;
      else (rearPorts as Record<string, number>)[type] = count;
    });

  const preferred = viewSide === 'front' ? frontPorts : rearPorts;
  const fallback = viewSide === 'front' ? rearPorts : frontPorts;
  const preferredItems = portItems(preferred);
  const fallbackItems = portItems(fallback);
  // Single-face devices: if all ports live on one face only, never fallback
  // to avoid showing ports on the wrong view side
  const isSingleFaceDevice = preferredItems.length === 0 || fallbackItems.length === 0;
  if (isSingleFaceDevice) return preferred;
  return preferredItems.length > 0 ? preferred : fallback;
}

function PortStrip({ ports, compact }: { ports?: PortLayout; compact: boolean }) {
  const items = portItems(ports);
  if (items.length === 0) return null;
  const columns = Math.max(1, Math.min(ports?.layoutColumns ?? (items.length > 16 ? 12 : items.length), items.length));
  const fixedCells = !compact && items.length <= 8;
  const colorByType = {
    ethernet: 'border-accent/60 bg-accent-solid/35 dark:border-accent/60 dark:bg-accent/35',
    fiber: 'border-violet-500/60 bg-violet-500/35 dark:border-violet-200/60 dark:bg-violet-300/35',
    usb: 'border-yellow-500/60 bg-yellow-500/35 dark:border-yellow-200/60 dark:bg-yellow-300/35',
    hdmi: 'border-emerald-500/60 bg-emerald-500/35 dark:border-emerald-200/60 dark:bg-emerald-300/35',
    power: 'border-orange-500/60 bg-orange-500/35 dark:border-orange-200/60 dark:bg-orange-300/35',
    atx: 'border-rose-500/60 bg-rose-500/35 dark:border-rose-200/60 dark:bg-rose-300/35',
    coax: 'border-lime-500/60 bg-lime-500/35 dark:border-lime-200/60 dark:bg-lime-300/35'
  };

  return (
    <div
      className={`grid ${compact ? 'gap-[2px]' : 'gap-1'} ${fixedCells ? 'w-fit max-w-full' : 'w-full'}`}
      style={{
        gridTemplateColumns: fixedCells
          ? `repeat(${columns}, ${FIXED_PORT_CELL_WIDTH}px)`
          : `repeat(${columns}, minmax(0, 1fr))`
      }}
    >
      {items.slice(0, 48).map((type, index) => (
        <span
          key={`${type}-${index}`}
          data-port-type={type}
          className={`rounded-[2px] border ${compact ? 'h-[5px]' : 'h-2'} ${colorByType[type as keyof typeof colorByType]}`}
        />
      ))}
    </div>
  );
}

function deviceVisual(layout: RackLayout, device: PlacedDevice, rackWidth: number) {
  const rackUsable = RACK_SPECS[layout.rackType].usableWidthMm;
  const range = getDeviceXRange(layout, device);
  return {
    left: (range.x / rackUsable) * rackWidth,
    width: (Math.min(range.width, rackUsable) / rackUsable) * rackWidth
  };
}

function reservationVisual(layout: RackLayout, reservation: RackReservation, rackWidth: number) {
  const rackUsable = RACK_SPECS[layout.rackType].usableWidthMm;
  const range = getReservationXRange(layout, reservation);
  return {
    left: (range.x / rackUsable) * rackWidth,
    width: (Math.min(range.width, rackUsable) / rackUsable) * rackWidth
  };
}

function serviceabilityDeviceStyle(enabled: boolean, highlighted: boolean) {
  if (!enabled || !highlighted) return undefined;
  return {
    boxShadow: '0 0 0 2px rgba(251, 191, 36, 0.65), 0 0 28px rgba(251, 191, 36, 0.18)',
  };
}

function cableHighlightStyle(highlighted: boolean): React.CSSProperties | undefined {
  if (!highlighted) return undefined;
  return {
    boxShadow: '0 0 0 2px rgba(6, 182, 212, 0.55), 0 0 20px rgba(6, 182, 212, 0.12)',
  };
}

export function RackEditor2D({ layoutOverride, serviceabilityOverlay = false, highlightedDeviceIds = [] }: RackEditor2DProps) {
  const rackRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const storeLayout = useRackStore((state) => state.layout);
  const layout = useMemo(() => withoutHiddenZeroUPdu(layoutOverride ?? storeLayout), [layoutOverride, storeLayout]);
  const selectedDeviceId = useRackStore((state) => state.selectedDeviceId);
  const editorZoom = useRackStore((state) => state.editorZoom);
  const editorPan = useRackStore((state) => state.editorPan);
  const debugMode = useRackStore((state) => state.debugMode);
  const toggleDebugMode = useRackStore((state) => state.toggleDebugMode);
  const addDeviceFromTemplate = useRackStore((state) => state.addDeviceFromTemplate);
  const moveDevice = useRackStore((state) => state.moveDevice);
  const removeDevice = useRackStore((state) => state.removeDevice);
  const updateDevice = useRackStore((state) => state.updateDevice);
  const selectDevice = useRackStore((state) => state.selectDevice);
  const selectCable = useRackStore((state) => state.selectCable);
  const selectedCableId = useRackStore((state) => state.selectedCableId);
  const undo = useRackStore((state) => state.undo);
  const redo = useRackStore((state) => state.redo);
  const setEditorZoom = useRackStore((state) => state.setEditorZoom);
  const setEditorPan = useRackStore((state) => state.setEditorPan);
  const libraryDragSource = useDeviceDragStore(s => s.source);
  const [libraryPreview, setLibraryPreview] = useState<PlacedDevice | null>(null);
  const dragCancelled = useRef(false);
  useEffect(() => { if (!libraryDragSource) setLibraryPreview(null); }, [libraryDragSource]);
  useEffect(() => {
    const end = () => { setLibraryPreview(null); useDeviceDragStore.getState().end(); };
    const cancel = () => { dragCancelled.current = true; setDragging(null); end(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    window.addEventListener('dragend', end);
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('dragend', end); window.removeEventListener('blur', cancel); window.removeEventListener('keydown', escape); };
  }, []);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [panMode, setPanMode] = useState(false);
  const [panning, setPanning] = useState<PanState | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [contextMenu, setContextMenu] = useState<null | { x: number; y: number; deviceId: string }>(null);
  const [resizing, setResizing] = useState<null | { deviceId: string; startY: number; originalSizeU: number; originalPositionU: number }>(null);
  const [autoFitEnabled, setAutoFitEnabled] = useState(true);
  const highlightedDeviceIdSet = useMemo(() => new Set(highlightedDeviceIds), [highlightedDeviceIds]);
  const selectedCableDeviceIds = useMemo(() => {
    if (!selectedCableId) return new Set<string>();
    const linked = getPatchPanelLinkedCableIds(layout, selectedCableId);
    const ids = new Set<string>();
    for (const cable of layout.cables) {
      if (linked.has(cable.id)) {
        ids.add(cable.fromDeviceId);
        ids.add(cable.toDeviceId);
      }
    }
    return ids;
  }, [layout, selectedCableId]);

  const rackWidth = RACK_SPECS[layout.rackType].visualWidthPx;
  const rackOuterWidth = rackWidth + RACK_FRAME_BORDER_PX * 2;
  const rackHeight = layout.heightU * BASE_UNIT_HEIGHT;
  const rackUsable = RACK_SPECS[layout.rackType].usableWidthMm;
  const cg = useMemo(() => getCenterOfGravityU(layout), [layout]);
  const visibleDevices = useMemo(
    () =>
      layout.devices.filter((device) => {
        if (isZeroU(device)) return true;
        const zone = getDeviceSpatialZone(device);
        if (zone === 'front') return layout.viewSide === 'front';
        if (zone === 'rear') return layout.viewSide === 'rear';
        return true;
      }),
    [layout.devices, layout.viewSide]
  );

  const rackDevices = useMemo(
    () => visibleDevices.filter((device) => !isZeroU(device)),
    [visibleDevices, layout.viewSide]
  );
  const hasSideLabels = useMemo(
    () => !NEW_SHELL && rackDevices.some((device) => {
      const visual = deviceVisual(layout, device, rackWidth);
      return device.sizeU === 1 || visual.width < SIDE_LABEL_MIN_WIDTH;
    }),
    [layout, rackDevices, rackWidth],
  );
  const visibleReservations = useMemo(
    () => (layout.reservations ?? []).filter((reservation) => reservation.mountSide === layout.viewSide),
    [layout.reservations, layout.viewSide]
  );
  const sideLeftDevices = useMemo(
    () => visibleDevices.filter((device) => isZeroU(device) && getZeroUEarSide(device) === (layout.viewSide === 'rear' ? 'right' : 'left')),
    [visibleDevices, layout.viewSide]
  );
  const sideRightDevices = useMemo(
    () => visibleDevices.filter((device) => isZeroU(device) && getZeroUEarSide(device) === (layout.viewSide === 'rear' ? 'left' : 'right')),
    [visibleDevices, layout.viewSide]
  );
  const ghostDevices = useMemo(() => {
    if (!debugMode) return [];
    return layout.devices.filter((device) => {
      const zone = getDeviceSpatialZone(device);
      if (zone === 'front') return layout.viewSide === 'rear';
      if (zone === 'rear') return layout.viewSide === 'front';
      return false;
    });
  }, [layout.devices, layout.viewSide, debugMode]);

  const zeroUSideSpace = sideLeftDevices.length || sideRightDevices.length ? SIDE_STRIP_WIDTH + SIDE_STRIP_GAP : 0;

  const fitRackToViewport = useCallback(() => {
    const viewportWidth = viewportRef.current?.clientWidth ?? 0;
    if (viewportWidth <= 0) return;

    const usableWidth = Math.max(0, viewportWidth - CANVAS_HORIZONTAL_PADDING_PX);
    const fitWidth = rackOuterWidth + zeroUSideSpace * 2 + (hasSideLabels ? SIDE_LABEL_OFFSET + SIDE_LABEL_WIDTH : 0);
    const widthZoom = (usableWidth * (NEW_SHELL ? 0.95 : AUTO_FIT_WIDTH_RATIO)) / fitWidth;
    const heightZoom = NEW_SHELL ? Math.max(100, (viewportRef.current?.clientHeight ?? 0) - 110) / (layout.heightU * BASE_UNIT_HEIGHT + 32) : MAX_EDITOR_ZOOM;
    const nextZoom = Math.max(
      zeroUSideSpace ? 0.15 : MIN_EDITOR_ZOOM,
      Math.min(MAX_EDITOR_ZOOM, widthZoom, heightZoom),
    );
    setEditorZoom(nextZoom);
    setEditorPan({ x: 0, y: 0 });
  }, [hasSideLabels, layout.heightU, rackOuterWidth, zeroUSideSpace, setEditorPan, setEditorZoom]);

  useEffect(() => {
    if (!autoFitEnabled) return undefined;
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    fitRackToViewport();
    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => fitRackToViewport());
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [autoFitEnabled, fitRackToViewport]);

  const sideLabelGroups = useMemo(() => {
    if (NEW_SHELL) return [];
    const groups = new Map<
      string,
      {
        key: string;
        uLabel: string;
        rawTop: number;
        anchorY: number;
        items: SideLabelItem[];
      }
    >();

    rackDevices.forEach((device) => {
      const visual = deviceVisual(layout, device, rackWidth);
      const needsSideLabel = device.sizeU === 1 || visual.width < SIDE_LABEL_MIN_WIDTH;
      if (!needsSideLabel) return;

      const key = `${device.positionU}-${device.sizeU}`;
      const existing = groups.get(key);
      const rawTop = (layout.heightU - (device.positionU + device.sizeU - 1)) * BASE_UNIT_HEIGHT + 2;
      const anchorY = (layout.heightU - (device.positionU + device.sizeU / 2 - 0.5)) * BASE_UNIT_HEIGHT;
      const uLabel =
        device.sizeU > 1 ? `U${device.positionU}-U${device.positionU + device.sizeU - 1}` : `U${device.positionU}`;

      if (existing) {
        existing.items.push({ device, visual });
        existing.rawTop = Math.min(existing.rawTop, rawTop);
        existing.anchorY = Math.min(existing.anchorY, anchorY);
        return;
      }

      groups.set(key, {
        key,
        uLabel,
        rawTop,
        anchorY,
        items: [{ device, visual }]
      });
    });

    let nextTop = 0;
    return Array.from(groups.values())
      .sort((a, b) => a.rawTop - b.rawTop)
      .map((group): SideLabelGroup => {
        const height = 28 + group.items.length * SIDE_LABEL_ITEM_HEIGHT;
        const top = Math.max(group.rawTop, nextTop);
        nextTop = top + height + SIDE_LABEL_GROUP_GAP;
        return {
          ...group,
          top,
          height,
          labelY: top + Math.min(height / 2, 34),
          sourceX: Math.min(rackWidth + 8, Math.max(...group.items.map((item) => item.visual.left + item.visual.width + 8)))
        };
      });
  }, [layout, rackWidth, rackDevices]);

  const hitRegionMap = useMemo(() => {
    const map = new Map<string, PortHitRegion[]>();
    for (const device of rackDevices) {
      if (isZeroU(device)) continue;
      const template = getTemplateById(device.templateId) ?? templateFromDevice(device);
      const key = `${template.id}:${layout.viewSide}`;
      if (!map.has(key)) {
        map.set(key, getHitRegions(template, layout.viewSide));
      }
    }
    return map;
  }, [rackDevices, layout.viewSide]);

  function positionFromClientY(clientY: number, sizeU: number, offsetY = 0) {
    const rackRect = rackRef.current?.getBoundingClientRect();
    if (!rackRect) return 1;
    const unitHeight = rackRect.height / layout.heightU;
    const rawTop = clientY - rackRect.top - offsetY;
    const topIndex = Math.round(rawTop / unitHeight);
    // Rack positions are stored bottom-up (U1 at the bottom), while the DOM renders top-down.
    return clampDevicePosition(layout, sizeU, layout.heightU - topIndex - sizeU + 1);
  }

  function xFromClientX(
    clientX: number,
    device: Pick<PlacedDevice, 'widthType' | 'customWidthMm' | 'sizeU'>,
    offsetX = 0,
  ) {
    const rackRect = rackRef.current?.getBoundingClientRect();
    if (!rackRect) return 0;
    const scale = rackRect.width / rackOuterWidth || 1;
    const rawLeft =
      (clientX - rackRect.left - offsetX) / scale - RACK_FRAME_BORDER_PX;
    return clampDeviceX(layout, device, (rawLeft / rackWidth) * rackUsable);
  }

  function libraryDropCandidate(
    source: LibraryDragSource,
    clientX: number,
    clientY: number,
  ) {
    const original =
      source.kind === 'inventory'
        ? storeLayout.unplacedDevices?.find((d) => d.id === source.id)
        : getTemplateById(source.id);
    if (!original) return null;
    const draft = placementDraft(original, layout.viewSide);
    const scale =
      (rackRef.current?.getBoundingClientRect().width ?? rackOuterWidth) /
      rackOuterWidth;
    const halfWidth =
      ((Math.min(getDeviceWidthMm(draft), rackUsable) / rackUsable) *
        rackWidth *
        scale) /
      2;
    return {
      ...draft,
      positionU: positionFromClientY(clientY, isZeroU(draft) ? zeroUHeightMm(layout, draft) / U_HEIGHT_MM : draft.sizeU),
      xMm: xFromClientX(clientX, draft, halfWidth),
    };
  }

  function handleLibraryDragOver(event: DragEvent<HTMLDivElement>) {
    if (!libraryDragSource) return;
    event.preventDefault();
    event.dataTransfer.dropEffect =
      libraryDragSource.kind === 'inventory' ? 'move' : 'copy';
    const candidate = libraryDropCandidate(
      libraryDragSource,
      event.clientX,
      event.clientY,
    );
    setLibraryPreview((previous) =>
      previous?.id === candidate?.id &&
      previous?.positionU === candidate?.positionU &&
      previous?.xMm === candidate?.xMm
        ? previous
        : candidate,
    );
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const inventoryId = event.dataTransfer.getData(
      'application/x-rack-inventory',
    );
    const templateId = event.dataTransfer.getData('application/x-rack-template');
    const source: LibraryDragSource | null =
      libraryDragSource ??
      (inventoryId
        ? { kind: 'inventory', id: inventoryId }
        : templateId
          ? { kind: 'template', id: templateId }
          : null);
    if (!source) return;
    const candidate = libraryDropCandidate(source, event.clientX, event.clientY);
    if (candidate) {
      // The store validates again against the latest, unfiltered layout.
      if (source.kind === 'inventory')
        useRackStore
          .getState()
          .placeInventoryDevice(source.id, candidate.positionU, candidate.xMm);
      else addDeviceFromTemplate(source.id, candidate.positionU, candidate.xMm);
    }
    setLibraryPreview(null);
    useDeviceDragStore.getState().end();
  }

  function startDeviceDrag(event: PointerEvent<HTMLDivElement>, device: PlacedDevice) {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    selectDevice(device.id);
    dragCancelled.current = false;
    setDragging({
      deviceId: device.id,
      sizeU: isZeroU(device) ? zeroUHeightMm(layout, device) / U_HEIGHT_MM : device.sizeU,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      previewU: device.positionU,
      previewX: device.xMm ?? getDeviceXRange(layout, device).x
    });
  }

  function startResize(event: PointerEvent<HTMLDivElement>, device: PlacedDevice) {
    event.preventDefault();
    event.stopPropagation();
    selectDevice(device.id);
    setResizing({
      deviceId: device.id,
      startY: event.clientY,
      originalSizeU: device.sizeU,
      originalPositionU: device.positionU
    });
  }

  useEffect(() => {
    if (!dragging) return;

    function handleMove(event: globalThis.PointerEvent) {
      setDragging((current) =>
        current
          ? {
              ...current,
              previewU: positionFromClientY(event.clientY, current.sizeU, current.offsetY),
              previewX: xFromClientX(
                event.clientX,
                layout.devices.find((device) => device.id === current.deviceId) ?? {
                  widthType: layout.rackType,
                  customWidthMm: undefined,
                  sizeU: current.sizeU
                },
                current.offsetX
              )
            }
          : current
      );
    }

    function handleUp() {
      if (dragging && !dragCancelled.current) moveDevice(dragging.deviceId, dragging.previewU, dragging.previewX);
      setDragging(null);
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragging, layout, moveDevice]);

  useEffect(() => {
    if (!panning) return;
    const activePan = panning;

    function handleMove(event: globalThis.PointerEvent) {
      setEditorPan({
        x: activePan.originX + event.clientX - activePan.startX,
        y: activePan.originY + event.clientY - activePan.startY
      });
    }

    function handleUp() {
      setPanning(null);
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [panning, setEditorPan]);

  useEffect(() => {
    if (!resizing) return;
    const activeResize = resizing;

    function handleMove(event: globalThis.PointerEvent) {
      const deltaY = event.clientY - activeResize.startY;
      const deltaU = Math.round(deltaY / BASE_UNIT_HEIGHT);
      const newSizeU = Math.max(1, Math.min(layout.heightU - activeResize.originalPositionU + 1, activeResize.originalSizeU + deltaU));
      if (newSizeU !== activeResize.originalSizeU) {
        updateDevice(activeResize.deviceId, { sizeU: newSizeU });
      }
    }

    function handleUp() {
      setResizing(null);
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [resizing, layout.heightU, updateDevice]);

  // Keyboard shortcuts: Delete, Arrow nudge, Space pan
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Form editing owns its keys, including macOS Delete (Backspace),
      // cursor movement, spaces and native text undo/redo.
      const target = event.target;
      if (event.defaultPrevented || event.isComposing || (target instanceof Element &&
        target.closest('input, textarea, select, button, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="spinbutton"]'))) {
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        setSpacePressed(true);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedDeviceId) {
          removeDevice(selectedDeviceId);
        }
        return;
      }

      if (!selectedDeviceId) return;
      const device = layout.devices.find((d) => d.id === selectedDeviceId);
      if (!device) return;

      const stepU = event.shiftKey ? 1 : 0;
      const stepMm = event.shiftKey ? 10 : 1;

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          moveDevice(selectedDeviceId, device.positionU + 1, device.xMm);
          break;
        case 'ArrowDown':
          event.preventDefault();
          moveDevice(selectedDeviceId, Math.max(1, device.positionU - 1), device.xMm);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          moveDevice(selectedDeviceId, device.positionU, (device.xMm ?? 0) - stepMm);
          break;
        case 'ArrowRight':
          event.preventDefault();
          moveDevice(selectedDeviceId, device.positionU, (device.xMm ?? 0) + stepMm);
          break;
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === ' ') {
        setSpacePressed(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedDeviceId, layout.devices, moveDevice, removeDevice]);

  const movingDevice = dragging ? storeLayout.devices.find(d => d.id === dragging.deviceId) : undefined;
  const placementPreview = movingDevice && dragging ? { ...movingDevice, positionU: dragging.previewU, xMm: dragging.previewX } : libraryPreview;
  const feedback = placementPreview ? getPlacementFeedback(storeLayout, placementPreview) : null;

  return (
    <div className="relative h-full overflow-hidden bg-fill-strong dark:bg-surface/55">
      {placementPreview && feedback && <div role="status" data-testid="placement-feedback" className={`pointer-events-none absolute left-3 right-3 top-3 z-40 rounded-xl border bg-surface/95 px-3 py-2 shadow-panel ${!feedback.allowed ? 'border-red-500 text-red-600 dark:text-red-300' : feedback.warning ? 'border-amber-500 text-amber-700 dark:text-amber-300' : 'border-emerald-500 text-emerald-700 dark:text-emerald-300'}`}>
        <div className="text-xs font-semibold">{!feedback.allowed ? 'Cannot place' : feedback.warning ? 'Can place with warning' : 'Ready to place'} · {placementPreview.name} · U{placementPreview.positionU}{placementPreview.sizeU > 1 ? `–U${placementPreview.positionU + placementPreview.sizeU - 1}` : ''}</div>
        <div className="mt-1 text-xs">{feedback.problem?.message ?? feedback.warning?.message ?? 'Release to place here. Esc to cancel.'}</div>
      </div>}
      <div
        className={`absolute z-20 flex gap-2 rounded-xl border border-edge bg-surface/90 p-2 shadow-panel dark:border-edge dark:bg-surface/90 ${
          NEW_SHELL ? 'bottom-16 right-3 items-center xl:bottom-3' : 'left-4 top-16 w-40 flex-col'
        }`}
      >
        <div className="flex items-center gap-2">
          <button
            className={`${EDITOR_TOOL_BUTTON_WITH_LABEL_CLASS} flex-1 justify-between`}
            onClick={() => {
              setAutoFitEnabled(false);
              setEditorZoom(Math.max(zeroUSideSpace ? 0.15 : MIN_EDITOR_ZOOM, editorZoom - 0.1));
            }}
            type="button"
            title="Zoom out"
          >
            <span>{Math.round(editorZoom * 100)}%</span>
            <ZoomOut size={15} />
          </button>
          <button
            className={EDITOR_TOOL_BUTTON_CLASS}
            onClick={() => {
              setAutoFitEnabled(false);
              setEditorZoom(editorZoom + 0.1);
            }}
            type="button"
            title="Zoom in"
          >
            <ZoomIn size={15} />
          </button>
        </div>
        <button
          className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm ${
            panMode
              ? 'bg-accent-solid text-content dark:bg-accent dark:text-accent-on'
              : EDITOR_TOGGLE_INACTIVE_CLASS
          }`}
          onClick={() => setPanMode((value) => !value)}
          type="button"
          title="Toggle pan mode"
        >
          <Move size={15} />
          {!NEW_SHELL && 'Pan'}
        </button>
        <div className="flex gap-2">
          <button
            className={`${EDITOR_TOOL_BUTTON_WITH_LABEL_CLASS} justify-center gap-1.5`}
            onClick={() => {
              setAutoFitEnabled(true);
              fitRackToViewport();
            }}
            type="button"
            title="Fit rack to canvas"
            aria-pressed={autoFitEnabled}
            data-testid="fit-rack-button"
          >
            <RotateCcw size={15} />
            <span>Fit</span>
          </button>
          <button
            className={`inline-flex h-9 items-center justify-center rounded-md px-3 text-sm ${
              debugMode
                ? 'bg-amber-500 text-content dark:bg-amber-400 dark:text-accent-on'
                : EDITOR_TOGGLE_INACTIVE_CLASS
            }`}
            onClick={toggleDebugMode}
            type="button"
            title="Toggle debug mode"
          >
            <Bug size={15} />
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        data-testid="rack-editor-viewport"
        className={`h-full w-full overflow-auto thin-scrollbar ${panMode || spacePressed ? 'cursor-grab' : ''}`}
        onPointerDown={(event) => {
          if (!panMode && !spacePressed) return;
          setAutoFitEnabled(false);
          setPanning({
            startX: event.clientX,
            startY: event.clientY,
            originX: editorPan.x,
            originY: editorPan.y
          });
        }}
      >
        <div className="flex min-h-full min-w-full items-start justify-center p-4 md:p-8">
          <div
            className="relative"
            style={{
              width: rackOuterWidth + zeroUSideSpace * 2,
              transform: `translate(${editorPan.x}px, ${editorPan.y}px) scale(${editorZoom})`,
              transformOrigin: 'top center'
            }}
          >
            <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-content-muted">
              <span>{layout.viewSide === 'front' ? 'Front' : 'Rear'} view</span>
              <span>Snap to U</span>
            </div>
            <div
              ref={rackRef}
              data-testid="rack-frame"
              className="relative border-x-[16px] border-slate-400 bg-surface shadow-panel dark:border-edge-strong dark:bg-surface"
              style={{ width: rackOuterWidth, height: rackHeight, marginLeft: zeroUSideSpace }}
              onDragOver={handleLibraryDragOver}
              onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setLibraryPreview(null); }}
              onDrop={handleDrop}
              onClick={() => {
                selectDevice(null);
                selectCable(null);
              }}
            >
              {Array.from({ length: layout.heightU }, (_, index) => {
                const unit = layout.heightU - index;
                const occupied = rackDevices.some(
                  (device) => unit >= device.positionU && unit < device.positionU + device.sizeU
                );
                return (
                  <div
                    key={unit}
                    className={`absolute left-0 flex items-center border-b border-edge/90 ${
                      occupied ? 'bg-slate-300 dark:bg-surface-raised/45' : 'bg-emerald-500/[0.035]'
                    }`}
                    style={{ top: index * BASE_UNIT_HEIGHT, height: BASE_UNIT_HEIGHT, width: '100%' }}
                  >
                    <div className="absolute -left-[58px] w-10 text-right text-xs font-medium text-content-muted">U{unit}</div>
                    <div className="absolute -right-[58px] w-10 text-left text-xs font-medium text-content-muted">U{unit}</div>
                    <div className="mx-3 h-1 w-1 rounded-full bg-slate-400 dark:bg-slate-600" />
                    <div className="ml-auto mr-3 h-1 w-1 rounded-full bg-slate-400 dark:bg-slate-600" />
                  </div>
                );
              })}

              {sideLabelGroups.length > 0 && (
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 overflow-visible"
                  height={rackHeight}
                  width={rackWidth}
                >
                  {sideLabelGroups.map((group) => {
                    const selected = group.items.some((item) => item.device.id === selectedDeviceId);
                    const elbowX = Math.max(group.sourceX + 16, rackWidth + 28);
                    const labelX = rackWidth + SIDE_LABEL_OFFSET - 12;
                    return (
                      <path
                        key={group.key}
                        d={`M ${group.sourceX} ${group.anchorY} H ${elbowX} V ${group.labelY} H ${labelX}`}
                        fill="none"
                        stroke={selected ? '#67e8f9' : '#64748b'}
                        strokeDasharray={selected ? undefined : '4 5'}
                        strokeLinecap="round"
                        strokeWidth={selected ? 2.5 : 1.5}
                        opacity={selected ? 0.95 : 0.62}
                      />
                    );
                  })}
                </svg>
              )}

              {cg && (
                <div
                  className="pointer-events-none absolute z-10 flex w-full items-center"
                  style={{
                    top: (layout.heightU - cg.cgU) * BASE_UNIT_HEIGHT,
                    height: 1,
                  }}
                >
                  <div
                    className="h-px w-full"
                    style={{
                      backgroundColor: cg.cgU > layout.heightU * 0.5 ? '#f59e0b' : '#34d399',
                      opacity: 0.85,
                    }}
                  />
                  <span
                    className="absolute right-1 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: cg.cgU > layout.heightU * 0.5 ? 'rgba(245,158,11,0.15)' : 'rgba(52,211,153,0.15)',
                      color: cg.cgU > layout.heightU * 0.5 ? '#fbbf24' : '#34d399',
                    }}
                  >
                    CG U{cg.cgU.toFixed(1)}
                  </span>
                </div>
              )}

              {visibleReservations.map((reservation) => {
                const top = (layout.heightU - (reservation.positionU + reservation.sizeU - 1)) * BASE_UNIT_HEIGHT;
                const height = reservation.sizeU * BASE_UNIT_HEIGHT;
                const visual = reservationVisual(layout, reservation, rackWidth);
                return (
                  <div
                    key={reservation.id}
                    className="pointer-events-none absolute rounded-md border border-dashed border-sky-500/60 bg-sky-400/12 dark:border-sky-300/55 dark:bg-sky-300/10"
                    style={{
                      top: top + 4,
                      left: visual.left + 2,
                      width: Math.max(0, visual.width - 4),
                      height: Math.max(0, height - 8),
                      zIndex: 1
                    }}
                    title={`${reservation.name}: reserved U${reservation.positionU}${reservation.sizeU > 1 ? `-U${reservation.positionU + reservation.sizeU - 1}` : ''}`}
                  >
                    <div className="flex h-full min-h-0 flex-col justify-between overflow-hidden p-2">
                      <div className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-100">
                        Reserved
                      </div>
                      <div className="truncate text-xs font-semibold text-sky-900 dark:text-sky-50">{reservation.name}</div>
                      <div className="truncate text-[10px] text-sky-700/80 dark:text-sky-100/75">
                        U{reservation.positionU}
                        {reservation.sizeU > 1 ? `-U${reservation.positionU + reservation.sizeU - 1}` : ''} / {reservation.purpose}
                      </div>
                    </div>
                  </div>
                );
              })}

              {rackDevices.map((device) => {
                const deviceIsZeroU = isZeroU(device);
                const rackHeightPx = layout.heightU * BASE_UNIT_HEIGHT;
                const tray = getSupportingTray(layout, device);
                const preciseHeight = tray || device.physicalHeightMm !== undefined;
                const height = deviceIsZeroU ? rackHeightPx : preciseHeight ? deviceBodyHeightMm(device) / U_HEIGHT_MM * BASE_UNIT_HEIGHT : device.sizeU * BASE_UNIT_HEIGHT;
                const top = deviceIsZeroU ? 0 : (layout.heightU - device.positionU + 1) * BASE_UNIT_HEIGHT - height - (tray ? shelfDeckHeight(tray) / U_HEIGHT_MM * BASE_UNIT_HEIGHT : 0);
                const visual = deviceVisual(layout, device, rackWidth);
                const width = deviceIsZeroU ? Math.max(160, visual.width) : visual.width;
                const left = deviceIsZeroU && width > visual.width
                  ? visual.left - (width - visual.width) / 2
                  : visual.left;
                const selected = selectedDeviceId === device.id;
                if (isTrayShelf(device)) return <div key={device.id} data-device-id={device.id} data-device-category="shelf" data-shelf-style="tray"
                  className="pointer-events-none absolute" style={{ top, left, width, height, zIndex: 4 }}>
                  <div className={`absolute inset-x-0 bottom-0 border-x-2 ${selected ? 'border-accent' : 'border-content-muted'}`} style={{ height: device.sizeU * BASE_UNIT_HEIGHT }} />
                  <div role="button" tabIndex={0} aria-label={device.name} title={`${device.name}: thin tray at U${device.positionU}, ${shelfThickness(device)} mm thick`}
                    className={`pointer-events-auto absolute inset-x-0 cursor-move rounded-sm border ${selected ? 'border-accent bg-accent-solid ring-2 ring-accent/40' : 'border-content-muted bg-fill-strong'}`}
                    style={{ height: Math.max(5, shelfThickness(device) / U_HEIGHT_MM * BASE_UNIT_HEIGHT), bottom: Math.max(0, device.shelfDeckOffsetMm ?? 0) / U_HEIGHT_MM * BASE_UNIT_HEIGHT }}
                    onPointerDown={event => startDeviceDrag(event, device)} onClick={event => { event.stopPropagation(); selectDevice(device.id); }}
                    onKeyDown={event => { if (event.key === 'Enter') { event.stopPropagation(); selectDevice(device.id); } }}>
                    <span className="absolute right-1 top-full whitespace-nowrap rounded bg-surface px-1 text-[9px] text-content-muted">{device.name} · tray</span>
                  </div>
                </div>;
                const compact = !deviceIsZeroU && height <= 42;
                const highlighted = highlightedDeviceIdSet.has(device.id) || selectedCableDeviceIds.has(device.id);
                const template = getTemplateById(device.templateId) ?? templateFromDevice(device);
                const artifact = getFaceplateArtifact(template, layout.viewSide);
                const hitRegions = hitRegionMap.get(`${template.id}:${layout.viewSide}`) ?? [];
                const { width: faceWidthMm, height: faceHeightMm } = getDeviceFaceSizeMm(device);
                const faceAspect = faceWidthMm / faceHeightMm;
                return (
                  <div
                    key={device.id}
                    data-device-id={device.id}
                    data-device-category={device.category}
                    data-zero-u={deviceIsZeroU}
                    className={`absolute select-none rounded-md border px-3 shadow-lg transition ${compact ? 'py-1' : 'py-2'} ${
                      selected ? 'border-accent ring-2 ring-accent/40 dark:ring-accent/40' : 'border-black/10 dark:border-black/10 dark:border-white/20 hover:border-accent/70 dark:hover:border-accent/70 dark:hover:border-accent/70'
                    } ${dragging?.deviceId === device.id ? 'opacity-55' : device.lifecycleStatus === 'planned' ? 'opacity-60' : device.lifecycleStatus === 'decommissioning' ? 'opacity-50' : ''}`}
                    style={{
                      top: top + (preciseHeight ? 0 : 3),
                      left,
                      width,
                      height: preciseHeight ? height : height - 6,
                      background:
                        device.category === 'printed-mount'
                          ? `repeating-linear-gradient(45deg, ${device.color}, ${device.color} 8px, rgba(15, 23, 42, 0.85) 8px, rgba(15, 23, 42, 0.85) 16px)`
                          : layout.viewSide === 'rear'
                            ? `linear-gradient(135deg, rgba(15, 23, 42, 0.98), ${device.color}88)`
                            : `linear-gradient(135deg, ${device.color}, rgba(15, 23, 42, 0.96))`,
                      zIndex: deviceIsZeroU ? 5 : undefined,
                      borderStyle: device.lifecycleStatus === 'planned' || device.category === 'printed-mount' || device.mountingSupport === 'printed-mount' ? 'dashed' : undefined,
                      filter: device.lifecycleStatus === 'decommissioning' ? 'grayscale(0.6)' : undefined,
                      ...serviceabilityDeviceStyle(serviceabilityOverlay, highlighted),
                      ...cableHighlightStyle(highlighted),
                    }}
                    onPointerDown={(event) => startDeviceDrag(event, device)}
                    onClick={(event) => {
                      event.stopPropagation();
                      selectDevice(device.id);
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      selectDevice(device.id);
                      setContextMenu({ x: event.clientX, y: event.clientY, deviceId: device.id });
                    }}
                    title={`${device.name}${device.mountingSupport === 'printed-mount' ? ' [3D-printed mount]' : ''}${device.lifecycleStatus && device.lifecycleStatus !== 'active' ? ` [${device.lifecycleStatus}]` : ''}: ${layout.viewSide} view, ${deviceIsZeroU ? '0U (side)' : `${device.sizeU}U at U${device.positionU}`}`}
                  >
                    {selected && !deviceIsZeroU && (
                      <div
                        className="absolute bottom-0 left-1/2 z-30 h-1.5 w-8 -translate-x-1/2 translate-y-1/2 cursor-ns-resize rounded-full border border-content-muted dark:border-slate-600 bg-slate-400 dark:bg-slate-600 hover:bg-accent-solid-hover dark:hover:bg-accent"
                        onPointerDown={(event) => startResize(event, device)}
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                      <div
                        className="relative h-full"
                        style={{ aspectRatio: faceAspect }}
                      >
                        {artifact.kind === 'image' ? (
                          <img src={resolveFaceplateUrl(artifact.path)} alt="" className="pointer-events-none h-full w-full object-contain" />
                        ) : (
                          <div
                            className="pointer-events-none h-full w-full"
                            dangerouslySetInnerHTML={{ __html: artifact.svg }}
                          />
                        )}
                        {hitRegions.length > 0 && (
                          <>
                            {hitRegions.map((r) => (
                              <div
                                key={`${r.type}-${r.index}`}
                                title={r.label ? r.label : `${r.type} ${r.index + 1}`}
                                aria-label={r.label ? r.label : `${r.type} ${r.index + 1}`}
                                role="img"
                                className="absolute z-20 hover:bg-surface/20"
                                style={{
                                  left: `${(r.x / faceWidthMm) * 100}%`,
                                  top: `${(r.y / faceHeightMm) * 100}%`,
                                  width: `${(r.width / faceWidthMm) * 100}%`,
                                  height: `${(r.height / faceHeightMm) * 100}%`
                                }}
                              />
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                    <div
                      className={`relative z-10 flex h-full min-h-0 gap-2 overflow-hidden ${
                        compact ? 'flex-col justify-center' : 'flex-col justify-between'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className={`rd-n truncate font-semibold ${compact ? 'text-xs leading-4' : 'text-sm'}`}>
                          {device.label || device.name}
                        </div>
                        {compact && layout.viewSide === 'rear' && (
                          <div className="truncate text-[9px] font-medium uppercase tracking-[0.12em] text-content-muted/70 dark:text-content/70">rear side</div>
                        )}
                        {!compact && !deviceIsZeroU && (
                          <div className="rd-m truncate text-[11px]">
                            U{device.positionU}
                            {device.sizeU > 1 ? `-U${device.positionU + device.sizeU - 1}` : ''} / {device.depthMm}mm /{' '}
                            {device.powerW}W
                          </div>
                        )}
                        {deviceIsZeroU && (
                          <div className="rd-m truncate text-[11px]">
                            0U side-mount / {device.depthMm}mm / {device.powerW}W
                          </div>
                        )}
                      </div>
                      {selected && device.ports && (
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                          {(
                            Object.entries(device.ports) as [string, number][]
                          )
                            .filter(([key]) => key !== 'layoutColumns' && key !== 'undefined')
                            .map(([portType, count]) => {
                              if (!count || count <= 0) return null;
                              const used = layout.cables.filter(
                                (cable) =>
                                  (cable.fromDeviceId === device.id && cable.fromPort?.type === portType) ||
                                  (cable.toDeviceId === device.id && cable.toPort?.type === portType)
                              ).length;
                              if (!used) return null;
                              return (
                                <span key={portType} className="text-[9px] font-medium text-accent/90 dark:text-accent-fg/90">
                                  {portType} {used}/{count}
                                </span>
                              );
                            })}
                        </div>
                      )}
                      {selected && (
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                          {getDeviceSpeedBreakdown(device).map(({ speed, count }) => (
                            <span key={speed} className="rounded bg-fill px-1 text-[9px] font-semibold text-content-secondary dark:bg-surface-raised dark:text-content-secondary">
                              {speed} ×{count}
                            </span>
                          ))}
                        </div>
                      )}
                      {device.category === 'cable-management' && (
                        <div className="grid grid-cols-12 gap-1">
                          {Array.from({ length: 12 }, (_, slot) => (
                            <span key={slot} className="h-1 rounded-full bg-slate-300 dark:bg-slate-400/35" />
                          ))}
                        </div>
                      )}
                    </div>
                    {selected && device.category === 'patch-panel' && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="absolute inset-y-0 left-1/2 w-px border-l border-dashed border-black/10 dark:border-black/15 dark:border-white/25" />
                        <span className="absolute left-1 top-1 text-[9px] font-medium text-content-muted dark:text-content/40">Front</span>
                        <span className="absolute right-1 top-1 text-[9px] font-medium text-content-muted dark:text-content/40">Rear</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Ghost devices (debug mode) */}
              {debugMode && ghostDevices.map((device) => {
                const top = (layout.heightU - (device.positionU + device.sizeU - 1)) * BASE_UNIT_HEIGHT;
                const height = device.sizeU * BASE_UNIT_HEIGHT;
                const visual = deviceVisual(layout, device, rackWidth);
                return (
                  <div
                    key={`ghost-${device.id}`}
                    className="pointer-events-none absolute rounded-md border border-dashed border-black/10 dark:border-black/10 dark:border-white/20"
                    style={{
                      top: top + 3,
                      left: visual.left,
                      width: visual.width,
                      height: height - 6,
                      opacity: 0.15,
                      background: 'transparent'
                    }}
                    title={`${device.name} (ghost)`}
                  />
                );
              })}

              {/* Independent 0U lanes are included in the canvas fit bounds. Rear view mirrors screen sides only. */}
              {([sideLeftDevices, sideRightDevices] as const).map((devices, screenSide) => devices.length > 0 && (
                <div key={screenSide} className="absolute top-0 rounded-md border border-edge-strong bg-fill"
                  style={{ left: screenSide === 0 ? -(SIDE_STRIP_WIDTH + SIDE_STRIP_GAP) : rackWidth + SIDE_STRIP_GAP, width: SIDE_STRIP_WIDTH, height: rackHeight }}>
                  <div className="absolute -top-6 w-full text-center text-xs text-content-muted">0U · {getZeroUEarSide(devices[0])} rail</div>
                  {devices.map(device => {
                    const heightMm = zeroUHeightMm(layout, device);
                    const bottomMm = dragging?.deviceId === device.id ? (dragging.previewU - 1) * U_HEIGHT_MM : zeroUBottomMm(device);
                    const selected = selectedDeviceId === device.id;
                    const meta = getPdu0uMeta(device, layout);
                    return <div key={device.id} data-device-id={device.id} data-device-category={device.category}
                      role="button" tabIndex={0} aria-label={`${device.name}: 0U ${getZeroUEarSide(device)} rail, ${Math.round(heightMm)} mm long`}
                      className={`absolute select-none rounded border bg-surface p-2 text-content ${selected ? 'border-accent ring-2 ring-accent/40' : 'border-edge-strong'} ${layout.viewSide === 'front' && !selected ? 'opacity-60' : ''}`}
                      style={{ top: (layout.heightU * U_HEIGHT_MM - bottomMm - heightMm) / U_HEIGHT_MM * BASE_UNIT_HEIGHT,
                        height: heightMm / U_HEIGHT_MM * BASE_UNIT_HEIGHT, width: SIDE_STRIP_WIDTH }}
                      onPointerDown={event => startDeviceDrag(event, device)}
                      onClick={event => { event.stopPropagation(); selectDevice(device.id); }}
                      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectDevice(device.id); } }}
                      title={`${device.name} · ${Math.round(heightMm)} mm · ${Math.round(bottomMm)} mm above base · ${meta.used}/${meta.outlets} outlets used`}>
                      <div className="flex h-full min-h-0 flex-col gap-1 overflow-hidden">
                        <div className="truncate text-xs font-semibold">{device.label || device.name}</div>
                        <div className="text-[11px] text-content-muted">{Math.round(heightMm)} mm · 0U</div>
                        {layout.viewSide === 'front' ? <div className="text-xs text-content-muted">Behind rack</div> :
                          <div className="grid min-h-0 flex-1 gap-1" style={{ gridTemplateRows: `repeat(${Math.max(1, meta.outlets)}, minmax(0, 1fr))` }}>
                            {Array.from({ length: meta.outlets }, (_, index) => <div key={index} className="flex min-h-0 items-center justify-center gap-2 rounded-sm border border-edge-strong bg-fill-strong text-[10px] text-content-secondary"><span>{index + 1}</span><span aria-hidden="true">▮ ▮</span></div>)}
                          </div>}
                        <div className="mt-auto text-[11px] text-content-muted">{Math.round(bottomMm)} mm above base</div>
                      </div>
                    </div>;
                  })}
                </div>
              ))}

              {/* Debug overlay */}
              {debugMode && (
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 overflow-visible"
                  style={{
                    left: -(SIDE_STRIP_WIDTH + SIDE_STRIP_GAP),
                    width: rackWidth + (SIDE_STRIP_WIDTH + SIDE_STRIP_GAP) * 2,
                    height: rackHeight
                  }}
                >
                  {/* Zone boundaries */}
                  <rect
                    x={SIDE_STRIP_WIDTH + SIDE_STRIP_GAP}
                    y="0"
                    width={rackWidth}
                    height={rackHeight}
                    fill="none"
                    stroke="#22c55e"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                    opacity="0.5"
                  />
                  <text
                    x={SIDE_STRIP_WIDTH + SIDE_STRIP_GAP + rackWidth / 2}
                    y="14"
                    textAnchor="middle"
                    fill="#22c55e"
                    fontSize="10"
                    opacity="0.7"
                  >
                    {layout.viewSide === 'front' ? 'Front zone' : 'Rear zone'}
                  </text>
                  <rect
                    x="0"
                    y="0"
                    width={SIDE_STRIP_WIDTH}
                    height={rackHeight}
                    fill="none"
                    stroke="#3b82f6"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                    opacity="0.5"
                  />
                  <text
                    x={SIDE_STRIP_WIDTH / 2}
                    y="14"
                    textAnchor="middle"
                    fill="#3b82f6"
                    fontSize="10"
                    opacity="0.7"
                  >
                    Side-Left
                  </text>
                  <rect
                    x={SIDE_STRIP_WIDTH + SIDE_STRIP_GAP + rackWidth + SIDE_STRIP_GAP}
                    y="0"
                    width={SIDE_STRIP_WIDTH}
                    height={rackHeight}
                    fill="none"
                    stroke="#3b82f6"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                    opacity="0.5"
                  />
                  <text
                    x={SIDE_STRIP_WIDTH + SIDE_STRIP_GAP + rackWidth + SIDE_STRIP_GAP + SIDE_STRIP_WIDTH / 2}
                    y="14"
                    textAnchor="middle"
                    fill="#3b82f6"
                    fontSize="10"
                    opacity="0.7"
                  >
                    Side-Right
                  </text>

                  {/* Vertical rails */}
                  <line
                    x1={SIDE_STRIP_WIDTH + SIDE_STRIP_GAP}
                    y1="0"
                    x2={SIDE_STRIP_WIDTH + SIDE_STRIP_GAP}
                    y2={rackHeight}
                    stroke="#fb923c"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                    opacity="0.7"
                  />
                  <text
                    x={SIDE_STRIP_WIDTH + SIDE_STRIP_GAP + 4}
                    y={rackHeight / 2}
                    fill="#fb923c"
                    fontSize="9"
                    opacity="0.8"
                  >
                    V-rail-L
                  </text>
                  <line
                    x1={SIDE_STRIP_WIDTH + SIDE_STRIP_GAP + rackWidth}
                    y1="0"
                    x2={SIDE_STRIP_WIDTH + SIDE_STRIP_GAP + rackWidth}
                    y2={rackHeight}
                    stroke="#38bdf8"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                    opacity="0.7"
                  />
                  <text
                    x={SIDE_STRIP_WIDTH + SIDE_STRIP_GAP + rackWidth - 4}
                    y={rackHeight / 2}
                    textAnchor="end"
                    fill="#38bdf8"
                    fontSize="9"
                    opacity="0.8"
                  >
                    V-rail-R
                  </text>

                  {/* Cable node names for selected device */}
                  {(() => {
                    const device = layout.devices.find((d) => d.id === selectedDeviceId);
                    if (!device) return null;
                    const visual = deviceVisual(layout, device, rackWidth);
                    const top = device.sizeU === 0 ? 0 : (layout.heightU - (device.positionU + device.sizeU - 1)) * BASE_UNIT_HEIGHT;
                    const height = device.sizeU === 0 ? rackHeight : device.sizeU * BASE_UNIT_HEIGHT;
                    const anchorX = SIDE_STRIP_WIDTH + SIDE_STRIP_GAP + visual.left + visual.width + 6;
                    const anchorY = top + height / 2;
                    const cables = layout.cables.filter(
                      (c) => c.fromDeviceId === device.id || c.toDeviceId === device.id
                    );
                    return cables.map((cable, i) => {
                      const plan = calculateCablePlan(cable, layout);
                      const desc = pathDescription(cable, plan?.nodes ?? cable.nodes ?? [], layout, plan);
                      return (
                        <text
                          key={cable.id}
                          x={anchorX}
                          y={anchorY + i * 14}
                          fill="#67e8f9"
                          fontSize="10"
                        >
                          {cable.type}: {desc}
                        </text>
                      );
                    });
                  })()}
                </svg>
              )}

              {placementPreview && feedback && (
                <div
                  data-testid="device-placement-preview"
                  data-placement-state={!feedback.allowed ? 'blocked' : feedback.warning ? 'warning' : 'valid'}
                  data-position-u={placementPreview.positionU}
                  data-position-x={placementPreview.xMm}
                  className={`pointer-events-none absolute z-40 rounded-md border-2 border-dashed ${!feedback.allowed ? 'border-red-500 bg-red-500/25' : feedback.warning ? 'border-amber-500 bg-amber-500/20' : 'border-emerald-500 bg-emerald-500/20'}`}
                  style={{
                    top: Math.max(0, (layout.heightU - (placementPreview.positionU + placementPreview.sizeU - 1)) * BASE_UNIT_HEIGHT + 3),
                    left: ((placementPreview.xMm ?? 0) / rackUsable) * rackWidth,
                    width: Math.min(getDeviceWidthMm(placementPreview), rackUsable) / rackUsable * rackWidth,
                    height: Math.min(placementPreview.sizeU, layout.heightU) * BASE_UNIT_HEIGHT - 6,
                  }}
                />
              )}

              {sideLabelGroups.length > 0 && (
                <div
                  className="absolute top-0 z-30"
                  data-testid="rack-side-labels"
                  style={{ left: rackWidth + SIDE_LABEL_OFFSET, width: SIDE_LABEL_WIDTH, height: rackHeight }}
                >
                  {sideLabelGroups.map((group) => (
                    <div
                      key={group.key}
                      className="absolute rounded-lg border border-edge-strong bg-surface/92 p-2 shadow-panel backdrop-blur dark:border-edge-strong/80 dark:bg-surface/92"
                      data-side-label-group={group.key}
                      style={{ top: group.top, width: SIDE_LABEL_WIDTH }}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-content-muted">
                        <span>{group.uLabel}</span>
                        <span>{group.items.length} item{group.items.length > 1 ? 's' : ''}</span>
                      </div>
                      <div className="space-y-1">
                        {group.items.map(({ device }) => {
                          const selected = selectedDeviceId === device.id;
                          return (
                            <button
                              key={device.id}
                              className={`flex h-6 w-full items-center gap-2 rounded border-l-4 px-2 text-left text-xs transition ${
                                selected
                                  ? 'border-accent bg-accent-solid/15 text-accent-fg-strong dark:border-accent dark:bg-accent/15 dark:text-accent-fg-strong'
                                  : SIDE_LABEL_ITEM_CLASS
                              }`}
                              data-side-label-device={device.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                selectDevice(device.id);
                                selectCable(null);
                              }}
                              style={{ borderLeftColor: selected ? '#67e8f9' : device.color }}
                              title={`${device.name}${device.lifecycleStatus && device.lifecycleStatus !== 'active' ? ` [${device.lifecycleStatus}]` : ''}: ${device.sizeU}U at U${device.positionU}`}
                              type="button"
                            >
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: device.color }} />
                              <span className="min-w-0 flex-1 truncate font-medium">{device.label || device.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 w-44 rounded-lg border border-edge-strong bg-surface py-1 shadow-xl dark:border-edge-strong dark:bg-surface-raised"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {(() => {
              const device = layout.devices.find((d) => d.id === contextMenu.deviceId);
              if (!device) return null;
              return (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-content-muted">
                    {device.label || device.name}
                  </div>
                  <button
                    className="flex h-8 w-full items-center px-3 text-xs text-content-secondary dark:text-content hover:bg-fill-strong dark:hover:bg-fill"
                    onClick={() => {
                      moveDevice(device.id, layout.heightU - device.sizeU + 1, device.xMm);
                      setContextMenu(null);
                    }}
                    type="button"
                  >
                    Move to bottom
                  </button>
                  <button
                    className="flex h-8 w-full items-center px-3 text-xs text-content-secondary dark:text-content hover:bg-fill-strong dark:hover:bg-fill"
                    onClick={() => {
                      moveDevice(device.id, 1, device.xMm);
                      setContextMenu(null);
                    }}
                    type="button"
                  >
                    Move to top
                  </button>
                  <div className="my-1 border-t border-edge" />
                  <button
                    className="flex h-8 w-full items-center px-3 text-xs text-red-600 dark:text-red-300 hover:bg-red-500/10"
                    onClick={() => {
                      removeDevice(device.id);
                      setContextMenu(null);
                    }}
                    type="button"
                  >
                    Remove
                  </button>
                </>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
