import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Box,
  Cable,
  ChevronRight,
  FileJson,
  HardDrive,
  LayoutGrid,
  Monitor,
  Network,
  Search,
  Server,
  X
} from 'lucide-react';
import { useRackStore } from '../store/rackStore';
import type { CableRoute, RackLayout, ValidationIssue, ViewMode, Workspace, InterRackCable, PortRef } from '../types/rack';
import { exportLayoutJson } from '../utils/exporters';
import { validateRackLayout } from '../utils/validation';

type SearchItemType = 'device' | 'cable' | 'issue' | 'action' | 'view' | 'inter-rack-cable' | 'port-alias';

interface SearchItem {
  id: string;
  type: SearchItemType;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
  rackId?: string;
  rackName?: string;
}

export function getDeviceName(layout: RackLayout, deviceId: string): string {
  return layout.devices.find((d) => d.id === deviceId)?.name ?? deviceId.slice(0, 8);
}

export function getCableLabel(cable: CableRoute, layout: RackLayout): string {
  const fromName = getDeviceName(layout, cable.fromDeviceId);
  const toName = getDeviceName(layout, cable.toDeviceId);
  return `${fromName} → ${toName}`;
}

function formatPortRef(port: PortRef): string {
  return `${port.type}:${port.index}`;
}

function wrapWithRackSwitch(action: () => void, rackId: string | undefined, currentRackId: string | undefined): () => void {
  if (!rackId || !currentRackId || rackId === currentRackId) return action;
  return () => {
    useRackStore.getState().switchRack(rackId);
    action();
  };
}

function buildRackSpecificSearchItems(
  layout: RackLayout,
  issues: ValidationIssue[],
  options?: { rackId?: string; rackName?: string; currentRackId?: string }
): SearchItem[] {
  const items: SearchItem[] = [];
  const { rackId, rackName, currentRackId } = options ?? {};
  const wrap = (action: () => void) => wrapWithRackSwitch(action, rackId, currentRackId);
  const rackSuffix = (rackName && rackId !== currentRackId) ? ` (${rackName})` : '';

  // Devices
  layout.devices.forEach((device) => {
    items.push({
      id: `device-${layout.id}-${device.id}`,
      type: 'device',
      title: `${device.name}${rackSuffix}`,
      subtitle: `${device.category} · U${device.positionU}${device.sizeU > 1 ? `-${device.positionU + device.sizeU - 1}` : ''}`,
      icon: <HardDrive size={16} className="text-slate-500 dark:text-slate-400" />,
      action: wrap(() => {
        useRackStore.getState().selectDevice(device.id);
      }),
      category: 'Devices',
      rackId,
      rackName
    });

    // Port aliases
    if (device.portAliases) {
      Object.entries(device.portAliases).forEach(([portKey, alias]) => {
        items.push({
          id: `port-alias-${layout.id}-${device.id}-${portKey}`,
          type: 'port-alias',
          title: `${alias}${rackSuffix}`,
          subtitle: `Port alias on ${device.name} · ${portKey}`,
          icon: <Network size={16} className="text-slate-500 dark:text-slate-400" />,
          action: wrap(() => {
            useRackStore.getState().selectDevice(device.id);
          }),
          category: 'Port Aliases',
          rackId,
          rackName
        });
      });
    }
  });

  // Cables
  layout.cables.forEach((cable) => {
    const length = cable.length ?? (cable.lengthMm ? `${(cable.lengthMm / 1000).toFixed(1)}m` : '');
    items.push({
      id: `cable-${layout.id}-${cable.id}`,
      type: 'cable',
      title: getCableLabel(cable, layout),
      subtitle: `${cable.type}${length ? ` · ${length}` : ''}${cable.speed ? ` · ${cable.speed}` : ''}`,
      icon: <Cable size={16} className="text-slate-500 dark:text-slate-400" />,
      action: wrap(() => {
        useRackStore.getState().selectCable(cable.id);
        useRackStore.getState().setViewMode('cables');
      }),
      category: 'Cables',
      rackId,
      rackName
    });
  });

  // Validation Issues
  issues.forEach((issue) => {
    const severityColor =
      issue.severity === 'critical'
        ? 'text-red-500'
        : issue.severity === 'warning'
          ? 'text-amber-500'
          : 'text-blue-500';
    items.push({
      id: `issue-${layout.id}-${issue.id}`,
      type: 'issue',
      title: `${issue.title}${rackSuffix}`,
      subtitle: issue.detail.slice(0, 80),
      icon: <AlertTriangle size={16} className={severityColor} />,
      action: wrap(() => {
        if (issue.deviceIds?.length) {
          useRackStore.getState().selectDevice(issue.deviceIds[0]);
        }
        if (issue.cableIds?.length) {
          useRackStore.getState().selectCable(issue.cableIds[0]);
          useRackStore.getState().setViewMode('cables');
        }
      }),
      category: 'Issues',
      rackId,
      rackName
    });
  });

  // Reservations
  (layout.reservations ?? []).forEach((res) => {
    items.push({
      id: `reservation-${layout.id}-${res.id}`,
      type: 'device',
      title: `${res.name}${rackSuffix}`,
      subtitle: `Reservation · U${res.positionU}${res.sizeU > 1 ? `-${res.positionU + res.sizeU - 1}` : ''} · ${res.purpose}`,
      icon: <LayoutGrid size={16} className="text-slate-500 dark:text-slate-400" />,
      action: wrap(() => {
        useRackStore.getState().setViewMode('2d');
      }),
      category: 'Reservations',
      rackId,
      rackName
    });
  });

  return items;
}

