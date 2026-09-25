import { X } from 'lucide-react';
import { lazy, Suspense, type ReactNode, useEffect, useRef, useState } from 'react';
import { useLayoutPrefsStore } from '../store/layoutPrefsStore';
import type { RackLayout } from '../types/rack';
import { getTabbableElements } from '../utils/tabbable';

const ComponentLibrary = lazy(() => import('./ComponentLibrary').then((m) => ({ default: m.ComponentLibrary })));

interface ModelWorkspaceLayoutProps {
  layout: RackLayout;
  canvas: ReactNode;
  sidebar?: ReactNode;
  sidebarLabel?: string;
}

const BELOW_LG_QUERY = '(max-width: 1023px)';
function useIsBelowLg() {
  const [isBelowLg, setIsBelowLg] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(BELOW_LG_QUERY).matches
      : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(BELOW_LG_QUERY);
    const update = () => setIsBelowLg(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isBelowLg;
}

export function ModelWorkspaceLayout({
  layout,
  canvas,
  sidebar,
  sidebarLabel = 'Device library',
}: ModelWorkspaceLayoutProps) {
  const deviceLibraryOpen = useLayoutPrefsStore((state) => state.deviceLibraryOpen);
  const deviceLibraryDrawerOpen = useLayoutPrefsStore((state) => state.deviceLibraryDrawerOpen);
  const setDeviceLibraryOpen = useLayoutPrefsStore((state) => state.setDeviceLibraryOpen);
  const setDeviceLibraryDrawerOpen = useLayoutPrefsStore((state) => state.setDeviceLibraryDrawerOpen);
  const isBelowLg = useIsBelowLg();
  const libraryVisible = isBelowLg ? deviceLibraryDrawerOpen : sidebar != null || deviceLibraryOpen;
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(libraryVisible);

  useEffect(() => {
    if (libraryVisible && isBelowLg) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      closeButtonRef.current?.focus();
    } else if (!libraryVisible && wasOpenRef.current && isBelowLg) {
      previousFocusRef.current?.focus();
    }
    wasOpenRef.current = libraryVisible;
  }, [libraryVisible, isBelowLg]);

  useEffect(() => {
    if (!libraryVisible || !isBelowLg) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setDeviceLibraryDrawerOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getTabbableElements(drawerRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        closeButtonRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isBelowLg, libraryVisible, setDeviceLibraryDrawerOpen]);

  return (
    <div
      className={`grid min-h-0 flex-1 gap-3 ${libraryVisible ? 'grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]' : 'grid-cols-1'}`}
    >
      {isBelowLg && sidebar && !libraryVisible && <button type="button" onClick={() => setDeviceLibraryDrawerOpen(true)} className="absolute left-6 bottom-4 z-40 rounded-full border border-edge bg-surface px-4 py-2 text-sm shadow-panel">{sidebarLabel}</button>}
      {libraryVisible && (
        <>
          <button
            type="button"
            aria-label="Close device library"
            className="fixed inset-0 z-[80] bg-black/55 lg:hidden"
            onClick={() => setDeviceLibraryDrawerOpen(false)}
          />
          <aside
            ref={drawerRef}
            role={isBelowLg ? 'dialog' : undefined}
            aria-modal={isBelowLg ? true : undefined}
            aria-label={sidebarLabel}
            className="fixed inset-y-3 left-3 z-[90] min-h-0 w-[min(320px,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-edge bg-surface/96 shadow-panel dark:border-edge dark:bg-surface/96 lg:static lg:z-auto lg:w-auto lg:bg-surface/82 lg:shadow-none lg:dark:bg-surface/82"
            data-testid="device-library-panel"
          >
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Close device library"
              className="absolute right-3 top-3 z-30 inline-flex h-9 w-9 items-center justify-center rounded-full border border-edge bg-surface/90 text-content-secondary shadow-sm transition hover:border-accent hover:text-accent-fg dark:border-edge-strong dark:bg-surface-raised lg:hidden"
              onClick={() => setDeviceLibraryDrawerOpen(false)}
            >
              <X size={16} />
            </button>
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center px-6 text-sm text-content-muted">
                  Loading device library...
                </div>
              }
            >
              {sidebar ?? <ComponentLibrary />}
            </Suspense>
          </aside>
        </>
      )}

      <section className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-edge bg-surface/82 dark:border-edge dark:bg-surface/82">
        {canvas}
      </section>
    </div>
  );
}
