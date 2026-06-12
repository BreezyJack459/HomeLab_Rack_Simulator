import {
  AlertTriangle,
  Cable,
  ChevronDown,
  Copy,
  Download,
  FileDown,
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
import { useRef, type ReactNode } from 'react';

const MENU_BUTTON_CLASS =
  'rounded-xl px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800';

const MENU_TRIGGER_CLASS =
  'inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-sm transition hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-cyan-700 dark:hover:text-cyan-300';

interface ActionBarProps {
  canUndo: boolean;
  canRedo: boolean;
  contextContent?: ReactNode;
  issueCount: number;
  onAddDevice: () => void;
  onAddCable: () => void;
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
  onExportPng: () => void;
  onImportWorkspace: () => void;
  onExportWorkspace: () => void;
  onExportMigration: () => void;
  onAddInterRackCable: () => void;
}

function ActionMenu({
  label,
  summary,
  menuRef,
  align = 'left',
  children,
  testId,
}: {
  label: string;
  summary: string;
  menuRef: React.RefObject<HTMLDetailsElement | null>;
  align?: 'left' | 'right';
  children: ReactNode;
  testId?: string;
}) {
  return (
    <details ref={menuRef} className="relative" data-testid={testId}>
      <summary className={`${MENU_TRIGGER_CLASS} list-none`} role="button" aria-label={label}>
        {summary}
        <ChevronDown size={13} />
      </summary>
      <div
        className={`absolute z-20 mt-2 flex w-56 flex-col rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900 ${
          align === 'right' ? 'right-0' : 'left-0'
        }`}
      >
        {children}
      </div>
    </details>
  );
}

export function ActionBar({
  canUndo,
  canRedo,
  contextContent,
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
  onExportPng,
  onImportWorkspace,
  onExportWorkspace,
  onExportMigration,
  onAddInterRackCable,
}: ActionBarProps) {
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
    <div className="border-b border-slate-200 bg-slate-50/85 px-4 py-2 dark:border-slate-800 dark:bg-slate-950/85">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">{contextContent}</div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ActionMenu
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
          </ActionMenu>

          <ActionMenu
            label="Work options"
            summary="Actions"
            menuRef={workMenuRef}
            testId="actions-dropdown"
          >
            <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onAddCable)} type="button">
              <Cable className="mr-2 inline" size={13} />
              Connect cable
            </button>
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
            <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onAddInterRackCable)} type="button">
              <Plus className="mr-2 inline" size={13} />
              Add inter-rack cable
            </button>
          </ActionMenu>

          <ActionMenu
            label="File and export options"
            summary="File & export"
            menuRef={fileMenuRef}
            align="right"
            testId="more-dropdown"
          >
            <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onSaveLocal)} type="button">
              <Save className="mr-2 inline" size={13} />
              Save local copy
            </button>
            <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onLoadLocal)} type="button">
              <Upload className="mr-2 inline" size={13} />
              Load local copy
            </button>
            <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
            <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onExportJson)} type="button">
              <FileJson className="mr-2 inline" size={13} />
              Export rack JSON
            </button>
            <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onExportPng)} type="button">
              <Download className="mr-2 inline" size={13} />
              Export rack PNG
            </button>
            <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onExportWorkspace)} type="button">
              <FileDown className="mr-2 inline" size={13} />
              Export workspace JSON
            </button>
            <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onImportWorkspace)} type="button">
              <Upload className="mr-2 inline" size={13} />
              Import workspace JSON
            </button>
            <button className={MENU_BUTTON_CLASS} onClick={() => runMenuAction(onExportMigration)} type="button">
              <Download className="mr-2 inline" size={13} />
              Export migration plan
            </button>
          </ActionMenu>
        </div>
      </div>
    </div>
  );
}
