import { useEffect, useRef } from 'react';
import { useRackStore } from '../store/rackStore';
import { shouldHideDevice } from '../utils/featureFlags';
import { getRackResizeImpact } from '../utils/rackResize';

const buttonClass = 'rounded-lg border border-edge-strong px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

export function LayoutRecovery() {
  const layout = useRackStore(s => s.layout);
  const workspace = useRackStore(s => s.workspace);
  const error = useRackStore(s => s.persistenceError);
  const source = useRackStore(s => s.recoverySource);
  const blocked = useRackStore(s => s.persistenceBlocked);
  const pending = useRackStore(s => s.pendingRackResize);
  const resolve = useRackStore(s => s.resolveRackResize);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pending) return;
    const previous = document.activeElement as HTMLElement | null;
    const modal = dialog.current;
    modal?.showModal();
    cancel.current?.focus();
    return () => { modal?.close(); previous?.focus(); };
  }, [pending]);
  const hidden = workspace.racks.flatMap(r => [...r.devices, ...(r.unplacedDevices ?? [])].filter(shouldHideDevice));
  const impact = pending ? getRackResizeImpact(layout, pending.patch.heightU, workspace) : null;
  const bounds = getRackResizeImpact(layout, layout.heightU, workspace);
  const download = async () => {
    const { downloadWorkspaceJson } = await import('../utils/exporters');
    downloadWorkspaceJson(useRackStore.getState().workspace);
  };
  return <>
    {(hidden.length > 0 || error || bounds.devices.length > 0 || bounds.reservations.length > 0) &&
      <section aria-label="Layout recovery" className="max-h-48 shrink-0 overflow-auto border-b border-edge bg-surface px-4 py-2 text-sm">
        {hidden.length > 0 && <p role="status">Unsupported 0U hardware: {hidden.length} device(s) preserved with their cables and planning records. 0U physical planning is disabled; these devices and routes are not rendered or editable. Export JSON to retain them for a compatible version.</p>}
        {(bounds.devices.length > 0 || bounds.reservations.length > 0) && <p role="status">Out-of-bounds planning data retained: {bounds.devices.length} device(s), {bounds.reservations.length} reservation(s). Increase rack height or reposition these records; review Check issues before building.</p>}
        {error && <p role="alert">{error}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={buttonClass} onClick={() => void download()}>Download workspace JSON</button>
          {error && !blocked && <button type="button" className={buttonClass} onClick={() => useRackStore.getState().saveWorkspace()}>Retry save</button>}
          {source !== null && <button type="button" className={buttonClass} onClick={async () => {
            const { downloadTextFile } = await import('../utils/exporters');
            downloadTextFile('unreadable-saved-data.json', source);
          }}>Download original saved data</button>}
        </div>
      </section>}
    {pending && impact && <dialog ref={dialog} aria-labelledby="resize-title" aria-describedby="resize-detail"
      onCancel={(event) => { event.preventDefault(); resolve('cancel'); }}
      className="m-auto max-h-[85vh] w-[min(640px,calc(100vw-2rem))] overflow-auto rounded-xl border border-edge bg-surface p-5 text-content shadow-panel backdrop:bg-black/60">
      <h2 id="resize-title" className="text-lg font-semibold">Review rack height reduction</h2>
      <p id="resize-detail" className="my-3">Reduce {layout.heightU}U to {pending.patch.heightU}U? All records will be retained. Devices and reservations beyond the new height remain out of bounds until you reposition them or increase the height. Undo is available until reload; retained data survives reload when autosave succeeds.</p>
      <ul className="my-3 list-disc pl-5">
        <li>Devices ({impact.devices.length}): {impact.devices.map(d => `${d.name} (${d.id})`).join(', ') || 'None'}</li>
        <li>Cables ({impact.cables.length}): {impact.cables.map(c => c.id).join(', ') || 'None'}</li>
        <li>Reservations ({impact.reservations.length}): {impact.reservations.map(r => `${r.name} (${r.id})`).join(', ') || 'None'}</li>
        <li>Inter-rack cables ({impact.interRackCables.length}): {impact.interRackCables.map(c => c.id).join(', ') || 'None'}</li>
        <li>Dependent records ({impact.dependentRecords.length}): {impact.dependentRecords.join(', ') || 'None'}</li>
      </ul>
      <p className="my-3 text-sm">Unknown extension fields are also retained unchanged. Dependencies encoded outside record IDs cannot be inferred.</p>
      {error && <p role="alert" className="my-3">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button ref={cancel} type="button" className={buttonClass} onClick={() => resolve('cancel')}>Cancel</button>
        <button type="button" className={buttonClass} onClick={() => resolve('retain')}>Resize and retain all data</button>
      </div>
    </dialog>}
  </>;
}
