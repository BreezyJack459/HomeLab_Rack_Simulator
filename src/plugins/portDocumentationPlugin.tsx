import { portDocumentationManifest } from './builtInPluginManifests';
import { lazy } from 'react';
import type { RackPluginModule } from './types';

const PortLabelWorkspace = lazy(() =>
  import('../components/PortLabelWorkspace'),
);

export const portDocumentationPlugin: RackPluginModule = {
  manifest: portDocumentationManifest,
  activate(host) {
    host.registerViewMode({
      id: 'port-labels',
      label: 'Port Labels',
      order: 35,
      render: (layout) => (
        <PortLabelWorkspace layout={layout} />
      ),
    });
  },
};
