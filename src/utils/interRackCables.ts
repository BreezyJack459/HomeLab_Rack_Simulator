import type { CableRoute, InterRackCable, InterRackCableType, MediaType, PlacedDevice, PortRef, Workspace } from '../types/rack';
import { buildPortLayout, getPortMetadata, resolvePortFace } from './portLayout';
import { portOptionsForDevice } from './portSelection';
import { isPortReserved } from './portReservations';
import { getDeviceWidthMm } from './rackMath';
import { checkConnectorCompatibility, type ConnectorCompatibility } from './connectorCompatibility';

export const checkInterRackConnectors = (workspace: Workspace, cable: Omit<InterRackCable, 'id'>): ConnectorCompatibility => {
  const rack = workspace.racks.find(r => r.id === cable.fromRackId);
  const from = rack?.devices.find(d => d.id === cable.fromDeviceId);
  const to = workspace.racks.find(r => r.id === cable.toRackId)?.devices.find(d => d.id === cable.toDeviceId);
  if (!rack || !from || !to) return { status: 'unverified', conflicts: [], unknowns: ['Endpoint devices are missing.'] };
  if (cable.socketFit !== undefined && (!cable.socketFit || typeof cable.socketFit !== 'object' || Array.isArray(cable.socketFit) ||
      Object.values(cable.socketFit).some(value => value !== undefined && typeof value !== 'string'))) {
    return { status: 'conflict', conflicts: ['Cable-end socket identities must be text.'], unknowns: [] };
  }
  // Device ids are only unique within a rack; isolate endpoints before using
  // the shared checker so equal ids across two racks never resolve to one device.
  return checkConnectorCompatibility({ ...rack, devices: [{ ...from, id: 'from' }, { ...to, id: 'to' }] }, {
    id: 'inter-rack-check', fromDeviceId: 'from', toDeviceId: 'to', fromPort: cable.fromPort, toPort: cable.toPort,
    type: cable.type === 'cat6a' ? 'ethernet' : 'fiber', color: cable.color ?? '#000', socketFit: cable.socketFit,
  });
};

export const interRackPortType = (type: InterRackCableType) => type === 'cat6a' ? 'ethernet' : 'fiber';

// Unknown metadata keeps legacy generic ports usable. Explicit media must fit
// the selected cable; adapters/breakouts are not represented by this workflow.
const mediaForType: Record<InterRackCableType, readonly MediaType[]> = {
  cat6a: ['rj45'],
  fiber: ['fiber', 'sfp', 'sfp+', 'sfp28', 'qsfp+'],
  'sfp+': ['sfp+', 'sfp28'],
  dac: ['dac', 'sfp', 'sfp+', 'sfp28', 'qsfp+'],
};

// A patch-panel jack has separate front/rear terminations. Other devices use
// the canonical face map even when older regular cables have a stale side.
const portsOverlap = (device: PlacedDevice | undefined, claim: PortRef | undefined, port: PortRef): boolean =>
  Boolean(claim && claim.type === port.type && claim.index === port.index &&
    (device?.category !== 'patch-panel' || !claim.side || !port.side || claim.side === port.side));

export const isInterRackPortUsed = (
  workspace: Workspace, rackId: string, deviceId: string, port: PortRef, excludeId?: string,
): boolean => {
  const device = workspace.racks.find(rack => rack.id === rackId)?.devices.find(d => d.id === deviceId);
  return workspace.interRackCables.some(cable => {
    if (cable.id === excludeId) return false;
    const matches = (claimRack: string, claimDevice: string, claim?: PortRef) =>
      claimRack === rackId && claimDevice === deviceId && portsOverlap(device, claim, port);
    return matches(cable.fromRackId, cable.fromDeviceId, cable.fromPort) || matches(cable.toRackId, cable.toDeviceId, cable.toPort);
  });
};

