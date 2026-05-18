import {
  Copy,
  Download,
  FileJson,
  MoreHorizontal,
  Plus,
  Redo,
  RotateCcw,
  Save,
  Undo,
  Upload,
} from 'lucide-react';

const ACTION_BUTTON_CLASS =
  'inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-sm transition hover:border-cyan-300 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-cyan-700 dark:hover:text-cyan-300';

interface ActionBarProps {
  canUndo: boolean;
  canRedo: boolean;
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
  return (
    <div className="border-b border-slate-200 bg-slate-50/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/90">
      <div className="flex flex-wrap items-center gap-3">
        <ActionGroup label="Edit">
          <button className={ACTION_BUTTON_CLASS} onClick={onNewLayout} type="button">
            <RotateCcw size={13} />
            New
          </button>
          <button className={ACTION_BUTTON_CLASS} onClick={onDuplicate} type="button">
            <Copy size={13} />
            Duplicate
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

        <ActionGroup label="Data">
          <button className={ACTION_BUTTON_CLASS} onClick={onSaveLocal} type="button">
            <Save size={13} />
            Save local
          </button>
          <button className={ACTION_BUTTON_CLASS} onClick={onLoadLocal} type="button">
            <Upload size={13} />
            Load local
          </button>
          <button className={ACTION_BUTTON_CLASS} onClick={onImportLayout} type="button">
            <Upload size={13} />
            Import rack
          </button>
          <button className={ACTION_BUTTON_CLASS} onClick={onAddInterRackCable} type="button">
            <Plus size={13} />
            Inter-rack
          </button>
        </ActionGroup>

        <ActionGroup label="Export">
          <button className={ACTION_BUTTON_CLASS} onClick={onExportJson} type="button">
            <FileJson size={13} />
            JSON
          </button>
          <button className={ACTION_BUTTON_CLASS} onClick={onExportPng} type="button">
            <Download size={13} />
            PNG
          </button>
          <details className="relative">
            <summary className={`${ACTION_BUTTON_CLASS} list-none`}>
              <MoreHorizontal size={13} />
              More
            </summary>
            <div className="absolute right-0 z-20 mt-2 flex w-52 flex-col rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <button className="rounded-xl px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={onLoadSample} type="button">
                Load sample layout
              </button>
              <button className="rounded-xl px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={onExportWorkspace} type="button">
                Export workspace JSON
              </button>
              <button className="rounded-xl px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={onImportWorkspace} type="button">
                Import workspace JSON
              </button>
              <button className="rounded-xl px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={onExportMigration} type="button">
                Export migration plan
              </button>
            </div>
          </details>
        </ActionGroup>
      </div>
    </div>
  );
}
