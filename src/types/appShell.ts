import type { ViewMode } from './rack';

export type AppWorkspace = 'model' | 'operate' | 'audit' | 'plan' | 'portfolio';

export type PanelPlacement = 'main' | 'inspector';

export type AuditLens = 'overview' | 'issues' | 'serviceability' | 'documentation' | 'thermal' | 'domains';

export type OperateLens = 'assets' | 'maintenance' | 'firmware' | 'network' | 'evidence' | 'power';

export type PlanLens = 'scenarios' | 'baseline' | 'schedule' | 'changes' | 'build' | 'fit';

export type PortfolioLens = 'overview' | 'rooms' | 'interconnect' | 'data' | 'policy' | 'guide';

export type BottomTrayView = 'issues' | 'activity';

export type AppPanelId =
  | 'property'
  | 'cable-planner'
  | 'port-reservation'
  | 'port-speed'
  | 'rack-health'
  | 'serviceability'
  | 'validation'
  | 'documentation-audit'
  | 'rack-debt'
  | 'label-debt'
  | 'thermal-distribution'
  | 'failure-domain'
  | 'drift'
  | 'environment'
  | 'device-sensor'
  | 'power-chain'
  | 'asset-registry'
  | 'maintenance-log'
  | 'backup-verification'
  | 'firmware-tracker'
  | 'runbook'
  | 'evidence-locker'
  | 'power-bill'
  | 'ip-assignment'
  | 'spare-parts'
  | 'cleaning-schedule'
  | 'scenario-planner'
  | 'golden-baseline'
  | 'rack-change-calendar'
  | 'migration-summary'
  | 'capacity-forecast'
  | 'reservation'
  | 'build-planner'
  | 'change-review'
  | 'change-request'
  | 'boot-sequence'
  | 'service-map'
  | 'blast-radius'
  | 'cable-length-audit'
  | 'readiness-checklist'
  | 'commissioning-checklist'
  | 'fit-check'
  | 'template-quality'
  | 'workspace-manager'
  | 'inter-rack-map'
  | 'room-rack-map'
  | 'room-placement'
  | 'portfolio-export'
  | 'dcim-import'
  | 'rack-photo'
  | 'policy-rules'
  | 'homelab-guide'
  | 'depth-compatibility';

export type PanelRegistryItem = {
  id: AppPanelId;
  title: string;
  workspace: AppWorkspace;
  priority: number;
  selectionRequired?: boolean;
  supportedViewModes?: ViewMode[];
  defaultPlacement: PanelPlacement;
};
