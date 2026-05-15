import type { PlacedDevice, PortRef, RackLayout } from '../types/rack';
import { isZeroU } from './rackMath';

export interface DocumentationIssue {
  id: string;
  severity: 'info' | 'warning';
  title: string;
  detail: string;
  deviceIds: string[];
  cableIds?: string[];
}

function needsPower(device: PlacedDevice): boolean {
  const poweredCategories = new Set([
    'server', 'switch', 'router', 'firewall', 'nas', 'mini-pc', 'sbc',
    'access-point', 'poe-injector', 'ip-kvm', 'modem', 'patch-panel',
    'ups', 'pdu', 'pdu-0u', 'custom'
  ]);
  if (!poweredCategories.has(device.category)) return false;
  // Power distribution devices always need a power feed regardless of their own draw
  if (device.category === 'pdu' || device.category === 'pdu-0u' || device.category === 'ups') {
    return true;
  }
  // Devices with power ports need power regardless of estimated draw (template may be 0W)
  if ((device.ports?.power ?? 0) > 0) return true;
  return device.powerW > 0;
}

function needsNetwork(device: PlacedDevice): boolean {
  const networkedCategories = new Set([
    'server', 'switch', 'router', 'firewall', 'nas', 'mini-pc', 'sbc',
    'access-point', 'poe-injector', 'ip-kvm', 'modem', 'custom'
  ]);
  return networkedCategories.has(device.category);
}

function getPortCapacity(device: PlacedDevice, port: PortRef | undefined): number {
  if (!port) return 0;
  return device.ports?.[port.type] ?? 0;
}

function hasCustomPortMap(device: PlacedDevice): boolean {
  return Boolean(device.portLayouts?.front?.length || device.portLayouts?.rear?.length || device.portFaceOverrides);
}

export function getDocumentationIssues(layout: RackLayout): DocumentationIssue[] {
  const issues: DocumentationIssue[] = [];
  const deviceMap = new Map(layout.devices.map((device) => [device.id, device]));

  for (const device of layout.devices) {
    if (isZeroU(device)) continue;

    // Missing label
    if (!device.label || device.label.trim().length === 0) {
      if (device.category !== 'blank' && device.category !== 'cable-management') {
        issues.push({
          id: `missing-label-${device.id}`,
          severity: 'info',
          title: `${device.name} has no label`,
          detail: 'Adding a label helps technicians identify the device without opening management interfaces.',
          deviceIds: [device.id],
        });
      }
    }

    // No power connection
    if (needsPower(device)) {
      const hasPowerCable = layout.cables.some(
        (c) =>
          c.type === 'power' &&
          (c.fromDeviceId === device.id || c.toDeviceId === device.id)
      );
      if (!hasPowerCable) {
        issues.push({
          id: `no-power-${device.id}`,
          severity: 'warning',
          title: `${device.name} has no power cable`,
          detail: `This device draws ${device.powerW}W but is not connected to any PDU or UPS.`,
          deviceIds: [device.id],
        });
      }
    }

    // Unused network ports
    if (needsNetwork(device)) {
      const ethPorts = device.ports?.ethernet ?? 0;
      const fiberPorts = device.ports?.fiber ?? 0;
      const totalNetPorts = ethPorts + fiberPorts;
      if (totalNetPorts > 0) {
        const usedPorts = layout.cables.filter(
          (c) =>
            (c.fromDeviceId === device.id || c.toDeviceId === device.id) &&
            (c.type === 'ethernet' || c.type === 'fiber' || c.type === 'structured' || c.type === 'patch')
        ).length;
        if (usedPorts === 0) {
          issues.push({
            id: `no-network-${device.id}`,
            severity: 'warning',
            title: `${device.name} has no network cables`,
            detail: `Device has ${totalNetPorts} network port${totalNetPorts === 1 ? '' : 's'} but no Ethernet or fiber connection.`,
            deviceIds: [device.id],
          });
        }
      }
    }

    // Unconnected ports with remaining capacity
    const powerPorts = device.ports?.power ?? 0;
    if (powerPorts > 0) {
      const usedPower = layout.cables.filter(
        (c) =>
          c.type === 'power' &&
          (c.fromDeviceId === device.id || c.toDeviceId === device.id)
      ).length;
      if (usedPower < powerPorts && needsPower(device)) {
        issues.push({
          id: `unused-power-ports-${device.id}`,
          severity: 'info',
          title: `${device.name} has unused power ports`,
          detail: `${usedPower} of ${powerPorts} power port${powerPorts === 1 ? '' : 's'} connected. Consider redundant power if the device supports dual PSU.`,
          deviceIds: [device.id],
        });
      }
    }

    const totalDeclaredPorts = Object.entries(device.ports ?? {}).reduce((sum, [key, value]) => {
      if (key === 'layoutColumns') return sum;
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);

    if (device.category === 'custom' && totalDeclaredPorts > 0 && !hasCustomPortMap(device)) {
      issues.push({
        id: `incomplete-port-map-${device.id}`,
        severity: 'info',
        title: `${device.name} uses an inferred port map`,
        detail: 'Custom gear with declared ports but no explicit front/rear port map is harder to document and audit accurately.',
        deviceIds: [device.id],
      });
    }
  }

  for (const cable of layout.cables) {
    const fromDevice = deviceMap.get(cable.fromDeviceId);
    const toDevice = deviceMap.get(cable.toDeviceId);

    if (!fromDevice || !toDevice) {
      issues.push({
        id: `stale-endpoint-${cable.id}`,
        severity: 'warning',
        title: `Cable ${cable.id} points to a missing endpoint`,
        detail: 'This route still references a device that is no longer present in the layout. Reconnect or remove the stale cable record.',
        deviceIds: [cable.fromDeviceId, cable.toDeviceId].filter((deviceId) => deviceMap.has(deviceId)),
        cableIds: [cable.id],
      });
      continue;
    }

    if (!cable.fromPort || !cable.toPort) {
      issues.push({
        id: `missing-endpoint-labels-${cable.id}`,
        severity: 'info',
        title: `${fromDevice.name} ↔ ${toDevice.name} is missing endpoint port labels`,
        detail: 'Both cable ends should record explicit port numbers so maintenance and label exports stay trustworthy.',
        deviceIds: [fromDevice.id, toDevice.id],
        cableIds: [cable.id],
      });
    }

    if (cable.fromPort) {
      const fromCapacity = getPortCapacity(fromDevice, cable.fromPort);
      if (fromCapacity <= cable.fromPort.index) {
        issues.push({
          id: `invalid-port-map-${cable.id}-from`,
          severity: 'warning',
          title: `${fromDevice.name} port reference is out of range`,
          detail: `${cable.fromPort.type} ${cable.fromPort.index + 1} is documented on the cable, but ${fromDevice.name} only declares ${fromCapacity} ${cable.fromPort.type} port${fromCapacity === 1 ? '' : 's'}.`,
          deviceIds: [fromDevice.id],
          cableIds: [cable.id],
        });
      }
    }

    if (cable.toPort) {
      const toCapacity = getPortCapacity(toDevice, cable.toPort);
      if (toCapacity <= cable.toPort.index) {
        issues.push({
          id: `invalid-port-map-${cable.id}-to`,
          severity: 'warning',
          title: `${toDevice.name} port reference is out of range`,
          detail: `${cable.toPort.type} ${cable.toPort.index + 1} is documented on the cable, but ${toDevice.name} only declares ${toCapacity} ${cable.toPort.type} port${toCapacity === 1 ? '' : 's'}.`,
          deviceIds: [toDevice.id],
          cableIds: [cable.id],
        });
      }
    }
  }

  return issues;
}
