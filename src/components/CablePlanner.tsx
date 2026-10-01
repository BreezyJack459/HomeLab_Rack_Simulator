import { PatchPanelTidyControl } from './PatchPanelTidyControl';
import { getCableLengthRequirements, cablePurchaseLengthLabel, cablePurchaseNote } from '../utils/cableLengthRequirements';
import { ConnectorCompatibilityDetails } from './ConnectorCompatibilityDetails';
import { isPowerSource } from '../utils/powerChain';
import { withoutHiddenZeroUPdu } from '../utils/featureFlags';
import {
  Cable,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCableWorkspaceStore } from '../store/cableWorkspaceStore';
import { useRackStore } from '../store/rackStore';
import type { CableType, LifecycleStatus, PlacedDevice, PortRef } from '../types/rack';
import { getCableDisplayColor } from '../utils/cableColors';
import { matchesCableQuery } from '../utils/cableQuery';
import { calculateCablePlan, getCableSlackBudget, pathDescription } from '../utils/routing';
import { formatCableLength } from '../utils/rackMath';
import { exportBomCsv, exportBomText } from '../utils/exporters';
import { getPatchPanelLinkedCableIds, patchPanelRouteLabel } from '../utils/patchPanel';
import { autoWireLayout } from '../utils/autoWire';
const mutedCableColor = '#64748b';

function portLabel(route: { type: CableType; fromPort?: PortRef; toPort?: PortRef }) {
  const parts: string[] = [];
  if (route.fromPort) {
    const side = route.fromPort.side ? `(${route.fromPort.side})` : '';
    parts.push(`${route.fromPort.type} ${route.fromPort.index + 1}${side}`);
  }
  if (route.toPort) {
    const side = route.toPort.side ? `(${route.toPort.side})` : '';
    parts.push(`-> ${route.toPort.type} ${route.toPort.index + 1}${side}`);
  }
  return parts.length ? parts.join(' ') : undefined;
}