export function buildSearchItems(layout: RackLayout, issues: ValidationIssue[]): SearchItem[] {
  const items: SearchItem[] = buildRackSpecificSearchItems(layout, issues);

  // View modes
  const views: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
    { mode: '2d', label: '2D Rack Editor', icon: <Monitor size={16} /> },
    { mode: '3d', label: '3D Inspection', icon: <Box size={16} /> },
    { mode: 'cables', label: 'Cable Map', icon: <Cable size={16} /> },
    { mode: 'topology', label: 'Network Topology', icon: <Network size={16} /> }
  ];
  views.forEach((v) => {
    items.push({
      id: `view-${v.mode}`,
      type: 'view',
      title: v.label,
      subtitle: `Switch to ${v.label}`,
      icon: <span className="text-slate-500 dark:text-slate-400">{v.icon}</span>,
      action: () => {
        useRackStore.getState().setViewMode(v.mode);
      },
      category: 'Views'
    });
  });

  // Quick Actions
  items.push({
    id: 'action-export-json',
    type: 'action',
    title: 'Export Layout JSON',
    subtitle: 'Download current rack as JSON file',
    icon: <FileJson size={16} className="text-slate-500 dark:text-slate-400" />,
    action: () => {
      exportLayoutJson(layout);
    },
    category: 'Actions'
  });

  return items;
}

export function buildWorkspaceSearchItems(workspace: Workspace, currentRackId: string): SearchItem[] {
  const items: SearchItem[] = [];

  // Index all racks
  for (const rack of workspace.racks) {
    const issues = validateRackLayout(rack);
    items.push(...buildRackSpecificSearchItems(rack, issues, {
      rackId: rack.id,
      rackName: rack.name,
      currentRackId
    }));
  }

  // Inter-rack cables
  for (const cable of workspace.interRackCables ?? []) {
    const fromRack = workspace.racks.find((r) => r.id === cable.fromRackId);
    const toRack = workspace.racks.find((r) => r.id === cable.toRackId);
    const fromDevice = fromRack?.devices.find((d) => d.id === cable.fromDeviceId);
    const toDevice = toRack?.devices.find((d) => d.id === cable.toDeviceId);

    const fromPortLabel = formatPortRef(cable.fromPort);
    const toPortLabel = formatPortRef(cable.toPort);

    items.push({
      id: `inter-rack-cable-${cable.id}`,
      type: 'inter-rack-cable',
      title: `${fromRack?.name ?? 'Unknown'}:${fromDevice?.name ?? 'Unknown'}:${fromPortLabel} → ${toRack?.name ?? 'Unknown'}:${toDevice?.name ?? 'Unknown'}:${toPortLabel}`,
      subtitle: `${cable.type}${cable.lengthM !== undefined ? ` · ${cable.lengthM}m` : ''}${cable.label ? ` · ${cable.label}` : ''}`,
      icon: <Cable size={16} className="text-slate-500 dark:text-slate-400" />,
      action: () => {
        useRackStore.getState().selectInterRackCable(cable.id);
      },
      category: 'Inter-Rack Cables'
    });
  }

  // View modes (global)
  const views: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
    { mode: '2d', label: '2D Rack Editor', icon: <Monitor size={16} /> },
    { mode: '3d', label: '3D Inspection', icon: <Box size={16} /> },
    { mode: 'cables', label: 'Cable Map', icon: <Cable size={16} /> },
    { mode: 'topology', label: 'Network Topology', icon: <Network size={16} /> }
  ];
  views.forEach((v) => {
    items.push({
      id: `view-${v.mode}`,
      type: 'view',
      title: v.label,
      subtitle: `Switch to ${v.label}`,
      icon: <span className="text-slate-500 dark:text-slate-400">{v.icon}</span>,
      action: () => {
        useRackStore.getState().setViewMode(v.mode);
      },
      category: 'Views'
    });
  });

  // Quick Actions (global, uses current rack)
  const currentRack = workspace.racks.find((r) => r.id === currentRackId) ?? workspace.racks[0];
  if (currentRack) {
    items.push({
      id: 'action-export-json',
      type: 'action',
      title: 'Export Layout JSON',
      subtitle: 'Download current rack as JSON file',
      icon: <FileJson size={16} className="text-slate-500 dark:text-slate-400" />,
      action: () => {
        exportLayoutJson(currentRack);
      },
      category: 'Actions'
    });
  }

  return items;
}

