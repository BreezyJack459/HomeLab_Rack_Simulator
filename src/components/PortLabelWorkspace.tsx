import { Cable, Download, Save, Tags, Wand2 } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from 'react';
import { useRackStore } from '../store/rackStore';
import type { RackLayout } from '../types/rack';
import {
  exportSwitchPortDocumentationCsv,
  formatConnection,
  getSwitchPortDocumentation,
  mergePortLabelDrafts,
} from '../utils/portDocumentation';

type PortLabelWorkspaceProps = {
  layout: RackLayout;
};

const downloadCsv = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const slugify = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
  'switch';

export default function PortLabelWorkspace({
  layout,
}: PortLabelWorkspaceProps) {
  const updateDevice = useRackStore((state) => state.updateDevice);
  const switches = useMemo(
    () => layout.devices.filter((device) => device.category === 'switch'),
    [layout.devices],
  );
  const [switchId, setSwitchId] = useState(switches[0]?.id ?? '');
  const activeSwitch =
    switches.find((device) => device.id === switchId) ?? switches[0] ?? null;
  const rows = useMemo(
    () =>
      activeSwitch
        ? getSwitchPortDocumentation(layout, activeSwitch)
        : [],
    [activeSwitch, layout],
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!switches.some((device) => device.id === switchId)) {
      setSwitchId(switches[0]?.id ?? '');
    }
  }, [switchId, switches]);

  useEffect(() => {
    setDrafts(
      Object.fromEntries(rows.map((row) => [row.id, row.label])),
    );
  }, [activeSwitch?.id, activeSwitch?.portAliases, rows]);

  const savedDrafts = useMemo(
    () => Object.fromEntries(rows.map((row) => [row.id, row.label])),
    [rows],
  );
  const hasUnsavedChanges = rows.some(
    (row) => (drafts[row.id] ?? '').trim() !== savedDrafts[row.id],
  );
  const connectedCount = rows.filter(
    (row) => row.connections.length > 0,
  ).length;
  const labeledCount = rows.filter(
    (row) => (drafts[row.id] ?? '').trim().length > 0,
  ).length;
  const connectedWithoutLabelCount = rows.filter(
    (row) =>
      row.connections.length > 0 &&
      !(drafts[row.id] ?? '').trim(),
  ).length;

  function handleSwitchChange(event: ChangeEvent<HTMLSelectElement>) {
    setSwitchId(event.currentTarget.value);
  }

  function handleLabelChange(
    portId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    setDrafts((current) => ({
      ...current,
      [portId]: event.currentTarget.value,
    }));
  }

  function fillFromConnections() {
    setDrafts((current) => {
      const next = { ...current };
      for (const row of rows) {
        if (!next[row.id]?.trim() && row.suggestedLabel) {
          next[row.id] = row.suggestedLabel;
        }
      }
      return next;
    });
  }

  function saveLabels() {
    if (!activeSwitch) {
      return;
    }
    updateDevice(activeSwitch.id, {
      portAliases: mergePortLabelDrafts(activeSwitch, rows, drafts),
    });
  }

  function exportCsv() {
    if (!activeSwitch) {
      return;
    }
    const aliases = mergePortLabelDrafts(activeSwitch, rows, drafts);
    const csv = exportSwitchPortDocumentationCsv(
      layout,
      activeSwitch,
      aliases,
    );
    downloadCsv(`${slugify(activeSwitch.name)}-port-labels.csv`, csv);
  }

  return (
    <div className="h-full overflow-y-auto rounded-3xl border border-edge bg-surface/80 p-4 shadow-sm dark:border-edge dark:bg-surface/70">
      <div className="flex flex-col gap-4 border-b border-edge/80 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent-fg">
            <Tags size={15} />
            Port label documentation
          </div>
          <h2 className="mt-2 text-xl font-semibold text-content">
            Match the rack record to the labels on the real cable
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-content-muted">
            Select a switch, name each physical port, and verify the connected
            device and cable endpoint before exporting the documentation.
          </p>
        </div>

        {activeSwitch && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-content-faint">
              Switch
              <select
                value={activeSwitch.id}
                onChange={handleSwitchChange}
                className="h-9 min-w-56 rounded-xl border border-edge-strong bg-surface px-3 text-sm font-medium normal-case tracking-normal text-content outline-none focus:border-accent"
              >
                {switches.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.label ? `${device.label} — ` : ''}
                    {device.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={fillFromConnections}
              disabled={connectedWithoutLabelCount === 0}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-edge-strong bg-fill px-3 text-xs font-medium text-content-secondary transition hover:border-accent hover:text-accent-fg disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Wand2 size={14} />
              Fill connected
            </button>
            <button
              type="button"
              onClick={saveLabels}
              disabled={!hasUnsavedChanges}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-accent-solid px-3 text-xs font-semibold text-content shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Save size={14} />
              Save labels
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-edge-strong bg-surface px-3 text-xs font-medium text-content-secondary transition hover:border-accent hover:text-accent-fg"
            >
              <Download size={14} />
              CSV
            </button>
          </div>
        )}
      </div>

      {!activeSwitch ? (
        <div className="flex min-h-80 flex-col items-center justify-center text-center">
          <Tags size={32} className="text-content-faint" />
          <h3 className="mt-3 text-base font-semibold text-content">
            Add a switch to start documenting ports
          </h3>
          <p className="mt-1 max-w-md text-sm leading-6 text-content-muted">
            The plugin lists devices in the switch category and stores every
            port label inside the rack JSON.
          </p>
        </div>
      ) : (
        <>
          <div className="my-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-edge bg-fill-subtle px-4 py-3">
              <div className="text-2xl font-semibold text-content">
                {rows.length}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-content-faint">
                Physical ports
              </div>
            </div>
            <div className="rounded-2xl border border-edge bg-fill-subtle px-4 py-3">
              <div className="text-2xl font-semibold text-content">
                {connectedCount}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-content-faint">
                Connected
              </div>
            </div>
            <div className="rounded-2xl border border-edge bg-fill-subtle px-4 py-3">
              <div
                className={`text-2xl font-semibold ${
                  connectedWithoutLabelCount > 0
                    ? 'text-amber-600 dark:text-amber-300'
                    : 'text-emerald-600 dark:text-emerald-300'
                }`}
              >
                {labeledCount}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-content-faint">
                Labeled
              </div>
            </div>
          </div>

          {hasUnsavedChanges && (
            <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              You have unsaved port-label changes.
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-edge">
            <table className="min-w-[840px] w-full border-collapse text-left">
              <thead className="bg-fill-subtle text-[10px] font-semibold uppercase tracking-[0.18em] text-content-faint">
                <tr>
                  <th className="px-3 py-2.5">Port</th>
                  <th className="px-3 py-2.5">Face</th>
                  <th className="w-[38%] px-3 py-2.5">Physical label</th>
                  <th className="min-w-56 px-3 py-2.5">Connected to</th>
                  <th className="px-3 py-2.5">Cable</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const connection = row.connections[0];
                  return (
                    <tr
                      key={row.id}
                      className="border-t border-edge/80 align-middle"
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 text-sm font-semibold text-content">
                        {row.portName}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="rounded-full bg-fill px-2 py-1 text-[10px] font-semibold uppercase text-content-muted">
                          {row.face}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          value={drafts[row.id] ?? ''}
                          onChange={(event) =>
                            handleLabelChange(row.id, event)
                          }
                          placeholder={
                            row.suggestedLabel || 'e.g. AP-LIVING-ROOM'
                          }
                          aria-label={`${row.portName} physical label`}
                          className="h-9 w-full rounded-xl border border-edge-strong bg-surface px-3 text-sm text-content outline-none placeholder:text-content-faint focus:border-accent"
                        />
                      </td>
                      <td className="min-w-56 whitespace-nowrap px-3 py-2.5 text-sm text-content-secondary">
                        {connection ? (
                          <div className="flex items-center gap-2">
                            <Cable
                              size={14}
                              className="shrink-0 text-emerald-500"
                            />
                            <span>{formatConnection(connection)}</span>
                            {row.connections.length > 1 && (
                              <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                                +{row.connections.length - 1}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-content-faint">Free port</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-content-muted">
                        {connection
                          ? `${connection.cableType} · ${connection.cableId}`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {rows.length === 0 && (
            <div className="py-12 text-center text-sm text-content-muted">
              This switch has no documented ports in its device template.
            </div>
          )}
        </>
      )}
    </div>
  );
}
