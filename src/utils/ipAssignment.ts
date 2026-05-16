import type { NetworkInterface, PlacedDevice } from '../types/rack';

export interface IpAssignmentSummary {
  totalDevices: number;
  devicesWithInterfaces: number;
  totalInterfaces: number;
  withStaticIp: number;
  withDhcp: number;
  withVlan: number;
  withMac: number;
  duplicateIps: number;
  duplicateMacs: number;
  conflictingVlans: number;
}

export interface IpConflict {
  kind: 'duplicate-ip' | 'duplicate-mac' | 'invalid-ip' | 'invalid-mac' | 'invalid-vlan';
  value: string;
  deviceIds: string[];
  deviceNames: string[];
  message: string;
}

function isValidIp(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = Number(p);
    return !Number.isNaN(n) && n >= 0 && n <= 255 && String(n) === p;
  });
}

function isValidMac(mac: string): boolean {
  return /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(mac);
}

function isValidVlan(vlanId: number): boolean {
  return Number.isInteger(vlanId) && vlanId >= 1 && vlanId <= 4094;
}

export function detectIpConflicts(devices: PlacedDevice[]): IpConflict[] {
  const conflicts: IpConflict[] = [];
  const ipMap = new Map<string, { deviceIds: string[]; deviceNames: string[] }>();
  const macMap = new Map<string, { deviceIds: string[]; deviceNames: string[] }>();

  for (const device of devices) {
    for (const iface of device.networkInterfaces ?? []) {
      if (iface.staticIp) {
        if (!isValidIp(iface.staticIp)) {
          conflicts.push({
            kind: 'invalid-ip',
            value: iface.staticIp,
            deviceIds: [device.id],
            deviceNames: [device.name],
            message: `Invalid IP address: ${iface.staticIp}`,
          });
        } else {
          const key = iface.staticIp;
          const existing = ipMap.get(key);
          if (existing) {
            existing.deviceIds.push(device.id);
            existing.deviceNames.push(device.name);
          } else {
            ipMap.set(key, { deviceIds: [device.id], deviceNames: [device.name] });
          }
        }
      }

      if (iface.macAddress) {
        if (!isValidMac(iface.macAddress)) {
          conflicts.push({
            kind: 'invalid-mac',
            value: iface.macAddress,
            deviceIds: [device.id],
            deviceNames: [device.name],
            message: `Invalid MAC address: ${iface.macAddress}`,
          });
        } else {
          const key = iface.macAddress.toLowerCase();
          const existing = macMap.get(key);
          if (existing) {
            existing.deviceIds.push(device.id);
            existing.deviceNames.push(device.name);
          } else {
            macMap.set(key, { deviceIds: [device.id], deviceNames: [device.name] });
          }
        }
      }

      if (iface.vlanId != null && !isValidVlan(iface.vlanId)) {
        conflicts.push({
          kind: 'invalid-vlan',
          value: String(iface.vlanId),
          deviceIds: [device.id],
          deviceNames: [device.name],
          message: `Invalid VLAN ID: ${iface.vlanId} (must be 1-4094)`,
        });
      }
    }
  }

  for (const [ip, info] of ipMap) {
    if (info.deviceIds.length > 1) {
      conflicts.push({
        kind: 'duplicate-ip',
        value: ip,
        deviceIds: info.deviceIds,
        deviceNames: info.deviceNames,
        message: `Duplicate IP: ${ip} used by ${info.deviceNames.join(', ')}`,
      });
    }
  }

  for (const [mac, info] of macMap) {
    if (info.deviceIds.length > 1) {
      conflicts.push({
        kind: 'duplicate-mac',
        value: mac,
        deviceIds: info.deviceIds,
        deviceNames: info.deviceNames,
        message: `Duplicate MAC: ${mac} used by ${info.deviceNames.join(', ')}`,
      });
    }
  }

  return conflicts;
}

