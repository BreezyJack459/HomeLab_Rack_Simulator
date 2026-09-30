import { getProcurementChecklist } from '../utils/procurement';
import { planningPackManifest } from './builtInPluginManifests';
import { lazy, Suspense, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Network } from 'lucide-react';
import { WorkspaceActionPanel } from '../components/WorkspaceActionPanel';
import { useRackStore } from '../store/rackStore';
import type { AppPanelId, PlanLens } from '../types/appShell';
import { PANEL_REGISTRY } from '../types/panelRegistry';
import type {
  LensContribution,
  PluginPanelDefinition,
  RackPluginModule,
} from './types';

const ScenarioPlannerPanel = lazy(() =>
  import('../components/ScenarioPlannerPanel').then((m) => ({
    default: m.ScenarioPlannerPanel,
  })),
);
const GoldenBaselinePanel = lazy(() =>
  import('../components/GoldenBaselinePanel').then((m) => ({
    default: m.GoldenBaselinePanel,
  })),
);
const RackChangeCalendar = lazy(() =>
  import('../components/RackChangeCalendar').then((m) => ({
    default: m.RackChangeCalendar,
  })),
);
const MigrationSummaryPanel = lazy(() =>
  import('../components/MigrationSummaryPanel').then((m) => ({
    default: m.MigrationSummaryPanel,
  })),
);
const CapacityForecastPanel = lazy(() =>
  import('../components/CapacityForecastPanel').then((m) => ({
    default: m.CapacityForecastPanel,
  })),
);
const ReservationPanel = lazy(() =>
  import('../components/ReservationPanel').then((m) => ({
    default: m.ReservationPanel,
  })),
);
const BuildPlanner = lazy(() =>
  import('../components/BuildPlanner').then((m) => ({
    default: m.BuildPlanner,
  })),
);
const ChangeReviewPanel = lazy(() =>
  import('../components/ChangeReviewPanel').then((m) => ({
    default: m.ChangeReviewPanel,
  })),
);
const ChangeRequestPanel = lazy(() =>
  import('../components/ChangeRequestPanel').then((m) => ({
    default: m.ChangeRequestPanel,
  })),
);
const ReadinessChecklist = lazy(() =>
  import('../components/ReadinessChecklist').then((m) => ({
    default: m.ReadinessChecklist,
  })),
);
const CommissioningChecklist = lazy(() =>
  import('../components/CommissioningChecklist').then((m) => ({
    default: m.CommissioningChecklist,
  })),
);
const FitCheckPanel = lazy(() =>
  import('../components/FitCheckPanel').then((m) => ({
    default: m.FitCheckPanel,
  })),
);
const TemplateQualityPanel = lazy(() =>
  import('../components/TemplateQualityPanel').then((m) => ({
    default: m.TemplateQualityPanel,
  })),
);
const PlanWorkbench = lazy(() =>
  import('../components/PlanWorkbench').then((m) => ({
    default: m.PlanWorkbench,
  })),
);

const PLUGIN_ID = planningPackManifest.id;

const planPanels: Array<{ id: AppPanelId; render: () => ReactNode }> = [
  {
    id: 'scenario-planner',
    render: () => (
      <Suspense fallback={null}>
        <ScenarioPlannerPanel />
      </Suspense>
    ),
  },
  {
    id: 'golden-baseline',
    render: () => (
      <Suspense fallback={null}>
        <GoldenBaselinePanel />
      </Suspense>
    ),
  },
  {
    id: 'rack-change-calendar',
    render: () => (
      <Suspense fallback={null}>
        <RackChangeCalendar />
      </Suspense>
    ),
  },
  {
    id: 'migration-summary',
    render: () => (
      <Suspense fallback={null}>
        <MigrationSummaryPanel />
      </Suspense>
    ),
  },
  {
    id: 'capacity-forecast',
    render: () => (
      <Suspense fallback={null}>
        <CapacityForecastPanel />
      </Suspense>
    ),
  },
  {
    id: 'reservation',
    render: () => (
      <Suspense fallback={null}>
        <ReservationPanel />
      </Suspense>
    ),
  },
  {
    id: 'build-planner',
    render: () => (
      <Suspense fallback={null}>
        <BuildPlanner />
      </Suspense>
    ),
  },
  {
    id: 'change-review',
    render: () => (
      <Suspense fallback={null}>
        <ChangeReviewPanel />
      </Suspense>
    ),
  },
  {
    id: 'change-request',
    render: () => (
      <Suspense fallback={null}>
        <ChangeRequestPanel />
      </Suspense>
    ),
  },
  {
    id: 'readiness-checklist',
    render: () => (
      <Suspense fallback={null}>
        <ReadinessChecklist />
      </Suspense>
    ),
  },
  {
    id: 'commissioning-checklist',
    render: () => (
      <Suspense fallback={null}>
        <CommissioningChecklist />
      </Suspense>
    ),
  },
  {
    id: 'fit-check',
    render: () => (
      <Suspense fallback={null}>
        <FitCheckPanel />
      </Suspense>
    ),
  },
  {
    id: 'template-quality',
    render: () => (
      <Suspense fallback={null}>
        <TemplateQualityPanel />
      </Suspense>
    ),
  },
];

