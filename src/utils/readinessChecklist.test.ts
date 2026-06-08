import { describe, expect, it } from 'vitest';
import type { RackLayout } from '../types/rack';
import { getReadinessChecklist } from './readinessChecklist';

const layout: RackLayout = {
  id: 'layout-readiness',
  name: 'Readiness Lab',
  rackType: '19in',
  heightU: 12,
  rackDepthMm: 600,
  weightLimitKg: 200,
  powerBudgetW: 1200,
  viewSide: 'front',
  devices: [
    {
      id: 'ups-1',
      category: 'ups',
      name: 'UPS',
      positionU: 1,
      sizeU: 2,
      depthMm: 500,
      widthType: '19in',
      weightKg: 18,
      powerW: 40,
      heatLevel: 2,
      color: '#334155',
      batteryWh: 900
    },
    {
      id: 'sw-1',
      category: 'switch',
      name: 'Aggregation Switch',
      positionU: 4,
      sizeU: 1,
      depthMm: 220,
      widthType: '19in',
      weightKg: 4,
      powerW: 30,
      heatLevel: 2,
      color: '#0ea5e9',
      lifecycleStatus: 'planned',
      ports: { ethernet: 24 }
    },
    {
      id: 'nas-1',
      category: 'nas',
      name: 'Backup NAS',
      positionU: 6,
      sizeU: 2,
      depthMm: 400,
      widthType: '19in',
      weightKg: 11,
      powerW: 90,
      heatLevel: 3,
      color: '#64748b',
      lifecycleStatus: 'active'
    }
  ],
  cables: [
    {
      id: 'power-1',
      fromDeviceId: 'ups-1',
      fromPort: { type: 'power', index: 0, side: 'rear' },
      toDeviceId: 'nas-1',
      toPort: { type: 'power', index: 0, side: 'rear' },
      type: 'power',
      color: '#f97316'
    },
    {
      id: 'eth-1',
      fromDeviceId: 'sw-1',
      fromPort: { type: 'ethernet', index: 0, side: 'front' },
      toDeviceId: 'nas-1',
      toPort: { type: 'ethernet', index: 0, side: 'rear' },
      type: 'ethernet',
      color: '#0ea5e9',
      lifecycleStatus: 'planned'
    }
  ],
  reservations: [],
  procurementItems: [],
  readinessChecks: [{ id: 'readiness-labels', status: 'passed', notes: 'Printed already' }],
  commissioningChecks: [],
  updatedAt: new Date().toISOString()
};

describe('getReadinessChecklist', () => {
  it('builds readiness sections from planning and risk inputs', () => {
    const sections = getReadinessChecklist(layout);

    expect(sections).toHaveLength(5);
    expect(sections.flatMap((section) => section.items).some((item) => item.id === 'readiness-tools')).toBe(true);
    expect(sections.flatMap((section) => section.items).some((item) => item.id === 'readiness-smoke-tests')).toBe(true);
  });

  it('merges persisted checklist state by item id', () => {
    const sections = getReadinessChecklist(layout);
    const labelItem = sections.flatMap((section) => section.items).find((item) => item.id === 'readiness-labels');

    expect(labelItem?.status).toBe('passed');
    expect(labelItem?.notes).toBe('Printed already');
  });
});
