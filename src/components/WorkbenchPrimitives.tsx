import type { ReactNode } from 'react';

// ── LensChip — reusable chip for workbench lens navigation ──────────────────

export interface LensChipProps<T extends string> {
  lens: T;
  active: boolean;
  onClick: () => void;
  meta: Record<T, { label: string; icon: ReactNode }>;
}

export function LensChip<T extends string>({ lens, active, onClick, meta }: LensChipProps<T>) {
  const data = meta[lens];
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
      {data.icon}
      {data.label}
    </button>
  );
}

// ── SnapshotCard — clickable metric card used in workbench grids ─────────────

export interface SnapshotCardProps {
  title: string;
  value: string;
  detail: string;
  tone?: 'default' | 'warn' | 'danger';
  onClick: () => void;
}

export function SnapshotCard({ title, value, detail, tone = 'default', onClick }: SnapshotCardProps) {
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

// ── MetricCard — simple stat card (used in workspace hero metrics) ───────────

export interface MetricCardProps {
  label: string;
  value: string;
  tone?: 'default' | 'warn' | 'danger';
}

export function MetricCard({ label, value, tone = 'default' }: MetricCardProps) {
  const toneClass =
    tone === 'danger'
      ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
      : tone === 'warn'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : 'border-slate-200 bg-white/80 text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200';
  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

// ── WorkbenchHeader — shared header with label, title, description, and lens chips ─

export interface WorkbenchHeaderProps<T extends string> {
  badge: string;
  title: string;
  description: string;
  lenses: T[];
  currentLens: T;
  onSelectLens: (lens: T) => void;
  lensMeta: Record<T, { label: string; icon: ReactNode }>;
}

export function WorkbenchHeader<T extends string>({
  badge,
  title,
  description,
  lenses,
  currentLens,
  onSelectLens,
  lensMeta,
}: WorkbenchHeaderProps<T>) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
          {badge}
        </div>
        <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {lenses.map((lens) => (
          <LensChip key={lens} lens={lens} active={lens === currentLens} onClick={() => onSelectLens(lens)} meta={lensMeta} />
        ))}
      </div>
    </div>
  );
}
