import { ChangeEvent, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Cable,
  Copy,
  Download,
  FileJson,
  Monitor,
  Network,
  Plus,
  Redo,
  RotateCcw,
  Save,
  Undo,
  Upload,
  View
} from 'lucide-react';
const CommandPalette = lazy(() => import('./components/CommandPalette').then((m) => ({ default: m.CommandPalette })));
import { ComponentLibrary } from './components/ComponentLibrary';
import { IssueBar } from './components/IssueBar';
import { RackEditor2D } from './components/RackEditor2D';
import { ThemeToggle } from './components/ThemeToggle';
import { sampleLayouts } from './data/sampleLayouts';
import { useRackStore } from './store/rackStore';
import { RackType } from './types/rack';
import type { LifecycleViewFilter, ValidationIssue } from './types/rack';
import { downloadWorkspaceJson, exportLayoutJson, exportMigrationPlanMarkdown, exportRackPng, importWorkspaceJson, readJsonFile } from './utils/exporters';
import { getFilteredLayoutByLifecycle } from './utils/migrationCalc';
import { RACK_HEIGHT_OPTIONS, RACK_SPECS } from './utils/rackMath';
import { getServiceabilityHighlightedDeviceIds } from './utils/serviceability';
import { getRackTotals, validateRackLayout } from './utils/validation';
import { layoutUsesHiddenZeroUPdu } from './utils/featureFlags';

