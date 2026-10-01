import { Cable, CheckCircle2, Monitor, Search, Server } from "lucide-react";
import type { ReactNode } from "react";
import type {
  ToolbarActionDefinition,
  ViewModeDefinition,
  WorkspaceContribution,
} from "../plugins/types";
import type { PluginToggleItem } from "./PluginsMenu";
import type { AppWorkspace } from "../types/appShell";
import type { ShellWorkflow } from "../utils/shellWorkflow";
import { WorkspaceToolsMenu } from "./WorkspaceToolsMenu";

export type ShellTopBarProps = {
  currentWorkspace: AppWorkspace;
  workflow?: ShellWorkflow;
  pluginWorkspaces?: WorkspaceContribution[];
  onSelectWorkspace: (workspace: AppWorkspace) => void;
  onSelectWorkflow?: (workflow: "build" | "cable" | "check") => void;
  pluginToggles?: PluginToggleItem[];
  onOpenCommand: () => void;
  onOpenSettings?: () => void;
  onManagePlugins?: () => void;
  toolbarActions?: ToolbarActionDefinition[];
  toolViews?: ViewModeDefinition[];
  onSelectToolView?: (view: ViewModeDefinition["id"]) => void;
  fileActions?: ReactNode;
};

export function ShellTopBar({
  currentWorkspace,
  workflow = currentWorkspace === "audit"
    ? "check"
    : currentWorkspace === "model"
      ? "build"
      : "tools",
  pluginWorkspaces = [],
  onSelectWorkspace,
  onSelectWorkflow,
  pluginToggles = [],
  onOpenCommand,
  onOpenSettings,
  onManagePlugins,
  toolbarActions,
  toolViews,
  onSelectToolView,
  fileActions,
}: ShellTopBarProps) {
  const nav = [
    {
      id: "build",
      label: "Build",
      name: "Build Rack",
      icon: <Monitor size={14} />,
    },
    { id: "cable", label: "Cable", name: "Cable", icon: <Cable size={14} /> },
    {
      id: "check",
      label: "Check",
      name: "Check Health",
      icon: <CheckCircle2 size={14} />,
    },
  ] as const;
  return (
    <div
      className="studio-topbar relative z-[70] flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-edge bg-surface px-3 py-2 sm:px-5"
      data-testid="shell-top-bar"
    >
      <div className="hidden shrink-0 items-center gap-2.5 sm:flex" aria-label="Homelab Rack Studio">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/35 bg-accent-subtle text-accent-fg"><Server size={18} aria-hidden /></span>
        <span className="text-sm font-semibold tracking-tight">Rack Studio<span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-content-muted">Homelab planning</span></span>
      </div>
      <nav className="studio-workflows flex shrink-0 items-center gap-1 rounded-lg bg-fill-subtle p-1" aria-label="Workspaces">
        {nav.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-label={item.name}
            aria-current={workflow === item.id ? "page" : undefined}
            onClick={() => {
              if (onSelectWorkflow) onSelectWorkflow(item.id);
              else onSelectWorkspace(item.id === "check" ? "audit" : "model");
            }}
            className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-xs font-semibold ${workflow === item.id ? "bg-accent-solid text-accent-on shadow-sm" : "text-content-secondary hover:bg-fill"}`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
      <div className="studio-utilities ml-auto flex items-center gap-2">
        <WorkspaceToolsMenu
          currentWorkspace={currentWorkspace}
          workspaces={pluginWorkspaces}
          pluginToggles={pluginToggles}
          onSelectWorkspace={onSelectWorkspace}
          onOpenSettings={onOpenSettings}
          onManagePlugins={onManagePlugins}
          actions={toolbarActions}
          views={toolViews}
          onSelectView={onSelectToolView}
        />
        {fileActions}
        <button
          type="button"
          onClick={onOpenCommand}
          aria-label="Search commands"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-edge px-3 text-xs text-content-secondary hover:bg-fill"
        >
          <Search size={14} />
          <span className="hidden lg:inline">Search <kbd className="ml-2 text-content-muted">⌘K</kbd></span>
        </button>
      </div>
    </div>
  );
}
