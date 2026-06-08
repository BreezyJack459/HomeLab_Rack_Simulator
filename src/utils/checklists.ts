import type { ChecklistRecord, ChecklistStatus } from '../types/rack';

export interface ChecklistItem {
  id: string;
  title: string;
  detail: string;
  status: ChecklistStatus;
  notes?: string;
}

export interface ChecklistSection {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export interface ChecklistSummary {
  total: number;
  pending: number;
  passed: number;
  failed: number;
  skipped: number;
}

export function mergeChecklistRecords(
  items: Omit<ChecklistItem, 'notes' | 'status'>[],
  records: ChecklistRecord[] | undefined
): ChecklistItem[] {
  const recordMap = new Map((records ?? []).map((record) => [record.id, record]));
  return items.map((item) => {
    const record = recordMap.get(item.id);
    return {
      ...item,
      status: record?.status ?? 'pending',
      notes: record?.notes ?? ''
    };
  });
}

export function summarizeChecklist(sections: ChecklistSection[]): ChecklistSummary {
  const items = sections.flatMap((section) => section.items);
  return items.reduce<ChecklistSummary>(
    (summary, item) => {
      summary.total += 1;
      summary[item.status] += 1;
      return summary;
    },
    { total: 0, pending: 0, passed: 0, failed: 0, skipped: 0 }
  );
}

export function updateChecklistRecords(
  records: ChecklistRecord[] | undefined,
  itemId: string,
  patch: Partial<ChecklistRecord>
): ChecklistRecord[] {
  const current = records ?? [];
  const existing = current.find((record) => record.id === itemId);
  const nextRecord: ChecklistRecord = {
    id: itemId,
    status: patch.status ?? existing?.status ?? 'pending',
    notes: patch.notes ?? existing?.notes ?? '',
    checkedAt: patch.status ? new Date().toISOString() : existing?.checkedAt
  };

  if (existing) {
    return current.map((record) => (record.id === itemId ? nextRecord : record));
  }

  return [...current, nextRecord];
}

export function checklistStatusLabel(status: ChecklistStatus) {
  switch (status) {
    case 'passed':
      return 'Passed';
    case 'failed':
      return 'Failed';
    case 'skipped':
      return 'Skipped';
    case 'pending':
    default:
      return 'Pending';
  }
}

export function checklistStatusTone(status: ChecklistStatus) {
  switch (status) {
    case 'passed':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'failed':
      return 'bg-red-500/10 text-red-700 dark:text-red-300';
    case 'skipped':
      return 'bg-slate-500/10 text-slate-700 dark:text-slate-300';
    case 'pending':
    default:
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
}
