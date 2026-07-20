import type { ReactNode } from 'react';
import { Box, Monitor } from 'lucide-react';
import type {
  CommandDefinition,
  PluginPanelDefinition,
  ToolbarActionDefinition,
  ViewModeDefinition,
} from './types';
import { PANEL_REGISTRY } from '../types/panelRegistry';
import type { RackLayout } from '../types/rack';

type CoreContributionArgs = {
  render2d: (layout: RackLayout) => ReactNode;
  render3d: (layout: RackLayout) => ReactNode;
};

export function getCoreContributions({
  render2d,
  render3d,
}: CoreContributionArgs): {
  viewModes: ViewModeDefinition[];
  panels: PluginPanelDefinition[];
  toolbarActions: ToolbarActionDefinition[];
  commands: CommandDefinition[];
} {
  const pluginOwnedPanelIds = new Set([
    'cable-planner',
    'policy-rules',
    'homelab-guide',
  ]);

  return {
    viewModes: [
      {
        id: '2d',
        label: '2D',
        order: 10,
        icon: <Monitor size={14} />,
        render: render2d,
      },
      {
        id: '3d',
        label: '3D',
        order: 20,
        icon: <Box size={14} />,
        render: render3d,
      },
    ],
    panels: [
      ...PANEL_REGISTRY.filter((panel) => !pluginOwnedPanelIds.has(panel.id)).map(
        (panel) => ({
          ...panel,
          render: () => null,
        }),
      ),
    ],
    toolbarActions: [],
    commands: [],
  };
}
