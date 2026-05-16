import { Eye, EyeOff } from 'lucide-react';
import { Suspense, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { RackLayout } from '../types/rack';
import { CanvasWithRecovery } from './CanvasWithRecovery';
import { RackModel } from './three/RackModel';
import { SceneSetup } from './three/SceneSetup';
import { SmoothCameraRig } from './three/SmoothCameraRig';

const FRONT_CAMERA_POSITION: [number, number, number] = [4.6, 3.6, 7];
const REAR_CAMERA_POSITION: [number, number, number] = [4.6, 3.6, -7];
const RACK_CAMERA_TARGET: [number, number, number] = [0, 0.2, 0];

interface RackViewer3DProps {
  layout?: RackLayout;
}

export function RackViewer3D({ layout: layoutOverride }: RackViewer3DProps) {
  const storeLayout = useRackStore((state) => state.layout);
  const layout = layoutOverride ?? storeLayout;
  const [viewAngle, setViewAngle] = useState<'front' | 'rear'>('front');

  const cameraPosition = viewAngle === 'front' ? FRONT_CAMERA_POSITION : REAR_CAMERA_POSITION;

  return (
    <div className="relative h-full bg-white dark:bg-slate-950">
      <div className="absolute left-4 top-4 z-10 rounded-lg border border-slate-200 bg-white/88 px-4 py-3 text-sm shadow-panel dark:border-slate-800 dark:bg-slate-950/88">
        <div className="flex items-center justify-between gap-4">
          <div className="font-semibold text-slate-900 dark:text-white">3D inspection</div>
          <button
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-300 bg-slate-100 px-2.5 text-xs text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => setViewAngle((v) => v === 'front' ? 'rear' : 'front')}
            type="button"
          >
            {viewAngle === 'front' ? <Eye size={14} /> : <EyeOff size={14} />}
            {viewAngle === 'front' ? 'Front view' : 'Rear view'}
          </button>
        </div>
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Rotate, zoom and compare device depth.</div>
      </div>
      <CanvasWithRecovery shadows dpr={[1, Math.min(window.devicePixelRatio || 1, 2)]}>
        <SceneSetup
          cameraPosition={cameraPosition}
          fov={42}
          background="#090c12"
          controlsTarget={RACK_CAMERA_TARGET}
          ambientIntensity={0.62}
          keyLightIntensity={1.15}
        />
        <SmoothCameraRig position={cameraPosition} />
        <Suspense fallback={null}>
          <RackModel layout={layout} />
        </Suspense>
      </CanvasWithRecovery>
    </div>
  );
}
