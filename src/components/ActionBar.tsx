import {
  AlertTriangle,
  Cable,
  ChevronDown,
  Copy,
  Download,
  FileJson,
  FolderOpen,
  Plus,
  Redo,
  RotateCcw,
  Save,
  Search,
  Undo,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

export const MENU_BUTTON_CLASS =
  'rounded-xl px-3 py-2 text-left text-xs text-content-secondary hover:bg-fill dark:text-content-secondary dark:hover:bg-fill';

const MENU_TRIGGER_CLASS =
  'inline-flex h-8 items-center gap-1.5 rounded-full border border-edge bg-surface px-3 text-xs font-medium text-content-secondary shadow-sm transition hover:border-accent hover:text-accent-fg dark:border-edge-strong dark:bg-surface-raised dark:text-content-secondary dark:hover:border-accent dark:hover:text-accent-fg';

export interface ActionMenusProps {
  canUndo: boolean;
  canRedo: boolean;
  issueCount: number;
  onAddDevice: () => void;
  onAddCable?: (() => void) | null;
  onFixAlerts: () => void;
  onOpenSearch: () => void;
  onNewLayout: () => void;
  onDuplicate: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSaveLocal: () => void;
  onLoadLocal: () => void;
  onImportLayout: () => void;
  onLoadSample: () => void;
  onExportJson: () => void;
  onWorkspaceBackup?: () => void;
  onExportPng: () => void;
  onExportDrawio?: () => void;
  onExportExcalidraw?: () => void;
  onExportSvg?: () => void;
}

interface ActionBarProps extends ActionMenusProps {
  contextContent?: ReactNode;
}

export function ActionMenu({
  label,
  summary,
  menuRef,
  align = 'left',
  children,
  testId,
}: {
  label: string;
  summary: string;
  menuRef: React.RefObject<HTMLDetailsElement>;
  align?: 'left' | 'right';
  children: ReactNode;
  testId?: string;
}) {
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) menuRef.current?.removeAttribute('open'); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && menuRef.current?.open) { menuRef.current.removeAttribute('open'); menuRef.current.querySelector('summary')?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [menuRef]);
  return (
    <details ref={menuRef as React.LegacyRef<HTMLDetailsElement>} className="relative" data-testid={testId}>
      <summary className={`${MENU_TRIGGER_CLASS} list-none`} role="button" aria-label={label}>
        {summary}
        <ChevronDown size={13} />
      </summary>
      <div
        className={`absolute z-20 mt-2 flex max-h-[70vh] w-56 flex-col overflow-y-auto rounded-2xl border border-edge bg-surface p-2 shadow-xl dark:border-edge-strong dark:bg-surface-raised ${
          align === 'right' ? 'right-0' : 'left-0'
        }`}
      >
        {children}
      </div>
    </details>
  );
}

