import { useEffect, useRef, useState } from "react";
import type { AppWorkspace } from "../types/appShell";
import type {
  ToolbarActionDefinition,
  ViewModeDefinition,
  WorkspaceContribution,
} from "../plugins/types";
import type { PluginToggleItem } from "./PluginsMenu";
import { PluginsMenu } from "./PluginsMenu";
import { ThemeToggle } from "./ThemeToggle";
import { TOOL_WORKSPACES } from "../utils/shellWorkflow";

type Props = {
  currentWorkspace: AppWorkspace;
  workspaces: WorkspaceContribution[];
  pluginToggles: PluginToggleItem[];
  onSelectWorkspace: (workspace: AppWorkspace) => void;
  onOpenSettings?: () => void;
  onManagePlugins?: () => void;
  actions?: ToolbarActionDefinition[];
  views?: ViewModeDefinition[];
  onSelectView?: (view: ViewModeDefinition["id"]) => void;
};
export function WorkspaceToolsMenu({
  currentWorkspace,
  workspaces,
  pluginToggles,
  onSelectWorkspace,
  onOpenSettings,
  onManagePlugins,
  actions = [],
  views = [],
  onSelectView,
}: Props) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const run = (action: () => void) => {
    action();
    setOpen(false);
  };
  const itemClass =
    "w-full rounded-lg px-3 py-2.5 text-left text-sm text-content hover:bg-fill focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50";
  return (
    <div className="static sm:relative" ref={ref}>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          setSettings(false);
        }}
        className="h-8 rounded-lg border border-edge bg-surface px-3 text-xs text-content-secondary"
        data-testid="workspace-tools-trigger"
      >
        Tools ▾
      </button>
      {open && (
        <div
          className="absolute left-3 right-3 top-full z-[90] mt-2 max-h-[75vh] overflow-y-auto rounded-xl border border-edge bg-surface p-2 shadow-xl sm:left-auto sm:right-0 sm:w-72"
          aria-label="Workspace tools"
        >
          {settings ? (
            <>
              <button
                type="button"
                className={itemClass}
                onClick={() => setSettings(false)}
              >
                ← All tools
              </button>
              {onOpenSettings && (
                <button
                  type="button"
                  className={itemClass}
                  onClick={() => run(onOpenSettings)}
                >
                  Rack settings
                </button>
              )}
              {onManagePlugins && (
                <button
                  type="button"
                  className={itemClass}
                  onClick={() => run(onManagePlugins)}
                >
                  Manage plugins
                </button>
              )}
              <div className="flex flex-wrap gap-2 border-t border-edge p-3">
                <ThemeToggle />
                <PluginsMenu pluginToggles={pluginToggles} inline />
              </div>
              {views.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={itemClass}
                  onClick={() => run(() => onSelectView?.(v.id))}
                >
                  {v.label}
                </button>
              ))}
            </>
          ) : (
            <>
              {TOOL_WORKSPACES.map((g) => {
                const contribution = workspaces.find((w) => w.id === g.id);
                const plugin = pluginToggles.find((p) => p.id === g.pluginId);
                return (
                  <button
                    key={g.id}
                    type="button"
                    disabled={!contribution && (!plugin || plugin.disabled)}
                    className={itemClass}
                    aria-current={
                      currentWorkspace === g.id ? "page" : undefined
                    }
                    onClick={() =>
                      run(() => {
                        if (!contribution && plugin && !plugin.enabled)
                          plugin.onToggle();
                        onSelectWorkspace(g.id);
                      })
                    }
                  >
                    <span className="flex justify-between font-semibold">
                      {g.label}
                      <span className="text-xs font-normal text-content-muted">
                        {contribution ? "→" : "Enable & open"}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-content-muted">
                      {g.detail}
                    </span>
                  </button>
                );
              })}
              {workspaces
                .filter((w) => !TOOL_WORKSPACES.some((g) => g.id === w.id))
                .map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className={itemClass}
                    onClick={() => run(() => onSelectWorkspace(w.id))}
                  >
                    {w.title}
                  </button>
                ))}
              <button
                type="button"
                className={itemClass}
                onClick={() => setSettings(true)}
              >
                <span className="font-semibold">Settings →</span>
                <span className="mt-1 block text-xs text-content-muted">
                  Rack configuration, plugins and appearance
                </span>
              </button>
              {actions.length > 0 && (
                <details className="border-t border-edge p-2">
                  <summary className="cursor-pointer text-xs text-content-muted">
                    Additional tools
                  </summary>
                  {actions.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={itemClass}
                      onClick={() => run(a.run)}
                    >
                      {a.label}
                    </button>
                  ))}
                </details>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
