import {
  Download,
  FileText,
  MapPin,
  Network,
  PenLine,
  Save,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { PatchPanelPortDoc, PlacedDevice } from '../types/rack';
import {
  exportPatchPanelDocsCsv,
  exportPatchPanelDocsMarkdown,
  findPatchPanelDoc,
  getPatchPanelDocSummary,
  validatePatchPanelDocs,
} from '../utils/patchPanelDocs';
import { getPatchPanelJacks, type PatchPanelJack } from '../utils/patchPanel';

const wireCodeOptions = ['T568A', 'T568B'];

function PortDocRow({
  portIndex,
  jack,
  doc,
  onUpdate,
}: {
  portIndex: number;
  jack: PatchPanelJack | null;
  doc: PatchPanelPortDoc | undefined;
  onUpdate: (patch: PatchPanelPortDoc) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<PatchPanelPortDoc>({
    portIndex,
    ...(doc ?? {}),
  });

  function save() {
    onUpdate({ ...form, portIndex });
    setIsEditing(false);
  }

  const connected = jack?.frontPeer || jack?.rearPeer;
  const stateLabel =
    jack?.state === 'patched'
      ? 'patched'
      : jack?.state === 'landed'
      ? 'landed'
      : jack?.state === 'dark-patch'
      ? 'dark-patch'
      : 'empty';

  return (
    <div
      className="rounded-md border text-sm"
      style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
    >
      <div className="flex items-center gap-2 p-2.5">
        <span className="w-8 text-center text-xs font-semibold">{portIndex + 1}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] ${
            jack?.state === 'patched'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : jack?.state === 'landed'
              ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
              : jack?.state === 'dark-patch'
              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : 'bg-slate-500/10 text-slate-700 dark:text-slate-300'
          }`}
        >
          {stateLabel}
        </span>
        {connected && (
          <span className="text-[10px] opacity-60">
            {jack?.frontPeer?.name ?? ''}
            {jack?.frontPeer && jack?.rearPeer ? ' ↔ ' : ''}
            {jack?.rearPeer?.name ?? ''}
          </span>
        )}
        <button
          type="button"
          onClick={() => setIsEditing((v) => !v)}
          className="ml-auto opacity-60 transition hover:opacity-100"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <PenLine size={13} />
        </button>
      </div>

      {isEditing && (
        <div
          className="grid grid-cols-2 gap-2 border-t px-3 py-2.5 text-xs"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Room</div>
            <input
              type="text"
              value={form.destinationRoom ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, destinationRoom: e.target.value || undefined }))}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
              placeholder="e.g. Office"
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Wall Plate</div>
            <input
              type="text"
              value={form.wallPlate ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, wallPlate: e.target.value || undefined }))}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
              placeholder="e.g. WP-01"
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Wire Code</div>
            <select
              value={form.wireCode ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  wireCode: (e.target.value as 'T568A' | 'T568B') || undefined,
                }))
              }
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            >
              <option value="">None</option>
              {wireCodeOptions.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Punch-Down Date</div>
            <input
              type="date"
              value={form.punchDownDate ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, punchDownDate: e.target.value || undefined }))}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Tested Speed</div>
            <input
              type="text"
              value={form.testedSpeed ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, testedSpeed: e.target.value || undefined }))}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
              placeholder="e.g. 1G"
            />
          </div>
          <div className="col-span-2">
            <div className="text-[10px] uppercase tracking-wider opacity-60">Notes</div>
            <input
              type="text"
              value={form.notes ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || undefined }))}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
              placeholder="Any additional details..."
            />
          </div>
          <div className="col-span-2 flex gap-2">
            <button
              type="button"
              onClick={save}
              className="rounded bg-cyan-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-cyan-700"
            >
              <Save size={11} className="inline mr-1" />
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setForm({ portIndex, ...(doc ?? {}) });
                setIsEditing(false);
              }}
              className="rounded border px-2 py-1 text-[11px]"
              style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!isEditing && doc && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 border-t px-3 py-1.5 text-[10px] opacity-70" style={{ borderColor: 'var(--theme-border)' }}>
          {doc.destinationRoom && <span><MapPin size={10} className="inline mr-0.5" />{doc.destinationRoom}</span>}
          {doc.wallPlate && <span>WP: {doc.wallPlate}</span>}
          {doc.wireCode && <span>{doc.wireCode}</span>}
          {doc.punchDownDate && <span>{doc.punchDownDate}</span>}
          {doc.testedSpeed && <span>{doc.testedSpeed}</span>}
          {doc.notes && <span className="truncate">{doc.notes}</span>}
        </div>
      )}
    </div>
  );
}

function PatchPanelSection({
  device,
  layout,
  onUpdateDoc,
}: {
  device: PlacedDevice;
  layout: { devices: PlacedDevice[]; cables: CableRoute[] };
  onUpdateDoc: (doc: PatchPanelPortDoc) => void;
}) {
  const jacks = useMemo(() => getPatchPanelJacks(layout, device.id), [layout, device.id]);
  const summary = useMemo(() => getPatchPanelDocSummary(device), [device]);
  const issues = useMemo(() => validatePatchPanelDocs(device, layout.cables), [device, layout.cables]);

  return (
    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <Network size={14} />
          {device.name}
        </div>
        <div className="flex gap-1">
          <span className="text-[10px] opacity-60">{summary.documentedPorts}/{summary.totalPorts} documented</span>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="mb-2 space-y-1">
          {issues.map((issue) => (
            <div
              key={issue.id}
              className={`rounded px-2 py-1 text-[10px] ${
                issue.severity === 'warning'
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                  : 'bg-slate-500/10 text-slate-700 dark:text-slate-300'
              }`}
            >
              {issue.detail}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1">
        {jacks.map((jack) => (
          <PortDocRow
            key={jack.index}
            portIndex={jack.index}
            jack={jack}
            doc={findPatchPanelDoc(device.patchPanelDocs ?? [], jack.index)}
            onUpdate={onUpdateDoc}
          />
        ))}
      </div>
    </div>
  );
}

export function PatchPanelDocPanel() {
  const layout = useRackStore((state) => state.layout);
  const updateDevice = useRackStore((state) => state.updateDevice);
  const patchPanels = useMemo(
    () => layout.devices.filter((d) => d.category === 'patch-panel'),
    [layout.devices]
  );

  function updateDoc(deviceId: string, doc: PatchPanelPortDoc) {
    const device = layout.devices.find((d) => d.id === deviceId);
    if (!device) return;

    const existing = device.patchPanelDocs ?? [];
    const filtered = existing.filter((d) => d.portIndex !== doc.portIndex);
    const hasData =
      doc.destinationRoom?.trim() ||
      doc.wallPlate?.trim() ||
      doc.wireCode ||
      doc.punchDownDate ||
      doc.testedSpeed?.trim() ||
      doc.notes?.trim();

    updateDevice(deviceId, {
      patchPanelDocs: hasData ? [...filtered, doc] : filtered,
    });
  }

  return (
    <section
      className="rounded-lg border p-4"
      style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border)' }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <FileText size={15} />
          Patch Panel Docs
        </div>
        <div className="flex gap-1">
          {patchPanels.length === 1 && (
            <>
              <button
                type="button"
                onClick={() => {
                  const csv = exportPatchPanelDocsCsv(patchPanels[0]);
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${patchPanels[0].name}-docs.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
                style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
              >
                <Download size={11} />
                CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  const md = exportPatchPanelDocsMarkdown(patchPanels[0]);
                  const blob = new Blob([md], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${patchPanels[0].name}-docs.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
                style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
              >
                <Download size={11} />
                MD
              </button>
            </>
          )}
        </div>
      </div>

      {patchPanels.length === 0 && (
        <div
          className="rounded-md border p-3 text-center text-xs opacity-60"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          No patch panels in this layout. Add a patch panel from the component library to start documenting ports.
        </div>
      )}

      <div className="space-y-3">
        {patchPanels.map((panel) => (
          <PatchPanelSection
            key={panel.id}
            device={panel}
            layout={layout}
            onUpdateDoc={(doc) => updateDoc(panel.id, doc)}
          />
        ))}
      </div>
    </section>
  );
}
