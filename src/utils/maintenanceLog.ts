import type { MaintenanceLogEntry, MaintenanceLogType, PlacedDevice } from '../types/rack';

export const MAINTENANCE_INTERVAL_DAYS: Record<MaintenanceLogType, number> = {
  cleaning: 90,
  firmware: 180,
  repair: 365,
  inspection: 365,
  replacement: 365,
  other: 365,
};

export interface MaintenanceSummary {
  totalDevices: number;
  devicesWithLogs: number;
  totalEntries: number;
  entriesByType: Record<MaintenanceLogType, number>;
  totalLaborMinutes: number;
  overdueDevices: number;
}

export function summarizeMaintenance(devices: PlacedDevice[]): MaintenanceSummary {
  let devicesWithLogs = 0;
  let totalEntries = 0;
  let totalLaborMinutes = 0;
  let overdueDevices = 0;
  const entriesByType: Record<MaintenanceLogType, number> = {
    cleaning: 0,
    firmware: 0,
    repair: 0,
    inspection: 0,
    replacement: 0,
    other: 0,
  };

  for (const device of devices) {
    const logs = device.maintenanceLog ?? [];
    if (logs.length > 0) {
      devicesWithLogs += 1;
    }
    totalEntries += logs.length;

    for (const entry of logs) {
      entriesByType[entry.type] += 1;
      if (entry.laborMinutes != null && !Number.isNaN(entry.laborMinutes)) {
        totalLaborMinutes += entry.laborMinutes;
      }
    }

    if (isDeviceMaintenanceOverdue(device)) {
      overdueDevices += 1;
    }
  }

  return {
    totalDevices: devices.length,
    devicesWithLogs,
    totalEntries,
    entriesByType,
    totalLaborMinutes,
    overdueDevices,
  };
}

export function isDeviceMaintenanceOverdue(device: PlacedDevice): boolean {
  const logs = device.maintenanceLog ?? [];
  if (logs.length === 0) return false;

  const now = new Date().getTime();

  for (const type of Object.keys(MAINTENANCE_INTERVAL_DAYS) as MaintenanceLogType[]) {
    const intervalDays = MAINTENANCE_INTERVAL_DAYS[type];
    const typeLogs = logs.filter((l) => l.type === type);
    if (typeLogs.length === 0) continue;

    const latest = typeLogs.reduce((latest, current) =>
      new Date(current.date).getTime() > new Date(latest.date).getTime() ? current : latest
    );

    const daysSince = (now - new Date(latest.date).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > intervalDays) {
      return true;
    }
  }

  return false;
}

export interface UpcomingMaintenance {
  deviceId: string;
  deviceName: string;
  type: MaintenanceLogType;
  lastDate: string;
  dueDate: string;
  daysOverdue: number;
}

export function upcomingMaintenance(devices: PlacedDevice[]): UpcomingMaintenance[] {
  const result: UpcomingMaintenance[] = [];
  const now = new Date().getTime();

  for (const device of devices) {
    const logs = device.maintenanceLog ?? [];
    if (logs.length === 0) continue;

    for (const type of Object.keys(MAINTENANCE_INTERVAL_DAYS) as MaintenanceLogType[]) {
      const intervalDays = MAINTENANCE_INTERVAL_DAYS[type];
      const typeLogs = logs.filter((l) => l.type === type);
      if (typeLogs.length === 0) continue;

      const latest = typeLogs.reduce((latest, current) =>
        new Date(current.date).getTime() > new Date(latest.date).getTime() ? current : latest
      );

      const daysSince = (now - new Date(latest.date).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > intervalDays) {
        const dueDate = new Date(new Date(latest.date).getTime() + intervalDays * 24 * 60 * 60 * 1000);
        result.push({
          deviceId: device.id,
          deviceName: device.name,
          type,
          lastDate: latest.date,
          dueDate: dueDate.toISOString().slice(0, 10),
          daysOverdue: Math.floor(daysSince - intervalDays),
        });
      }
    }
  }

  return result.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

export function exportMaintenanceLogMarkdown(devices: PlacedDevice[]): string {
  const summary = summarizeMaintenance(devices);
  const overdue = upcomingMaintenance(devices);
  const lines: string[] = [
    '# Maintenance Log Report',
    '',
    `**Total Devices:** ${summary.totalDevices}  `,
    `**Devices with Logs:** ${summary.devicesWithLogs}  `,
    `**Total Entries:** ${summary.totalEntries}  `,
    `**Overdue Devices:** ${summary.overdueDevices}  `,
    `**Total Labor:** ${summary.totalLaborMinutes} minutes`,
    '',
    '## Entries by Type',
    '',
    ...Object.entries(summary.entriesByType).map(([type, count]) => `- ${type}: ${count}`),
    '',
  ];

  for (const device of devices) {
    const logs = device.maintenanceLog ?? [];
    if (logs.length === 0) continue;
    lines.push(`## ${device.name}`, '');
    for (const entry of logs.sort((a, b) => b.date.localeCompare(a.date))) {
      lines.push(`- **${entry.date}** — ${entry.type}: ${entry.description}`);
      if (entry.partsUsed) lines.push(`  Parts: ${entry.partsUsed}`);
      if (entry.laborMinutes) lines.push(`  Labor: ${entry.laborMinutes} min`);
      if (entry.technician) lines.push(`  Technician: ${entry.technician}`);
      if (entry.notes) lines.push(`  Notes: ${entry.notes}`);
    }
    lines.push('');
  }

  if (overdue.length > 0) {
    lines.push('## Overdue Maintenance', '');
    for (const item of overdue) {
      lines.push(`- **${item.deviceName}** — ${item.type} (${item.daysOverdue} days overdue, due ${item.dueDate})`);
    }
  }

  return lines.join('\n');
}

function escapeCsvField(value: string | number | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportMaintenanceLogCsv(devices: PlacedDevice[]): string {
  const headers = ['Device Name', 'Date', 'Type', 'Description', 'Parts Used', 'Labor Minutes', 'Technician', 'Notes'];
  const lines: string[] = [headers.join(',')];

  for (const device of devices) {
    for (const entry of device.maintenanceLog ?? []) {
      const row = [
        escapeCsvField(device.name),
        escapeCsvField(entry.date),
        escapeCsvField(entry.type),
        escapeCsvField(entry.description),
        escapeCsvField(entry.partsUsed),
        escapeCsvField(entry.laborMinutes),
        escapeCsvField(entry.technician),
        escapeCsvField(entry.notes),
      ];
      lines.push(row.join(','));
    }
  }

  return lines.join('\n');
}
