import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getTabbableElements } from '../utils/tabbable';

interface RightInspectorShellProps {
  compact?: boolean;
  title: string;
  description: string;
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}

const BELOW_XL_QUERY = '(max-width: 1279px)';
function useIsBelowXl() {
  const [isBelowXl, setIsBelowXl] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(BELOW_XL_QUERY).matches
      : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(BELOW_XL_QUERY);
    const update = () => setIsBelowXl(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isBelowXl;
}

export function RightInspectorShell({ title, description, children, open, onToggle, compact = false }: RightInspectorShellProps) {
  const isBelowXl = useIsBelowXl();
  const mobileOpenButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(open);

  useEffect(() => {
    if (open && isBelowXl) {
      closeButtonRef.current?.focus();
    } else if (!open && wasOpenRef.current && isBelowXl) {
      mobileOpenButtonRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [isBelowXl, open]);

  useEffect(() => {
    if (!open || !isBelowXl) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onToggle();
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
  }, [isBelowXl, onToggle, open]);

  if (!open) {
    return (
      <>
        <button
          ref={mobileOpenButtonRef}
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label="Open inspector"
          className="absolute bottom-3 right-4 z-40 inline-flex h-11 items-center gap-2 rounded-lg border border-edge bg-surface/95 px-4 text-sm font-medium text-content-secondary shadow-panel transition hover:border-accent hover:text-accent-fg dark:border-edge-strong dark:bg-surface-raised/95 dark:text-content-secondary dark:hover:border-accent dark:hover:text-accent-fg xl:hidden"
        >
          <PanelRightOpen size={16} />
          Inspector
        </button>

        <aside
          aria-label="Inspector"
          className="hidden min-h-0 border-l border-edge/80 bg-fill-subtle/85 dark:border-edge dark:bg-surface/90 xl:flex xl:w-[72px] xl:flex-col xl:items-center xl:py-3"
        >
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label="Open inspector"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-edge bg-surface/85 text-content-secondary transition hover:border-accent hover:text-accent-fg dark:border-edge-strong dark:bg-surface-raised dark:text-content-secondary dark:hover:border-accent dark:hover:text-accent-fg"
          >
            <PanelRightOpen size={16} />
          </button>
          <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-content-faint [writing-mode:vertical-rl] dark:text-content-faint">
            Inspector
          </div>
        </aside>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-label="Close inspector"
        className="fixed inset-0 z-[70] bg-black/55 xl:hidden"
      />

      <aside
        ref={drawerRef}
        role={isBelowXl ? 'dialog' : undefined}
        aria-modal={isBelowXl ? true : undefined}
        aria-label="Inspector"
        className="fixed inset-y-0 right-0 z-[80] flex w-[min(400px,100vw)] min-h-0 flex-col overflow-hidden border-l border-edge bg-surface shadow-panel dark:border-edge dark:bg-surface xl:static xl:z-auto xl:w-auto xl:bg-surface xl:shadow-none xl:dark:bg-surface/90"
      >
        <div className="sticky top-0 z-10 border-b border-edge bg-surface px-4 py-4 dark:border-edge/70 dark:bg-surface/90">
          <div className="flex items-start justify-between gap-3">
            <div>
              {!compact && <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-content-faint">Inspector</div>}
              <h2 className="mt-1 text-base font-semibold text-content">{title}</h2>
              {!compact && <p className="mt-1 text-xs leading-5 text-content-muted">{description}</p>}
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              aria-label="Collapse inspector"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-edge bg-surface/85 text-content-secondary transition hover:border-accent hover:text-accent-fg dark:border-edge-strong dark:bg-surface-raised dark:text-content-secondary dark:hover:border-accent dark:hover:text-accent-fg"
            >
              <PanelRightClose size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto p-4">{children}</div>
      </aside>
    </>
  );
}
