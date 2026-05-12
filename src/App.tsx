import { ChangeEvent, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Cable,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileJson,
  Info,
  Monitor,
  Redo,
  RotateCcw,
  Save,
  Undo,
  Upload,
  View
} from 'lucide-react';
import { CableMap } from './components/CableMap';
import { CablePlanner } from './components/CablePlanner';
import { CableTracePanel } from './components/CableTracePanel';
import { ComponentLibrary } from './components/ComponentLibrary';
import { DepthCompatibilityPanel } from './components/DepthCompatibilityPanel';
import { DocumentationAuditPanel } from './components/DocumentationAuditPanel';
import { EnergySummary } from './components/EnergySummary';
import { MigrationSummaryPanel } from './components/MigrationSummaryPanel';
import { NoiseSummary } from './components/NoiseSummary';
import { PowerChainPanel } from './components/PowerChainPanel';
import { PropertyPanel } from './components/PropertyPanel';
import { RackEditor2D } from './components/RackEditor2D';
const RackViewer3D = lazy(() => import('./components/RackViewer3D').then((m) => ({ default: m.RackViewer3D })));
import { RackHealthDashboard } from './components/RackHealthDashboard';
import { ServiceabilityPanel } from './components/ServiceabilityPanel';
import { ThemeToggle } from './components/ThemeToggle';
import { UpsRuntimePanel } from './components/UpsRuntimePanel';
import { ValidationPanel } from './components/ValidationPanel';
import { sampleLayouts } from './data/sampleLayouts';
import { useRackStore } from './store/rackStore';
import { RackType } from './types/rack';
import type { ValidationIssue } from './types/rack';
import { exportLayoutJson, exportRackPng, readJsonFile } from './utils/exporters';
import { RACK_HEIGHT_OPTIONS, RACK_SPECS } from './utils/rackMath';
import { getRackTotals, validateRackLayout } from './utils/validation';
import { recommendationForIssue } from './utils/validationRecommendations';
import { layoutUsesHiddenZeroUPdu } from './utils/featureFlags';

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const layout = useRackStore((state) => state.layout);
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
  const [confirmAction, setConfirmAction] = useState<null | { type: 'new' | 'sample' | 'import'; payload?: string }>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [issueBarOpen, setIssueBarOpen] = useState(false);

  const issues = useMemo(() => validateRackLayout(layout), [layout]);
  const totals = useMemo(() => getRackTotals(layout), [layout]);
  const visibleSampleLayouts = useMemo(
    () => sampleLayouts.filter((sample) => !layoutUsesHiddenZeroUPdu(sample)),
    []
  );

  useEffect(() => {
    if (layoutUsesHiddenZeroUPdu(layout)) {
      loadLayout(layout);
    }
  }, [layout, loadLayout]);
  const issueCounts = useMemo(
    () => ({
      critical: issues.filter((issue) => issue.severity === 'critical').length,
      warning: issues.filter((issue) => issue.severity === 'warning').length,
      info: issues.filter((issue) => issue.severity === 'info').length
    }),
    [issues]
  );

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
    <div className="grid h-screen grid-cols-[320px_minmax(620px,1fr)_380px] overflow-hidden text-slate-100">
      <aside className="min-h-0 border-r border-slate-800 bg-slate-950/82">
        <ComponentLibrary />
      </aside>

      <main className="flex min-w-0 flex-col">
        <header className="border-b border-slate-800 bg-slate-950/72 px-4 py-1.5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <input
                className="w-full min-w-[22rem] bg-transparent text-base font-semibold tracking-normal text-white outline-none placeholder:text-slate-500"
                value={layout.name}
                onChange={(event) => updateRack({ name: event.target.value })}
                aria-label="Layout name"
              />
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>{RACK_SPECS[layout.rackType].label}</span>
                <span>/</span>
                <span>{layout.heightU}U</span>
                <span>/</span>
                <span>{layout.devices.length} devices</span>
                <span>/</span>
                <span>{totals.occupiedU}/{layout.heightU}U occupied</span>
                <span>/</span>
                <span>{totals.powerW}W estimate</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition ${
                  viewMode === '2d'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                }`}
                onClick={() => setViewMode('2d')}
                type="button"
              >
                <Monitor size={14} />
                2D
              </button>
              <button
                className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition ${
                  viewMode === '3d'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                }`}
                onClick={() => setViewMode('3d')}
                type="button"
              >
                <Box size={14} />
                3D
              </button>
              <button
                className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition ${
                  viewMode === 'cables'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                }`}
                onClick={() => setViewMode('cables')}
                type="button"
              >
                <Cable size={14} />
                Cables
              </button>
              <ThemeToggle />
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
            <select
              className="h-7 rounded-md border border-slate-700 bg-slate-900 px-2 text-slate-100 outline-none"
              value={layout.rackType}
              onChange={(event) => setRackType(event.target.value as RackType)}
              aria-label="Rack type"
            >
              <option value="10in">10-inch rack</option>
              <option value="19in">19-inch rack</option>
            </select>

            <select
              className="h-7 rounded-md border border-slate-700 bg-slate-900 px-2 text-slate-100 outline-none"
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
              className="h-7 rounded-md border border-slate-700 bg-slate-900 px-2 text-slate-100 outline-none"
              value={layout.viewSide}
              onChange={(event) => setViewSide(event.target.value as 'front' | 'rear')}
              aria-label="View side"
            >
              <option value="front">Front view</option>
              <option value="rear">Rear view</option>
            </select>

            <select
              className="h-7 rounded-md border border-slate-700 bg-slate-900 px-2 text-slate-100 outline-none"
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
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2 text-slate-200 hover:bg-slate-800"
              onClick={handleNewLayout}
              type="button"
            >
              <RotateCcw size={13} />
              New
            </button>
            <button
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2 text-slate-200 hover:bg-slate-800"
              onClick={handleDuplicate}
              type="button"
            >
              <Copy size={13} />
              Duplicate
            </button>
            <button
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2 text-slate-200 hover:bg-slate-800"
              onClick={saveLocal}
              type="button"
            >
              <Save size={13} />
              Save local
            </button>
            <button
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2 text-slate-200 hover:bg-slate-800 disabled:opacity-40"
              onClick={undo}
              disabled={!canUndo()}
              type="button"
              title="Undo (Ctrl+Z)"
            >
              <Undo size={13} />
            </button>
            <button
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2 text-slate-200 hover:bg-slate-800 disabled:opacity-40"
              onClick={redo}
              disabled={!canRedo()}
              type="button"
              title="Redo (Ctrl+Y)"
            >
              <Redo size={13} />
            </button>
            <button
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2 text-slate-200 hover:bg-slate-800"
              onClick={loadLocal}
              type="button"
            >
              <Upload size={13} />
              Load local
            </button>
            <button
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2 text-slate-200 hover:bg-slate-800"
              onClick={() => exportLayoutJson(layout)}
              type="button"
            >
              <FileJson size={13} />
              JSON
            </button>
            <button
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2 text-slate-200 hover:bg-slate-800"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <Upload size={13} />
              Import
            </button>
            <button
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2 text-slate-200 hover:bg-slate-800"
              onClick={() => exportRackPng(layout)}
              type="button"
            >
              <Download size={13} />
              PNG
            </button>
            <input ref={fileInputRef} className="hidden" type="file" accept="application/json,.json" onChange={handleImport} />
          </div>

          {statusMessage && (
            <div className="mt-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100">
              {statusMessage}
            </div>
          )}

          <div className={`mt-1.5 rounded-lg border px-2 py-1 ${
            issues.length
              ? 'border-sky-500/35 bg-sky-500/10'
              : 'border-emerald-500/30 bg-emerald-500/10'
          }`}>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIssueBarOpen((value) => !value)}
                className="inline-flex h-6 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs font-semibold text-slate-100 hover:bg-slate-900"
              >
                {issues.length ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                {issues.length ? `${issues.length} layout alerts` : 'Layout clear'}
              </button>
              <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-xs text-red-100">{issueCounts.critical} critical</span>
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-100">{issueCounts.warning} warning</span>
              <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-xs text-sky-100">{issueCounts.info} info</span>
              {selectedIssueId && (
                <span className="min-w-0 flex-1 truncate text-xs text-slate-300">
                  {issues.find((issue) => issue.id === selectedIssueId)?.title ?? 'Selected issue'}
                </span>
              )}
            </div>
            {issueBarOpen && issues.length > 0 && (
              <div className="mt-1.5 grid max-h-40 gap-1.5 overflow-y-auto pr-1 thin-scrollbar md:grid-cols-2">
                {issues.map((issue) => (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() => handleIssueSelect(issue)}
                    className={`rounded-md border p-1.5 text-left text-xs transition hover:bg-slate-900 ${
                      selectedIssueId === issue.id ? 'border-cyan-300 bg-cyan-300/10' : 'border-slate-800 bg-slate-950/70'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Info size={12} className="mt-0.5 shrink-0 text-sky-300" />
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-100">{issue.title}</div>
                        <div className="mt-0.5 line-clamp-2 text-slate-400">{recommendationForIssue(issue)}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        <section className="min-h-0 flex-1">
          {viewMode === '2d' && <RackEditor2D />}
          {viewMode === '3d' && (
            <Suspense fallback={<div className="flex h-full items-center justify-center text-slate-400">Loading 3D…</div>}>
              <RackViewer3D />
            </Suspense>
          )}
          {viewMode === 'cables' && <CableMap />}
        </section>

        {/* Confirm dialog for destructive actions (New / Load sample) */}
        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-80 rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl">
              <div className="mb-3 text-sm font-semibold text-white">
                {confirmAction.type === 'new' && 'Start a new layout?'}
                {confirmAction.type === 'sample' && 'Load sample layout?'}
              </div>
              <div className="mb-4 text-xs text-slate-400">
                {confirmAction.type === 'new'
                  ? 'This will clear all devices and cables.'
                  : 'This will replace your current rack with the selected sample.'}
              </div>
              <div className="flex gap-2">
                <button
                  className="h-9 flex-1 rounded-md border border-red-500/40 bg-red-500/10 text-sm font-medium text-red-100 hover:bg-red-500/20"
                  onClick={handleConfirm}
                  type="button"
                >
                  Confirm
                </button>
                <button
                  className="h-9 flex-1 rounded-md border border-slate-700 bg-slate-800 text-sm text-slate-200 hover:bg-slate-700"
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

      <aside className="min-h-0 overflow-y-auto border-l border-slate-800 bg-slate-950/82 thin-scrollbar">
        <div className="space-y-4 p-4">
          <section className="rounded-lg border border-slate-800 bg-slate-900/78 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
              <View size={15} />
              Rack Limits
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-400">
                Depth mm
                <input
                  className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
                  type="number"
                  min={100}
                  value={layout.rackDepthMm}
                  onChange={(event) => updateRack({ rackDepthMm: Number(event.target.value) })}
                />
              </label>
              <label className="text-xs text-slate-400">
                Weight kg
                <input
                  className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
                  type="number"
                  min={1}
                  value={layout.weightLimitKg}
                  onChange={(event) => updateRack({ weightLimitKg: Number(event.target.value) })}
                />
              </label>
              <label className="text-xs text-slate-400">
                Power budget W
                <input
                  className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
                  type="number"
                  min={1}
                  value={layout.powerBudgetW}
                  onChange={(event) => updateRack({ powerBudgetW: Number(event.target.value) })}
                />
              </label>
              <div
                className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400"
                title="Heat score = sum of (heatLevel × sizeU) for all devices. Lower is better. Add blank panels or airflow gaps between high-heat devices to reduce."
              >
                Heat score
                <div className="mt-1 text-lg font-semibold text-white">{totals.heatScore}</div>
              </div>
            </div>
          </section>
          <RackHealthDashboard layout={layout} />
          <EnergySummary layout={layout} onRateChange={(rate) => updateRack({ electricityRatePerKwh: rate })} />
          <NoiseSummary layout={layout} />
          <UpsRuntimePanel />
          <PropertyPanel />
          <CablePlanner />
          <CableTracePanel />
          <DepthCompatibilityPanel />
          <PowerChainPanel />
          <MigrationSummaryPanel />
          <ServiceabilityPanel layout={layout} />
          <DocumentationAuditPanel />
          <ValidationPanel
            issues={issues}
            totals={totals}
            selectedIssueId={selectedIssueId}
            onIssueSelect={handleIssueSelect}
          />
        </div>
      </aside>
    </div>
  );
}

export default App;
