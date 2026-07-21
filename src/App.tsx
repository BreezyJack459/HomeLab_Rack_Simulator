import {
  type ChangeEvent,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  Box,
  Cable,
  HardDrive,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  SlidersHorizontal,
  Upload,
  Wrench,
} from "lucide-react";
import { ActionBar } from "./components/ActionBar";
import { PrimaryNav } from "./components/PrimaryNav";
import { RackSummaryPanel } from "./components/RackSummaryPanel";
import { RightInspectorShell } from "./components/RightInspectorShell";
import { TopContextBar } from "./components/TopContextBar";
import {
  builtInPlugins,
} from "./plugins/builtInPlugins";
import { getCoreContributions } from "./plugins/coreContributions";
import {
  getPluginCatalogState,
  pluginCatalogEntries,
} from "./plugins/pluginCatalog";
import {
  resolveLocalPackagePlugins,
  sanitizeEnabledPluginIds,
} from "./plugins/localPackageLoader";
import { buildPluginRegistry } from "./plugins/pluginHost";
import { useLayoutPrefsStore } from "./store/layoutPrefsStore";
import { useRackStore } from "./store/rackStore";
import type {
  AppPanelId,
  AppWorkspace,
  AuditLens,
  OperateLens,
  PlanLens,
  PortfolioLens,
  PanelPlacement,
} from "./types/appShell";
import {
  auditPanelIdsByLens,
  operatePanelIdsByLens,
  planPanelIdsByLens,
  portfolioPanelIdsByLens,
  WORKSPACE_META,
} from "./types/panelRegistry";
import type {
  LifecycleViewFilter,
  RackLayout,
  RackType,
  ValidationIssue,
  ViewMode,
} from "./types/rack";
import { layoutUsesHiddenZeroUPdu } from "./utils/featureFlags";
import { validateDomains } from "./utils/failureDomains";
import {
  getInspectorDescription,
  getInspectorTitle,
} from "./utils/inspectorHelpers";
import { getFilteredLayoutByLifecycle } from "./utils/migrationCalc";
import { getDocumentationIssues } from "./utils/documentationAudit";
import {
  getCableStrainRisks,
  getFrontRearCollisions,
  getHeavyOverLightIssues,
  getServiceabilityHighlightedDeviceIds,
} from "./utils/serviceability";
import { getRackTotals, validateRackLayout } from "./utils/validation";
import { RACK_SPECS } from "./utils/rackMath";
import type { SearchItem } from "./components/CommandPalette";

const issueSeverityRank: Record<ValidationIssue["severity"], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const APP_VERSION = "1.0.0";

const CommandPalette = lazy(() =>
  import("./components/CommandPalette").then((m) => ({
    default: m.CommandPalette,
  })),
);
const RackEditor2D = lazy(() =>
  import("./components/RackEditor2D").then((m) => ({
    default: m.RackEditor2D,
  })),
);
const RackViewer3D = lazy(() =>
  import("./components/RackViewer3D").then((m) => ({
    default: m.RackViewer3D,
  })),
);
const ModelWorkspaceLayout = lazy(() =>
  import("./components/ModelWorkspaceLayout").then((m) => ({
    default: m.ModelWorkspaceLayout,
  })),
);
const AuditWorkbench = lazy(() =>
  import("./components/AuditWorkbench").then((m) => ({
    default: m.AuditWorkbench,
  })),
);
const BottomTray = lazy(() =>
  import("./components/BottomTray").then((m) => ({ default: m.BottomTray })),
);
const OperateWorkbench = lazy(() =>
  import("./components/OperateWorkbench").then((m) => ({
    default: m.OperateWorkbench,
  })),
);
const PlanWorkbench = lazy(() =>
  import("./components/PlanWorkbench").then((m) => ({
    default: m.PlanWorkbench,
  })),
);
const PropertyPanel = lazy(() =>
  import("./components/PropertyPanel").then((m) => ({
    default: m.PropertyPanel,
  })),
);
const PortReservationPanel = lazy(() =>
  import("./components/PortReservationPanel").then((m) => ({
    default: m.PortReservationPanel,
  })),
);
const PortSpeedPanel = lazy(() =>
  import("./components/PortSpeedPanel").then((m) => ({
    default: m.PortSpeedPanel,
  })),
);
const RackHealthDashboard = lazy(() =>
  import("./components/RackHealthDashboard").then((m) => ({
    default: m.RackHealthDashboard,
  })),
);
const ServiceabilityPanel = lazy(() =>
  import("./components/ServiceabilityPanel").then((m) => ({
    default: m.ServiceabilityPanel,
  })),
);
const ValidationPanel = lazy(() =>
  import("./components/ValidationPanel").then((m) => ({
    default: m.ValidationPanel,
  })),
);
const DocumentationAuditPanel = lazy(() =>
  import("./components/DocumentationAuditPanel").then((m) => ({
    default: m.DocumentationAuditPanel,
  })),
);
const RackDebtPanel = lazy(() =>
  import("./components/RackDebtPanel").then((m) => ({
    default: m.RackDebtPanel,
  })),
);
const LabelDebtPanel = lazy(() =>
  import("./components/LabelDebtPanel").then((m) => ({
    default: m.LabelDebtPanel,
  })),
);
const ThermalDistributionPanel = lazy(() =>
  import("./components/ThermalDistributionPanel").then((m) => ({
    default: m.ThermalDistributionPanel,
  })),
);
const FailureDomainPanel = lazy(() =>
  import("./components/FailureDomainPanel").then((m) => ({
    default: m.FailureDomainPanel,
  })),
);
const DriftPanel = lazy(() =>
  import("./components/DriftPanel").then((m) => ({ default: m.DriftPanel })),
);
const EnvironmentPanel = lazy(() =>
  import("./components/EnvironmentPanel").then((m) => ({
    default: m.EnvironmentPanel,
  })),
);
const DeviceSensorPanel = lazy(() =>
  import("./components/DeviceSensorPanel").then((m) => ({
    default: m.DeviceSensorPanel,
  })),
);
const PowerChainPanel = lazy(() =>
  import("./components/PowerChainPanel").then((m) => ({
    default: m.PowerChainPanel,
  })),
);
const AssetRegistryPanel = lazy(() =>
  import("./components/AssetRegistryPanel").then((m) => ({
    default: m.AssetRegistryPanel,
  })),
);
const MaintenanceLogPanel = lazy(() =>
  import("./components/MaintenanceLogPanel").then((m) => ({
    default: m.MaintenanceLogPanel,
  })),
);
const BackupVerificationPanel = lazy(() =>
  import("./components/BackupVerificationPanel").then((m) => ({
    default: m.BackupVerificationPanel,
  })),
);
const FirmwareTrackerPanel = lazy(() =>
  import("./components/FirmwareTrackerPanel").then((m) => ({
    default: m.FirmwareTrackerPanel,
  })),
);
const RunbookPanel = lazy(() =>
  import("./components/RunbookPanel").then((m) => ({
    default: m.RunbookPanel,
  })),
);
const EvidenceLockerPanel = lazy(() =>
  import("./components/EvidenceLockerPanel").then((m) => ({
    default: m.EvidenceLockerPanel,
  })),
);
const PowerBillPanel = lazy(() =>
  import("./components/PowerBillPanel").then((m) => ({
    default: m.PowerBillPanel,
  })),
);
const IpAssignmentPanel = lazy(() =>
  import("./components/IpAssignmentPanel").then((m) => ({
    default: m.IpAssignmentPanel,
  })),
);
const SparePartsPanel = lazy(() =>
  import("./components/SparePartsPanel").then((m) => ({
    default: m.SparePartsPanel,
  })),
);
const CleaningSchedulePanel = lazy(() =>
  import("./components/CleaningSchedulePanel").then((m) => ({
    default: m.CleaningSchedulePanel,
  })),
);
const ScenarioPlannerPanel = lazy(() =>
  import("./components/ScenarioPlannerPanel").then((m) => ({
    default: m.ScenarioPlannerPanel,
  })),
);
const GoldenBaselinePanel = lazy(() =>
  import("./components/GoldenBaselinePanel").then((m) => ({
    default: m.GoldenBaselinePanel,
  })),
);
const RackChangeCalendar = lazy(() =>
  import("./components/RackChangeCalendar").then((m) => ({
    default: m.RackChangeCalendar,
  })),
);
const MigrationSummaryPanel = lazy(() =>
  import("./components/MigrationSummaryPanel").then((m) => ({
    default: m.MigrationSummaryPanel,
  })),
);
const CapacityForecastPanel = lazy(() =>
  import("./components/CapacityForecastPanel").then((m) => ({
    default: m.CapacityForecastPanel,
  })),
);
const ReservationPanel = lazy(() =>
  import("./components/ReservationPanel").then((m) => ({
    default: m.ReservationPanel,
  })),
);
const BuildPlanner = lazy(() =>
  import("./components/BuildPlanner").then((m) => ({
    default: m.BuildPlanner,
  })),
);
const ChangeReviewPanel = lazy(() =>
  import("./components/ChangeReviewPanel").then((m) => ({
    default: m.ChangeReviewPanel,
  })),
);
const ChangeRequestPanel = lazy(() =>
  import("./components/ChangeRequestPanel").then((m) => ({
    default: m.ChangeRequestPanel,
  })),
);
const BootSequencePanel = lazy(() =>
  import("./components/BootSequencePanel").then((m) => ({
    default: m.BootSequencePanel,
  })),
);
const ServiceMapPanel = lazy(() =>
  import("./components/ServiceMapPanel").then((m) => ({
    default: m.ServiceMapPanel,
  })),
);
const BlastRadiusPanel = lazy(() =>
  import("./components/BlastRadiusPanel").then((m) => ({
    default: m.BlastRadiusPanel,
  })),
);
const CableLengthAuditPanel = lazy(() =>
  import("./components/CableLengthAuditPanel").then((m) => ({
    default: m.CableLengthAuditPanel,
  })),
);
const ReadinessChecklist = lazy(() =>
  import("./components/ReadinessChecklist").then((m) => ({
    default: m.ReadinessChecklist,
  })),
);
const CommissioningChecklist = lazy(() =>
  import("./components/CommissioningChecklist").then((m) => ({
    default: m.CommissioningChecklist,
  })),
);
const FitCheckPanel = lazy(() =>
  import("./components/FitCheckPanel").then((m) => ({
    default: m.FitCheckPanel,
  })),
);
const TemplateQualityPanel = lazy(() =>
  import("./components/TemplateQualityPanel").then((m) => ({
    default: m.TemplateQualityPanel,
  })),
);
const DepthCompatibilityPanel = lazy(() =>
  import("./components/DepthCompatibilityPanel").then((m) => ({
    default: m.DepthCompatibilityPanel,
  })),
);
const WorkspaceManager = lazy(() =>
  import("./components/WorkspaceManager").then((m) => ({
    default: m.WorkspaceManager,
  })),
);
const InterRackMap = lazy(() =>
  import("./components/InterRackMap").then((m) => ({
    default: m.InterRackMap,
  })),
);
const RoomRackMapPanel = lazy(() =>
  import("./components/RoomRackMapPanel").then((m) => ({
    default: m.RoomRackMapPanel,
  })),
);
const RoomPlacementPanel = lazy(() =>
  import("./components/RoomPlacementPanel").then((m) => ({
    default: m.RoomPlacementPanel,
  })),
);
const PortfolioExportPanel = lazy(() =>
  import("./components/PortfolioExportPanel").then((m) => ({
    default: m.PortfolioExportPanel,
  })),
);
const DcimImportPanel = lazy(() =>
  import("./components/DcimImportPanel").then((m) => ({
    default: m.DcimImportPanel,
  })),
);
const RackPhotoPanel = lazy(() =>
  import("./components/RackPhotoPanel").then((m) => ({
    default: m.RackPhotoPanel,
  })),
);
const PluginManagerPanel = lazy(() =>
  import("./components/PluginManagerPanel").then((m) => ({
    default: m.PluginManagerPanel,
  })),
);
const PolicyRulesPanel = lazy(() =>
  import("./components/PolicyRulesPanel").then((m) => ({
    default: m.PolicyRulesPanel,
  })),
);
const HomelabGuidePanel = lazy(() =>
  import("./components/HomelabGuidePanel").then((m) => ({
    default: m.HomelabGuidePanel,
  })),
);
const InterRackCableWizard = lazy(() =>
  import("./components/InterRackCableWizard").then((m) => ({
    default: m.InterRackCableWizard,
  })),
);
const PortfolioWorkbench = lazy(() =>
  import("./components/PortfolioWorkbench").then((m) => ({
    default: m.PortfolioWorkbench,
  })),
);
const FaceplateGallery = import.meta.env.DEV
  ? lazy(() =>
      import("./components/FaceplateGallery").then((m) => ({
        default: m.FaceplateGallery,
      })),
    )
  : undefined;

