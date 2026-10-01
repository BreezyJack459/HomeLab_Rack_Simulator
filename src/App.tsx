import {
  type ChangeEvent,
  lazy,
  Suspense,
  useCallback,
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
  Settings2,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { propertyTargetForIssue, type IssuePropertyTarget } from "./utils/checkWorkflow";
import { summarizeFindings, type FindingSection } from './utils/findingSummary';
import type { SampleDefinition } from "./data/learningSamples";
import type { CheckEditTarget } from './components/CheckIssueDetails';
import { getShellWorkflow, TOOL_WORKSPACES } from "./utils/shellWorkflow";
import { useCableWorkspaceStore } from "./store/cableWorkspaceStore";
import type { HealthCheckCategory } from "./components/RackHealthStrip";
import type { ActionMenusProps } from "./components/ActionBar";
import { DeviceLibraryToggle } from "./components/DeviceLibraryToggle";
import { ModelInspectorTabs } from "./components/ModelInspectorTabs";
import { RightInspectorShell } from "./components/RightInspectorShell";
import { StudioSaveStatus } from "./components/StudioSaveStatus";
import { WorkspaceActionPanel } from "./components/WorkspaceActionPanel";
import { useBuiltInPlugins } from "./plugins/useBuiltInPlugins";
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
  PanelPlacement,
} from "./types/appShell";
import {
  auditPanelIdsByLens,
  WORKSPACE_META,
} from "./types/panelRegistry";
import type {
  LifecycleViewFilter,
  RackLayout,
  RackType,
  ValidationIssue,
  ViewMode,
} from "./types/rack";
import { layoutUsesHiddenZeroUPdu, NEW_SHELL } from "./utils/featureFlags";
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
import type { DiagramFormat } from "./utils/diagramExport";

const LayoutRecovery = lazy(() => import('./components/LayoutRecovery').then(m => ({ default: m.LayoutRecovery })));

const APP_VERSION = "1.0.0";

// Classic summary is only needed when the classic shell is rendered.
const RackSummaryPanel = lazy(() => import("./components/RackSummaryPanel").then(m => ({ default: m.RackSummaryPanel })));

const CommandPalette = lazy(() =>
  import("./components/CommandPalette").then((m) => ({
    default: m.CommandPalette,
  })),
);
// New-shell chrome (NEW_SHELL flag): lazy so the classic shell keeps the
// eager bundle under the 500KB budget; the chunk is only fetched when the
// flag renders it.
const NewShellChrome = lazy(() =>
  import("./components/CanvasHeader").then((m) => ({
    default: m.NewShellChrome,
  })),
);
const ActionBar = lazy(() =>
  import("./components/ActionBar").then((m) => ({ default: m.ActionBar })),
);
const PrimaryNav = lazy(() =>
  import("./components/PrimaryNav").then((m) => ({ default: m.PrimaryNav })),
);
const TopContextBar = lazy(() =>
  import("./components/TopContextBar").then((m) => ({
    default: m.TopContextBar,
  })),
);
const CheckIssueDetails = lazy(() => import("./components/CheckIssueDetails").then(m => ({ default: m.CheckIssueDetails })));
const CableSidebar = lazy(() => import("./components/CableSidebar").then(m => ({ default: m.CableSidebar })));
const SamplePicker = lazy(() => import("./components/SamplePicker").then(module => ({ default: module.SamplePicker })));
const ExampleGuide = lazy(() => import("./components/ExampleGuide").then(module => ({ default: module.ExampleGuide })));
const CheckSidebar = lazy(() => import("./components/CheckSidebar").then(m => ({ default: m.CheckSidebar })));
const WorkspaceDialog = lazy(() => import("./components/WorkspaceDialog").then(m => ({ default: m.WorkspaceDialog })));
const WorkspaceBackup = lazy(() => import("./components/WorkspaceBackup").then(m => ({ default: m.WorkspaceBackup })));
const RackSettings = lazy(() => import("./components/RackSummarySettingsPanel").then(m => ({ default: m.RackSummarySettingsPanel })));
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
const CableLengthAuditPanel = lazy(() =>
  import("./components/CableLengthAuditPanel").then((m) => ({
    default: m.CableLengthAuditPanel,
  })),
);
const DepthCompatibilityPanel = lazy(() =>
  import("./components/DepthCompatibilityPanel").then((m) => ({
    default: m.DepthCompatibilityPanel,
  })),
);
const PluginManagerPanel = lazy(() =>
  import("./components/PluginManagerPanel").then((m) => ({
    default: m.PluginManagerPanel,
  })),
);
const FaceplateGallery = import.meta.env.DEV
  ? lazy(() =>
      import("./components/FaceplateGallery").then((m) => ({
        default: m.FaceplateGallery,
      })),
    )
  : undefined;

// ── Workspace Hero (lightweight inline shell for plugin-pack workspaces) ────

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

