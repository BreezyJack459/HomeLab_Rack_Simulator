import type { PlacedDevice, RackLayout, RackService, ServiceCriticality } from '../types/rack';

export interface ServiceStatus {
  healthy: boolean;
  missingDevices: string[];
  singlePointOfFailure: boolean;
  spoFDevices: string[];
}

export interface ServiceSummary {
  totalCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  healthyCount: number;
  unhealthyCount: number;
  spoFCount: number;
}

export function getServiceStatus(service: RackService, layout: RackLayout): ServiceStatus {
  const deviceIds = new Set<string>();
  if (service.hostDeviceId) deviceIds.add(service.hostDeviceId);
  if (service.storageDeviceIds) service.storageDeviceIds.forEach((id) => deviceIds.add(id));
  if (service.networkDeviceIds) service.networkDeviceIds.forEach((id) => deviceIds.add(id));
  if (service.powerDeviceIds) service.powerDeviceIds.forEach((id) => deviceIds.add(id));
  if (service.backupDeviceId) deviceIds.add(service.backupDeviceId);

  const missingDevices: string[] = [];
  for (const id of deviceIds) {
    if (!layout.devices.some((d) => d.id === id)) {
      missingDevices.push(id);
    }
  }

  // SPOF: if critical/high service depends on only one device for a given dependency type
  const spoFDevices: string[] = [];
  const checkSpoF = (ids: string[] | undefined) => {
    if (ids && ids.length === 1) spoFDevices.push(ids[0]);
  };
  checkSpoF(service.storageDeviceIds);
  checkSpoF(service.networkDeviceIds);
  checkSpoF(service.powerDeviceIds);

  const isCritical = service.criticality === 'critical' || service.criticality === 'high';
  const singlePointOfFailure = isCritical && spoFDevices.length > 0;

  return {
    healthy: missingDevices.length === 0,
    missingDevices,
    singlePointOfFailure,
    spoFDevices,
  };
}

export function servicesForDevice(services: RackService[], deviceId: string): RackService[] {
  return services.filter((s) => {
    if (s.hostDeviceId === deviceId) return true;
    if (s.storageDeviceIds?.includes(deviceId)) return true;
    if (s.networkDeviceIds?.includes(deviceId)) return true;
    if (s.powerDeviceIds?.includes(deviceId)) return true;
    if (s.backupDeviceId === deviceId) return true;
    return false;
  });
}

export function summarizeServices(services: RackService[], layout: RackLayout): ServiceSummary {
  const criticalCount = services.filter((s) => s.criticality === 'critical').length;
  const highCount = services.filter((s) => s.criticality === 'high').length;
  const mediumCount = services.filter((s) => s.criticality === 'medium').length;
  const lowCount = services.filter((s) => s.criticality === 'low').length;

  let healthyCount = 0;
  let spoFCount = 0;
  for (const s of services) {
    const status = getServiceStatus(s, layout);
    if (status.healthy) healthyCount++;
    if (status.singlePointOfFailure) spoFCount++;
  }

  return {
    totalCount: services.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    healthyCount,
    unhealthyCount: services.length - healthyCount,
    spoFCount,
  };
}

export function findSinglePointsOfFailure(
  services: RackService[],
  layout: RackLayout
): { service: RackService; spoFDevices: string[] }[] {
  const result: { service: RackService; spoFDevices: string[] }[] = [];
  for (const service of services) {
    const status = getServiceStatus(service, layout);
    if (status.singlePointOfFailure) {
      result.push({ service, spoFDevices: status.spoFDevices });
    }
  }
  return result;
}

export function criticalityColor(criticality: ServiceCriticality): string {
  switch (criticality) {
    case 'critical': return 'text-red-600 dark:text-red-400';
    case 'high': return 'text-orange-600 dark:text-orange-400';
    case 'medium': return 'text-amber-600 dark:text-amber-400';
    case 'low': return 'text-slate-600 dark:text-slate-400';
  }
}

export function criticalityBg(criticality: ServiceCriticality): string {
  switch (criticality) {
    case 'critical': return 'bg-red-500/10 border-red-500/30';
    case 'high': return 'bg-orange-500/10 border-orange-500/30';
    case 'medium': return 'bg-amber-500/10 border-amber-500/30';
    case 'low': return 'bg-slate-500/10 border-slate-500/30';
  }
}

export function criticalityLabel(criticality: ServiceCriticality): string {
  switch (criticality) {
    case 'critical': return 'Critical';
    case 'high': return 'High';
    case 'medium': return 'Medium';
    case 'low': return 'Low';
  }
}

export function exportServiceMapMarkdown(services: RackService[], layout: RackLayout): string {
  const deviceName = (id?: string) => layout.devices.find((d) => d.id === id)?.name ?? id ?? '-';

  const lines: string[] = [
    '# Service Map',
    '',
    `**Total Services:** ${services.length}`,
    '',
    '| Service | Criticality | Host | Network | Storage | Power | Backup | Status |',
    '|---------|-------------|------|---------|---------|-------|--------|--------|',
  ];

  for (const s of services) {
    const status = getServiceStatus(s, layout);
    const statusLabel = status.healthy ? 'Healthy' : `Missing: ${status.missingDevices.join(', ')}`;
    lines.push(
      `| ${s.name} | ${criticalityLabel(s.criticality)} | ${deviceName(s.hostDeviceId)} | ${s.networkDeviceIds?.map(deviceName).join(', ') ?? '-'} | ${s.storageDeviceIds?.map(deviceName).join(', ') ?? '-'} | ${s.powerDeviceIds?.map(deviceName).join(', ') ?? '-'} | ${deviceName(s.backupDeviceId)} | ${statusLabel} |`
    );
  }

  const spoF = findSinglePointsOfFailure(services, layout);
  if (spoF.length > 0) {
    lines.push('', '## Single Points of Failure', '');
    for (const { service, spoFDevices } of spoF) {
      lines.push(`- **${service.name}**: depends on ${spoFDevices.map(deviceName).join(', ')}`);
    }
  }

  lines.push('', '---', '', '*Generated by Homelab Rack Simulator*', '');
  return lines.join('\n');
}

export function exportServiceMapCsv(services: RackService[], layout: RackLayout): string {
  const deviceName = (id?: string) => layout.devices.find((d) => d.id === id)?.name ?? id ?? '';

  const headers = ['ID', 'Name', 'Criticality', 'Host', 'Network', 'Storage', 'Power', 'Backup', 'Healthy', 'SPOF'];
  const lines: string[] = [headers.join(',')];

  for (const s of services) {
    const status = getServiceStatus(s, layout);
    const row = [
      s.id,
      `"${s.name.replace(/"/g, '""')}"`,
      criticalityLabel(s.criticality),
      deviceName(s.hostDeviceId),
      s.networkDeviceIds?.map(deviceName).join('; ') ?? '',
      s.storageDeviceIds?.map(deviceName).join('; ') ?? '',
      s.powerDeviceIds?.map(deviceName).join('; ') ?? '',
      deviceName(s.backupDeviceId),
      status.healthy ? 'Yes' : 'No',
      status.singlePointOfFailure ? 'Yes' : 'No',
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}