// ── Workspace Hero (lightweight inline shell for audit/operate/plan/portfolio) ─

function WorkspaceHero({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-edge bg-surface/80 p-5 shadow-sm dark:border-edge dark:bg-surface-raised/70">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-accent-solid/12 p-3 text-accent-fg">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-content">
            {title}
          </h2>
          <p className="mt-1 text-sm text-content-muted">
            {description}
          </p>
        </div>
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

function WorkspaceActionPanel({
  badge,
  title,
  description,
  metrics,
  actions,
}: {
  badge: string;
  title: string;
  description: string;
  metrics?: Array<{ label: string; value: string }>;
  actions: Array<{
    label: string;
    detail: string;
    onClick: () => void;
    primary?: boolean;
  }>;
}) {
  return (
    <section className="rounded-3xl border border-edge bg-surface/85 p-4 shadow-sm dark:border-edge dark:bg-surface-raised/75">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-content-faint">
          {badge}
        </div>
        <h3 className="mt-1.5 text-[1.05rem] font-semibold text-content">
          {title}
        </h3>
        <p className="mt-1 text-sm leading-6 text-content-muted">
          {description}
        </p>
      </div>

      {metrics && metrics.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-edge bg-surface/75 px-3 py-2 shadow-sm dark:border-edge dark:bg-surface/70"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-content-faint">
                {metric.label}
              </div>
              <div className="mt-1 text-lg font-semibold text-content">
                {metric.value}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className={`rounded-2xl border px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
              action.primary
                ? 'border-accent/35 bg-accent-solid/12 text-accent-fg-strong shadow-accent/10 dark:text-accent-fg'
                : 'border-edge bg-surface/80 text-content-secondary dark:border-edge dark:bg-surface/60 dark:text-content'
            }`}
          >
            <div className="text-sm font-medium">{action.label}</div>
            <div className="mt-1 text-[11px] leading-5 opacity-80">
              {action.detail}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workspaceFileInputRef = useRef<HTMLInputElement>(null);

  const layout = useRackStore((state) => state.layout);
  const workspace = useRackStore((state) => state.workspace);
  const currentRackId = useRackStore((state) => state.currentRackId);
  const selectedDeviceId = useRackStore((state) => state.selectedDeviceId);
  const selectedCableId = useRackStore((state) => state.selectedCableId);
  const selectedInterRackCableId = useRackStore(
    (state) => state.selectedInterRackCableId,
  );
  const viewMode = useRackStore((state) => state.viewMode);
  const statusMessage = useRackStore((state) => state.statusMessage);
  const setViewMode = useRackStore((state) => state.setViewMode);
  const setRackType = useRackStore((state) => state.setRackType);
  const setRackHeight = useRackStore((state) => state.setRackHeight);
  const setViewSide = useRackStore((state) => state.setViewSide);
  const updateRack = useRackStore((state) => state.updateRack);
  const selectDevice = useRackStore((state) => state.selectDevice);
  const selectCable = useRackStore((state) => state.selectCable);
  const selectInterRackCable = useRackStore(
    (state) => state.selectInterRackCable,
  );
  const saveLocal = useRackStore((state) => state.saveLocal);
  const loadLocal = useRackStore((state) => state.loadLocal);
  const newLayout = useRackStore((state) => state.newLayout);
  const loadLayout = useRackStore((state) => state.loadLayout);
  const loadSample = useRackStore((state) => state.loadSample);
  const undo = useRackStore((state) => state.undo);
  const redo = useRackStore((state) => state.redo);
  const canUndo = useRackStore((state) => state.canUndo);
  const canRedo = useRackStore((state) => state.canRedo);
  const createRack = useRackStore((state) => state.createRack);
  const deleteRack = useRackStore((state) => state.deleteRack);
  const duplicateRack = useRackStore((state) => state.duplicateRack);
  const switchRack = useRackStore((state) => state.switchRack);
  const renameRack = useRackStore((state) => state.renameRack);
  const renameWorkspace = useRackStore((state) => state.renameWorkspace);
  const setWorkspace = useRackStore((state) => state.setWorkspace);
  const setDeviceLibraryOpen = useLayoutPrefsStore(
    (state) => state.setDeviceLibraryOpen,
  );
  const deviceLibraryOpen = useLayoutPrefsStore(
    (state) => state.deviceLibraryOpen,
  );
  const toggleDeviceLibrary = useLayoutPrefsStore(
    (state) => state.toggleDeviceLibrary,
  );
  const rackSummaryOpen = useLayoutPrefsStore((state) => state.rackSummaryOpen);
  const setRackSummaryOpen = useLayoutPrefsStore(
    (state) => state.setRackSummaryOpen,
  );
  const toggleRackSummary = useLayoutPrefsStore(
    (state) => state.toggleRackSummary,
  );
  const enabledPluginIds = useLayoutPrefsStore(
    (state) => state.enabledPluginIds,
  );
  const approvedLocalPluginIds = useLayoutPrefsStore(
    (state) => state.approvedLocalPluginIds,
  );
  const setEnabledPluginIds = useLayoutPrefsStore(
    (state) => state.setEnabledPluginIds,
  );
  const setApprovedLocalPluginIds = useLayoutPrefsStore(
    (state) => state.setApprovedLocalPluginIds,
  );

  const [confirmAction, setConfirmAction] = useState<null | {
    type: "new" | "sample";
    payload?: string;
  }>(null);
  const [inspectorOpen, setInspectorOpen] = useState(
    () => useLayoutPrefsStore.getState().inspectorOpen,
  );
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [lifecycleFilter, setLifecycleFilter] =
    useState<LifecycleViewFilter>("all");
  const [serviceabilityOverlayEnabled, setServiceabilityOverlayEnabled] =
    useState(false);
  const [serviceabilityFocusDeviceIds, setServiceabilityFocusDeviceIds] =
    useState<string[]>([]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [interRackWizardOpen, setInterRackWizardOpen] = useState(false);
  const [sampleLayouts, setSampleLayouts] = useState<RackLayout[]>([]);
  const [samplePickerOpen, setSamplePickerOpen] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] =
    useState<AppWorkspace>("model");
  const [currentAuditLens, setCurrentAuditLens] =
    useState<AuditLens>("overview");
  const [currentOperateLens, setCurrentOperateLens] =
    useState<OperateLens>("assets");
  const [currentPlanLens, setCurrentPlanLens] = useState<PlanLens>("scenarios");
  const [currentPortfolioLens, setCurrentPortfolioLens] =
    useState<PortfolioLens>("overview");

  const issues = useMemo(() => validateRackLayout(layout), [layout]);
  const totals = useMemo(() => getRackTotals(layout), [layout]);
  const documentationIssues = useMemo(
    () => getDocumentationIssues(layout),
    [layout],
  );
  const cableStrainRisks = useMemo(() => getCableStrainRisks(layout), [layout]);
  const frontRearCollisions = useMemo(
    () => getFrontRearCollisions(layout),
    [layout],
  );
  const heavyOverLightIssues = useMemo(
    () => getHeavyOverLightIssues(layout),
    [layout],
  );
  const failureDomainIssues = useMemo(
    () =>
      validateDomains(
        layout.failureDomains ?? [],
        layout.domainAssignments ?? [],
        layout.devices,
        layout.cables,
        layout.services ?? [],
      ),
    [layout],
  );
  const openDebtCount = useMemo(
    () =>
      (layout.debtItems ?? []).filter(
        (item) => item.status === "open" || item.status === "planned",
      ).length,
    [layout.debtItems],
  );
  const pendingChangeRequests = useMemo(
    () =>
      (layout.changeRequests ?? []).filter(
        (request) => request.status === "pending",
      ).length,
    [layout.changeRequests],
  );
  const buildItemsRemaining = useMemo(
    () =>
      (layout.procurementItems ?? []).filter(
        (item) => item.status === "need-to-buy" || item.status === "ordered",
      ).length,
    [layout.procurementItems],
  );
  const reservationCount = layout.reservations?.length ?? 0;
  const workspaceDeviceCount = useMemo(
    () => workspace.racks.reduce((sum, rack) => sum + rack.devices.length, 0),
    [workspace.racks],
  );
  const workspaceInterRackCount = workspace.interRackCables?.length ?? 0;
  const workspacePhotoCount = layout.photos?.length ?? 0;
  const filteredLayout = useMemo(
    () => getFilteredLayoutByLifecycle(layout, lifecycleFilter),
    [layout, lifecycleFilter],
  );
  const serviceabilityHighlightIds = useMemo(
    () =>
      serviceabilityFocusDeviceIds.length > 0
        ? serviceabilityFocusDeviceIds
        : getServiceabilityHighlightedDeviceIds(layout),
    [layout, serviceabilityFocusDeviceIds],
  );
  const visibleSampleLayouts = useMemo(
    () => sampleLayouts.filter((sample) => !layoutUsesHiddenZeroUPdu(sample)),
    [sampleLayouts],
  );
  const hasSelection = Boolean(
    selectedDeviceId || selectedCableId || selectedInterRackCableId,
  );
  const cablePluginEnabled = enabledPluginIds.includes("cable-management");
  const resolvedLocalPackages = useMemo(
    () =>
      resolveLocalPackagePlugins({
        catalogEntries: pluginCatalogEntries,
        approvedLocalPluginIds,
      }),
    [approvedLocalPluginIds],
  );
  const pluginRegistry = useMemo(
    () =>
      buildPluginRegistry({
        appVersion: APP_VERSION,
        plugins: [...builtInPlugins, ...resolvedLocalPackages.loadablePlugins],
        enabledPluginIds,
        shell: {
          getLayout: () => layout,
          getViewMode: () => viewMode,
          setViewMode,
          setCurrentWorkspace,
          setInspectorOpen,
        },
        core: getCoreContributions({
          render2d: (canvasLayout) => (
            <RackEditor2D
              layoutOverride={canvasLayout}
              serviceabilityOverlay={serviceabilityOverlayEnabled}
              highlightedDeviceIds={serviceabilityHighlightIds}
            />
          ),
          render3d: (canvasLayout) => (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-content-muted">
                  Loading 3D…
                </div>
              }
            >
              <RackViewer3D layout={canvasLayout} />
            </Suspense>
          ),
        }),
      }),
    [
      enabledPluginIds,
      layout,
      resolvedLocalPackages.loadablePlugins,
      serviceabilityHighlightIds,
      serviceabilityOverlayEnabled,
      setViewMode,
      viewMode,
    ],
  );
  const selectedIssue = useMemo(
    () => issues.find((issue) => issue.id === selectedIssueId) ?? null,
    [issues, selectedIssueId],
  );
  const topIssue = useMemo(
    () =>
      [...issues].sort(
        (a, b) =>
          issueSeverityRank[a.severity] - issueSeverityRank[b.severity] ||
          a.title.localeCompare(b.title),
      )[0] ?? null,
    [issues],
  );

  useEffect(() => {
    if (layoutUsesHiddenZeroUPdu(layout)) {
      loadLayout(layout);
    }
  }, [layout, loadLayout]);

  useEffect(() => {
    const supportsCurrentView = pluginRegistry.viewModes.some(
      (definition) => definition.id === viewMode,
    );
    if (!supportsCurrentView) {
      setViewMode("2d");
    }
  }, [pluginRegistry.viewModes, setViewMode, viewMode]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        const target = event.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
        event.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    let active = true;
    void import("./data/sampleLayouts").then((module) => {
      if (active) {
        setSampleLayouts(module.sampleLayouts);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  function handleIssueSelect(issue: ValidationIssue) {
    setSelectedIssueId(issue.id);
    setCurrentWorkspace("audit");
    setCurrentAuditLens("issues");
    if (issue.deviceIds?.length) selectDevice(issue.deviceIds[0]);
    if (issue.cableIds?.length) {
      selectCable(issue.cableIds[0]);
      setViewMode("cables");
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const { readJsonFile } = await import("./utils/exporters");
      const imported = await readJsonFile(file);
      const candidate = imported as Partial<RackLayout> | null;
      if (
        !candidate ||
        typeof candidate !== "object" ||
        Array.isArray(candidate) ||
        typeof candidate.rackType !== "string" ||
        !(candidate.rackType in RACK_SPECS) ||
        (candidate.devices !== undefined && !Array.isArray(candidate.devices))
      ) {
        useRackStore.setState({
          statusMessage: "Invalid rack layout JSON file.",
        });
        event.currentTarget.value = "";
        return;
      }
      loadLayout(candidate as RackLayout);
    } catch {
      useRackStore.setState({
        statusMessage: "Failed to read rack layout file.",
      });
    }
    event.currentTarget.value = "";
  }

  async function handleWorkspaceImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const { importWorkspaceJson } = await import("./utils/exporters");
      const text = await file.text();
      const importedWorkspace = importWorkspaceJson(text);
      if (!importedWorkspace) {
        useRackStore.setState({
          statusMessage: "Invalid workspace JSON file.",
        });
        event.currentTarget.value = "";
        return;
      }
      const success = setWorkspace(importedWorkspace);
      if (!success) {
        useRackStore.setState({ statusMessage: "Workspace has no racks." });
      }
    } catch {
      useRackStore.setState({
        statusMessage: "Failed to read workspace file.",
      });
    }
    event.currentTarget.value = "";
  }

  function handleNewLayout() {
    if (layout.devices.length > 0 || layout.cables.length > 0) {
      setConfirmAction({ type: "new" });
      return;
    }
    newLayout(layout.rackType, layout.heightU);
  }

  function handleLoadSample(sampleId: string) {
    if (!sampleId) return;
    if (layout.devices.length > 0 || layout.cables.length > 0) {
      setConfirmAction({ type: "sample", payload: sampleId });
      return;
    }
    loadSample(sampleId);
  }

  function handleConfirm() {
    if (!confirmAction) return;
    if (confirmAction.type === "new") {
      newLayout(layout.rackType, layout.heightU);
    } else if (confirmAction.type === "sample" && confirmAction.payload) {
      loadSample(confirmAction.payload);
    }
    setConfirmAction(null);
  }

  function handleDuplicate() {
    const duplicated: typeof layout = {
      ...layout,
      id: `layout-${Math.random().toString(36).slice(2, 10)}`,
      name: `${layout.name} (copy)`,
      updatedAt: new Date().toISOString(),
    };
    loadLayout(duplicated);
  }

  async function handleExportLayoutJson() {
    const { exportLayoutJson } = await import("./utils/exporters");
    exportLayoutJson(layout);
  }

  async function handleDownloadWorkspaceJson() {
    const { downloadWorkspaceJson } = await import("./utils/exporters");
    downloadWorkspaceJson(workspace);
  }

  async function handleExportRackPng() {
    const { exportRackPng } = await import("./utils/exporters");
    exportRackPng(layout);
  }

  async function handleExportMigrationPlan() {
    const { exportMigrationPlanMarkdown } = await import("./utils/exporters");
    exportMigrationPlanMarkdown(layout);
  }

  function handleAddDeviceTask() {
    setCurrentWorkspace("model");
    setViewMode("2d");
    setDeviceLibraryOpen(true);
  }

  function handleAddCableTask() {
    setCurrentWorkspace("model");
    setViewMode("cables");
  }

  function togglePlugin(pluginId: string) {
    const next = enabledPluginIds.includes(pluginId)
      ? enabledPluginIds.filter((id) => id !== pluginId)
      : [...enabledPluginIds, pluginId];
    setEnabledPluginIds(next);
  }

  function togglePluginApproval(pluginId: string) {
    const revokingApproval = approvedLocalPluginIds.includes(pluginId);
    const next = revokingApproval
      ? approvedLocalPluginIds.filter((id) => id !== pluginId)
      : [...approvedLocalPluginIds, pluginId];
    setApprovedLocalPluginIds(next);

    if (revokingApproval && enabledPluginIds.includes(pluginId)) {
      setEnabledPluginIds(enabledPluginIds.filter((id) => id !== pluginId));
    }
  }

  const pluginToggles = useMemo(
    () =>
      pluginCatalogEntries
        .map((entry) =>
          resolvedLocalPackages.catalogEntries.find(
            (candidate) => candidate.manifest.id === entry.manifest.id,
          ) ?? entry,
        )
        .filter((entry) => entry.activationMode === "hosted")
        .map(({ manifest: plugin }) => {
          const incompatibleReason =
            pluginRegistry.pluginStates.incompatible[plugin.id];
          const enabled = enabledPluginIds.includes(plugin.id);

          return {
            id: plugin.id,
            label: incompatibleReason
              ? `${plugin.name} Blocked`
              : `${plugin.name} ${enabled ? "On" : "Off"}`,
            enabled,
            disabled: Boolean(incompatibleReason),
            onToggle: () => togglePlugin(plugin.id),
          };
        }),
    [enabledPluginIds, pluginRegistry.pluginStates.incompatible, resolvedLocalPackages.catalogEntries],
  );
  const toolbarActions = useMemo(
    () =>
      pluginRegistry.toolbarActions.filter(
        (action) => action.isVisible?.() ?? true,
      ),
    [pluginRegistry.toolbarActions],
  );

  useEffect(() => {
    const sanitizedPluginIds = sanitizeEnabledPluginIds({
      catalogEntries: resolvedLocalPackages.catalogEntries,
      enabledPluginIds,
    });

    if (sanitizedPluginIds.length !== enabledPluginIds.length) {
      setEnabledPluginIds(sanitizedPluginIds);
    }
  }, [
    enabledPluginIds,
    resolvedLocalPackages.catalogEntries,
    setEnabledPluginIds,
  ]);

  function handleFixAlertsTask() {
    setCurrentWorkspace("audit");
    setCurrentAuditLens("issues");
    if (topIssue) {
      handleIssueSelect(topIssue);
    }
  }

  function handleOpenRackSettingsTask() {
    setCurrentWorkspace("model");
    setRackSummaryOpen(true);
  }

  const visiblePanels = useMemo(
    () => (workspaceId: AppWorkspace, placement: PanelPlacement) =>
      pluginRegistry.panels.filter(
        (panel) =>
          panel.workspace === workspaceId &&
          panel.defaultPlacement === placement,
      )
        .filter(
          (panel) =>
            !panel.supportedViewModes ||
            panel.supportedViewModes.includes(viewMode),
        )
        .filter((panel) => !panel.selectionRequired || hasSelection)
        .sort((a, b) => a.priority - b.priority),
    [hasSelection, pluginRegistry.panels, viewMode],
  );

  function renderPanel(panelId: AppPanelId) {
    const pluginPanel = pluginRegistry.panels.find(
      (panel) => panel.id === panelId && panel.pluginId,
    );
    if (pluginPanel) {
      return pluginPanel.render();
    }

    switch (panelId) {
      case "property":
        return <PropertyPanel />;
      case "port-reservation":
        return <PortReservationPanel />;
      case "port-speed":
        return <PortSpeedPanel />;
      case "rack-health":
        return <RackHealthDashboard layout={layout} />;
      case "serviceability":
        return (
          <ServiceabilityPanel
            layout={layout}
            overlayEnabled={serviceabilityOverlayEnabled}
            onOverlayEnabledChange={setServiceabilityOverlayEnabled}
            onHighlightDevicesChange={setServiceabilityFocusDeviceIds}
          />
        );
      case "validation":
        return (
          <ValidationPanel
            issues={issues}
            totals={totals}
            selectedIssueId={selectedIssueId}
            onIssueSelect={handleIssueSelect}
          />
        );
      case "documentation-audit":
        return <DocumentationAuditPanel />;
      case "rack-debt":
        return <RackDebtPanel />;
      case "label-debt":
        return <LabelDebtPanel />;
      case "thermal-distribution":
        return <ThermalDistributionPanel />;
      case "failure-domain":
        return <FailureDomainPanel />;
      case "drift":
        return <DriftPanel />;
      case "environment":
        return <EnvironmentPanel />;
      case "device-sensor":
        return <DeviceSensorPanel />;
      case "power-chain":
        return <PowerChainPanel />;
      case "asset-registry":
        return <AssetRegistryPanel />;
      case "maintenance-log":
        return <MaintenanceLogPanel />;
      case "backup-verification":
        return <BackupVerificationPanel />;
      case "firmware-tracker":
        return <FirmwareTrackerPanel />;
      case "runbook":
        return <RunbookPanel />;
      case "evidence-locker":
        return <EvidenceLockerPanel />;
      case "power-bill":
        return <PowerBillPanel />;
      case "ip-assignment":
        return <IpAssignmentPanel />;
      case "spare-parts":
        return <SparePartsPanel />;
      case "cleaning-schedule":
        return <CleaningSchedulePanel />;
      case "scenario-planner":
        return <ScenarioPlannerPanel />;
      case "golden-baseline":
        return <GoldenBaselinePanel />;
      case "rack-change-calendar":
        return <RackChangeCalendar />;
      case "migration-summary":
        return <MigrationSummaryPanel />;
      case "capacity-forecast":
        return <CapacityForecastPanel />;
      case "reservation":
        return <ReservationPanel />;
      case "build-planner":
        return <BuildPlanner />;
      case "change-review":
        return <ChangeReviewPanel />;
      case "change-request":
        return <ChangeRequestPanel />;
      case "workspace-manager":
        return (
          <WorkspaceManager
            workspace={workspace}
            currentRackId={currentRackId}
            onSwitchRack={switchRack}
            onCreateRack={createRack}
            onDeleteRack={deleteRack}
            onDuplicateRack={duplicateRack}
            onRenameRack={renameRack}
            onRenameWorkspace={renameWorkspace}
          />
        );
      case "inter-rack-map":
        return (
          <InterRackMap
            racks={workspace.racks}
            interRackCables={workspace.interRackCables}
            selectedCableId={selectedInterRackCableId}
            onSelectCable={(cableId) => {
              selectInterRackCable(cableId);
              if (cableId) {
                setCurrentWorkspace("portfolio");
              }
            }}
            onAddCable={() => setInterRackWizardOpen(true)}
          />
        );
      case "room-rack-map":
        return <RoomRackMapPanel />;
      case "room-placement":
        return <RoomPlacementPanel />;
      case "portfolio-export":
        return <PortfolioExportPanel />;
      case "dcim-import":
        return <DcimImportPanel />;
      case "rack-photo":
        return <RackPhotoPanel />;
      case "plugin-manager":
        return (
          <PluginManagerPanel
            plugins={resolvedLocalPackages.catalogEntries}
            enabledPluginIds={enabledPluginIds}
            approvedLocalPluginIds={approvedLocalPluginIds}
            incompatibleReasons={pluginRegistry.pluginStates.incompatible}
            onTogglePlugin={togglePlugin}
            onToggleApproval={togglePluginApproval}
          />
        );
      case "policy-rules":
        return <PolicyRulesPanel />;
      case "homelab-guide":
        return <HomelabGuidePanel />;
      case "boot-sequence":
        return <BootSequencePanel />;
      case "service-map":
        return <ServiceMapPanel />;
      case "blast-radius":
        return <BlastRadiusPanel />;
      case "cable-length-audit":
        return <CableLengthAuditPanel />;
      case "readiness-checklist":
        return <ReadinessChecklist />;
      case "commissioning-checklist":
        return <CommissioningChecklist />;
      case "fit-check":
        return <FitCheckPanel />;
      case "template-quality":
        return <TemplateQualityPanel />;
      case "depth-compatibility":
        return <DepthCompatibilityPanel />;
      default:
        return null;
    }
  }

  function renderPanelGrid(
    workspaceId: AppWorkspace,
    allowedPanelIds?: AppPanelId[],
  ) {
    const panels = visiblePanels(workspaceId, "main").filter(
      (panel) => !allowedPanelIds || allowedPanelIds.includes(panel.id),
    );
    if (panels.length === 0) return null;
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        {panels.map((panel) => (
          <Suspense fallback={null} key={panel.id}>
            {renderPanel(panel.id)}
          </Suspense>
        ))}
      </div>
    );
  }

  const inspectorTitle = getInspectorTitle(currentWorkspace, selectedIssue);

  const inspectorDescription = getInspectorDescription(
    currentWorkspace,
    currentAuditLens,
    hasSelection,
    selectedIssue,
  );

  function renderInspectorPanels() {
    const panels = visiblePanels(currentWorkspace, "inspector");
    if (currentWorkspace === "model" && !hasSelection) {
      const helpfulPanels = panels.filter(
        (panel) => panel.id !== "property" && !panel.selectionRequired,
      );
      return (
        <>
          <div className="rounded-2xl border border-accent/25 bg-accent-solid/10 p-4 text-sm text-accent-fg-strong">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-fg">
              Next step
            </div>
            <div className="mt-2 font-semibold">Start with the rack, not the settings.</div>
            <p className="mt-1 text-xs leading-5 text-accent-fg-strong/80 dark:text-accent-fg-strong/75">
              Add a device, connect existing gear, or open rack settings when
              you need to change size, power budget, or filters.
            </p>
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                onClick={handleAddDeviceTask}
                className="rounded-xl border border-accent/30 bg-surface/75 px-3 py-2 text-left text-xs font-medium text-accent-fg-strong hover:bg-surface/60 dark:text-accent-fg-strong dark:hover:bg-surface"
              >
                Add device
              </button>
              <button
                type="button"
                onClick={handleAddCableTask}
                className="rounded-xl border border-accent/30 bg-surface/75 px-3 py-2 text-left text-xs font-medium text-accent-fg-strong hover:bg-surface/60 dark:text-accent-fg-strong dark:hover:bg-surface"
              >
                Connect cable
              </button>
              <button
                type="button"
                onClick={handleOpenRackSettingsTask}
                className="rounded-xl border border-accent/30 bg-surface/75 px-3 py-2 text-left text-xs font-medium text-accent-fg-strong hover:bg-surface/60 dark:text-accent-fg-strong dark:hover:bg-surface"
              >
                Rack settings
              </button>
            </div>
          </div>
          {helpfulPanels.map((panel) => (
            <Suspense fallback={null} key={panel.id}>
              {renderPanel(panel.id)}
            </Suspense>
          ))}
        </>
      );
    }
    if (currentWorkspace === "audit") {
      if (currentAuditLens === "serviceability") {
        return (
          <Suspense fallback={null}>
            <ServiceabilityPanel
              layout={layout}
              overlayEnabled={serviceabilityOverlayEnabled}
              onOverlayEnabledChange={setServiceabilityOverlayEnabled}
              onHighlightDevicesChange={setServiceabilityFocusDeviceIds}
            />
          </Suspense>
        );
      }
      if (selectedIssue || currentAuditLens === "issues") {
        return (
          <ValidationPanel
            issues={issues}
            totals={totals}
            selectedIssueId={selectedIssueId}
            onIssueSelect={handleIssueSelect}
          />
        );
      }
      return (
        <WorkspaceActionPanel
          badge="Check shortcuts"
          title="Keep audit work lightweight"
          description="Use the inspector for fast jumps into the issue queue and deeper lenses, without repeating the dashboard cards already on the main canvas."
          metrics={[
            { label: "Issues", value: `${issues.length}` },
            {
              label: "Serviceability",
              value: `${cableStrainRisks.length + frontRearCollisions.length + heavyOverLightIssues.length}`,
            },
            { label: "Domains", value: `${failureDomainIssues.length}` },
          ]}
          actions={[
            {
              label: "Open issue queue",
              detail: "Jump to the validation queue and focus the top alert.",
              onClick: handleFixAlertsTask,
              primary: true,
            },
            {
              label: "Serviceability lens",
              detail: "Pull-out clearance, collisions and maintenance access.",
              onClick: () => setCurrentAuditLens("serviceability"),
            },
            {
              label: "Documentation lens",
              detail: "Review labels, evidence and drift together.",
              onClick: () => setCurrentAuditLens("documentation"),
            },
            {
              label: "Thermal lens",
              detail: "Check heat, power headroom and environmental pressure.",
              onClick: () => setCurrentAuditLens("thermal"),
            },
            {
              label: "Domains lens",
              detail: "Inspect redundancy and assignment gaps.",
              onClick: () => setCurrentAuditLens("domains"),
            },
          ]}
        />
      );
    }
    if (currentWorkspace === "plan") {
      return (
        <WorkspaceActionPanel
          badge="Plan shortcuts"
          title="Keep planning focused"
          description="Switch lenses from here so the inspector stays a quick control surface instead of a second dashboard."
          metrics={[
            { label: "Pending", value: `${pendingChangeRequests}` },
            { label: "Reservations", value: `${reservationCount}` },
            { label: "Build", value: `${buildItemsRemaining}` },
          ]}
          actions={[
            {
              label: "Scenario lens",
              detail: "Compare what-if changes and capacity headroom.",
              onClick: () => setCurrentPlanLens("scenarios"),
              primary: true,
            },
            {
              label: "Baseline lens",
              detail: "Review golden snapshots and migration status.",
              onClick: () => setCurrentPlanLens("baseline"),
            },
            {
              label: "Schedule lens",
              detail: "Coordinate windows, reservations and timing.",
              onClick: () => setCurrentPlanLens("schedule"),
            },
            {
              label: "Changes lens",
              detail: "Review requests and approval flow.",
              onClick: () => setCurrentPlanLens("changes"),
            },
            {
              label: "Build lens",
              detail: "Track readiness, procurement and commissioning.",
              onClick: () => setCurrentPlanLens("build"),
            },
            {
              label: "Fit lens",
              detail: "Check device depth and rack fit before purchase.",
              onClick: () => setCurrentPlanLens("fit"),
            },
          ]}
        />
      );
    }
    if (currentWorkspace === "portfolio") {
      return (
        <WorkspaceActionPanel
          badge="Fleet shortcuts"
          title="Keep fleet tools lean"
          description="Use the inspector for navigation and workspace-wide actions, while the main area holds the broader fleet overview."
          metrics={[
            { label: "Racks", value: `${workspace.racks.length}` },
            { label: "Devices", value: `${workspaceDeviceCount}` },
            { label: "Links", value: `${workspaceInterRackCount}` },
          ]}
          actions={[
            {
              label: "Overview lens",
              detail: "Jump back to the workspace overview.",
              onClick: () => setCurrentPortfolioLens("overview"),
              primary: true,
            },
            {
              label: "Rooms lens",
              detail: "Place racks in physical room layouts.",
              onClick: () => setCurrentPortfolioLens("rooms"),
            },
            {
              label: "Interconnect lens",
              detail: "Map cross-rack cabling and trunk links.",
              onClick: () => setCurrentPortfolioLens("interconnect"),
            },
            {
              label: "Data lens",
              detail: "Import or export DCIM data.",
              onClick: () => setCurrentPortfolioLens("data"),
            },
            {
              label: "Policy lens",
              detail: "Review naming, compliance and standards.",
              onClick: () => setCurrentPortfolioLens("policy"),
            },
            {
              label: "Plugin Manager",
              detail: "Enable or disable optional workflows for this app shell.",
              onClick: () => {
                setCurrentPortfolioLens("overview");
                setInspectorOpen(true);
              },
            },
            {
              label: "Guide lens",
              detail: "Open guide and photo documentation tools.",
              onClick: () => setCurrentPortfolioLens("guide"),
            },
            {
              label: "Add inter-rack cable",
              detail: "Open the wizard for a new cross-rack link.",
              onClick: () => setInterRackWizardOpen(true),
            },
            {
              label: "Export workspace",
              detail: "Download the current workspace JSON snapshot.",
              onClick: () => void handleDownloadWorkspaceJson(),
            },
          ]}
        />
      );
    }
    if (panels.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-edge-strong bg-surface/60 p-4 text-sm text-content-muted dark:border-edge-strong dark:bg-surface/60 dark:text-content-muted">
          Use Search to jump to a task, or choose a lens in the main workspace
          to show the related controls here.
        </div>
      );
    }
    return panels.map((panel) => (
      <Suspense fallback={null} key={panel.id}>
        {renderPanel(panel.id)}
      </Suspense>
    ));
  }

  const commandItems = useMemo<SearchItem[]>(() => {
    const quickActions: SearchItem[] = [
      {
        id: "task-add-device",
        type: "quick-action",
        title: "Add device",
        subtitle: "Open the device library and place hardware in the rack",
        icon: <Box size={16} className="text-accent-fg" />,
        action: handleAddDeviceTask,
        category: "Quick tasks",
      },
      {
        id: "task-fix-top-issue",
        type: "quick-action",
        title: topIssue ? "Fix top issue" : "Check alerts",
        subtitle: topIssue
          ? `${topIssue.severity}: ${topIssue.title}`
          : "Open the audit workspace and review rack health",
        icon: (
          <AlertTriangle
            size={16}
            className="text-accent-fg"
          />
        ),
        action: handleFixAlertsTask,
        category: "Quick tasks",
      },
      {
        id: "task-open-rack-settings",
        type: "quick-action",
        title: "Open rack settings",
        subtitle: "Change rack size, view filters and power budget",
        icon: (
          <SlidersHorizontal
            size={16}
            className="text-accent-fg"
          />
        ),
        action: handleOpenRackSettingsTask,
        category: "Quick tasks",
      },
      {
        id: "task-load-sample",
        type: "quick-action",
        title: "Load sample",
        subtitle: "Seed the current rack with a working sample layout",
        icon: <Box size={16} className="text-content-muted" />,
        action: () => setSamplePickerOpen(true),
        category: "Quick tasks",
      },
      {
        id: "task-import-rack",
        type: "quick-action",
        title: "Import rack",
        subtitle: "Import an existing rack JSON file",
        icon: (
          <Upload size={16} className="text-content-muted" />
        ),
        action: () => fileInputRef.current?.click(),
        category: "Quick tasks",
      },
      {
        id: "task-review-power",
        type: "quick-action",
        title: "Review power health",
        subtitle: "Open audit checks for power headroom, UPS and thermal risk",
        icon: (
          <Settings2
            size={16}
            className="text-content-muted"
          />
        ),
        action: () => {
          setCurrentWorkspace("audit");
          setCurrentAuditLens("thermal");
        },
        category: "Quick tasks",
      },
      {
        id: "task-update-firmware",
        type: "quick-action",
        title: "Update firmware records",
        subtitle: "Open operational firmware tracking for devices",
        icon: (
          <HardDrive
            size={16}
            className="text-content-muted"
          />
        ),
        action: () => {
          setCurrentWorkspace("operate");
          setCurrentOperateLens("firmware");
        },
        category: "Quick tasks",
      },
    ];
    if (cablePluginEnabled) {
      quickActions.splice(1, 0, {
        id: "task-connect-cable",
        type: "quick-action",
        title: "Connect cable",
        subtitle: "Switch to cable view and use the cable planner",
        icon: (
          <Cable size={16} className="text-accent-fg" />
        ),
        action: handleAddCableTask,
        category: "Quick tasks",
      });
    }

    const workspaceItems: SearchItem[] = (
      Object.keys(WORKSPACE_META) as AppWorkspace[]
    ).map((workspaceId) => ({
      id: `workspace-${workspaceId}`,
      type: "workspace",
      title: WORKSPACE_META[workspaceId].title,
      subtitle: WORKSPACE_META[workspaceId].description,
      icon: (
        <span className="text-accent-fg">
          {WORKSPACE_META[workspaceId].icon}
        </span>
      ),
      action: () => setCurrentWorkspace(workspaceId),
      category: "Workspaces",
    }));

    const panelItems: SearchItem[] = pluginRegistry.panels.map((panel) => ({
      id: `panel-${panel.id}`,
      type: "panel",
      title: panel.title,
      subtitle: `${panel.workspace} workspace`,
      icon: (
        <Settings2 size={16} className="text-content-muted" />
      ),
      action: () => {
        setCurrentWorkspace(panel.workspace);
        if (panel.supportedViewModes?.length) {
          setViewMode(panel.supportedViewModes[0]);
        }
      },
      category: "Advanced panels",
    }));

    const pluginItems: SearchItem[] = resolvedLocalPackages.catalogEntries.map((entry) => {
      const plugin = entry.manifest;
      const enabled = enabledPluginIds.includes(plugin.id);
      const capabilitySummary = plugin.capabilities
        .map((capability) => {
          switch (capability) {
            case "view-modes":
              return "views";
            case "panels":
              return "panels";
            case "commands":
              return "commands";
            case "toolbar-actions":
              return "toolbar";
            case "layout-read":
              return "layout read";
            default:
              return capability;
          }
        })
        .join(", ");
      const catalogState = getPluginCatalogState({
        entry,
        enabledPluginIds,
        approvedLocalPluginIds,
        incompatibleReasons: pluginRegistry.pluginStates.incompatible,
      });
      const blockedReason = catalogState.canToggle
        ? undefined
        : catalogState.summary;

      return {
        id: `plugin-toggle-${plugin.id}`,
        type: "quick-action",
        title: blockedReason
          ? entry.activationMode === "manifest-only" &&
            catalogState.runtimeStatus !== "incompatible"
            ? approvedLocalPluginIds.includes(plugin.id)
              ? `${plugin.name} reviewed`
              : `Review ${plugin.name}`
            : `${plugin.name} unavailable`
          : enabled
            ? `Disable ${plugin.name}`
            : `Enable ${plugin.name}`,
        subtitle: blockedReason
          ? blockedReason
          : `${plugin.description} · ${capabilitySummary}${entry.statusNote ? ` · ${entry.statusNote}` : ""}`,
        icon: (
          <Settings2
            size={16}
            className="text-content-muted"
          />
        ),
        action: blockedReason
          ? entry.activationMode === "manifest-only" &&
            catalogState.runtimeStatus !== "incompatible"
            ? () => togglePluginApproval(plugin.id)
            : () => undefined
          : () => togglePlugin(plugin.id),
        category: "Plugins",
      };
    });

    return [...quickActions, ...workspaceItems, ...panelItems, ...pluginItems];
  }, [
    cablePluginEnabled,
    enabledPluginIds,
    approvedLocalPluginIds,
    pluginRegistry.panels,
    pluginRegistry.pluginStates.incompatible,
    resolvedLocalPackages.catalogEntries,
    setViewMode,
    topIssue,
  ]);

  function renderCanvas() {
    if (import.meta.env.DEV && viewMode === "gallery") {
      if (!FaceplateGallery) return null;
      return (
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-content-muted">
              Loading faceplate gallery…
            </div>
          }
        >
          <FaceplateGallery />
        </Suspense>
      );
    }
    const currentView =
      pluginRegistry.viewModes.find((definition) => definition.id === viewMode) ??
      pluginRegistry.viewModes.find((definition) => definition.id === "2d");

    return currentView?.render(filteredLayout) ?? null;
  }

  function renderModelWorkspace() {
    return (
      <Suspense fallback={null}>
        <ModelWorkspaceLayout layout={layout} canvas={renderCanvas()} />
      </Suspense>
    );
  }

  function renderAuditWorkspace() {
    return (
      <div className="space-y-4 overflow-y-auto p-4">
        <Suspense fallback={null}>
          <AuditWorkbench
            layout={layout}
            issues={issues}
            totals={{
              powerW: totals.powerW,
              heatScore: totals.heatScore,
              occupiedU: totals.occupiedU,
            }}
            selectedIssueId={selectedIssueId}
            documentationIssueCount={documentationIssues.length}
            serviceabilityIssueCount={
              cableStrainRisks.length +
              frontRearCollisions.length +
              heavyOverLightIssues.length
            }
            failureDomainIssueCount={failureDomainIssues.length}
            openDebtCount={openDebtCount}
            currentLens={currentAuditLens}
            onSelectLens={setCurrentAuditLens}
            onIssueSelect={handleIssueSelect}
          />
        </Suspense>
        {renderPanelGrid("audit", auditPanelIdsByLens[currentAuditLens])}
      </div>
    );
  }

  function renderOperateWorkspace() {
    return (
      <div className="space-y-4 overflow-y-auto p-4">
        <WorkspaceHero
          title={WORKSPACE_META.operate.title}
          description={WORKSPACE_META.operate.description}
          icon={WORKSPACE_META.operate.icon}
        />
        <Suspense fallback={null}>
          <OperateWorkbench
            layout={layout}
            currentLens={currentOperateLens}
            onSelectLens={setCurrentOperateLens}
          />
        </Suspense>
        {renderPanelGrid("operate", operatePanelIdsByLens[currentOperateLens])}
      </div>
    );
  }

  function renderPlanWorkspace() {
    return (
      <div className="space-y-4 overflow-y-auto p-4">
        <WorkspaceHero
          title={WORKSPACE_META.plan.title}
          description={WORKSPACE_META.plan.description}
          icon={WORKSPACE_META.plan.icon}
        />
        <Suspense fallback={null}>
          <PlanWorkbench
            layout={layout}
            currentLens={currentPlanLens}
            onSelectLens={setCurrentPlanLens}
          />
        </Suspense>
        {renderPanelGrid("plan", planPanelIdsByLens[currentPlanLens])}
      </div>
    );
  }

  function renderPortfolioWorkspace() {
    return (
      <div className="space-y-4 overflow-y-auto p-4">
        <WorkspaceHero
          title={WORKSPACE_META.portfolio.title}
          description={WORKSPACE_META.portfolio.description}
          icon={WORKSPACE_META.portfolio.icon}
        />
        <Suspense fallback={null}>
          <PortfolioWorkbench
            workspace={workspace}
            layout={layout}
            currentLens={currentPortfolioLens}
            onSelectLens={setCurrentPortfolioLens}
          />
        </Suspense>
        {renderPanelGrid(
          "portfolio",
          portfolioPanelIdsByLens[currentPortfolioLens],
        )}
      </div>
    );
  }

  function renderWorkspaceMain() {
    if (currentWorkspace === "model") return renderModelWorkspace();
    if (currentWorkspace === "audit") return renderAuditWorkspace();
    if (currentWorkspace === "operate") return renderOperateWorkspace();
    if (currentWorkspace === "plan") return renderPlanWorkspace();
    return renderPortfolioWorkspace();
  }

  return (
    <div className="flex h-screen w-screen max-w-full overflow-hidden bg-fill-subtle text-content dark:bg-surface dark:text-content">
      <PrimaryNav
        currentWorkspace={currentWorkspace}
        onSelectWorkspace={setCurrentWorkspace}
      />

      <div className="flex min-w-0 w-0 flex-1 flex-col">
        <TopContextBar
          workspace={workspace}
          layout={layout}
          currentWorkspace={currentWorkspace}
          viewMode={viewMode}
          viewModes={pluginRegistry.viewModes}
          pluginToggles={pluginToggles}
          toolbarActions={toolbarActions}
          onOpenCommand={() => setCommandOpen(true)}
          onRenameLayout={(name) => updateRack({ name })}
          onToggleViewMode={setViewMode}
          onSetViewSide={setViewSide}
        />
        <ActionBar
          canUndo={canUndo()}
          canRedo={canRedo()}
          contextContent={
            currentWorkspace === "model" ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="toggle-device-library"
                  aria-expanded={deviceLibraryOpen}
                  onClick={toggleDeviceLibrary}
                  className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition ${
                    deviceLibraryOpen
                      ? "border-accent/40 bg-accent-solid/12 text-accent-fg"
                      : "border-edge bg-surface text-content-secondary hover:border-accent hover:text-accent-fg dark:border-edge-strong dark:bg-surface-raised dark:text-content-secondary dark:hover:border-accent dark:hover:text-accent-fg"
                  }`}
                >
                  {deviceLibraryOpen ? (
                    <PanelLeftClose size={14} />
                  ) : (
                    <PanelLeftOpen size={14} />
                  )}
                  Device library
                </button>
                <RackSummaryPanel
                  embedded
                  open={rackSummaryOpen}
                  onToggle={toggleRackSummary}
                  layout={layout}
                  totals={totals}
                  issues={issues}
                  selectedIssueId={selectedIssueId}
                  lifecycleFilter={lifecycleFilter}
                  onLifecycleFilterChange={setLifecycleFilter}
                  onRackTypeChange={setRackType}
                  onRackHeightChange={setRackHeight}
                  onRackDepthChange={(rackDepthMm) => updateRack({ rackDepthMm })}
                  onFrontDoorClearanceChange={(frontDoorClearanceMm) =>
                    updateRack({ frontDoorClearanceMm })
                  }
                  onRearDoorClearanceChange={(rearDoorClearanceMm) =>
                    updateRack({ rearDoorClearanceMm })
                  }
                  onRearCableClearanceChange={(rearClearanceMm) =>
                    updateRack({ rearClearanceMm })
                  }
                  onPowerBudgetChange={(powerBudgetW) => updateRack({ powerBudgetW })}
                  onIssueSelect={handleIssueSelect}
                />
              </div>
            ) : null
          }
          issueCount={issues.length}
          onAddDevice={handleAddDeviceTask}
          onAddCable={cablePluginEnabled ? handleAddCableTask : null}
          onFixAlerts={handleFixAlertsTask}
          onOpenSearch={() => setCommandOpen(true)}
          onNewLayout={handleNewLayout}
          onDuplicate={handleDuplicate}
          onUndo={undo}
          onRedo={redo}
          onSaveLocal={saveLocal}
          onLoadLocal={loadLocal}
          onImportLayout={() => fileInputRef.current?.click()}
          onLoadSample={() => setSamplePickerOpen(true)}
          onExportJson={() => void handleExportLayoutJson()}
          onExportPng={() => void handleExportRackPng()}
          onImportWorkspace={() => workspaceFileInputRef.current?.click()}
          onExportWorkspace={() => void handleDownloadWorkspaceJson()}
          onExportMigration={() => void handleExportMigrationPlan()}
          onAddInterRackCable={() => setInterRackWizardOpen(true)}
        />

        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          accept="application/json,.json"
          onChange={handleImport}
        />
        <input
          ref={workspaceFileInputRef}
          className="hidden"
          type="file"
          accept="application/json,.json"
          onChange={handleWorkspaceImport}
        />

        <div
          className={`grid min-h-0 flex-1 grid-cols-1 ${
            inspectorOpen
              ? "xl:grid-cols-[minmax(0,1fr)_380px]"
              : "xl:grid-cols-[minmax(0,1fr)_72px]"
          }`}
        >
          <main className="min-w-0 overflow-hidden">
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
                {renderWorkspaceMain()}
              </div>
              {currentWorkspace !== "model" && (
                <Suspense fallback={null}>
                  <BottomTray
                    issues={issues}
                    selectedIssueId={selectedIssueId}
                    statusMessage={statusMessage}
                    currentWorkspace={currentWorkspace}
                    onIssueSelect={handleIssueSelect}
                    onOpenAudit={() => setCurrentWorkspace("audit")}
                  />
                </Suspense>
              )}
            </div>
          </main>

          <RightInspectorShell
            title={inspectorTitle}
            description={inspectorDescription}
            open={inspectorOpen}
            onToggle={() => {
              const nextOpen = !inspectorOpen;
              setInspectorOpen(nextOpen);
              useLayoutPrefsStore.getState().setInspectorOpen(nextOpen);
            }}
          >
            {renderInspectorPanels()}
          </RightInspectorShell>
        </div>

        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-80 rounded-lg border border-edge-strong bg-fill p-5 shadow-xl dark:border-edge-strong dark:bg-surface-raised">
              <div className="mb-3 text-sm font-semibold text-content">
                {confirmAction.type === "new" && "Start a new layout?"}
                {confirmAction.type === "sample" && "Load sample layout?"}
              </div>
              <div className="mb-4 text-xs text-content-muted">
                {confirmAction.type === "new"
                  ? "This will clear all devices and cables."
                  : "This will replace your current rack with the selected sample."}
              </div>
              <div className="flex gap-2">
                <button
                  className="h-9 flex-1 rounded-md border border-red-500/40 bg-red-500/10 text-sm font-medium text-red-800 hover:bg-red-500/20 dark:text-red-100"
                  onClick={handleConfirm}
                  type="button"
                >
                  Confirm
                </button>
                <button
                  className="h-9 flex-1 rounded-md border border-edge-strong bg-fill-strong text-sm text-content-secondary hover:bg-slate-300 dark:border-edge-strong dark:bg-fill dark:text-content dark:hover:bg-fill-strong"
                  onClick={() => setConfirmAction(null)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {samplePickerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div
              className="w-full max-w-2xl rounded-3xl border border-edge-strong bg-fill p-5 shadow-xl dark:border-edge-strong dark:bg-surface-raised"
              data-testid="sample-picker-modal"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-content">
                    Load sample layout
                  </div>
                  <div className="text-sm text-content-muted">
                    Choose a sample to seed the current rack.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSamplePickerOpen(false)}
                  className="rounded-full border border-edge-strong bg-surface px-3 py-1 text-xs text-content-secondary hover:bg-fill dark:border-edge-strong dark:bg-surface dark:text-content-secondary dark:hover:bg-fill"
                >
                  Close
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {visibleSampleLayouts.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => {
                      setSamplePickerOpen(false);
                      handleLoadSample(sample.id);
                    }}
                    className="rounded-2xl border border-edge bg-surface/80 p-4 text-left hover:border-accent hover:bg-accent-subtle/60 dark:border-edge dark:bg-surface/60 dark:hover:border-accent dark:hover:bg-accent-subtle/20"
                  >
                    <div className="font-medium text-content">
                      {sample.name}
                    </div>
                    <div className="mt-2 text-xs text-content-muted">
                      {sample.devices.length} devices • {sample.cables.length}{" "}
                      cables • {sample.heightU}U
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <Suspense fallback={null}>
        <CommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          extraItems={commandItems}
          registry={{
            viewModes: pluginRegistry.viewModes,
            commands: pluginRegistry.commands,
          }}
        />
      </Suspense>
      <Suspense fallback={null}>
        <InterRackCableWizard
          open={interRackWizardOpen}
          onClose={() => setInterRackWizardOpen(false)}
        />
      </Suspense>
    </div>
  );
}

export default App;
