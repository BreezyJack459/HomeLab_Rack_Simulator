import { useEffect, useMemo, useState } from 'react';
import { builtInPlugins, builtInPluginManifests, loadBuiltInPlugin } from './builtInPlugins';
import type { RackPluginModule } from './types';

export function useBuiltInPlugins(enabledPluginIds: string[]) {
  const [loaded, setLoaded] = useState<Record<string, RackPluginModule>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setErrors({});
    for (const manifest of builtInPluginManifests) {
      if (!enabledPluginIds.includes(manifest.id)) continue;
      void loadBuiltInPlugin(manifest.id).then((plugin) => {
        if (!cancelled && plugin) {
          setLoaded((previous) => previous[manifest.id] === plugin
            ? previous
            : { ...previous, [manifest.id]: plugin });
        }
      }).catch(() => {
        if (!cancelled) {
          setErrors((previous) => ({
            ...previous,
            [manifest.id]: `Could not load ${manifest.name}. Disable and enable it to retry.`,
          }));
        }
      });
    }
    return () => { cancelled = true; };
  }, [enabledPluginIds]);

  // Catalog order is stable regardless of download completion order. The host
  // still filters enabled ids, including cached packs that have been disabled.
  const plugins = useMemo(() => [
    ...builtInPlugins,
    ...builtInPluginManifests.flatMap((manifest) => loaded[manifest.id] ? [loaded[manifest.id]] : []),
  ], [loaded]);
  const pendingPluginIds = builtInPluginManifests.filter((manifest) =>
    enabledPluginIds.includes(manifest.id) && !plugins.some((plugin) => plugin.manifest.id === manifest.id) && !errors[manifest.id],
  ).map((manifest) => manifest.id);
  const loadError = builtInPluginManifests
    .filter((manifest) => enabledPluginIds.includes(manifest.id))
    .map((manifest) => errors[manifest.id]).filter(Boolean).join(' ');
  return { plugins, loadError, pendingPluginIds };
}
