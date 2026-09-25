import { fleetPackManifest } from './builtInPluginManifests';
import { lazy, Suspense, useMemo } from 'react';
import type { ReactNode } from 'react';
import { FolderKanban } from 'lucide-react';
import { create } from 'zustand';
import { WorkspaceActionPanel } from '../components/WorkspaceActionPanel';
import { useRackStore } from '../store/rackStore';
import type { AppPanelId, PortfolioLens } from '../types/appShell';
import { PANEL_REGISTRY } from '../types/panelRegistry';
import type {
  LensContribution,
  PluginPanelDefinition,
  RackPluginModule,
} from './types';

const WorkspaceManager = lazy(() =>
  import('../components/WorkspaceManager').then((m) => ({
    default: m.WorkspaceManager,
  })),
);
const InterRackMap = lazy(() =>
  import('../components/InterRackMap').then((m) => ({
    default: m.InterRackMap,
  })),
);
const RoomRackMapPanel = lazy(() =>
  import('../components/RoomRackMapPanel').then((m) => ({
    default: m.RoomRackMapPanel,
  })),
);
const RoomPlacementPanel = lazy(() =>
  import('../components/RoomPlacementPanel').then((m) => ({
    default: m.RoomPlacementPanel,
  })),
);
const PortfolioExportPanel = lazy(() =>
  import('../components/PortfolioExportPanel').then((m) => ({
    default: m.PortfolioExportPanel,
  })),
);
const DcimImportPanel = lazy(() =>
  import('../components/DcimImportPanel').then((m) => ({
    default: m.DcimImportPanel,
  })),
);
const RackPhotoPanel = lazy(() =>
  import('../components/RackPhotoPanel').then((m) => ({
    default: m.RackPhotoPanel,
  })),
);
const PortfolioWorkbench = lazy(() =>
  import('../components/PortfolioWorkbench').then((m) => ({
    default: m.PortfolioWorkbench,
  })),
);
const InterRackCableWizard = lazy(() =>
  import('../components/InterRackCableWizard').then((m) => ({
    default: m.InterRackCableWizard,
  })),
);

const PLUGIN_ID = fleetPackManifest.id;

// UI state owned by the pack (wizard visibility), opened via its toolbar
// action, commands and the inter-rack map's add-cable button.
const useFleetPackUiStore = create<{
  interRackWizardOpen: boolean;
  setInterRackWizardOpen: (open: boolean) => void;
}>((set) => ({
  interRackWizardOpen: false,
  setInterRackWizardOpen: (open) => set({ interRackWizardOpen: open }),
}));

const openInterRackWizard = () =>
  useFleetPackUiStore.getState().setInterRackWizardOpen(true);

const exportWorkspaceJson = () => {
  void import('../utils/exporters').then(({ downloadWorkspaceJson }) =>
    downloadWorkspaceJson(useRackStore.getState().workspace),
  );
};

const importWorkspaceJson = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    void (async () => {
      try {
        const { importWorkspaceJson: parseWorkspace } = await import(
          '../utils/exporters'
        );
        const text = await file.text();
        const importedWorkspace = parseWorkspace(text);
        if (!importedWorkspace) {
          useRackStore.setState({
            statusMessage: 'Invalid workspace JSON file.',
          });
          return;
        }
        const success = useRackStore.getState().setWorkspace(importedWorkspace);
        if (!success) {
          useRackStore.setState({ statusMessage: 'Workspace has no racks.' });
        }
      } catch {
        useRackStore.setState({
          statusMessage: 'Failed to read workspace file.',
        });
      }
    })();
  };
  input.click();
};

const exportMigrationPlan = () => {
  void import('../utils/exporters').then(({ exportMigrationPlanMarkdown }) =>
    exportMigrationPlanMarkdown(useRackStore.getState().layout),
  );
};

const fleetPanels: Array<{ id: AppPanelId; render: () => ReactNode }> = [
  {
    id: 'workspace-manager',
    render: () => (
      <Suspense fallback={null}>
        <WorkspaceManager />
      </Suspense>
    ),
  },
  {
    id: 'inter-rack-map',
    render: () => (
      <Suspense fallback={null}>
        <InterRackMap onAddCable={openInterRackWizard} />
      </Suspense>
    ),
  },
  {
    id: 'room-rack-map',
    render: () => (
      <Suspense fallback={null}>
        <RoomRackMapPanel />
      </Suspense>
    ),
  },
  {
    id: 'room-placement',
    render: () => (
      <Suspense fallback={null}>
        <RoomPlacementPanel />
      </Suspense>
    ),
  },
  {
    id: 'portfolio-export',
    render: () => (
      <Suspense fallback={null}>
        <PortfolioExportPanel />
      </Suspense>
    ),
  },
  {
    id: 'dcim-import',
    render: () => (
      <Suspense fallback={null}>
        <DcimImportPanel />
      </Suspense>
    ),
  },
  {
    id: 'rack-photo',
    render: () => (
      <Suspense fallback={null}>
        <RackPhotoPanel />
      </Suspense>
    ),
  },
];