export const interRackEndpointError = (
  workspace: Workspace, rackId: string, deviceId: string, port: PortRef | null | undefined,
  type: InterRackCableType, excludeId?: string,
): string | null => {
  const rack = workspace.racks.find(r => r.id === rackId);
  const device = rack?.devices.find(d => d.id === deviceId);
  if (!rack || !device) return 'Endpoint rack or device not found.';
  if (!port || !mediaForType[type] || port.type !== interRackPortType(type)) return 'Cable type does not match the endpoint port type.';
  const count = device.ports?.[port.type] ?? 0;
  if (!Number.isInteger(port.index) || port.index < 0 || port.index >= count) return 'Endpoint port index is out of range.';
  if (port.side !== undefined && port.side !== 'front' && port.side !== 'rear') return 'Invalid port face.';
  const face = resolvePortFace(device, port);
  if (port.side && port.side !== face) return 'Endpoint port does not exist on this face.';
  const groups = buildPortLayout(device, getDeviceWidthMm(device), device.sizeU * 44.45, face);
  // Patch-panel rear terminations are logical ports in portSelection; the
  // faceplate geometry only renders their front jacks.
  const exists = device.category === 'patch-panel'
    ? portOptionsForDevice(device, interRackPortType(type), rack).some(option => option.index === port.index && option.side === face)
    : groups.some(group => group.slots.some(slot => slot.type === port.type && slot.index === port.index));
  if (!exists) return 'Endpoint port does not exist on this face.';
  const media = getPortMetadata(device, face, port.type, port.index)?.mediaType;
  if (media && !mediaForType[type].includes(media)) return `${type.toUpperCase()} is incompatible with ${media} port media.`;
  if (isPortReserved(rack.portReservations ?? [], deviceId, port.type, port.index)) return 'Endpoint port is reserved.';
  const regularClaim = rack.cables.some(cable =>
    (cable.fromDeviceId === deviceId && portsOverlap(device, cable.fromPort, port)) ||
    (cable.toDeviceId === deviceId && portsOverlap(device, cable.toPort, port)));
  if (regularClaim || isInterRackPortUsed(workspace, rackId, deviceId, port, excludeId)) return 'Endpoint port is already used.';
  return null;
};

export const validateInterRackCable = (
  workspace: Workspace, cable: Omit<InterRackCable, 'id'>, excludeId?: string, checkRecordedConnectors = true,
): string | null => {
  if (cable.poe !== undefined && typeof cable.poe !== 'boolean') return 'PoE intent must be boolean.';
  if (cable.fromRackId === cable.toRackId) return 'Inter-rack cables need two different racks.';
  const fromError = interRackEndpointError(workspace, cable.fromRackId, cable.fromDeviceId, cable.fromPort, cable.type, excludeId);
  if (fromError) return `Source: ${fromError}`;
  const toError = interRackEndpointError(workspace, cable.toRackId, cable.toDeviceId, cable.toPort, cable.type, excludeId);
  if (toError) return `Destination: ${toError}`;
  if (checkRecordedConnectors) {
    const connectors = checkInterRackConnectors(workspace, cable);
    if (connectors.status === 'conflict') return connectors.conflicts.join(' ');
  }
  if (cable.type === 'dac') {
    const media = (rackId: string, deviceId: string, port: PortRef) => {
      const device = workspace.racks.find(r => r.id === rackId)!.devices.find(d => d.id === deviceId)!;
      return getPortMetadata(device, resolvePortFace(device, port), port.type, port.index)?.mediaType;
    };
    const from = media(cable.fromRackId, cable.fromDeviceId, cable.fromPort);
    const to = media(cable.toRackId, cable.toDeviceId, cable.toPort);
    if (from && to && from !== 'dac' && to !== 'dac' && from !== to) return 'DAC endpoint connector media must match; breakout cables are not supported.';
  }
  return null;
};

export const interRackPortOptions = (workspace: Workspace, rackId: string, deviceId: string, type: InterRackCableType) => {
  const rack = workspace.racks.find(r => r.id === rackId);
  const device = rack?.devices.find(d => d.id === deviceId);
  if (!rack || !device) return [];
  return portOptionsForDevice(device, interRackPortType(type), rack).map(option => {
    const reason = interRackEndpointError(workspace, rackId, deviceId, { type: interRackPortType(type), index: option.index, side: option.side }, type);
    return { ...option, disabled: Boolean(reason), reason };
  });
};

// First valid claim wins on import/load. Preserve references if no repairs are
// needed, so the store subscriber does not create history or persistence loops.
export const pruneInvalidInterRackCables = (workspace: Workspace): Workspace => {
  const accepted: InterRackCable[] = [];
  for (const cable of workspace.interRackCables) {
    if (!cable || !cable.id || accepted.some(c => c.id === cable.id)) continue;
    // Recorded spec edits may expose a conflict in an existing connection.
    // Preserve that record for review instead of silently deleting it on load.
    if (!validateInterRackCable({ ...workspace, interRackCables: accepted }, cable, undefined, false)) accepted.push(cable);
  }
  return accepted.length === workspace.interRackCables.length ? workspace : { ...workspace, interRackCables: accepted };
};

export const routeUsesInterRackPort = (workspace: Workspace, rackId: string, route: Omit<CableRoute, 'id'>): boolean =>
  Boolean((route.fromPort && isInterRackPortUsed(workspace, rackId, route.fromDeviceId, route.fromPort)) ||
    (route.toPort && isInterRackPortUsed(workspace, rackId, route.toDeviceId, route.toPort)));
