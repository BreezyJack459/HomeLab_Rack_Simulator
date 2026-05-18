import { BarChart3, Box, CalendarDays, CheckCircle2, ClipboardList, Crosshair, Layers, Sparkles, Wrench } from 'lucide-react';
import { useMemo } from 'react';
import type { PlanLens } from '../types/appShell';
import type { RackLayout } from '../types/rack';

interface PlanWorkbenchProps {
  layout: RackLayout;
  currentLens: PlanLens;
  onSelectLens: (lens: PlanLens) => void;
}

const lensMeta: Record<
  PlanLens,
  {
    label: string;
    icon: React.ReactNode;
    description: string;
  }
> = {
  scenarios: {
    label: 'Scenarios',
    icon: <Crosshair size={14} />,
    description: 'Simulate what-if events and forecast capacity headroom.',
  },
  baseline: {
    label: 'Baseline',
    icon: <Layers size={14} />,
    description: 'Capture golden snapshots, track migration progress and catalog quality.',
  },
  schedule: {
    label: 'Schedule',
    icon: <CalendarDays size={14} />,
    description: 'Plan change windows, reserve rack space and coordinate maintenance.',
  },
  changes: {
    label: 'Changes',
    icon: <CheckCircle2 size={14} />,
    description: 'Review change requests, assess risk and approve or reject proposals.',
  },
  build: {
    label: 'Build',
    icon: <Wrench size={14} />,
    description: 'Procurement checklist, readiness and commissioning validation.',
  },
  fit: {
    label: 'Fit Check',
    icon: <Box size={14} />,
    description: 'Validate devices and accessories against rack geometry before purchase.',
  },
};

function LensChip({
  lens,
  active,
  onClick,
}: {
  lens: PlanLens;
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

export function PlanWorkbench({ layout, currentLens, onSelectLens }: PlanWorkbenchProps) {
  const changeRequests = layout.changeRequests ?? [];
  const procurementItems = layout.procurementItems ?? [];
  const changeEvents = layout.changeEvents ?? [];

  const pendingChanges = changeRequests.filter((r) => r.status === 'pending').length;
  const approvedChanges = changeRequests.filter((r) => r.status === 'approved').length;
  const buildRemaining = procurementItems.filter(
    (i) => i.status === 'need-to-buy' || i.status === 'ordered'
  ).length;

  const nextEventDate = useMemo(() => {
    const now = new Date().getTime();
    const upcoming = changeEvents
      .filter((e) => {
        const t = new Date(e.scheduledFor).getTime();
        return Number.isFinite(t) && t > now && (e.status === 'planned' || e.status === 'in-progress');
      })
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
    return upcoming[0]?.scheduledFor ?? null;
  }, [changeEvents]);

  const baselineCaptured = layout.goldenBaseline != null;
  const reservationCount = layout.reservations?.length ?? 0;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/75">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
            Plan workbench
          </div>
          <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{lensMeta[currentLens].label}</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            {lensMeta[currentLens].description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(lensMeta) as PlanLens[]).map((lens) => (
            <LensChip key={lens} lens={lens} active={lens === currentLens} onClick={() => onSelectLens(lens)} />
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <SnapshotCard
          title="Baseline captured"
          value={baselineCaptured ? 'Yes' : 'No'}
          detail={baselineCaptured ? 'A golden snapshot exists for comparison.' : 'No baseline saved yet.'}
          tone={baselineCaptured ? 'default' : 'warn'}
          onClick={() => onSelectLens('baseline')}
        />
        <SnapshotCard
          title="Pending changes"
          value={`${pendingChanges}`}
          detail="Change requests awaiting approval or review."
          tone={pendingChanges > 0 ? 'warn' : 'default'}
          onClick={() => onSelectLens('changes')}
        />
        <SnapshotCard
          title="Approved changes"
          value={`${approvedChanges}`}
          detail="Changes ready for scheduling and execution."
          tone="default"
          onClick={() => onSelectLens('changes')}
        />
        <SnapshotCard
          title="Build items remaining"
          value={`${buildRemaining}`}
          detail="Procurement items still needed or on order."
          tone={buildRemaining > 0 ? 'warn' : 'default'}
          onClick={() => onSelectLens('build')}
        />
        <SnapshotCard
          title="Next event"
          value={nextEventDate ? new Date(nextEventDate).toLocaleDateString() : 'None'}
          detail={nextEventDate ? 'Upcoming scheduled change event.' : 'No upcoming events scheduled.'}
          tone="default"
          onClick={() => onSelectLens('schedule')}
        />
        <SnapshotCard
          title="Reservations"
          value={`${reservationCount}`}
          detail="Rack U ranges reserved for future hardware."
          tone="default"
          onClick={() => onSelectLens('schedule')}
        />
      </div>
    </section>
  );
}