export function summarizeIpAssignments(devices: PlacedDevice[]): IpAssignmentSummary {
  let devicesWithInterfaces = 0;
  let totalInterfaces = 0;
  let withStaticIp = 0;
  let withDhcp = 0;
  let withVlan = 0;
  let withMac = 0;

  for (const device of devices) {
    const ifaces = device.networkInterfaces ?? [];
    if (ifaces.length > 0) devicesWithInterfaces += 1;
    totalInterfaces += ifaces.length;

    for (const iface of ifaces) {
      if (iface.staticIp?.trim()) withStaticIp += 1;
      if (iface.dhcpReservation) withDhcp += 1;
      if (iface.vlanId != null) withVlan += 1;
      if (iface.macAddress?.trim()) withMac += 1;
    }
  }

  const conflicts = detectIpConflicts(devices);

  return {
    totalDevices: devices.length,
    devicesWithInterfaces,
    totalInterfaces,
    withStaticIp,
    withDhcp,
    withVlan,
    withMac,
    duplicateIps: conflicts.filter((c) => c.kind === 'duplicate-ip').length,
    duplicateMacs: conflicts.filter((c) => c.kind === 'duplicate-mac').length,
    conflictingVlans: conflicts.filter((c) => c.kind === 'invalid-vlan').length,
  };
}

export function exportIpTableCsv(devices: PlacedDevice[]): string {
  const headers = ['Device Name', 'Interface', 'MAC Address', 'Static IP', 'DHCP', 'VLAN', 'Subnet', 'Gateway', 'DNS'];
  const lines: string[] = [headers.join(',')];

  function escape(value: string | number | boolean | undefined): string {
    if (value == null) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  for (const device of devices) {
    for (const iface of device.networkInterfaces ?? []) {
      const row = [
        escape(device.name),
        escape(iface.name),
        escape(iface.macAddress),
        escape(iface.staticIp),
        escape(iface.dhcpReservation ? 'Yes' : 'No'),
        escape(iface.vlanId),
        escape(iface.subnet),
        escape(iface.gateway),
        escape(iface.dns),
      ];
      lines.push(row.join(','));
    }
  }

  return lines.join('\n');
}

export function exportIpTableMarkdown(devices: PlacedDevice[]): string {
  const summary = summarizeIpAssignments(devices);
  const conflicts = detectIpConflicts(devices);

  const lines: string[] = [
    '# IP Address & VLAN Assignment Table',
    '',
    `**Total Devices:** ${summary.totalDevices}  `,
    `**Devices with Interfaces:** ${summary.devicesWithInterfaces}  `,
    `**Total Interfaces:** ${summary.totalInterfaces}  `,
    `**Static IPs:** ${summary.withStaticIp}  `,
    `**DHCP Reservations:** ${summary.withDhcp}  `,
    `**VLANs Assigned:** ${summary.withVlan}  `,
    `**MACs Recorded:** ${summary.withMac}`,
    '',
    '| Device | Interface | MAC | IP | DHCP | VLAN | Subnet | Gateway | DNS |',
    '|--------|-----------|-----|----|------|------|--------|---------|-----|',
  ];

  for (const device of devices) {
    for (const iface of device.networkInterfaces ?? []) {
      const ip = iface.staticIp ?? '-';
      const mac = iface.macAddress ?? '-';
      const dhcp = iface.dhcpReservation ? 'Yes' : 'No';
      const vlan = iface.vlanId != null ? String(iface.vlanId) : '-';
      const subnet = iface.subnet ?? '-';
      const gateway = iface.gateway ?? '-';
      const dns = iface.dns ?? '-';
      lines.push(`| ${device.name} | ${iface.name} | ${mac} | ${ip} | ${dhcp} | ${vlan} | ${subnet} | ${gateway} | ${dns} |`);
    }
  }

  if (conflicts.length > 0) {
    lines.push('', '## Conflicts & Issues', '');
    for (const conflict of conflicts) {
      lines.push(`- **${conflict.kind}**: ${conflict.message}`);
    }
  }

  return lines.join('\n');
}
