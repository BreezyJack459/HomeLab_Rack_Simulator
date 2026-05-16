import { Download, Layers, Plus, ShieldAlert, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { DomainAssignment, FailureDomain, FailureDomainType } from '../types/rack';
import {
  DOMAIN_COLORS,
  exportDomainsMarkdown,
  getDomainAssignment,
  getUnassignedCables,
  getUnassignedDevices,
  summarizeDomains,
  validateDomains,
} from '../utils/failureDomains';

const domainTypeOptions: FailureDomainType[] = ['power', 'network', 'storage', 'site', 'management', 'cooling'];

function DomainRow({
  domain,
  assignment,
  devices,
  cables,
  services,
  onUpdate,
  onRemove,
  onToggleDevice,
  onToggleCable,
  onToggleService,
}: {
  domain: FailureDomain;
  assignment: DomainAssignment | undefined;
  devices: { id: string; name: string }[];
  cables: { id: string; label: string }[];
  services: { id: string; name: string }[];
  onUpdate: (patch: Partial<FailureDomain>) => void;
  onRemove: () => void;
  onToggleDevice: (deviceId: string) => void;
  onToggleCable: (cableId: string) => void;
  onToggleService: (serviceId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const deviceIds = assignment?.deviceIds ?? [];
  const cableIds = assignment?.cableIds ?? [];
  const serviceIds = assignment?.serviceIds ?? [];

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
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <span
          className="inline-block h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: domain.color }}
        />
        <span className="flex-1 truncate font-medium">{domain.name}</span>
        <span
          className="rounded px-1.5 py-0.5 text-[10px]"
          style={{ backgroundColor: `${domain.color}22`, color: domain.color }}
        >
          {domain.type}
        </span>
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
        <div className="space-y-2 border-t px-3 py-2.5 text-xs" style={{ borderColor: 'var(--theme-border)' }}>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Name</div>
            <input
              type="text"
              value={domain.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Type</div>
            <select
              value={domain.type}
              onChange={(e) => onUpdate({ type: e.target.value as FailureDomainType })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            >
              {domainTypeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Color</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {DOMAIN_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onUpdate({ color: c })}
                  className={`h-5 w-5 rounded-full border-2 ${domain.color === c ? 'border-white shadow' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Notes</div>
            <input
              type="text"
              value={domain.notes ?? ''}
              onChange={(e) => onUpdate({ notes: e.target.value || undefined })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>

          {/* Device assignments */}
          {devices.length > 0 && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider opacity-60">Devices</div>
              <div className="max-h-32 overflow-y-auto space-y-0.5 thin-scrollbar">
                {devices.map((d) => (
                  <label key={d.id} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={deviceIds.includes(d.id)}
                      onChange={() => onToggleDevice(d.id)}
                      className="h-3 w-3"
                    />
                    <span className="truncate">{d.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Cable assignments */}
          {cables.length > 0 && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider opacity-60">Cables</div>
              <div className="max-h-32 overflow-y-auto space-y-0.5 thin-scrollbar">
                {cables.map((c) => (
                  <label key={c.id} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={cableIds.includes(c.id)}
                      onChange={() => onToggleCable(c.id)}
                      className="h-3 w-3"
                    />
                    <span className="truncate">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Service assignments */}
          {services.length > 0 && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider opacity-60">Services</div>
              <div className="max-h-32 overflow-y-auto space-y-0.5 thin-scrollbar">
                {services.map((s) => (
                  <label key={s.id} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={serviceIds.includes(s.id)}
                      onChange={() => onToggleService(s.id)}
                      className="h-3 w-3"
                    />
                    <span className="truncate">{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FailureDomainPanel() {
  const layout = useRackStore((state) => state.layout);
  const updateRack = useRackStore((state) => state.updateRack);
  const domains = layout.failureDomains ?? [];
  const assignments = layout.domainAssignments ?? [];
  const summary = useMemo(
    () => summarizeDomains(domains, assignments, layout.devices, layout.cables),
    [domains, assignments, layout.devices, layout.cables]
  );
  const issues = useMemo(
    () => validateDomains(domains, assignments, layout.devices, layout.cables, layout.services ?? []),
    [domains, assignments, layout.devices, layout.cables, layout.services]
  );
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<FailureDomainType>('power');

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
  const serviceOptions = useMemo(
    () => (layout.services ?? []).map((s) => ({ id: s.id, name: s.name })),
    [layout.services]
  );

  const unassignedDevices = useMemo(
    () => getUnassignedDevices(layout.devices, assignments),
    [layout.devices, assignments]
  );
  const unassignedCables = useMemo(
    () => getUnassignedCables(layout.cables, assignments),
    [layout.cables, assignments]
  );

  function addDomain() {
    if (!formName.trim()) return;
    const color = DOMAIN_COLORS[domains.length % DOMAIN_COLORS.length];
    const newDomain: FailureDomain = {
      id: `fd-${Date.now()}`,
      name: formName.trim(),
      type: formType,
      color,
    };
    updateRack({
      failureDomains: [...domains, newDomain],
      domainAssignments: [...assignments, { domainId: newDomain.id }],
    });
    setFormName('');
    setFormType('power');
    setShowForm(false);
  }

  function updateDomain(id: string, patch: Partial<FailureDomain>) {
    updateRack({
      failureDomains: domains.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    });
  }

  function removeDomain(id: string) {
    updateRack({
      failureDomains: domains.filter((d) => d.id !== id),
      domainAssignments: assignments.filter((a) => a.domainId !== id),
    });
  }

  function toggleInAssignment(domainId: string, key: 'deviceIds' | 'cableIds' | 'serviceIds', id: string) {
    const next = assignments.map((a) => {
      if (a.domainId !== domainId) return a;
      const list = a[key] ?? [];
      return {
        ...a,
        [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
      };
    });
    updateRack({ domainAssignments: next });
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
          <Layers size={15} />
          Failure Domains
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              const md = exportDomainsMarkdown(domains, assignments, layout.devices, layout.cables);
              const blob = new Blob([md], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'failure-domains.md';
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
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
            {summary.totalDomains}
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Domains
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
            {summary.assignedDevices}
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Devices
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
            {summary.assignedCables}
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Cables
          </div>
        </div>
      </div>

      {/* Unassigned */}
      {(unassignedDevices.length > 0 || unassignedCables.length > 0) && (
        <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
          <ShieldAlert size={12} className="inline mr-1" />
          {unassignedDevices.length} unassigned device{unassignedDevices.length !== 1 ? 's' : ''},
          {' '}{unassignedCables.length} unassigned cable{unassignedCables.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Issues */}
      {issues.length > 0 && (
        <div className="mb-3 space-y-1">
          {issues.slice(0, 3).map((issue) => (
            <div
              key={issue.id}
              className={`rounded-md border px-2.5 py-1.5 text-[11px] ${
                issue.severity === 'critical'
                  ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
                  : issue.severity === 'warning'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
              }`}
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
      {showForm && (
        <div className="mb-3 space-y-2 rounded-md border p-2.5" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">New Domain</span>
            <button type="button" onClick={() => setShowForm(false)} className="opacity-60 hover:opacity-100">
              <X size={13} />
            </button>
          </div>
          <input
            type="text"
            placeholder="Domain name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addDomain();
            }}
            className="w-full rounded border px-2 py-1 text-xs"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-primary)',
              color: 'var(--theme-text-primary)',
            }}
          />
          <select
            value={formType}
            onChange={(e) => setFormType(e.target.value as FailureDomainType)}
            className="w-full rounded border px-2 py-1 text-xs"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-primary)',
              color: 'var(--theme-text-primary)',
            }}
          >
            {domainTypeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addDomain}
            className="inline-flex items-center gap-1 rounded bg-cyan-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-cyan-700"
          >
            <Plus size={11} />
            Add
          </button>
        </div>
      )}

      {/* Domain list */}
      <div className="space-y-2">
        {domains.map((domain) => {
          const assignment = getDomainAssignment(assignments, domain.id);
          return (
            <DomainRow
              key={domain.id}
              domain={domain}
              assignment={assignment}
              devices={deviceOptions}
              cables={cableOptions}
              services={serviceOptions}
              onUpdate={(patch) => updateDomain(domain.id, patch)}
              onRemove={() => removeDomain(domain.id)}
              onToggleDevice={(id) => toggleInAssignment(domain.id, 'deviceIds', id)}
              onToggleCable={(id) => toggleInAssignment(domain.id, 'cableIds', id)}
              onToggleService={(id) => toggleInAssignment(domain.id, 'serviceIds', id)}
            />
          );
        })}
      </div>

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded border py-1.5 text-[11px] font-medium transition hover:bg-cyan-500/10"
          style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
        >
          <Plus size={12} />
          Add Domain
        </button>
      )}
    </section>
  );
}
