import {
  Box,
  FileCheck,
  HardDrive,
  ShieldCheck,
  Wrench,
  Zap,
} from "lucide-react";
import { useMemo } from "react";
import type { OperateLens } from "../types/appShell";
import type { RackLayout } from "../types/rack";
import { summarizeAssets } from "../utils/assetRegistry";
import { summarizeBackups } from "../utils/backupTracking";
import { getFirmwareStatus } from "../utils/firmwareTracker";
import { summarizeMaintenance } from "../utils/maintenanceLog";
import { SnapshotCard, WorkbenchHeader } from "./WorkbenchPrimitives";

interface OperateWorkbenchProps {
  layout: RackLayout;
  currentLens: OperateLens;
  onSelectLens: (lens: OperateLens) => void;
}

const lensMeta = {
  assets: {
    label: "Assets",
    icon: <Box size={14} />,
    description:
      "Track serial numbers, warranties, purchase records and spare-parts inventory.",
  },
  maintenance: {
    label: "Maintenance",
    icon: <Wrench size={14} />,
    description:
      "Service history, cleaning schedules and overdue maintenance alerts.",
  },
  firmware: {
    label: "Firmware",
    icon: <HardDrive size={14} />,
    description:
      "Version tracking, update availability and boot dependency order.",
  },
  network: {
    label: "Network",
    icon: <ShieldCheck size={14} />,
    description: "IP assignments, VLANs, service maps and port documentation.",
  },
  evidence: {
    label: "Evidence",
    icon: <FileCheck size={14} />,
    description:
      "Backup verification, photos, receipts and config evidence locker.",
  },
  power: {
    label: "Power",
    icon: <Zap size={14} />,
    description:
      "Power bill reconciliation, runbooks and operational procedures.",
  },
} as const;

const lensKeys = Object.keys(lensMeta) as OperateLens[];

export function OperateWorkbench({
  layout,
  currentLens,
  onSelectLens,
}: OperateWorkbenchProps) {
  const devices = layout.devices;

  const assetSummary = useMemo(() => summarizeAssets(devices), [devices]);
  const backupSummary = useMemo(() => summarizeBackups(devices), [devices]);
  const maintenanceSummary = useMemo(
    () => summarizeMaintenance(devices),
    [devices],
  );

  const firmwareOutdatedCount = useMemo(() => {
    return devices.filter((d) => getFirmwareStatus(d) === "update-available")
      .length;
  }, [devices]);

  const evidenceCount = layout.evidenceRecords?.length ?? 0;
  const assetCompletePct =
    assetSummary.totalDevices > 0
      ? Math.round(
          (assetSummary.completeCount / assetSummary.totalDevices) * 100,
        )
      : 0;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/75">
      <WorkbenchHeader<OperateLens>
        badge="Operate console"
        title={lensMeta[currentLens].label}
        description={lensMeta[currentLens].description}
        lenses={lensKeys}
        currentLens={currentLens}
        onSelectLens={onSelectLens}
        lensMeta={lensMeta}
      />

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <SnapshotCard
          title="Devices"
          value={`${devices.length}`}
          detail={`${assetSummary.completeCount} with complete asset records`}
          tone="default"
          onClick={() => onSelectLens("assets")}
        />
        <SnapshotCard
          title="Asset completeness"
          value={`${assetCompletePct}%`}
          detail={`${assetSummary.totalDevices - assetSummary.completeCount} devices missing asset data`}
          tone={assetCompletePct < 50 ? "warn" : "default"}
          onClick={() => onSelectLens("assets")}
        />
        <SnapshotCard
          title="Firmware outdated"
          value={`${firmwareOutdatedCount}`}
          detail="Devices with update-available firmware status"
          tone={firmwareOutdatedCount > 0 ? "warn" : "default"}
          onClick={() => onSelectLens("firmware")}
        />
        <SnapshotCard
          title="Backups overdue"
          value={`${backupSummary.overdueRestoreCount}`}
          detail="Restore tests older than 90 days"
          tone={backupSummary.overdueRestoreCount > 0 ? "danger" : "default"}
          onClick={() => onSelectLens("evidence")}
        />
        <SnapshotCard
          title="Maintenance overdue"
          value={`${maintenanceSummary.overdueDevices}`}
          detail="Devices past their maintenance interval"
          tone={maintenanceSummary.overdueDevices > 0 ? "warn" : "default"}
          onClick={() => onSelectLens("maintenance")}
        />
        <SnapshotCard
          title="Evidence records"
          value={`${evidenceCount}`}
          detail="Receipts, photos, screenshots and test results"
          tone="default"
          onClick={() => onSelectLens("evidence")}
        />
      </div>
    </section>
  );
}