const CableMap = lazy(() => import('./components/CableMap').then((m) => ({ default: m.CableMap })));
const CablePlanner = lazy(() => import('./components/CablePlanner').then((m) => ({ default: m.CablePlanner })));
const NetworkTopology = lazy(() => import('./components/NetworkTopology').then((m) => ({ default: m.NetworkTopology })));
const CableTracePanel = lazy(() => import('./components/CableTracePanel').then((m) => ({ default: m.CableTracePanel })));
const CableLabelPanel = lazy(() => import('./components/CableLabelPanel').then((m) => ({ default: m.CableLabelPanel })));
const CableLengthAuditPanel = lazy(() => import('./components/CableLengthAuditPanel').then((m) => ({ default: m.CableLengthAuditPanel })));
const BootSequencePanel = lazy(() => import('./components/BootSequencePanel').then((m) => ({ default: m.BootSequencePanel })));
const BuildPlanner = lazy(() => import('./components/BuildPlanner').then((m) => ({ default: m.BuildPlanner })));
const CommissioningChecklist = lazy(() => import('./components/CommissioningChecklist').then((m) => ({ default: m.CommissioningChecklist })));
const DepthCompatibilityPanel = lazy(() => import('./components/DepthCompatibilityPanel').then((m) => ({ default: m.DepthCompatibilityPanel })));
const DocumentationAuditPanel = lazy(() => import('./components/DocumentationAuditPanel').then((m) => ({ default: m.DocumentationAuditPanel })));
const DriftPanel = lazy(() => import('./components/DriftPanel').then((m) => ({ default: m.DriftPanel })));
const EnergySummary = lazy(() => import('./components/EnergySummary').then((m) => ({ default: m.EnergySummary })));
const FitCheckPanel = lazy(() => import('./components/FitCheckPanel').then((m) => ({ default: m.FitCheckPanel })));
const BlastRadiusPanel = lazy(() => import('./components/BlastRadiusPanel').then((m) => ({ default: m.BlastRadiusPanel })));
const BackupVerificationPanel = lazy(() => import('./components/BackupVerificationPanel').then((m) => ({ default: m.BackupVerificationPanel })));
const AssetRegistryPanel = lazy(() => import('./components/AssetRegistryPanel').then((m) => ({ default: m.AssetRegistryPanel })));
const MaintenanceLogPanel = lazy(() => import('./components/MaintenanceLogPanel').then((m) => ({ default: m.MaintenanceLogPanel })));
const IpAssignmentPanel = lazy(() => import('./components/IpAssignmentPanel').then((m) => ({ default: m.IpAssignmentPanel })));
const PowerBillPanel = lazy(() => import('./components/PowerBillPanel').then((m) => ({ default: m.PowerBillPanel })));
const SparePartsPanel = lazy(() => import('./components/SparePartsPanel').then((m) => ({ default: m.SparePartsPanel })));
const CleaningSchedulePanel = lazy(() => import('./components/CleaningSchedulePanel').then((m) => ({ default: m.CleaningSchedulePanel })));
const ScenarioPlannerPanel = lazy(() => import('./components/ScenarioPlannerPanel').then((m) => ({ default: m.ScenarioPlannerPanel })));
const RoomPlacementPanel = lazy(() => import('./components/RoomPlacementPanel').then((m) => ({ default: m.RoomPlacementPanel })));
const PolicyRulesPanel = lazy(() => import('./components/PolicyRulesPanel').then((m) => ({ default: m.PolicyRulesPanel })));
const PortfolioExportPanel = lazy(() => import('./components/PortfolioExportPanel').then((m) => ({ default: m.PortfolioExportPanel })));
const LabelDebtPanel = lazy(() => import('./components/LabelDebtPanel').then((m) => ({ default: m.LabelDebtPanel })));
const RunbookPanel = lazy(() => import('./components/RunbookPanel').then((m) => ({ default: m.RunbookPanel })));
const EvidenceLockerPanel = lazy(() => import('./components/EvidenceLockerPanel').then((m) => ({ default: m.EvidenceLockerPanel })));
const RackDebtPanel = lazy(() => import('./components/RackDebtPanel').then((m) => ({ default: m.RackDebtPanel })));
const GoldenBaselinePanel = lazy(() => import('./components/GoldenBaselinePanel').then((m) => ({ default: m.GoldenBaselinePanel })));
const MigrationSummaryPanel = lazy(() => import('./components/MigrationSummaryPanel').then((m) => ({ default: m.MigrationSummaryPanel })));
const NoiseSummary = lazy(() => import('./components/NoiseSummary').then((m) => ({ default: m.NoiseSummary })));
const PowerChainPanel = lazy(() => import('./components/PowerChainPanel').then((m) => ({ default: m.PowerChainPanel })));
const PropertyPanel = lazy(() => import('./components/PropertyPanel').then((m) => ({ default: m.PropertyPanel })));
const RackChangeCalendar = lazy(() => import('./components/RackChangeCalendar').then((m) => ({ default: m.RackChangeCalendar })));
const ChangeReviewPanel = lazy(() => import('./components/ChangeReviewPanel').then((m) => ({ default: m.ChangeReviewPanel })));
const ChangeRequestPanel = lazy(() => import('./components/ChangeRequestPanel').then((m) => ({ default: m.ChangeRequestPanel })));
const FirmwareTrackerPanel = lazy(() => import('./components/FirmwareTrackerPanel').then((m) => ({ default: m.FirmwareTrackerPanel })));
const RackHealthDashboard = lazy(() => import('./components/RackHealthDashboard').then((m) => ({ default: m.RackHealthDashboard })));
const CapacityForecastPanel = lazy(() => import('./components/CapacityForecastPanel').then((m) => ({ default: m.CapacityForecastPanel })));
const RackViewer3D = lazy(() => import('./components/RackViewer3D').then((m) => ({ default: m.RackViewer3D })));
const ReadinessChecklist = lazy(() => import('./components/ReadinessChecklist').then((m) => ({ default: m.ReadinessChecklist })));
const ReservationPanel = lazy(() => import('./components/ReservationPanel').then((m) => ({ default: m.ReservationPanel })));
const ServiceabilityPanel = lazy(() => import('./components/ServiceabilityPanel').then((m) => ({ default: m.ServiceabilityPanel })));
const ServiceMapPanel = lazy(() => import('./components/ServiceMapPanel').then((m) => ({ default: m.ServiceMapPanel })));
const PortReservationPanel = lazy(() => import('./components/PortReservationPanel').then((m) => ({ default: m.PortReservationPanel })));
const PatchPanelDocPanel = lazy(() => import('./components/PatchPanelDocPanel').then((m) => ({ default: m.PatchPanelDocPanel })));
const CredentialVaultPanel = lazy(() => import('./components/CredentialVaultPanel').then((m) => ({ default: m.CredentialVaultPanel })));
const FailureDomainPanel = lazy(() => import('./components/FailureDomainPanel').then((m) => ({ default: m.FailureDomainPanel })));
const TemplateQualityPanel = lazy(() => import('./components/TemplateQualityPanel').then((m) => ({ default: m.TemplateQualityPanel })));
const UpsRuntimePanel = lazy(() => import('./components/UpsRuntimePanel').then((m) => ({ default: m.UpsRuntimePanel })));
const ValidationPanel = lazy(() => import('./components/ValidationPanel').then((m) => ({ default: m.ValidationPanel })));
const WorkspaceManager = lazy(() => import('./components/WorkspaceManager').then((m) => ({ default: m.WorkspaceManager })));
const InterRackMap = lazy(() => import('./components/InterRackMap').then((m) => ({ default: m.InterRackMap })));
const InterRackCableWizard = lazy(() => import('./components/InterRackCableWizard').then((m) => ({ default: m.InterRackCableWizard })));

