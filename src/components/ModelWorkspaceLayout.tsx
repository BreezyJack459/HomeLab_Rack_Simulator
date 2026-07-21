import { lazy, Suspense, type ReactNode } from 'react';
import { useLayoutPrefsStore } from '../store/layoutPrefsStore';
import type { RackLayout } from '../types/rack';

const ComponentLibrary = lazy(() => import('./ComponentLibrary').then((m) => ({ default: m.ComponentLibrary })));

interface ModelWorkspaceLayoutProps {
  layout: RackLayout;
  canvas: ReactNode;
}

export function ModelWorkspaceLayout({
  layout,
  canvas,
}: ModelWorkspaceLayoutProps) {
  const deviceLibraryOpen = useLayoutPrefsStore((state) => state.deviceLibraryOpen);

  return (
    <div
      className={`grid min-h-0 flex-1 gap-3 ${deviceLibraryOpen ? 'grid-cols-[minmax(200px,240px)_minmax(0,1fr)]' : 'grid-cols-1'}`}
    >
      {deviceLibraryOpen && (
        <aside
          className="min-h-0 overflow-hidden rounded-3xl border border-edge bg-surface/82 dark:border-edge dark:bg-surface/82"
          data-testid="device-library-panel"
        >
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center px-6 text-sm text-content-muted">
                Loading device library...
              </div>
            }
          >
            <ComponentLibrary />
          </Suspense>
        </aside>
      )}

      <section className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-edge bg-surface/82 dark:border-edge dark:bg-surface/82">
        {canvas}
      </section>
    </div>
  );
}
