import type { PluginCatalogEntry } from '../pluginCatalog';

export const localPluginCatalogEntry: PluginCatalogEntry = {
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
  activationMode: 'manifest-only',
  installState: 'cataloged',
  loaderKey: 'rack-reports-local',
  statusNote:
    'Package manifest discovered locally. Execution is not enabled until the local-package loader is implemented.',
};
