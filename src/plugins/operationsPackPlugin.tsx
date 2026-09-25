import { operationsPackManifest } from './builtInPluginManifests';
import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Briefcase, Wrench } from 'lucide-react';
import { useRackStore } from '../store/rackStore';
import type { AppPanelId, OperateLens } from '../types/appShell';
import { PANEL_REGISTRY } from '../types/panelRegistry';
import type {
  LensContribution,
  PluginPanelDefinition,
  RackPluginModule,
} from './types';

const AssetRegistryPanel = lazy(() =>
  import('../components/AssetRegistryPanel').then((m) => ({
    default: m.AssetRegistryPanel,
  })),
);
const MaintenanceLogPanel = lazy(() =>
  import('../components/MaintenanceLogPanel').then((m) => ({
    default: m.MaintenanceLogPanel,
  })),
);
const BackupVerificationPanel = lazy(() =>
  import('../components/BackupVerificationPanel').then((m) => ({
    default: m.BackupVerificationPanel,
  })),
);
const FirmwareTrackerPanel = lazy(() =>
  import('../components/FirmwareTrackerPanel').then((m) => ({
    default: m.FirmwareTrackerPanel,
  })),
);
const RunbookPanel = lazy(() =>
  import('../components/RunbookPanel').then((m) => ({
    default: m.RunbookPanel,
  })),
);
const EvidenceLockerPanel = lazy(() =>
  import('../components/EvidenceLockerPanel').then((m) => ({
    default: m.EvidenceLockerPanel,
  })),
);
const PowerBillPanel = lazy(() =>
  import('../components/PowerBillPanel').then((m) => ({
    default: m.PowerBillPanel,
  })),
);
const IpAssignmentPanel = lazy(() =>
  import('../components/IpAssignmentPanel').then((m) => ({
    default: m.IpAssignmentPanel,
  })),
);
const SparePartsPanel = lazy(() =>
  import('../components/SparePartsPanel').then((m) => ({
    default: m.SparePartsPanel,
  })),
);
const CleaningSchedulePanel = lazy(() =>
  import('../components/CleaningSchedulePanel').then((m) => ({
    default: m.CleaningSchedulePanel,
  })),
);
const BootSequencePanel = lazy(() =>
  import('../components/BootSequencePanel').then((m) => ({
    default: m.BootSequencePanel,
  })),
);
const ServiceMapPanel = lazy(() =>
  import('../components/ServiceMapPanel').then((m) => ({
    default: m.ServiceMapPanel,
  })),
);
const BlastRadiusPanel = lazy(() =>
  import('../components/BlastRadiusPanel').then((m) => ({
    default: m.BlastRadiusPanel,
  })),
);
const OperateWorkbench = lazy(() =>
  import('../components/OperateWorkbench').then((m) => ({
    default: m.OperateWorkbench,
  })),
);

const PLUGIN_ID = operationsPackManifest.id;

const operatePanels: Array<{ id: AppPanelId; render: () => ReactNode }> = [
  {
    id: 'asset-registry',
    render: () => (
      <Suspense fallback={null}>
        <AssetRegistryPanel />
      </Suspense>
    ),
  },
  {
    id: 'maintenance-log',
    render: () => (
      <Suspense fallback={null}>
        <MaintenanceLogPanel />
      </Suspense>
    ),
  },
  {
    id: 'backup-verification',
    render: () => (
      <Suspense fallback={null}>
        <BackupVerificationPanel />
      </Suspense>
    ),
  },
  {
    id: 'firmware-tracker',
    render: () => (
      <Suspense fallback={null}>
        <FirmwareTrackerPanel />
      </Suspense>
    ),
  },
  {
    id: 'runbook',
    render: () => (
      <Suspense fallback={null}>
        <RunbookPanel />
      </Suspense>
    ),
  },
  {
    id: 'evidence-locker',
    render: () => (
      <Suspense fallback={null}>
        <EvidenceLockerPanel />
      </Suspense>
    ),
  },
  {
    id: 'boot-sequence',
    render: () => (
      <Suspense fallback={null}>
        <BootSequencePanel />
      </Suspense>
    ),
  },
  {
    id: 'service-map',
    render: () => (
      <Suspense fallback={null}>
        <ServiceMapPanel />
      </Suspense>
    ),
  },
  {
    id: 'blast-radius',
    render: () => (
      <Suspense fallback={null}>
        <BlastRadiusPanel />
      </Suspense>
    ),
  },
  {
    id: 'power-bill',
    render: () => (
      <Suspense fallback={null}>
        <PowerBillPanel />
      </Suspense>
    ),
  },
  {
    id: 'ip-assignment',
    render: () => (
      <Suspense fallback={null}>
        <IpAssignmentPanel />
      </Suspense>
    ),
  },
  {
    id: 'spare-parts',
    render: () => (
      <Suspense fallback={null}>
        <SparePartsPanel />
      </Suspense>
    ),
  },
  {
    id: 'cleaning-schedule',
    render: () => (
      <Suspense fallback={null}>
        <CleaningSchedulePanel />
      </Suspense>
    ),
  },
];

const operateLenses: LensContribution[] = [
  { id: 'assets', label: 'Assets', panelIds: ['asset-registry', 'spare-parts'] },
  { id: 'maintenance', label: 'Maintenance', panelIds: ['maintenance-log', 'cleaning-schedule'] },
  { id: 'firmware', label: 'Firmware', panelIds: ['firmware-tracker', 'boot-sequence'] },
  { id: 'network', label: 'Network', panelIds: ['ip-assignment', 'service-map'] },
  { id: 'evidence', label: 'Evidence', panelIds: ['evidence-locker', 'backup-verification'] },
  { id: 'power', label: 'Power', panelIds: ['power-bill', 'runbook'] },
];

function toPanelDefinition(entry: {
  id: AppPanelId;
  render: () => ReactNode;
}): PluginPanelDefinition {
  const meta = PANEL_REGISTRY.find((panel) => panel.id === entry.id);
  if (!meta) {
    throw new Error(`Missing panel registry entry for ${entry.id}`);
  }
  return { ...meta, pluginId: PLUGIN_ID, render: entry.render };
}

function OperateWorkbenchMount({
  lens,
  selectLens,
}: {
  lens: string;
  selectLens: (lens: string) => void;
}) {
  const layout = useRackStore((state) => state.layout);
  return (
    <Suspense fallback={null}>
      <OperateWorkbench
        layout={layout}
        currentLens={lens as OperateLens}
        onSelectLens={selectLens}
      />
    </Suspense>
  );
}

export const operationsPackPlugin: RackPluginModule = {
  manifest: operationsPackManifest,
  activate(host) {
    operatePanels.forEach((entry) =>
      host.registerPanel(toPanelDefinition(entry)),
    );

    host.registerWorkspace({
      id: 'operate',
      title: 'Run operations',
      description:
        'Track day-to-day operational records like assets, maintenance, firmware and backup evidence.',
      icon: <Wrench size={16} />,
      nav: {
        label: 'Run',
        shortLabel: 'Ops',
        description: 'Track asset, maintenance and backup data',
        accent: 'from-emerald-500/25 to-teal-500/10',
      },
      lenses: operateLenses,
      renderWorkbench: (lens, selectLens) => (
        <OperateWorkbenchMount lens={lens} selectLens={selectLens} />
      ),
    });
  },
};
