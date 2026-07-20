import { lazy, Suspense } from 'react';
import type { RackPluginModule } from './types';

const PolicyRulesPanel = lazy(() =>
  import('../components/PolicyRulesPanel').then((m) => ({
    default: m.PolicyRulesPanel,
  })),
);
const HomelabGuidePanel = lazy(() =>
  import('../components/HomelabGuidePanel').then((m) => ({
    default: m.HomelabGuidePanel,
  })),
);

export const governanceToolsPlugin: RackPluginModule = {
  manifest: {
    id: 'governance-tools',
    name: 'Governance Tools',
    version: '1.0.0',
    description: 'Policy and guidance workflows for standards, naming, and operating rules',
    requiresAppVersion: '1.0.0',
    defaultEnabled: true,
    origin: 'built-in',
    trustLevel: 'trusted',
    capabilities: ['panels', 'layout-read'],
  },
  activate(host) {
    host.registerPanel({
      id: 'policy-rules',
      title: 'Policy Rules',
      workspace: 'portfolio',
      priority: 80,
      defaultPlacement: 'inspector',
      pluginId: 'governance-tools',
      render: () => (
        <Suspense fallback={null}>
          <PolicyRulesPanel />
        </Suspense>
      ),
    });

    host.registerPanel({
      id: 'homelab-guide',
      title: 'Homelab Guide',
      workspace: 'portfolio',
      priority: 90,
      defaultPlacement: 'inspector',
      pluginId: 'governance-tools',
      render: () => (
        <Suspense fallback={null}>
          <HomelabGuidePanel />
        </Suspense>
      ),
    });
  },
};
