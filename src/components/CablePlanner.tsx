import {
  Cable,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Link2,
  MousePointer2,
  RotateCcw,
  Trash2,
  X
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { CableRoute, CableType, LifecycleStatus, PlacedDevice, PortRef, PortType, RackLayout } from '../types/rack';
import { getCableDisplayColor } from '../utils/cableColors';
import { calculateCablePlan, estimateCableLength, getCableSlackBudget, pathDescription } from '../utils/routing';
import { formatCableLength, getDeviceXRange, RACK_SPECS } from '../utils/rackMath';
import { exportBomCsv, exportBomText } from '../utils/exporters';
import { getPatchPanelLinkedCableIds, patchPanelRouteLabel } from '../utils/patchPanel';
import {
  autoResolveCable,
  getFreePortSummary,
  getNextFreePort,
  getUsedPorts,
  inferCableType,
  isPortUsed,
  portChoicesForDevice,
  portKey,
  portOptionsForDevice,
  portTypeForCableType,
  resolveCompatibleCable,
  type FreePortSummary,
  type PortFace,
  type PortOption,
  type PortChoice
} from '../utils/portSelection';

const mutedCableColor = '#64748b';

// PairingStage, PairingSource, isSelectingSource, isSelectingDest — now in shared types
import type { PairingSource, PairingStage, PortHit3D } from '../types/pairing';
import { isSelectingDest, isSelectingSource } from '../types/pairing';





function portLabel(route: { type: CableType; fromPort?: PortRef; toPort?: PortRef }) {
  const parts: string[] = [];
  if (route.fromPort) {
    const side = route.fromPort.side ? `(${route.fromPort.side})` : '';
    parts.push(`${route.fromPort.type} ${route.fromPort.index + 1}${side}`);
  }
  if (route.toPort) {
    const side = route.toPort.side ? `(${route.toPort.side})` : '';
    parts.push(`-> ${route.toPort.type} ${route.toPort.index + 1}${side}`);
  }
  return parts.length ? parts.join(' ') : undefined;
}

// Port type badge labels for DeviceListPicker
const PORT_BADGE_LABEL: Partial<Record<PortType, string>> = {
  ethernet: 'eth',
  power: 'pwr',
  fiber: 'fib',
  usb: 'usb',
  hdmi: 'hdmi',
  atx: 'atx',
  coax: 'coax'
};

function DeviceListPicker({
  layout,
  expandedDeviceId,
  source,
  stage,
  onDeviceClick,
  onAutoConnect,
  onHoverDevice
}: {
  layout: RackLayout;
  expandedDeviceId: string | null;
  source: PairingSource | null;
  stage: PairingStage;
  onDeviceClick: (deviceId: string) => void;
  onAutoConnect: (deviceId: string) => void;
  onHoverDevice: (deviceId: string | null) => void;
}) {
  const activeDevices = layout.devices
    .filter((d) => d.category !== 'blank')
    .sort((a, b) => a.positionU - b.positionU);

  if (!activeDevices.length) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 bg-slate-100/60 p-3 text-center text-[11px] text-slate-400 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400 dark:text-slate-500">
        No devices in rack.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:border-slate-800 dark:text-slate-400 dark:text-slate-500">
        <span>Select device</span>
        <span>{activeDevices.length} devices</span>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {activeDevices.map((device) => {
          const freeSummary = getFreePortSummary(device, layout);
          const hasFree = freeSummary.length > 0;
          const isExpanded = expandedDeviceId === device.id;
          const isSource = source?.deviceId === device.id;
          const isDisabledRow = isSelectingDest(stage) && isSource;

          // In destination stage: only highlight devices compatible with source
          const sourceDevice = source ? layout.devices.find((d) => d.id === source.deviceId) : null;
          const inferredType = sourceDevice ? inferCableType(sourceDevice, device) : null;
          const hasCompatiblePort = isSelectingDest(stage)
            ? !!inferredType && !!getNextFreePort(device, inferredType, layout)
            : hasFree;

          const rowDisabled = isDisabledRow || !hasCompatiblePort;

          return (
            <div key={device.id} className="border-b border-slate-200/60 last:border-0 dark:border-slate-800/60">
              {/* Device row — click to auto-connect, hover for ghost preview */}
              <div
                className="flex items-center gap-2 px-3 py-2"
                onMouseEnter={() => !rowDisabled && onHoverDevice(device.id)}
                onMouseLeave={() => onHoverDevice(null)}
              >
                {/* Color dot */}
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: device.color ?? '#64748b' }}
                />

                {/* Main click area: auto-assign */}
                <button
                  type="button"
                  disabled={rowDisabled}
                  onClick={() => onAutoConnect(device.id)}
                  className={`min-w-0 flex-1 text-left ${
                    isSource
                      ? 'cursor-default'
                      : rowDisabled
                        ? 'cursor-not-allowed opacity-35'
                        : 'cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-200'
                  }`}
                >
                  <span className={`block truncate text-[13px] font-medium ${
                    isSource ? 'text-cyan-600 dark:text-cyan-300' : rowDisabled ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'
                  }`}>
                    {isSource && <span className="mr-1 text-cyan-400">●</span>}
                    {device.label || device.name}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    U{device.positionU}
                    {device.sizeU > 0 ? `–${device.positionU + device.sizeU - 1}` : ' (0U)'}
                  </span>
                </button>

                {/* Free port badges */}
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {freeSummary.map((s) => (
                    <span
                      key={s.type}
                      className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase ${
                        isSelectingDest(stage) && inferredType && portTypeForCableType(inferredType) === s.type
                          ? 'bg-cyan-500/20 text-cyan-600 dark:bg-cyan-400/20 dark:text-cyan-300'
                          : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {PORT_BADGE_LABEL[s.type] ?? s.type} ×{s.free}
                    </span>
                  ))}
                </div>

                {/* Expand toggle for manual port pick */}
                {hasFree && !isDisabledRow && (
                  <button
                    type="button"
                    onClick={() => onDeviceClick(device.id)}
                    className="shrink-0 rounded p-0.5 text-slate-400 dark:text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                    title="Manual port selection"
                    aria-expanded={isExpanded}
                  >
                    <ChevronRight
                      size={13}
                      className={`transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                    />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DeviceFaceCard({
  device,
  layout,
  source,
  stage,
  hoveredChoiceKey,
  deviceMap,
  onHoverChoice,
  onSelectChoice
}: {
  device: PlacedDevice;
  layout: RackLayout;
  source: PairingSource | null;
  stage: PairingStage;
  hoveredChoiceKey: string | null;
  deviceMap: Map<string, PlacedDevice>;
  onHoverChoice: (choice: PortChoice | null) => void;
  onSelectChoice: (choice: PortChoice) => void;
}) {
  const choices = portChoicesForDevice(device, layout);
  const faces: PortFace[] = ['front', 'rear'];

  if (!choices.length) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 bg-slate-100/60 p-3 text-center text-[11px] text-slate-400 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400 dark:text-slate-500">
        No selectable ports on this device.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{device.name}</div>
          <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">U{device.positionU} / click a visual port</div>
        </div>
        <MousePointer2 size={15} className="mt-0.5 text-cyan-600 dark:text-cyan-300" />
      </div>

      <div className="space-y-3">
        {faces.map((face) => {
          const faceChoices = choices.filter((choice) => (choice.side ?? 'rear') === face);
          if (!faceChoices.length) return null;
          const grouped = faceChoices.reduce<Record<string, PortChoice[]>>((acc, choice) => {
            acc[choice.type] = acc[choice.type] ?? [];
            acc[choice.type].push(choice);
            return acc;
          }, {});

          return (
            <div key={face} className="rounded border border-slate-200 bg-gradient-to-b from-slate-200 to-slate-100 p-2 dark:border-slate-800 dark:from-slate-800 dark:to-slate-950">
              <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                <span>{face} face</span>
                <span>{faceChoices.filter((choice) => !choice.disabled).length} free</span>
              </div>
              <div className="space-y-2">
                {Object.entries(grouped).map(([type, group]) => (
                  <div key={`${face}-${type}`}>
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">{type}</div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {group.map((choice) => {
                        const key = portKey(choice);
                        const isSource = source?.deviceId === choice.deviceId && portKey(source.port) === key;
                        const compatibility = isSelectingDest(stage)
                          ? resolveCompatibleCable(layout, source, choice, deviceMap)
                          : null;
                        const disabled = isSelectingDest(stage)
                          ? !compatibility
                          : choice.disabled;
                        const highlighted = hoveredChoiceKey === key || isSource;

                        return (
                          <button
                            key={key}
                            type="button"
                            disabled={disabled}
                            onMouseEnter={() => onHoverChoice(choice)}
                            onMouseLeave={() => onHoverChoice(null)}
                            onFocus={() => onHoverChoice(choice)}
                            onBlur={() => onHoverChoice(null)}
                            onClick={() => onSelectChoice(choice)}
                            className={`flex h-7 min-w-0 flex-col items-center justify-center rounded-[4px] border text-[10px] font-bold leading-none transition ${
                              isSource
                                ? 'border-cyan-700 bg-cyan-500 text-white ring-2 ring-cyan-500/40 dark:border-cyan-100 dark:bg-cyan-300 dark:text-slate-950 dark:ring-cyan-300/40'
                                : disabled
                                  ? 'cursor-not-allowed border-slate-200 bg-slate-100/60 text-slate-400 line-through dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-600'
                                  : highlighted
                                    ? 'scale-105 border-cyan-300 bg-cyan-300/15 text-cyan-800 dark:text-cyan-50'
                                    : 'border-black/20 bg-slate-100 text-slate-800 hover:scale-105 hover:border-cyan-500 hover:bg-cyan-500/10 dark:border-white/40 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-cyan-300 dark:hover:bg-cyan-300/10'
                            }`}
                            title={`${choice.label}${choice.speed ? ` • ${choice.speed}${choice.mediaType && choice.mediaType !== 'rj45' ? ` ${choice.mediaType}` : ''}` : ''}`}
                          >
                            <span>{choice.index + 1}</span>
                            {choice.speed && (
                              <span className="text-[7px] font-medium opacity-80">
                                {choice.speed}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PairingStatusBar({
  source,
  hoverCable,
  ghostPreview,
  onCancel,
  onStartOver
}: {
  source: PairingSource | null;
  hoverCable: CableRoute | null;
  ghostPreview: boolean;
  onCancel: () => void;
  onStartOver: () => void;
}) {
  if (!source) return null;

  return (
    <div className="sticky bottom-2 z-10 rounded-md border border-cyan-400/50 bg-white/95 dark:bg-slate-950/95 p-3 shadow-xl shadow-black/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-cyan-800 dark:text-cyan-50">
            {source.port.type} {source.port.index + 1} ({source.deviceName}) -&gt; ?
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Pick a highlighted compatible destination port.
          </div>
          {ghostPreview && hoverCable && (
            <div className="mt-2 rounded border border-dashed border-cyan-400/40 bg-cyan-400/5 px-2 py-1 text-[11px] text-cyan-800 dark:text-cyan-100">
              Ghost preview: {hoverCable.type} route / {hoverCable.fromPort?.type} {hoverCable.fromPort ? hoverCable.fromPort.index + 1 : ''}
              {' -> '}
              {hoverCable.toPort?.type} {hoverCable.toPort ? hoverCable.toPort.index + 1 : ''}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onStartOver}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Pick a different source"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Cancel cabling"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function portRefFromChoice(choice: PortChoice): PortRef {
  return { type: choice.type, index: choice.index, side: choice.side };
}

export function CablePlanner() {
  const layout = useRackStore((state) => state.layout);
  const addCable = useRackStore((state) => state.addCable);
  const removeCable = useRackStore((state) => state.removeCable);
  const updateCable = useRackStore((state) => state.updateCable);
  const selectCable = useRackStore((state) => state.selectCable);
  const selectedCableId = useRackStore((state) => state.selectedCableId);
  const setPreviewCable = useRackStore((state) => state.setPreviewCable);
  const setPairingStage = useRackStore((state) => state.setPairingStage);
  const setPairingSource = useRackStore((state) => state.setPairingSource);
  const registerPortPick3D = useRackStore((state) => state.registerPortPick3D);
  const [isOpen, setIsOpen] = useState(true);
  const [stage, setStage] = useState<PairingStage>('idle');
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null);
  const [source, setSource] = useState<PairingSource | null>(null);
  const [hoveredChoice, setHoveredChoice] = useState<PortChoice | null>(null);
  const [hoveredDeviceId, setHoveredDeviceId] = useState<string | null>(null);
  const [ghostPreview, setGhostPreview] = useState(false);
  const [lastSourceDeviceId, setLastSourceDeviceId] = useState<string | null>(null);
  const [cableFilter, setCableFilter] = useState('');
  const [cableTypeFilter, setCableTypeFilter] = useState<CableType | 'all'>('all');
  const [expandedCableGroups, setExpandedCableGroups] = useState<Record<string, boolean>>({});

  const deviceMap = useMemo(() => {
    const map = new Map<string, PlacedDevice>();
    for (const d of layout.devices) map.set(d.id, d);
    return map;
  }, [layout.devices]);

  const selectedCableIds = useMemo(
    () => getPatchPanelLinkedCableIds(layout, selectedCableId),
    [layout, selectedCableId]
  );

  const expandedDevice = layout.devices.find((device) => device.id === expandedDeviceId);
  const hoveredChoiceKey = hoveredChoice ? portKey(hoveredChoice) : null;

  // Ghost preview: fires for both manual port hover (hoveredChoice) and device-row hover (hoveredDeviceId)
  const hoverCable = useMemo(() => {
    if (!ghostPreview || !source) return null;

    // Manual port-level hover (DeviceFaceCard)
    if (hoveredChoice) {
      const compatible = resolveCompatibleCable(layout, source, hoveredChoice, deviceMap);
      if (!compatible) return null;
      return {
        id: 'ghost-cable',
        fromDeviceId: source.deviceId,
        fromPort: source.port,
        toDeviceId: hoveredChoice.deviceId,
        toPort: portRefFromChoice(hoveredChoice),
        type: compatible.cableType,
        color: compatible.color
      } satisfies CableRoute;
    }

    // Device-row hover (DeviceListPicker) — auto-resolve both ports
    if (hoveredDeviceId && isSelectingDest(stage)) {
      const sourceDevice = layout.devices.find((d) => d.id === source.deviceId);
      const destDevice = layout.devices.find((d) => d.id === hoveredDeviceId);
      if (!sourceDevice || !destDevice || hoveredDeviceId === source.deviceId) return null;
      const resolved = autoResolveCable(sourceDevice, destDevice, layout);
      if (!resolved) return null;
      return {
        id: 'ghost-cable',
        fromDeviceId: source.deviceId,
        fromPort: resolved.fromPort,
        toDeviceId: hoveredDeviceId,
        toPort: resolved.toPort,
        type: resolved.cableType,
        color: resolved.color
      } satisfies CableRoute;
    }

    return null;
  }, [ghostPreview, hoveredChoice, hoveredDeviceId, layout, source, stage]);

  // Filtered + grouped cables for the compact list view
  const filteredCables = useMemo(() => {
    const q = cableFilter.trim().toLowerCase();
    return layout.cables.filter((route) => {
      if (cableTypeFilter !== 'all' && route.type !== cableTypeFilter) return false;
      if (!q) return true;
      const from = deviceMap.get(route.fromDeviceId);
      const to = deviceMap.get(route.toDeviceId);
      return (
        (from?.name.toLowerCase().includes(q) ?? false) ||
        (to?.name.toLowerCase().includes(q) ?? false) ||
        route.type.toLowerCase().includes(q)
      );
    });
  }, [layout.cables, cableTypeFilter, cableFilter, deviceMap]);

  // Sync ghost preview cable into store so CableViewer3D can render it as a 3D tube
  useEffect(() => {
    setPreviewCable(ghostPreview ? (hoverCable ?? null) : null);
    return () => { setPreviewCable(null); };
  }, [hoverCable, ghostPreview, setPreviewCable]);

  // Mirror local pairing stage → store so CableViewer3D can read it
  useEffect(() => { setPairingStage(stage); }, [stage, setPairingStage]);
  useEffect(() => { setPairingSource(source); }, [source, setPairingSource]);

  // Register 3D port pick handler — translates PortHit3D → existing 2D flow
  useEffect(() => {
    registerPortPick3D((hit: PortHit3D) => {
      const device = layout.devices.find((d) => d.id === hit.deviceId);
      if (!device) return;
      // Try to find exact port match first; fall back to auto-connect on device
      const choices = portChoicesForDevice(device, layout);
      const match = choices.find(
        (c) => c.type === hit.portType && c.index === hit.portIndex
      );
      if (match) {
        // Directly invoke the same handler used by DeviceFaceCard manual pick
        const chosen: PortChoice = { ...match, deviceId: device.id, deviceName: device.name, cableTypes: match.cableTypes ?? [] };
        handleSelectChoice(chosen);
      }
    });
    return () => { registerPortPick3D(null); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, stage, source]);

  function startPairing(deviceId?: string | null) {
    setStage('selecting_source_device');
    setSource(null);
    setHoveredChoice(null);
    setHoveredDeviceId(null);
    setExpandedDeviceId(deviceId ?? lastSourceDeviceId ?? layout.devices.find((device) => portChoicesForDevice(device, layout).length > 0)?.id ?? null);
  }

  function cancelPairing() {
    setStage('idle');
    setSource(null);
    setHoveredChoice(null);
    setHoveredDeviceId(null);
    setPreviewCable(null);
  }

  function handleDeviceClick(deviceId: string) {
    setExpandedDeviceId((current) => (current === deviceId ? null : deviceId));
  }

  // Auto-connect: click a device row to pick next free port automatically
  function handleAutoConnect(deviceId: string) {
    const device = layout.devices.find((d) => d.id === deviceId);
    if (!device) return;

    // SOURCE stage: auto-pick next free port on source device
    if (!isSelectingDest(stage)) {
      const allTypes: CableType[] = ['ethernet', 'patch', 'structured', 'power', 'fiber', 'usb', 'hdmi', 'atx', 'coax'];
      let picked: { port: ReturnType<typeof getNextFreePort>; cableType: CableType } | null = null;
      for (const ct of allTypes) {
        const port = getNextFreePort(device, ct, layout);
        if (port) { picked = { port, cableType: ct }; break; }
      }
      if (!picked?.port) return;
      setSource({
        deviceId: device.id,
        deviceName: device.name,
        port: { type: portTypeForCableType(picked.cableType), index: picked.port.index, side: picked.port.side },
        label: picked.port.label
      });
      setLastSourceDeviceId(device.id);
      setStage('selecting_dest_device');
      setHoveredChoice(null);
      setHoveredDeviceId(null);
      return;
    }

    // DESTINATION stage: auto-resolve full cable with source
    if (!source) return;
    const sourceDevice = layout.devices.find((d) => d.id === source.deviceId);
    if (!sourceDevice) return;
    const resolved = autoResolveCable(sourceDevice, device, layout);
    if (!resolved) return;

    addCable({
      fromDeviceId: source.deviceId,
      fromPort: resolved.fromPort,
      toDeviceId: device.id,
      toPort: resolved.toPort,
      type: resolved.cableType,
      color: resolved.color
    });
    setLastSourceDeviceId(source.deviceId);
    setSource(null);
    setHoveredChoice(null);
    setHoveredDeviceId(null);
    setPreviewCable(null);
    setStage('idle');
  }

  function handleSelectChoice(choice: PortChoice) {
    // Manual port pick from DeviceFaceCard
    if (!isSelectingDest(stage)) {
      // Picking a manual source port (from expanded DeviceFaceCard in source stage)
      if (choice.disabled) return;
      setSource({
        deviceId: choice.deviceId,
        deviceName: choice.deviceName,
        port: portRefFromChoice(choice),
        label: choice.label
      });
      setLastSourceDeviceId(choice.deviceId);
      setStage('selecting_dest_device');
      setHoveredChoice(null);
      setHoveredDeviceId(null);
      return;
    }

    // Manual destination port pick
    const compatible = resolveCompatibleCable(layout, source, choice, deviceMap);
    if (!source || !compatible) return;

    addCable({
      fromDeviceId: source.deviceId,
      fromPort: source.port,
      toDeviceId: choice.deviceId,
      toPort: portRefFromChoice(choice),
      type: compatible.cableType,
      color: compatible.color
    });
    setLastSourceDeviceId(source.deviceId);
    setSource(null);
    setHoveredChoice(null);
    setHoveredDeviceId(null);
    setPreviewCable(null);
    setStage('idle');
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-100/78 p-3.5 dark:border-slate-800 dark:bg-slate-900/78">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="mb-2.5 flex w-full items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <div className="flex items-center gap-2">
          <Cable size={15} />
          Cables
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">{layout.cables.length} routes</span>
          <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
        </div>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden space-y-3">
          <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-white/80 to-white/40 p-3 shadow-sm dark:from-cyan-500/10 dark:via-slate-950/70 dark:to-slate-950/50">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
                  Cable flow
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                  {stage === 'idle'
                    ? 'Start a new cable route'
                    : isSelectingDest(stage)
                      ? 'Pick a destination port'
                      : 'Pick a source port'}
                </div>
                <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                  Quick connect for speed, or expand a device to pick an exact port face.
                </p>
              </div>
              <div className="shrink-0 rounded-full border border-slate-200 bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400">
                {stage === 'idle' ? 'Ready' : isSelectingDest(stage) ? 'Step 2' : 'Step 1'}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl bg-cyan-500 text-sm font-semibold text-white shadow-lg shadow-cyan-500/15 hover:bg-cyan-400 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300"
                onClick={() => startPairing()}
                type="button"
              >
                <Link2 size={15} />
                {stage === 'idle' ? 'Add cable' : isSelectingDest(stage) ? 'Pick destination' : 'Pick source'}
              </button>
              {lastSourceDeviceId && stage === 'idle' && (
                <button
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl border border-slate-300 bg-white/80 px-3 text-xs font-medium text-slate-600 shadow-sm hover:bg-white dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:bg-slate-900"
                  onClick={() => startPairing(lastSourceDeviceId)}
                  type="button"
                >
                  <RotateCcw size={13} />
                  Same device
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/70">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  Quick pick
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                  Devices with free compatible ports
                </div>
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                {layout.devices.filter((d) => d.category !== 'blank').length} devices
              </div>
            </div>
            <DeviceListPicker
              layout={layout}
              expandedDeviceId={expandedDeviceId}
              source={source}
              stage={stage}
              onDeviceClick={handleDeviceClick}
              onAutoConnect={handleAutoConnect}
              onHoverDevice={setHoveredDeviceId}
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/70">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Ghost preview</div>
              <div className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">Show a provisional route before you commit.</div>
            </div>
            <button
              type="button"
              onClick={() => setGhostPreview((value) => !value)}
              className={`relative h-6 w-11 rounded-full border transition ${
                ghostPreview ? 'border-cyan-500 bg-cyan-500/30 dark:border-cyan-300 dark:bg-cyan-400/30' : 'border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-900'
              }`}
              aria-pressed={ghostPreview}
            >
              <span
                className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white transition ${ghostPreview ? 'left-5' : 'left-0.5'}`}
                style={{ width: 18, height: 18 }}
              />
            </button>
          </div>

          {expandedDevice && (
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                Exact port picker
              </div>
              <DeviceFaceCard
                device={expandedDevice}
                layout={layout}
                source={source}
                stage={stage}
                hoveredChoiceKey={hoveredChoiceKey}
                deviceMap={deviceMap}
                onHoverChoice={setHoveredChoice}
                onSelectChoice={handleSelectChoice}
              />
            </div>
          )}

          <PairingStatusBar
            source={source}
            hoverCable={hoverCable}
            ghostPreview={ghostPreview}
            onCancel={cancelPairing}
            onStartOver={() => startPairing(source?.deviceId)}
          />

          {layout.cables.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                Bill of materials
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-2xl border border-slate-300 bg-slate-100 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                  onClick={() => exportBomCsv(layout)}
                  type="button"
                >
                  <FileSpreadsheet size={13} />
                  BOM CSV
                </button>
                <button
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-2xl border border-slate-300 bg-slate-100 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                  onClick={() => exportBomText(layout)}
                  type="button"
                >
                  <FileText size={13} />
                  BOM Text
                </button>
              </div>
              <div className="mt-2 text-[10px] leading-5 text-slate-400 dark:text-slate-500">
                BOM lengths include slack, service-loop allowance and bend-radius notes.
              </div>
            </div>
          )}

          {/* ── Cable filter bar ── */}
          {layout.cables.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                Route library
              </div>
              <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Filter cables…"
                value={cableFilter}
                onChange={(e) => setCableFilter(e.target.value)}
                className="h-8 min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-100 px-2.5 text-[11px] text-slate-700 placeholder-slate-400 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder-slate-600"
              />
              <select
                value={cableTypeFilter}
                onChange={(e) => setCableTypeFilter(e.target.value as CableType | 'all')}
                className="h-8 rounded-xl border border-slate-300 bg-slate-100 px-2 text-[11px] text-slate-600 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
              >
                <option value="all">All types</option>
                {Array.from(new Set(layout.cables.map((c) => c.type))).sort().map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            </div>
          )}

          {/* ── Grouped compact cable list ── */}
          <div className="space-y-1.5">
            {filteredCables.length === 0 && layout.cables.length > 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-100/60 p-3 text-center text-[11px] text-slate-400 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400 dark:text-slate-500">
                No cables match the filter.
              </div>
            )}

            {(() => {
              const groups = filteredCables.reduce<Record<string, typeof filteredCables>>((acc, route) => {
                acc[route.type] = acc[route.type] ?? [];
                acc[route.type].push(route);
                return acc;
              }, {});

              return Object.entries(groups).map(([type, routes]) => {
                const isGroupOpen = expandedCableGroups[type] !== false;
                const toggleGroup = () =>
                  setExpandedCableGroups((prev) => ({ ...prev, [type]: !isGroupOpen }));
                const groupColor = getCableDisplayColor(type as CableType, undefined);

                return (
                  <div key={type} className="rounded-2xl border border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-950/70">
                    {/* Group header */}
                    <button
                      type="button"
                      onClick={toggleGroup}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: groupColor }} />
                      <span className="flex-1 text-[11px] font-semibold capitalize tracking-[0.1em] text-slate-500 dark:text-slate-400">
                        {type}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-600">{routes.length}</span>
                      <ChevronDown
                        size={12}
                        className={`shrink-0 text-slate-400 transition-transform duration-150 dark:text-slate-600 ${isGroupOpen ? '' : '-rotate-90'}`}
                      />
                    </button>

                    {/* Compact cable rows */}
                    {isGroupOpen && (
                      <div className="border-t border-slate-200/60 px-1.5 pb-1.5 pt-1 space-y-1 dark:border-slate-800/60">
                        {routes.map((route) => {
                          const from = deviceMap.get(route.fromDeviceId);
                          const to = deviceMap.get(route.toDeviceId);
                          const plan = calculateCablePlan(route, layout);
                          const selected = selectedCableIds.has(route.id);
                          const muted = selectedCableId !== null && !selected;
                          const displayColor = getCableDisplayColor(route.type, route.color);
                          const slack = getCableSlackBudget(layout, route);
                          const lengthStr = plan
                            ? formatCableLength(plan.standardLengthMm)
                            : `~${formatCableLength(estimateCableLength(layout, route))}`;
                          const portsLabel = portLabel(route);
                          const patchLabel = patchPanelRouteLabel(layout, route);

                          return (
                            <div
                              key={route.id}
                              className={`group cursor-pointer rounded-xl px-2 py-1.5 text-[11px] transition ${
                                selected
                                  ? 'bg-cyan-300/10 text-cyan-800 dark:text-cyan-100'
                                  : muted
                                    ? 'opacity-50 hover:opacity-80 text-slate-500 dark:text-slate-400'
                                    : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800/60'
                              }`}
                              data-cable-planner-route-state={selected ? 'selected' : muted ? 'muted' : 'normal'}
                              onClick={() => selectCable(route.id)}
                            >
                              <div className="flex w-full items-center gap-2">
                                {/* Color pip */}
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: muted ? mutedCableColor : displayColor, opacity: muted ? 0.5 : 1 }}
                                />
                                {/* From → To */}
                                <span className="min-w-0 flex-1 truncate font-medium">
                                  {from?.name ?? '?'}
                                  <span className="mx-1 text-slate-400 dark:text-slate-600">→</span>
                                  {to?.name ?? '?'}
                                </span>
                                {/* Length */}
                                <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">{lengthStr}</span>
                                {/* Delete */}
                                <button
                                  type="button"
                                  className="shrink-0 rounded p-0.5 text-slate-400 opacity-40 transition group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 dark:text-slate-600"
                                  onClick={(e) => { e.stopPropagation(); removeCable(route.id); }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>

                              {/* Expanded detail when selected */}
                              {selected && (
                                <div className="mt-1 pl-4 text-[10px] text-slate-400 dark:text-slate-500">
                                  <div className="mb-1 flex items-center gap-1.5">
                                    <span className="uppercase tracking-[0.12em] text-slate-500 dark:text-slate-600">Lifecycle</span>
                                    <select
                                      value={route.lifecycleStatus ?? 'active'}
                                      onClick={(event) => event.stopPropagation()}
                                      onChange={(event) => updateCable(route.id, { lifecycleStatus: event.target.value as LifecycleStatus })}
                                      className="h-6 rounded border border-slate-300 bg-slate-100 px-1.5 text-[10px] text-slate-600 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                                    >
                                      <option value="active">Active</option>
                                      <option value="planned">Planned</option>
                                      <option value="decommissioning">Decommissioning</option>
                                    </select>
                                  </div>
                                  {portsLabel && <span>{portsLabel}</span>}
                                  {plan && (
                                    <span className={portsLabel ? ' ml-1.5' : ''}>
                                      {plan.discipline} / {plan.rail ? `${plan.rail} tray` : 'front manager'}
                                    </span>
                                  )}
                                  {slack && (
                                    <span className="mt-0.5 block">
                                      Path {formatCableLength(slack.pathLengthMm)} + slack {formatCableLength(slack.slackMm)} = recommended {formatCableLength(slack.recommendedLengthMm)}
                                      {slack.providedLengthMm ? ` / declared ${formatCableLength(slack.providedLengthMm)}` : ''}
                                      {slack.missingMm > 0 ? ` / short by ${formatCableLength(slack.missingMm)}` : ''}
                                    </span>
                                  )}
                                  {slack && (slack.serviceLoopMm > 0 || slack.bendRadiusMm > 0) && (
                                    <span className="mt-0.5 block text-slate-400 dark:text-slate-600">
                                      {slack.serviceLoopMm > 0 ? `Service loop ${slack.serviceLoopMm}mm` : 'No service loop'}
                                      {slack.bendRadiusMm > 0 ? ` / bend >= ${slack.bendRadiusMm}mm` : ''}
                                    </span>
                                  )}
                                  {((plan?.nodes.length ?? 0) > 0 || (route.nodes?.length ?? 0) > 0) && (
                                    <span className="mt-0.5 block text-slate-400 dark:text-slate-600">
                                      {patchLabel ? `${patchLabel} / ` : ''}
                                      {pathDescription(route, plan?.nodes ?? route.nodes ?? [], layout, plan)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </section>
  );
}
