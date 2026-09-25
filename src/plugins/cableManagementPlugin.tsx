import { NEW_SHELL } from '../utils/featureFlags';
import { lazy } from 'react';
import { Cable, Network } from 'lucide-react';
import type { RackPluginModule } from './types';

const CableMap = lazy(() =>
  import('../components/CableMap').then((m) => ({ default: m.CableMap })),
);
const NetworkTopology = lazy(() =>
  import('../components/NetworkTopology').then((m) => ({
    default: m.NetworkTopology,
  })),
);
const CablePlanner = lazy(() =>
  import('../components/CablePlanner').then((m) => ({
    default: m.CablePlanner,
  })),
);

export const cableManagementPlugin: RackPluginModule = {
  manifest: {
    id: 'cable-management',
    name: 'Cable Management',
    version: '1.0.0',
    description: 'Cable map, topology, and planning workflow',
    requiresAppVersion: '1.0.0',
    defaultEnabled: true,
    origin: 'built-in',
    trustLevel: 'trusted',
    capabilities: [
      'view-modes',
      'panels',
      'commands',
      'toolbar-actions',
      'layout-read',
    ],
  },
  activate(host) {
    const openCablePlanner = () => {
      host.setViewMode('cables');
      host.openPanel('cable-planner');
    };

    host.registerViewMode({
      id: 'cables',
      label: 'Cables',
      order: 30,
      icon: <Cable size={14} />,
      render: (layout) => <CableMap layout={layout} embedded={NEW_SHELL} />,
    });

    host.registerViewMode({
      id: 'topology',
      label: 'Topology',
      order: 40,
      icon: <Network size={14} />,
      render: (layout) => <NetworkTopology layout={layout} />,
    });

    host.registerPanel({
      id: 'cable-planner',
      title: 'Cable Planner',
      workspace: 'model',
      priority: 20,
      defaultPlacement: 'inspector',
      supportedViewModes: ['2d', '3d', 'cables', 'topology'],
      pluginId: 'cable-management',
      render: () => <CablePlanner compact={NEW_SHELL} />,
    });

    host.registerToolbarAction({
      id: 'cable.quick-open',
      label: 'Cable Planner',
      run: openCablePlanner,
    });

    host.registerCommand({
      id: 'cable.open-planner',
      title: 'Open Cable Planner',
      subtitle: 'Switch to the cable workflow',
      category: 'Advanced panels',
      run: openCablePlanner,
    });
  },
};
