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
      <div className="space-y-3 border-b border-edge p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Cables</h2>
          <span className="text-xs text-content-muted">
            {routes.length} / {layout.cables.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onConnect}
          className="w-full rounded-lg bg-accent-solid py-2 text-sm font-semibold text-accent-on"
        >
          + Connect cable
        </button>
        <input
          aria-label="Filter cable routes"
          type="search"
          placeholder="Search cables or devices"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 w-full rounded-lg border border-edge bg-fill px-2 text-xs"
        />
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={showAllTypes}
            className="rounded border border-edge px-2 py-1 text-xs"
          >
            All
          </button>
          {types.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={!hiddenTypes.includes(type)}
              onClick={() => setTypeVisible(type, hiddenTypes.includes(type))}
              className={`rounded border px-2 py-1 text-xs ${hiddenTypes.includes(type) ? "border-edge text-content-muted" : "border-accent text-accent-fg"}`}
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
            className="mt-1 h-8 w-full rounded border border-edge bg-surface px-2"
          >
            <option value="all">Show all routes</option>
            <option value="dim">Dim other routes</option>
            <option value="hide">Hide other routes</option>
          </select>
        </label>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {routes.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={selected === c.id}
            onClick={() => select(c.id)}
            className={`w-full rounded-lg border p-2.5 text-left ${selected === c.id ? "border-accent bg-accent-subtle" : "border-transparent hover:bg-fill"}`}
          >
            <div className="truncate text-xs font-semibold">
              {c.label || `${c.type} cable`}
            </div>
            <div className="mt-1 break-words text-xs text-content-muted">
              {formatCableEndpoint(layout.devices.find(d => d.id === c.fromDeviceId), c.fromPort, name(c.fromDeviceId))}
            </div>
            <div className="break-words text-xs text-content-muted">
              → {formatCableEndpoint(layout.devices.find(d => d.id === c.toDeviceId), c.toPort, name(c.toDeviceId))}
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
