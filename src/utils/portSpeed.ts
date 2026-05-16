import type { CableRoute, PlacedDevice, PortSpeed, MediaType } from '../types/rack';

export interface DevicePortSpeedEntry {
  deviceId: string;
  deviceName: string;
  face: 'front' | 'rear';
  portType: string;
  count: number;
  speed?: PortSpeed;
  mediaType?: MediaType;
}

export interface CableSpeedEntry {
  cableId: string;
  fromDevice: string;
  toDevice: string;
  type: string;
  speed?: PortSpeed;
  mediaType?: MediaType;
}

export interface SpeedMismatch {
  id: string;
  cableId: string;
  severity: 'warning' | 'critical';
  title: string;
  detail: string;
}

export function getDevicePortSpeeds(devices: PlacedDevice[]): DevicePortSpeedEntry[] {
  const entries: DevicePortSpeedEntry[] = [];
  for (const d of devices) {
    if (d.portLayouts) {
      for (const [face, configs] of Object.entries(d.portLayouts)) {
        for (const cfg of configs ?? []) {
          entries.push({
            deviceId: d.id,
            deviceName: d.name,
            face: face as 'front' | 'rear',
            portType: cfg.type,
            count: cfg.count ?? 0,
            speed: cfg.speed,
            mediaType: cfg.mediaType,
          });
        }
      }
    }
  }
  return entries;
}

export function getCableSpeedEntries(
  cables: CableRoute[],
  devices: PlacedDevice[]
): CableSpeedEntry[] {
  const deviceName = (id: string) => devices.find((d) => d.id === id)?.name ?? id;
  return cables.map((c) => ({
    cableId: c.id,
    fromDevice: deviceName(c.fromDeviceId),
    toDevice: deviceName(c.toDeviceId),
    type: c.type,
    speed: c.speed,
    mediaType: c.mediaType,
  }));
}

export function findSpeedMismatches(cables: CableRoute[], devices: PlacedDevice[]): SpeedMismatch[] {
  const issues: SpeedMismatch[] = [];
  for (const c of cables) {
    if (!c.fromPort || !c.toPort) continue;
    const fromDevice = devices.find((d) => d.id === c.fromDeviceId);
    const toDevice = devices.find((d) => d.id === c.toDeviceId);
    if (!fromDevice || !toDevice) continue;

    const fromPortConfig = fromDevice.portLayouts?.[c.fromPort.side ?? 'front']?.find(
      (p) => p.type === c.fromPort!.type
    );
    const toPortConfig = toDevice.portLayouts?.[c.toPort.side ?? 'front']?.find(
      (p) => p.type === c.toPort!.type
    );

    if (fromPortConfig?.speed && toPortConfig?.speed && fromPortConfig.speed !== toPortConfig.speed) {
      issues.push({
        id: `speed-mismatch-${c.id}`,
        cableId: c.id,
        severity: 'warning',
        title: 'Port speed mismatch',
        detail: `${fromDevice.name} (${fromPortConfig.speed}) ↔ ${toDevice.name} (${toPortConfig.speed})`,
      });
    }

    if (c.speed && fromPortConfig?.speed && c.speed !== fromPortConfig.speed) {
      issues.push({
        id: `speed-cable-mismatch-${c.id}`,
        cableId: c.id,
        severity: 'warning',
        title: 'Cable speed mismatch',
        detail: `Cable is ${c.speed} but ${fromDevice.name} port is ${fromPortConfig.speed}`,
      });
    }
  }
  return issues;
}

export function summarizePortSpeeds(devices: PlacedDevice[], cables: CableRoute[]) {
  const portSpeeds = getDevicePortSpeeds(devices);
  const cableEntries = getCableSpeedEntries(cables, devices);
  const mismatches = findSpeedMismatches(cables, devices);

  const speedCounts: Record<string, number> = {};
  for (const p of portSpeeds) {
    if (p.speed) {
      speedCounts[p.speed] = (speedCounts[p.speed] ?? 0) + p.count;
    }
  }

  const mediaCounts: Record<string, number> = {};
  for (const p of portSpeeds) {
    if (p.mediaType) {
      mediaCounts[p.mediaType] = (mediaCounts[p.mediaType] ?? 0) + p.count;
    }
  }

  return {
    totalPorts: portSpeeds.reduce((sum, p) => sum + p.count, 0),
    portsWithSpeed: portSpeeds.filter((p) => p.speed).reduce((sum, p) => sum + p.count, 0),
    portsWithMedia: portSpeeds.filter((p) => p.mediaType).reduce((sum, p) => sum + p.count, 0),
    totalCables: cables.length,
    cablesWithSpeed: cableEntries.filter((c) => c.speed).length,
    cablesWithMedia: cableEntries.filter((c) => c.mediaType).length,
    mismatchCount: mismatches.length,
    speedCounts,
    mediaCounts,
  };
}

export function exportPortSpeedMarkdown(devices: PlacedDevice[], cables: CableRoute[]): string {
  const portSpeeds = getDevicePortSpeeds(devices);
  const cableEntries = getCableSpeedEntries(cables, devices);
  const mismatches = findSpeedMismatches(cables, devices);

  const lines: string[] = [
    '# Port Speed / Media Type Report',
    '',
    '## Device Ports',
    '',
    '| Device | Face | Type | Count | Speed | Media |',
    '|--------|------|------|-------|-------|-------|',
  ];

  for (const p of portSpeeds) {
    lines.push(`| ${p.deviceName} | ${p.face} | ${p.portType} | ${p.count} | ${p.speed ?? '-'} | ${p.mediaType ?? '-'} |`);
  }

  lines.push('', '## Cables', '', '| From | To | Type | Speed | Media |', '|------|------|------|-------|-------|');
  for (const c of cableEntries) {
    lines.push(`| ${c.fromDevice} | ${c.toDevice} | ${c.type} | ${c.speed ?? '-'} | ${c.mediaType ?? '-'} |`);
  }

  if (mismatches.length > 0) {
    lines.push('', '## Mismatches', '');
    for (const m of mismatches) {
      lines.push(`- **${m.title}**: ${m.detail}`);
    }
  }

  lines.push('', '---', '', '*Generated by Homelab Rack Simulator*', '');
  return lines.join('\n');
}
