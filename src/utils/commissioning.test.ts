import { describe, expect, it } from 'vitest';
import type { RackLayout } from '../types/rack';
import { commissioningStatus, getCommissioningChecklist } from './commissioning';

const layout: RackLayout = {
  id: 'layout-commissioning',
  name: 'Commissioning Lab',
  rackType: '19in',
  heightU: 18,
  rackDepthMm: 700,
  weightLimitKg: 220,
  powerBudgetW: 1500,
  viewSide: 'front',
  devices: [
    {
      id: 'fw-1',
      category: 'firewall',
      name: 'Gateway Firewall',
      positionU: 1,
      sizeU: 1,
      depthMm: 220,
      widthType: '19in',
      weightKg: 3,
      powerW: 25,
      heatLevel: 2,
      color: '#ef4444',
      lifecycleStatus: 'planned',
      ports: { ethernet: 6 }
    },
    {
      id: 'sw-1',
      category: 'switch',
      name: 'Core Switch',
      positionU: 2,
      sizeU: 1,
      depthMm: 220,
      widthType: '19in',
      weightKg: 4,
      powerW: 35,
      heatLevel: 2,
      color: '#0ea5e9',
      lifecycleStatus: 'planned',
      ports: { ethernet: 24 }
    },
    {
      id: 'nas-1',
      category: 'nas',
      name: 'Primary NAS',
      positionU: 4,
      sizeU: 2,
      depthMm: 420,
      widthType: '19in',
      weightKg: 12,
      powerW: 120,
      heatLevel: 3,
      color: '#64748b',
      lifecycleStatus: 'active'
    }
  ],
  cables: [],
  reservations: [],
  procurementItems: [],
  readinessChecks: [],
  commissioningChecks: [
    { id: 'commissioning-network', status: 'passed', notes: 'Mgmt and uplink verified' },
    { id: 'commissioning-power', status: 'failed', notes: 'UPS self-test still pending' }
  ],
  updatedAt: new Date().toISOString()
};

describe('getCommissioningChecklist', () => {
  it('includes commissioning sections for physical, power, network, and rollback checks', () => {
    const sections = getCommissioningChecklist(layout);
    const ids = sections.flatMap((section) => section.items).map((item) => item.id);

    expect(ids).toContain('commissioning-physical');
    expect(ids).toContain('commissioning-power');
    expect(ids).toContain('commissioning-network');
    expect(ids).toContain('commissioning-rollback');
  });

  it('hydrates saved commissioning status and notes', () => {
    const sections = getCommissioningChecklist(layout);
    const networkItem = sections.flatMap((section) => section.items).find((item) => item.id === 'commissioning-network');

    expect(networkItem?.status).toBe('passed');
    expect(networkItem?.notes).toBe('Mgmt and uplink verified');
  });
});

describe('commissioningStatus', () => {
  it('returns failed when any commissioning item is marked failed', () => {
    expect(commissioningStatus(layout)).toBe('failed');
  });
});