const VIEW_BUTTON_ACTIVE_CLASS = 'rv-a';
const VIEW_BUTTON_INACTIVE_CLASS = 'rv-i';
const TOOLBAR_SELECT_CLASS = 'rt-s';
const TOOLBAR_BUTTON_CLASS = 'rt-b';
const RACK_LIMIT_INPUT_CLASS = 'rl-i';

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workspaceFileInputRef = useRef<HTMLInputElement>(null);
  const layout = useRackStore((state) => state.layout);
  const workspace = useRackStore((state) => state.workspace);
  const currentRackId = useRackStore((state) => state.currentRackId);
  const viewMode = useRackStore((state) => state.viewMode);
  const statusMessage = useRackStore((state) => state.statusMessage);
  const setViewMode = useRackStore((state) => state.setViewMode);
  const setRackType = useRackStore((state) => state.setRackType);
  const setRackHeight = useRackStore((state) => state.setRackHeight);
  const setViewSide = useRackStore((state) => state.setViewSide);
  const updateRack = useRackStore((state) => state.updateRack);
  const selectDevice = useRackStore((state) => state.selectDevice);
  const selectCable = useRackStore((state) => state.selectCable);
  const selectedInterRackCableId = useRackStore((state) => state.selectedInterRackCableId);
  const selectInterRackCable = useRackStore((state) => state.selectInterRackCable);
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
  const [confirmAction, setConfirmAction] = useState<null | { type: 'new' | 'sample' | 'import'; payload?: string }>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleViewFilter>('all');
  const [serviceabilityOverlayEnabled, setServiceabilityOverlayEnabled] = useState(false);
  const [serviceabilityFocusDeviceIds, setServiceabilityFocusDeviceIds] = useState<string[]>([]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [interRackWizardOpen, setInterRackWizardOpen] = useState(false);

  const issues = useMemo(() => validateRackLayout(layout), [layout]);
  const totals = useMemo(() => getRackTotals(layout), [layout]);
  const filteredLayout = useMemo(() => getFilteredLayoutByLifecycle(layout, lifecycleFilter), [layout, lifecycleFilter]);
  const serviceabilityHighlightIds = useMemo(
    () => (serviceabilityFocusDeviceIds.length > 0 ? serviceabilityFocusDeviceIds : getServiceabilityHighlightedDeviceIds(layout)),
    [layout, serviceabilityFocusDeviceIds]
  );
  const visibleSampleLayouts = useMemo(
    () => sampleLayouts.filter((sample) => !layoutUsesHiddenZeroUPdu(sample)),
    []
  );

  useEffect(() => {
    if (layoutUsesHiddenZeroUPdu(layout)) {
      loadLayout(layout);
    }
  }, [layout, loadLayout]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        event.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
  function handleIssueSelect(issue: ValidationIssue) {
    setSelectedIssueId(issue.id);
    if (issue.deviceIds?.length) selectDevice(issue.deviceIds[0]);
    if (issue.cableIds?.length) selectCable(issue.cableIds[0]);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const imported = await readJsonFile(file);
    loadLayout(imported as typeof layout);
    event.currentTarget.value = '';
  }

  async function handleWorkspaceImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const workspace = importWorkspaceJson(text);
      if (!workspace) {
        useRackStore.setState({ statusMessage: 'Invalid workspace JSON file.' });
        event.currentTarget.value = '';
        return;
      }
      const success = setWorkspace(workspace);
      if (!success) {
        useRackStore.setState({ statusMessage: 'Workspace has no racks.' });
      }
    } catch {
      useRackStore.setState({ statusMessage: 'Failed to read workspace file.' });
    }
    event.currentTarget.value = '';
  }

  function handleNewLayout() {
    if (layout.devices.length > 0 || layout.cables.length > 0) {
      setConfirmAction({ type: 'new' });
    } else {
      newLayout(layout.rackType, layout.heightU);
    }
  }

  function handleLoadSample(sampleId: string) {
    if (!sampleId) return;
    if (layout.devices.length > 0 || layout.cables.length > 0) {
      setConfirmAction({ type: 'sample', payload: sampleId });
    } else {
      loadSample(sampleId);
    }
  }

  function handleConfirm() {
    if (!confirmAction) return;
    if (confirmAction.type === 'new') {
      newLayout(layout.rackType, layout.heightU);
    } else if (confirmAction.type === 'sample' && confirmAction.payload) {
      loadSample(confirmAction.payload);
    }
    setConfirmAction(null);
  }

  function handleDuplicate() {
    const duplicated: typeof layout = {
      ...layout,
      id: `layout-${Math.random().toString(36).slice(2, 10)}`,
      name: `${layout.name} (copy)`,
      updatedAt: new Date().toISOString()
    };
    loadLayout(duplicated);
  }

  return (
    <div className="grid h-screen grid-cols-[320px_minmax(620px,1fr)_380px] overflow-hidden text-slate-900 dark:text-slate-100">
      <aside className="min-h-0 border-r border-slate-200 dark:border-slate-800 bg-white/82 dark:bg-slate-950/82">
        <ComponentLibrary />
      </aside>

      <main className="flex min-w-0 flex-col">
        <Suspense fallback={null}>
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
        </Suspense>
        <header className="border-b border-slate-200 dark:border-slate-800 bg-white/72 dark:bg-slate-950/72 px-4 py-1.5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <input
                className="w-full min-w-[22rem] bg-transparent text-base font-semibold tracking-normal text-slate-900 dark:text-white outline-none placeholder:text-slate-500 dark:text-slate-400 dark:placeholder:text-slate-500"
                value={layout.name}
                onChange={(event) => updateRack({ name: event.target.value })}
                aria-label="Layout name"
              />
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{RACK_SPECS[layout.rackType].label}</span>
                <span>/</span>
                <span>{layout.heightU}U</span>
                <span>/</span>
                <span>{layout.devices.length} devices</span>
                {(layout.reservations?.length ?? 0) > 0 && (
                  <>
                    <span>/</span>
                    <span>{layout.reservations?.length} reservations</span>
                  </>
                )}
                <span>/</span>
                <span>{totals.occupiedU}/{layout.heightU}U occupied</span>
                <span>/</span>
                <span>{totals.powerW}W estimate</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition ${
                  viewMode === '2d' ? VIEW_BUTTON_ACTIVE_CLASS : VIEW_BUTTON_INACTIVE_CLASS
                }`}
                onClick={() => setViewMode('2d')}
                type="button"
              >
                <Monitor size={14} />
                2D
              </button>
              <button
                className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition ${
                  viewMode === '3d' ? VIEW_BUTTON_ACTIVE_CLASS : VIEW_BUTTON_INACTIVE_CLASS
                }`}
                onClick={() => setViewMode('3d')}
                type="button"
              >
                <Box size={14} />
                3D
              </button>
              <button
                className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition ${
                  viewMode === 'cables' ? VIEW_BUTTON_ACTIVE_CLASS : VIEW_BUTTON_INACTIVE_CLASS
                }`}
                onClick={() => setViewMode('cables')}
                type="button"
              >
                <Cable size={14} />
                Cables
              </button>
              <button
                className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition ${
                  viewMode === 'topology' ? VIEW_BUTTON_ACTIVE_CLASS : VIEW_BUTTON_INACTIVE_CLASS
                }`}
                onClick={() => setViewMode('topology')}
                type="button"
              >
                <Network size={14} />
                Topology
              </button>
              <ThemeToggle />
              <button
                className="rt-b"
                onClick={() => setInterRackWizardOpen(true)}
                type="button"
                title="Add inter-rack cable"
              >
                <Plus size={13} />
                Inter-Rack
              </button>
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
            <select
              className={TOOLBAR_SELECT_CLASS}
              value={layout.rackType}
              onChange={(event) => setRackType(event.target.value as RackType)}
              aria-label="Rack type"
            >
              <option value="10in">10-inch rack</option>
              <option value="19in">19-inch rack</option>
            </select>

            <select
              className={TOOLBAR_SELECT_CLASS}
              value={layout.heightU}
              onChange={(event) => setRackHeight(Number(event.target.value))}
              aria-label="Rack height"
            >
              {RACK_HEIGHT_OPTIONS.map((height) => (
                <option key={height} value={height}>
                  {height}U
                </option>
              ))}
            </select>

            <select
              className={TOOLBAR_SELECT_CLASS}
              value={layout.viewSide}
              onChange={(event) => setViewSide(event.target.value as 'front' | 'rear')}
              aria-label="View side"
            >
              <option value="front">Front view</option>
              <option value="rear">Rear view</option>
            </select>

            <select
              className={TOOLBAR_SELECT_CLASS}
              value={lifecycleFilter}
              onChange={(event) => setLifecycleFilter(event.target.value as LifecycleViewFilter)}
              aria-label="Lifecycle filter"
            >
              <option value="all">All lifecycle</option>
              <option value="changes">Changes only</option>
              <option value="active">Active only</option>
              <option value="planned">Planned only</option>
              <option value="decommissioning">Decommissioning only</option>
            </select>

            <select
              className={TOOLBAR_SELECT_CLASS}
              value=""
              onChange={(event) => {
                const value = event.target.value;
                if (value) handleLoadSample(value);
                event.target.value = '';
              }}
              aria-label="Load sample layout"
            >
              <option value="">Load sample</option>
              {visibleSampleLayouts.map((sample) => (
                <option key={sample.id} value={sample.id}>
                  {sample.name}
                </option>
              ))}
            </select>

            <button
              className={TOOLBAR_BUTTON_CLASS}
              onClick={handleNewLayout}
              type="button"
            >
              <RotateCcw size={13} />
              New
            </button>
            <button
              className={TOOLBAR_BUTTON_CLASS}
              onClick={handleDuplicate}
              type="button"
            >
              <Copy size={13} />
              Duplicate
            </button>
            <button
              className={TOOLBAR_BUTTON_CLASS}
              onClick={saveLocal}
              type="button"
            >
              <Save size={13} />
              Save local
            </button>
            <button
              className={`${TOOLBAR_BUTTON_CLASS} disabled:opacity-40`}
              onClick={undo}
              disabled={!canUndo()}
              type="button"
              title="Undo (Ctrl+Z)"
            >
              <Undo size={13} />
            </button>
            <button
              className={`${TOOLBAR_BUTTON_CLASS} disabled:opacity-40`}
              onClick={redo}
              disabled={!canRedo()}
              type="button"
              title="Redo (Ctrl+Y)"
            >
              <Redo size={13} />
            </button>
            <button
              className={TOOLBAR_BUTTON_CLASS}
              onClick={loadLocal}
              type="button"
            >
              <Upload size={13} />
              Load local
            </button>
            <button
              className={TOOLBAR_BUTTON_CLASS}
              onClick={() => exportLayoutJson(layout)}
              type="button"
            >
              <FileJson size={13} />
              JSON
            </button>
            <button
              className={TOOLBAR_BUTTON_CLASS}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <Upload size={13} />
              Import
            </button>
            <button
              className={TOOLBAR_BUTTON_CLASS}
              onClick={() => downloadWorkspaceJson(workspace)}
              type="button"
            >
              <FileJson size={13} />
              Export Wks
            </button>
            <button
              className={TOOLBAR_BUTTON_CLASS}
              onClick={() => workspaceFileInputRef.current?.click()}
              type="button"
            >
              <Upload size={13} />
              Import Wks
            </button>
            <button
              className={TOOLBAR_BUTTON_CLASS}
              onClick={() => exportRackPng(layout)}
              type="button"
            >
              <Download size={13} />
              PNG
            </button>
            <button
              className={TOOLBAR_BUTTON_CLASS}
              onClick={() => exportMigrationPlanMarkdown(layout)}
              type="button"
            >
              <Download size={13} />
              Migration
            </button>
            <input ref={fileInputRef} className="hidden" type="file" accept="application/json,.json" onChange={handleImport} />
            <input ref={workspaceFileInputRef} className="hidden" type="file" accept="application/json,.json" onChange={handleWorkspaceImport} />
          </div>

          {statusMessage && (
            <div className="mt-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-800 dark:text-cyan-100">
              {statusMessage}
            </div>
          )}

          <IssueBar issues={issues} selectedIssueId={selectedIssueId} onIssueSelect={handleIssueSelect} />
        </header>

        <section className="min-h-0 flex-1">
          {viewMode === '2d' && (
            <RackEditor2D
              layoutOverride={filteredLayout}
              serviceabilityOverlay={serviceabilityOverlayEnabled}
              highlightedDeviceIds={serviceabilityHighlightIds}
            />
          )}
          {viewMode === '3d' && (
            <Suspense fallback={<div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">Loading 3D…</div>}>
              <RackViewer3D layout={filteredLayout} />
            </Suspense>
          )}
          {viewMode === 'cables' && (
            <Suspense fallback={<div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">Loading cable map...</div>}>
              <CableMap layout={filteredLayout} />
            </Suspense>
          )}
          {viewMode === 'topology' && (
            <Suspense fallback={<div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">Loading topology...</div>}>
              <NetworkTopology layout={filteredLayout} />
            </Suspense>
          )}
        </section>

        {/* Confirm dialog for destructive actions (New / Load sample) */}
        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-80 rounded-lg border border-slate-300 bg-slate-100 p-5 dark:border-slate-700 dark:bg-slate-900 shadow-xl">
              <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                {confirmAction.type === 'new' && 'Start a new layout?'}
                {confirmAction.type === 'sample' && 'Load sample layout?'}
              </div>
              <div className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                {confirmAction.type === 'new'
                  ? 'This will clear all devices and cables.'
                  : 'This will replace your current rack with the selected sample.'}
              </div>
              <div className="flex gap-2">
                <button
                  className="h-9 flex-1 rounded-md border border-red-500/40 bg-red-500/10 text-sm font-medium text-red-800 dark:text-red-100 hover:bg-red-500/20"
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
      </main>

      <aside className="min-h-0 overflow-y-auto border-l border-slate-200 dark:border-slate-800 bg-white/82 dark:bg-slate-950/82 thin-scrollbar">
        <div className="space-y-4 p-4">
          <section className="rounded-lg border border-slate-200 bg-slate-100/78 p-4 dark:border-slate-800 dark:bg-slate-900/78">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              <View size={15} />
              Rack Limits
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-500 dark:text-slate-400">
                Depth mm
                <input
                  className={RACK_LIMIT_INPUT_CLASS}
                  type="number"
                  min={100}
                  value={layout.rackDepthMm}
                  onChange={(event) => updateRack({ rackDepthMm: Number(event.target.value) })}
                />
              </label>
              <label className="text-xs text-slate-500 dark:text-slate-400">
                Weight kg
                <input
                  className={RACK_LIMIT_INPUT_CLASS}
                  type="number"
                  min={1}
                  value={layout.weightLimitKg}
                  onChange={(event) => updateRack({ weightLimitKg: Number(event.target.value) })}
                />
              </label>
              <label className="text-xs text-slate-500 dark:text-slate-400">
                Power budget W
                <input
                  className={RACK_LIMIT_INPUT_CLASS}
                  type="number"
                  min={1}
                  value={layout.powerBudgetW}
                  onChange={(event) => updateRack({ powerBudgetW: Number(event.target.value) })}
                />
              </label>
              <div
                className="rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
                title="Heat score = sum of (heatLevel × sizeU) for all devices. Lower is better. Add blank panels or airflow gaps between high-heat devices to reduce."
              >
                Heat score
                <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{totals.heatScore}</div>
              </div>
            </div>
          </section>
          <Suspense fallback={null}>
            <InterRackMap
              racks={workspace.racks}
              interRackCables={workspace.interRackCables}
              selectedCableId={selectedInterRackCableId}
              onSelectCable={selectInterRackCable}
              onAddCable={() => setInterRackWizardOpen(true)}
            />
            <RackHealthDashboard layout={layout} />
            <CapacityForecastPanel />
            <EnergySummary layout={layout} onRateChange={(rate) => updateRack({ electricityRatePerKwh: rate })} />
            <NoiseSummary layout={layout} />
            <FitCheckPanel />
            <BlastRadiusPanel />
            <BackupVerificationPanel />
            <AssetRegistryPanel />
            <MaintenanceLogPanel />
            <IpAssignmentPanel />
            <PowerBillPanel />
            <SparePartsPanel />
            <CleaningSchedulePanel />
            <ScenarioPlannerPanel />
            <RoomPlacementPanel />
            <PolicyRulesPanel />
            <RackDebtPanel />
            <ReservationPanel />
            <UpsRuntimePanel />
            <BootSequencePanel />
            <PropertyPanel />
            <CablePlanner />
            <CableTracePanel />
            <CableLabelPanel />
            <CableLengthAuditPanel />
            <PortfolioExportPanel />
            <LabelDebtPanel />
            <RunbookPanel />
            <EvidenceLockerPanel />
            <BuildPlanner />
            <ReadinessChecklist />
            <CommissioningChecklist />
            <RackChangeCalendar />
            <ChangeReviewPanel />
            <ChangeRequestPanel />
            <FirmwareTrackerPanel />
            <DepthCompatibilityPanel />
            <PowerChainPanel />
            <MigrationSummaryPanel />
            <GoldenBaselinePanel />
            <ServiceabilityPanel
              layout={layout}
              overlayEnabled={serviceabilityOverlayEnabled}
              onOverlayEnabledChange={setServiceabilityOverlayEnabled}
              onHighlightDevicesChange={setServiceabilityFocusDeviceIds}
            />
            <ServiceMapPanel />
            <PortReservationPanel />
            <PatchPanelDocPanel />
            <CredentialVaultPanel />
            <FailureDomainPanel />
            <TemplateQualityPanel />
            <DriftPanel />
            <DocumentationAuditPanel />
            <ValidationPanel
              issues={issues}
              totals={totals}
              selectedIssueId={selectedIssueId}
              onIssueSelect={handleIssueSelect}
            />
          </Suspense>
        </div>
      </aside>
      <Suspense fallback={null}>
        <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
      </Suspense>
      <Suspense fallback={null}>
        <InterRackCableWizard open={interRackWizardOpen} onClose={() => setInterRackWizardOpen(false)} />
      </Suspense>
    </div>
  );
}

export default App;
