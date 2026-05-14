import { AlertTriangle, CheckCircle2, ChevronDown, Info } from 'lucide-react';
import { useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { ValidationIssue } from '../types/rack';
import { recommendationForIssue } from '../utils/validationRecommendations';

interface ValidationPanelProps {
  issues: ValidationIssue[];
  totals: {
    weightKg: number;
    powerW: number;
    heatScore: number;
    occupiedU: number;
    reservedU?: number;
  };
  selectedIssueId?: string | null;
  onIssueSelect?: (issue: ValidationIssue) => void;
}

const severityStyle = {
  critical: 'border-red-500/45 bg-red-500/10 text-red-800 dark:text-red-100',
  warning: 'border-amber-500/45 bg-amber-500/10 text-amber-800 dark:text-amber-100',
  info: 'border-sky-500/45 bg-sky-500/10 text-sky-800 dark:text-sky-100'
};

export function ValidationPanel({ issues, totals, selectedIssueId, onIssueSelect }: ValidationPanelProps) {
  const selectDevice = useRackStore((state) => state.selectDevice);
  const selectCable = useRackStore((state) => state.selectCable);

  function handleIssueClick(issue: ValidationIssue) {
    if (issue.deviceIds && issue.deviceIds.length > 0) {
      selectDevice(issue.deviceIds[0]);
    }
    if (issue.cableIds && issue.cableIds.length > 0) {
      selectCable(issue.cableIds[0]);
    }
    onIssueSelect?.(issue);
  }

  const [isOpen, setIsOpen] = useState(true);

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-100/78 p-4 dark:border-slate-800 dark:bg-slate-900/78">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="mb-3 flex w-full items-center justify-between gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} />
          Validation
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">
            {issues.length ? `${issues.length} issue${issues.length === 1 ? '' : 's'}` : 'Clear'}
          </span>
          <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
        </div>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-md border border-slate-200 bg-slate-100 p-2 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-slate-400 dark:text-slate-500">Weight</div>
          <div className="mt-1 font-semibold text-slate-900 dark:text-white">{totals.weightKg.toFixed(1)}kg</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-100 p-2 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-slate-400 dark:text-slate-500">Power</div>
          <div className="mt-1 font-semibold text-slate-900 dark:text-white">{totals.powerW}W</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-100 p-2 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-slate-400 dark:text-slate-500">Used U</div>
          <div className="mt-1 font-semibold text-slate-900 dark:text-white">
            {totals.occupiedU}
            {totals.reservedU ? <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400"> +{totals.reservedU}r</span> : null}
          </div>
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="flex items-start gap-3 rounded-md border border-emerald-500/35 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-100">
          <CheckCircle2 className="mt-0.5 shrink-0" size={17} />
          <p>No blocking rack layout problems detected.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map((issue) => (
            <button
              key={issue.id}
              className={`w-full rounded-md border p-3 text-left text-sm transition hover:brightness-110 ${
                selectedIssueId === issue.id ? 'ring-2 ring-cyan-600/70 dark:ring-cyan-300/70' : ''
              } ${severityStyle[issue.severity]}`}
              onClick={() => handleIssueClick(issue)}
              type="button"
            >
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 shrink-0" size={15} />
                <div>
                  <div className="font-semibold">{issue.title}</div>
                  <p className="mt-1 text-xs leading-5 opacity-90">{issue.detail}</p>
                  <p className="mt-2 rounded border border-slate-200 bg-slate-100 px-2 py-1.5 text-[11px] leading-4 opacity-95 dark:border-white/10 dark:bg-black/15">
                    {recommendationForIssue(issue)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      </div>
      </div>
    </section>
  );
}
