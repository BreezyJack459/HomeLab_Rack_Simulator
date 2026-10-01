import { useEffect, useRef, type ReactNode } from "react";

export function WorkspaceDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previousFocus?.isConnected && previousFocus !== document.body && previousFocus !== document.documentElement && previousFocus.getClientRects().length > 0) previousFocus.focus();
      else document.querySelector<HTMLElement>('[data-testid="more-dropdown"] summary')?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onKeyDown={(event) => event.stopPropagation()}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto max-h-[85vh] w-[min(640px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-edge bg-surface p-0 text-content shadow-panel backdrop:bg-black/60"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-edge bg-surface p-4">
        <h2 className="font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 shrink-0 rounded-lg border border-edge px-3 py-2 text-sm"
        >
          Close
        </button>
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  );
}
