import type { SampleDefinition } from '../data/learningSamples';
import { WorkspaceDialog } from './WorkspaceDialog';

export function SamplePicker({ definitions, onSelect, onClose }: {
  definitions: SampleDefinition[];
  onSelect: (sampleId: string) => void;
  onClose: () => void;
}) {
  const card = (sample: SampleDefinition) => <article key={sample.layout.id} data-testid={`sample-card-${sample.layout.id}`} className="rounded-xl border border-edge bg-fill p-4">
    {sample.kind === 'exercise' && <p className="mb-2 text-xs font-semibold text-amber-600">INTENTIONAL FAULTS · 故意設置問題</p>}
    <h3 className="font-semibold">{sample.title}</h3>
    <p className="text-sm text-content-secondary" lang="zh-Hant">{sample.titleZh}</p>
    <p className="mt-2 text-xs leading-5 text-content-secondary">{sample.description}</p>
    <p className="text-xs leading-5 text-content-muted" lang="zh-Hant">{sample.descriptionZh}</p>
    <p className="mt-2 text-xs text-content-muted">For / 適合：{sample.audience}</p>
    <p className="mt-2 text-xs font-semibold">Learn / 學習目標</p>
    <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-content-secondary">{sample.outcomes.map(outcome => <li key={outcome}>{outcome}</li>)}</ul>
    <p className="mt-2 text-xs text-content-muted">Illustrative assumptions / 示範假設：{sample.assumptions[0] ?? 'Review the guide after loading; verify your exact hardware.'}</p>
    <p className="mt-2 text-xs text-content-muted">{sample.layout.rackType === '10in' ? '10-inch' : '19-inch'} · {sample.layout.heightU}U · {sample.layout.devices.length} devices · {sample.layout.cables.length} cables</p>
    <button type="button" onClick={() => onSelect(sample.layout.id)} className="mt-3 min-h-10 w-full rounded-lg border border-accent bg-accent-subtle px-3 py-2 text-sm text-accent-fg">Load {sample.title}</button>
  </article>;
  return <WorkspaceDialog title="Load sample layout" onClose={onClose}>
    <div data-testid="sample-picker-modal">
      <p className="mb-4 text-sm text-content-secondary">Choose a learning example for the current rack. These fictional plans teach the tools; their ratings and clearances are not purchasing specifications.</p>
      <p className="mb-4 text-xs text-content-muted" lang="zh-Hant">選擇當前機架的學習示例。示範設備與數值並非採購規格；載入前會確認替換，其他機架會保留。</p>
      <div className="grid gap-3">{definitions.filter(sample => sample.kind !== 'legacy').map(card)}</div>
      <details className="mt-4 rounded-xl border border-edge p-3">
        <summary className="cursor-pointer text-sm font-semibold">Legacy examples / 原有示例 ({definitions.filter(sample => sample.kind === 'legacy').length})</summary>
        <p className="mt-2 text-xs text-content-muted">Earlier examples are retained for compatibility and exploration; review their assumptions in Check.</p>
        <div className="mt-3 grid gap-3">{definitions.filter(sample => sample.kind === 'legacy').map(card)}</div>
      </details>
    </div>
  </WorkspaceDialog>;
}
