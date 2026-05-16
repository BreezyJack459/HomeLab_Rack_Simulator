import { Bug, Move, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { DragEvent, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { deviceCatalog } from '../data/deviceCatalog';
import { useRackStore } from '../store/rackStore';
import type { DeviceCategory, PlacedDevice, PortLayout, RackLayout, RackReservation, ViewSide } from '../types/rack';
import { clampDevicePosition, clampDeviceX, getCenterOfGravityU, getDeviceMountSide, getDeviceSpatialZone, getDeviceWidthMm, getDeviceXRange, getZeroUEarSide, isZeroU, RACK_SPECS } from '../utils/rackMath';
import { getPortFaceMap, type PortSlot } from '../utils/portLayout';
import { getReservationXRange } from '../utils/reservations';
import { calculateCablePlan, pathDescription } from '../utils/routing';

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
    ethernet: 'border-cyan-500/60 bg-cyan-500/35 dark:border-cyan-200/60 dark:bg-cyan-300/35',
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

function RearFaceHint({ compact }: { compact: boolean }) {
  return (
    <div
      className={`grid shrink-0 grid-cols-3 gap-1 rounded border border-slate-400 bg-slate-200 p-1 dark:border-slate-700 dark:bg-slate-950/28 ${
        compact ? 'w-14' : 'w-20'
      }`}
      title="Rear chassis ventilation"
    >
      {Array.from({ length: compact ? 9 : 12 }, (_, index) => (
        <span key={index} className="h-1 rounded-full bg-slate-300 dark:bg-slate-400/25" />
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

export function RackEditor2D({ layoutOverride, serviceabilityOverlay = false, highlightedDeviceIds = [] }: RackEditor2DProps) {
  const rackRef = useRef<HTMLDivElement>(null);
  const storeLayout = useRackStore((state) => state.layout);
  const layout = layoutOverride ?? storeLayout;
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
  const undo = useRackStore((state) => state.undo);
  const redo = useRackStore((state) => state.redo);
  const setEditorZoom = useRackStore((state) => state.setEditorZoom);
  const setEditorPan = useRackStore((state) => state.setEditorPan);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [panMode, setPanMode] = useState(false);
  const [panning, setPanning] = useState<PanState | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [contextMenu, setContextMenu] = useState<null | { x: number; y: number; deviceId: string }>(null);
  const [resizing, setResizing] = useState<null | { deviceId: string; startY: number; originalSizeU: number; originalPositionU: number }>(null);
  const highlightedDeviceIdSet = useMemo(() => new Set(highlightedDeviceIds), [highlightedDeviceIds]);

  const rackWidth = RACK_SPECS[layout.rackType].visualWidthPx;
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
    [visibleDevices]
  );
  const visibleReservations = useMemo(
    () => (layout.reservations ?? []).filter((reservation) => reservation.mountSide === layout.viewSide),
    [layout.reservations, layout.viewSide]
  );
  const sideLeftDevices = useMemo(
    () => visibleDevices.filter((device) => isZeroU(device) && getZeroUEarSide(device) === 'left'),
    [visibleDevices]
  );
  const sideRightDevices = useMemo(
    () => visibleDevices.filter((device) => isZeroU(device) && getZeroUEarSide(device) === 'right'),
    [visibleDevices]
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

  const sideLabelGroups = useMemo(() => {
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

  function positionFromClientY(clientY: number, sizeU: number, offsetY = 0) {
    const rackRect = rackRef.current?.getBoundingClientRect();
    if (!rackRect) return 1;
    const unitHeight = rackRect.height / layout.heightU;
    const rawTop = clientY - rackRect.top - offsetY;
    const topIndex = Math.round(rawTop / unitHeight);
    // Rack positions are stored bottom-up (U1 at the bottom), while the DOM renders top-down.
    return clampDevicePosition(layout, sizeU, layout.heightU - topIndex - sizeU + 1);
  }

  function xFromClientX(clientX: number, device: Pick<PlacedDevice, 'widthType' | 'customWidthMm' | 'sizeU'>, offsetX = 0) {
    const rackRect = rackRef.current?.getBoundingClientRect();
    if (!rackRect) return 0;
    const rawLeft = clientX - rackRect.left - offsetX;
    return clampDeviceX(layout, device, (rawLeft / rackRect.width) * rackUsable);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const templateId = event.dataTransfer.getData('application/x-rack-template');
    if (!templateId) return;
    const template = deviceCatalog.find((item) => item.id === templateId);
    if (!template) return;
    const positionU = positionFromClientY(event.clientY, template.defaultU);
    const templateWidthPx = (Math.min(getDeviceWidthMm(template), rackUsable) / rackUsable) * (rackRef.current?.getBoundingClientRect().width ?? rackWidth);
    const xMm = xFromClientX(event.clientX, { widthType: template.widthType, customWidthMm: template.customWidthMm, sizeU: template.defaultU }, templateWidthPx / 2);
    addDeviceFromTemplate(templateId, positionU, xMm);
  }

  function startDeviceDrag(event: PointerEvent<HTMLDivElement>, device: PlacedDevice) {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    selectDevice(device.id);
    setDragging({
      deviceId: device.id,
      sizeU: device.sizeU,
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
      if (dragging) moveDevice(dragging.deviceId, dragging.previewU, dragging.previewX);
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

  return (
    <div className="relative h-full overflow-hidden bg-slate-200 dark:bg-slate-950/55">
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-lg border border-slate-200 bg-white/90 p-2 shadow-panel dark:border-slate-800 dark:bg-slate-950/90">
        <button
          className={EDITOR_TOOL_BUTTON_WITH_LABEL_CLASS}
          onClick={() => setEditorZoom(editorZoom - 0.1)}
          type="button"
          title="Zoom out"
        >
          <ZoomOut size={15} />
          {Math.round(editorZoom * 100)}%
        </button>
        <button
          className={EDITOR_TOOL_BUTTON_CLASS}
          onClick={() => setEditorZoom(editorZoom + 0.1)}
          type="button"
          title="Zoom in"
        >
          <ZoomIn size={15} />
        </button>
        <button
          className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm ${
            panMode
              ? 'bg-cyan-600 text-white dark:bg-cyan-400 dark:text-slate-950'
              : EDITOR_TOGGLE_INACTIVE_CLASS
          }`}
          onClick={() => setPanMode((value) => !value)}
          type="button"
          title="Toggle pan mode"
        >
          <Move size={15} />
          Pan
        </button>
        <button
          className={EDITOR_TOOL_BUTTON_CLASS}
          onClick={() => {
            setEditorZoom(1);
            setEditorPan({ x: 0, y: 0 });
          }}
          type="button"
          title="Reset view"
        >
          <RotateCcw size={15} />
        </button>
        <button
          className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm ${
            debugMode
              ? 'bg-amber-500 text-slate-950 dark:bg-amber-400 dark:text-slate-950'
              : EDITOR_TOGGLE_INACTIVE_CLASS
          }`}
          onClick={toggleDebugMode}
          type="button"
          title="Toggle debug mode"
        >
          <Bug size={15} />
          Debug
        </button>
      </div>

      <div
        className={`h-full w-full overflow-auto thin-scrollbar ${panMode || spacePressed ? 'cursor-grab' : ''}`}
        onPointerDown={(event) => {
          if (!panMode && !spacePressed) return;
          setPanning({
            startX: event.clientX,
            startY: event.clientY,
            originX: editorPan.x,
            originY: editorPan.y
          });
        }}
      >
        <div className="flex min-h-full min-w-full items-start justify-center p-24">
          <div
            className="relative"
            style={{
              transform: `translate(${editorPan.x}px, ${editorPan.y}px) scale(${editorZoom})`,
              transformOrigin: 'top center'
            }}
          >
            <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              <span>{layout.viewSide === 'front' ? 'Front' : 'Rear'} view</span>
              <span>Snap to U</span>
            </div>
            <div
              ref={rackRef}
              className="relative border-x-[16px] border-slate-400 bg-white shadow-panel dark:border-slate-700 dark:bg-slate-950"
              style={{ width: rackWidth, height: rackHeight }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
              }}
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
                    className={`absolute left-0 flex items-center border-b border-slate-200/90 dark:border-slate-800/90 ${
                      occupied ? 'bg-slate-300 dark:bg-slate-900/45' : 'bg-emerald-500/[0.035]'
                    }`}
                    style={{ top: index * BASE_UNIT_HEIGHT, height: BASE_UNIT_HEIGHT, width: '100%' }}
                  >
                    <div className="absolute -left-[58px] w-10 text-right text-xs font-medium text-slate-500 dark:text-slate-400">U{unit}</div>
                    <div className="absolute -right-[58px] w-10 text-left text-xs font-medium text-slate-500 dark:text-slate-400">U{unit}</div>
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
                const top = deviceIsZeroU ? 0 : (layout.heightU - (device.positionU + device.sizeU - 1)) * BASE_UNIT_HEIGHT;
                const height = deviceIsZeroU ? rackHeightPx : device.sizeU * BASE_UNIT_HEIGHT;
                const visual = deviceVisual(layout, device, rackWidth);
                const width = deviceIsZeroU ? Math.max(160, visual.width) : visual.width;
                const left = deviceIsZeroU && width > visual.width
                  ? visual.left - (width - visual.width) / 2
                  : visual.left;
                const selected = selectedDeviceId === device.id;
                const compact = !deviceIsZeroU && height <= 42;
                const visiblePorts = portsForView(device.ports, layout.viewSide, device.category, device.portFaceOverrides, isZeroU(device));
                const hasVisiblePorts = portItems(visiblePorts).length > 0;
                const useSidePorts = compact && hasVisiblePorts && width < COMPACT_SIDE_PORT_MIN_WIDTH;
                const highlighted = highlightedDeviceIdSet.has(device.id);
                return (
                  <div
                    key={device.id}
                    data-device-id={device.id}
                    data-device-category={device.category}
                    data-zero-u={deviceIsZeroU}
                    className={`absolute select-none rounded-md border px-3 shadow-lg transition ${compact ? 'py-1' : 'py-2'} ${
                      selected ? 'border-cyan-500 dark:border-cyan-300 ring-2 ring-cyan-500/40 dark:ring-cyan-500/40 dark:ring-cyan-300/40' : 'border-black/10 dark:border-black/10 dark:border-white/20 hover:border-cyan-500/70 dark:hover:border-cyan-500/70 dark:hover:border-cyan-300/70'
                    } ${dragging?.deviceId === device.id ? 'opacity-55' : device.lifecycleStatus === 'planned' ? 'opacity-60' : device.lifecycleStatus === 'decommissioning' ? 'opacity-50' : ''}`}
                    style={{
                      top: top + 3,
                      left,
                      width,
                      height: height - 6,
                      background:
                        device.category === 'printed-mount'
                          ? `repeating-linear-gradient(45deg, ${device.color}, ${device.color} 8px, rgba(15, 23, 42, 0.85) 8px, rgba(15, 23, 42, 0.85) 16px)`
                          : layout.viewSide === 'rear'
                            ? `linear-gradient(135deg, rgba(15, 23, 42, 0.98), ${device.color}88)`
                            : `linear-gradient(135deg, ${device.color}, rgba(15, 23, 42, 0.96))`,
                      zIndex: deviceIsZeroU ? 5 : undefined,
                      borderStyle: device.lifecycleStatus === 'planned' ? 'dashed' : device.category === 'printed-mount' ? 'dashed' : undefined,
                      filter: device.lifecycleStatus === 'decommissioning' ? 'grayscale(0.6)' : undefined,
                      ...serviceabilityDeviceStyle(serviceabilityOverlay, highlighted),
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
                    title={`${device.name}${device.lifecycleStatus && device.lifecycleStatus !== 'active' ? ` [${device.lifecycleStatus}]` : ''}: ${layout.viewSide} view, ${deviceIsZeroU ? '0U (side)' : `${device.sizeU}U at U${device.positionU}`}`}
                  >
                    {selected && !deviceIsZeroU && (
                      <div
                        className="absolute bottom-0 left-1/2 z-10 h-1.5 w-8 -translate-x-1/2 translate-y-1/2 cursor-ns-resize rounded-full border border-slate-500 dark:border-slate-600 bg-slate-400 dark:bg-slate-600 hover:bg-cyan-500 dark:hover:bg-cyan-300"
                        onPointerDown={(event) => startResize(event, device)}
                      />
                    )}
                    <div
                      className={`flex h-full min-h-0 gap-2 overflow-hidden ${
                        useSidePorts ? 'flex-row items-center justify-between' : compact ? 'flex-col justify-center' : 'flex-col justify-between'
                      }`}
                    >
                      <div className={`min-w-0 ${useSidePorts ? 'flex-1' : ''}`}>
                        <div className={`rd-n truncate font-semibold ${compact ? 'text-xs leading-4' : 'text-sm'}`}>
                          {device.label || device.name}
                        </div>
                        {compact && layout.viewSide === 'rear' && (
                          <div className="truncate text-[9px] font-medium uppercase tracking-[0.12em] text-slate-500/70 dark:text-slate-200/70">rear side</div>
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
                      {useSidePorts ? (
                        <div className="ml-auto w-[46%] min-w-[76px] shrink-0">
                          <PortStrip ports={visiblePorts} compact />
                        </div>
                      ) : (
                        <PortStrip ports={visiblePorts} compact={compact} />
                      )}
                      {layout.viewSide === 'rear' && !hasVisiblePorts && <RearFaceHint compact={compact} />}
                      {layout.viewSide === 'rear' && !compact && <RearFaceHint compact={false} />}
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
                                <span key={portType} className="text-[9px] font-medium text-cyan-600/90 dark:text-cyan-700/90 dark:text-cyan-700 dark:text-cyan-200/90">
                                  {portType} {used}/{count}
                                </span>
                              );
                            })}
                        </div>
                      )}
                      {selected && (
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                          {getDeviceSpeedBreakdown(device).map(({ speed, count }) => (
                            <span key={speed} className="rounded bg-slate-100 px-1 text-[9px] font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
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
                        <span className="absolute left-1 top-1 text-[9px] font-medium text-slate-500 dark:text-white/40">Front</span>
                        <span className="absolute right-1 top-1 text-[9px] font-medium text-slate-500 dark:text-white/40">Rear</span>
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

              {/* Left 0U rear/side rail */}
              {sideLeftDevices.length > 0 && (
                <div
                  className="absolute top-0 rounded-md border border-cyan-500/30 bg-slate-200 shadow-[0_0_30px_rgba(14,165,233,0.12)] dark:bg-slate-950/85"
                  style={{ left: -(SIDE_STRIP_WIDTH + SIDE_STRIP_GAP), width: SIDE_STRIP_WIDTH, height: rackHeight }}
                >
                  <div className="pointer-events-none absolute inset-1 rounded border border-dashed border-cyan-500/20 dark:border-cyan-300/20" />
                  <div className="pointer-events-none absolute -top-6 left-0 right-0 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-600/75 dark:text-cyan-200/75">
                    0U left rail
                  </div>
                  {sideLeftDevices.map((device) => {
                    const selected = selectedDeviceId === device.id;
                    const highlighted = highlightedDeviceIdSet.has(device.id);
                    return (
                      <div
                        key={device.id}
                        data-device-id={device.id}
                        data-device-category={device.category}
                        className={`absolute select-none rounded-md border px-2 shadow-lg transition ${
                          selected ? 'border-cyan-500 dark:border-cyan-300 ring-2 ring-cyan-500/40 dark:ring-cyan-500/40 dark:ring-cyan-300/40' : 'border-black/10 dark:border-black/10 dark:border-white/20 hover:border-cyan-500/70 dark:hover:border-cyan-500/70 dark:hover:border-cyan-300/70'
                        } ${dragging?.deviceId === device.id ? 'opacity-55' : device.lifecycleStatus === 'planned' ? 'opacity-60' : device.lifecycleStatus === 'decommissioning' ? 'opacity-50' : ''}`}
                        style={{
                          top: 3,
                          left: 0,
                          width: SIDE_STRIP_WIDTH,
                          height: rackHeight - 6,
                          background: `linear-gradient(135deg, ${device.color}, rgba(15, 23, 42, 0.96))`,
                          borderStyle: device.lifecycleStatus === 'planned' ? 'dashed' : undefined,
                          filter: device.lifecycleStatus === 'decommissioning' ? 'grayscale(0.6)' : undefined,
                          ...serviceabilityDeviceStyle(serviceabilityOverlay, highlighted),
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
                        title={`${device.name}${device.lifecycleStatus && device.lifecycleStatus !== 'active' ? ` [${device.lifecycleStatus}]` : ''}: 0U ${device.mountType ?? 'rear-rail'} (left rail)`}
                      >
                        <div className="flex h-full flex-col justify-between overflow-hidden py-1">
                          <div className="min-w-0">
                            <div className="rd-n truncate text-xs font-semibold">{device.label || device.name}</div>
                            {device.category === 'pdu-0u' ? (() => {
                              const meta = getPdu0uMeta(device, layout);
                              return (
                                <>
                                  <div className="rd-m truncate text-[10px]">
                                    {meta.used}/{meta.outlets} outlets · {meta.powerBudget}W
                                  </div>
                                  <div className="rd-mm truncate text-[9px] font-medium uppercase tracking-[0.1em]">
                                    Feed {meta.feed} · {device.mountType ?? '0U rail'}
                                  </div>
                                </>
                              );
                            })() : (
                              <div className="rd-m truncate text-[10px]">0U rail / {device.powerW}W</div>
                            )}
                          </div>
                          <PortStrip ports={portsForView(device.ports, layout.viewSide, device.category, device.portFaceOverrides, true)} compact={false} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Right 0U rear/side rail */}
              {sideRightDevices.length > 0 && (
                <div
                  className="absolute top-0 rounded-md border border-cyan-500/30 bg-slate-200 shadow-[0_0_30px_rgba(14,165,233,0.12)] dark:bg-slate-950/85"
                  style={{ right: -(SIDE_STRIP_WIDTH + SIDE_STRIP_GAP), width: SIDE_STRIP_WIDTH, height: rackHeight }}
                >
                  <div className="pointer-events-none absolute inset-1 rounded border border-dashed border-cyan-500/20 dark:border-cyan-300/20" />
                  <div className="pointer-events-none absolute -top-6 left-0 right-0 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-600/75 dark:text-cyan-200/75">
                    0U right rail
                  </div>
                  {sideRightDevices.map((device) => {
                    const selected = selectedDeviceId === device.id;
                    const highlighted = highlightedDeviceIdSet.has(device.id);
                    return (
                      <div
                        key={device.id}
                        data-device-id={device.id}
                        data-device-category={device.category}
                        className={`absolute select-none rounded-md border px-2 shadow-lg transition ${
                          selected ? 'border-cyan-500 dark:border-cyan-300 ring-2 ring-cyan-500/40 dark:ring-cyan-500/40 dark:ring-cyan-300/40' : 'border-black/10 dark:border-black/10 dark:border-white/20 hover:border-cyan-500/70 dark:hover:border-cyan-500/70 dark:hover:border-cyan-300/70'
                        } ${dragging?.deviceId === device.id ? 'opacity-55' : device.lifecycleStatus === 'planned' ? 'opacity-60' : device.lifecycleStatus === 'decommissioning' ? 'opacity-50' : ''}`}
                        style={{
                          top: 3,
                          left: 0,
                          width: SIDE_STRIP_WIDTH,
                          height: rackHeight - 6,
                          background: `linear-gradient(135deg, ${device.color}, rgba(15, 23, 42, 0.96))`,
                          borderStyle: device.lifecycleStatus === 'planned' ? 'dashed' : undefined,
                          filter: device.lifecycleStatus === 'decommissioning' ? 'grayscale(0.6)' : undefined,
                          ...serviceabilityDeviceStyle(serviceabilityOverlay, highlighted),
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
                        title={`${device.name}${device.lifecycleStatus && device.lifecycleStatus !== 'active' ? ` [${device.lifecycleStatus}]` : ''}: 0U ${device.mountType ?? 'rear-rail'} (right rail)`}
                      >
                        <div className="flex h-full flex-col justify-between overflow-hidden py-1">
                          <div className="min-w-0">
                            <div className="rd-n truncate text-xs font-semibold">{device.label || device.name}</div>
                            {device.category === 'pdu-0u' ? (() => {
                              const meta = getPdu0uMeta(device, layout);
                              return (
                                <>
                                  <div className="rd-m truncate text-[10px]">
                                    {meta.used}/{meta.outlets} outlets · {meta.powerBudget}W
                                  </div>
                                  <div className="rd-mm truncate text-[9px] font-medium uppercase tracking-[0.1em]">
                                    Feed {meta.feed} · {device.mountType ?? '0U rail'}
                                  </div>
                                </>
                              );
                            })() : (
                              <div className="rd-m truncate text-[10px]">0U rail / {device.powerW}W</div>
                            )}
                          </div>
                          <PortStrip ports={portsForView(device.ports, layout.viewSide, device.category, device.portFaceOverrides, true)} compact={false} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

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

              {dragging && (
                <div
                  className="pointer-events-none absolute rounded-md border-2 border-dashed border-cyan-500 dark:border-cyan-300 bg-cyan-500/10 dark:bg-cyan-300/10"
                  style={{
                    top: (layout.heightU - (dragging.previewU + dragging.sizeU - 1)) * BASE_UNIT_HEIGHT + 3,
                    left: (dragging.previewX / rackUsable) * rackWidth,
                    width:
                      (Math.min(
                        getDeviceWidthMm(layout.devices.find((device) => device.id === dragging.deviceId) ?? { widthType: layout.rackType, customWidthMm: undefined }),
                        rackUsable
                      ) /
                        rackUsable) *
                      rackWidth,
                    height: dragging.sizeU * BASE_UNIT_HEIGHT - 6
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
                      className="absolute rounded-lg border border-slate-300 bg-white/92 p-2 shadow-panel backdrop-blur dark:border-slate-700/80 dark:bg-slate-950/92"
                      data-side-label-group={group.key}
                      style={{ top: group.top, width: SIDE_LABEL_WIDTH }}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
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
                                  ? 'border-cyan-500 bg-cyan-500/15 text-cyan-900 dark:border-cyan-300 dark:bg-cyan-300/15 dark:text-cyan-50'
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
            className="fixed z-50 w-44 rounded-lg border border-slate-300 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {(() => {
              const device = layout.devices.find((d) => d.id === contextMenu.deviceId);
              if (!device) return null;
              return (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {device.label || device.name}
                  </div>
                  <button
                    className="flex h-8 w-full items-center px-3 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800"
                    onClick={() => {
                      moveDevice(device.id, layout.heightU - device.sizeU + 1, device.xMm);
                      setContextMenu(null);
                    }}
                    type="button"
                  >
                    Move to bottom
                  </button>
                  <button
                    className="flex h-8 w-full items-center px-3 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800"
                    onClick={() => {
                      moveDevice(device.id, 1, device.xMm);
                      setContextMenu(null);
                    }}
                    type="button"
                  >
                    Move to top
                  </button>
                  <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
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
