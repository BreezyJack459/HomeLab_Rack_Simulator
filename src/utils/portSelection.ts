/**
 * Port selection utilities for cable creation.
 * Extracted from CablePlanner.tsx to support auto-assign and device-first workflows.
 */

import type { CableType, PlacedDevice, PortRef, PortType, RackLayout } from '../types/rack';
import { DEFAULT_CABLE_COLORS } from './cableColors';
import { ENABLE_ZERO_U_PDU } from './featureFlags';
import { getPortFaceMap } from './portLayout';
import { getPatchPanelJacks, patchPanelJackStatusLabel } from './patchPanel';

export type PortFace = 'front' | 'rear';

export interface PortOption {
  index: number;
  label: string;
  side?: PortFace;
  disabled?: boolean;
}

export interface FreePortSummary {
  type: PortType;
  free: number;
  total: number;
}

export interface AutoResolvedCable {
  fromPort: PortRef;
  toPort: PortRef;
  cableType: CableType;
  color: string;
}

// ============================================================================
// Port type / cable type mapping
// ============================================================================

export function portTypeForCableType(cableType: CableType): PortType {
  if (cableType === 'structured' || cableType === 'patch') return 'ethernet';
  return cableType as PortType;
}

export function portKey(port: Pick<PortRef, 'type' | 'index' | 'side'>): string {
  return `${port.type}:${port.side ?? 'any'}:${port.index}`;
}

function portClaimMatches(port: PortRef | undefined, portType: PortType, portIndex: number, side?: PortFace): boolean {
  if (!port || port.type !== portType || port.index !== portIndex) return false;
  return !side || !port.side || port.side === side;
}

// ============================================================================
// Used port tracking
// ============================================================================

export function getUsedPorts(layout: RackLayout, deviceId: string, portType: PortType, side?: PortFace): Set<number> {
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

export function isPortUsed(layout: RackLayout, deviceId: string, portType: PortType, portIndex: number, side?: PortFace): boolean {
  return layout.cables.some((cable) => {
    if (cable.fromDeviceId === deviceId && portClaimMatches(cable.fromPort, portType, portIndex, side)) return true;
    if (cable.toDeviceId === deviceId && portClaimMatches(cable.toPort, portType, portIndex, side)) return true;
    return false;
  });
}

// ============================================================================
// Cable type inference (device category → cable type)
// ============================================================================

export function inferCableType(from: PlacedDevice | undefined, to: PlacedDevice | undefined): CableType | null {
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

// ============================================================================
// Port options for a device (all ports, marked disabled if used)
// ============================================================================

export function portOptionsForDevice(device: PlacedDevice | undefined, cableType: CableType, layout: RackLayout): PortOption[] {
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

// ============================================================================
// Port choices aggregated across all cable types (used by DeviceFaceCard)
// ============================================================================

export interface PortChoice extends PortOption {
  deviceId: string;
  deviceName: string;
  type: PortType;
  cableTypes: CableType[];
}

const ALL_CABLE_TYPES: CableType[] = ['structured', 'patch', 'ethernet', 'power', 'fiber', 'usb', 'hdmi', 'atx', 'coax'];

export function portChoicesForDevice(device: PlacedDevice, layout: RackLayout): PortChoice[] {
  const choices = new Map<string, PortChoice>();

  ALL_CABLE_TYPES.forEach((cableType) => {
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

export function sourceSupportsCableType(
  source: { port: PortRef },
  sourceDevice: PlacedDevice,
  cableType: CableType,
  layout: RackLayout
): boolean {
  return portOptionsForDevice(sourceDevice, cableType, layout).some(
    (option) =>
      option.index === source.port.index &&
      option.side === source.port.side &&
      portTypeForCableType(cableType) === source.port.type &&
      !option.disabled
  );
}

export function resolveCompatibleCable(
  layout: RackLayout,
  source: { deviceId: string; port: PortRef } | null,
  choice: PortChoice
): { cableType: CableType; color: string } | null {
  if (!source || source.deviceId === choice.deviceId || choice.disabled) return null;
  const sourceDevice = layout.devices.find((d) => d.id === source.deviceId);
  const targetDevice = layout.devices.find((d) => d.id === choice.deviceId);
  if (!sourceDevice || !targetDevice) return null;

  const inferred = inferCableType(sourceDevice, targetDevice);
  if (!inferred || portTypeForCableType(inferred) !== source.port.type || choice.type !== source.port.type) return null;
  if (!sourceSupportsCableType(source, sourceDevice, inferred, layout)) return null;

  const targetOption = portOptionsForDevice(targetDevice, inferred, layout).find(
    (option) => option.index === choice.index && option.side === choice.side && !option.disabled
  );
  if (!targetOption) return null;
  if (isPortUsed(layout, choice.deviceId, choice.type, choice.index, choice.side)) return null;

  return { cableType: inferred, color: DEFAULT_CABLE_COLORS[inferred] };
}

// ============================================================================
// NEW: Get next free port (auto-assign)
// ============================================================================

/**
 * Returns the first available (unused) port for a given cable type on a device.
 * Returns null if no free port exists.
 */
export function getNextFreePort(
  device: PlacedDevice,
  cableType: CableType,
  layout: RackLayout
): PortOption | null {
  const options = portOptionsForDevice(device, cableType, layout);
  return options.find(opt => !opt.disabled) ?? null;
}

// ============================================================================
// NEW: Free port summary (for DeviceListPicker badges)
// ============================================================================

/**
 * Returns a summary of free port counts per type for a device.
 * Only includes port types that have at least one free port.
 */
export function getFreePortSummary(
  device: PlacedDevice,
  layout: RackLayout
): FreePortSummary[] {
  if (!device.ports) return [];

  const allCableTypes: CableType[] = ['ethernet', 'patch', 'structured', 'power', 'fiber', 'usb', 'hdmi', 'atx', 'coax'];
  const summaryMap = new Map<PortType, { free: number; total: number }>();

  allCableTypes.forEach((cableType) => {
    const portType = portTypeForCableType(cableType);
    const count = device.ports?.[portType] ?? 0;
    if (count <= 0) return;

    const options = portOptionsForDevice(device, cableType, layout);
    const freeCount = options.filter(opt => !opt.disabled).length;

    const existing = summaryMap.get(portType);
    if (!existing) {
      summaryMap.set(portType, { free: freeCount, total: count });
    } else {
      // Aggregate free counts across cable types that map to same port type
      // (e.g. ethernet + patch + structured all use 'ethernet' ports)
      existing.free = Math.max(existing.free, freeCount);
    }
  });

  return Array.from(summaryMap.entries())
    .map(([type, { free, total }]) => ({ type, free, total }))
    .filter(s => s.free > 0); // Only show types with available ports
}

// ============================================================================
// NEW: Auto-resolve full cable connection
// ============================================================================

/**
 * Auto-resolve a cable connection between two devices.
 * Infers cable type, picks next free port on both ends.
 * Returns null if incompatible or no free ports.
 */
export function autoResolveCable(
  from: PlacedDevice,
  to: PlacedDevice,
  layout: RackLayout
): AutoResolvedCable | null {
  const cableType = inferCableType(from, to);
  if (!cableType) return null;

  const fromPort = getNextFreePort(from, cableType, layout);
  const toPort = getNextFreePort(to, cableType, layout);

  if (!fromPort || !toPort) return null;

  return {
    fromPort: { type: portTypeForCableType(cableType), index: fromPort.index, side: fromPort.side },
    toPort: { type: portTypeForCableType(cableType), index: toPort.index, side: toPort.side },
    cableType,
    color: DEFAULT_CABLE_COLORS[cableType]
  };
}
