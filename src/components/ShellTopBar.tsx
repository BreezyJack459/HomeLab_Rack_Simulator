import { Cable, CheckCircle2, Monitor, Search } from "lucide-react";
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
      className="relative z-[70] flex shrink-0 flex-wrap items-center gap-2 border-b border-edge bg-surface px-3 py-2 sm:gap-3 sm:px-4"
      data-testid="shell-top-bar"
    >
      <span className="hidden text-sm font-semibold tracking-tight text-content lg:inline">
        Homelab
      </span>
      <nav className="flex shrink-0 items-center gap-1" aria-label="Workspaces">
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
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium ${workflow === item.id ? "bg-accent-solid text-content" : "text-content-secondary hover:bg-fill"}`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
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
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-edge px-2 text-xs text-content-secondary hover:bg-fill"
        >
          <Search size={14} />
          <span className="hidden sm:inline">Search ⌘K</span>
        </button>
      </div>
    </div>
  );
}
