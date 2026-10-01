import { findingSectionLabels, type FindingSection, type summarizeFindings } from '../utils/findingSummary';

type Counts = ReturnType<typeof summarizeFindings>['counts'];
/** Queue sections count root causes; severity stays in the expanded raw checks. */
export function FindingSummaryBadges({ counts }: { counts: Counts }) {
  return <span aria-label="Finding counts" className="inline-flex flex-wrap gap-1.5 text-xs">
    {(['confirmed', 'verification', 'information', 'accepted'] as FindingSection[]).map(section =>
      section === 'accepted' && !counts.accepted ? null : <span key={section} className={`rounded-md border border-edge bg-fill/60 px-2.5 py-1.5 ${counts[section] && section === 'confirmed' ? 'text-red-500' : counts[section] && section === 'verification' ? 'text-amber-600' : 'text-content-secondary'}`}>
        {counts[section]} {findingSectionLabels[section]}
      </span>)}
  </span>;
}