function App() {
  const [workspaceBackupOpen, setWorkspaceBackupOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const layout = useRackStore((state) => state.layout);
  const workspace = useRackStore((state) => state.workspace);
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
  const saveLocal = useRackStore((state) => state.saveLocal);
  const loadLocal = useRackStore((state) => state.loadLocal);
  const newLayout = useRackStore((state) => state.newLayout);
  const loadLayout = useRackStore((state) => state.loadLayout);
  const loadSample = useRackStore((state) => state.loadSample);
  const undo = useRackStore((state) => state.undo);
  const redo = useRackStore((state) => state.redo);
  const canUndo = useRackStore((state) => state.canUndo);
  const canRedo = useRackStore((state) => state.canRedo);
  const setDeviceLibraryOpen = useLayoutPrefsStore(
    (state) => state.setDeviceLibraryOpen,
  );
  const deviceLibraryOpen = useLayoutPrefsStore(
    (state) => state.deviceLibraryOpen,
  );
  const deviceLibraryDrawerOpen = useLayoutPrefsStore(
    (state) => state.deviceLibraryDrawerOpen,
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
    type: "new" | "sample" | "import";
    payload?: string;
    importedLayout?: RackLayout;
    targetRackId?: string;
  }>(null);
  const [inspectorModalMode, setInspectorModalMode] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 1279px)").matches
      : false,
  );
  const [libraryModalMode, setLibraryModalMode] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 1023px)").matches
      : false,
  );
  const [inspectorOpen, setInspectorOpen] = useState(() => {
    const desktopPreference = useLayoutPrefsStore.getState().inspectorOpen;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return desktopPreference;
    }
    return window.matchMedia("(min-width: 1280px)").matches ? desktopPreference : false;
  });
  const connectionRequested = useCableWorkspaceStore(s => s.connectionRequested);
  useEffect(() => {
    if (connectionRequested) setInspectorOpen(false);
  }, [connectionRequested]);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(max-width: 1279px)");
    const update = () => {
      setInspectorModalMode(query.matches);
      setInspectorOpen(query.matches ? false : useLayoutPrefsStore.getState().inspectorOpen);
    };
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(max-width: 1023px)");
    const update = () => setLibraryModalMode(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const [checkSeverity, setCheckSeverity] = useState<'attention' | ValidationIssue['severity'] | 'all' | FindingSection>('attention');
  const [checkCategory, setCheckCategory] = useState<HealthCheckCategory>('overview');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [checkEditContext, setCheckEditContext] = useState<{ issue: ValidationIssue; rackId: string; deviceId?: string; targetRackId: string; target?: IssuePropertyTarget } | null>(null);
  const [reviewedIssue, setReviewedIssue] = useState<{ id: string; title: string; rackId: string } | null>(null);
  const [lifecycleFilter, setLifecycleFilter] =
    useState<LifecycleViewFilter>("all");
  const [serviceabilityOverlayEnabled, setServiceabilityOverlayEnabled] =
    useState(false);
  const [serviceabilityFocusDeviceIds, setServiceabilityFocusDeviceIds] =
    useState<string[]>([]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [sampleDefinitions, setSampleDefinitions] = useState<SampleDefinition[]>([]);
  const [samplePickerOpen, setSamplePickerOpen] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] =
    useState<AppWorkspace>("model");
  const [settingsDialog, setSettingsDialog] = useState<'rack' | 'plugins' | null>(null);
  const lastBuildView = useRef<ViewMode>('2d');
  const lastCableView = useRef<ViewMode>('cables');
  const workflow = getShellWorkflow(currentWorkspace, viewMode);
  useEffect(() => {
    if (viewMode === '2d' || viewMode === '3d') lastBuildView.current = viewMode;
    if (viewMode === 'cables' || viewMode === 'topology') lastCableView.current = viewMode;
  }, [viewMode]);
  function handleSelectWorkflow(next: "build" | "cable" | "check") {
    if (next === "check") {
      setCurrentWorkspace("audit");
      return;
    }
    if (next === "cable" && !enabledPluginIds.includes("cable-management"))
      setEnabledPluginIds([...enabledPluginIds, "cable-management"]);
    setCurrentWorkspace("model");
    setViewMode(next === "cable" ? lastCableView.current : lastBuildView.current);
  }
  function handleConnectFromSidebar() {
    useLayoutPrefsStore.getState().setDeviceLibraryDrawerOpen(false);
    setInspectorOpen(false);
    setViewMode('cables');
    useCableWorkspaceStore.getState().requestConnection();
  }
  const [currentLensByWorkspace, setCurrentLensByWorkspace] = useState<
    Record<string, string>
  >({ audit: "overview" });
  const setWorkspaceLens = useCallback((workspaceId: string, lens: string) => {
    setCurrentLensByWorkspace((prev) => ({ ...prev, [workspaceId]: lens }));
  }, []);
  const currentAuditLens = (currentLensByWorkspace.audit ??
    "overview") as AuditLens;

  const issues = useMemo(() => validateRackLayout(layout, workspace), [layout, workspace]);
  const findingSummary = useMemo(() => summarizeFindings(issues, layout), [issues, layout.findingExceptions]);
  const totals = useMemo(() => getRackTotals(layout, workspace), [layout, workspace]);
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
    () => sampleDefinitions.filter((sample) => !layoutUsesHiddenZeroUPdu(sample.layout)),
    [sampleDefinitions],
  );
  const hasSelection = Boolean(
    selectedDeviceId || selectedCableId || selectedInterRackCableId,
  );
  const cablePluginEnabled = enabledPluginIds.includes("cable-management");
  const operationsPackEnabled = enabledPluginIds.includes("operations-pack");
  const resolvedLocalPackages = useMemo(
    () =>
      resolveLocalPackagePlugins({
        catalogEntries: pluginCatalogEntries,
        approvedLocalPluginIds,
      }),
    [approvedLocalPluginIds],
  );
  const {
    plugins: loadedBuiltInPlugins,
    loadError: pluginLoadError,
    pendingPluginIds,
  } = useBuiltInPlugins(enabledPluginIds);
  useEffect(() => {
    if (pluginLoadError) useRackStore.setState({ statusMessage: pluginLoadError });
  }, [pluginLoadError]);
  const pluginRegistry = useMemo(
    () =>
      buildPluginRegistry({
        appVersion: APP_VERSION,
        plugins: [...loadedBuiltInPlugins, ...resolvedLocalPackages.loadablePlugins],
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
      loadedBuiltInPlugins,
      serviceabilityHighlightIds,
      serviceabilityOverlayEnabled,
      setViewMode,
      viewMode,
    ],
  );
  const workspaceLoading = TOOL_WORKSPACES.some((workspace) =>
    workspace.id === currentWorkspace && pendingPluginIds.includes(workspace.pluginId),
  );
  const selectedIssue = useMemo(
    () => findingSummary.groups.find(group => group.issues.some(issue => issue.id === selectedIssueId))?.representative ?? null,
    [findingSummary, selectedIssueId],
  );
  const topIssue = useMemo(
    () => findingSummary.groups.find(group => group.acceptance !== 'accepted' && group.section !== 'information')?.representative ?? null,
    [findingSummary],
  );

  useEffect(() => {
    // The DEV-only faceplate gallery is a core special case rendered outside
    // the plugin view-mode registry, so it must bypass this reset.
    if (import.meta.env.DEV && viewMode === "gallery") {
      return;
    }
    const supportsCurrentView = pluginRegistry.viewModes.some(
      (definition) => definition.id === viewMode,
    );
    if (!supportsCurrentView) {
      setViewMode("2d");
    }
  }, [pluginRegistry.viewModes, setViewMode, viewMode]);

  useEffect(() => {
    if (currentWorkspace === "model" || currentWorkspace === "audit") {
      return;
    }
    const workspaceAvailable = pluginRegistry.workspaces.some(
      (contribution) => contribution.id === currentWorkspace,
    );
    // “Enable & open” selects the workspace before its code has downloaded.
    if (!workspaceAvailable && !workspaceLoading) {
      setCurrentWorkspace("model");
    }
  }, [currentWorkspace, pluginRegistry.workspaces, workspaceLoading]);

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
        setSampleDefinitions(module.sampleDefinitions);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  function handleIssueSelect(issue: ValidationIssue) {
    setReviewedIssue(null);
    setCheckEditContext(null);
    if (NEW_SHELL) {
      if (libraryModalMode) useLayoutPrefsStore.getState().setDeviceLibraryDrawerOpen(false);
      setInspectorOpen(true);
    }
    setSelectedIssueId(issue.id);
    setCurrentWorkspace("audit");
    setWorkspaceLens("audit", "issues");
    if (issue.deviceIds?.length) selectDevice(issue.deviceIds[0]);
    if (issue.cableIds?.length) {
      selectCable(issue.cableIds[0]);
      setViewMode("cables");
    }
  }

  function handleCheckEdit(target?: CheckEditTarget) {
    if (!selectedIssue) return;
    const source = issues.find(issue => issue.id === selectedIssueId) ?? selectedIssue;
    const issue = target ? { ...source,
      deviceIds: target.deviceId ? [target.deviceId] : undefined,
      cableIds: target.cableId ? [target.cableId] : undefined,
      editTarget: target.deviceId === source.editTarget?.deviceId ? source.editTarget : undefined,
    } : source;
    setCheckEditContext({ issue, rackId: layout.id,
      targetRackId: issue.editTarget?.rackId ?? layout.id,
      deviceId: issue.editTarget?.deviceId ?? (issue.cableIds?.length ? undefined : issue.deviceIds?.[0]),
      target: issue.editTarget || !issue.cableIds?.length ? propertyTargetForIssue(issue) : undefined });
    if (issue.editTarget) {
      useRackStore.getState().switchRack(issue.editTarget.rackId);
      useRackStore.getState().selectDevice(issue.editTarget.deviceId);
    } else if (issue.cableIds?.length) selectCable(issue.cableIds[0]);
    else if (issue.deviceIds?.length) selectDevice(issue.deviceIds[0]);
    handleSelectWorkflow(issue.cableIds?.length ? 'cable' : 'build');
    setInspectorOpen(true);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const targetRackId = useRackStore.getState().currentRackId;
    try {
      const { readJsonFile } = await import("./utils/exporters");
      const imported = await readJsonFile(file);
      const { validateImportedLayout } = await import("./utils/layoutValidation");
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
          statusMessage: "Invalid rack layout JSON file. Current data has not changed.",
        });
        input.value = "";
        return;
      }
      const validation = validateImportedLayout(candidate);
      if (!validation.valid) {
        useRackStore.setState({ statusMessage: "Invalid rack layout JSON file. Current data has not changed." });
        return;
      }
      setConfirmAction({ type: "import", importedLayout: validation.layout, targetRackId });
    } catch {
      useRackStore.setState({
        statusMessage: "Failed to read rack layout file.",
      });
    }
    input.value = "";
  }

  function handleNewLayout() {
    setConfirmAction({ type: "new" });
  }

  function handleLoadSample(sampleId: string) {
    if (!sampleId) return;
    // Settings, inventory and records can matter even in an empty rack.
    setConfirmAction({ type: "sample", payload: sampleId });
  }

  function handleConfirm() {
    if (!confirmAction) return;
    if (confirmAction.type === "new") {
      newLayout(layout.rackType, layout.heightU);
    } else if (confirmAction.type === "import" && confirmAction.importedLayout) {
      if (confirmAction.targetRackId !== useRackStore.getState().currentRackId) {
        useRackStore.setState({ statusMessage: "Current rack changed. Import cancelled; choose the file again for the intended rack." });
      } else {
        loadLayout(confirmAction.importedLayout);
      }
    } else if (confirmAction.type === "sample" && confirmAction.payload) {
      loadSample(confirmAction.payload);
    }
    setConfirmAction(null);
  }

  function handleDuplicate() {
    useRackStore.getState().duplicateRack(layout.id, `${layout.name} (copy)`);
  }

  async function handleExportLayoutJson() {
    const { exportLayoutJson } = await import("./utils/exporters");
    exportLayoutJson(layout);
  }

  async function handleExportRackPng() {
    const { exportRackPng } = await import("./utils/exporters");
    exportRackPng(layout);
  }

  async function handleExportDiagram(format: DiagramFormat) {
    const [{ downloadTextFile }, { exportDiagram }] = await Promise.all([
      import("./utils/exporters"),
      import("./utils/diagramExport"),
    ]);
    const result = exportDiagram(layout, format);
    downloadTextFile(result.filename, result.content, result.mimeType);
  }

  function handleAddDeviceTask() {
    setCurrentWorkspace("model");
    setViewMode("2d");
    setDeviceLibraryOpen(true);
    if (libraryModalMode) useLayoutPrefsStore.getState().setDeviceLibraryDrawerOpen(true);
  }

  function handleAddCableTask() {
    handleSelectWorkflow("cable");
    handleConnectFromSidebar();
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
            // Bare name only; the TopContextBar plugins menu renders the
            // On/Off/Blocked state pill itself from enabled/disabled.
            label: plugin.name,
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
    setWorkspaceLens("audit", "issues");
    if (topIssue) {
      handleIssueSelect(topIssue);
    }
  }

  function handleOpenRackSettingsTask() {
    if (NEW_SHELL) { setSettingsDialog("rack"); return; }
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
        return <PropertyPanel focusTarget={checkEditContext?.deviceId === selectedDeviceId && checkEditContext.targetRackId === layout.id ? checkEditContext.target : undefined} />;
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
      case "cable-length-audit":
        return <CableLengthAuditPanel />;
      case "depth-compatibility":
        return <DepthCompatibilityPanel />;
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

  const activeWorkspaceContribution = pluginRegistry.workspaces.find(
    (contribution) => contribution.id === currentWorkspace,
  );
  const activeWorkspaceMeta =
    currentWorkspace === "model" || currentWorkspace === "audit"
      ? WORKSPACE_META[currentWorkspace]
      : (activeWorkspaceContribution ?? WORKSPACE_META.model);

  const inspectorTitle = getInspectorTitle(
    currentWorkspace,
    selectedIssue,
    activeWorkspaceMeta,
  );

  const inspectorDescription = getInspectorDescription(
    currentWorkspace,
    currentAuditLens,
    hasSelection,
    selectedIssue,
    activeWorkspaceMeta,
  );

  function renderInspectorPanels() {
    const panels = visiblePanels(currentWorkspace, "inspector").filter(
      (p) => !NEW_SHELL || p.id !== "plugin-manager",
    );
    if (NEW_SHELL && workflow === "cable")
      return <Suspense fallback={null}>{renderPanel("cable-planner")}</Suspense>;
    if (
      NEW_SHELL &&
      workflow === "check" &&
      (currentAuditLens === "overview" || currentAuditLens === "issues")
    )
      return (
        <Suspense fallback={null}>
          <CheckIssueDetails
            issue={selectedIssue}
            reviewedTitle={reviewedIssue?.id === selectedIssueId && reviewedIssue.rackId === layout.id ? reviewedIssue.title : undefined}
            onEditRack={handleOpenRackSettingsTask}
            onEdit={() => handleCheckEdit()}
            onEditTarget={handleCheckEdit}
          />
        </Suspense>
      );

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
            <div className="mt-2 font-semibold">
              Start with the rack, not the settings.
            </div>
            <p className="mt-1 text-xs leading-5 text-accent-fg-strong/80 dark:text-accent-fg-strong/75">
              Add a device, connect existing gear, or open rack settings when you
              need to change size, power budget, or filters.
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
          {!NEW_SHELL &&
            helpfulPanels.map((panel) => (
              <Suspense fallback={null} key={panel.id}>
                {renderPanel(panel.id)}
              </Suspense>
            ))}
        </>
      );
    }
    if (currentWorkspace === "model") {
      const renderModelPanelGroup = (panelIds: AppPanelId[]) => {
        const groupedPanels = panels.filter((panel) =>
          panelIds.includes(panel.id),
        );
        if (groupedPanels.length === 0) return null;
        return groupedPanels.map((panel) => (
          <Suspense fallback={null} key={panel.id}>
            {renderPanel(panel.id)}
          </Suspense>
        ));
      };
      const tabbedPanelIds: AppPanelId[] = [
        "property",
        "cable-planner",
        "port-reservation",
        "port-speed",
      ];
      const extraPanels = panels.filter(
        (panel) => !tabbedPanelIds.includes(panel.id),
      );
      const cableSelectionId = selectedCableId ?? selectedInterRackCableId;

      return (
        <>
          <ModelInspectorTabs
            selectionKind={cableSelectionId ? "cable" : "device"}
            selectionKey={cableSelectionId ?? selectedDeviceId ?? "selection"}
            properties={renderModelPanelGroup(["property"])}
            cables={renderModelPanelGroup(["cable-planner"])}
            ports={renderModelPanelGroup(["port-reservation", "port-speed"])}
          />
          {extraPanels.map((panel) => (
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
              onClick: () => setWorkspaceLens("audit", "serviceability"),
            },
            {
              label: "Documentation lens",
              detail: "Review labels, evidence and drift together.",
              onClick: () => setWorkspaceLens("audit", "documentation"),
            },
            {
              label: "Thermal lens",
              detail: "Check heat, power headroom and environmental pressure.",
              onClick: () => setWorkspaceLens("audit", "thermal"),
            },
            {
              label: "Domains lens",
              detail: "Inspect redundancy and assignment gaps.",
              onClick: () => setWorkspaceLens("audit", "domains"),
            },
          ]}
        />
      );
    }
    if (activeWorkspaceContribution?.renderInspector) {
      const lens =
        currentLensByWorkspace[activeWorkspaceContribution.id] ??
        activeWorkspaceContribution.lenses[0]?.id ??
        "";
      return activeWorkspaceContribution.renderInspector(lens, (nextLens) =>
        setWorkspaceLens(activeWorkspaceContribution.id, nextLens),
      );
    }
    if (panels.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-edge-strong bg-surface/60 p-4 text-sm text-content-muted dark:border-edge-strong dark:bg-surface/60 dark:text-content-muted">
          Use Search to jump to a task, or choose a lens in the main workspace to
          show the related controls here.
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
          setWorkspaceLens("audit", "thermal");
        },
        category: "Quick tasks",
      },
      {
        id: "task-manage-plugins",
        type: "quick-action",
        title: "Manage plugins",
        subtitle: "Enable or disable optional workflow packs",
        icon: (
          <Settings2
            size={16}
            className="text-content-muted"
          />
        ),
        action: () => {
          if (NEW_SHELL) setSettingsDialog('plugins');
          else { setCurrentWorkspace("model"); setInspectorOpen(true); }
        },
        category: "Quick tasks",
      },
    ];
    if (operationsPackEnabled) {
      quickActions.push({
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
          setWorkspaceLens("operate", "firmware");
        },
        category: "Quick tasks",
      });
    }
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

    const workspaceItems: SearchItem[] = [
      ...(Object.keys(WORKSPACE_META) as AppWorkspace[]).map((workspaceId) => ({
        id: `workspace-${workspaceId}`,
        type: "workspace" as const,
        title: WORKSPACE_META[workspaceId as keyof typeof WORKSPACE_META].title,
        subtitle:
          WORKSPACE_META[workspaceId as keyof typeof WORKSPACE_META]
            .description,
        icon: (
          <span className="text-accent-fg">
            {WORKSPACE_META[workspaceId as keyof typeof WORKSPACE_META].icon}
          </span>
        ),
        action: () => setCurrentWorkspace(workspaceId),
        category: "Workspaces",
      })),
      ...pluginRegistry.workspaces.map((contribution) => ({
        id: `workspace-${contribution.id}`,
        type: "workspace" as const,
        title: contribution.title,
        subtitle: contribution.description,
        icon: (
          <span className="text-accent-fg">
            {contribution.icon}
          </span>
        ),
        action: () => setCurrentWorkspace(contribution.id),
        category: "Workspaces",
      })),
    ];

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
        .join(", ")
        .replace(/-/g, " ");
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
    operationsPackEnabled,
    enabledPluginIds,
    approvedLocalPluginIds,
    pluginRegistry.panels,
    pluginRegistry.workspaces,
    pluginRegistry.pluginStates.incompatible,
    resolvedLocalPackages.catalogEntries,
    setViewMode,
    setWorkspaceLens,
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
    if (viewMode === 'cable-labels') return <Suspense fallback={<p role="status">Loading labels…</p>}>{renderCanvas()}</Suspense>;
    return (
      <Suspense fallback={null}>
        <ModelWorkspaceLayout
          layout={layout}
          canvas={renderCanvas()}
          sidebar={
            NEW_SHELL && workflow === "cable" ? (
              <CableSidebar onConnect={handleConnectFromSidebar} />
            ) : undefined
          }
          sidebarLabel={workflow === "cable" ? "Cable list" : "Device library"}
        />
      </Suspense>
    );
  }

  function renderAuditWorkspace() {
    if (NEW_SHELL)
      return (
        <Suspense fallback={null}>
          <ModelWorkspaceLayout
            layout={layout}
            sidebarLabel="Check issues"
            sidebar={
              <CheckSidebar
                issues={issues}
                layout={layout}
                severity={checkSeverity}
                onSeverity={setCheckSeverity}
                category={checkCategory}
                onCategory={setCheckCategory}
                strictCabling={(layout.policies ?? []).some((policy) => policy.type === 'no-endpoint-switch-direct' && policy.enabled)}
                onStrictCabling={(strict) => {
                  const policies = layout.policies ?? [];
                  const existing = policies.some((policy) => policy.type === 'no-endpoint-switch-direct');
                  useRackStore.getState().updateRack({ policies: existing
                    ? policies.map((policy) => policy.type === 'no-endpoint-switch-direct' ? { ...policy, enabled: strict } : policy)
                    : [...policies, { id: 'check-direct-switch-policy', type: 'no-endpoint-switch-direct', enabled: strict, severity: 'warning', params: {} }],
                  });
                }}
                selectedId={selectedIssueId}
                onSelect={handleIssueSelect}
                lens={currentAuditLens}
                onLens={(lens) => setWorkspaceLens("audit", lens)}
              />
            }
            canvas={
              currentAuditLens === "overview" || currentAuditLens === "issues" ? (
                <RackEditor2D
                  layoutOverride={filteredLayout}
                  highlightedDeviceIds={selectedIssue?.deviceIds ?? []}
                />
              ) : (
                <div className="h-full overflow-y-auto p-3">
                  {renderPanelGrid(
                    "audit",
                    auditPanelIdsByLens[currentAuditLens],
                  )}
                </div>
              )
            }
          />
        </Suspense>
      );
    return (
      <div className="space-y-4 overflow-y-auto p-4">
        <Suspense fallback={null}>
          <AuditWorkbench
            layout={layout}
            issues={issues}
            totals={{
              powerW: totals.powerW,
              powerInputUnverified: totals.powerInputUnverified,
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
            onSelectLens={(lens) => setWorkspaceLens("audit", lens)}
            onIssueSelect={handleIssueSelect}
          />
        </Suspense>
        {renderPanelGrid("audit", auditPanelIdsByLens[currentAuditLens])}
      </div>
    );
  }

  function renderPluginWorkspace() {
    if (!activeWorkspaceContribution) {
      if (workspaceLoading) {
        return <div role="status" className="p-4 text-content-muted">Loading workspace…</div>;
      }
      return renderModelWorkspace();
    }
    const contribution = activeWorkspaceContribution;
    const lens =
      currentLensByWorkspace[contribution.id] ??
      contribution.lenses[0]?.id ??
      "";
    const lensPanelIds = contribution.lenses.find(
      (item) => item.id === lens,
    )?.panelIds;
    return (
      <div className="space-y-4 overflow-y-auto p-4">
        <WorkspaceHero
          title={contribution.title}
          description={contribution.description}
          icon={contribution.icon}
        />
        {contribution.renderWorkbench?.(lens, (nextLens) =>
          setWorkspaceLens(contribution.id, nextLens),
        )}
        {renderPanelGrid(contribution.id, lensPanelIds)}
      </div>
    );
  }

  function renderWorkspaceMain() {
    if (currentWorkspace === "model") return renderModelWorkspace();
    if (currentWorkspace === "audit") return renderAuditWorkspace();
    // Pack-contributed workspace (operate/plan/portfolio); when its pack is
    // disabled the effect above resets to "model" and this falls back too.
    return renderPluginWorkspace();
  }

  // Shared Create/Actions/File menu handlers, passed to the classic ActionBar
  // or (when NEW_SHELL) the CanvasHeader — menu contents live in ActionBar.
  const shellMenuProps: ActionMenusProps = {
    canUndo: canUndo(),
    canRedo: canRedo(),
    issueCount: findingSummary.counts.attention,
    onAddDevice: handleAddDeviceTask,
    onAddCable: cablePluginEnabled ? handleAddCableTask : null,
    onFixAlerts: handleFixAlertsTask,
    onOpenSearch: () => setCommandOpen(true),
    onNewLayout: handleNewLayout,
    onDuplicate: handleDuplicate,
    onUndo: undo,
    onRedo: redo,
    onSaveLocal: saveLocal,
    onLoadLocal: loadLocal,
    onImportLayout: () => fileInputRef.current?.click(),
    onLoadSample: () => setSamplePickerOpen(true),
    onExportJson: () => void handleExportLayoutJson(),
    onWorkspaceBackup: () => setWorkspaceBackupOpen(true),
    onExportPng: () => void handleExportRackPng(),
    onExportDrawio: () => void handleExportDiagram("drawio"),
    onExportExcalidraw: () => void handleExportDiagram("excalidraw"),
    onExportSvg: () => void handleExportDiagram("svg"),
  };

  function renderRackSummaryPanel(compact: boolean) {
    return (
      <RackSummaryPanel
        embedded
        compact={compact}
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
    );
  }

  return (
    <div className="studio-workspace flex h-screen w-screen max-w-full overflow-hidden bg-fill-subtle text-content dark:bg-surface dark:text-content">
      {!NEW_SHELL && (
        <Suspense fallback={null}>
          <PrimaryNav
            currentWorkspace={currentWorkspace}
            onSelectWorkspace={setCurrentWorkspace}
            pluginWorkspaces={pluginRegistry.workspaces}
          />
        </Suspense>
      )}

      <div className="flex min-w-0 w-0 flex-1 flex-col">
        <Suspense fallback={null}><LayoutRecovery /></Suspense>
        {NEW_SHELL ? (
          <Suspense fallback={null}>
            <NewShellChrome
              currentWorkspace={currentWorkspace}
              pluginWorkspaces={pluginRegistry.workspaces}
              onSelectWorkspace={setCurrentWorkspace}
              onSelectWorkflow={handleSelectWorkflow}
              onOpenSettings={handleOpenRackSettingsTask}
              onManagePlugins={() => setSettingsDialog('plugins')}
              pluginToggles={pluginToggles}
              onOpenCommand={() => setCommandOpen(true)}
              layout={layout}
              totals={totals}
              issues={issues}
              deviceLibraryOpen={libraryModalMode ? deviceLibraryDrawerOpen : deviceLibraryOpen}
              onToggleDeviceLibrary={toggleDeviceLibrary}
              onRenameLayout={(name) => updateRack({ name })}
              viewMode={viewMode}
              viewModes={pluginRegistry.viewModes}
              onToggleViewMode={setViewMode}
              onSetViewSide={setViewSide}
              toolbarActions={toolbarActions}
              onOpenCheck={(category = 'overview', severity) => {
                if (libraryModalMode) {
                  setInspectorOpen(false);
                  useLayoutPrefsStore.getState().setDeviceLibraryDrawerOpen(true);
                }
                setCheckCategory(category);
                setCheckSeverity(severity ?? (category === 'overview' ? 'attention' : 'all'));
                setSelectedIssueId(null);
                setWorkspaceLens('audit', category === 'thermal' ? 'thermal' : 'issues');
                setCurrentWorkspace('audit');
              }}
              {...shellMenuProps}
            />
          </Suspense>
        ) : (
          <Suspense fallback={null}>
            <TopContextBar
              workspace={workspace}
              layout={layout}
              currentWorkspace={currentWorkspace}
              pluginWorkspaces={pluginRegistry.workspaces}
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
              contextContent={
                currentWorkspace === "model" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <DeviceLibraryToggle
                      open={libraryModalMode ? deviceLibraryDrawerOpen : deviceLibraryOpen}
                      onToggle={toggleDeviceLibrary}
                    />
                    {renderRackSummaryPanel(false)}
                  </div>
                ) : null
              }
              {...shellMenuProps}
            />
          </Suspense>
        )}

        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          accept="application/json,.json"
          onChange={handleImport}
        />

        <div
          className={`relative grid min-h-0 flex-1 grid-cols-1 ${
            inspectorOpen
              ? NEW_SHELL
                ? "xl:grid-cols-[minmax(0,1fr)_300px]"
                : "xl:grid-cols-[minmax(0,1fr)_380px]"
              : "xl:grid-cols-[minmax(0,1fr)_72px]"
          }`}
        >
          <main className="min-w-0 overflow-hidden">
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3">
                {layout.example && (currentWorkspace === 'model' || currentWorkspace === 'audit') && (() => {
                  const example = sampleDefinitions.find(sample => sample.layout.id === layout.example?.sampleId);
                  return example ? <Suspense fallback={null}><ExampleGuide sample={example} /></Suspense> : null;
                })()}
                {renderWorkspaceMain()}
              </div>
              {currentWorkspace !== "model" && !NEW_SHELL && (
                <Suspense fallback={null}>
                  <BottomTray
                    layout={layout}
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
            compact={NEW_SHELL}
            title={NEW_SHELL && workflow === 'cable' ? 'Cable details' : NEW_SHELL && workflow === 'check' ? 'Issue details' : inspectorTitle}
            description={inspectorDescription}
            open={inspectorOpen}
            onToggle={() => {
              const nextOpen = !inspectorOpen;
              setInspectorOpen(nextOpen);
              if (!inspectorModalMode) {
                useLayoutPrefsStore.getState().setInspectorOpen(nextOpen);
              }
            }}
          >
            {NEW_SHELL && checkEditContext && workflow !== 'check' && (
              <div className="sticky top-0 z-20 mb-3 flex items-center gap-2 rounded-xl border border-accent/30 bg-surface p-2 shadow-sm" aria-label="Editing from Check">
                <p className="min-w-0 flex-1 truncate text-xs font-semibold text-accent-fg" title={checkEditContext.issue.title}>From Check: {checkEditContext.issue.title}</p>
                <button type="button" className="shrink-0 rounded-lg border border-edge bg-surface px-3 py-2 text-xs hover:bg-fill" onClick={() => {
                  const originExists = workspace.racks.some(rack => rack.id === checkEditContext.rackId);
                  if (originExists && layout.id !== checkEditContext.rackId) useRackStore.getState().switchRack(checkEditContext.rackId);
                  setSelectedIssueId(originExists ? checkEditContext.issue.id : null);
                  setReviewedIssue(originExists ? { id: checkEditContext.issue.id, title: checkEditContext.issue.title, rackId: checkEditContext.rackId } : null);
                  setCurrentWorkspace('audit');
                  setWorkspaceLens('audit', 'issues');
                  setInspectorOpen(true);
                  setCheckEditContext(null);
                }}>Return to check</button>
              </div>
            )}
            {renderInspectorPanels()}
          </RightInspectorShell>
        </div>

        {NEW_SHELL && <StudioSaveStatus onExport={shellMenuProps.onExportJson} message={statusMessage} />}

        {settingsDialog && (
          <Suspense fallback={null}>
            <WorkspaceDialog
              title={settingsDialog === "rack" ? "Rack settings" : "Manage plugins"}
              onClose={() => setSettingsDialog(null)}
            >
              {settingsDialog === "plugins" ? renderPanel("plugin-manager") : (
                <RackSettings
                  inline
                  layout={layout}
                  lifecycleFilter={lifecycleFilter}
                  onLifecycleFilterChange={setLifecycleFilter}
                  onRackTypeChange={setRackType}
                  onRackHeightChange={setRackHeight}
                  onRackDepthChange={(rackDepthMm) => updateRack({ rackDepthMm })}
                  onFrontDoorClearanceChange={(frontDoorClearanceMm) => updateRack({ frontDoorClearanceMm })}
                  onRearDoorClearanceChange={(rearDoorClearanceMm) => updateRack({ rearDoorClearanceMm })}
                  onRearCableClearanceChange={(rearClearanceMm) => updateRack({ rearClearanceMm })}
                  onPowerBudgetChange={(powerBudgetW) => updateRack({ powerBudgetW })}
                />
              )}
            </WorkspaceDialog>
          </Suspense>
        )}
        {workspaceBackupOpen && <Suspense fallback={null}><WorkspaceBackup onClose={() => setWorkspaceBackupOpen(false)} /></Suspense>}
        {confirmAction && <Suspense fallback={null}>
          <WorkspaceDialog title={confirmAction.type === 'new' ? 'Start a new layout?' : confirmAction.type === 'import' ? 'Import rack layout?' : 'Load sample layout?'} onClose={() => setConfirmAction(null)}>
            <p className="mb-3 text-sm text-content-secondary">This will replace the current rack, including its settings, inventory and records. Other racks remain unchanged. Connections to replaced devices may be removed. Undo history for this rack will reset; download a backup first if you need to keep it.</p>
            {confirmAction.type === 'import' && confirmAction.importedLayout && <p className="mb-3 text-sm font-semibold">Import “{confirmAction.importedLayout.name}”: {confirmAction.importedLayout.devices.length} installed devices, {confirmAction.importedLayout.unplacedDevices?.length ?? 0} unplaced devices, {confirmAction.importedLayout.cables?.length ?? 0} cables.</p>}
            {confirmAction.type === 'sample' && <>
              <p className="mb-3 text-sm font-semibold">{sampleDefinitions.find(sample => sample.layout.id === confirmAction.payload)?.title}</p>
              {sampleDefinitions.find(sample => sample.layout.id === confirmAction.payload)?.kind === 'exercise' && <p className="mb-3 text-sm font-semibold text-amber-600">INTENTIONAL FAULTS · 故意設置問題：This exercise deliberately includes mistakes to repair.</p>}
              <p className="mb-4 text-xs text-content-muted" lang="zh-Hant">將替換當前機架的設定、待放置設備及記錄。取消或關閉可保留現有計劃。</p>
            </>}
            <div className="flex gap-2">
              <button autoFocus type="button" onClick={() => setConfirmAction(null)} className="min-h-10 flex-1 rounded-lg border border-edge px-3 py-2">Cancel</button>
              <button type="button" onClick={handleConfirm} className="min-h-10 flex-1 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-700">Confirm</button>
            </div>
          </WorkspaceDialog>
        </Suspense>}
        {samplePickerOpen && <Suspense fallback={null}><SamplePicker definitions={visibleSampleLayouts} onClose={() => setSamplePickerOpen(false)} onSelect={sampleId => {
          setSamplePickerOpen(false);
          handleLoadSample(sampleId);
        }} /></Suspense>}

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
    </div>
  );
}

export default App;
