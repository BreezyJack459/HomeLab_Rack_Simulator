import { LayoutGrid, Redo, Undo } from "lucide-react";
import type { ReactNode } from "react";
import type { ViewModeDefinition } from "../plugins/types";
import type { RackLayout, ValidationIssue, ViewMode } from "../types/rack";
import type { getRackTotals } from "../utils/validation";
import { getShellWorkflow, type ShellWorkflow } from "../utils/shellWorkflow";
import { useCableWorkspaceStore } from "../store/cableWorkspaceStore";
import { ActionMenus, type ActionMenusProps } from "./ActionBar";
import { DeviceLibraryToggle } from "./DeviceLibraryToggle";
import { ShellTopBar, type ShellTopBarProps } from "./ShellTopBar";
import { RackHealthStrip } from "./RackHealthStrip";

type CanvasHeaderProps = ActionMenusProps & {
  layout: RackLayout;
  totals: ReturnType<typeof getRackTotals>;
  issues: ValidationIssue[];
  deviceLibraryOpen: boolean;
  onToggleDeviceLibrary: () => void;
  onRenameLayout: (name: string) => void;
  viewMode: ViewMode;
  viewModes: ViewModeDefinition[];
  onToggleViewMode: (mode: ViewMode) => void;
  onSetViewSide: (side: "front" | "rear") => void;
  summaryContent?: ReactNode;
  onOpenCheck?: () => void;
  workflow?: ShellWorkflow;
};

export function CanvasHeader({
  layout,
  totals,
  issues,
  deviceLibraryOpen,
  onToggleDeviceLibrary,
  onRenameLayout,
  viewMode,
  viewModes,
  onToggleViewMode,
  onSetViewSide,
  summaryContent,
  onOpenCheck,
  workflow = "build",
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: CanvasHeaderProps) {
  const subview = useCableWorkspaceStore((s) => s.subview);
  const setSubview = useCableWorkspaceStore((s) => s.setSubview);
  const buttonClass = (active: boolean) =>
    `inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium ${active ? "bg-accent-solid text-content" : "text-content-secondary hover:bg-fill"}`;
  return (
    <div
      className="relative z-[60] shrink-0 border-b border-edge bg-surface px-3 py-2 sm:px-4"
      data-testid="canvas-header"
    >
      <div className="flex flex-wrap items-center gap-2">
        {workflow === "build" && (
          <DeviceLibraryToggle
            open={deviceLibraryOpen}
            onToggle={onToggleDeviceLibrary}
          />
        )}
        <input
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-content outline-none"
          value={layout.name}
          onChange={(e) => onRenameLayout(e.target.value)}
          aria-label="Layout name"
        />
        <span
          className="hidden text-xs text-content-muted sm:inline"
          data-testid="rack-device-count"
        >
          {layout.devices.length} devices
        </span>
        <span className="text-xs text-content-muted">
          {layout.rackType === "19in" ? "19″" : "10″"} · {layout.heightU}U
        </span>
        <button
          type="button"
          aria-label="Undo"
          title="Undo"
          disabled={!canUndo}
          onClick={onUndo}
          className="rounded-lg p-2 hover:bg-fill disabled:opacity-30"
        >
          <Undo size={15} />
        </button>
        <button
          type="button"
          aria-label="Redo"
          title="Redo"
          disabled={!canRedo}
          onClick={onRedo}
          className="rounded-lg p-2 hover:bg-fill disabled:opacity-30"
        >
          <Redo size={15} />
        </button>
      </div>
      {(workflow === "build" || workflow === "cable") && (
        <div
          className="mt-2 flex flex-wrap items-center justify-between gap-2"
          data-testid="workflow-view-controls"
        >
          <div
            className="flex flex-wrap items-center gap-1"
            aria-label={workflow === "cable" ? "Cable views" : "Build views"}
          >
            {workflow === "build" ? (
              viewModes
                .filter((v) => v.id === "2d" || v.id === "3d")
                .map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    aria-label={v.id === "2d" ? "2D" : "3D"}
                    aria-pressed={viewMode === v.id}
                    className={buttonClass(viewMode === v.id)}
                    onClick={() => onToggleViewMode(v.id)}
                  >
                    {v.icon}
                    {v.id === "2d" ? "2D layout" : "3D inspect"}
                  </button>
                ))
            ) : (
              <>
                {(["2d", "3d", "table"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={viewMode === "cables" && subview === v}
                    className={buttonClass(
                      viewMode === "cables" && subview === v,
                    )}
                    onClick={() => {
                      setSubview(v);
                      onToggleViewMode("cables");
                    }}
                  >
                    {v === "2d"
                      ? "2D map"
                      : v === "3d"
                        ? "3D routing"
                        : "Table"}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={viewMode === "topology"}
                  className={buttonClass(viewMode === "topology")}
                  onClick={() => onToggleViewMode("topology")}
                >
                  Topology
                </button>
              </>
            )}
          </div>
          <div className="flex gap-1" aria-label="Rack side">
            {(["front", "rear"] as const).map((side) => (
              <button
                key={side}
                type="button"
                aria-pressed={layout.viewSide === side}
                className={buttonClass(layout.viewSide === side)}
                onClick={() => onSetViewSide(side)}
              >
                {side === "front" ? "Front" : "Rear"}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-edge pt-2">
        <RackHealthStrip
          totals={totals}
          layout={layout}
          issues={issues}
          onOpenCheck={onOpenCheck}
        />
        <button
          type="button"
          onClick={onOpenCheck}
          className="rounded-full border border-edge px-3 py-1 text-xs text-content-muted"
        >
          {issues.length} issues
        </button>
      </div>
      {summaryContent}
    </div>
  );
}

type NewShellChromeProps = CanvasHeaderProps &
  Omit<
    ShellTopBarProps,
    "workflow" | "toolViews" | "onSelectToolView" | "fileActions"
  >;
export function NewShellChrome({
  currentWorkspace,
  pluginWorkspaces,
  onSelectWorkspace,
  onSelectWorkflow,
  pluginToggles,
  onOpenCommand,
  onOpenSettings,
  onManagePlugins,
  toolbarActions,
  ...header
}: NewShellChromeProps) {
  const workflow = getShellWorkflow(currentWorkspace, header.viewMode);
  const tools = header.viewModes.filter(
    (v) => !["2d", "3d", "cables", "topology"].includes(v.id),
  );
  if (import.meta.env.DEV)
    tools.push({
      id: "gallery",
      label: "Faceplate gallery",
      order: 100,
      icon: <LayoutGrid size={14} />,
      render: () => null,
    });
  return (
    <>
      <ShellTopBar
        currentWorkspace={currentWorkspace}
        workflow={workflow}
        pluginWorkspaces={pluginWorkspaces}
        onSelectWorkspace={onSelectWorkspace}
        onSelectWorkflow={onSelectWorkflow}
        pluginToggles={pluginToggles}
        onOpenCommand={onOpenCommand}
        onOpenSettings={onOpenSettings}
        onManagePlugins={onManagePlugins}
        toolbarActions={toolbarActions}
        toolViews={tools}
        onSelectToolView={(view) => {
          onSelectWorkspace("model");
          header.onToggleViewMode(view);
        }}
        fileActions={<ActionMenus {...header} fileOnly />}
      />
      <CanvasHeader {...header} workflow={workflow} />
    </>
  );
}
