import { builtInPluginManifests } from './builtInPlugins';
import { getLocalPackageAdapter } from './localPackageRegistry';
import type { RackPluginManifest } from './types';

export type PluginCatalogEntry = {
  manifest: RackPluginManifest;
  activationMode: 'hosted' | 'manifest-only';
  installState: 'installed' | 'cataloged';
  statusNote?: string;
  loaderKey?: string;
};

type LocalPluginCatalogModule = {
  localPluginCatalogEntry: PluginCatalogEntry;
};

export type PluginRuntimeStatus =
  | 'active'
  | 'available'
  | 'cataloged'
  | 'reviewed'
  | 'incompatible';

export type PluginCatalogState = {
  canToggle: boolean;
  runtimeStatus: PluginRuntimeStatus;
  summary: string;
};

const discoveredLocalPluginModules = import.meta.glob(
  './local-manifests/*.manifest.ts',
  { eager: true },
) as Record<string, LocalPluginCatalogModule>;

export const localPackageCatalog: PluginCatalogEntry[] = Object.values(
  discoveredLocalPluginModules,
).map((module) => module.localPluginCatalogEntry);

export const pluginCatalogEntries: PluginCatalogEntry[] = [
  ...builtInPluginManifests.map((manifest) => ({
    manifest,
    activationMode: 'hosted' as const,
    installState: 'installed' as const,
  })),
  ...localPackageCatalog,
];

export function getPluginCatalogState(args: {
  entry: PluginCatalogEntry;
  enabledPluginIds: string[];
  approvedLocalPluginIds: string[];
  incompatibleReasons: Record<string, string>;
}): PluginCatalogState {
  const {
    entry,
    enabledPluginIds,
    approvedLocalPluginIds,
    incompatibleReasons,
  } = args;
  const incompatibleReason = incompatibleReasons[entry.manifest.id];

  if (incompatibleReason) {
    return {
      canToggle: false,
      runtimeStatus: 'incompatible',
      summary: incompatibleReason,
    };
  }

  if (entry.activationMode !== 'hosted') {
    const reviewed = approvedLocalPluginIds.includes(entry.manifest.id);
    const adapter = getLocalPackageAdapter(entry.loaderKey);
    return {
      canToggle: false,
      runtimeStatus: reviewed ? 'reviewed' : 'cataloged',
      summary:
        reviewed
          ? adapter
            ? `Package manifest has been reviewed. ${adapter.label} is ready to promote it on the next activation pass.`
            : 'Package manifest has been reviewed and approved. Activation still requires the local-package loader.'
          : adapter
            ? `Local package is cataloged. ${adapter.label} is registered, but review approval is still required before activation.`
          : entry.statusNote ??
            'Local package is cataloged but cannot be activated until the loader is available.',
    };
  }

  if (enabledPluginIds.includes(entry.manifest.id)) {
    return {
      canToggle: true,
      runtimeStatus: 'active',
      summary: 'This workflow is active and available across the shell.',
    };
  }

  return {
    canToggle: true,
    runtimeStatus: 'available',
    summary: 'This workflow is installed but currently hidden from the shell.',
  };
}
