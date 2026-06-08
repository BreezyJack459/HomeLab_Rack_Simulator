import { describe, it, expect } from 'vitest';
import type { RackDebtItem, ValidationIssue } from '../types/rack';
import {
  calculateDebtScore,
  debtItemsByStatus,
  debtItemsBySeverity,
  topDebtItems,
  debtSummary,
  validationIssueToDebtItem,
  debtStatusLabel,
  debtScopeLabel,
} from './rackDebt';

function makeItem(overrides: Partial<RackDebtItem> = {}): RackDebtItem {
  return {
    id: 'debt-1',
    title: 'Test debt',
    description: 'Description',
    severity: 'medium',
    status: 'open',
    scope: 'layout',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('calculateDebtScore', () => {
  it('returns 0 for empty array', () => {
    expect(calculateDebtScore([])).toBe(0);
  });

  it('weights severity correctly for open items', () => {
    const items: RackDebtItem[] = [
      makeItem({ severity: 'critical', status: 'open' }),
      makeItem({ severity: 'high', status: 'open' }),
      makeItem({ severity: 'medium', status: 'open' }),
      makeItem({ severity: 'low', status: 'open' }),
    ];
    expect(calculateDebtScore(items)).toBe(4 + 3 + 2 + 1);
  });

  it('reduces score for resolved items', () => {
    const items: RackDebtItem[] = [
      makeItem({ severity: 'critical', status: 'fixed' }),
      makeItem({ severity: 'high', status: 'accepted' }),
      makeItem({ severity: 'medium', status: 'ignored' }),
    ];
    expect(calculateDebtScore(items)).toBe(0);
  });

  it('halves score for planned items', () => {
    const items: RackDebtItem[] = [
      makeItem({ severity: 'critical', status: 'planned' }),
    ];
    expect(calculateDebtScore(items)).toBe(4 * 0.5);
  });
});

describe('debtItemsByStatus', () => {
  it('groups items by status', () => {
    const items: RackDebtItem[] = [
      makeItem({ status: 'open' }),
      makeItem({ status: 'open' }),
      makeItem({ status: 'fixed' }),
    ];
    const grouped = debtItemsByStatus(items);
    expect(grouped.open.length).toBe(2);
    expect(grouped.fixed.length).toBe(1);
    expect(grouped.planned.length).toBe(0);
  });
});

describe('debtItemsBySeverity', () => {
  it('groups items by severity', () => {
    const items: RackDebtItem[] = [
      makeItem({ severity: 'critical' }),
      makeItem({ severity: 'high' }),
      makeItem({ severity: 'critical' }),
    ];
    const grouped = debtItemsBySeverity(items);
    expect(grouped.critical.length).toBe(2);
    expect(grouped.high.length).toBe(1);
    expect(grouped.medium.length).toBe(0);
  });
});

describe('topDebtItems', () => {
  it('returns empty for no active items', () => {
    const items: RackDebtItem[] = [
      makeItem({ severity: 'critical', status: 'fixed' }),
    ];
    expect(topDebtItems(items)).toEqual([]);
  });

  it('sorts by severity and limits to 5', () => {
    const items: RackDebtItem[] = [
      makeItem({ id: '1', severity: 'low', status: 'open' }),
      makeItem({ id: '2', severity: 'critical', status: 'open' }),
      makeItem({ id: '3', severity: 'high', status: 'open' }),
      makeItem({ id: '4', severity: 'medium', status: 'open' }),
      makeItem({ id: '5', severity: 'critical', status: 'open' }),
      makeItem({ id: '6', severity: 'high', status: 'open' }),
      makeItem({ id: '7', severity: 'medium', status: 'open' }),
    ];
    const top = topDebtItems(items);
    expect(top.length).toBe(5);
    expect(top[0].severity).toBe('critical');
    expect(top[1].severity).toBe('critical');
    expect(top[2].severity).toBe('high');
    expect(top[3].severity).toBe('high');
    expect(top[4].severity).toBe('medium');
  });
});

describe('debtSummary', () => {
  it('returns good health for low score', () => {
    const summary = debtSummary([]);
    expect(summary.health).toBe('good');
    expect(summary.score).toBe(0);
    expect(summary.totalCount).toBe(0);
  });

  it('returns critical health for high score', () => {
    const items: RackDebtItem[] = [
      makeItem({ severity: 'critical', status: 'open' }),
      makeItem({ severity: 'critical', status: 'open' }),
      makeItem({ severity: 'critical', status: 'open' }),
      makeItem({ severity: 'critical', status: 'open' }),
      makeItem({ severity: 'critical', status: 'open' }),
      makeItem({ severity: 'high', status: 'open' }),
    ];
    const summary = debtSummary(items);
    expect(summary.score).toBe(4 * 5 + 3);
    expect(summary.health).toBe('critical');
    expect(summary.criticalCount).toBe(5);
    expect(summary.openCount).toBe(6);
  });

  it('returns fair health for moderate score', () => {
    const items: RackDebtItem[] = [
      makeItem({ severity: 'medium', status: 'open' }),
      makeItem({ severity: 'medium', status: 'open' }),
      makeItem({ severity: 'medium', status: 'open' }),
    ];
    const summary = debtSummary(items);
    expect(summary.score).toBe(6);
    expect(summary.health).toBe('fair');
  });
});

describe('validationIssueToDebtItem', () => {
  it('maps critical severity to critical debt', () => {
    const issue: ValidationIssue = {
      id: 'bounds-dev-01',
      severity: 'critical',
      title: 'Device out of bounds',
      detail: 'The device is outside the rack.',
      deviceIds: ['dev-01'],
    };
    const debt = validationIssueToDebtItem(issue);
    expect(debt.severity).toBe('critical');
    expect(debt.scope).toBe('device');
    expect(debt.status).toBe('open');
    expect(debt.title).toBe('Device out of bounds');
  });

  it('maps warning severity to high debt', () => {
    const issue: ValidationIssue = {
      id: 'airflow-dev-02',
      severity: 'warning',
      title: 'Airflow issue',
      detail: 'No airflow gap.',
      deviceIds: ['dev-02'],
    };
    const debt = validationIssueToDebtItem(issue);
    expect(debt.severity).toBe('high');
  });

  it('maps info severity to medium debt', () => {
    const issue: ValidationIssue = {
      id: 'network-direct-cable-01',
      severity: 'info',
      title: 'Network direct',
      detail: 'Bypasses patch panel.',
      cableIds: ['cable-01'],
    };
    const debt = validationIssueToDebtItem(issue);
    expect(debt.severity).toBe('medium');
    expect(debt.scope).toBe('cable');
  });

  it('uses layout scope when no device or cable ids', () => {
    const issue: ValidationIssue = {
      id: 'weight-limit',
      severity: 'critical',
      title: 'Weight limit',
      detail: 'Too heavy.',
    };
    const debt = validationIssueToDebtItem(issue);
    expect(debt.scope).toBe('layout');
  });

  it('uses provided category override', () => {
    const issue: ValidationIssue = {
      id: 'test-id',
      severity: 'warning',
      title: 'Test',
      detail: 'Test detail.',
    };
    const debt = validationIssueToDebtItem(issue, 'custom-category');
    expect(debt.category).toBe('custom-category');
  });

  it('derives category from issue id when not provided', () => {
    const issue: ValidationIssue = {
      id: 'airflow-device-01',
      severity: 'warning',
      title: 'Test',
      detail: 'Test detail.',
    };
    const debt = validationIssueToDebtItem(issue);
    expect(debt.category).toBe('airflow');
  });
});

describe('debtStatusLabel', () => {
  it('returns correct labels', () => {
    expect(debtStatusLabel('open')).toBe('Open');
    expect(debtStatusLabel('planned')).toBe('Planned');
    expect(debtStatusLabel('fixed')).toBe('Fixed');
    expect(debtStatusLabel('accepted')).toBe('Accepted');
    expect(debtStatusLabel('ignored')).toBe('Ignored');
  });
});

describe('debtScopeLabel', () => {
  it('returns correct labels', () => {
    expect(debtScopeLabel('device')).toBe('Device');
    expect(debtScopeLabel('cable')).toBe('Cable');
    expect(debtScopeLabel('zone')).toBe('Zone');
    expect(debtScopeLabel('layout')).toBe('Layout');
  });
});