const fleetLenses: LensContribution[] = [
  { id: 'overview', label: 'Overview', panelIds: ['workspace-manager', 'portfolio-export'] },
  { id: 'rooms', label: 'Rooms', panelIds: ['room-rack-map', 'room-placement'] },
  { id: 'interconnect', label: 'Interconnect', panelIds: ['inter-rack-map'] },
  { id: 'data', label: 'Data', panelIds: ['dcim-import'] },
  { id: 'policy', label: 'Policy', panelIds: ['policy-rules'] },
  { id: 'guide', label: 'Guide', panelIds: ['homelab-guide', 'rack-photo'] },
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

function FleetWorkbenchMount({
  lens,
  selectLens,
}: {
  lens: string;
  selectLens: (lens: string) => void;
}) {
  const layout = useRackStore((state) => state.layout);
  const workspace = useRackStore((state) => state.workspace);
  const wizardOpen = useFleetPackUiStore(
    (state) => state.interRackWizardOpen,
  );
  const setWizardOpen = useFleetPackUiStore(
    (state) => state.setInterRackWizardOpen,
  );
  return (
    <>
      <Suspense fallback={null}>
        <PortfolioWorkbench
          workspace={workspace}
          layout={layout}
          currentLens={lens as PortfolioLens}
          onSelectLens={selectLens}
        />
      </Suspense>
      <Suspense fallback={null}>
        <InterRackCableWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
        />
      </Suspense>
    </>
  );
}

function FleetInspector({
  selectLens,
}: {
  selectLens: (lens: string) => void;
}) {
  const workspace = useRackStore((state) => state.workspace);
  const deviceCount = useMemo(
    () => workspace.racks.reduce((sum, rack) => sum + rack.devices.length, 0),
    [workspace.racks],
  );
  const interRackCount = workspace.interRackCables?.length ?? 0;

  return (
    <WorkspaceActionPanel
      badge="Fleet shortcuts"
      title="Keep fleet tools lean"
      description="Use the inspector for navigation and workspace-wide actions, while the main area holds the broader fleet overview."
      metrics={[
        { label: 'Racks', value: `${workspace.racks.length}` },
        { label: 'Devices', value: `${deviceCount}` },
        { label: 'Links', value: `${interRackCount}` },
      ]}
      actions={[
        {
          label: 'Overview lens',
          detail: 'Jump back to the workspace overview.',
          onClick: () => selectLens('overview'),
          primary: true,
        },
        {
          label: 'Rooms lens',
          detail: 'Place racks in physical room layouts.',
          onClick: () => selectLens('rooms'),
        },
        {
          label: 'Interconnect lens',
          detail: 'Map cross-rack cabling and trunk links.',
          onClick: () => selectLens('interconnect'),
        },
        {
          label: 'Data lens',
          detail: 'Import or export DCIM data.',
          onClick: () => selectLens('data'),
        },
        {
          label: 'Policy lens',
          detail: 'Review naming, compliance and standards.',
          onClick: () => selectLens('policy'),
        },
        {
          label: 'Guide lens',
          detail: 'Open guide and photo documentation tools.',
          onClick: () => selectLens('guide'),
        },
        {
          label: 'Add inter-rack cable',
          detail: 'Open the wizard for a new cross-rack link.',
          onClick: openInterRackWizard,
        },
        {
          label: 'Export workspace',
          detail: 'Download the current workspace JSON snapshot.',
          onClick: exportWorkspaceJson,
        },
      ]}
    />
  );
}

export const fleetPackPlugin: RackPluginModule = {
  manifest: fleetPackManifest,
  activate(host) {
    fleetPanels.forEach((entry) =>
      host.registerPanel(toPanelDefinition(entry)),
    );

    host.registerWorkspace({
      id: 'portfolio',
      title: 'Manage fleet',
      description:
        'Manage workspace-wide rack context, inter-rack links, room placement and import/export flows.',
      icon: <FolderKanban size={16} />,
      nav: {
        label: 'Fleet',
        shortLabel: 'Rooms',
        description: 'Manage workspace, rooms and inter-rack links',
        accent: 'from-rose-500/20 to-fuchsia-500/10',
      },
      lenses: fleetLenses,
      renderWorkbench: (lens, selectLens) => (
        <FleetWorkbenchMount lens={lens} selectLens={selectLens} />
      ),
      renderInspector: (_lens, selectLens) => (
        <FleetInspector selectLens={selectLens} />
      ),
    });

    host.registerToolbarAction({
      id: 'fleet.add-inter-rack-cable',
      label: 'Add inter-rack cable',
      pluginId: PLUGIN_ID,
      run: openInterRackWizard,
    });

    host.registerCommand({
      id: 'fleet.add-inter-rack-cable',
      title: 'Add inter-rack cable',
      subtitle: 'Open the wizard for a new cross-rack link',
      category: 'Fleet',
      pluginId: PLUGIN_ID,
      run: openInterRackWizard,
    });

    host.registerCommand({
      id: 'fleet.export-workspace',
      title: 'Export workspace JSON',
      subtitle: 'Download the current workspace snapshot',
      category: 'Fleet',
      pluginId: PLUGIN_ID,
      run: exportWorkspaceJson,
    });

    host.registerCommand({
      id: 'fleet.import-workspace',
      title: 'Import workspace JSON',
      subtitle: 'Load a workspace snapshot from a JSON file',
      category: 'Fleet',
      pluginId: PLUGIN_ID,
      run: importWorkspaceJson,
    });

    host.registerCommand({
      id: 'fleet.export-migration-plan',
      title: 'Export migration plan',
      subtitle: 'Download the migration plan as Markdown',
      category: 'Fleet',
      pluginId: PLUGIN_ID,
      run: exportMigrationPlan,
    });
  },
};