// Create / Actions / File menus, shared between the classic ActionBar and the
// new-shell CanvasHeader. Menu contents live here only — do not reimplement.
export function ActionMenus({
  fileOnly = false,
  canUndo,
  canRedo,
  issueCount,
  onAddDevice,
  onAddCable,
  onFixAlerts,
  onOpenSearch,
  onNewLayout,
  onDuplicate,
  onUndo,
  onRedo,
  onSaveLocal,
  onLoadLocal,
  onImportLayout,
  onLoadSample,
  onExportJson,
  onWorkspaceBackup,
  onExportPng,
  onExportDrawio,
  onExportExcalidraw,
  onExportSvg,
}: ActionMenusProps & { fileOnly?: boolean }) {
  const createMenuRef = useRef<HTMLDetailsElement>(null);
  const workMenuRef = useRef<HTMLDetailsElement>(null);
  const fileMenuRef = useRef<HTMLDetailsElement>(null);

  function closeMenus() {
    createMenuRef.current?.removeAttribute('open');
    workMenuRef.current?.removeAttribute('open');
    fileMenuRef.current?.removeAttribute('open');
  }

  function runMenuAction(action: () => void) {
    action();
    closeMenus();
  }

  return (
    <>
      {!fileOnly && <ActionMenu
        label="Create options"
        summary="Create"
        menuRef={createMenuRef}
        testId="create-dropdown"
      >
        <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onAddDevice)} type="button">
          <Plus className="mr-2 inline" size={13} />
          Add device
        </button>
        <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onLoadSample)} type="button">
          <FolderOpen className="mr-2 inline" size={13} />
          Load sample
        </button>
        <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onImportLayout)} type="button">
          <Upload className="mr-2 inline" size={13} />
          Import rack
        </button>
        <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onNewLayout)} type="button">
          <RotateCcw className="mr-2 inline" size={13} />
          New rack layout
        </button>
        <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onDuplicate)} type="button">
          <Copy className="mr-2 inline" size={13} />
          Duplicate current rack
        </button>
      </ActionMenu>}

      {!fileOnly && <ActionMenu
        label="Work options"
        summary="Actions"
        menuRef={workMenuRef}
        testId="actions-dropdown"
      >
        {onAddCable ? (
          <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onAddCable)} type="button">
            <Cable className="mr-2 inline" size={13} />
            Connect cable
          </button>
        ) : null}
        <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onFixAlerts)} type="button">
          <AlertTriangle className="mr-2 inline" size={13} />
          {issueCount > 0 ? `Fix alerts (${issueCount})` : 'Check alerts'}
        </button>
        <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onOpenSearch)} type="button">
          <Search className="mr-2 inline" size={13} />
          Search
        </button>
        <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onUndo)} type="button" disabled={!canUndo}>
          <Undo className="mr-2 inline" size={13} />
          Undo
        </button>
        <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onRedo)} type="button" disabled={!canRedo}>
          <Redo className="mr-2 inline" size={13} />
          Redo
        </button>
      </ActionMenu>}

      <ActionMenu
        label="File and export options"
        summary={fileOnly ? "File" : "File & export"}
        menuRef={fileMenuRef}
        align="right"
        testId="more-dropdown"
      >
        {fileOnly && <>
          <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onNewLayout)} type="button">New rack layout</button>
          <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onLoadSample)} type="button">Load sample</button>
          <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onImportLayout)} type="button">Import rack</button>
          <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onDuplicate)} type="button">Duplicate current rack</button>
          <div className="my-1 border-t border-edge" />
        </>}
        <p className="px-3 py-2 text-xs text-content-muted">Autosave is stored in this browser only.</p>
        {onWorkspaceBackup && <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onWorkspaceBackup)} type="button">Workspace backup and restore</button>}
        <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onSaveLocal)} type="button">
          <Save className="mr-2 inline" size={13} />
          Save local copy
        </button>
        <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onLoadLocal)} type="button">
          <Upload className="mr-2 inline" size={13} />
          Load local copy
        </button>
        <div className="my-1 border-t border-edge" />
        <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onExportJson)} type="button">
          <FileJson className="mr-2 inline" size={13} />
          Export rack JSON
        </button>
        <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onExportPng)} type="button">
          <Download className="mr-2 inline" size={13} />
          Export rack PNG
        </button>
        {onExportDrawio ? (
          <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onExportDrawio)} type="button">
            <Download className="mr-2 inline" size={13} />
            Export draw.io
          </button>
        ) : null}
        {onExportExcalidraw ? (
          <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onExportExcalidraw)} type="button">
            <Download className="mr-2 inline" size={13} />
            Export Excalidraw
          </button>
        ) : null}
        {onExportSvg ? (
          <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onExportSvg)} type="button">
            <Download className="mr-2 inline" size={13} />
            Export diagram SVG
          </button>
        ) : null}
      </ActionMenu>
    </>
  );
}

export function ActionBar({ contextContent, ...menuProps }: ActionBarProps) {
  return (
    <div className="border-b border-edge bg-fill-subtle/85 px-4 py-2 dark:border-edge dark:bg-surface/85">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">{contextContent}</div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ActionMenus {...menuProps} />
        </div>
      </div>
    </div>
  );
}
