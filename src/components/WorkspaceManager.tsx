import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Pencil,
  Plus,
  Server,
  Trash2,
} from 'lucide-react';
import type { RackLayout, RackType, Workspace } from '../types/rack';

interface WorkspaceManagerProps {
  workspace: Workspace;
  currentRackId: string;
  onSwitchRack: (rackId: string) => void;
  onCreateRack: (name: string) => void;
  onDeleteRack: (rackId: string) => void;
  onDuplicateRack: (rackId: string, newName: string) => void;
  onRenameRack: (rackId: string, name: string) => void;
  onRenameWorkspace: (name: string) => void;
}

type HealthStatus = 'good' | 'warning' | 'critical';

function getRackHealth(rack: RackLayout): HealthStatus {
  const totalPower = rack.devices.reduce((sum, d) => sum + d.powerW, 0);
  if (totalPower > rack.powerBudgetW) return 'critical';
  if (rack.devices.length / rack.heightU > 0.9) return 'warning';
  return 'good';
}

const healthDotClass: Record<HealthStatus, string> = {
  good: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
};

const RACK_TYPE_LABEL: Record<RackType, string> = {
  '10in': '10″',
  '19in': '19″',
};

function WorkspaceManager({
  workspace,
  currentRackId,
  onSwitchRack,
  onCreateRack,
  onDeleteRack,
  onDuplicateRack,
  onRenameRack,
  onRenameWorkspace,
}: WorkspaceManagerProps) {
  const [editingName, setEditingName] = useState(false);
  const [workspaceNameInput, setWorkspaceNameInput] = useState(workspace.name);

  const [createOpen, setCreateOpen] = useState(false);
  const [newRackName, setNewRackName] = useState('');
  const [newRackType, setNewRackType] = useState<RackType>('19in');
  const [newRackHeight, setNewRackHeight] = useState(42);

  const [deleteTarget, setDeleteTarget] = useState<{ rackId: string; name: string } | null>(null);

  const [renameTarget, setRenameTarget] = useState<{ rackId: string; name: string } | null>(null);
  const [renameInput, setRenameInput] = useState('');

  const [contextMenu, setContextMenu] = useState<{ rackId: string; x: number; y: number } | null>(null);

  const tabsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const totalDevices = useMemo(
    () => workspace.racks.reduce((sum, r) => sum + r.devices.length, 0),
    [workspace.racks]
  );

  const updateScrollability = useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollability();
    const el = tabsRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollability, { passive: true });
    const ro = new ResizeObserver(updateScrollability);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollability);
      ro.disconnect();
    };
  }, [updateScrollability, workspace.racks.length]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (contextMenu) {
        setContextMenu(null);
      }
    }
    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu]);

  useEffect(() => {
    setWorkspaceNameInput(workspace.name);
  }, [workspace.name]);

  const scrollTabs = useCallback((direction: 'left' | 'right') => {
    const el = tabsRef.current;
    if (!el) return;
    const amount = direction === 'left' ? -200 : 200;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  }, []);

  const handleSaveWorkspaceName = useCallback(() => {
    const trimmed = workspaceNameInput.trim();
    if (trimmed) {
      onRenameWorkspace(trimmed);
    } else {
      setWorkspaceNameInput(workspace.name);
    }
    setEditingName(false);
  }, [workspaceNameInput, workspace.name, onRenameWorkspace]);

  const handleOpenCreate = useCallback(() => {
    setNewRackName(`Rack ${workspace.racks.length + 1}`);
    setNewRackType('19in');
    setNewRackHeight(42);
    setCreateOpen(true);
  }, [workspace.racks.length]);

  const handleCreateSubmit = useCallback(() => {
    const trimmed = newRackName.trim();
    if (trimmed) {
      onCreateRack(trimmed);
    }
    setCreateOpen(false);
  }, [newRackName, onCreateRack]);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) {
      onDeleteRack(deleteTarget.rackId);
      setDeleteTarget(null);
    }
  }, [deleteTarget, onDeleteRack]);

  const handleRenameSave = useCallback(() => {
    if (renameTarget) {
      const trimmed = renameInput.trim();
      if (trimmed) {
        onRenameRack(renameTarget.rackId, trimmed);
      }
      setRenameTarget(null);
    }
  }, [renameInput, renameTarget, onRenameRack]);

  const openRename = useCallback((rack: RackLayout) => {
    setRenameTarget({ rackId: rack.id, name: rack.name });
    setRenameInput(rack.name);
    setContextMenu(null);
  }, []);

  const openDuplicate = useCallback((rack: RackLayout) => {
    onDuplicateRack(rack.id, `${rack.name} Copy`);
    setContextMenu(null);
  }, [onDuplicateRack]);

  const openDelete = useCallback((rack: RackLayout) => {
    setDeleteTarget({ rackId: rack.id, name: rack.name });
    setContextMenu(null);
  }, []);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, rackId: string) => {
      event.preventDefault();
      setContextMenu({ rackId, x: event.clientX, y: event.clientY });
    },
    []
  );

  const manyRacks = workspace.racks.length > 4;

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-100/78 p-4 dark:border-slate-800 dark:bg-slate-900/78">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-2">
        {editingName ? (
          <input
            autoFocus
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            value={workspaceNameInput}
            onChange={(e) => setWorkspaceNameInput(e.target.value)}
            onBlur={handleSaveWorkspaceName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveWorkspaceName();
              if (e.key === 'Escape') {
                setWorkspaceNameInput(workspace.name);
                setEditingName(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="flex items-center gap-2 text-left text-base font-semibold text-slate-800 transition hover:text-cyan-600 dark:text-slate-100 dark:hover:text-cyan-400"
          >
            <Server size={18} />
            {workspace.name}
            <Pencil size={13} className="opacity-50" />
          </button>
        )}
        <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {workspace.racks.length} rack{workspace.racks.length === 1 ? '' : 's'}
          </span>
          <span>•</span>
          <span>{totalDevices} device{totalDevices === 1 ? '' : 's'}</span>
          <span>•</span>
          <span>
            {workspace.interRackCables.length} inter-rack cable
            {workspace.interRackCables.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1">
        {manyRacks && canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollTabs('left')}
            className="shrink-0 rounded-md border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        <div
          ref={tabsRef}
          className="thin-scrollbar flex flex-1 gap-2 overflow-x-auto"
        >
          {workspace.racks.map((rack) => {
            const isActive = rack.id === currentRackId;
            const health = getRackHealth(rack);
            return (
              <div key={rack.id} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => onSwitchRack(rack.id)}
                  onContextMenu={(e) => handleContextMenu(e, rack.id)}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                    isActive
                      ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-700 dark:border-cyan-400/50 dark:bg-cyan-400/10 dark:text-cyan-300'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${healthDotClass[health]}`}
                    title={health}
                  />
                  <span className="max-w-[8rem] truncate font-medium">{rack.name}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {RACK_TYPE_LABEL[rack.rackType]}
                  </span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    {rack.devices.length}
                  </span>
                </button>

                {contextMenu?.rackId === rack.id && (
                  <div
                    className="fixed z-50 w-36 overflow-hidden rounded-md border shadow-lg"
                    style={{
                      left: contextMenu.x,
                      top: contextMenu.y,
                      backgroundColor: 'var(--theme-bg-secondary)',
                      borderColor: 'var(--theme-border)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => openRename(rack)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:opacity-80"
                      style={{ color: 'var(--theme-text-secondary)' }}
                    >
                      <Pencil size={13} />
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => openDuplicate(rack)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:opacity-80"
                      style={{ color: 'var(--theme-text-secondary)' }}
                    >
                      <Copy size={13} />
                      Duplicate
                    </button>
                    <div
                      className="mx-2 my-1 h-px"
                      style={{ backgroundColor: 'var(--theme-border)' }}
                    />
                    <button
                      type="button"
                      onClick={() => openDelete(rack)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:opacity-80 dark:text-red-400"
                    >
                      <Trash2 size={13} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"
          >
            <Plus size={14} />
            New Rack
          </button>
        </div>

        {manyRacks && canScrollRight && (
          <button
            type="button"
            onClick={() => scrollTabs('right')}
            className="shrink-0 rounded-md border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* Create Rack Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            className="w-80 rounded-lg border p-5 shadow-xl"
            style={{
              backgroundColor: 'var(--theme-bg-secondary)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <div className="mb-4 text-sm font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
              New Rack
            </div>
            <div className="space-y-3">
              <label className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                Name
                <input
                  autoFocus
                  className="mt-1 h-9 w-full rounded-md border px-2 text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--theme-bg-input)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-primary)',
                  }}
                  value={newRackName}
                  onChange={(e) => setNewRackName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateSubmit();
                  }}
                />
              </label>

              <div className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                Rack type
                <div className="mt-1 flex gap-2">
                  {(['10in', '19in'] as RackType[]).map((type) => (
                    <label
                      key={type}
                      className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm ${
                        newRackType === type
                          ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-700 dark:border-cyan-400/50 dark:bg-cyan-400/10 dark:text-cyan-300'
                          : ''
                      }`}
                      style={
                        newRackType !== type
                          ? {
                              backgroundColor: 'var(--theme-bg-input)',
                              borderColor: 'var(--theme-border)',
                              color: 'var(--theme-text-secondary)',
                            }
                          : undefined
                      }
                    >
                      <input
                        type="radio"
                        name="rackType"
                        className="sr-only"
                        checked={newRackType === type}
                        onChange={() => setNewRackType(type)}
                      />
                      {RACK_TYPE_LABEL[type]}
                    </label>
                  ))}
                </div>
              </div>

              <label className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                Height
                <select
                  className="mt-1 h-9 w-full rounded-md border px-2 text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--theme-bg-input)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-primary)',
                  }}
                  value={newRackHeight}
                  onChange={(e) => setNewRackHeight(Number(e.target.value))}
                >
                  <option value={12}>12U</option>
                  <option value={24}>24U</option>
                  <option value={42}>42U</option>
                  <option value={48}>48U</option>
                </select>
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="h-9 flex-1 rounded-md border border-cyan-500/40 bg-cyan-500/10 text-sm font-medium text-cyan-700 hover:bg-cyan-500/20 dark:text-cyan-300"
                onClick={handleCreateSubmit}
              >
                Create
              </button>
              <button
                type="button"
                className="h-9 flex-1 rounded-md border text-sm hover:opacity-80"
                style={{
                  backgroundColor: 'var(--theme-bg-input)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-secondary)',
                }}
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            className="w-80 rounded-lg border p-5 shadow-xl"
            style={{
              backgroundColor: 'var(--theme-bg-secondary)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <div className="mb-3 text-sm font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
              Delete &apos;{deleteTarget.name}&apos;?
            </div>
            <div className="mb-4 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
              This cannot be undone.
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="h-9 flex-1 rounded-md border border-red-500/40 bg-red-500/10 text-sm font-medium text-red-100 hover:bg-red-500/20"
                onClick={handleDeleteConfirm}
              >
                Delete
              </button>
              <button
                type="button"
                className="h-9 flex-1 rounded-md border text-sm hover:opacity-80"
                style={{
                  backgroundColor: 'var(--theme-bg-input)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-secondary)',
                }}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Rack Modal */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            className="w-80 rounded-lg border p-5 shadow-xl"
            style={{
              backgroundColor: 'var(--theme-bg-secondary)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <div className="mb-4 text-sm font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
              Rename Rack
            </div>
            <input
              autoFocus
              className="h-9 w-full rounded-md border px-2 text-sm outline-none"
              style={{
                backgroundColor: 'var(--theme-bg-input)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-primary)',
              }}
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSave();
                if (e.key === 'Escape') setRenameTarget(null);
              }}
            />
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="h-9 flex-1 rounded-md border border-cyan-500/40 bg-cyan-500/10 text-sm font-medium text-cyan-700 hover:bg-cyan-500/20 dark:text-cyan-300"
                onClick={handleRenameSave}
              >
                Save
              </button>
              <button
                type="button"
                className="h-9 flex-1 rounded-md border text-sm hover:opacity-80"
                style={{
                  backgroundColor: 'var(--theme-bg-input)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-secondary)',
                }}
                onClick={() => setRenameTarget(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export { WorkspaceManager };
export type { WorkspaceManagerProps };
