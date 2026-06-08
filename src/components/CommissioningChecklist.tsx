import { ClipboardPenLine } from 'lucide-react';
import { useMemo } from 'react';
import { useRackStore } from '../store/rackStore';
import type { ChecklistStatus } from '../types/rack';
import { exportCommissioningReportMarkdown } from '../utils/exporters';
import { updateChecklistRecords } from '../utils/checklists';
import { getCommissioningChecklist } from '../utils/commissioning';
import { ChecklistPanel } from './ChecklistPanel';

export function CommissioningChecklist() {
  const layout = useRackStore((state) => state.layout);
  const updateRack = useRackStore((state) => state.updateRack);
  const sections = useMemo(() => getCommissioningChecklist(layout), [layout]);

  function setStatus(itemId: string, status: ChecklistStatus) {
    updateRack({ commissioningChecks: updateChecklistRecords(layout.commissioningChecks, itemId, { status }) });
  }

  function setNotes(itemId: string, notes: string) {
    updateRack({ commissioningChecks: updateChecklistRecords(layout.commissioningChecks, itemId, { notes }) });
  }

  return (
    <ChecklistPanel
      title="Commissioning Checklist"
      icon={ClipboardPenLine}
      sections={sections}
      onStatusChange={setStatus}
      onNotesChange={setNotes}
      onExport={() => exportCommissioningReportMarkdown(layout)}
      exportLabel="Report"
    />
  );
}
