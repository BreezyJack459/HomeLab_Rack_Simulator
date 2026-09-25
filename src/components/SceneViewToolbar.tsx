import { Maximize2 } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import type { CableCameraPreset } from './three/rack-scene/cameraPresets';

export const sceneButtonClass = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-edge-strong bg-surface px-2.5 text-xs font-medium text-content-secondary hover:bg-fill focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:border-accent aria-pressed:bg-accent-subtle aria-pressed:text-accent-fg-strong';

export function SceneViewToolbar({ title, preset, onPreset, onFit, children }: {
  title: string;
  preset: CableCameraPreset | null;
  onPreset: (preset: CableCameraPreset) => void;
  onFit: () => void;
  children?: ReactNode;
}) {
  const viewId = useId();
  return (
    <div className="z-10 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-edge bg-surface px-3 py-2" role="toolbar" aria-label={`${title} controls`}>
      <span className="text-xs font-semibold text-content">{title}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="sr-only" htmlFor={viewId}>Camera view</label>
        <select id={viewId} aria-label="Camera view" value={preset ?? 'focus'}
          className="h-8 rounded-md border border-edge-strong bg-surface px-2 text-xs font-medium text-content"
          onChange={(event) => onPreset(event.target.value as CableCameraPreset)}>
          {preset === null && <option value="focus" disabled>Selected route</option>}
          <option value="overview">Overview</option>
          <option value="front">Front</option>
          <option value="rear">Rear</option>
          <option value="rear-angle">Rear angle · PDU</option>
          <option value="top">Top</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
        <button type="button" className={sceneButtonClass} onClick={onFit}><Maximize2 size={13} />Fit rack</button>
        {children}
      </div>
    </div>
  );
}

export function SceneNavigationHint() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-edge bg-surface/90 px-2.5 py-1.5 text-[11px] text-content-secondary">
      Drag to rotate · Scroll to zoom · Right-drag to pan
    </div>
  );
}
