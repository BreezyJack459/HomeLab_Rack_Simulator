import type { BackupRecord, PlacedDevice } from '../types/rack';

export const DAYS_UNTIL_RESTORE_ALERT = 90;

export function daysSince(dateIso?: string): number | null {
  if (!dateIso) return null;
  const then = new Date(dateIso);
  const now = new Date();
  const ms = now.getTime() - then.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function isRestoreOverdue(record: BackupRecord): boolean {
  const days = daysSince(record.lastRestoreTestDate);
  if (days === null) return true;
  return days > DAYS_UNTIL_RESTORE_ALERT;
}

export function isBackupStale(record: BackupRecord, rpoHours = 24): boolean {
  const days = daysSince(record.lastBackupDate);
  if (days === null) return true;
  return days > Math.ceil(rpoHours / 24) + 1;
}

export interface BackupSummary {
  totalDevices: number;
  devicesWithBackups: number;
  totalBackups: number;
  backupsWithRecentRestore: number;
  overdueRestoreCount: number;
  staleBackupCount: number;
  failedRestoreCount: number;
  passRate: number;
}

export function summarizeBackups(devices: PlacedDevice[]): BackupSummary {
  let totalBackups = 0;
  let recentRestore = 0;
  let overdueRestore = 0;
  let staleBackup = 0;
  let failedRestore = 0;
  let testedCount = 0;

  const devicesWithBackups = devices.filter((d) => (d.backups ?? []).length > 0);

  for (const device of devicesWithBackups) {
    for (const backup of device.backups ?? []) {
      totalBackups += 1;
      if (backup.lastRestoreTestResult === 'pass') {
        testedCount += 1;
      }
      if (backup.lastRestoreTestResult === 'fail') {
        failedRestore += 1;
        testedCount += 1;
      }
      if (isRestoreOverdue(backup)) {
        overdueRestore += 1;
      } else if (backup.lastRestoreTestResult === 'pass') {
        recentRestore += 1;
      }
      if (isBackupStale(backup, backup.rpoHours)) {
        staleBackup += 1;
      }
    }
  }

  const passRate = testedCount > 0 ? Math.round((recentRestore / testedCount) * 100) : 0;

  return {
    totalDevices: devices.length,
    devicesWithBackups: devicesWithBackups.length,
    totalBackups,
    backupsWithRecentRestore: recentRestore,
    overdueRestoreCount: overdueRestore,
    staleBackupCount: staleBackup,
    failedRestoreCount: failedRestore,
    passRate,
  };
}

export function deviceBackupHealth(device: PlacedDevice): 'good' | 'warning' | 'critical' | 'unknown' {
  const backups = device.backups ?? [];
  if (backups.length === 0) return 'unknown';

  const hasFail = backups.some((b) => b.lastRestoreTestResult === 'fail');
  if (hasFail) return 'critical';

  const hasOverdue = backups.some((b) => isRestoreOverdue(b));
  const hasStale = backups.some((b) => isBackupStale(b, b.rpoHours));
  if (hasOverdue || hasStale) return 'warning';

  return 'good';
}

export function formatBackupDate(dateIso?: string): string {
  if (!dateIso) return 'Never';
  const days = daysSince(dateIso);
  if (days === null) return 'Never';
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

export function exportBackupReport(devices: PlacedDevice[]): string {
  const lines: string[] = ['# Backup Verification Report', ''];
  const withBackups = devices.filter((d) => (d.backups ?? []).length > 0);

  if (withBackups.length === 0) {
    lines.push('No backup records found.');
    return lines.join('\n');
  }

  for (const device of withBackups) {
    lines.push(`## ${device.name}`);
    for (const backup of device.backups ?? []) {
      lines.push(`- Destination: ${backup.destination}`);
      lines.push(`  Last backup: ${formatBackupDate(backup.lastBackupDate)}`);
      lines.push(`  Size: ${backup.backupSizeGb ?? '-'} GB`);
      lines.push(`  Last restore test: ${formatBackupDate(backup.lastRestoreTestDate)} (${backup.lastRestoreTestResult ?? 'untested'})`);
      lines.push(`  RPO: ${backup.rpoHours ?? '-'} hours`);
      if (backup.notes) lines.push(`  Notes: ${backup.notes}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}
