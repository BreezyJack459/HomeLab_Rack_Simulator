import type {
  AppPanelId,
  AppWorkspace,
  CommandDefinition,
  PluginPanelDefinition,
  RackPluginModule,
  ViewModeId,
  ToolbarActionDefinition,
  ViewModeDefinition,
} from './types';
import type { RackLayout } from '../types/rack';

type CoreContributions = {
  viewModes: ViewModeDefinition[];
  panels: PluginPanelDefinition[];
  toolbarActions: ToolbarActionDefinition[];
  commands: CommandDefinition[];
};

type BuildPluginRegistryArgs = {
  appVersion: string;
  plugins: RackPluginModule[];
  enabledPluginIds: string[];
  core: CoreContributions;
  shell?: {
    getLayout?: () => RackLayout;
    getViewMode?: () => ViewModeId;
    setViewMode?: (mode: ViewModeId) => void;
    setCurrentWorkspace?: (workspace: AppWorkspace) => void;
    setInspectorOpen?: (open: boolean) => void;
  };
};

type PluginStates = {
  enabled: string[];
  disabled: string[];
  incompatible: Record<string, string>;
  errored: Record<string, string>;
};

const isCompatible = (appVersion: string, requiresAppVersion: string) =>
  appVersion === requiresAppVersion;

export function buildPluginRegistry({
  appVersion,
  plugins,
  enabledPluginIds,
  core,
  shell,
}: BuildPluginRegistryArgs) {
  const viewModes = [...core.viewModes];
  const panels = [...core.panels];
  const toolbarActions = [...core.toolbarActions];
  const commands = [...core.commands];
  const seen = new Set<string>();
  const pluginStates: PluginStates = {
    enabled: [],
    disabled: [],
    incompatible: {},
    errored: {},
  };

  const pushUnique = <T extends { id: string }>(
    prefix: string,
    bucket: T[],
    value: T,
  ) => {
    const key = `${prefix}:${value.id}`;
    if (seen.has(key)) {
      throw new Error(`Duplicate contribution id: ${key}`);
    }
    seen.add(key);
    bucket.push(value);
  };

  core.viewModes.forEach((item) => seen.add(`view:${item.id}`));
  core.panels.forEach((item) => seen.add(`panel:${item.id}`));
  core.toolbarActions.forEach((item) => seen.add(`toolbar:${item.id}`));
  core.commands.forEach((item) => seen.add(`command:${item.id}`));

  for (const plugin of plugins) {
    if (!isCompatible(appVersion, plugin.manifest.requiresAppVersion)) {
      pluginStates.incompatible[plugin.manifest.id] =
        `requiresAppVersion=${plugin.manifest.requiresAppVersion}`;
      continue;
    }

    if (!enabledPluginIds.includes(plugin.manifest.id)) {
      pluginStates.disabled.push(plugin.manifest.id);
      continue;
    }

    try {
      plugin.activate({
        getLayout: () => {
          if (!shell?.getLayout) {
            throw new Error('Plugin host shell.getLayout is not available');
          }

          return shell.getLayout();
        },
        getViewMode: () => shell?.getViewMode?.() ?? '2d',
        setViewMode: (mode) => shell?.setViewMode?.(mode),
        openPanel: (panelId) => {
          const panel = panels.find((item) => item.id === panelId);
          if (!panel) {
            return;
          }

          shell?.setCurrentWorkspace?.(panel.workspace);
          if (panel.defaultPlacement === 'inspector') {
            shell?.setInspectorOpen?.(true);
          }
        },
        registerViewMode: (definition) =>
          pushUnique('view', viewModes, definition),
        registerPanel: (definition) => pushUnique('panel', panels, definition),
        registerToolbarAction: (definition) =>
          pushUnique('toolbar', toolbarActions, definition),
        registerCommand: (definition) =>
          pushUnique('command', commands, definition),
      });
    } catch (error) {
      // Duplicate contribution ids are an integrity guard; keep them fatal.
      if (error instanceof Error && error.message.startsWith('Duplicate contribution id:')) {
        throw error;
      }
      // A throwing plugin must not abort the whole registry; record the
      // failure and continue with the remaining plugins.
      pluginStates.errored[plugin.manifest.id] =
        error instanceof Error ? error.message : String(error);
      continue;
    }

    pluginStates.enabled.push(plugin.manifest.id);
  }

  return {
    viewModes: viewModes.sort((a, b) => a.order - b.order),
    panels: panels.sort((a, b) => a.priority - b.priority),
    toolbarActions,
    commands,
    pluginStates,
  };
}
