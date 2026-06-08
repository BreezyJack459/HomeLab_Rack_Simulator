import type { RackDebtItem, RackDebtSeverity, RackDebtStatus, ValidationIssue } from '../types/rack';

const severityWeight: Record<RackDebtSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const statusWeight: Record<RackDebtStatus, number> = {
  open: 1,
  planned: 0.5,
  fixed: 0,
  accepted: 0,
  ignored: 0,
};

export function calculateDebtScore(items: RackDebtItem[]): number {
  return items.reduce((score, item) => {
    const sev = severityWeight[item.severity] ?? 1;
    const stat = statusWeight[item.status] ?? 1;
    return score + sev * stat;
  }, 0);
}

export function debtItemsByStatus(items: RackDebtItem[]) {
  const grouped: Record<RackDebtStatus, RackDebtItem[]> = {
    open: [],
    planned: [],
    fixed: [],
    accepted: [],
    ignored: [],
  };
  for (const item of items) {
    grouped[item.status].push(item);
  }
  return grouped;
}

export function debtItemsBySeverity(items: RackDebtItem[]) {
  const grouped: Record<RackDebtSeverity, RackDebtItem[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };
  for (const item of items) {
    grouped[item.severity].push(item);
  }
  return grouped;
}

export function topDebtItems(items: RackDebtItem[], count = 5): RackDebtItem[] {
  const active = items.filter((item) => item.status === 'open' || item.status === 'planned');
  return active
    .sort((a, b) => (severityWeight[b.severity] ?? 0) - (severityWeight[a.severity] ?? 0))
    .slice(0, count);
}

export function debtSummary(items: RackDebtItem[]) {
  const byStatus = debtItemsByStatus(items);
  const bySeverity = debtItemsBySeverity(items);
  const openCount = byStatus.open.length;
  const totalCount = items.length;
  const score = calculateDebtScore(items);

  let health: 'good' | 'fair' | 'poor' | 'critical' = 'good';
  if (score >= 20) health = 'critical';
  else if (score >= 10) health = 'poor';
  else if (score >= 5) health = 'fair';

  return {
    totalCount,
    openCount,
    plannedCount: byStatus.planned.length,
    fixedCount: byStatus.fixed.length,
    acceptedCount: byStatus.accepted.length,
    ignoredCount: byStatus.ignored.length,
    criticalCount: bySeverity.critical.length,
    highCount: bySeverity.high.length,
    mediumCount: bySeverity.medium.length,
    lowCount: bySeverity.low.length,
    score,
    health,
  };
}

export function validationIssueToDebtItem(issue: ValidationIssue, category?: string): Omit<RackDebtItem, 'id' | 'createdAt'> {
  const severityMap: Record<string, RackDebtSeverity> = {
    critical: 'critical',
    warning: 'high',
    info: 'medium',
  };

  return {
    title: issue.title,
    description: issue.detail,
    severity: severityMap[issue.severity] ?? 'medium',
    status: 'open',
    scope: issue.cableIds && issue.cableIds.length > 0
      ? 'cable'
      : issue.deviceIds && issue.deviceIds.length > 0
        ? 'device'
        : 'layout',
    deviceIds: issue.deviceIds,
    cableIds: issue.cableIds,
    category: category ?? issue.id.split('-')[0],
  };
}

export function debtStatusLabel(status: RackDebtStatus): string {
  switch (status) {
    case 'open': return 'Open';
    case 'planned': return 'Planned';
    case 'fixed': return 'Fixed';
    case 'accepted': return 'Accepted';
    case 'ignored': return 'Ignored';
  }
}

export function debtScopeLabel(scope: RackDebtItem['scope']): string {
  switch (scope) {
    case 'device': return 'Device';
    case 'cable': return 'Cable';
    case 'zone': return 'Zone';
    case 'layout': return 'Layout';
  }
}

export function debtSeverityColor(severity: RackDebtSeverity): string {
  switch (severity) {
    case 'critical': return 'text-red-600 dark:text-red-400';
    case 'high': return 'text-orange-600 dark:text-orange-400';
    case 'medium': return 'text-amber-600 dark:text-amber-400';
    case 'low': return 'text-slate-600 dark:text-slate-400';
  }
}

export function debtSeverityBg(severity: RackDebtSeverity): string {
  switch (severity) {
    case 'critical': return 'bg-red-500/10 border-red-500/30';
    case 'high': return 'bg-orange-500/10 border-orange-500/30';
    case 'medium': return 'bg-amber-500/10 border-amber-500/30';
    case 'low': return 'bg-slate-500/10 border-slate-500/30';
  }
}
