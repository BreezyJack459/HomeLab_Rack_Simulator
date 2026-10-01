import { useLayoutPrefsStore } from '../store/layoutPrefsStore';
import { PatchPanelTidyControl } from './PatchPanelTidyControl';
import { Cable, Search, ArrowDown } from 'lucide-react';
import { getCableDisplayColor } from '../utils/cableColors';
import { formatCableEndpoint } from '../utils/cableEndpoints';
import { useCableWorkspaceStore } from "../store/cableWorkspaceStore";
import { useRackStore } from "../store/rackStore";
import { matchesCableQuery } from "../utils/cableQuery";

export function CableSidebar({ onConnect }: { onConnect: () => void }) {
  const layout = useRackStore((s) => s.layout);
  const selected = useRackStore((s) => s.selectedCableId);
  const select = useRackStore((s) => s.selectCable);
  const {
    query,
    setQuery,
    hiddenTypes,
    setTypeVisible,
    showAllTypes,
    focusMode,
    setFocusMode,
  } = useCableWorkspaceStore();
  const types = [...new Set(layout.cables.map((c) => c.type))];
  const routes = layout.cables.filter(
    (c) =>
      c.id === selected ||
      (!hiddenTypes.includes(c.type) && matchesCableQuery(c, layout, query)),
  );
  const name = (id: string) => {
    const d = layout.devices.find((d) => d.id === id);
    return d?.label || d?.name || "External";
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 max-h-[65%] shrink-0 space-y-3 overflow-y-auto overscroll-contain border-b border-edge bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div><p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-content-muted">Connection desk · 接線</p><h2 className="text-lg font-semibold tracking-tight">Cables</h2></div>
          <span className="shrink-0 whitespace-nowrap rounded-md border border-edge bg-fill px-2 py-1 font-mono text-xs text-content-secondary">
            {routes.length} / {layout.cables.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onConnect}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-accent-solid px-3 text-sm font-semibold text-accent-on transition hover:bg-accent-solid-hover"
        >
          <Cable size={16} aria-hidden="true" />+ Connect cable
        </button>
        <button type="button" onClick={(event) => { event.currentTarget.focus(); useLayoutPrefsStore.getState().setDeviceLibraryDrawerOpen(false); requestAnimationFrame(() => useCableWorkspaceStore.getState().setABRequested(true)); }} className="min-h-11 w-full rounded-[10px] border border-accent px-3 text-sm font-semibold text-accent-fg hover:bg-accent-soft">Connect A–B · 經配線架</button>
        <PatchPanelTidyControl />
        <div className="relative"><Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 text-content-muted" /><input
          aria-label="Filter cable routes"
          type="search"
          placeholder="Search cables or devices"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 w-full rounded-[10px] border border-edge bg-fill pl-9 pr-3 text-sm"
        /></div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={showAllTypes}
            className="min-h-8 rounded-md border border-edge px-2.5 py-1 text-xs hover:bg-fill"
          >
            All
          </button>
          {types.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={!hiddenTypes.includes(type)}
              onClick={() => setTypeVisible(type, hiddenTypes.includes(type))}
              className={`min-h-8 rounded-md border px-2.5 py-1 text-xs ${hiddenTypes.includes(type) ? "border-edge text-content-muted" : "border-accent text-accent-fg"}`}
            >
              {type}
            </button>
          ))}
        </div>
        <label className="block text-xs text-content-muted">
          Selection focus
          <select
            aria-label="Cable selection focus"
            value={focusMode}
            onChange={(e) => setFocusMode(e.target.value as typeof focusMode)}
            className="mt-1 h-10 w-full rounded-[10px] border border-edge bg-surface px-3 text-content"
          >
            <option value="all">Show all routes</option>
            <option value="dim">Dim other routes</option>
            <option value="hide">Hide other routes</option>
          </select>
        </label>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
        {routes.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={selected === c.id}
            onClick={() => select(c.id)}
            className={`w-full rounded-[10px] border p-3 text-left transition ${selected === c.id ? "border-accent bg-accent-subtle" : "border-edge bg-surface hover:border-edge-strong hover:bg-fill"}`}
          >
            <div className="flex min-w-0 items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: getCableDisplayColor(c.type, c.color) }} /><span className="truncate text-sm font-semibold">{c.label || `${c.type} cable`}</span></div>
            <div className="mt-2 break-words text-xs leading-5 text-content-secondary">
              {formatCableEndpoint(layout.devices.find(d => d.id === c.fromDeviceId), c.fromPort, name(c.fromDeviceId))}
            </div>
            <ArrowDown size={12} aria-hidden="true" className="my-1 text-content-muted" /><div className="break-words text-xs leading-5 text-content-secondary">
              {formatCableEndpoint(layout.devices.find(d => d.id === c.toDeviceId), c.toPort, name(c.toDeviceId))}
            </div>
          </button>
        ))}
        {routes.length === 0 && (
          <p className="p-2 text-xs leading-5 text-content-muted">
            {layout.cables.length
              ? "No matching cables. Clear the search or show all types."
              : "Connect two device ports to create your first cable."}
          </p>
        )}
      </div>
    </div>
  );
}
