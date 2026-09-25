import type { RackPluginManifest } from './types';

// Data only: catalog and preference migration must not import executable packs.
export const operationsPackManifest: RackPluginManifest = {
  id: 'operations-pack',
  name: 'Operations Pack',
  version: '1.0.0',
  description:
    'Run operations workspace: assets, maintenance, firmware, network, evidence and power tracking',
  requiresAppVersion: '1.0.0',
  defaultEnabled: false,
  origin: 'built-in',
  trustLevel: 'trusted',
  capabilities: ['workspaces', 'panels', 'layout-read'],
};

export const planningPackManifest: RackPluginManifest = {
  id: 'planning-pack',
  name: 'Planning Pack',
  version: '1.0.0',
  description:
    'Plan changes workspace: scenarios, baselines, change windows and build readiness',
  requiresAppVersion: '1.0.0',
  defaultEnabled: false,
  origin: 'built-in',
  trustLevel: 'trusted',
  capabilities: ['workspaces', 'panels', 'layout-read'],
};

export const fleetPackManifest: RackPluginManifest = {
  id: 'fleet-pack',
  name: 'Fleet Pack',
  version: '1.0.0',
  description:
    'Manage fleet workspace: multi-rack context, rooms, inter-rack links and import/export flows',
  requiresAppVersion: '1.0.0',
  defaultEnabled: false,
  origin: 'built-in',
  trustLevel: 'trusted',
  capabilities: [
    'workspaces',
    'panels',
    'commands',
    'toolbar-actions',
    'layout-read',
  ],
};

export const portDocumentationManifest: RackPluginManifest = {
  id: 'port-labels',
  name: 'Port Labels',
  version: '1.0.0',
  description: 'Label switch ports',
  requiresAppVersion: '1.0.0',
  defaultEnabled: false,
  origin: 'built-in',
  trustLevel: 'trusted',
  capabilities: [
    'view-modes',
    'layout-read',
  ],
};