const planLenses: LensContribution[] = [
  { id: 'scenarios', label: 'Scenarios', panelIds: ['scenario-planner', 'capacity-forecast'] },
  { id: 'baseline', label: 'Baseline', panelIds: ['golden-baseline', 'migration-summary', 'template-quality'] },
  { id: 'schedule', label: 'Schedule', panelIds: ['rack-change-calendar', 'reservation'] },
  { id: 'changes', label: 'Changes', panelIds: ['change-request', 'change-review'] },
  { id: 'build', label: 'Build', panelIds: ['build-planner', 'readiness-checklist', 'commissioning-checklist'] },
  { id: 'fit', label: 'Fit Check', panelIds: ['fit-check'] },
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

function PlanWorkbenchMount({
  lens,
  selectLens,
}: {
  lens: string;
  selectLens: (lens: string) => void;
}) {
  const layout = useRackStore((state) => state.layout);
  return (
    <Suspense fallback={null}>
      <PlanWorkbench
        layout={layout}
        currentLens={lens as PlanLens}
        onSelectLens={selectLens}
      />
    </Suspense>
  );
}

function PlanInspector({
  selectLens,
}: {
  selectLens: (lens: string) => void;
}) {
  const layout = useRackStore((state) => state.layout);
  const pendingChangeRequests = useMemo(
    () =>
      (layout.changeRequests ?? []).filter(
        (request) => request.status === 'pending',
      ).length,
    [layout.changeRequests],
  );
  const buildItemsRemaining = useMemo(
    () =>
      getProcurementChecklist(layout).filter(
        (item) => !item.reviewReason && (item.status === 'need-to-buy' || item.status === 'ordered'),
      ).length,
    [layout],
  );
  const reservationCount = layout.reservations?.length ?? 0;

  return (
    <WorkspaceActionPanel
      badge="Plan shortcuts"
      title="Keep planning focused"
      description="Switch lenses from here so the inspector stays a quick control surface instead of a second dashboard."
      metrics={[
        { label: 'Pending', value: `${pendingChangeRequests}` },
        { label: 'Reservations', value: `${reservationCount}` },
        { label: 'Build', value: `${buildItemsRemaining}` },
      ]}
      actions={[
        {
          label: 'Scenario lens',
          detail: 'Compare what-if changes and capacity headroom.',
          onClick: () => selectLens('scenarios'),
          primary: true,
        },
        {
          label: 'Baseline lens',
          detail: 'Review golden snapshots and migration status.',
          onClick: () => selectLens('baseline'),
        },
        {
          label: 'Schedule lens',
          detail: 'Coordinate windows, reservations and timing.',
          onClick: () => selectLens('schedule'),
        },
        {
          label: 'Changes lens',
          detail: 'Review requests and approval flow.',
          onClick: () => selectLens('changes'),
        },
        {
          label: 'Build lens',
          detail: 'Track readiness, procurement and commissioning.',
          onClick: () => selectLens('build'),
        },
        {
          label: 'Fit lens',
          detail: 'Check device depth and rack fit before purchase.',
          onClick: () => selectLens('fit'),
        },
      ]}
    />
  );
}

export const planningPackPlugin: RackPluginModule = {
  manifest: planningPackManifest,
  activate(host) {
    planPanels.forEach((entry) =>
      host.registerPanel(toPanelDefinition(entry)),
    );

    host.registerWorkspace({
      id: 'plan',
      title: 'Plan changes',
      description:
        'Compare scenarios, baselines and change windows from a planning-first surface.',
      icon: <Network size={16} />,
      nav: {
        label: 'Plan',
        shortLabel: 'Changes',
        description: 'Compare scenarios and upcoming changes',
        accent: 'from-indigo-500/25 to-sky-500/10',
      },
      lenses: planLenses,
      renderWorkbench: (lens, selectLens) => (
        <PlanWorkbenchMount lens={lens} selectLens={selectLens} />
      ),
      renderInspector: (_lens, selectLens) => (
        <PlanInspector selectLens={selectLens} />
      ),
    });
  },
};
