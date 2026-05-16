import { AlertTriangle, CheckCircle2, ChevronDown, Info, Lightbulb, ShieldAlert, Wrench } from 'lucide-react';
import { useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { ValidationIssue } from '../types/rack';
import { recommendationForIssue } from '../utils/validationRecommendations';
import { explainIssue } from '../utils/validationExplanations';

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

const difficultyLabel = {
  easy: 'Easy fix',
  medium: 'Medium effort',
  hard: 'Hard fix'
};

const riskLabel = {
  low: 'Low risk if ignored',
  medium: 'Moderate risk',
  high: 'High risk',
  critical: 'Critical risk'
};

const difficultyBadge = {
  easy: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  hard: 'bg-red-500/15 text-red-700 dark:text-red-300'
};

const riskBadge = {
  low: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  high: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  critical: 'bg-red-500/15 text-red-700 dark:text-red-300'
};

function IssueExplanation({ issueId }: { issueId: string }) {
  const explanation = explainIssue(issueId);
  if (!explanation) return null;

  return (
    <div className="mt-3 space-y-2 rounded-md border border-slate-200 bg-white/80 p-3 text-xs leading-5 dark:border-white/10 dark:bg-black/20">
      <div className="flex flex-wrap gap-2">
        <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${difficultyBadge[explanation.fixDifficulty]}`}>
          {difficultyLabel[explanation.fixDifficulty]}
        </span>
        <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${riskBadge[explanation.riskIfIgnored]}`}>
          {riskLabel[explanation.riskIfIgnored]}
        </span>
      </div>

      <div className="flex gap-2">
        <Lightbulb className="mt-0.5 shrink-0 opacity-70" size={13} />
        <div>
          <span className="font-semibold opacity-80">What it means: </span>
          <span className="opacity-90">{explanation.meaning}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <ShieldAlert className="mt-0.5 shrink-0 opacity-70" size={13} />
        <div>
          <span className="font-semibold opacity-80">Why it matters: </span>
          <span className="opacity-90">{explanation.whyItMatters}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Wrench className="mt-0.5 shrink-0 opacity-70" size={13} />
        <div>
          <span className="font-semibold opacity-80">Real-world symptom: </span>
          <span className="opacity-90">{explanation.realWorldSymptom}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Info className="mt-0.5 shrink-0 opacity-70" size={13} />
        <div>
          <span className="font-semibold opacity-80">When to ignore: </span>
          <span className="opacity-90">{explanation.whenAcceptableToIgnore}</span>
        </div>
      </div>
    </div>
  );
}

export function ValidationPanel({ issues, totals, selectedIssueId, onIssueSelect }: ValidationPanelProps) {
  const selectDevice = useRackStore((state) => state.selectDevice);
  const selectCable = useRackStore((state) => state.selectCable);
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);

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
          {issues.map((issue) => {
            const hasExplain = explainIssue(issue.id) !== null;
            const isExpanded = expandedIssueId === issue.id;
            return (
              <div
                key={issue.id}
                className={`rounded-md border p-3 text-sm transition hover:brightness-110 ${
                  selectedIssueId === issue.id ? 'ring-2 ring-cyan-600/70 dark:ring-cyan-300/70' : ''
                } ${severityStyle[issue.severity]}`}
              >
                <button
                  className="w-full text-left"
                  onClick={() => handleIssueClick(issue)}
                  type="button"
                >
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 shrink-0" size={15} />
                    <div className="flex-1">
                      <div className="font-semibold">{issue.title}</div>
                      <p className="mt-1 text-xs leading-5 opacity-90">{issue.detail}</p>
                      <p className="mt-2 rounded border border-slate-200 bg-slate-100 px-2 py-1.5 text-[11px] leading-4 opacity-95 dark:border-white/10 dark:bg-black/15">
                        {recommendationForIssue(issue)}
                      </p>
                    </div>
                  </div>
                </button>
                {hasExplain && (
                  <button
                    type="button"
                    onClick={() => setExpandedIssueId((prev) => (prev === issue.id ? null : issue.id))}
                    className="mt-2 flex items-center gap-1 text-[11px] font-medium opacity-70 transition hover:opacity-100"
                  >
                    <ChevronDown
                      size={12}
                      className={`transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`}
                    />
                    {isExpanded ? 'Hide explanation' : 'Explain this issue'}
                  </button>
                )}
                {isExpanded && <IssueExplanation issueId={issue.id} />}
              </div>
            );
          })}
        </div>
      )}
      </div>
      </div>
    </section>
  );
}
