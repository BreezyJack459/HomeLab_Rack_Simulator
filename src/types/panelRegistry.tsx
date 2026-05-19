import type { ReactNode } from 'react';
import { AlertTriangle, FolderKanban, Monitor, Network, Wrench } from 'lucide-react';
import type { AppPanelId, AppWorkspace, AuditLens, OperateLens, PanelPlacement, PanelRegistryItem, PlanLens, PortfolioLens } from './appShell';

// ── Panel Registry ──────────────────────────────────────────────────────────

export const PANEL_REGISTRY: PanelRegistryItem[] = [
  // Model
  { id: 'property', title: 'Properties', workspace: 'model', priority: 10, defaultPlacement: 'inspector' },
  { id: 'cable-planner', title: 'Cable Planner', workspace: 'model', priority: 20, supportedViewModes: ['2d', 'cables', 'topology'], defaultPlacement: 'inspector' },
  { id: 'port-reservation', title: 'Port Reservations', workspace: 'model', priority: 30, selectionRequired: true, defaultPlacement: 'inspector' },
  { id: 'port-speed', title: 'Port Speeds', workspace: 'model', priority: 40, selectionRequired: true, defaultPlacement: 'inspector' },

  // Audit
  { id: 'rack-health', title: 'Rack Health', workspace: 'audit', priority: 10, defaultPlacement: 'main' },
  { id: 'serviceability', title: 'Serviceability', workspace: 'audit', priority: 20, defaultPlacement: 'inspector' },
  { id: 'validation', title: 'Validation', workspace: 'audit', priority: 30, defaultPlacement: 'inspector' },
  { id: 'documentation-audit', title: 'Documentation Audit', workspace: 'audit', priority: 40, defaultPlacement: 'main' },
  { id: 'rack-debt', title: 'Rack Debt', workspace: 'audit', priority: 50, defaultPlacement: 'main' },
  { id: 'label-debt', title: 'Label Debt', workspace: 'audit', priority: 60, defaultPlacement: 'main' },
  { id: 'thermal-distribution', title: 'Thermal Distribution', workspace: 'audit', priority: 70, defaultPlacement: 'main' },
  { id: 'failure-domain', title: 'Failure Domain', workspace: 'audit', priority: 80, defaultPlacement: 'main' },
  { id: 'drift', title: 'Drift', workspace: 'audit', priority: 90, defaultPlacement: 'main' },
  { id: 'environment', title: 'Environment', workspace: 'audit', priority: 100, defaultPlacement: 'main' },
  { id: 'device-sensor', title: 'Device Sensors', workspace: 'audit', priority: 110, defaultPlacement: 'main' },
  { id: 'power-chain', title: 'Power Chain', workspace: 'audit', priority: 120, defaultPlacement: 'main' },
  { id: 'cable-length-audit', title: 'Cable Length Audit', workspace: 'audit', priority: 130, defaultPlacement: 'main' },

  // Operate
  { id: 'asset-registry', title: 'Asset Registry', workspace: 'operate', priority: 10, defaultPlacement: 'main' },
  { id: 'maintenance-log', title: 'Maintenance Log', workspace: 'operate', priority: 20, defaultPlacement: 'main' },
  { id: 'backup-verification', title: 'Backup Verification', workspace: 'operate', priority: 30, defaultPlacement: 'main' },
  { id: 'firmware-tracker', title: 'Firmware Tracker', workspace: 'operate', priority: 40, defaultPlacement: 'main' },
  { id: 'runbook', title: 'Runbook', workspace: 'operate', priority: 50, defaultPlacement: 'main' },
  { id: 'evidence-locker', title: 'Evidence Locker', workspace: 'operate', priority: 60, defaultPlacement: 'main' },
  { id: 'boot-sequence', title: 'Boot Sequence', workspace: 'operate', priority: 65, defaultPlacement: 'main' },
  { id: 'service-map', title: 'Service Map', workspace: 'operate', priority: 85, defaultPlacement: 'main' },
  { id: 'blast-radius', title: 'Blast Radius', workspace: 'operate', priority: 95, selectionRequired: true, defaultPlacement: 'inspector' },
  { id: 'power-bill', title: 'Power Bill', workspace: 'operate', priority: 70, defaultPlacement: 'main' },
  { id: 'ip-assignment', title: 'IP Assignment', workspace: 'operate', priority: 80, defaultPlacement: 'main' },
  { id: 'spare-parts', title: 'Spare Parts', workspace: 'operate', priority: 90, defaultPlacement: 'main' },
  { id: 'cleaning-schedule', title: 'Cleaning Schedule', workspace: 'operate', priority: 100, defaultPlacement: 'main' },

  // Plan
  { id: 'scenario-planner', title: 'Scenario Planner', workspace: 'plan', priority: 10, defaultPlacement: 'main' },
  { id: 'golden-baseline', title: 'Golden Baseline', workspace: 'plan', priority: 20, defaultPlacement: 'main' },
  { id: 'rack-change-calendar', title: 'Change Calendar', workspace: 'plan', priority: 30, defaultPlacement: 'main' },
  { id: 'migration-summary', title: 'Migration Summary', workspace: 'plan', priority: 40, defaultPlacement: 'main' },
  { id: 'capacity-forecast', title: 'Capacity Forecast', workspace: 'plan', priority: 50, defaultPlacement: 'main' },
  { id: 'reservation', title: 'Reservations', workspace: 'plan', priority: 60, defaultPlacement: 'main' },
  { id: 'build-planner', title: 'Build Planner', workspace: 'plan', priority: 70, defaultPlacement: 'main' },
  { id: 'change-review', title: 'Change Review', workspace: 'plan', priority: 80, defaultPlacement: 'main' },
  { id: 'change-request', title: 'Change Request', workspace: 'plan', priority: 90, defaultPlacement: 'main' },
  { id: 'readiness-checklist', title: 'Readiness Checklist', workspace: 'plan', priority: 100, defaultPlacement: 'main' },
  { id: 'commissioning-checklist', title: 'Commissioning Checklist', workspace: 'plan', priority: 110, defaultPlacement: 'main' },
  { id: 'fit-check', title: 'Fit Check', workspace: 'plan', priority: 120, defaultPlacement: 'main' },
  { id: 'template-quality', title: 'Template Quality', workspace: 'plan', priority: 130, defaultPlacement: 'main' },

  // Portfolio
  { id: 'workspace-manager', title: 'Workspace Manager', workspace: 'portfolio', priority: 10, defaultPlacement: 'main' },
  { id: 'inter-rack-map', title: 'Inter-Rack Map', workspace: 'portfolio', priority: 20, defaultPlacement: 'main' },
  { id: 'room-rack-map', title: 'Room Rack Map', workspace: 'portfolio', priority: 30, defaultPlacement: 'main' },
  { id: 'room-placement', title: 'Room Placement', workspace: 'portfolio', priority: 40, defaultPlacement: 'main' },
  { id: 'portfolio-export', title: 'Portfolio Export', workspace: 'portfolio', priority: 50, defaultPlacement: 'main' },
  { id: 'dcim-import', title: 'DCIM Import', workspace: 'portfolio', priority: 60, defaultPlacement: 'main' },
  { id: 'rack-photo', title: 'Rack Photos', workspace: 'portfolio', priority: 70, defaultPlacement: 'inspector' },
  { id: 'policy-rules', title: 'Policy Rules', workspace: 'portfolio', priority: 80, defaultPlacement: 'inspector' },
  { id: 'homelab-guide', title: 'Homelab Guide', workspace: 'portfolio', priority: 90, defaultPlacement: 'inspector' },
];

