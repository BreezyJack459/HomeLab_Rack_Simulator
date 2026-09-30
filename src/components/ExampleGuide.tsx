import type { SampleDefinition } from '../data/learningSamples';

export function ExampleGuide({ sample }: { sample: SampleDefinition }) {
  return <aside aria-label="Example learning guide" data-testid="example-guide" className="mb-2 shrink-0 rounded-xl border border-edge bg-surface px-3 py-2 text-xs">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <strong>{sample.title}</strong><span className="text-content-secondary" lang="zh-Hant">{sample.titleZh}</span>
      <span className="text-content-muted">Illustrative example · 示範用途</span>
      {sample.kind === 'exercise' && <strong className="text-amber-600">INTENTIONAL FAULTS · 故意設置問題</strong>}
    </div>
    <details className="mt-1">
      <summary className="cursor-pointer text-content-secondary">Example guide & assumptions / 示例指南與假設</summary>
      <div className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-2">
        <p>{sample.description}</p><p lang="zh-Hant" className="text-content-muted">{sample.descriptionZh}</p>
        <p className="text-content-muted">For / 適合：{sample.audience}</p>
        <h3 className="font-semibold">Learn / 學習目標</h3>
        <ul className="list-disc space-y-1 pl-4">{sample.outcomes.map(outcome => <li key={outcome}>{outcome}</li>)}</ul>
        <h3 className="font-semibold">Illustrative assumptions / 示範假設</h3>
        <ul className="list-disc space-y-1 pl-4">{sample.assumptions.map(assumption => <li key={assumption}>{assumption}</li>)}</ul>
        <p className="text-content-muted">Verify your actual rack, fittings, supplies and cables before purchase. Missing evidence remains unverified in Check.</p>
      </div>
    </details>
    {!!sample.steps?.length && <details className="mt-1">
      <summary className="cursor-pointer font-semibold">Troubleshooting steps / 排錯步驟 ({sample.steps.length})</summary>
      <ol className="mt-2 max-h-48 list-decimal space-y-3 overflow-y-auto pl-5 pr-2">{sample.steps.map((step, index) => <li key={`${step.ruleId}-${index}`}><strong>{step.title}</strong><p className="mt-1 leading-5 text-content-secondary">{step.remedy}</p></li>)}</ol>
    </details>}
  </aside>;
}
