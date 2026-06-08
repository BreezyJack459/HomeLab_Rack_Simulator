import { CalendarClock, Link2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { ChangeEventStatus, ChangeRiskLevel, RackChangeEvent } from '../types/rack';
import { downloadChangeCalendarIcs, exportChangeCalendarText } from '../utils/exporters';
import { getChangeCalendarSummary, sortChangeEvents } from '../utils/changeCalendar';

const FIELD_CLASS =
  'mt-1 h-8 w-full rounded-md border border-slate-300 bg-slate-100 px-2 text-xs text-slate-700 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200';

function riskTone(risk: ChangeRiskLevel) {
  if (risk === 'high') return 'bg-red-500/10 text-red-700 dark:text-red-300';
  if (risk === 'medium') return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
  return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
}

export function RackChangeCalendar() {
  const layout = useRackStore((state) => state.layout);
  const selectedDeviceId = useRackStore((state) => state.selectedDeviceId);
  const selectedCableId = useRackStore((state) => state.selectedCableId);
  const updateRack = useRackStore((state) => state.updateRack);
  const devices = layout.devices;
  const cables = layout.cables;
  const [title, setTitle] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [riskLevel, setRiskLevel] = useState<ChangeRiskLevel>('medium');
  const [expectedDowntimeMin, setExpectedDowntimeMin] = useState(60);
  const [owner, setOwner] = useState('');
  const [notes, setNotes] = useState('');
  const [rollbackNotes, setRollbackNotes] = useState('');
  const [requiresReadiness, setRequiresReadiness] = useState(true);
  const [requiresCommissioning, setRequiresCommissioning] = useState(false);
  const summary = useMemo(() => getChangeCalendarSummary(layout), [layout]);
  const events = useMemo(() => sortChangeEvents(layout.changeEvents ?? []), [layout.changeEvents]);

  function addEvent() {
    if (!title.trim() || !scheduledFor) return;
    const nextEvent: RackChangeEvent = {
      id: `change-${Math.random().toString(36).slice(2, 10)}`,
      title: title.trim(),
      scheduledFor: new Date(scheduledFor).toISOString(),
      riskLevel,
      expectedDowntimeMin,
      owner: owner.trim() || undefined,
      notes: notes.trim() || undefined,
      rollbackNotes: rollbackNotes.trim() || undefined,
      status: 'planned',
      affectedDeviceIds: selectedDeviceId ? [selectedDeviceId] : undefined,
      affectedCableIds: selectedCableId ? [selectedCableId] : undefined,
      requiresReadiness,
      requiresCommissioning
    };
    updateRack({ changeEvents: [...(layout.changeEvents ?? []), nextEvent] });
    setTitle('');
    setScheduledFor('');
    setRiskLevel('medium');
    setExpectedDowntimeMin(60);
    setOwner('');
    setNotes('');
    setRollbackNotes('');
    setRequiresReadiness(true);
    setRequiresCommissioning(false);
  }

  function patchEvent(eventId: string, patch: Partial<RackChangeEvent>) {
    updateRack({
      changeEvents: (layout.changeEvents ?? []).map((event) => (event.id === eventId ? { ...event, ...patch } : event))
    });
  }

  function removeEvent(eventId: string) {
    updateRack({ changeEvents: (layout.changeEvents ?? []).filter((event) => event.id !== eventId) });
  }

  function linkedLabel(event: RackChangeEvent) {
    const linkedDevices = (event.affectedDeviceIds ?? [])
      .map((id) => devices.find((device) => device.id === id)?.name)
      .filter(Boolean);
    const linkedCables = (event.affectedCableIds ?? [])
      .map((id) => cables.find((cable) => cable.id === id)?.id)
      .filter(Boolean);
    if (linkedDevices.length === 0 && linkedCables.length === 0) return 'Rack-wide task';
    return [...linkedDevices, ...linkedCables].join(', ');
  }

  return (
    <section
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--theme-bg-secondary)',
        borderColor: 'var(--theme-border)'
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-text-muted)' }}>
          <CalendarClock size={15} />
          Rack Change Calendar
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportChangeCalendarText(layout)}
            className="rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
            style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
          >
            Text
          </button>
          <button
            type="button"
            onClick={() => downloadChangeCalendarIcs(layout)}
            className="rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
            style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
          >
            ICS
          </button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-4 gap-2 text-xs">
        {[
          ['Upcoming', summary.upcoming.length],
          ['Overdue', summary.overdue.length],
          ['Warnings', summary.warnings.length],
          ['Total', events.length]
        ].map(([label, count]) => (
          <div key={label} className="rounded-md border px-3 py-2" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
            <div style={{ color: 'var(--theme-text-secondary)' }}>{label}</div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{count}</div>
          </div>
        ))}
      </div>

      <div className="rounded-md border p-3" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] text-slate-500 dark:text-slate-400">
            Change title
            <input className={FIELD_CLASS} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="NAS migration window" />
          </label>
          <label className="text-[11px] text-slate-500 dark:text-slate-400">
            Date / time
            <input className={FIELD_CLASS} type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} />
          </label>
          <label className="text-[11px] text-slate-500 dark:text-slate-400">
            Risk
            <select className={FIELD_CLASS} value={riskLevel} onChange={(event) => setRiskLevel(event.target.value as ChangeRiskLevel)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="text-[11px] text-slate-500 dark:text-slate-400">
            Downtime min
            <input className={FIELD_CLASS} type="number" min={0} value={expectedDowntimeMin} onChange={(event) => setExpectedDowntimeMin(Number(event.target.value) || 0)} />
          </label>
          <label className="text-[11px] text-slate-500 dark:text-slate-400">
            Owner
            <input className={FIELD_CLASS} value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="jack" />
          </label>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Linked selection
            <div className="mt-1 flex h-8 items-center rounded-md border px-2 text-xs" style={{ borderColor: 'var(--theme-border)' }}>
              <Link2 size={12} className="mr-2" />
              {selectedDeviceId || selectedCableId ? `${selectedDeviceId ? 'device' : ''}${selectedDeviceId && selectedCableId ? ' + ' : ''}${selectedCableId ? 'cable' : ''}` : 'None'}
            </div>
          </div>
        </div>

        <label className="mt-2 block text-[11px] text-slate-500 dark:text-slate-400">
          Notes
          <input className={FIELD_CLASS} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Scope, dependency, prep work" />
        </label>
        <label className="mt-2 block text-[11px] text-slate-500 dark:text-slate-400">
          Rollback notes
          <input className={FIELD_CLASS} value={rollbackNotes} onChange={(event) => setRollbackNotes(event.target.value)} placeholder="Restore old switch config, move patch cords back" />
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={requiresReadiness} onChange={() => setRequiresReadiness((value) => !value)} />
            Needs readiness
          </label>
          <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={requiresCommissioning} onChange={() => setRequiresCommissioning((value) => !value)} />
            Needs commissioning
          </label>
          <button
            type="button"
            onClick={addEvent}
            className="rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
            style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
          >
            Add event
          </button>
        </div>
      </div>

      {summary.warnings.length > 0 && (
        <div className="mt-3 space-y-2">
          {summary.warnings.map((warning, index) => (
            <div key={`${warning.eventId}-${warning.code}-${index}`} className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              {warning.detail}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {events.length === 0 && (
          <div className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
            No scheduled changes yet. Add firmware windows, cable cleanup days, UPS swaps, or migration cutovers here.
          </div>
        )}

        {events.map((event) => (
          <div key={event.id} className="rounded-md border p-3" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="truncate text-xs font-semibold text-slate-900 dark:text-white">{event.title}</div>
                  <span className={`rounded px-2 py-1 text-[10px] font-medium ${riskTone(event.riskLevel)}`}>{event.riskLevel}</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {new Date(event.scheduledFor).toLocaleString()} · {linkedLabel(event)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeEvent(event.id)}
                className="rounded border p-1 text-slate-500 dark:text-slate-400"
                style={{ borderColor: 'var(--theme-border)' }}
                title="Remove event"
              >
                <Trash2 size={12} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-[150px_1fr] gap-2">
              <label className="text-[11px] text-slate-500 dark:text-slate-400">
                Status
                <select className={FIELD_CLASS} value={event.status} onChange={(e) => patchEvent(event.id, { status: e.target.value as ChangeEventStatus })}>
                  <option value="planned">Planned</option>
                  <option value="in-progress">In progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label className="text-[11px] text-slate-500 dark:text-slate-400">
                Owner
                <input className={FIELD_CLASS} value={event.owner ?? ''} onChange={(e) => patchEvent(event.id, { owner: e.target.value || undefined })} />
              </label>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
