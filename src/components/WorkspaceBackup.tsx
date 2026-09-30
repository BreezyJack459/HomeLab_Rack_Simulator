import { useState } from 'react';
import type { Workspace } from '../types/rack';
import { useRackStore } from '../store/rackStore';
import { WorkspaceDialog } from './WorkspaceDialog';

export function WorkspaceBackup({ onClose }: { onClose: () => void }) {
  const workspace = useRackStore(s => s.workspace);
  const blocked = useRackStore(s => s.persistenceBlocked);
  const saveError = useRackStore(s => s.persistenceError);
  const [candidate, setCandidate] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [reading, setReading] = useState(false);
  return <WorkspaceDialog title="Workspace backup and restore" onClose={onClose}>
    <div className="space-y-4 text-sm">
      <p>Autosave stays in this browser only. Clearing browser data, changing browsers or losing this device can remove access. Download a JSON backup to keep a separate copy.</p>
      <p className="text-content-muted">Includes all {workspace.racks.length} racks, installed and unplaced devices, cables and planning records. Browser preferences and enabled plugins are not included. Export rack JSON contains only one rack.</p>
      {saveError && <p role="alert" className="text-amber-400">{saveError}</p>}
      <button type="button" className="rounded border border-edge px-3 py-2" onClick={async () => {
        const { downloadWorkspaceJson } = await import('../utils/exporters');
        downloadWorkspaceJson(useRackStore.getState().workspace);
      }}>Download full workspace backup</button>
      <label className="block border-t border-edge pt-4">Choose workspace backup to restore
        <input type="file" accept=".json,application/json" className="mt-2 block w-full text-xs" disabled={reading} onChange={async event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          setCandidate(null); setConfirmed(false); setError('');
          if (!file) return;
          setReading(true);
          try {
            const { parseWorkspaceJson } = await import('../utils/exporters');
            const raw = await file.text();
            const imported = parseWorkspaceJson(raw);
            if (!imported) { setError('Invalid workspace backup. Current data has not changed. Choose a full workspace JSON, not a single-rack export.'); return; }
            const original = JSON.parse(raw) as Workspace;
            if ((original.interRackCables?.length ?? 0) !== imported.interRackCables.length) {
              setError('This backup contains invalid inter-rack connections. Restore cancelled to avoid silently removing records. Keep the original file for repair.'); return;
            }
            setCandidate(imported);
          } catch (error) { setError(`Invalid workspace backup. Current data has not changed. ${error instanceof Error ? error.message : 'Could not read this backup.'}`); }
          finally { setReading(false); }
        }} />
      </label>
      {reading && <p role="status">Reading backup…</p>}
      {error && <p role="alert" className="text-amber-400">{error}</p>}
      {candidate && <div className="space-y-3 rounded border border-edge p-3">
        <p>Restore “{candidate.name}”: {candidate.racks.length} racks, {candidate.racks.reduce((n, r) => n + r.devices.length + (r.unplacedDevices?.length ?? 0), 0)} devices, {candidate.interRackCables.length} inter-rack cables.</p>
        <p>This replaces all current racks and resets undo history. Download the current workspace first if you need to keep it.</p>
        {blocked && <p className="text-amber-400">Autosave is paused to protect unreadable saved data. Restoring changes the open workspace only; download it before closing this tab.</p>}
        <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Replace my current workspace with this backup</label>
        <button type="button" disabled={!confirmed} className="rounded border border-edge px-3 py-2 disabled:opacity-40" onClick={() => {
          if (useRackStore.getState().setWorkspace(candidate)) onClose();
          else setError('Could not restore this workspace.');
        }}>Restore workspace</button>
      </div>}
    </div>
  </WorkspaceDialog>;
}
