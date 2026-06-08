import type { RackChangeEvent, RackLayout } from '../types/rack';
import { summarizeChecklist } from './checklists';
import { getCommissioningChecklist } from './commissioning';
import { getReadinessChecklist } from './readinessChecklist';

export interface ChangeCalendarWarning {
  eventId: string;
  code: 'overdue' | 'conflict' | 'readiness-blocked' | 'commissioning-blocked';
  detail: string;
}

export interface ChangeCalendarSummary {
  upcoming: RackChangeEvent[];
  overdue: RackChangeEvent[];
  warnings: ChangeCalendarWarning[];
}

function checklistIncomplete(layout: RackLayout, type: 'readiness' | 'commissioning') {
  const sections = type === 'readiness' ? getReadinessChecklist(layout) : getCommissioningChecklist(layout);
  const summary = summarizeChecklist(sections);
  return summary.failed > 0 || summary.pending > 0;
}

export function sortChangeEvents(events: RackChangeEvent[]) {
  return [...events].sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
}

export function getChangeCalendarSummary(layout: RackLayout, now = new Date()): ChangeCalendarSummary {
  const events = sortChangeEvents(layout.changeEvents ?? []);
  const upcoming: RackChangeEvent[] = [];
  const overdue: RackChangeEvent[] = [];
  const warnings: ChangeCalendarWarning[] = [];
  const readinessBlocked = checklistIncomplete(layout, 'readiness');
  const commissioningBlocked = checklistIncomplete(layout, 'commissioning');

  for (const event of events) {
    const eventTime = new Date(event.scheduledFor).getTime();
    if (!Number.isFinite(eventTime)) continue;

    if (event.status === 'planned' && eventTime < now.getTime()) {
      overdue.push(event);
      warnings.push({
        eventId: event.id,
        code: 'overdue',
        detail: `${event.title} is still planned but its scheduled time has already passed.`
      });
    } else if (event.status === 'planned' || event.status === 'in-progress') {
      upcoming.push(event);
    }

    if (event.status === 'planned' && event.requiresReadiness && readinessBlocked) {
      warnings.push({
        eventId: event.id,
        code: 'readiness-blocked',
        detail: `${event.title} depends on a readiness checklist that is not fully passed yet.`
      });
    }

    if (event.status === 'planned' && event.requiresCommissioning && commissioningBlocked) {
      warnings.push({
        eventId: event.id,
        code: 'commissioning-blocked',
        detail: `${event.title} depends on a commissioning checklist that is not fully passed yet.`
      });
    }
  }

  for (let index = 0; index < events.length; index += 1) {
    const current = events[index];
    if (current.status !== 'planned' || current.riskLevel === 'low') continue;
    for (let nextIndex = index + 1; nextIndex < events.length; nextIndex += 1) {
      const next = events[nextIndex];
      if (next.status !== 'planned' || next.riskLevel === 'low') continue;
      const deltaMs = Math.abs(new Date(next.scheduledFor).getTime() - new Date(current.scheduledFor).getTime());
      if (!Number.isFinite(deltaMs) || deltaMs > 1000 * 60 * 60 * 48) break;
      warnings.push({
        eventId: current.id,
        code: 'conflict',
        detail: `${current.title} and ${next.title} are both risky changes scheduled within 48 hours.`
      });
    }
  }

  return { upcoming, overdue, warnings };
}

function formatIcsDate(timestamp: string) {
  const date = new Date(timestamp);
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function exportChangeCalendarIcs(layout: RackLayout) {
  const events = sortChangeEvents(layout.changeEvents ?? []);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Homelab Rack Simulator//Rack Change Calendar//EN'
  ];

  events.forEach((event) => {
    const start = new Date(event.scheduledFor);
    if (Number.isNaN(start.getTime())) return;
    const end = new Date(start.getTime() + Math.max(30, event.expectedDowntimeMin ?? 60) * 60 * 1000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@homelab-rack-simulator`,
      `DTSTAMP:${formatIcsDate(new Date().toISOString())}`,
      `DTSTART:${formatIcsDate(event.scheduledFor)}`,
      `DTEND:${formatIcsDate(end.toISOString())}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${[
        `Risk: ${event.riskLevel}`,
        event.owner ? `Owner: ${event.owner}` : undefined,
        event.notes ? `Notes: ${event.notes}` : undefined,
        event.rollbackNotes ? `Rollback: ${event.rollbackNotes}` : undefined
      ].filter(Boolean).join('\\n')}`,
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\n');
}
