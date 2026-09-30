import { lazy } from 'react';
import { Tags } from 'lucide-react';
import { cableLabelsManifest } from './builtInPluginManifests';
import type { RackPluginModule } from './types';
const CableLabels = lazy(() => import('../components/CableLabelPanel').then(m => ({ default: m.CableLabelPanel })));
export const cableLabelsPlugin: RackPluginModule = {
  manifest: cableLabelsManifest,
  activate(host) {
    host.registerViewMode({ id: 'cable-labels', label: 'Cable Labels', order: 36, icon: <Tags size={14} />, render: () => <CableLabels /> });
    host.registerCommand({ id: 'cable-labels.open', title: 'Open Cable Labels', subtitle: 'Copy cable endpoint labels for your printer', category: 'Advanced panels', run: () => host.setViewMode('cable-labels') });
  },
};
