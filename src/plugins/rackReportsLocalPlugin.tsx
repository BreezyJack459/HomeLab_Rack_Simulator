import { lazy, Suspense } from 'react';
import { FileText } from 'lucide-react';
import type { RackPluginModule } from './types';

const RackReportsPanel = lazy(() =>
  import('../components/RackReportsPanel').then((m) => ({
    default: m.RackReportsPanel,
  })),
);

export const rackReportsLocalPlugin: RackPluginModule = {
  manifest: {
    id: 'rack-reports-local',
    name: 'Rack Reports',
    version: '0.1.0',
    description:
      'Local package placeholder for export, reporting, and document workflows.',
    requiresAppVersion: '1.0.0',
    defaultEnabled: false,
    origin: 'local-package',
    trustLevel: 'review-required',
    capabilities: ['panels', 'commands', 'layout-read'],
  },
  activate(host) {
    host.registerPanel({
      id: 'rack-reports',
      title: 'Rack Reports',
      workspace: 'portfolio',
      priority: 76,
      defaultPlacement: 'inspector',
      pluginId: 'rack-reports-local',
      render: () => (
        <Suspense fallback={null}>
          <RackReportsPanel />
        </Suspense>
      ),
    });

    host.registerCommand({
      id: 'rack-reports.open',
      title: 'Open Rack Reports',
      subtitle: 'Inspect the local-package reporting workflow stub',
      category: 'Plugins',
      pluginId: 'rack-reports-local',
      run: () => {
        host.openPanel('rack-reports');
      },
    });
  },
};