// ── Workspace Metadata ──────────────────────────────────────────────────────

export const WORKSPACE_META: Record<AppWorkspace, { title: string; description: string; icon: ReactNode }> = {
  model: {
    title: 'Model workspace',
    description: 'Edit rack geometry, inspect the current selection and keep the canvas front and center.',
    icon: <Monitor size={16} />,
  },
  operate: {
    title: 'Operate workspace',
    description: 'Track day-to-day operational records like assets, maintenance, firmware and backup evidence.',
    icon: <Wrench size={16} />,
  },
  audit: {
    title: 'Audit workspace',
    description: 'Review layout health, risks and validation issues without digging through one giant sidebar.',
    icon: <AlertTriangle size={16} />,
  },
  plan: {
    title: 'Plan workspace',
    description: 'Compare scenarios, baselines and change windows from a planning-first surface.',
    icon: <Network size={16} />,
  },
  portfolio: {
    title: 'Portfolio workspace',
    description: 'Manage workspace-wide rack context, inter-rack links, room placement and import/export flows.',
    icon: <FolderKanban size={16} />,
  },
};

// ── Lens → Panel ID Mappings ────────────────────────────────────────────────

export const auditPanelIdsByLens: Record<AuditLens, AppPanelId[]> = {
  overview: ['rack-health', 'documentation-audit', 'rack-debt', 'label-debt', 'thermal-distribution', 'failure-domain', 'drift', 'environment', 'device-sensor', 'power-chain', 'cable-length-audit'],
  issues: ['rack-health', 'rack-debt', 'documentation-audit', 'label-debt'],
  serviceability: ['rack-health', 'thermal-distribution', 'power-chain'],
  documentation: ['documentation-audit', 'label-debt', 'drift', 'rack-debt', 'cable-length-audit'],
  thermal: ['thermal-distribution', 'environment', 'device-sensor', 'power-chain', 'rack-health'],
  domains: ['failure-domain', 'rack-debt', 'drift', 'documentation-audit'],
};

export const operatePanelIdsByLens: Record<OperateLens, AppPanelId[]> = {
  assets: ['asset-registry', 'spare-parts'],
  maintenance: ['maintenance-log', 'cleaning-schedule'],
  firmware: ['firmware-tracker', 'boot-sequence'],
  network: ['ip-assignment', 'service-map'],
  evidence: ['evidence-locker', 'backup-verification'],
  power: ['power-bill', 'runbook'],
};

export const planPanelIdsByLens: Record<PlanLens, AppPanelId[]> = {
  scenarios: ['scenario-planner', 'capacity-forecast'],
  baseline: ['golden-baseline', 'migration-summary', 'template-quality'],
  schedule: ['rack-change-calendar', 'reservation'],
  changes: ['change-request', 'change-review'],
  build: ['build-planner', 'readiness-checklist', 'commissioning-checklist'],
  fit: ['fit-check'],
};

export const portfolioPanelIdsByLens: Record<PortfolioLens, AppPanelId[]> = {
  overview: ['workspace-manager', 'portfolio-export'],
  rooms: ['room-rack-map', 'room-placement'],
  interconnect: ['inter-rack-map'],
  data: ['dcim-import'],
  policy: ['policy-rules'],
  guide: ['homelab-guide', 'rack-photo'],
};
