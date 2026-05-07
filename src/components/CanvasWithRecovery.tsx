import { Canvas, type RootState } from '@react-three/fiber';
import { RefreshCw } from 'lucide-react';
import { ComponentProps, useCallback, useEffect, useState } from 'react';

type CanvasWithRecoveryProps = ComponentProps<typeof Canvas>;

export function CanvasWithRecovery({ children, onCreated, ...props }: CanvasWithRecoveryProps) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState(0);

  const handleCreated = useCallback(
    (state: RootState) => {
      setCanvas(state.gl.domElement);
      onCreated?.(state);
    },
    [onCreated]
  );

  useEffect(() => {
    if (!canvas) return undefined;

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
      // Force remount to rebuild GPU resources and scene graph after restore
      setRecoveryKey((k) => k + 1);
    };

    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [canvas]);

  return (
    <>
      <Canvas key={recoveryKey} {...props} onCreated={handleCreated}>
        {children}
      </Canvas>
      {contextLost && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/86 px-6 text-center">
          <div className="max-w-sm rounded-lg border border-amber-400/40 bg-slate-950 px-5 py-4 shadow-panel">
            <div className="text-sm font-semibold text-amber-100">3D renderer paused</div>
            <div className="mt-2 text-xs leading-5 text-slate-300">
              WebGL context was lost. Restore may happen automatically, or refresh this view to rebuild GPU resources.
            </div>
            <button
              type="button"
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-amber-400/50 bg-amber-400/15 px-3 text-sm font-medium text-amber-100 hover:bg-amber-400/25"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
        </div>
      )}
    </>
  );
}
