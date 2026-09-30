import type { RackPluginModule } from './types';
import { cableManagementPlugin } from './cableManagementPlugin';
import { governanceToolsPlugin } from './governanceToolsPlugin';
import {
  operationsPackManifest,
  planningPackManifest,
  fleetPackManifest,
  portDocumentationManifest,
  cableLabelsManifest,
} from './builtInPluginManifests';

// Only default workflows are executable synchronously.
export const builtInPlugins: RackPluginModule[] = [
  cableManagementPlugin,
  governanceToolsPlugin,
];

const lazyBuiltIns = [
  { manifest: operationsPackManifest, load: () => import('./operationsPackPlugin').then((m) => m.operationsPackPlugin) },
  { manifest: planningPackManifest, load: () => import('./planningPackPlugin').then((m) => m.planningPackPlugin) },
  { manifest: fleetPackManifest, load: () => import('./fleetPackPlugin').then((m) => m.fleetPackPlugin) },
  { manifest: portDocumentationManifest, load: () => import('./portDocumentationPlugin').then((m) => m.portDocumentationPlugin) },
  { manifest: cableLabelsManifest, load: () => import('./cableLabelsPlugin').then(m => m.cableLabelsPlugin) },
];

export const builtInPluginManifests = [
  ...builtInPlugins.map((plugin) => plugin.manifest),
  ...lazyBuiltIns.map((plugin) => plugin.manifest),
];

export const defaultEnabledPluginIds = builtInPluginManifests
  .filter((plugin) => plugin.defaultEnabled)
  .map((plugin) => plugin.id);

// Keep the existing returning-user migration limited to workspace packs.
export const builtInPackPluginIds = [
  operationsPackManifest.id,
  planningPackManifest.id,
  fleetPackManifest.id,
];

const loads = new Map<string, Promise<RackPluginModule>>();

// Closed allowlist: neither catalog metadata nor local package ids can supply code.
export const loadBuiltInPlugin = (id: string): Promise<RackPluginModule | undefined> => {
  const entry = lazyBuiltIns.find((plugin) => plugin.manifest.id === id);
  if (!entry) return Promise.resolve(undefined);
  let pending = loads.get(id);
  if (!pending) {
    pending = entry.load().catch((error: unknown) => {
      loads.delete(id); // Allow a later enable to retry a failed download.
      throw error;
    });
    loads.set(id, pending);
  }
  return pending;
};
