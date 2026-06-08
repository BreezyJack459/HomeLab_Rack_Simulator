import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import type { CablePath } from './CableMap';
import type { CableRoutingWarning, CableType, RackLayout } from '../types/rack';
import { DEFAULT_CABLE_COLORS } from '../utils/cableColors';
import { formatCableLength } from '../utils/rackMath';

const CABLE_LABELS: Record<CableType, string> = {
  ethernet: 'Ethernet',
  fiber: 'Fiber',
  power: 'Power',
  usb: 'USB',
  hdmi: 'HDMI',
  atx: 'ATX',
  coax: 'Coax',
  structured: 'Structured',
  patch: 'Patch',
};

const ALL_CABLE_TYPES = Object.keys(CABLE_LABELS) as CableType[];

type SortKey = 'type' | 'fromDevice' | 'toDevice' | 'length' | 'rail' | 'warnings';
type SortDir = 'asc' | 'desc';

const CRITICAL_CODES = new Set(['bend-radius-risk', 'invalid-route', 'disconnected']);

interface SortHeaderProps {
  label: string;
  sortId: SortKey;
  activeKey: SortKey | null;
  activeDir: SortDir;
  onSort: (key: SortKey) => void;
}

function SortHeader({ label, sortId, activeKey, activeDir, onSort }: SortHeaderProps) {
  return (
    <th
      className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      onClick={() => onSort(sortId)}
    >
      <span className="flex items-center gap-1">
        {label}
        {activeKey === sortId && (
          <span className="text-cyan-500 dark:text-cyan-400">{activeDir === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  );
}

function rowBorderClass(warnings: CableRoutingWarning[]): string {
  if (warnings.some((w) => CRITICAL_CODES.has(w.code))) return 'border-l-4 border-l-red-500 dark:border-l-red-400';
  if (warnings.some((w) => w.code === 'power-data-separation')) return 'border-l-4 border-l-amber-400';
  return '';
}

function portLabel(port: { type: string; index: number } | undefined | null): string {
  return port ? `${port.type} ${port.index + 1}` : '—';
}

export interface CableTableProps {
  cablePaths: CablePath[];
  layout: RackLayout;
  selectedCableId: string | null;
  onSelectCable: (id: string) => void;
  activeCableTypes: Set<CableType>;
  onCableTypeToggle: (type: CableType) => void;
}

export function CableTable({
  cablePaths,
  layout,
  selectedCableId,
  onSelectCable,
  activeCableTypes,
  onCableTypeToggle,
}: CableTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterText, setFilterText] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const deviceById = useMemo(
    () => new Map(layout.devices.map((d) => [d.id, d])),
    [layout.devices]
  );

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return cablePaths.filter(({ cable }) => {
      if (activeCableTypes.size > 0 && !activeCableTypes.has(cable.type)) return false;
      if (!q) return true;
      const from = deviceById.get(cable.fromDeviceId);
      const to = deviceById.get(cable.toDeviceId);
      return (
        from?.name.toLowerCase().includes(q) === true ||
        to?.name.toLowerCase().includes(q) === true ||
        cable.type.includes(q) ||
        cable.id.toLowerCase().includes(q) ||
        portLabel(cable.fromPort).toLowerCase().includes(q) ||
        portLabel(cable.toPort).toLowerCase().includes(q)
      );
    });
  }, [cablePaths, activeCableTypes, filterText, deviceById]);

  const rows = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      if (sortKey === 'length') {
        const diff = a.plan.standardLengthMm - b.plan.standardLengthMm;
        return sortDir === 'asc' ? diff : -diff;
      }
      if (sortKey === 'warnings') {
        const diff = a.plan.warnings.length - b.plan.warnings.length;
        return sortDir === 'asc' ? diff : -diff;
      }
      let av = '';
      let bv = '';
      if (sortKey === 'type') {
        av = a.cable.type;
        bv = b.cable.type;
      } else if (sortKey === 'fromDevice') {
        av = deviceById.get(a.cable.fromDeviceId)?.name ?? '';
        bv = deviceById.get(b.cable.fromDeviceId)?.name ?? '';
      } else if (sortKey === 'toDevice') {
        av = deviceById.get(a.cable.toDeviceId)?.name ?? '';
        bv = deviceById.get(b.cable.toDeviceId)?.name ?? '';
      } else if (sortKey === 'rail') {
        av = a.plan.rail ?? '';
        bv = b.plan.rail ?? '';
      }
      const cmp = av.localeCompare(bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, deviceById]);

  function handleSortHeader(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir('asc');
    }
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function clearFilters() {
    setFilterText('');
    activeCableTypes.forEach((type) => onCableTypeToggle(type));
  }

  const hasFilters = filterText.length > 0 || activeCableTypes.size > 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white/88 dark:border-slate-800 dark:bg-slate-950/88">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
        <input
          className="h-8 w-52 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Filter cables…"
          type="text"
          value={filterText}
        />
        {ALL_CABLE_TYPES.map((type) => (
          <button
            key={type}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition ${
              activeCableTypes.has(type)
                ? 'border-cyan-500 bg-cyan-500/10 text-cyan-800 dark:border-cyan-300 dark:bg-cyan-300/10 dark:text-cyan-100'
                : 'border-slate-200 bg-slate-100 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-slate-100'
            }`}
            onClick={() => onCableTypeToggle(type)}
            type="button"
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: DEFAULT_CABLE_COLORS[type] }} />
            {CABLE_LABELS[type]}
          </button>
        ))}
        {hasFilters && (
          <button
            className="ml-auto text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            onClick={clearFilters}
            type="button"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No cables match the current filters.{' '}
            {hasFilters && (
              <button
                className="text-cyan-500 underline hover:text-cyan-600 dark:text-cyan-400"
                onClick={clearFilters}
                type="button"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="w-8 px-2 py-2" />
                <SortHeader label="Type" sortId="type" activeKey={sortKey} activeDir={sortDir} onSort={handleSortHeader} />
                <SortHeader label="From" sortId="fromDevice" activeKey={sortKey} activeDir={sortDir} onSort={handleSortHeader} />
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Port
                </th>
                <SortHeader label="To" sortId="toDevice" activeKey={sortKey} activeDir={sortDir} onSort={handleSortHeader} />
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Port
                </th>
                <SortHeader label="Length" sortId="length" activeKey={sortKey} activeDir={sortDir} onSort={handleSortHeader} />
                <SortHeader label="Rail" sortId="rail" activeKey={sortKey} activeDir={sortDir} onSort={handleSortHeader} />
                <SortHeader label="⚠" sortId="warnings" activeKey={sortKey} activeDir={sortDir} onSort={handleSortHeader} />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ cable, plan, color }) => {
                const fromDevice = deviceById.get(cable.fromDeviceId);
                const toDevice = deviceById.get(cable.toDeviceId);
                const isSelected = selectedCableId === cable.id;
                const isExpanded = expandedIds.has(cable.id);
                const border = rowBorderClass(plan.warnings);

                return (
                  <Fragment key={cable.id}>
                    <tr
                      className={`cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 dark:border-slate-900 dark:hover:bg-slate-900/60 ${
                        isSelected ? 'bg-cyan-50 dark:bg-cyan-900/20' : ''
                      } ${border}`}
                      onClick={() => onSelectCable(cable.id)}
                    >
                      <td className="px-2 py-2 text-slate-400">
                        <button
                          className="flex items-center justify-center rounded hover:text-slate-700 dark:hover:text-slate-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(cable.id);
                          }}
                          type="button"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-slate-600 dark:text-slate-300">{CABLE_LABELS[cable.type]}</span>
                        </span>
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                        {fromDevice?.name ?? cable.fromDeviceId}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">
                        {portLabel(cable.fromPort)}
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                        {toDevice?.name ?? cable.toDeviceId}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">
                        {portLabel(cable.toPort)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">
                        {formatCableLength(plan.standardLengthMm)}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">
                        {plan.rail ? plan.rail.toUpperCase() : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {plan.warnings.length > 0 && (
                          <span
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                              plan.warnings.some((w) => CRITICAL_CODES.has(w.code))
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            }`}
                          >
                            {plan.warnings.length}
                          </span>
                        )}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-slate-50 dark:bg-slate-900/40">
                        <td className="px-2 py-0" />
                        <td className="px-3 py-3" colSpan={8}>
                          {/* Waypoint trace */}
                          {plan.waypoints.length > 0 ? (
                            <div className="mb-2 flex flex-wrap items-center gap-1">
                              {plan.waypoints.map((wp, i) => (
                                <Fragment key={wp.id}>
                                  <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    {wp.label || wp.role}
                                  </span>
                                  {i < plan.waypoints.length - 1 && (
                                    <span className="text-xs text-slate-400">→</span>
                                  )}
                                </Fragment>
                              ))}
                            </div>
                          ) : (
                            <div className="mb-2 text-xs text-slate-500 dark:text-slate-400">{plan.pathLabel}</div>
                          )}

                          {/* Segments */}
                          {plan.segments.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-1.5">
                              {plan.segments.map((seg, i) => (
                                <span
                                  key={i}
                                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                                >
                                  {seg.kind} · {seg.lengthMm}mm
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Length summary */}
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Estimated {plan.estimatedLengthMm}mm → Standard {formatCableLength(plan.standardLengthMm)} (slack {plan.slackMm}mm)
                          </div>

                          {/* Warnings */}
                          {plan.warnings.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {plan.warnings.map((w) => (
                                <span
                                  key={w.code}
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                    CRITICAL_CODES.has(w.code)
                                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                  }`}
                                >
                                  {w.code}: {w.message}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
