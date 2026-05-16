import { Download, Globe, HardDrive, Network, Plus, Power, ShieldAlert, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { RackService, ServiceCriticality } from '../types/rack';
import {
  criticalityBg,
  criticalityColor,
  criticalityLabel,
  exportServiceMapCsv,
  exportServiceMapMarkdown,
  findSinglePointsOfFailure,
  getServiceStatus,
  servicesForDevice,
  summarizeServices,
} from '../utils/serviceMap';

const criticalityOptions: ServiceCriticality[] = ['critical', 'high', 'medium', 'low'];

function ServiceRow({
  service,
  onUpdate,
  onRemove,
  deviceOptions,
}: {
  service: RackService;
  onUpdate: (patch: Partial<RackService>) => void;
  onRemove: () => void;
  deviceOptions: { id: string; name: string }[];
}) {
  const layout = useRackStore((state) => state.layout);
  const status = useMemo(() => getServiceStatus(service, layout), [service, layout]);
  const [expanded, setExpanded] = useState(false);

  function toggleDeviceId(list: string[] | undefined, id: string): string[] {
    const current = list ?? [];
    return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  }

  return (
    <div className={`rounded-md border text-sm ${criticalityBg(service.criticality)}`}>
      <div className="flex items-center gap-2 p-2.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 opacity-70 transition hover:opacity-100"
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
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${criticalityColor(service.criticality)}`}>
          {criticalityLabel(service.criticality)}
        </span>
        <span className="flex-1 truncate font-medium">{service.name}</span>
        {status.singlePointOfFailure && (
          <ShieldAlert size={13} className="shrink-0 text-red-500" title="Single point of failure" />
        )}
        {!status.healthy && (
          <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-600 dark:text-red-400">
            Missing device
          </span>
        )}
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
        <div
          className="grid grid-cols-2 gap-2 border-t px-3 py-2.5 text-xs"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="col-span-2">
            <div className="text-[10px] uppercase tracking-wider opacity-60">Service Name</div>
            <input
              type="text"
              value={service.name}
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
            <div className="text-[10px] uppercase tracking-wider opacity-60">Criticality</div>
            <select
              value={service.criticality}
              onChange={(e) => onUpdate({ criticality: e.target.value as ServiceCriticality })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            >
              {criticalityOptions.map((c) => (
                <option key={c} value={c}>
                  {criticalityLabel(c)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Host Device</div>
            <select
              value={service.hostDeviceId ?? ''}
              onChange={(e) => onUpdate({ hostDeviceId: e.target.value || undefined })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            >
              <option value="">None</option>
              {deviceOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <div className="text-[10px] uppercase tracking-wider opacity-60">Dependencies</div>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <DependencySelector
                icon={<Network size={11} />}
                label="Network"
                selected={service.networkDeviceIds ?? []}
                options={deviceOptions}
                onChange={(ids) => onUpdate({ networkDeviceIds: ids })}
              />
              <DependencySelector
                icon={<HardDrive size={11} />}
                label="Storage"
                selected={service.storageDeviceIds ?? []}
                options={deviceOptions}
                onChange={(ids) => onUpdate({ storageDeviceIds: ids })}
              />
              <DependencySelector
                icon={<Power size={11} />}
                label="Power"
                selected={service.powerDeviceIds ?? []}
                options={deviceOptions}
                onChange={(ids) => onUpdate({ powerDeviceIds: ids })}
              />
              <div>
                <div className="mb-1 flex items-center gap-1 text-[10px] opacity-60">
                  <Globe size={11} />
                  Backup
                </div>
                <select
                  value={service.backupDeviceId ?? ''}
                  onChange={(e) => onUpdate({ backupDeviceId: e.target.value || undefined })}
                  className="w-full rounded border px-1.5 py-0.5 text-xs"
                  style={{
                    borderColor: 'var(--theme-border)',
                    backgroundColor: 'var(--theme-bg-secondary)',
                    color: 'var(--theme-text-primary)',
                  }}
                >
                  <option value="">None</option>
                  {deviceOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="col-span-2">
            <div className="text-[10px] uppercase tracking-wider opacity-60">Notes</div>
            <input
              type="text"
              value={service.notes ?? ''}
              onChange={(e) => onUpdate({ notes: e.target.value || undefined })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
              placeholder="Service description, URLs, notes..."
            />
          </div>
        </div>
      )}
    </div>
  );
}

function DependencySelector({
  icon,
  label,
  selected,
  options,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  selected: string[];
  options: { id: string; name: string }[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-[10px] opacity-60">
        {icon}
        {label}
      </div>
      <div className="max-h-24 space-y-0.5 overflow-y-auto rounded border p-1" style={{ borderColor: 'var(--theme-border)' }}>
        {options.map((d) => (
          <label key={d.id} className="flex cursor-pointer items-center gap-1 text-[10px]">
            <input
              type="checkbox"
              checked={selected.includes(d.id)}
              onChange={() => {
                onChange(
                  selected.includes(d.id) ? selected.filter((x) => x !== d.id) : [...selected, d.id]
                );
              }}
              className="h-3 w-3 accent-cyan-600"
            />
            <span className="truncate">{d.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function ServiceMapPanel() {
  const layout = useRackStore((state) => state.layout);
  const updateRack = useRackStore((state) => state.updateRack);
  const services = layout.services ?? [];
  const summary = useMemo(() => summarizeServices(services, layout), [services, layout]);
  const spoFs = useMemo(() => findSinglePointsOfFailure(services, layout), [services, layout]);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCriticality, setFormCriticality] = useState<ServiceCriticality>('medium');
  const [filter, setFilter] = useState<'all' | ServiceCriticality>('all');

  const deviceOptions = useMemo(
    () => layout.devices.map((d) => ({ id: d.id, name: d.name })),
    [layout.devices]
  );

  const filteredServices = useMemo(() => {
    if (filter === 'all') return services;
    return services.filter((s) => s.criticality === filter);
  }, [services, filter]);

  function addService() {
    if (!formName.trim()) return;
    const newService: RackService = {
      id: `svc-${Date.now()}`,
      name: formName.trim(),
      criticality: formCriticality,
    };
    updateRack({ services: [...services, newService] });
    setFormName('');
    setFormCriticality('medium');
    setShowForm(false);
  }

  function updateService(id: string, patch: Partial<RackService>) {
    updateRack({
      services: services.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  }

  function removeService(id: string) {
    updateRack({ services: services.filter((s) => s.id !== id) });
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
          <Globe size={15} />
          Service Map
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              const csv = exportServiceMapCsv(services, layout);
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'service-map.csv';
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
              const md = exportServiceMapMarkdown(services, layout);
              const blob = new Blob([md], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'service-map.md';
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
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold text-slate-900 dark:text-white">{summary.totalCount}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Services
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{summary.healthyCount}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Healthy
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold text-red-600 dark:text-red-400">{summary.spoFCount}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            SPOF
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{summary.unhealthyCount}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Issues
          </div>
        </div>
      </div>

      {/* SPOF warnings */}
      {spoFs.length > 0 && (
        <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 p-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-red-700 dark:text-red-300">
            <ShieldAlert size={13} />
            Single Points of Failure ({spoFs.length})
          </div>
          <div className="space-y-1">
            {spoFs.map(({ service, spoFDevices }) => (
              <div key={service.id} className="text-xs text-red-800 dark:text-red-200">
                <span className="font-medium">{service.name}</span> depends on{' '}
                {spoFDevices
                  .map((id) => layout.devices.find((d) => d.id === id)?.name ?? id)
                  .join(', ')}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add form */}
      {showForm ? (
        <div className="mb-3 flex flex-col gap-2 rounded-md border p-2" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Service name (e.g. DNS, NAS, Plex)"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="flex-1 rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
            <select
              value={formCriticality}
              onChange={(e) => setFormCriticality(e.target.value as ServiceCriticality)}
              className="rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            >
              {criticalityOptions.map((c) => (
                <option key={c} value={c}>
                  {criticalityLabel(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addService}
              className="rounded bg-cyan-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-cyan-700"
            >
              Add Service
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
          Add service
        </button>
      )}

      {/* Filters */}
      <div className="mb-2 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider transition ${
            filter === 'all' ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' : 'opacity-60'
          }`}
        >
          All
        </button>
        {criticalityOptions.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider transition ${
              filter === c ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' : 'opacity-60'
            }`}
          >
            {criticalityLabel(c)}
          </button>
        ))}
      </div>

      {/* Service list */}
      <div className="space-y-1.5">
        {filteredServices.map((service) => (
          <ServiceRow
            key={service.id}
            service={service}
            onUpdate={(patch) => updateService(service.id, patch)}
            onRemove={() => removeService(service.id)}
            deviceOptions={deviceOptions}
          />
        ))}
      </div>

      {filteredServices.length === 0 && (
        <div
          className="rounded-md border p-3 text-center text-xs opacity-60"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          No services mapped yet. Add DNS, DHCP, VPN, NAS, Plex, backups, and other services.
        </div>
      )}
    </section>
  );
}