export function filterItems(items: SearchItem[], query: string): SearchItem[] {
  if (!query.trim()) return items;
  const lower = query.toLowerCase();
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(lower) || item.subtitle.toLowerCase().includes(lower)
  );
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const workspace = useRackStore((state) => state.workspace);
  const currentRackId = useRackStore((state) => state.currentRackId);
  const viewMode = useRackStore((state) => state.viewMode);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allItems = useMemo(() => buildWorkspaceSearchItems(workspace, currentRackId), [workspace, currentRackId]);
  const filtered = useMemo(() => filterItems(allItems, query), [allItems, query]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      // Small delay to ensure focus after render
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev + 1 < filtered.length ? prev + 1 : prev));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const item = filtered[selectedIndex];
        if (item) {
          item.action();
          onClose();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, filtered, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement | null;
    if (selectedEl && 'scrollIntoView' in selectedEl) {
      (selectedEl as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleItemClick = useCallback(
    (item: SearchItem) => {
      item.action();
      onClose();
    },
    [onClose]
  );

  // Group filtered items by category
  const grouped = useMemo(() => {
    const groups = new Map<string, SearchItem[]>();
    filtered.forEach((item) => {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    });
    return groups;
  }, [filtered]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <Search size={18} className="shrink-0 text-slate-400 dark:text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
            placeholder="Search devices, cables, issues, views..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              type="button"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500 sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
              <Search size={24} className="mb-2 opacity-50" />
              <p className="text-sm">No results found</p>
              <p className="mt-1 text-xs">Try a different search term</p>
            </div>
          ) : (
            Array.from(grouped.entries()).map(([category, items]) => {
              // Calculate global index for each item within this category
              let globalIndex = 0;
              // Find starting index for this category
              for (const [cat, catItems] of Array.from(grouped.entries())) {
                if (cat === category) break;
                globalIndex += catItems.length;
              }

              return (
                <div key={category}>
                  <div className="sticky top-0 z-10 bg-white/95 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:bg-slate-900/95 dark:text-slate-500">
                    {category}
                  </div>
                  {items.map((item, i) => {
                    const idx = globalIndex + i;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        data-index={idx}
                        onClick={() => handleItemClick(item)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                          isSelected
                            ? 'bg-cyan-50 dark:bg-cyan-950/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                        type="button"
                      >
                        <span className="shrink-0">{item.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div
                            className={`truncate text-sm font-medium ${
                              isSelected
                                ? 'text-cyan-700 dark:text-cyan-300'
                                : 'text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {item.title}
                          </div>
                          <div className="truncate text-xs text-slate-400 dark:text-slate-500">
                            {item.subtitle}
                          </div>
                        </div>
                        {item.rackName && (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            <Server size={10} />
                            {item.rackName}
                          </span>
                        )}
                        {item.type === 'view' && viewMode === item.id.replace('view-', '') && (
                          <span className="shrink-0 rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-medium text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300">
                            Active
                          </span>
                        )}
                        {isSelected && (
                          <ChevronRight
                            size={14}
                            className="shrink-0 text-slate-300 dark:text-slate-600"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 border-t border-slate-200 px-4 py-2 text-[10px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 dark:border-slate-700 dark:bg-slate-800">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 dark:border-slate-700 dark:bg-slate-800">↵</kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 dark:border-slate-700 dark:bg-slate-800">esc</kbd>
            Close
          </span>
          <span className="ml-auto">{filtered.length} results</span>
        </div>
      </div>
    </div>
  );
}
