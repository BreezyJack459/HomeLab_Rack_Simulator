import type { AppWorkspace } from "../types/appShell";
import type { ViewMode } from "../types/rack";
export type ShellWorkflow = "build" | "cable" | "check" | "tools";
export const isCableView = (view: ViewMode) =>
  view === "cables" || view === "topology";
export const getShellWorkflow = (
  workspace: AppWorkspace,
  view: ViewMode,
): ShellWorkflow =>
  workspace === "audit"
    ? "check"
    : workspace !== "model" || view === "cable-labels"
      ? "tools"
      : isCableView(view)
        ? "cable"
        : "build";
export const TOOL_WORKSPACES = [
  {
    id: "operate",
    pluginId: "operations-pack",
    label: "Operations",
    detail: "Inventory, maintenance, firmware and IP addresses",
  },
  {
    id: "plan",
    pluginId: "planning-pack",
    label: "Planning",
    detail: "Scenarios, changes, capacity and build readiness",
  },
  {
    id: "portfolio",
    pluginId: "fleet-pack",
    label: "Fleet",
    detail: "Racks, rooms and inter-rack connections",
  },
] as const;
