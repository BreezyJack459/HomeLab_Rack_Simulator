import { getLocalPackageAdapter } from './localPackageRegistry';
import type { PluginCatalogEntry } from './pluginCatalog';
import type { RackPluginModule } from './types';

export function getHostedPluginIds(catalogEntries: PluginCatalogEntry[]) {
  return catalogEntries
    .filter((entry) => entry.activationMode === 'hosted')
    .map((entry) => entry.manifest.id);
}

export function sanitizeEnabledPluginIds(args: {
  catalogEntries: PluginCatalogEntry[];
  enabledPluginIds: string[];
}) {
  const { catalogEntries, enabledPluginIds } = args;
  const hostedPluginIds = new Set(getHostedPluginIds(catalogEntries));

  return enabledPluginIds.filter((pluginId) => hostedPluginIds.has(pluginId));
}

export function resolveLocalPackagePlugins(args: {
  catalogEntries: PluginCatalogEntry[];
  approvedLocalPluginIds: string[];
}) {
  const { catalogEntries, approvedLocalPluginIds } = args;

  const loadablePlugins: RackPluginModule[] = [];
  const upgradedEntries = catalogEntries.map((entry) => {
    if (
      entry.manifest.origin !== 'local-package' ||
      !approvedLocalPluginIds.includes(entry.manifest.id)
    ) {
      return entry;
    }

    const adapter = getLocalPackageAdapter(entry.loaderKey);
    if (!adapter) {
      return {
        ...entry,
        statusNote:
          'Package was reviewed, but no host adapter has been registered for this local package yet.',
      };
    }

    loadablePlugins.push(adapter.module as RackPluginModule);
    return {
      ...entry,
      activationMode: 'hosted' as const,
      installState: 'installed' as const,
      statusNote:
        `Package was reviewed and promoted through ${adapter.label}.`,
    };
  });

  return {
    catalogEntries: upgradedEntries,
    loadablePlugins,
  };
}
