import {
  Box,
  CalendarDays,
  CheckCircle2,
  Crosshair,
  Layers,
  Wrench,
} from "lucide-react";
import { useMemo } from "react";
import type { PlanLens } from "../types/appShell";
import type { RackLayout } from "../types/rack";
import { SnapshotCard, WorkbenchHeader } from "./WorkbenchPrimitives";

interface PlanWorkbenchProps {
  layout: RackLayout;
  currentLens: PlanLens;
  onSelectLens: (lens: PlanLens) => void;
}

const lensMeta = {
  scenarios: {
    label: "Scenarios",
    icon: <Crosshair size={14} />,
    description: "Simulate what-if events and forecast capacity headroom.",
  },
  baseline: {
    label: "Baseline",
    icon: <Layers size={14} />,
    description:
      "Capture golden snapshots, track migration progress and catalog quality.",
  },
  schedule: {
    label: "Schedule",
    icon: <CalendarDays size={14} />,
    description:
      "Plan change windows, reserve rack space and coordinate maintenance.",
  },
  changes: {
    label: "Changes",
    icon: <CheckCircle2 size={14} />,
    description:
      "Review change requests, assess risk and approve or reject proposals.",
  },
  build: {
    label: "Build",
    icon: <Wrench size={14} />,
    description:
      "Procurement checklist, readiness and commissioning validation.",
  },
  fit: {
    label: "Fit Check",
    icon: <Box size={14} />,
    description:
      "Validate devices and accessories against rack geometry before purchase.",
  },
} as const;

const lensKeys = Object.keys(lensMeta) as PlanLens[];

export function PlanWorkbench({
  layout,
  currentLens,
  onSelectLens,
}: PlanWorkbenchProps) {
  const changeRequests = layout.changeRequests ?? [];
  const procurementItems = layout.procurementItems ?? [];
  const changeEvents = layout.changeEvents ?? [];

  const pendingChanges = changeRequests.filter(
    (r) => r.status === "pending",
  ).length;
  const approvedChanges = changeRequests.filter(
    (r) => r.status === "approved",
  ).length;
  const buildRemaining = procurementItems.filter(
    (i) => i.status === "need-to-buy" || i.status === "ordered",
  ).length;

  const nextEventDate = useMemo(() => {
    const now = new Date().getTime();
    const upcoming = changeEvents
      .filter((e) => {
        const t = new Date(e.scheduledFor).getTime();
        return (
          Number.isFinite(t) &&
          t > now &&
          (e.status === "planned" || e.status === "in-progress")
        );
      })
      .sort(
        (a, b) =>
          new Date(a.scheduledFor).getTime() -
          new Date(b.scheduledFor).getTime(),
      );
    return upcoming[0]?.scheduledFor ?? null;
  }, [changeEvents]);

  const baselineCaptured = layout.goldenBaseline != null;
  const reservationCount = layout.reservations?.length ?? 0;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/75">
      <WorkbenchHeader<PlanLens>
        badge="Plan workbench"
        title={lensMeta[currentLens].label}
        description={lensMeta[currentLens].description}
        lenses={lensKeys}
        currentLens={currentLens}
        onSelectLens={onSelectLens}
        lensMeta={lensMeta}
      />

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <SnapshotCard
          title="Baseline captured"
          value={baselineCaptured ? "Yes" : "No"}
          detail={
            baselineCaptured
              ? "A golden snapshot exists for comparison."
              : "No baseline saved yet."
          }
          tone={baselineCaptured ? "default" : "warn"}
          onClick={() => onSelectLens("baseline")}
        />
        <SnapshotCard
          title="Pending changes"
          value={`${pendingChanges}`}
          detail="Change requests awaiting approval or review."
          tone={pendingChanges > 0 ? "warn" : "default"}
          onClick={() => onSelectLens("changes")}
        />
        <SnapshotCard
          title="Approved changes"
          value={`${approvedChanges}`}
          detail="Changes ready for scheduling and execution."
          tone="default"
          onClick={() => onSelectLens("changes")}
        />
        <SnapshotCard
          title="Build items remaining"
          value={`${buildRemaining}`}
          detail="Procurement items still needed or on order."
          tone={buildRemaining > 0 ? "warn" : "default"}
          onClick={() => onSelectLens("build")}
        />
        <SnapshotCard
          title="Next event"
          value={
            nextEventDate
              ? new Date(nextEventDate).toLocaleDateString()
              : "None"
          }
          detail={
            nextEventDate
              ? "Upcoming scheduled change event."
              : "No upcoming events scheduled."
          }
          tone="default"
          onClick={() => onSelectLens("schedule")}
        />
        <SnapshotCard
          title="Reservations"
          value={`${reservationCount}`}
          detail="Rack U ranges reserved for future hardware."
          tone="default"
          onClick={() => onSelectLens("schedule")}
        />
      </div>
    </section>
  );
}
