import {
  AlertTriangle,
  Cable,
  Copy,
  Download,
  FileDown,
  FileJson,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Redo,
  RotateCcw,
  Save,
  Search,
  Undo,
  Upload,
} from 'lucide-react';
import { useRef } from 'react';

const ACTION_BUTTON_CLASS =
  'inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-sm transition hover:border-cyan-300 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-cyan-700 dark:hover:text-cyan-300';

const PRIMARY_ACTION_BUTTON_CLASS =
  'inline-flex h-8 items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500 px-3 text-xs font-semibold text-white shadow-sm shadow-cyan-500/20 transition hover:bg-cyan-400';

const MENU_BUTTON_CLASS =
  'rounded-xl px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800';

interface ActionBarProps {
  canUndo: boolean;
  canRedo: boolean;
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

function ActionGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100/75 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
        {label}
      </span>
      {children}
    </div>
  );
}

export function ActionBar({
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
  onExportPng,
  onImportWorkspace,
  onExportWorkspace,
  onExportMigration,
  onAddInterRackCable,
}: ActionBarProps) {
  const fileMenuRef = useRef<HTMLDetailsElement>(null);

  function runFileAction(action: () => void) {
    action();
    fileMenuRef.current?.removeAttribute('open');
  }

  return (
    <div className="border-b border-slate-200 bg-slate-50/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/90">
      <div className="flex flex-wrap items-center gap-3">
        <ActionGroup label="Start">
          <button className={PRIMARY_ACTION_BUTTON_CLASS} onClick={onAddDevice} type="button">
            <Plus size={13} />
            Add device
          </button>
          <button className={ACTION_BUTTON_CLASS} onClick={onLoadSample} type="button">
            <FolderOpen size={13} />
            Load sample
          </button>
          <button className={ACTION_BUTTON_CLASS} onClick={onImportLayout} type="button">
            <Upload size={13} />
            Import rack
          </button>
        </ActionGroup>

        <ActionGroup label="Work">
          <button className={ACTION_BUTTON_CLASS} onClick={onAddCable} type="button">
            <Cable size={13} />
            Connect cable
          </button>
          <button className={ACTION_BUTTON_CLASS} onClick={onFixAlerts} type="button">
            <AlertTriangle size={13} />
            {issueCount > 0 ? `Fix alerts (${issueCount})` : 'Check alerts'}
          </button>
          <button className={ACTION_BUTTON_CLASS} onClick={onOpenSearch} type="button">
            <Search size={13} />
            Search
          </button>
          <button className={ACTION_BUTTON_CLASS} onClick={onUndo} type="button" disabled={!canUndo}>
            <Undo size={13} />
            Undo
          </button>
          <button className={ACTION_BUTTON_CLASS} onClick={onRedo} type="button" disabled={!canRedo}>
            <Redo size={13} />
            Redo
          </button>
        </ActionGroup>

        <ActionGroup label="File">
          <details ref={fileMenuRef} className="relative" data-testid="more-dropdown">
            <summary className={`${ACTION_BUTTON_CLASS} list-none`} role="button" aria-label="More options">
              <MoreHorizontal size={13} />
              File & export
            </summary>
            <div className="absolute right-0 z-20 mt-2 flex w-56 flex-col rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <button className={MENU_BUTTON_CLASS} onClick={() => runFileAction(onNewLayout)} type="button">
                <RotateCcw className="mr-2 inline" size={13} />
                New rack layout
              </button>
              <button className={MENU_BUTTON_CLASS} onClick={() => runFileAction(onDuplicate)} type="button">
                <Copy className="mr-2 inline" size={13} />
                Duplicate current rack
              </button>
              <button className={MENU_BUTTON_CLASS} onClick={() => runFileAction(onSaveLocal)} type="button">
                <Save className="mr-2 inline" size={13} />
                Save local copy
              </button>
              <button className={MENU_BUTTON_CLASS} onClick={() => runFileAction(onLoadLocal)} type="button">
                <Upload className="mr-2 inline" size={13} />
                Load local copy
              </button>
              <button className={MENU_BUTTON_CLASS} onClick={() => runFileAction(onAddInterRackCable)} type="button">
                <Plus className="mr-2 inline" size={13} />
                Add inter-rack cable
              </button>
              <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
              <button className={MENU_BUTTON_CLASS} onClick={() => runFileAction(onExportJson)} type="button">
                <FileJson className="mr-2 inline" size={13} />
                Export rack JSON
              </button>
              <button className={MENU_BUTTON_CLASS} onClick={() => runFileAction(onExportPng)} type="button">
                <Download className="mr-2 inline" size={13} />
                Export rack PNG
              </button>
              <button className={MENU_BUTTON_CLASS} onClick={() => runFileAction(onExportWorkspace)} type="button">
                <FileDown className="mr-2 inline" size={13} />
                Export workspace JSON
              </button>
              <button className={MENU_BUTTON_CLASS} onClick={() => runFileAction(onImportWorkspace)} type="button">
                <Upload className="mr-2 inline" size={13} />
                Import workspace JSON
              </button>
              <button className={MENU_BUTTON_CLASS} onClick={() => runFileAction(onExportMigration)} type="button">
                <Download className="mr-2 inline" size={13} />
                Export migration plan
              </button>
            </div>
          </details>
        </ActionGroup>
      </div>
    </div>
  );
}
