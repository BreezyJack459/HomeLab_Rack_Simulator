import { describe, expect, it } from 'vitest';
import type { RackLayout } from '../types/rack';
import { getProcurementChecklist, procurementSummary, updateProcurementItem } from './procurement';

const layout: RackLayout = {
  id: 'layout-1',
  name: 'Planner',
  rackType: '19in',
  heightU: 12,
  rackDepthMm: 600,
  weightLimitKg: 200,
  powerBudgetW: 1200,
  viewSide: 'front',
  devices: [
    {
      id: 'sw-1',
      templateId: 'switch-template',
      category: 'switch',
      name: 'Core Switch',
      positionU: 1,
      sizeU: 1,
      depthMm: 220,
      widthType: '19in',
      weightKg: 3,
      powerW: 30,
      heatLevel: 2,
      color: '#0ea5e9',
      lifecycleStatus: 'planned',
      ports: { ethernet: 24 }
    },
    {
      id: 'srv-1',
      templateId: 'server-template',
      category: 'server',
      name: 'NAS',
      positionU: 3,
      sizeU: 2,
      depthMm: 450,
      widthType: '19in',
      weightKg: 10,
      powerW: 150,
      heatLevel: 4,
      color: '#64748b',
      lifecycleStatus: 'active'
    }
  ],
  cables: [
    {
      id: 'c1',
      fromDeviceId: 'sw-1',
      fromPort: { type: 'ethernet', index: 0, side: 'front' },
      toDeviceId: 'srv-1',
      toPort: { type: 'ethernet', index: 0, side: 'rear' },
      type: 'ethernet',
      color: '#0ea5e9',
      lifecycleStatus: 'planned'
    }
  ],
  reservations: [
    {
      id: 'res-1',
      name: 'Printed shelf bracket',
      positionU: 6,
      sizeU: 1,
      mountSide: 'front',
      widthType: 'custom',
      customWidthMm: 90,
      purpose: 'printed-mount',
      notes: 'ASA'
    }
  ],
  procurementItems: [],
  updatedAt: new Date().toISOString()
};

describe('getProcurementChecklist', () => {
  it('derives device, cable, and generated planning items', () => {
    const items = getProcurementChecklist(layout);

    expect(items.some((item) => item.label === 'Core Switch' && item.status === 'need-to-buy')).toBe(true);
    expect(items.some((item) => item.label === 'NAS' && item.status === 'installed')).toBe(true);
    expect(items.some((item) => item.category === 'cable' && item.status === 'need-to-buy')).toBe(true);
    expect(items.some((item) => item.id === 'proc-generated-cage-nuts')).toBe(true);
    expect(items.some((item) => item.category === 'printed-part')).toBe(true);
  });

  it('preserves saved status overrides', () => {
    const savedLayout: RackLayout = {
      ...layout,
      procurementItems: [{ id: 'proc-generated-cage-nuts', label: 'Cage nuts + rack screws', category: 'rack-hardware', quantity: 4, status: 'ordered' }]
    };

    const items = getProcurementChecklist(savedLayout);
    expect(items.find((item) => item.id === 'proc-generated-cage-nuts')?.status).toBe('ordered');
  });
});

describe('procurementSummary', () => {
  it('aggregates quantities by status', () => {
    const summary = procurementSummary(getProcurementChecklist(layout));
    expect(summary['need-to-buy']).toBeGreaterThan(0);
    expect(summary.installed).toBeGreaterThan(0);
  });
});

describe('updateProcurementItem', () => {
  it('returns a fully merged checklist with the requested patch', () => {
    const items = updateProcurementItem(layout, 'proc-generated-cage-nuts', { status: 'ordered', notes: 'PO #1234' });
    const updated = items.find((item) => item.id === 'proc-generated-cage-nuts');

    expect(updated?.status).toBe('ordered');
    expect(updated?.notes).toBe('PO #1234');
  });
});
