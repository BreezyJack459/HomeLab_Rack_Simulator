import type {
  CableRoute,
  CableType,
  PlacedDevice,
  PortRef,
  PortType,
  RackLayout,
} from '../types/rack';
import { resolvePortFace } from './portLayout';

const PORT_TYPES: PortType[] = [
  'ethernet',
  'fiber',
  'usb',
  'hdmi',
  'power',
  'atx',
  'coax',
];

const PORT_ALIAS_PREFIX: Record<PortType, string> = {
  ethernet: 'eth',
  fiber: 'fiber',
  usb: 'usb',
  hdmi: 'hdmi',
  power: 'power',
  atx: 'atx',
  coax: 'coax',
};

export type PortDocumentationConnection = {
  cableId: string;
  cableType: CableType;
  peerDeviceId: string;
  peerDeviceName: string;
  peerDeviceLabel?: string;
  peerPort?: PortRef;
  peerPortAlias?: string;
};

export type PortDocumentationRow = {
  id: string;
  storageKey: string;
  port: PortRef;
  portName: string;
  face: 'front' | 'rear';
  label: string;
  connections: PortDocumentationConnection[];
  suggestedLabel: string;
};

const getLegacyAliasKey = (port: PortRef): string =>
  `${PORT_ALIAS_PREFIX[port.type]}${port.index}`;

export const getCanonicalPortKey = (port: PortRef): string =>
  `${port.type}:${port.index}`;

const getAliasKeyCandidates = (port: PortRef): string[] => [
  getCanonicalPortKey(port),
  getLegacyAliasKey(port),
];

export const getStoredPortAlias = (
  device: PlacedDevice,
  port: PortRef,
): { key: string; value: string } | null => {
  for (const key of getAliasKeyCandidates(port)) {
    const value = device.portAliases?.[key];
    if (value?.trim()) {
      return { key, value: value.trim() };
    }
  }
  return null;
};

export const formatPortName = (port: PortRef): string =>
  `${port.type.charAt(0).toUpperCase()}${port.type.slice(1)} ${port.index + 1}`;

const samePort = (candidate: PortRef | undefined, port: PortRef): boolean =>
  candidate?.type === port.type && candidate.index === port.index;

const getPeerConnection = (
  cable: CableRoute,
  device: PlacedDevice,
  port: PortRef,
  deviceMap: Map<string, PlacedDevice>,
): PortDocumentationConnection | null => {
  const deviceIsSource =
    cable.fromDeviceId === device.id && samePort(cable.fromPort, port);
  const deviceIsDestination =
    cable.toDeviceId === device.id && samePort(cable.toPort, port);

  if (!deviceIsSource && !deviceIsDestination) {
    return null;
  }

  const peerDeviceId = deviceIsSource
    ? cable.toDeviceId
    : cable.fromDeviceId;
  const peerPort = deviceIsSource ? cable.toPort : cable.fromPort;
  const peerDevice = deviceMap.get(peerDeviceId);

  return {
    cableId: cable.id,
    cableType: cable.type,
    peerDeviceId,
    peerDeviceName: peerDevice?.name ?? peerDeviceId,
    peerDeviceLabel: peerDevice?.label,
    peerPort,
    peerPortAlias:
      peerDevice && peerPort
        ? getStoredPortAlias(peerDevice, peerPort)?.value
        : undefined,
  };
};

export const formatConnection = (
  connection: PortDocumentationConnection,
): string => {
  const deviceName =
    connection.peerDeviceLabel?.trim() || connection.peerDeviceName;
  if (!connection.peerPort) {
    return deviceName;
  }
  const portName =
    connection.peerPortAlias?.trim() || formatPortName(connection.peerPort);
  return `${deviceName} / ${portName}`;
};

export const getSwitchPortDocumentation = (
  layout: RackLayout,
  device: PlacedDevice,
): PortDocumentationRow[] => {
  const deviceMap = new Map(layout.devices.map((item) => [item.id, item]));
  const rows: PortDocumentationRow[] = [];

  for (const type of PORT_TYPES) {
    const count = device.ports?.[type] ?? 0;
    for (let index = 0; index < count; index += 1) {
      const port: PortRef = { type, index };
      const storedAlias = getStoredPortAlias(device, port);
      const connections = layout.cables
        .map((cable) => getPeerConnection(cable, device, port, deviceMap))
        .filter(
          (
            connection,
          ): connection is PortDocumentationConnection =>
            connection !== null,
        );

      rows.push({
        id: getCanonicalPortKey(port),
        storageKey: storedAlias?.key ?? getLegacyAliasKey(port),
        port,
        portName: formatPortName(port),
        face: resolvePortFace(device, port),
        label: storedAlias?.value ?? '',
        connections,
        suggestedLabel: connections[0]
          ? formatConnection(connections[0])
          : '',
      });
    }
  }

  return rows;
};

export const mergePortLabelDrafts = (
  device: PlacedDevice,
  rows: PortDocumentationRow[],
  drafts: Record<string, string>,
): Record<string, string> | undefined => {
  const aliases = { ...(device.portAliases ?? {}) };

  for (const row of rows) {
    for (const candidate of getAliasKeyCandidates(row.port)) {
      delete aliases[candidate];
    }
    const value = drafts[row.id]?.trim();
    if (value) {
      aliases[row.storageKey] = value;
    }
  }

  return Object.keys(aliases).length > 0 ? aliases : undefined;
};

const escapeCsvField = (value: string): string => {
  if (!/[",\n]/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
};

export const exportSwitchPortDocumentationCsv = (
  layout: RackLayout,
  device: PlacedDevice,
  aliases = device.portAliases,
): string => {
  const rows = getSwitchPortDocumentation(layout, {
    ...device,
    portAliases: aliases,
  });
  const header = [
    'Switch',
    'Switch Label',
    'Port',
    'Face',
    'Port Label',
    'Status',
    'Connected Device',
    'Connected Device Label',
    'Connected Port',
    'Cable ID',
    'Cable Type',
  ];
  const csvRows: string[][] = [header];

  for (const row of rows) {
    const connections = row.connections.length > 0 ? row.connections : [null];
    for (const connection of connections) {
      csvRows.push([
        device.name,
        device.label ?? '',
        row.portName,
        row.face,
        row.label,
        connection ? 'connected' : 'free',
        connection?.peerDeviceName ?? '',
        connection?.peerDeviceLabel ?? '',
        connection?.peerPort ? formatPortName(connection.peerPort) : '',
        connection?.cableId ?? '',
        connection?.cableType ?? '',
      ]);
    }
  }

  return csvRows
    .map((row) => row.map(escapeCsvField).join(','))
    .join('\n');
};
