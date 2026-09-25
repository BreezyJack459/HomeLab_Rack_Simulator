import { withoutHiddenZeroUPdu } from '../utils/featureFlags';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { RackLayout } from '../types/rack';
import { CanvasWithRecovery } from './CanvasWithRecovery';
import { RackModel } from './three/RackModel';
import { PrintedMounts3D } from './three/PrintedMounts3D';
import { getDeviceWorldBox, getRackWorldDimensions } from '../utils/rackGeometry';
import { RackSceneCamera } from './three/RackSceneCamera';
import type { CableCameraPreset } from './three/rack-scene/cameraPresets';
import { SceneNavigationHint, SceneViewToolbar } from './SceneViewToolbar';

interface RackViewer3DProps {
  layout?: RackLayout;
}

export function RackViewer3D({ layout: layoutOverride }: RackViewer3DProps) {
  const storeLayout = useRackStore((state) => state.layout);
  const layout = useMemo(() => withoutHiddenZeroUPdu(layoutOverride ?? storeLayout), [layoutOverride, storeLayout]);
  const selectedDeviceId = useRackStore((state) => state.selectedDeviceId);
  const selected = layout.devices.find((device) => device.id === selectedDeviceId);
  const [preset, setPreset] = useState<CableCameraPreset>('overview');
  const [fitRequest, setFitRequest] = useState(0);
  useEffect(() => {
    if (selected?.sizeU === 0) { setPreset('rear-angle'); setFitRequest(n => n + 1); }
  }, [selected?.id, selected?.sizeU]);
  const dimensions = useMemo(() => getRackWorldDimensions(layout), [layout.rackType, layout.heightU, layout.rackDepthMm]);
  const extraPoints = useMemo(() => layout.devices.flatMap((device) => {
    const box = getDeviceWorldBox(layout, device, dimensions);
    return [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => ({
      x: box.x + x * box.width / 2, y: box.y + y * box.height / 2, z: box.z + z * box.depth / 2,
    }))));
  }), [layout, dimensions]);

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-surface" data-testid="rack-inspection-3d">
      <SceneViewToolbar title="3D inspection" preset={preset}
        onPreset={(value) => { setPreset(value); setFitRequest((n) => n + 1); }}
        onFit={() => { setPreset(selected?.sizeU === 0 ? 'rear-angle' : 'overview'); setFitRequest((n) => n + 1); }} />
      <div className="relative min-h-0 flex-1">
        <CanvasWithRecovery shadows dpr={[1, Math.min(window.devicePixelRatio || 1, 2)]}>
          <RackSceneCamera dimensions={dimensions} preset={preset} fitRequest={fitRequest} extraPoints={extraPoints} />
          <Suspense fallback={null}>
            <RackModel layout={layout} />
            <PrintedMounts3D layout={layout} />
          </Suspense>
        </CanvasWithRecovery>
        <SceneNavigationHint />
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-edge bg-surface px-3 py-2 text-xs text-content-secondary" aria-live="polite">
        {selected ? <><strong className="text-content">{selected.label || selected.name}</strong><span>{selected.sizeU === 0 ? '0U' : `U${selected.positionU} · ${selected.sizeU}U`} · {selected.depthMm ?? '—'} mm deep</span></>
          : <span>Select a device to inspect its name, rack position and depth.</span>}
      </div>
    </div>
  );
}
