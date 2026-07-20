import type { RackPluginModule } from './types';
import { cableManagementPlugin } from './cableManagementPlugin';
import { governanceToolsPlugin } from './governanceToolsPlugin';

export const builtInPlugins: RackPluginModule[] = [
  cableManagementPlugin,
  governanceToolsPlugin,
];

export const builtInPluginManifests = builtInPlugins.map(
  (plugin) => plugin.manifest,
);

export const defaultEnabledPluginIds = builtInPluginManifests
  .filter((plugin) => plugin.defaultEnabled)
  .map((plugin) => plugin.id);
