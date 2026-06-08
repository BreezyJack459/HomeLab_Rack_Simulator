import type { CleaningEnvironment, CleaningSchedule } from '../types/rack';

export const CLEANING_INTERVAL_DAYS: Record<CleaningEnvironment, number> = {
  bedroom: 90,
  office: 90,
  closet: 60,
  garage: 45,
  basement: 60,
};

export function getCleaningIntervalDays(environment: CleaningEnvironment): number {
  return CLEANING_INTERVAL_DAYS[environment] ?? 60;
}

export function getNextCleaningDue(
  lastCleanedAt: string | undefined,
  environment: CleaningEnvironment
): string | null {
  if (!lastCleanedAt) return null;
  const interval = getCleaningIntervalDays(environment);
  const last = new Date(lastCleanedAt);
  const next = new Date(last);
  next.setDate(next.getDate() + interval);
  return next.toISOString().split('T')[0];
}

export function daysUntilCleaning(
  lastCleanedAt: string | undefined,
  environment: CleaningEnvironment
): number | null {
  if (!lastCleanedAt) return null;
  const dueStr = getNextCleaningDue(lastCleanedAt, environment);
  if (!dueStr) return null;
  const due = new Date(dueStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = due.getTime() - now.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export function isCleaningOverdue(
  lastCleanedAt: string | undefined,
  environment: CleaningEnvironment
): boolean {
  const days = daysUntilCleaning(lastCleanedAt, environment);
  return days !== null && days < 0;
}

export function daysSinceCleaning(lastCleanedAt: string | undefined): number | null {
  if (!lastCleanedAt) return null;
  const last = new Date(lastCleanedAt);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  last.setHours(0, 0, 0, 0);
  const diff = now.getTime() - last.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export interface CleaningChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export function defaultCleaningChecklist(): CleaningChecklistItem[] {
  return [
    { id: 'front-filter', label: 'Clean front dust filter', checked: false },
    { id: 'rear-filter', label: 'Clean rear dust filter', checked: false },
    { id: 'fan-blades', label: 'Dust fan blades and vents', checked: false },
    { id: 'floor-area', label: 'Clean floor under and around rack', checked: false },
    { id: 'cable-dust', label: 'Remove dust from cable bundles', checked: false },
    { id: 'device-tops', label: 'Wipe device tops and surfaces', checked: false },
  ];
}

export function exportCleaningScheduleMarkdown(schedule?: CleaningSchedule): string {
  if (!schedule) {
    return '# Rack Cleaning Schedule\n\nNo cleaning schedule configured.\n';
  }

  const interval = getCleaningIntervalDays(schedule.environment);
  const nextDue = getNextCleaningDue(schedule.lastCleanedAt, schedule.environment);
  const daysLeft = daysUntilCleaning(schedule.lastCleanedAt, schedule.environment);
  const daysAgo = daysSinceCleaning(schedule.lastCleanedAt);
  const overdue = isCleaningOverdue(schedule.lastCleanedAt, schedule.environment);

  const lines: string[] = [
    '# Rack Cleaning Schedule',
    '',
    `**Environment:** ${schedule.environment}`,
    `**Cleaning Interval:** every ${interval} days`,
  ];

  if (schedule.lastCleanedAt) {
    lines.push(`**Last Cleaned:** ${schedule.lastCleanedAt} (${daysAgo} days ago)`);
  } else {
    lines.push('**Last Cleaned:** never');
  }

  if (nextDue) {
    if (overdue) {
      lines.push(`**Next Due:** ${nextDue} (**overdue by ${Math.abs(daysLeft ?? 0)} days**)`);
    } else {
      lines.push(`**Next Due:** ${nextDue} (${daysLeft} days remaining)`);
    }
  } else {
    lines.push('**Next Due:** unknown');
  }

  if (schedule.notes) {
    lines.push('', `**Notes:** ${schedule.notes}`);
  }

  lines.push('', '## Cleaning Checklist', '');
  for (const item of defaultCleaningChecklist()) {
    lines.push(`- [ ] ${item.label}`);
  }

  return lines.join('\n');
}
