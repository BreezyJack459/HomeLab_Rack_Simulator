import type { SampleDefinition } from '../data/learningSamples';
import { ArrowRight, BookOpen, Cable, ChevronDown, Layers, TriangleAlert } from 'lucide-react';
import { WorkspaceDialog } from './WorkspaceDialog';

export function SamplePicker({ definitions, onSelect, onClose }: {
  definitions: SampleDefinition[];
  onSelect: (sampleId: string) => void;
  onClose: () => void;
}) {
  const card = (sample: SampleDefinition, index: number) => <article key={sample.layout.id} data-testid={`sample-card-${sample.layout.id}`} className={`overflow-hidden rounded-[10px] border bg-surface ${sample.kind === 'exercise' ? 'border-amber-600/40' : 'border-edge'}`}>
    <div className="flex items-center justify-between gap-3 border-b border-edge bg-fill-subtle px-4 py-3">
      <span className="inline-flex items-center gap-2 text-xs font-semibold text-content-secondary"><span className="font-mono text-content-muted">{String(index + 1).padStart(2, '0')}</span>{sample.kind === 'beginner' ? <BookOpen size={15} /> : sample.kind === 'exercise' ? <TriangleAlert size={15} /> : <Layers size={15} />}{sample.kind === 'beginner' ? 'Start here · 入門' : sample.kind === 'advanced' ? 'Build your skills · 進階' : sample.kind === 'exercise' ? 'Practice diagnosis · 排錯' : 'Explore · 探索'}</span>
      <span className="shrink-0 font-mono text-xs text-content-muted">{sample.layout.rackType === '10in' ? '10-inch' : '19-inch'} / {sample.layout.heightU}U</span>
    </div>
    <div className="p-4">
    {sample.kind === 'exercise' && <p className="mb-2 text-xs font-semibold text-amber-600">INTENTIONAL FAULTS · 故意設置問題</p>}
    <h3 className="text-base font-semibold tracking-tight">{sample.title}</h3>
    <p className="text-sm text-content-secondary" lang="zh-Hant">{sample.titleZh}</p>
    <p className="mt-2 text-xs leading-5 text-content-secondary">{sample.description}</p>
    <p className="text-xs leading-5 text-content-muted" lang="zh-Hant">{sample.descriptionZh}</p>
    <p className="mt-2 text-xs text-content-muted">For / 適合：{sample.audience}</p>
    <details className="group mt-3 border-t border-edge pt-1">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-content-secondary">Learning outcomes & assumptions / 目標與假設<ChevronDown size={14} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" /></summary>
      <ul className="list-disc space-y-1 pl-4 text-xs leading-5 text-content-secondary">{sample.outcomes.map(outcome => <li key={outcome}>{outcome}</li>)}</ul>
    <p className="mt-2 text-xs text-content-muted">Illustrative assumptions / 示範假設：{sample.assumptions[0] ?? 'Review the guide after loading; verify your exact hardware.'}</p>
    </details>
    <div className="mt-3 flex items-center gap-2 text-xs text-content-muted"><Cable size={14} /><span>{sample.layout.devices.length} devices · {sample.layout.cables.length} cables</span></div>
    <button type="button" onClick={() => onSelect(sample.layout.id)} className="mt-3 inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-accent bg-accent-subtle px-3 py-2 text-left text-sm font-semibold text-accent-fg transition-colors hover:bg-fill-strong"><span>Load {sample.title}</span><ArrowRight size={16} className="shrink-0" aria-hidden="true" /></button>
    </div>
  </article>;
  return <WorkspaceDialog title="Load sample layout" onClose={onClose}>
    <div data-testid="sample-picker-modal">
      <p className="mb-2 text-lg font-semibold tracking-tight">A good place to start.</p>
      <p className="mb-2 text-sm leading-6 text-content-secondary">Choose a learning example for the current rack. These fictional plans teach the tools; their ratings and clearances are not purchasing specifications.</p>
      <p className="mb-4 text-xs leading-5 text-content-muted" lang="zh-Hant">選擇當前機架的學習示例。示範設備與數值並非採購規格；載入前會確認替換，其他機架會保留。</p>
      <div className="grid gap-3">{definitions.filter(sample => sample.kind !== 'legacy').map(card)}</div>
      <details className="mt-4 border-t border-edge pt-2">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Legacy examples / 原有示例 ({definitions.filter(sample => sample.kind === 'legacy').length})</summary>
        <p className="mt-2 text-xs text-content-muted">Earlier examples are retained for compatibility and exploration; review their assumptions in Check.</p>
        <div className="mt-3 grid gap-3">{definitions.filter(sample => sample.kind === 'legacy').map(card)}</div>
      </details>
    </div>
  </WorkspaceDialog>;
}
