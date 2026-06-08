import { Download, HardDrive, AlertTriangle, Tag, DollarSign, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { PlacedDevice } from '../types/rack';
import {
  devicesMissingAssets,
  exportAssetRegistryCsv,
  exportAssetRegistryMarkdown,
  summarizeAssets,
} from '../utils/assetRegistry';

function AssetRow({
  device,
  onUpdate,
}: {
  device: PlacedDevice;
  onUpdate: (patch: Partial<PlacedDevice>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const missing = useMemo(() => {
    const info = devicesMissingAssets([device]);
    return info.length > 0 ? info[0].missingFields : [];
  }, [device]);

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
        <HardDrive size={14} className="shrink-0 opacity-70" />
        <span className="flex-1 truncate font-medium">{device.name}</span>
        {missing.length === 0 ? (
          <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
        ) : (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
            {missing.length} missing
          </span>
        )}
      </div>
      {expanded && (
        <div
          className="grid grid-cols-2 gap-2 border-t px-3 py-2.5 text-xs"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Asset Tag</div>
            <input
              type="text"
              value={device.assetTag ?? ''}
              onChange={(e) => onUpdate({ assetTag: e.target.value || undefined })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
              placeholder="e.g. ASSET-001"
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Serial Number</div>
            <input
              type="text"
              value={device.serialNumber ?? ''}
              onChange={(e) => onUpdate({ serialNumber: e.target.value || undefined })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
              placeholder="e.g. SN123456"
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Purchase Date</div>
            <input
              type="date"
              value={device.purchaseDate ?? ''}
              onChange={(e) => onUpdate({ purchaseDate: e.target.value || undefined })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Vendor</div>
            <input
              type="text"
              value={device.vendor ?? ''}
              onChange={(e) => onUpdate({ vendor: e.target.value || undefined })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
              placeholder="e.g. Dell, HP, Ubiquiti"
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Purchase Price ($)</div>
            <input
              type="number"
              min={0}
              step={0.01}
              value={device.purchasePrice ?? ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined;
                onUpdate({ purchasePrice: val });
              }}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Warranty End Date</div>
            <input
              type="date"
              value={device.warrantyEndDate ?? ''}
              onChange={(e) => onUpdate({ warrantyEndDate: e.target.value || undefined })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>
          <div className="col-span-2">
            <div className="text-[10px] uppercase tracking-wider opacity-60">Invoice Reference</div>
            <input
              type="text"
              value={device.invoiceRef ?? ''}
              onChange={(e) => onUpdate({ invoiceRef: e.target.value || undefined })}
              className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
              placeholder="e.g. INV-2024-001"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function AssetRegistryPanel() {
  const layout = useRackStore((state) => state.layout);
  const updateDevice = useRackStore((state) => state.updateDevice);
  const devices = layout.devices;
  const summary = useMemo(() => summarizeAssets(devices), [devices]);
  const missingList = useMemo(() => devicesMissingAssets(devices), [devices]);

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
          <Tag size={15} />
          Asset Registry
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              const csv = exportAssetRegistryCsv(devices);
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'asset-registry.csv';
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
              const md = exportAssetRegistryMarkdown(devices);
              const blob = new Blob([md], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'asset-registry.md';
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
          <div className="text-lg font-bold text-slate-900 dark:text-white">{summary.completeCount}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Complete
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold text-slate-900 dark:text-white">{summary.incompleteCount}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Incomplete
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="flex items-center justify-center gap-1 text-lg font-bold text-slate-900 dark:text-white">
            <DollarSign size={14} />
            {summary.totalPurchaseValue.toFixed(0)}
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Total Value
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold text-slate-900 dark:text-white">
            {summary.expiredWarrantyCount + summary.expiringSoonCount}
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Warranty Alerts
          </div>
        </div>
      </div>

      {summary.expiredWarrantyCount > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-800 dark:text-red-100">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          <span>{summary.expiredWarrantyCount} device(s) have expired warranties.</span>
        </div>
      )}

      {summary.expiringSoonCount > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-100">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{summary.expiringSoonCount} device(s) have warranties expiring within 30 days.</span>
        </div>
      )}

      {missingList.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 p-2.5 text-xs text-cyan-800 dark:text-cyan-100">
          <Tag size={14} className="mt-0.5 shrink-0" />
          <span>{missingList.length} device(s) are missing asset information. Expand rows below to fill in details.</span>
        </div>
      )}

      <div className="space-y-2">
        {devices.map((device) => (
          <AssetRow key={device.id} device={device} onUpdate={(patch) => updateDevice(device.id, patch)} />
        ))}
      </div>
    </section>
  );
}
