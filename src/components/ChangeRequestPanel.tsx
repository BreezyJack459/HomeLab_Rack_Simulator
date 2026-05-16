import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  FileText,
  PenLine,
  Plus,
  ShieldAlert,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { ChangeRequest, ChangeRequestStatus } from '../types/rack';
import {
  exportChangeRequestsCsv,
  exportChangeRequestsMarkdown,
  summarizeChangeRequests,
  validateChangeRequests,
} from '../utils/changeRequests';

const riskConfig: Record<string, { color: string; bg: string }> = {
  low: { color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-500/10' },
  medium: { color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-500/10' },
  high: { color: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-500/10' },
};

const statusConfig: Record<
  ChangeRequestStatus,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  pending: { label: 'Pending', color: 'text-cyan-700 dark:text-cyan-300', icon: Clock },
  approved: { label: 'Approved', color: 'text-emerald-700 dark:text-emerald-300', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'text-red-700 dark:text-red-300', icon: XCircle },
  completed: { label: 'Completed', color: 'text-slate-700 dark:text-slate-300', icon: CheckCircle2 },
};

function RequestRow({
  request,
  deviceOptions,
  cableOptions,
  onUpdate,
  onRemove,
}: {
  request: ChangeRequest;
  deviceOptions: { id: string; name: string }[];
  cableOptions: { id: string; label: string }[];
  onUpdate: (patch: Partial<ChangeRequest>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(request.title);
  const [editDescription, setEditDescription] = useState(request.description ?? '');
  const [editRisk, setEditRisk] = useState(request.riskLevel);
  const [editDowntime, setEditDowntime] = useState(request.expectedDowntimeMin ?? 0);
  const [editRollback, setEditRollback] = useState(request.rollbackPlan ?? '');

  function saveEdit() {
    onUpdate({
      title: editTitle.trim(),
      description: editDescription.trim() || undefined,
      riskLevel: editRisk,
      expectedDowntimeMin: editDowntime > 0 ? editDowntime : undefined,
      rollbackPlan: editRollback.trim() || undefined,
    });
    setIsEditing(false);
  }

  function approve() {
    onUpdate({
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: 'Current User',
    });
  }

  function reject() {
    onUpdate({
      status: 'rejected',
      approvedAt: new Date().toISOString(),
      approvedBy: 'Current User',
    });
  }

  function complete() {
    onUpdate({ status: 'completed' });
  }

  const status = statusConfig[request.status];
  const StatusIcon = status.icon;

  return (
    <div
      className="rounded-md border text-sm"
      style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
    >
      <div className="flex items-center gap-2 p-2.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="opacity-70 transition hover:opacity-100"
        >
          <ChevronDown size={14} className={`transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
        </button>
        <StatusIcon size={13} className={`shrink-0 ${status.color}`} />
        <span className="flex-1 truncate font-medium">{request.title}</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] ${riskConfig[request.riskLevel]?.bg ?? ''} ${riskConfig[request.riskLevel]?.color ?? ''}`}>
          {request.riskLevel}
        </span>
        <span className={`text-[10px] ${status.color}`}>{status.label}</span>
        <button
          type="button"
          onClick={() => setIsEditing((v) => !v)}
          className="opacity-60 transition hover:opacity-100"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <PenLine size={13} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="opacity-60 transition hover:opacity-100"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <Trash2 size={13} />
        </button>
      </div>

      {expanded && (
        <div className="border-t px-3 py-2.5 text-xs" style={{ borderColor: 'var(--theme-border)' }}>
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded border px-1.5 py-0.5 text-xs"
                style={{
                  borderColor: 'var(--theme-border)',
                  backgroundColor: 'var(--theme-bg-secondary)',
                  color: 'var(--theme-text-primary)',
                }}
                placeholder="Title"
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full rounded border px-1.5 py-0.5 text-xs"
                style={{
                  borderColor: 'var(--theme-border)',
                  backgroundColor: 'var(--theme-bg-secondary)',
                  color: 'var(--theme-text-primary)',
                }}
                placeholder="Description"
                rows={2}
              />
              <div className="flex gap-2">
                <select
                  value={editRisk}
                  onChange={(e) => setEditRisk(e.target.value as ChangeRequest['riskLevel'])}
                  className="rounded border px-1.5 py-0.5 text-xs"
                  style={{
                    borderColor: 'var(--theme-border)',
                    backgroundColor: 'var(--theme-bg-secondary)',
                    color: 'var(--theme-text-primary)',
                  }}
                >
                  <option value="low">Low Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="high">High Risk</option>
                </select>
                <input
                  type="number"
                  value={editDowntime}
                  onChange={(e) => setEditDowntime(Number(e.target.value))}
                  className="w-20 rounded border px-1.5 py-0.5 text-xs"
                  style={{
                    borderColor: 'var(--theme-border)',
                    backgroundColor: 'var(--theme-bg-secondary)',
                    color: 'var(--theme-text-primary)',
                  }}
                  placeholder="Downtime min"
                  min={0}
                />
              </div>
              <input
                type="text"
                value={editRollback}
                onChange={(e) => setEditRollback(e.target.value)}
                className="w-full rounded border px-1.5 py-0.5 text-xs"
                style={{
                  borderColor: 'var(--theme-border)',
                  backgroundColor: 'var(--theme-bg-secondary)',
                  color: 'var(--theme-text-primary)',
                }}
                placeholder="Rollback plan"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveEdit}
                  className="rounded bg-cyan-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-cyan-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditTitle(request.title);
                    setEditDescription(request.description ?? '');
                    setEditRisk(request.riskLevel);
                    setEditDowntime(request.expectedDowntimeMin ?? 0);
                    setEditRollback(request.rollbackPlan ?? '');
                    setIsEditing(false);
                  }}
                  className="rounded border px-2 py-0.5 text-[11px]"
                  style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
                >
                  <X size={11} />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {request.description && <div className="opacity-70">{request.description}</div>}
              {request.expectedDowntimeMin && (
                <div className="flex items-center gap-1 opacity-60">
                  <Clock size={11} />
                  Expected downtime: {request.expectedDowntimeMin} min
                </div>
              )}
              {request.rollbackPlan && (
                <div className="rounded bg-slate-500/5 px-2 py-1 opacity-70">
                  <span className="font-medium">Rollback:</span> {request.rollbackPlan}
                </div>
              )}
              {(request.affectedDeviceIds?.length ?? 0) > 0 && (
                <div className="opacity-60">
                  <span className="font-medium">Devices:</span>{' '}
                  {request.affectedDeviceIds?.map((id) => deviceOptions.find((d) => d.id === id)?.name ?? id).join(', ')}
                </div>
              )}
              {(request.affectedCableIds?.length ?? 0) > 0 && (
                <div className="opacity-60">
                  <span className="font-medium">Cables:</span>{' '}
                  {request.affectedCableIds?.map((id) => cableOptions.find((c) => c.id === id)?.label ?? id).join(', ')}
                </div>
              )}
              {request.approvedAt && (
                <div className="text-[10px] opacity-50">
                  {request.status === 'approved' ? 'Approved' : 'Rejected'} by {request.approvedBy} on {new Date(request.approvedAt).toLocaleDateString()}
                </div>
              )}

              {/* Action buttons */}
              {request.status === 'pending' && (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={approve}
                    className="rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 size={11} className="inline mr-1" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={reject}
                    className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-red-700"
                  >
                    <XCircle size={11} className="inline mr-1" />
                    Reject
                  </button>
                </div>
              )}
              {request.status === 'approved' && (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={complete}
                    className="rounded bg-cyan-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-cyan-700"
                  >
                    <CheckCircle2 size={11} className="inline mr-1" />
                    Mark Complete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ChangeRequestPanel() {
  const layout = useRackStore((state) => state.layout);
  const updateRack = useRackStore((state) => state.updateRack);
  const requests = layout.changeRequests ?? [];
  const summary = useMemo(() => summarizeChangeRequests(requests), [requests]);
  const issues = useMemo(
    () => validateChangeRequests(requests, layout.devices, layout.cables),
    [requests, layout.devices, layout.cables]
  );
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<ChangeRequestStatus | 'all'>('all');

  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formRisk, setFormRisk] = useState<ChangeRequest['riskLevel']>('medium');
  const [formDowntime, setFormDowntime] = useState(0);
  const [formRollback, setFormRollback] = useState('');

  const deviceOptions = useMemo(
    () => layout.devices.map((d) => ({ id: d.id, name: d.name })),
    [layout.devices]
  );
  const cableOptions = useMemo(
    () =>
      layout.cables.map((c) => {
        const from = layout.devices.find((d) => d.id === c.fromDeviceId)?.name ?? c.fromDeviceId;
        const to = layout.devices.find((d) => d.id === c.toDeviceId)?.name ?? c.toDeviceId;
        return { id: c.id, label: `${from} → ${to}` };
      }),
    [layout.cables, layout.devices]
  );

  const filteredRequests = useMemo(() => {
    if (filter === 'all') return requests;
    return requests.filter((r) => r.status === filter);
  }, [requests, filter]);

  function addRequest() {
    if (!formTitle.trim()) return;
    const newRequest: ChangeRequest = {
      id: `cr-${Date.now()}`,
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      riskLevel: formRisk,
      expectedDowntimeMin: formDowntime > 0 ? formDowntime : undefined,
      rollbackPlan: formRollback.trim() || undefined,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    updateRack({ changeRequests: [...requests, newRequest] });
    setFormTitle('');
    setFormDescription('');
    setFormRisk('medium');
    setFormDowntime(0);
    setFormRollback('');
    setShowForm(false);
  }

  function updateRequest(id: string, patch: Partial<ChangeRequest>) {
    updateRack({
      changeRequests: requests.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  }

  function removeRequest(id: string) {
    updateRack({
      changeRequests: requests.filter((r) => r.id !== id),
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
          Change Requests
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              const csv = exportChangeRequestsCsv(requests);
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'change-requests.csv';
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
              const md = exportChangeRequestsMarkdown(requests, layout.devices);
              const blob = new Blob([md], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'change-requests.md';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
            style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
          >
            <Download size={11} />
            MD
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-3 grid grid-cols-4 gap-2">
        {(['pending', 'approved', 'rejected', 'completed'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(filter === s ? 'all' : s)}
            className={`rounded-md border p-2 text-center transition ${
              filter === s ? 'ring-1 ring-cyan-500' : ''
            }`}
            style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
          >
            <div className={`text-lg font-bold ${statusConfig[s].color}`}>
              {s === 'pending' ? summary.pendingCount : s === 'approved' ? summary.approvedCount : s === 'rejected' ? summary.rejectedCount : summary.completedCount}
            </div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
              {statusConfig[s].label}
            </div>
          </button>
        ))}
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="mb-3 space-y-1">
          {issues.slice(0, 3).map((issue) => (
            <div
              key={issue.id}
              className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300"
            >
              <ShieldAlert size={12} className="inline mr-1" />
              <span className="font-medium">{issue.title}:</span> {issue.detail}
            </div>
          ))}
          {issues.length > 3 && (
            <div className="text-center text-[10px] opacity-60">+{issues.length - 3} more issues</div>
          )}
        </div>
      )}

      {/* Add form */}
      {showForm ? (
        <div className="mb-3 flex flex-col gap-2 rounded-md border p-2" style={{ borderColor: 'var(--theme-border)' }}>
          <input
            type="text"
            placeholder="Change request title"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            className="w-full rounded border px-2 py-1 text-xs"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-secondary)',
              color: 'var(--theme-text-primary)',
            }}
          />
          <textarea
            placeholder="Description"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            className="w-full rounded border px-2 py-1 text-xs"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-secondary)',
              color: 'var(--theme-text-primary)',
            }}
            rows={2}
          />
          <div className="flex gap-2">
            <select
              value={formRisk}
              onChange={(e) => setFormRisk(e.target.value as ChangeRequest['riskLevel'])}
              className="rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            >
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
            </select>
            <input
              type="number"
              value={formDowntime}
              onChange={(e) => setFormDowntime(Number(e.target.value))}
              className="w-20 rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
              placeholder="Min"
              min={0}
            />
          </div>
          <input
            type="text"
            placeholder="Rollback plan"
            value={formRollback}
            onChange={(e) => setFormRollback(e.target.value)}
            className="w-full rounded border px-2 py-1 text-xs"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-secondary)',
              color: 'var(--theme-text-primary)',
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addRequest}
              className="rounded bg-cyan-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-cyan-700"
            >
              Submit Request
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded border px-2 py-1 text-[11px]"
              style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mb-3 flex w-full items-center justify-center gap-1 rounded-md border py-1.5 text-[11px] opacity-70 transition hover:opacity-100"
          style={{
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-secondary)',
            backgroundColor: 'var(--theme-bg-primary)',
          }}
        >
          <Plus size={11} />
          New change request
        </button>
      )}

      {/* Request list */}
      <div className="space-y-1.5">
        {filteredRequests.map((request) => (
          <RequestRow
            key={request.id}
            request={request}
            deviceOptions={deviceOptions}
            cableOptions={cableOptions}
            onUpdate={(patch) => updateRequest(request.id, patch)}
            onRemove={() => removeRequest(request.id)}
          />
        ))}
      </div>

      {filteredRequests.length === 0 && (
        <div
          className="rounded-md border p-3 text-center text-xs opacity-60"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          No change requests yet. Submit requests for device moves, cable changes, firmware updates, and maintenance windows.
        </div>
      )}
    </section>
  );
}
