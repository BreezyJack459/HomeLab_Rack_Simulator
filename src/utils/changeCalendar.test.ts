import { describe, expect, it } from 'vitest';
import type { RackLayout } from '../types/rack';
import { exportChangeCalendarIcs, getChangeCalendarSummary } from './changeCalendar';

const layout: RackLayout = {
  id: 'layout-1',
  name: 'Lab A',
  rackType: '19in',
  heightU: 12,
  rackDepthMm: 600,
  weightLimitKg: 200,
  powerBudgetW: 900,
  viewSide: 'front',
  devices: [
    {
      id: 'sw1',
      category: 'switch',
      name: 'Switch',
      positionU: 1,
      sizeU: 1,
      depthMm: 200,
      widthType: '19in',
      weightKg: 2,
      powerW: 40,
      heatLevel: 2,
      ports: { ethernet: 8, power: 1 },
      lifecycleStatus: 'planned',
      color: '#0ea5e9'
    }
  ],
  cables: [],
  reservations: [],
  procurementItems: [],
  readinessChecks: [],
  commissioningChecks: [],
  changeEvents: [
    {
      id: 'evt-1',
      title: 'UPS battery swap',
      scheduledFor: '2026-05-10T02:00:00.000Z',
      riskLevel: 'high',
      expectedDowntimeMin: 30,
      status: 'planned',
      requiresReadiness: true
    },
    {
      id: 'evt-2',
      title: 'NAS move',
      scheduledFor: '2026-05-11T01:00:00.000Z',
      riskLevel: 'medium',
      expectedDowntimeMin: 90,
      status: 'planned',
      requiresCommissioning: true
    }
  ],
  updatedAt: '2026-05-16T00:00:00.000Z'
};

describe('change calendar', () => {
  it('detects overdue and blocked changes', () => {
    const summary = getChangeCalendarSummary(layout, new Date('2026-05-16T00:00:00.000Z'));
    expect(summary.overdue).toHaveLength(2);
    expect(summary.warnings.some((warning) => warning.code === 'overdue')).toBe(true);
    expect(summary.warnings.some((warning) => warning.code === 'readiness-blocked')).toBe(true);
    expect(summary.warnings.some((warning) => warning.code === 'commissioning-blocked')).toBe(true);
    expect(summary.warnings.some((warning) => warning.code === 'conflict')).toBe(true);
  });

  it('exports an ICS calendar with the scheduled events', () => {
    const ics = exportChangeCalendarIcs(layout);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:UPS battery swap');
    expect(ics).toContain('SUMMARY:NAS move');
    expect(ics).toContain('END:VCALENDAR');
  });
});
