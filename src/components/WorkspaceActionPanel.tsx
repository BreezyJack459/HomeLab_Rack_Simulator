export function WorkspaceActionPanel({
  badge,
  title,
  description,
  metrics,
  actions,
}: {
  badge: string;
  title: string;
  description: string;
  metrics?: Array<{ label: string; value: string }>;
  actions: Array<{
    label: string;
    detail: string;
    onClick: () => void;
    primary?: boolean;
  }>;
}) {
  return (
    <section className="rounded-3xl border border-edge bg-surface/85 p-4 shadow-sm dark:border-edge dark:bg-surface-raised/75">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-content-faint">
          {badge}
        </div>
        <h3 className="mt-1.5 text-[1.05rem] font-semibold text-content">
          {title}
        </h3>
        <p className="mt-1 text-sm leading-6 text-content-muted">
          {description}
        </p>
      </div>

      {metrics && metrics.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-edge bg-surface/75 px-3 py-2 shadow-sm dark:border-edge dark:bg-surface/70"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-content-faint">
                {metric.label}
              </div>
              <div className="mt-1 text-lg font-semibold text-content">
                {metric.value}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className={`rounded-2xl border px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
              action.primary
                ? 'border-accent/35 bg-accent-solid/12 text-accent-fg-strong shadow-accent/10 dark:text-accent-fg'
                : 'border-edge bg-surface/80 text-content-secondary dark:border-edge dark:bg-surface/60 dark:text-content'
            }`}
          >
            <div className="text-sm font-medium">{action.label}</div>
            <div className="mt-1 text-[11px] leading-5 opacity-80">
              {action.detail}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
