import { Box, BookOpen, Clock, FileCheck, HardDrive, ShieldCheck, Wrench, Zap } from 'lucide-react';
import { useMemo } from 'react';
import type { OperateLens } from '../types/appShell';
import type { RackLayout } from '../types/rack';
import { summarizeAssets } from '../utils/assetRegistry';
import { summarizeBackups } from '../utils/backupTracking';
import { getFirmwareStatus } from '../utils/firmwareTracker';
import { summarizeMaintenance } from '../utils/maintenanceLog';

interface OperateWorkbenchProps {
  layout: RackLayout;
  currentLens: OperateLens;
  onSelectLens: (lens: OperateLens) => void;
}

const lensMeta: Record<
  OperateLens,
  {
    label: string;
    icon: React.ReactNode;
    description: string;
  }
> = {
  assets: {
    label: 'Assets',
    icon: <Box size={14} />,
    description: 'Track serial numbers, warranties, purchase records and spare-parts inventory.',
  },
  maintenance: {
    label: 'Maintenance',
    icon: <Wrench size={14} />,
    description: 'Service history, cleaning schedules and overdue maintenance alerts.',
  },
  firmware: {
    label: 'Firmware',
    icon: <HardDrive size={14} />,
    description: 'Version tracking, update availability and boot dependency order.',
  },
  network: {
    label: 'Network',
    icon: <ShieldCheck size={14} />,
    description: 'IP assignments, VLANs, service maps and port documentation.',
  },
  evidence: {
    label: 'Evidence',
    icon: <FileCheck size={14} />,
    description: 'Backup verification, photos, receipts and config evidence locker.',
  },
  power: {
    label: 'Power',
    icon: <Zap size={14} />,
    description: 'Power bill reconciliation, runbooks and operational procedures.',
  },
};

function LensChip({
  lens,
  active,
  onClick,
}: {
  lens: OperateLens;
  active: boolean;
  onClick: () => void;
}) {
  const meta = lensMeta[lens];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition ${
        active
          ? 'border-cyan-500/40 bg-cyan-500/12 text-cyan-700 dark:text-cyan-300'
          : 'border-slate-200 bg-white/80 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      {meta.icon}
      {meta.label}
    </button>
  );
}

function SnapshotCard({
  title,
  value,
  detail,
  tone,
  onClick,
}: {
  title: string;
  value: string;
  detail: string;
  tone: 'default' | 'warn' | 'danger';
  onClick: () => void;
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300'
      : tone === 'warn'
        ? 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : 'border-slate-200 bg-white/85 text-slate-700 dark:border-slate-800 dark:bg-slate-900/75 dark:text-slate-200';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition hover:brightness-95 dark:hover:brightness-110 ${toneClass}`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] opacity-70">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs opacity-80">{detail}</div>
    </button>
  );
}

export function OperateWorkbench({ layout, currentLens, onSelectLens }: OperateWorkbenchProps) {
  const devices = layout.devices;

  const assetSummary = useMemo(() => summarizeAssets(devices), [devices]);
  const backupSummary = useMemo(() => summarizeBackups(devices), [devices]);
  const maintenanceSummary = useMemo(() => summarizeMaintenance(devices), [devices]);

  const firmwareOutdatedCount = useMemo(() => {
    return devices.filter((d) => getFirmwareStatus(d) === 'update-available').length;
  }, [devices]);

  const evidenceCount = layout.evidenceRecords?.length ?? 0;
  const assetCompletePct =
    assetSummary.totalDevices > 0
      ? Math.round((assetSummary.completeCount / assetSummary.totalDevices) * 100)
      : 0;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/75">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
            Operate console
          </div>
          <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{lensMeta[currentLens].label}</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            {lensMeta[currentLens].description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(lensMeta) as OperateLens[]).map((lens) => (
            <LensChip key={lens} lens={lens} active={lens === currentLens} onClick={() => onSelectLens(lens)} />
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <SnapshotCard
          title="Devices"
          value={`${devices.length}`}
          detail={`${assetSummary.completeCount} with complete asset records`}
          tone="default"
          onClick={() => onSelectLens('assets')}
        />
        <SnapshotCard
          title="Asset completeness"
          value={`${assetCompletePct}%`}
          detail={`${assetSummary.totalDevices - assetSummary.completeCount} devices missing asset data`}
          tone={assetCompletePct < 50 ? 'warn' : 'default'}
          onClick={() => onSelectLens('assets')}
        />
        <SnapshotCard
          title="Firmware outdated"
          value={`${firmwareOutdatedCount}`}
          detail="Devices with update-available firmware status"
          tone={firmwareOutdatedCount > 0 ? 'warn' : 'default'}
          onClick={() => onSelectLens('firmware')}
        />
        <SnapshotCard
          title="Backups overdue"
          value={`${backupSummary.overdueRestoreCount}`}
          detail="Restore tests older than 90 days"
          tone={backupSummary.overdueRestoreCount > 0 ? 'danger' : 'default'}
          onClick={() => onSelectLens('evidence')}
        />
        <SnapshotCard
          title="Maintenance overdue"
          value={`${maintenanceSummary.overdueDevices}`}
          detail="Devices past their maintenance interval"
          tone={maintenanceSummary.overdueDevices > 0 ? 'warn' : 'default'}
          onClick={() => onSelectLens('maintenance')}
        />
        <SnapshotCard
          title="Evidence records"
          value={`${evidenceCount}`}
          detail="Receipts, photos, screenshots and test results"
          tone="default"
          onClick={() => onSelectLens('evidence')}
        />
      </div>
    </section>
  );
}