export function CablePlanner({ compact = false }: { compact?: boolean }) {
  const storedLayout = useRackStore((state) => state.layout);
  const layout = useMemo(() => withoutHiddenZeroUPdu(storedLayout), [storedLayout]);
  const addCables = useRackStore((state) => state.addCables);
  const removeCable = useRackStore((state) => state.removeCable);
  const updateCable = useRackStore((state) => state.updateCable);
  const selectCable = useRackStore((state) => state.selectCable);
  const selectedCableId = useRackStore((state) => state.selectedCableId);
  const [isOpen, setIsOpen] = useState(true);
  const cableFilter = useCableWorkspaceStore((state) => state.query);
  const setCableFilter = useCableWorkspaceStore((state) => state.setQuery);
  const hiddenTypes = useCableWorkspaceStore((state) => state.hiddenTypes);
  const showAllTypes = useCableWorkspaceStore((state) => state.showAllTypes);
  const focusMode = useCableWorkspaceStore((state) => state.focusMode);
  const [expandedCableGroups, setExpandedCableGroups] = useState<Record<string, boolean>>({});

  const deviceMap = useMemo(() => {
    const map = new Map<string, PlacedDevice>();
    for (const d of layout.devices) map.set(d.id, d);
    return map;
  }, [layout.devices]);

  const selectedCableIds = useMemo(
    () => getPatchPanelLinkedCableIds(layout, selectedCableId),
    [layout, selectedCableId]
  );

  // Filtered + grouped cables for the compact list view
  const filteredCables = useMemo(() => {
    const q = cableFilter.trim().toLowerCase();
    return layout.cables.filter((route) => {
      const selected = selectedCableIds.has(route.id);
      if (compact) return route.id === selectedCableId;
      if (hiddenTypes.includes(route.type) && !selected) return false;
      if (focusMode === 'hide' && selectedCableId !== null && !selected) return false;
      return matchesCableQuery(route, layout, q);
    });
  }, [compact, layout.cables, cableFilter, deviceMap, focusMode, hiddenTypes, selectedCableId, selectedCableIds]);

  return (
    <section className="rounded-[10px] border border-edge bg-fill/78 p-3.5 dark:border-edge dark:bg-surface-raised/78">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        className="mb-2.5 flex w-full items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-content-muted transition hover:text-content-secondary dark:text-content-muted dark:hover:text-content"
      >
        <div className="flex items-center gap-2">
          <Cable size={15} />
          Cables
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-fill px-2 py-1 text-xs text-content-secondary dark:bg-surface dark:text-content-secondary">{layout.cables.length} routes</span>
          <ChevronDown size={16} className={`transition-transform duration-200 motion-reduce:transition-none ${isOpen ? '' : '-rotate-90'}`} />
        </div>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden space-y-3">
          <button type="button" onClick={() => { useRackStore.getState().setViewMode('cables'); useCableWorkspaceStore.getState().requestConnection(); }} className="min-h-11 w-full rounded-[10px] bg-accent-solid px-3 py-2 text-sm font-semibold text-accent-on hover:bg-accent-solid-hover">Connect on device diagram</button>
          {!compact && <button type="button" onClick={(event) => { event.currentTarget.focus(); useRackStore.getState().setViewMode('cables'); useCableWorkspaceStore.getState().setABRequested(true); }} className="min-h-11 w-full rounded-[10px] border border-accent px-3 text-sm font-semibold text-accent-fg">Connect A–B · 經配線架</button>}
          {!compact && <PatchPanelTidyControl />}
          {!compact && <button type="button" onClick={() => addCables(autoWireLayout(layout, { workspace: useRackStore.getState().workspace }).cables)} className="min-h-11 w-full rounded-[10px] border border-edge px-3 py-2 text-sm hover:bg-fill">Auto-wire</button>}

          {layout.cables.length > 0 && (
            <details open={!compact} className="rounded-[10px] border border-edge bg-surface/70 p-3 dark:border-edge dark:bg-surface/70">
              <summary className="mb-2 cursor-pointer text-xs font-semibold text-content-muted">Export cable BOM</summary>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-edge-strong bg-fill text-xs font-medium text-content-secondary hover:bg-fill-strong dark:border-edge-strong dark:bg-surface dark:text-content-secondary dark:hover:bg-fill"
                  onClick={() => exportBomCsv(layout)}
                  type="button"
                >
                  <FileSpreadsheet size={13} />
                  BOM CSV
                </button>
                <button
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-edge-strong bg-fill text-xs font-medium text-content-secondary hover:bg-fill-strong dark:border-edge-strong dark:bg-surface dark:text-content-secondary dark:hover:bg-fill"
                  onClick={() => exportBomText(layout)}
                  type="button"
                >
                  <FileText size={13} />
                  BOM Text
                </button>
              </div>
              <div className="mt-2 text-xs leading-5 text-content-faint">
                BOM lengths include slack, service-loop allowance and bend-radius notes.
              </div>
            </details>
          )}

          {/* ── Cable filter bar ── */}
          {!compact && layout.cables.length > 0 && (
            <div className="rounded-[10px] border border-edge bg-surface/70 p-3 dark:border-edge dark:bg-surface/70">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-content-faint">
                Route library
              </div>
              <div className="flex gap-1.5">
              <input
                type="search"
                aria-label="Filter cable planner routes"
                placeholder="Filter cables…"
                value={cableFilter}
                onChange={(e) => setCableFilter(e.target.value)}
                className="h-10 min-w-0 flex-1 rounded-lg border border-edge-strong bg-fill px-2.5 text-xs text-content-secondary placeholder-content-faint outline-none focus:border-accent dark:border-edge-strong dark:bg-surface dark:text-content dark:placeholder-content-muted"
              />
              {hiddenTypes.length > 0 && (
                <button
                  type="button"
                  onClick={showAllTypes}
                  className="h-10 rounded-lg border border-edge-strong bg-fill px-2 text-xs text-content-secondary hover:bg-fill-strong dark:border-edge-strong dark:bg-surface dark:text-content-secondary"
                >
                  Show all types
                </button>
              )}
            </div>
            </div>
          )}

          {/* ── Grouped compact cable list ── */}
          <div className="space-y-1.5">
            {!compact && filteredCables.length === 0 && layout.cables.length > 0 && (
              <div className="rounded-[10px] border border-dashed border-edge bg-fill/60 p-3 text-center text-xs text-content-faint dark:border-edge dark:bg-surface/60 dark:text-content-muted dark:text-content-faint">
                No cables match the filter.
              </div>
            )}

            {(() => {
              const groups = filteredCables.reduce<Record<string, typeof filteredCables>>((acc, route) => {
                acc[route.type] = acc[route.type] ?? [];
                acc[route.type].push(route);
                return acc;
              }, {});

              return Object.entries(groups).map(([type, routes]) => {
                const isGroupOpen = expandedCableGroups[type] !== false;
                const toggleGroup = () =>
                  setExpandedCableGroups((prev) => ({ ...prev, [type]: !isGroupOpen }));
                const groupColor = getCableDisplayColor(type as CableType, undefined);

                return (
                  <div key={type} className="rounded-[10px] border border-edge bg-surface/70 dark:border-edge dark:bg-surface/70">
                    {/* Group header */}
                    <button
                      type="button"
                      aria-label={`${type} · ${routes.length} routes`}
                      aria-expanded={isGroupOpen}
                      onClick={toggleGroup}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-fill-strong/50 dark:hover:bg-fill/50"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: groupColor }} />
                      <span className="flex-1 text-xs font-semibold capitalize tracking-[0.1em] text-content-muted">
                        {type}
                      </span>
                      <span className="text-xs text-content-faint">{' '}{routes.length}</span>
                      <ChevronDown
                        size={12}
                        className={`shrink-0 text-content-faint transition-transform duration-150 dark:text-content-faint ${isGroupOpen ? '' : '-rotate-90'}`}
                      />
                    </button>

                    {/* Compact cable rows */}
                    {isGroupOpen && (
                      <div className="border-t border-edge/60 px-1.5 pb-1.5 pt-1 space-y-1 dark:border-edge/60">
                        {routes.map((route) => {
                          const from = deviceMap.get(route.fromDeviceId);
                          const to = deviceMap.get(route.toDeviceId);
                          const plan = calculateCablePlan(route, layout);
                          const selected = selectedCableIds.has(route.id);
                          const muted = focusMode === 'dim' && selectedCableId !== null && !selected;
                          const displayColor = getCableDisplayColor(route.type, route.color);
                          const slack = getCableSlackBudget(layout, route);
                          const purchase = getCableLengthRequirements(layout).get(route.id)!;
                          const lengthStr = cablePurchaseLengthLabel(purchase);
                          const portsLabel = portLabel(route);
                          const patchLabel = patchPanelRouteLabel(layout, route);

                          return (
                            <div
                              key={route.id}
                              className={`group rounded-lg px-2 py-1.5 text-xs transition ${
                                selected
                                  ? 'bg-accent/10 text-accent-fg-strong'
                                  : muted
                                    ? 'opacity-50 hover:opacity-80 text-content-muted'
                                    : 'text-content-secondary hover:bg-fill-strong/60 dark:text-content-secondary dark:hover:bg-fill/60'
                              }`}
                              data-cable-planner-route-state={selected ? 'selected' : muted ? 'muted' : 'normal'}
                            >
                              <div className="flex w-full items-center gap-2">
                                <button type="button" aria-pressed={selected} aria-label={`Inspect ${route.label || `${from?.name ?? 'Unknown'} to ${to?.name ?? 'Unknown'}`} cable`} onClick={() => selectCable(route.id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md text-left">
                                {/* Color pip */}
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: muted ? mutedCableColor : displayColor, opacity: muted ? 0.5 : 1 }}
                                />
                                {/* From → To */}
                                <span className="min-w-0 flex-1 truncate font-medium">
                                  {from?.name ?? '?'}
                                  <span className="mx-1 text-content-faint">→</span>
                                  {to?.name ?? '?'}
                                </span>
                                {/* Length */}
                                <span className="shrink-0 text-xs text-content-faint">{lengthStr}</span>
                                </button>
                                {/* Delete */}
                                <button
                                  type="button"
                                  aria-label={`Delete ${route.label || `${from?.name ?? 'Unknown'} to ${to?.name ?? 'Unknown'}`} cable`}
                                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-content-muted transition hover:bg-red-500/10 hover:text-red-500"
                                  onClick={(e) => { e.stopPropagation(); removeCable(route.id); }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>

                              {/* Expanded detail when selected */}
                              {selected && (
                                <div className="mt-1 pl-4 text-xs text-content-faint">
                                  {route.installationRole && <p className="text-xs text-content-secondary">Installation: {route.installationRole} · {route.lifecycleStatus ?? 'active'}</p>}
                                  <ConnectorCompatibilityDetails layout={layout} cable={route} onChange={patch => updateCable(route.id, patch)} />
                                  <div className="mb-1.5 grid gap-1.5">
                                    {route.type === 'power' && (
                                      <label className="grid gap-1">
                                        <span>Upstream power supply</span>
                                        <select
                                          value={route.powerSourceDeviceId ?? ''}
                                          onClick={event => event.stopPropagation()}
                                          onChange={event => updateCable(route.id, { powerSourceDeviceId: event.target.value || undefined })}
                                          className="h-10 rounded border border-edge-strong bg-surface px-2 text-content"
                                        >
                                          <option value="">Automatic / unconfirmed cascade</option>
                                          {[route.fromDeviceId, route.toDeviceId].map(id => deviceMap.get(id)).filter(d => d && isPowerSource(d)).map(d => (
                                            <option key={d!.id} value={d!.id}>{d!.name}</option>
                                          ))}
                                        </select>
                                      </label>
                                    )}
                                    <label className="grid gap-1">
                                      <span className="uppercase tracking-[0.12em] text-content-muted">Cable label</span>
                                      <input
                                        value={route.label ?? ''}
                                        placeholder={route.id}
                                        onClick={(event) => event.stopPropagation()}
                                        onChange={(event) => updateCable(route.id, { label: event.target.value || undefined })}
                                        className="h-10 rounded border border-edge-strong bg-fill px-2 text-xs text-content-secondary outline-none focus:border-accent dark:border-edge-strong dark:bg-surface dark:text-content-secondary"
                                      />
                                    </label>
                                    <label className="grid gap-1">
                                      <span className="uppercase tracking-[0.12em] text-content-muted">Notes</span>
                                      <textarea
                                        value={route.notes ?? ''}
                                        placeholder="Installation or service notes"
                                        rows={2}
                                        onClick={(event) => event.stopPropagation()}
                                        onChange={(event) => updateCable(route.id, { notes: event.target.value || undefined })}
                                        className="resize-none rounded border border-edge-strong bg-fill px-2 py-1.5 text-xs text-content-secondary outline-none focus:border-accent dark:border-edge-strong dark:bg-surface dark:text-content-secondary"
                                      />
                                    </label>
                                  </div>
                                  <div className="mb-1 flex items-center gap-1.5">
                                    <span className="uppercase tracking-[0.12em] text-content-muted dark:text-content-faint">Lifecycle</span>
                                    <select
                                      value={route.lifecycleStatus ?? 'active'}
                                      onClick={(event) => event.stopPropagation()}
                                      onChange={(event) => updateCable(route.id, { lifecycleStatus: event.target.value as LifecycleStatus })}
                                      className="h-10 rounded border border-edge-strong bg-fill px-1.5 text-xs text-content-secondary outline-none focus:border-accent dark:border-edge-strong dark:bg-surface dark:text-content-secondary"
                                    >
                                      <option value="active">Active</option>
                                      <option value="planned">Planned</option>
                                      <option value="decommissioning">Decommissioning</option>
                                    </select>
                                  </div>
                                  {portsLabel && <span>{portsLabel}</span>}
                                  {plan && (
                                    <span className={portsLabel ? ' ml-1.5' : ''}>
                                      {plan.discipline} / {plan.rail ? `${plan.rail} tray` : 'front manager'}
                                    </span>
                                  )}
                                  {slack && (
                                    <span className="mt-0.5 block">
                                      {cablePurchaseNote(purchase)}
                                      {slack.providedLengthMm ? ` / declared ${formatCableLength(slack.providedLengthMm)}` : ''}
                                      {purchase.requiredMm !== null && slack.providedLengthMm && slack.providedLengthMm < purchase.requiredMm ? ` / short by ${formatCableLength(purchase.requiredMm - slack.providedLengthMm)}` : ''}
                                    </span>
                                  )}
                                  {slack && (slack.serviceLoopMm > 0 || slack.bendRadiusMm > 0) && (
                                    <span className="mt-0.5 block text-content-faint">
                                      {slack.serviceLoopMm > 0 ? `Service loop ${slack.serviceLoopMm}mm` : 'No service loop'}
                                      {slack.bendRadiusMm > 0 ? ` / bend >= ${slack.bendRadiusMm}mm` : ''}
                                    </span>
                                  )}
                                  {((plan?.nodes.length ?? 0) > 0 || (route.nodes?.length ?? 0) > 0) && (
                                    <span className="mt-0.5 block text-content-faint">
                                      {patchLabel ? `${patchLabel} / ` : ''}
                                      {pathDescription(route, plan?.nodes ?? route.nodes ?? [], layout, plan)}
                                    </span>
                                  )}
                                  {plan?.warnings.map((warning) => (
                                    <div
                                      key={`${route.id}-${warning.code}`}
                                      className="mt-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-amber-700 dark:text-amber-300"
                                    >
                                      <div className="font-semibold">{warning.message}</div>
                                      <div className="mt-0.5 opacity-80">
                                        Review the route, increase cable length, or add the recommended manager before installation.
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </section>
  );
}
