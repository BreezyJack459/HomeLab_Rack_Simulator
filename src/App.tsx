import {
  type ChangeEvent,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertTriangle, Box, Settings2 } from "lucide-react";
import { ActionBar } from "./components/ActionBar";
import { PrimaryNav } from "./components/PrimaryNav";
import { RightInspectorShell } from "./components/RightInspectorShell";
import { TopContextBar } from "./components/TopContextBar";
import { MetricCard } from "./components/WorkbenchPrimitives";
import { useRackStore } from "./store/rackStore";
import type {
  AppPanelId,
  AppWorkspace,
  AuditLens,
  OperateLens,
  PlanLens,
  PortfolioLens,
  PanelPlacement,
  PanelRegistryItem,
} from "./types/appShell";
import {
  auditPanelIdsByLens,
  operatePanelIdsByLens,
  PANEL_REGISTRY,
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
import type { SearchItem } from "./components/CommandPalette";

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
const CableMap = lazy(() =>
  import("./components/CableMap").then((m) => ({ default: m.CableMap })),
);
const NetworkTopology = lazy(() =>
  import("./components/NetworkTopology").then((m) => ({
    default: m.NetworkTopology,
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
const CablePlanner = lazy(() =>
  import("./components/CablePlanner").then((m) => ({
    default: m.CablePlanner,
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
    <section className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-cyan-500/12 p-3 text-cyan-700 dark:text-cyan-300">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>
      </div>
      {children && <div className="mt-4">{children}</div>}
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

  const [confirmAction, setConfirmAction] = useState<null | {
    type: "new" | "sample";
    payload?: string;
  }>(null);
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
  const selectedIssue = useMemo(
    () => issues.find((issue) => issue.id === selectedIssueId) ?? null,
    [issues, selectedIssueId],
  );

  useEffect(() => {
    if (layoutUsesHiddenZeroUPdu(layout)) {
      loadLayout(layout);
    }
  }, [layout, loadLayout]);

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
    const { readJsonFile } = await import("./utils/exporters");
    const imported = await readJsonFile(file);
    loadLayout(imported as typeof layout);
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

  const visiblePanels = useMemo(
    () => (workspaceId: AppWorkspace, placement: PanelPlacement) =>
      PANEL_REGISTRY.filter(
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
    [hasSelection, viewMode],
  );

  function renderPanel(panelId: AppPanelId) {
    switch (panelId) {
      case "property":
        return <PropertyPanel />;
      case "cable-planner":
        return <CablePlanner />;
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
    if (panels.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
          This workspace keeps most content in the main canvas. Use the command
          bar to jump directly to a panel.
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
    const workspaceItems: SearchItem[] = (
      Object.keys(WORKSPACE_META) as AppWorkspace[]
    ).map((workspaceId) => ({
      id: `workspace-${workspaceId}`,
      type: "workspace",
      title: WORKSPACE_META[workspaceId].title,
      subtitle: WORKSPACE_META[workspaceId].description,
      icon: (
        <span className="text-cyan-600 dark:text-cyan-300">
          {WORKSPACE_META[workspaceId].icon}
        </span>
      ),
      action: () => setCurrentWorkspace(workspaceId),
      category: "Workspaces",
    }));

    const panelItems: SearchItem[] = PANEL_REGISTRY.map((panel) => ({
      id: `panel-${panel.id}`,
      type: "panel",
      title: panel.title,
      subtitle: `${panel.workspace} workspace`,
      icon: (
        <Settings2 size={16} className="text-slate-500 dark:text-slate-400" />
      ),
      action: () => {
        setCurrentWorkspace(panel.workspace);
        if (panel.supportedViewModes?.length) {
          setViewMode(panel.supportedViewModes[0]);
        }
      },
      category: "Panels",
    }));

    const quickActions: SearchItem[] = [
      {
        id: "quick-open-sample",
        type: "quick-action",
        title: "Open sample picker",
        subtitle: "Load a sample layout into the current rack",
        icon: <Box size={16} className="text-slate-500 dark:text-slate-400" />,
        action: () => setSamplePickerOpen(true),
        category: "Quick Actions",
      },
      {
        id: "quick-show-issues",
        type: "quick-action",
        title: "Jump to audit issues",
        subtitle: "Open the audit workspace and inspect validation issues",
        icon: (
          <AlertTriangle
            size={16}
            className="text-slate-500 dark:text-slate-400"
          />
        ),
        action: () => setCurrentWorkspace("audit"),
        category: "Quick Actions",
      },
    ];

    return [...workspaceItems, ...panelItems, ...quickActions];
  }, [setViewMode]);

  function renderCanvas() {
    if (viewMode === "2d") {
      return (
        <RackEditor2D
          layoutOverride={filteredLayout}
          serviceabilityOverlay={serviceabilityOverlayEnabled}
          highlightedDeviceIds={serviceabilityHighlightIds}
        />
      );
    }
    if (viewMode === "3d") {
      return (
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">
              Loading 3D…
            </div>
          }
        >
          <RackViewer3D layout={filteredLayout} />
        </Suspense>
      );
    }
    if (viewMode === "cables") {
      return (
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">
              Loading cable map...
            </div>
          }
        >
          <CableMap layout={filteredLayout} />
        </Suspense>
      );
    }
    return (
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">
            Loading topology...
          </div>
        }
      >
        <NetworkTopology layout={filteredLayout} />
      </Suspense>
    );
  }

  function renderModelWorkspace() {
    return (
      <Suspense fallback={null}>
        <ModelWorkspaceLayout
          layout={layout}
          totals={totals}
          issues={issues}
          lifecycleFilter={lifecycleFilter}
          onLifecycleFilterChange={setLifecycleFilter}
          onRackTypeChange={setRackType}
          onRackHeightChange={setRackHeight}
          onPowerBudgetChange={(powerBudgetW) => updateRack({ powerBudgetW })}
          selectedIssueId={selectedIssueId}
          statusMessage={statusMessage}
          onIssueSelect={handleIssueSelect}
          onOpenAudit={() => setCurrentWorkspace("audit")}
          canvas={renderCanvas()}
        />
      </Suspense>
    );
  }

  function renderAuditWorkspace() {
    return (
      <div className="space-y-4 overflow-y-auto p-4">
        <WorkspaceHero
          title={WORKSPACE_META.audit.title}
          description={WORKSPACE_META.audit.description}
          icon={WORKSPACE_META.audit.icon}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              label="Critical"
              value={`${issues.filter((issue) => issue.severity === "critical").length}`}
              tone={
                issues.some((issue) => issue.severity === "critical")
                  ? "danger"
                  : "default"
              }
            />
            <MetricCard
              label="Warnings"
              value={`${issues.filter((issue) => issue.severity === "warning").length}`}
              tone={
                issues.some((issue) => issue.severity === "warning")
                  ? "warn"
                  : "default"
              }
            />
            <MetricCard
              label="Power headroom"
              value={`${Math.max(layout.powerBudgetW - totals.powerW, 0)}W`}
              tone={totals.powerW > layout.powerBudgetW ? "danger" : "default"}
            />
            <MetricCard
              label="Heat score"
              value={`${totals.heatScore}`}
              tone={totals.heatScore > 18 ? "warn" : "default"}
            />
            <MetricCard
              label="Doc gaps"
              value={`${documentationIssues.length}`}
              tone={
                documentationIssues.some(
                  (issue) => issue.severity === "warning",
                )
                  ? "warn"
                  : "default"
              }
            />
            <MetricCard
              label="Open debt"
              value={`${openDebtCount}`}
              tone={openDebtCount > 0 ? "warn" : "default"}
            />
          </div>
        </WorkspaceHero>
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
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <PrimaryNav
        currentWorkspace={currentWorkspace}
        onSelectWorkspace={setCurrentWorkspace}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopContextBar
          workspace={workspace}
          layout={layout}
          currentWorkspace={currentWorkspace}
          viewMode={viewMode}
          onOpenCommand={() => setCommandOpen(true)}
          onRenameLayout={(name) => updateRack({ name })}
          onToggleViewMode={setViewMode}
          onSetViewSide={setViewSide}
        />
        <ActionBar
          canUndo={canUndo()}
          canRedo={canRedo()}
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

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px]">
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
          >
            {renderInspectorPanels()}
          </RightInspectorShell>
        </div>

        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-80 rounded-lg border border-slate-300 bg-slate-100 p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                {confirmAction.type === "new" && "Start a new layout?"}
                {confirmAction.type === "sample" && "Load sample layout?"}
              </div>
              <div className="mb-4 text-xs text-slate-500 dark:text-slate-400">
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
                  className="h-9 flex-1 rounded-md border border-slate-300 bg-slate-200 text-sm text-slate-700 hover:bg-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
              className="w-full max-w-2xl rounded-3xl border border-slate-300 bg-slate-100 p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
              data-testid="sample-picker-modal"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-white">
                    Load sample layout
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Choose a sample to seed the current rack.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSamplePickerOpen(false)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
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
                    className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-left hover:border-cyan-300 hover:bg-cyan-50/60 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-cyan-700 dark:hover:bg-cyan-950/20"
                  >
                    <div className="font-medium text-slate-900 dark:text-white">
                      {sample.name}
                    </div>
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
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
