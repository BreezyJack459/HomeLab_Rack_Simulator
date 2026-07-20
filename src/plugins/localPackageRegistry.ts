import { rackReportsLocalPlugin } from './rackReportsLocalPlugin';
import type { RackPluginModule } from './types';

export type LocalPackageAdapter = {
  loaderKey: string;
  label: string;
  module: RackPluginModule;
};

const localPackageRegistry: Record<string, LocalPackageAdapter> = {
  'rack-reports-local': {
    loaderKey: 'rack-reports-local',
    label: 'Rack Reports Host Adapter',
    module: rackReportsLocalPlugin,
  },
};

export function getLocalPackageAdapter(loaderKey?: string) {
  if (!loaderKey) {
    return undefined;
  }

  return localPackageRegistry[loaderKey];
}
