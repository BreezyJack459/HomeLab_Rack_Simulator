import {
  Building2,
  FileDown,
  LayoutGrid,
  Network,
  ShieldCheck,
  BookOpen,
} from "lucide-react";
import { useMemo } from "react";
import type { PortfolioLens } from "../types/appShell";
import type { RackLayout, Workspace } from "../types/rack";
import { SnapshotCard, WorkbenchHeader } from "./WorkbenchPrimitives";

interface PortfolioWorkbenchProps {
  workspace: Workspace;
  layout: RackLayout;
  currentLens: PortfolioLens;
  onSelectLens: (lens: PortfolioLens) => void;
}

const lensMeta = {
  overview: {
    label: "Overview",
    icon: <LayoutGrid size={14} />,
    description: "Manage racks, switch between labs and export your workspace.",
  },
  rooms: {
    label: "Rooms",
    icon: <Building2 size={14} />,
    description: "Visualise room layouts and position racks in physical space.",
  },
  interconnect: {
    label: "Interconnect",
    icon: <Network size={14} />,
    description: "Map cross-rack cabling, fibre runs and trunk links.",
  },
  data: {
    label: "Data",
    icon: <FileDown size={14} />,
    description: "Import from DCIM tools and export portfolio reports.",
  },
  policy: {
    label: "Policy",
    icon: <ShieldCheck size={14} />,
    description: "Define compliance rules, naming conventions and standards.",
  },
  guide: {
    label: "Guide",
    icon: <BookOpen size={14} />,
    description: "Homelab setup wizard, documentation and rack photos.",
  },
} as const;

const lensKeys = Object.keys(lensMeta) as PortfolioLens[];

export function PortfolioWorkbench({
  workspace,
  layout,
  currentLens,
  onSelectLens,
}: PortfolioWorkbenchProps) {
  const totalDevices = useMemo(
    () => workspace.racks.reduce((sum, r) => sum + r.devices.length, 0),
    [workspace.racks],
  );

  const totalRoomRacks = useMemo(
    () =>
      workspace.racks.reduce((sum, r) => sum + (r.roomRacks?.length ?? 0), 0),
    [workspace.racks],
  );

  const interRackCableCount = workspace.interRackCables?.length ?? 0;
  const photoCount = layout.photos?.length ?? 0;
  const policyCount = layout.policies?.length ?? 0;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/75">
      <WorkbenchHeader<PortfolioLens>
        badge="Portfolio hub"
        title={lensMeta[currentLens].label}
        description={lensMeta[currentLens].description}
        lenses={lensKeys}
        currentLens={currentLens}
        onSelectLens={onSelectLens}
        lensMeta={lensMeta}
      />

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <SnapshotCard
          title="Racks"
          value={`${workspace.racks.length}`}
          detail="Racks in this workspace"
          tone="default"
          onClick={() => onSelectLens("overview")}
        />
        <SnapshotCard
          title="Devices"
          value={`${totalDevices}`}
          detail="Total devices across all racks"
          tone="default"
          onClick={() => onSelectLens("overview")}
        />
        <SnapshotCard
          title="Inter-rack cables"
          value={`${interRackCableCount}`}
          detail="Cross-rack fibre, copper and trunk links"
          tone={interRackCableCount > 0 ? "default" : "warn"}
          onClick={() => onSelectLens("interconnect")}
        />
        <SnapshotCard
          title="Room racks"
          value={`${totalRoomRacks}`}
          detail="Racks placed in room layouts"
          tone={totalRoomRacks > 0 ? "default" : "warn"}
          onClick={() => onSelectLens("rooms")}
        />
        <SnapshotCard
          title="Photos"
          value={`${photoCount}`}
          detail="Rack photos and documentation images"
          tone="default"
          onClick={() => onSelectLens("guide")}
        />
        <SnapshotCard
          title="Policies"
          value={`${policyCount}`}
          detail="Active compliance and naming rules"
          tone="default"
          onClick={() => onSelectLens("policy")}
        />
      </div>
    </section>
  );
}
