import {
  Cable,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Link2,
  MousePointer2,
  RotateCcw,
  Trash2,
  X
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { CableRoute, CableType, PlacedDevice, PortRef, PortType, RackLayout } from '../types/rack';
import { DEFAULT_CABLE_COLORS, getCableDisplayColor } from '../utils/cableColors';
import { calculateCablePlan, pathDescription } from '../utils/routing';
import { estimateCableLength, formatCableLength, getDeviceXRange, RACK_SPECS } from '../utils/rackMath';
import { getPortFaceMap } from '../utils/portLayout';
import { exportBomCsv, exportBomText } from '../utils/exporters';
import { ENABLE_ZERO_U_PDU } from '../utils/featureFlags';
import { getPatchPanelJacks, getPatchPanelLinkedCableIds, patchPanelJackStatusLabel, patchPanelRouteLabel } from '../utils/patchPanel';

const cableTypes: CableType[] = ['structured', 'patch', 'ethernet', 'power', 'fiber', 'usb', 'hdmi', 'atx', 'coax'];
const mutedCableColor = '#64748b';

type PairingStage = 'idle' | 'selecting_source' | 'selecting_destination';
type PortFace = 'front' | 'rear';

type PortOption = {
  index: number;
  label: string;
  side?: PortFace;
  disabled?: boolean;
};

type PortChoice = PortOption & {
  deviceId: string;
  deviceName: string;
  type: PortType;
  cableTypes: CableType[];
};

type PairingSource = {
  deviceId: string;
  deviceName: string;
  port: PortRef;
  label: string;
};

function portTypeForCableType(cableType: CableType): PortType {
  if (cableType === 'structured' || cableType === 'patch') return 'ethernet';
  return cableType as PortType;
}

function portKey(port: Pick<PortRef, 'type' | 'index' | 'side'>) {
  return `${port.type}:${port.side ?? 'any'}:${port.index}`;
}

function portClaimMatches(port: PortRef | undefined, portType: PortType, portIndex: number, side?: PortFace) {
  if (!port || port.type !== portType || port.index !== portIndex) return false;
  return !side || !port.side || port.side === side;
}

function getUsedPorts(layout: RackLayout, deviceId: string, portType: PortType, side?: PortFace): Set<number> {
  const used = new Set<number>();
  layout.cables.forEach((cable) => {
    if (cable.fromDeviceId === deviceId && portClaimMatches(cable.fromPort, portType, cable.fromPort?.index ?? -1, side)) {
      used.add(cable.fromPort!.index);
    }
    if (cable.toDeviceId === deviceId && portClaimMatches(cable.toPort, portType, cable.toPort?.index ?? -1, side)) {
      used.add(cable.toPort!.index);
    }
  });
  return used;
}

function isPortUsed(layout: RackLayout, deviceId: string, portType: PortType, portIndex: number, side?: PortFace): boolean {
  return layout.cables.some((cable) => {
    if (cable.fromDeviceId === deviceId && portClaimMatches(cable.fromPort, portType, portIndex, side)) return true;
    if (cable.toDeviceId === deviceId && portClaimMatches(cable.toPort, portType, portIndex, side)) return true;
    return false;
  });
}

function inferCableType(from: PlacedDevice | undefined, to: PlacedDevice | undefined): CableType | null {
  if (!from || !to) return null;
  const isPatchPanel = (d: PlacedDevice) => d.category === 'patch-panel';
  const isSwitch = (d: PlacedDevice) => d.category === 'switch';
  const isPdu = (d: PlacedDevice) => d.category === 'pdu' || (ENABLE_ZERO_U_PDU && d.category === 'pdu-0u');
  const hasPatchPanel = isPatchPanel(from) || isPatchPanel(to);
  const hasSwitch = isSwitch(from) || isSwitch(to);

  if (isPdu(from) || isPdu(to)) return 'power';
  if (hasPatchPanel && hasSwitch) return 'patch';
  if (hasPatchPanel) return 'structured';
  return 'ethernet';
}

function portOptionsForDevice(device: PlacedDevice | undefined, cableType: CableType, layout: RackLayout): PortOption[] {
  if (!device || !device.ports) return [];
  const portType = portTypeForCableType(cableType);
  const count = device.ports[portType];
  if (!count || count <= 0) return [];

  if (device.category === 'patch-panel') {
    const options: PortOption[] = [];
    const jacks = getPatchPanelJacks(layout, device.id);
    if (cableType !== 'structured') {
      const used = getUsedPorts(layout, device.id, portType, 'front');
      for (let i = 0; i < count; i++) {
        const jack = jacks[i];
        options.push({
          index: i,
          label: jack ? patchPanelJackStatusLabel(jack, 'front') : `Jack ${i + 1} front`,
          side: 'front',
          disabled: used.has(i)
        });
      }
    }
    if (cableType !== 'patch') {
      const used = getUsedPorts(layout, device.id, portType, 'rear');
      for (let i = 0; i < count; i++) {
        const jack = jacks[i];
        options.push({
          index: i,
          label: jack ? patchPanelJackStatusLabel(jack, 'rear') : `Jack ${i + 1} rear`,
          side: 'rear',
          disabled: used.has(i)
        });
      }
    }
    return options;
  }

  const used = getUsedPorts(layout, device.id, portType);
  const label = portType.charAt(0).toUpperCase() + portType.slice(1);
  const faceMap = getPortFaceMap(device.category, device.portFaceOverrides);
  const defaultFace = (faceMap[portType] ?? 'rear') as PortFace;

  if (cableType === 'patch') {
    if (device.category !== 'switch') return [];
    return Array.from({ length: count }, (_, index) => ({
      index,
      label: `${label} ${index + 1}`,
      side: 'front' as const,
      disabled: used.has(index)
    }));
  }

  return Array.from({ length: count }, (_, index) => ({
    index,
    label: `${label} ${index + 1}`,
    side: defaultFace,
    disabled: used.has(index)
  }));
}

function portChoicesForDevice(device: PlacedDevice, layout: RackLayout): PortChoice[] {
  const choices = new Map<string, PortChoice>();

  cableTypes.forEach((cableType) => {
    const type = portTypeForCableType(cableType);
    portOptionsForDevice(device, cableType, layout).forEach((option) => {
      const key = portKey({ type, index: option.index, side: option.side });
      const existing = choices.get(key);
      if (existing) {
        existing.cableTypes.push(cableType);
        existing.disabled = existing.disabled && option.disabled;
        return;
      }
      choices.set(key, {
        ...option,
        deviceId: device.id,
        deviceName: device.name,
        type,
        cableTypes: [cableType]
      });
    });
  });

  return Array.from(choices.values()).sort((a, b) => {
    const faceOrder = (a.side ?? 'rear').localeCompare(b.side ?? 'rear');
    if (faceOrder !== 0) return faceOrder;
    const typeOrder = a.type.localeCompare(b.type);
    return typeOrder !== 0 ? typeOrder : a.index - b.index;
  });
}

function sourceSupportsCableType(source: PairingSource, sourceDevice: PlacedDevice, cableType: CableType, layout: RackLayout) {
  return portOptionsForDevice(sourceDevice, cableType, layout).some(
    (option) =>
      option.index === source.port.index &&
      option.side === source.port.side &&
      portTypeForCableType(cableType) === source.port.type &&
      !option.disabled
  );
}

function resolveCompatibleCable(
  layout: RackLayout,
  source: PairingSource | null,
  choice: PortChoice
): { cableType: CableType; color: string } | null {
  if (!source || source.deviceId === choice.deviceId || choice.disabled) return null;
  const sourceDevice = layout.devices.find((device) => device.id === source.deviceId);
  const targetDevice = layout.devices.find((device) => device.id === choice.deviceId);
  if (!sourceDevice || !targetDevice) return null;

  const inferred = inferCableType(sourceDevice, targetDevice);
  if (!inferred || portTypeForCableType(inferred) !== source.port.type || choice.type !== source.port.type) {
    return null;
  }
  if (!sourceSupportsCableType(source, sourceDevice, inferred, layout)) return null;

  const targetOption = portOptionsForDevice(targetDevice, inferred, layout).find(
    (option) => option.index === choice.index && option.side === choice.side && !option.disabled
  );
  if (!targetOption) return null;
  if (isPortUsed(layout, choice.deviceId, choice.type, choice.index, choice.side)) return null;

  return { cableType: inferred, color: DEFAULT_CABLE_COLORS[inferred] };
}

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

function MiniRackBrowser({
  layout,
  expandedDeviceId,
  source,
  stage,
  onDeviceClick
}: {
  layout: RackLayout;
  expandedDeviceId: string | null;
  source: PairingSource | null;
  stage: PairingStage;
  onDeviceClick: (deviceId: string) => void;
}) {
  const rackHeight = 188;
  const activeDevices = layout.devices.filter((device) => device.category !== 'blank');

  return (
    <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        <span>Mini rack browser</span>
        <span>{activeDevices.length} devices</span>
      </div>
      <div className="relative overflow-hidden rounded border border-slate-800 bg-slate-900" style={{ height: rackHeight }}>
        <div className="absolute inset-y-2 left-2 w-8 rounded border border-slate-700 bg-slate-950/80">
          {Array.from({ length: layout.heightU }, (_, index) => (
            <span
              key={index}
              className="absolute left-0 right-0 border-t border-slate-800 text-[8px] leading-none text-slate-700"
              style={{ top: `${(index / layout.heightU) * 100}%` }}
            />
          ))}
        </div>
        {activeDevices.map((device) => {
          const xRange = getDeviceXRange(layout, device);
          const top = ((layout.heightU - (device.positionU + device.sizeU - 1)) / layout.heightU) * 100;
          const height = Math.max(7, (Math.max(device.sizeU, 0.5) / layout.heightU) * 100);
          const rackWidthMm = RACK_SPECS[layout.rackType].usableWidthMm;
          const left = 46 + Math.max(0, Math.min(1, xRange.x / Math.max(1, rackWidthMm))) * 126;
          const width = Math.max(42, Math.min(138, (xRange.width / Math.max(1, rackWidthMm)) * 150));
          const isExpanded = expandedDeviceId === device.id;
          const isSource = source?.deviceId === device.id;
          const isDisabled = stage === 'selecting_destination' && source?.deviceId === device.id;

          return (
            <button
              key={device.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onDeviceClick(device.id)}
              className={`absolute rounded-[4px] border px-1 text-left text-[9px] font-semibold leading-none transition ${
                isExpanded
                  ? 'border-cyan-300 bg-cyan-300/15 text-cyan-50'
                  : isSource
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-100'
                    : isDisabled
                      ? 'cursor-not-allowed border-slate-800 bg-slate-900 text-slate-600'
                      : 'border-white/15 text-white hover:border-white/50'
              }`}
              style={{
                top: `${top}%`,
                height: `${height}%`,
                left,
                width,
                backgroundColor: isExpanded || isSource || isDisabled ? undefined : `${device.color}cc`
              }}
              title={`${device.name} U${device.positionU}`}
            >
              <span className="block truncate">{device.label || device.name}</span>
            </button>
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
  onHoverChoice,
  onSelectChoice
}: {
  device: PlacedDevice;
  layout: RackLayout;
  source: PairingSource | null;
  stage: PairingStage;
  hoveredChoiceKey: string | null;
  onHoverChoice: (choice: PortChoice | null) => void;
  onSelectChoice: (choice: PortChoice) => void;
}) {
  const choices = portChoicesForDevice(device, layout);
  const faces: PortFace[] = ['front', 'rear'];

  if (!choices.length) {
    return (
      <div className="rounded-md border border-dashed border-slate-800 bg-slate-950/60 p-3 text-center text-[11px] text-slate-500">
        No selectable ports on this device.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{device.name}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">U{device.positionU} / click a visual port</div>
        </div>
        <MousePointer2 size={15} className="mt-0.5 text-cyan-300" />
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
            <div key={face} className="rounded border border-slate-800 bg-gradient-to-b from-slate-800 to-slate-950 p-2">
              <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <span>{face} face</span>
                <span>{faceChoices.filter((choice) => !choice.disabled).length} free</span>
              </div>
              <div className="space-y-2">
                {Object.entries(grouped).map(([type, group]) => (
                  <div key={`${face}-${type}`}>
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">{type}</div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {group.map((choice) => {
                        const key = portKey(choice);
                        const isSource = source?.deviceId === choice.deviceId && portKey(source.port) === key;
                        const compatibility = stage === 'selecting_destination'
                          ? resolveCompatibleCable(layout, source, choice)
                          : null;
                        const disabled = stage === 'selecting_destination'
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
                            className={`flex h-7 min-w-0 items-center justify-center rounded-[4px] border text-[10px] font-bold transition ${
                              isSource
                                ? 'border-cyan-100 bg-cyan-300 text-slate-950 ring-2 ring-cyan-300/40'
                                : disabled
                                  ? 'cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-600 line-through'
                                  : highlighted
                                    ? 'scale-105 border-cyan-300 bg-cyan-300/15 text-cyan-50'
                                    : 'border-white/40 bg-slate-900 text-slate-100 hover:scale-105 hover:border-cyan-300 hover:bg-cyan-300/10'
                            }`}
                            title={choice.label}
                          >
                            {choice.index + 1}
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
    <div className="sticky bottom-2 z-10 rounded-md border border-cyan-400/50 bg-slate-950/95 p-3 shadow-xl shadow-black/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-cyan-50">
            {source.port.type} {source.port.index + 1} ({source.deviceName}) -&gt; ?
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Pick a highlighted compatible destination port.
          </div>
          {ghostPreview && hoverCable && (
            <div className="mt-2 rounded border border-dashed border-cyan-400/40 bg-cyan-400/5 px-2 py-1 text-[11px] text-cyan-100">
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
            title="Pick a different source"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
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
  const selectCable = useRackStore((state) => state.selectCable);
  const selectedCableId = useRackStore((state) => state.selectedCableId);
  const [isOpen, setIsOpen] = useState(true);
  const [stage, setStage] = useState<PairingStage>('idle');
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null);
  const [source, setSource] = useState<PairingSource | null>(null);
  const [hoveredChoice, setHoveredChoice] = useState<PortChoice | null>(null);
  const [ghostPreview, setGhostPreview] = useState(false);
  const [lastSourceDeviceId, setLastSourceDeviceId] = useState<string | null>(null);

  const selectedCableIds = useMemo(
    () => getPatchPanelLinkedCableIds(layout, selectedCableId),
    [layout, selectedCableId]
  );

  const expandedDevice = layout.devices.find((device) => device.id === expandedDeviceId);
  const hoveredChoiceKey = hoveredChoice ? portKey(hoveredChoice) : null;
  const hoverCable = useMemo(() => {
    if (!ghostPreview || !source || !hoveredChoice) return null;
    const compatible = resolveCompatibleCable(layout, source, hoveredChoice);
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
  }, [ghostPreview, hoveredChoice, layout, source]);

  function startPairing(deviceId?: string | null) {
    setStage('selecting_source');
    setSource(null);
    setHoveredChoice(null);
    setExpandedDeviceId(deviceId ?? lastSourceDeviceId ?? layout.devices.find((device) => portChoicesForDevice(device, layout).length > 0)?.id ?? null);
  }

  function cancelPairing() {
    setStage('idle');
    setSource(null);
    setHoveredChoice(null);
  }

  function handleDeviceClick(deviceId: string) {
    setExpandedDeviceId((current) => (current === deviceId ? null : deviceId));
  }

  function handleSelectChoice(choice: PortChoice) {
    if (stage === 'idle') {
      setStage('selecting_source');
    }

    if (stage !== 'selecting_destination') {
      if (choice.disabled) return;
      const nextSource = {
        deviceId: choice.deviceId,
        deviceName: choice.deviceName,
        port: portRefFromChoice(choice),
        label: choice.label
      };
      setSource(nextSource);
      setLastSourceDeviceId(choice.deviceId);
      setStage('selecting_destination');
      setHoveredChoice(null);
      return;
    }

    const compatible = resolveCompatibleCable(layout, source, choice);
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
    setStage('idle');
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/78 p-4">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="mb-3 flex w-full items-center justify-between gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400 transition hover:text-slate-200"
      >
        <div className="flex items-center gap-2">
          <Cable size={15} />
          Cables
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-950 px-2 py-1 text-xs text-slate-300">{layout.cables.length} routes</span>
          <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
        </div>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden space-y-3">
          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-cyan-400 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
              onClick={() => startPairing()}
              type="button"
            >
              <Link2 size={15} />
              {stage === 'idle' ? 'Add cable' : 'Pick source'}
            </button>
            {lastSourceDeviceId && stage === 'idle' && (
              <button
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-slate-700 bg-slate-950 px-3 text-xs font-medium text-slate-300 hover:bg-slate-800"
                onClick={() => startPairing(lastSourceDeviceId)}
                type="button"
              >
                <RotateCcw size={13} />
                Same device
              </button>
            )}
          </div>

          <MiniRackBrowser
            layout={layout}
            expandedDeviceId={expandedDeviceId}
            source={source}
            stage={stage}
            onDeviceClick={handleDeviceClick}
          />

          <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
            <div>
              <div className="text-xs font-semibold text-slate-200">Ghost preview</div>
              <div className="text-[11px] text-slate-500">Show a provisional route while hovering a destination.</div>
            </div>
            <button
              type="button"
              onClick={() => setGhostPreview((value) => !value)}
              className={`relative h-6 w-11 rounded-full border transition ${
                ghostPreview ? 'border-cyan-300 bg-cyan-400/30' : 'border-slate-700 bg-slate-900'
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
            <DeviceFaceCard
              device={expandedDevice}
              layout={layout}
              source={source}
              stage={stage}
              hoveredChoiceKey={hoveredChoiceKey}
              onHoverChoice={setHoveredChoice}
              onSelectChoice={handleSelectChoice}
            />
          )}

          <PairingStatusBar
            source={source}
            hoverCable={hoverCable}
            ghostPreview={ghostPreview}
            onCancel={cancelPairing}
            onStartOver={() => startPairing(source?.deviceId)}
          />

          {layout.cables.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <button
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-slate-700 bg-slate-950 text-xs font-medium text-slate-300 hover:bg-slate-800"
                onClick={() => exportBomCsv(layout)}
                type="button"
              >
                <FileSpreadsheet size={13} />
                BOM CSV
              </button>
              <button
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-slate-700 bg-slate-950 text-xs font-medium text-slate-300 hover:bg-slate-800"
                onClick={() => exportBomText(layout)}
                type="button"
              >
                <FileText size={13} />
                BOM Text
              </button>
            </div>
          )}

          <div className="space-y-2">
            {layout.cables.map((route) => {
              const from = layout.devices.find((device) => device.id === route.fromDeviceId);
              const to = layout.devices.find((device) => device.id === route.toDeviceId);
              const plan = calculateCablePlan(route, layout);
              const selected = selectedCableIds.has(route.id);
              const muted = selectedCableId !== null && !selected;
              const portsLabel = portLabel(route);
              const patchLabel = patchPanelRouteLabel(layout, route);
              const displayColor = getCableDisplayColor(route.type, route.color);
              return (
                <button
                  key={route.id}
                  className={`flex w-full items-center gap-3 rounded-md border p-2 text-left text-sm transition ${
                    selected
                      ? 'border-cyan-300 bg-cyan-300/10'
                      : muted
                        ? 'border-slate-800 bg-slate-950/70 opacity-70 hover:border-slate-700'
                        : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                  }`}
                  data-cable-planner-route-state={selected ? 'selected' : muted ? 'muted' : 'normal'}
                  onClick={() => selectCable(route.id)}
                  type="button"
                >
                  <span
                    className="h-8 w-1.5 rounded-full"
                    style={{ backgroundColor: muted ? mutedCableColor : displayColor, opacity: muted ? 0.55 : 1 }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate ${muted ? 'text-slate-400' : 'text-slate-100'}`}>
                      {from?.name ?? 'Missing'} -&gt; {to?.name ?? 'Missing'}
                    </span>
                    <span className="text-xs text-slate-500">
                      <span className="capitalize">{route.type}</span>
                      <span className="mx-1">-</span>
                      <span>{plan ? formatCableLength(plan.standardLengthMm) : `~${formatCableLength(estimateCableLength(layout, route))}`}</span>
                      {plan && (
                        <>
                          <span className="mx-1">-</span>
                          <span>{plan.discipline} / {plan.rail ? `${plan.rail} tray` : 'front manager'}</span>
                        </>
                      )}
                      {portsLabel && (
                        <>
                          <span className="mx-1">-</span>
                          <span>{portsLabel}</span>
                        </>
                      )}
                    </span>
                    {((plan?.nodes.length ?? 0) > 0 || (route.nodes?.length ?? 0) > 0) && (
                      <span className="mt-0.5 block text-[10px] text-slate-600">
                        {patchLabel ? `${patchLabel} / ` : ''}
                        {pathDescription(route, plan?.nodes ?? route.nodes ?? [], layout, plan)}
                      </span>
                    )}
                  </span>
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-500/15 hover:text-red-100"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeCable(route.id);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <Trash2 size={14} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
