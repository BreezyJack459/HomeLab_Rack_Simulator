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
      className={`inline-flex items-center gap-2 rounded-2xl border px-2.5 py-1.5 text-[11px] font-medium transition ${
        active
          ? 'border-accent/45 bg-accent-solid/12 text-accent-fg shadow-sm shadow-accent/10 dark:text-accent-fg'
          : 'border-edge bg-surface/80 text-content-secondary hover:border-edge-strong hover:bg-fill dark:border-edge dark:bg-surface-raised/70 dark:text-content-secondary dark:hover:border-edge-strong dark:hover:bg-fill'
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
        : 'border-edge bg-surface/85 text-content-secondary dark:border-edge dark:bg-surface-raised/75 dark:text-content';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20 ${toneClass}`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-70">{title}</div>
      <div className="mt-1.5 text-xl font-semibold leading-none">{value}</div>
      <div className="mt-1 text-[11px] leading-5 opacity-80">{detail}</div>
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
        : 'border-edge bg-surface/80 text-content-secondary dark:border-edge dark:bg-surface-raised/70 dark:text-content';
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
    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-content-faint">
          {badge}
        </div>
        <h3 className="mt-1.5 text-[1.05rem] font-semibold text-content">{title}</h3>
        <p className="mt-1 max-w-xl text-sm leading-6 text-content-muted">{description}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {lenses.map((lens) => (
          <LensChip key={lens} lens={lens} active={lens === currentLens} onClick={() => onSelectLens(lens)} meta={lensMeta} />
        ))}
      </div>
    </div>
  );
}
