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
  const setDeviceLibraryDrawerOpen = useLayoutPrefsStore((state) => state.setDeviceLibraryDrawerOpen);
  const isBelowLg = useIsBelowLg();
  const libraryVisible = isBelowLg ? deviceLibraryDrawerOpen : sidebar != null || deviceLibraryOpen;
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(libraryVisible);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null);
  const [libraryWidth, setLibraryWidth] = useState(280);
  const [maxLibraryWidth, setMaxLibraryWidth] = useState(400);
  const effectiveLibraryWidth = Math.min(libraryWidth, maxLibraryWidth);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      setMaxLibraryWidth(Math.max(240, Math.min(400, Math.floor(entry.contentRect.width * 0.4))));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

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
      ref={containerRef}
      className="grid min-h-0 flex-1 grid-cols-1 gap-3"
      style={!isBelowLg && libraryVisible ? { gridTemplateColumns: `${sidebar != null ? 220 : effectiveLibraryWidth}px minmax(0,1fr)` } : undefined}
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
            <div className={`relative h-full min-h-0 ${!isBelowLg && sidebar == null ? 'pr-2' : ''}`}>
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center px-6 text-sm text-content-muted">
                  Loading device library...
                </div>
              }
            >
              {sidebar ?? <ComponentLibrary />}
            </Suspense>
            {!isBelowLg && sidebar == null && (
              <div
                role="separator"
                tabIndex={0}
                aria-label="Resize device library"
                aria-orientation="vertical"
                aria-valuemin={240}
                aria-valuemax={maxLibraryWidth}
                aria-valuenow={effectiveLibraryWidth}
                title="Drag to resize, or use Left and Right arrow keys"
                className="absolute inset-y-4 right-0 flex w-2 items-center justify-center cursor-col-resize touch-none rounded-full hover:bg-accent-subtle focus:bg-accent-subtle focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.currentTarget.focus();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  resizeStartRef.current = { x: event.clientX, width: effectiveLibraryWidth };
                }}
                onPointerMove={(event) => {
                  const start = resizeStartRef.current;
                  if (start) setLibraryWidth(Math.max(240, Math.min(maxLibraryWidth, start.width + event.clientX - start.x)));
                }}
                onPointerUp={() => { resizeStartRef.current = null; }}
                onLostPointerCapture={() => { resizeStartRef.current = null; }}
                onKeyDown={(event) => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                  event.preventDefault();
                  setLibraryWidth(event.key === 'Home' ? 240 : event.key === 'End' ? maxLibraryWidth
                    : Math.max(240, Math.min(maxLibraryWidth, effectiveLibraryWidth + (event.key === 'ArrowRight' ? 20 : -20))));
                }}
              >
                <span aria-hidden="true" className="h-10 w-1 rounded-full bg-edge-strong" />
              </div>
            )}
            </div>
          </aside>
        </>
      )}

      <section className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-edge bg-surface/82 dark:border-edge dark:bg-surface/82">
        {canvas}
      </section>
    </div>
  );
}
