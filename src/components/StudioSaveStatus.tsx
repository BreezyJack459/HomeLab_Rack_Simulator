import { Download, HardDrive, TriangleAlert } from 'lucide-react';
import { useRackStore } from '../store/rackStore';

export function StudioSaveStatus({ onExport, message }: { onExport: () => void; message: string | null }) {
  const error = useRackStore(state => state.persistenceError);
  const blocked = useRackStore(state => state.persistenceBlocked);
  const label = blocked ? 'Autosave paused' : error ? 'Not saved in this browser' : 'Saved in this browser';
  return <footer className="studio-status flex min-h-11 shrink-0 flex-wrap items-center gap-3 border-t border-edge bg-surface px-3 text-xs sm:flex-nowrap sm:px-5" aria-label="Save and backup status">
    <div className={`flex shrink-0 items-center gap-2 ${blocked || error ? 'text-amber-500' : 'text-content-secondary'}`} data-testid="browser-save-status" role={error || blocked ? 'status' : undefined} title={error ?? 'Browser storage is local to this browser. Export JSON for a portable backup.'}>
      {blocked || error ? <TriangleAlert size={14} aria-hidden /> : <HardDrive size={14} aria-hidden />}
      <span>{label}</span>
    </div>
    {message && <p role="status" className="order-last basis-full break-words pb-2 text-content-muted sm:order-none sm:min-w-0 sm:flex-1 sm:basis-auto sm:truncate sm:pb-0" title={message}>{message}</p>}
    <button type="button" onClick={onExport} className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-2 text-xs font-semibold text-accent-fg hover:bg-fill" aria-label="Export JSON backup">
      <Download size={14} aria-hidden /><span>JSON backup</span>
    </button>
  </footer>;
}
