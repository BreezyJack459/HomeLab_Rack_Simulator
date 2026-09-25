import { withoutHiddenZeroUPdu } from '../utils/featureFlags';
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
import { useCableWorkspaceStore } from '../store/cableWorkspaceStore';
import { useRackStore } from '../store/rackStore';
import type { CableRoute, CableType, LifecycleStatus, PlacedDevice, PortRef, PortType, RackLayout } from '../types/rack';
import { getCableDisplayColor } from '../utils/cableColors';
import { matchesCableQuery } from '../utils/cableQuery';
import { calculateCablePlan, estimateCableLength, getCableSlackBudget, pathDescription } from '../utils/routing';
import { formatCableLength, getDeviceXRange, RACK_SPECS } from '../utils/rackMath';
import { exportBomCsv, exportBomText } from '../utils/exporters';
import { getPatchPanelLinkedCableIds, patchPanelRouteLabel } from '../utils/patchPanel';
import { autoWireLayout } from '../utils/autoWire';
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
      <div className="rounded-md border border-dashed border-edge bg-fill/60 p-3 text-center text-[11px] text-content-faint dark:border-edge dark:bg-surface/60 dark:text-content-muted dark:text-content-faint">
        No devices in rack.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-edge bg-fill dark:border-edge dark:bg-surface">
      <div className="flex items-center justify-between border-b border-edge px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-content-faint dark:border-edge dark:text-content-muted dark:text-content-faint">
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
            <div key={device.id} className="border-b border-edge/60 last:border-0 dark:border-edge/60">
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
                        : 'cursor-pointer hover:text-accent dark:hover:text-accent-fg'
                  }`}
                >
                  <span className={`block truncate text-[13px] font-medium ${
                    isSource ? 'text-accent-fg' : rowDisabled ? 'text-content-faint' : 'text-content'
                  }`}>
                    {isSource && <span className="mr-1 text-accent">●</span>}
                    {device.label || device.name}
                  </span>
                  <span className="text-[10px] text-content-faint">
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
                          ? 'bg-accent-solid/20 text-accent dark:bg-accent/20 dark:text-accent-fg'
                          : 'bg-fill-strong text-content-muted dark:bg-fill dark:text-content-muted'
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
                    className="shrink-0 rounded p-0.5 text-content-faint hover:bg-fill hover:text-content-faint"
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
      <div className="rounded-md border border-dashed border-edge bg-fill/60 p-3 text-center text-[11px] text-content-faint dark:border-edge dark:bg-surface/60 dark:text-content-muted dark:text-content-faint">
        No selectable ports on this device.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-edge bg-fill dark:border-edge dark:bg-surface p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-content">{device.name}</div>
          <div className="mt-0.5 text-[11px] text-content-faint">U{device.positionU} / click a visual port</div>
        </div>
        <MousePointer2 size={15} className="mt-0.5 text-accent-fg" />
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
            <div key={face} className="rounded border border-edge bg-gradient-to-b from-fill-strong to-fill p-2 dark:border-edge dark:from-fill dark:to-surface">
              <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-content-faint">
                <span>{face} face</span>
                <span>{faceChoices.filter((choice) => !choice.disabled).length} free</span>
              </div>
              <div className="space-y-2">
                {Object.entries(grouped).map(([type, group]) => (
                  <div key={`${face}-${type}`}>
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-content-faint">{type}</div>
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
                                ? 'border-accent bg-accent-solid text-content ring-2 ring-accent/40 dark:border-accent dark:bg-accent dark:text-accent-on dark:ring-accent/40'
                                : disabled
                                  ? 'cursor-not-allowed border-edge bg-fill/60 text-content-faint line-through dark:border-edge dark:bg-surface-raised/60 dark:text-content-faint'
                                  : highlighted
                                    ? 'scale-105 border-accent bg-accent/15 text-accent-fg-strong'
                                    : 'border-black/20 bg-fill text-content hover:scale-105 hover:border-accent hover:bg-accent-solid-hover/10 dark:border-white/40 dark:bg-surface-raised dark:text-content dark:hover:border-accent dark:hover:bg-accent/10'
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
    <div className="sticky bottom-2 z-10 rounded-md border border-accent/50 bg-surface/95 p-3 shadow-xl shadow-black/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-accent-fg-strong">
            {source.port.type} {source.port.index + 1} ({source.deviceName}) -&gt; ?
          </div>
          <div className="mt-1 text-[11px] text-content-muted">
            Pick a highlighted compatible destination port.
          </div>
          {ghostPreview && hoverCable && (
            <div className="mt-2 rounded border border-dashed border-accent/40 bg-accent/5 px-2 py-1 text-[11px] text-accent-fg-strong">
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-edge-strong bg-fill text-content-secondary hover:bg-fill-strong dark:border-edge-strong dark:bg-surface-raised dark:text-content-secondary dark:hover:bg-fill"
            title="Pick a different source"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-edge-strong bg-fill text-content-secondary hover:bg-fill-strong dark:border-edge-strong dark:bg-surface-raised dark:text-content-secondary dark:hover:bg-fill"
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

export function CablePlanner({ compact = false }: { compact?: boolean }) {
  const connectionRequested = useCableWorkspaceStore(s => s.connectionRequested);
  useEffect(() => {
    if (connectionRequested) { startPairing(); setIsOpen(true); useCableWorkspaceStore.getState().consumeConnectionRequest(); }
  }, [connectionRequested]);
  const storedLayout = useRackStore((state) => state.layout);
  const layout = useMemo(() => withoutHiddenZeroUPdu(storedLayout), [storedLayout]);
  const addCable = useRackStore((state) => state.addCable);
  const addCables = useRackStore((state) => state.addCables);
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
  const cableFilter = useCableWorkspaceStore((state) => state.query);
  const setCableFilter = useCableWorkspaceStore((state) => state.setQuery);
  const hiddenTypes = useCableWorkspaceStore((state) => state.hiddenTypes);
  const showAllTypes = useCableWorkspaceStore((state) => state.showAllTypes);
  const focusMode = useCableWorkspaceStore((state) => state.focusMode);
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
      const selected = selectedCableIds.has(route.id);
      if (compact) return route.id === selectedCableId;
      if (hiddenTypes.includes(route.type) && !selected) return false;
      if (focusMode === 'hide' && selectedCableId !== null && !selected) return false;
      return matchesCableQuery(route, layout, q);
    });
  }, [compact, layout.cables, cableFilter, deviceMap, focusMode, hiddenTypes, selectedCableId, selectedCableIds]);

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

  function handleAutoWire() {
    const result = autoWireLayout(layout);
    addCables(result.cables);
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
    <section className="rounded-2xl border border-edge bg-fill/78 p-3.5 dark:border-edge dark:bg-surface-raised/78">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="mb-2.5 flex w-full items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted transition hover:text-content-secondary dark:text-content-muted dark:hover:text-content"
      >
        <div className="flex items-center gap-2">
          <Cable size={15} />
          Cables
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-fill px-2 py-1 text-xs text-content-secondary dark:bg-surface dark:text-content-secondary">{layout.cables.length} routes</span>
          <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
        </div>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden space-y-3">
          {(!compact || !selectedCableId || stage !== 'idle') && <div className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/10 via-white/80 to-white/40 p-3 shadow-sm dark:from-accent/10 dark:via-surface/70 dark:to-surface/50">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-fg">
                  Cable flow
                </div>
                <div className="mt-1 text-sm font-semibold text-content">
                  {stage === 'idle'
                    ? 'Start a new cable route'
                    : isSelectingDest(stage)
                      ? 'Pick a destination port'
                      : 'Pick a source port'}
                </div>
                <p className="mt-1 text-[11px] leading-5 text-content-muted">
                  Quick connect for speed, or expand a device to pick an exact port face.
                </p>
              </div>
              <div className="shrink-0 rounded-full border border-edge bg-surface/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-content-muted shadow-sm dark:border-edge dark:bg-surface/70 dark:text-content-muted">
                {stage === 'idle' ? 'Ready' : isSelectingDest(stage) ? 'Step 2' : 'Step 1'}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl bg-accent-solid text-sm font-semibold text-content shadow-lg shadow-accent/15 hover:bg-accent dark:text-accent-on dark:hover:bg-accent"
                onClick={() => startPairing()}
                type="button"
              >
                <Link2 size={15} />
                {stage === 'idle' ? 'Add cable' : isSelectingDest(stage) ? 'Pick destination' : 'Pick source'}
              </button>
              {stage === 'idle' && (
                <button
                  type="button"
                  onClick={handleAutoWire}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl border border-accent bg-surface/80 px-3 text-sm font-semibold text-accent shadow-sm hover:bg-accent-subtle dark:border-accent dark:bg-surface/70 dark:text-accent-fg dark:hover:bg-surface-raised"
                >
                  <Cable size={15} />
                  Auto-wire
                </button>
              )}
              {lastSourceDeviceId && stage === 'idle' && (
                <button
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl border border-edge-strong bg-surface/80 px-3 text-xs font-medium text-content-secondary shadow-sm hover:bg-surface dark:border-edge-strong dark:bg-surface/70 dark:text-content-secondary dark:hover:bg-surface-raised"
                  onClick={() => startPairing(lastSourceDeviceId)}
                  type="button"
                >
                  <RotateCcw size={13} />
                  Same device
                </button>
              )}
            </div>
          </div>}

          {(!compact || stage !== 'idle') && <div className="rounded-2xl border border-edge bg-surface/70 p-3 dark:border-edge dark:bg-surface/70">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-faint">
                  Quick pick
                </div>
                <div className="mt-1 text-sm font-semibold text-content">
                  Devices with free compatible ports
                </div>
              </div>
              <div className="text-[10px] text-content-faint">
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
          </div>}

          {(!compact || stage !== 'idle') && <div className="flex items-center justify-between rounded-2xl border border-edge bg-surface/70 px-3 py-2.5 dark:border-edge dark:bg-surface/70">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-faint">Ghost preview</div>
              <div className="text-[11px] leading-5 text-content-muted">Show a provisional route before you commit.</div>
            </div>
            <button
              type="button"
              onClick={() => setGhostPreview((value) => !value)}
              className={`relative h-6 w-11 rounded-full border transition ${
                ghostPreview ? 'border-accent bg-accent-solid/30 dark:border-accent dark:bg-accent/30' : 'border-edge-strong bg-fill dark:border-edge-strong dark:bg-surface-raised'
              }`}
              aria-pressed={ghostPreview}
            >
              <span
                className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-surface transition ${ghostPreview ? 'left-5' : 'left-0.5'}`}
                style={{ width: 18, height: 18 }}
              />
            </button>
          </div>}

          {expandedDevice && (
            <div className="rounded-2xl border border-edge bg-surface/70 p-3 dark:border-edge dark:bg-surface/70">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-content-faint">
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
            <details open={!compact} className="rounded-2xl border border-edge bg-surface/70 p-3 dark:border-edge dark:bg-surface/70">
              <summary className="mb-2 cursor-pointer text-xs font-semibold text-content-muted">Export cable BOM</summary>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-2xl border border-edge-strong bg-fill text-xs font-medium text-content-secondary hover:bg-fill-strong dark:border-edge-strong dark:bg-surface dark:text-content-secondary dark:hover:bg-fill"
                  onClick={() => exportBomCsv(layout)}
                  type="button"
                >
                  <FileSpreadsheet size={13} />
                  BOM CSV
                </button>
                <button
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-2xl border border-edge-strong bg-fill text-xs font-medium text-content-secondary hover:bg-fill-strong dark:border-edge-strong dark:bg-surface dark:text-content-secondary dark:hover:bg-fill"
                  onClick={() => exportBomText(layout)}
                  type="button"
                >
                  <FileText size={13} />
                  BOM Text
                </button>
              </div>
              <div className="mt-2 text-[10px] leading-5 text-content-faint">
                BOM lengths include slack, service-loop allowance and bend-radius notes.
              </div>
            </details>
          )}

          {/* ── Cable filter bar ── */}
          {!compact && layout.cables.length > 0 && (
            <div className="rounded-2xl border border-edge bg-surface/70 p-3 dark:border-edge dark:bg-surface/70">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-content-faint">
                Route library
              </div>
              <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Filter cables…"
                value={cableFilter}
                onChange={(e) => setCableFilter(e.target.value)}
                className="h-8 min-w-0 flex-1 rounded-xl border border-edge-strong bg-fill px-2.5 text-[11px] text-content-secondary placeholder-content-faint outline-none focus:border-accent dark:border-edge-strong dark:bg-surface dark:text-content dark:placeholder-content-muted"
              />
              {hiddenTypes.length > 0 && (
                <button
                  type="button"
                  onClick={showAllTypes}
                  className="h-8 rounded-xl border border-edge-strong bg-fill px-2 text-[11px] text-content-secondary hover:bg-fill-strong dark:border-edge-strong dark:bg-surface dark:text-content-secondary"
                >
                  Show all types
                </button>
              )}
            </div>
            </div>
          )}

          {/* ── Grouped compact cable list ── */}
          <div className="space-y-1.5">
            {!compact && filteredCables.length === 0 && layout.cables.length > 0 && (
              <div className="rounded-2xl border border-dashed border-edge bg-fill/60 p-3 text-center text-[11px] text-content-faint dark:border-edge dark:bg-surface/60 dark:text-content-muted dark:text-content-faint">
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
                  <div key={type} className="rounded-2xl border border-edge bg-surface/70 dark:border-edge dark:bg-surface/70">
                    {/* Group header */}
                    <button
                      type="button"
                      onClick={toggleGroup}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-fill-strong/50 dark:hover:bg-fill/50"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: groupColor }} />
                      <span className="flex-1 text-[11px] font-semibold capitalize tracking-[0.1em] text-content-muted">
                        {type}
                      </span>
                      <span className="text-[10px] text-content-faint">{routes.length}</span>
                      <ChevronDown
                        size={12}
                        className={`shrink-0 text-content-faint transition-transform duration-150 dark:text-content-faint ${isGroupOpen ? '' : '-rotate-90'}`}
                      />
                    </button>

                    {/* Compact cable rows */}
                    {isGroupOpen && (
                      <div className="border-t border-edge/60 px-1.5 pb-1.5 pt-1 space-y-1 dark:border-edge/60">
                        {routes.map((route) => {
                          const from = deviceMap.get(route.fromDeviceId);
                          const to = deviceMap.get(route.toDeviceId);
                          const plan = calculateCablePlan(route, layout);
                          const selected = selectedCableIds.has(route.id);
                          const muted = focusMode === 'dim' && selectedCableId !== null && !selected;
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
                                  ? 'bg-accent/10 text-accent-fg-strong'
                                  : muted
                                    ? 'opacity-50 hover:opacity-80 text-content-muted'
                                    : 'text-content-secondary hover:bg-fill-strong/60 dark:text-content-secondary dark:hover:bg-fill/60'
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
                                  <span className="mx-1 text-content-faint">→</span>
                                  {to?.name ?? '?'}
                                </span>
                                {/* Length */}
                                <span className="shrink-0 text-[10px] text-content-faint">{lengthStr}</span>
                                {/* Delete */}
                                <button
                                  type="button"
                                  className="shrink-0 rounded p-0.5 text-content-faint opacity-40 transition group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 dark:text-content-faint"
                                  onClick={(e) => { e.stopPropagation(); removeCable(route.id); }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>

                              {/* Expanded detail when selected */}
                              {selected && (
                                <div className="mt-1 pl-4 text-[10px] text-content-faint">
                                  <div className="mb-1.5 grid gap-1.5">
                                    <label className="grid gap-1">
                                      <span className="uppercase tracking-[0.12em] text-content-muted">Cable label</span>
                                      <input
                                        value={route.label ?? ''}
                                        placeholder={route.id}
                                        onClick={(event) => event.stopPropagation()}
                                        onChange={(event) => updateCable(route.id, { label: event.target.value || undefined })}
                                        className="h-7 rounded border border-edge-strong bg-fill px-2 text-[10px] text-content-secondary outline-none focus:border-accent dark:border-edge-strong dark:bg-surface dark:text-content-secondary"
                                      />
                                    </label>
                                    <label className="grid gap-1">
                                      <span className="uppercase tracking-[0.12em] text-content-muted">Notes</span>
                                      <textarea
                                        value={route.notes ?? ''}
                                        placeholder="Installation or service notes"
                                        rows={2}
                                        onClick={(event) => event.stopPropagation()}
                                        onChange={(event) => updateCable(route.id, { notes: event.target.value || undefined })}
                                        className="resize-none rounded border border-edge-strong bg-fill px-2 py-1.5 text-[10px] text-content-secondary outline-none focus:border-accent dark:border-edge-strong dark:bg-surface dark:text-content-secondary"
                                      />
                                    </label>
                                  </div>
                                  <div className="mb-1 flex items-center gap-1.5">
                                    <span className="uppercase tracking-[0.12em] text-content-muted dark:text-content-faint">Lifecycle</span>
                                    <select
                                      value={route.lifecycleStatus ?? 'active'}
                                      onClick={(event) => event.stopPropagation()}
                                      onChange={(event) => updateCable(route.id, { lifecycleStatus: event.target.value as LifecycleStatus })}
                                      className="h-6 rounded border border-edge-strong bg-fill px-1.5 text-[10px] text-content-secondary outline-none focus:border-accent dark:border-edge-strong dark:bg-surface dark:text-content-secondary"
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
                                    <span className="mt-0.5 block text-content-faint">
                                      {slack.serviceLoopMm > 0 ? `Service loop ${slack.serviceLoopMm}mm` : 'No service loop'}
                                      {slack.bendRadiusMm > 0 ? ` / bend >= ${slack.bendRadiusMm}mm` : ''}
                                    </span>
                                  )}
                                  {((plan?.nodes.length ?? 0) > 0 || (route.nodes?.length ?? 0) > 0) && (
                                    <span className="mt-0.5 block text-content-faint">
                                      {patchLabel ? `${patchLabel} / ` : ''}
                                      {pathDescription(route, plan?.nodes ?? route.nodes ?? [], layout, plan)}
                                    </span>
                                  )}
                                  {plan?.warnings.map((warning) => (
                                    <div
                                      key={`${route.id}-${warning.code}`}
                                      className="mt-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-amber-700 dark:text-amber-300"
                                    >
                                      <div className="font-semibold">{warning.message}</div>
                                      <div className="mt-0.5 opacity-80">
                                        Review the route, increase cable length, or add the recommended manager before installation.
                                      </div>
                                    </div>
                                  ))}
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
