import { ClipboardCheck } from 'lucide-react';
import { useMemo } from 'react';
import { useRackStore } from '../store/rackStore';
import type { ChecklistStatus } from '../types/rack';
import { exportReadinessChecklistMarkdown } from '../utils/exporters';
import { updateChecklistRecords } from '../utils/checklists';
import { getReadinessChecklist } from '../utils/readinessChecklist';
import { ChecklistPanel } from './ChecklistPanel';

export function ReadinessChecklist() {
  const layout = useRackStore((state) => state.layout);
  const updateRack = useRackStore((state) => state.updateRack);
  const sections = useMemo(() => getReadinessChecklist(layout), [layout]);

  function setStatus(itemId: string, status: ChecklistStatus) {
    updateRack({ readinessChecks: updateChecklistRecords(layout.readinessChecks, itemId, { status }) });
  }

  function setNotes(itemId: string, notes: string) {
    updateRack({ readinessChecks: updateChecklistRecords(layout.readinessChecks, itemId, { notes }) });
  }

  return (
    <ChecklistPanel
      title="Readiness Checklist"
      icon={ClipboardCheck}
      sections={sections}
      onStatusChange={setStatus}
      onNotesChange={setNotes}
      onExport={() => exportReadinessChecklistMarkdown(layout)}
      exportLabel="Markdown"
    />
  );
}
