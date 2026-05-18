import { AlertTriangle, Cable, ClipboardList, Flame, Layers3, ShieldAlert } from 'lucide-react';
import { useMemo } from 'react';
import type { AuditLens } from '../types/appShell';
import type { RackLayout, ValidationIssue } from '../types/rack';
import { recommendationForIssue } from '../utils/validationRecommendations';

interface AuditWorkbenchProps {
  layout: RackLayout;
  issues: ValidationIssue[];
  totals: {
    powerW: number;
    heatScore: number;
    occupiedU: number;
  };
  selectedIssueId: string | null;
  documentationIssueCount: number;
  serviceabilityIssueCount: number;
  failureDomainIssueCount: number;
  openDebtCount: number;
  currentLens: AuditLens;
  onSelectLens: (lens: AuditLens) => void;
  onIssueSelect: (issue: ValidationIssue) => void;
}

const lensMeta: Record<
  AuditLens,
  {
    label: string;
    icon: React.ReactNode;
    description: string;
  }
> = {
  overview: {
    label: 'Overview',
    icon: <Layers3 size={14} />,
    description: 'Cross-check rack health, drift and current risk in one glance.',
  },
  issues: {
    label: 'Issues',
    icon: <AlertTriangle size={14} />,
    description: 'Work the validation queue from highest severity to easiest next fix.',
  },
  serviceability: {
    label: 'Serviceability',
    icon: <Cable size={14} />,
    description: 'Focus on pull-out blockers, strain risks and maintenance access.',
  },
  documentation: {
    label: 'Documentation',
    icon: <ClipboardList size={14} />,
    description: 'Tighten labels, evidence and cable annotations before drift accumulates.',
  },
  thermal: {
    label: 'Thermal',
    icon: <Flame size={14} />,
    description: 'Review heat pressure, power headroom and environmental telemetry.',
  },
  domains: {
    label: 'Domains',
    icon: <ShieldAlert size={14} />,
    description: 'Check redundancy, assignment gaps and domain-level blast radius.',
  },
};

const severityRank: Record<ValidationIssue['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function LensChip({
  lens,
  active,
  onClick,
}: {
  lens: AuditLens;
  active: boolean;
  onClick: () => void;
}) {
  const meta = lensMeta[lens];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition ${
        active
          ? 'border-cyan-500/40 bg-cyan-500/12 text-cyan-700 dark:text-cyan-300'
          : 'border-slate-200 bg-white/80 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      {meta.icon}
      {meta.label}
    </button>
  );
}

function SnapshotCard({
  title,
  value,
  detail,
  tone,
  onClick,
}: {
  title: string;
  value: string;
  detail: string;
  tone: 'default' | 'warn' | 'danger';
  onClick: () => void;
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300'
      : tone === 'warn'
        ? 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : 'border-slate-200 bg-white/85 text-slate-700 dark:border-slate-800 dark:bg-slate-900/75 dark:text-slate-200';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition hover:brightness-95 dark:hover:brightness-110 ${toneClass}`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] opacity-70">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs opacity-80">{detail}</div>
    </button>
  );
}

export function AuditWorkbench({
  layout,
  issues,
  totals,
  selectedIssueId,
  documentationIssueCount,
  serviceabilityIssueCount,
  failureDomainIssueCount,
  openDebtCount,
  currentLens,
  onSelectLens,
  onIssueSelect,
}: AuditWorkbenchProps) {
  const topIssues = useMemo(
    () =>
      [...issues]
        .sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.title.localeCompare(b.title))
        .slice(0, 5),
    [issues]
  );
  const selectedIssue = useMemo(
    () => issues.find((issue) => issue.id === selectedIssueId) ?? topIssues[0] ?? null,
    [issues, selectedIssueId, topIssues]
  );
  const powerHeadroom = layout.powerBudgetW - totals.powerW;
  const occupiedPct = layout.heightU > 0 ? Math.round((totals.occupiedU / layout.heightU) * 100) : 0;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/75">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
            Audit workbench
          </div>
          <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{lensMeta[currentLens].label}</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{lensMeta[currentLens].description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(lensMeta) as AuditLens[]).map((lens) => (
            <LensChip key={lens} lens={lens} active={lens === currentLens} onClick={() => onSelectLens(lens)} />
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SnapshotCard
          title="Validation queue"
          value={`${issues.length}`}
          detail={issues.length === 0 ? 'No open layout alerts.' : 'Critical and warning items waiting for review.'}
          tone={issues.some((issue) => issue.severity === 'critical') ? 'danger' : issues.length > 0 ? 'warn' : 'default'}
          onClick={() => onSelectLens('issues')}
        />
        <SnapshotCard
          title="Serviceability"
          value={`${serviceabilityIssueCount}`}
          detail="Pull-out clearance, cable strain and maintenance blockers."
          tone={serviceabilityIssueCount > 0 ? 'warn' : 'default'}
          onClick={() => onSelectLens('serviceability')}
        />
        <SnapshotCard
          title="Documentation"
          value={`${documentationIssueCount}`}
          detail="Labels, port annotations and evidence gaps."
          tone={documentationIssueCount > 0 ? 'warn' : 'default'}
          onClick={() => onSelectLens('documentation')}
        />
        <SnapshotCard
          title="Domain coverage"
          value={`${failureDomainIssueCount}`}
          detail={`${openDebtCount} open debt item${openDebtCount === 1 ? '' : 's'} tracked alongside domain risk.`}
          tone={failureDomainIssueCount > 0 ? 'danger' : openDebtCount > 0 ? 'warn' : 'default'}
          onClick={() => onSelectLens('domains')}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Priority queue</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Start with the highest-risk item and drive selection from here.</div>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              {occupiedPct}% occupied
            </div>
          </div>

          {topIssues.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
              Audit queue is clear. Use the lens chips above to inspect thermal, documentation or domain health.
            </div>
          ) : (
            <div className="space-y-2">
              {topIssues.map((issue) => {
                const active = selectedIssue?.id === issue.id;
                const severityClass =
                  issue.severity === 'critical'
                    ? 'border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300'
                    : issue.severity === 'warning'
                      ? 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                      : 'border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-300';

                return (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() => {
                      onSelectLens('issues');
                      onIssueSelect(issue);
                    }}
                    className={`w-full rounded-2xl border p-3 text-left transition hover:brightness-95 dark:hover:brightness-110 ${severityClass} ${
                      active ? 'ring-2 ring-cyan-500/60 dark:ring-cyan-300/60' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold">{issue.title}</div>
                        <div className="mt-1 text-xs opacity-85">{issue.detail}</div>
                      </div>
                      <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] dark:bg-slate-950/60">
                        {issue.severity}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 dark:border-slate-800 dark:bg-slate-900/75">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Current focus</div>
            {selectedIssue ? (
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">{selectedIssue.title}</div>
                  <div className="mt-1 text-slate-500 dark:text-slate-400">{selectedIssue.detail}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                  {recommendationForIssue(selectedIssue)}
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                No issue is selected. Pick one from the priority queue to sync the right inspector with a concrete problem.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 dark:border-slate-800 dark:bg-slate-900/75">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Health snapshot</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/60">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Power headroom</div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-white">{powerHeadroom}W</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/60">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Heat score</div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-white">{totals.heatScore}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/60">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Tracked domains</div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-white">{layout.failureDomains?.length ?? 0}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/60">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Thermal zones</div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-white">{layout.thermalZones?.length ?? 0}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
