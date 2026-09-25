import type { ReactNode } from 'react';
import type {
  AppPanelId,
  AppWorkspace,
  PanelPlacement,
} from '../types/appShell';
import type { RackLayout, ViewMode } from '../types/rack';

export type { AppPanelId, AppWorkspace } from '../types/appShell';

export type ViewModeId = ViewMode;

export type ViewModeDefinition = {
  id: ViewModeId;
  label: string;
  order: number;
  icon?: ReactNode;
  pluginId?: string;
  render: (layout: RackLayout) => ReactNode;
};

export type PluginPanelDefinition = {
  id: AppPanelId;
  title: string;
  workspace: AppWorkspace;
  priority: number;
  defaultPlacement: PanelPlacement;
  supportedViewModes?: ViewModeId[];
  selectionRequired?: boolean;
  pluginId?: string;
  render: () => ReactNode;
};

export type ToolbarActionDefinition = {
  id: string;
  label: string;
  pluginId?: string;
  isVisible?: () => boolean;
  run: () => void;
};

export type CommandDefinition = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  pluginId?: string;
  run: () => void;
};

export type LensContribution = {
  id: string;
  label: string;
  panelIds: AppPanelId[];
};

export type WorkspaceNavMeta = {
  label: string;
  shortLabel: string;
  description: string;
  accent: string;
};

export type WorkspaceContribution = {
  id: AppWorkspace;
  title: string;
  description: string;
  icon: ReactNode;
  nav: WorkspaceNavMeta;
  lenses: LensContribution[];
  renderWorkbench?: (
    lens: string,
    selectLens: (lens: string) => void,
  ) => ReactNode;
  renderInspector?: (
    lens: string,
    selectLens: (lens: string) => void,
  ) => ReactNode;
};

export type RackPluginManifest = {
  id: string;
  name: string;
  version: string;
  description: string;
  requiresAppVersion: string;
  defaultEnabled: boolean;
  origin: 'built-in' | 'local-package';
  trustLevel: 'trusted' | 'review-required';
  capabilities: Array<
    | 'view-modes'
    | 'panels'
    | 'commands'
    | 'toolbar-actions'
    | 'layout-read'
    | 'workspaces'
  >;
};

export type PluginHostContext = {
  getLayout: () => RackLayout;
  getViewMode: () => ViewModeId;
  setViewMode: (mode: ViewModeId) => void;
  openPanel: (panelId: AppPanelId) => void;
  registerViewMode: (definition: ViewModeDefinition) => void;
  registerPanel: (definition: PluginPanelDefinition) => void;
  registerToolbarAction: (definition: ToolbarActionDefinition) => void;
  registerCommand: (definition: CommandDefinition) => void;
  registerWorkspace: (contribution: WorkspaceContribution) => void;
};

export type RackPluginModule = {
  manifest: RackPluginManifest;
  activate: (host: PluginHostContext) => void;
};
