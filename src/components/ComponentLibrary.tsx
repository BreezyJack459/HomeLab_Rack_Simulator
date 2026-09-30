import { getPowerReference, POWER_BASIS_LABELS } from '../utils/powerAssumptions';
import { Plus, Search, Package, GripVertical } from "lucide-react";
import { create } from "zustand";
import { useMemo, useState } from "react";
import { DeviceComparison } from "./DeviceComparison";
import { deviceCatalog } from "../data/deviceCatalog";
import { useDeviceDragStore } from "../store/deviceDragStore";
import { getDeviceDimensionProblems } from "../utils/devicePlacement";
import { getDeviceSearchRank } from "../utils/deviceSearch";
import { useRackStore } from "../store/rackStore";
import type { DeviceCategory } from "../types/rack";
import { ENABLE_ZERO_U_PDU, shouldHideDevice } from "../utils/featureFlags";

const categories: Array<{ id: "all" | DeviceCategory; label: string }> = [
  { id: "all", label: "All devices" },
  { id: "patch-panel", label: "Patch Panel" },
  { id: "switch", label: "Switch" },
  { id: "router", label: "Router" },
  { id: "firewall", label: "Firewall" },
  { id: "modem", label: "Modem" },
  { id: "access-point", label: "Access Point" },
  { id: "poe-injector", label: "PoE Injector" },
  { id: "mini-pc", label: "Mini PC" },
  { id: "nas", label: "NAS" },
  { id: "server", label: "Server" },
  { id: "ups", label: "UPS" },
  { id: "pdu", label: "PDU (1U)" },
  { id: "pdu-0u", label: "PDU (0U)" },
  { id: "shelf", label: "Shelf" },
  { id: "cable-management", label: "Cable Management" },
  { id: "blank", label: "Blank Panel" },
  { id: "sbc", label: "SBC" },
  { id: "ip-kvm", label: "IP KVM" },
  { id: "printed-mount", label: "3D Printed" },
  { id: "custom", label: "Custom" },
];

const useLibraryFilters = create<{
  tab: "library" | "inventory";
  query: string;
  category: "all" | DeviceCategory;
  compatibleOnly: boolean;
}>(() => ({
  tab: "library",
  query: "",
  category: "all",
  compatibleOnly: false,
}));

export function ComponentLibrary() {
  const { tab, query, category, compatibleOnly } = useLibraryFilters();
  const [specs, setSpecs] = useState({ maxU: '', maxDepth: '', maxPower: '', minPorts: '' });
  const [comparedIds, setComparedIds] = useState<string[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const compared = deviceCatalog.filter(d => comparedIds.includes(d.id));
  const setTab = (tab: "library" | "inventory") =>
    useLibraryFilters.setState({ tab });
  const setQuery = (query: string) => useLibraryFilters.setState({ query });
  const setCategory = (category: "all" | DeviceCategory) =>
    useLibraryFilters.setState({ category });
  const viewMode = useRackStore((s) => s.viewMode);
  const layout = useRackStore((s) => s.layout);
  const {
    addDeviceFromTemplate,
    addDeviceToInventory,
    placeInventoryDevice,
    removeInventoryDevice,
    selectDevice,
  } = useRackStore();
  const filtered = useMemo(
    () =>
      deviceCatalog.map(d => ({
        device: d,
        rank: getDeviceSearchRank(d, query, categories.find(c => c.id === d.category)?.label),
      })).filter(
        ({ device: d, rank }) =>
          !shouldHideDevice(d) &&
          (!compatibleOnly ||
            getDeviceDimensionProblems(layout, d).length === 0) &&
          (category === "all" || d.category === category) &&
          (!specs.maxU || d.defaultU <= Number(specs.maxU)) &&
          (!specs.maxDepth || d.depthMm <= Number(specs.maxDepth)) &&
          (!specs.maxPower || d.powerW <= Number(specs.maxPower)) &&
          (!specs.minPorts || (d.ports?.ethernet ?? 0) >= Number(specs.minPorts)) &&
          rank !== null,
      ).sort((a, b) => query.trim()
        ? (a.rank ?? 0) - (b.rank ?? 0) || Number(getDeviceDimensionProblems(layout, a.device).length > 0) - Number(getDeviceDimensionProblems(layout, b.device).length > 0)
        : 0).map(({ device }) => device),
    [category, query, compatibleOnly, layout, specs],
  );
  const inventory = (layout.unplacedDevices ?? []).filter(
    (d) =>
      !shouldHideDevice(d) &&
      (!compatibleOnly || getDeviceDimensionProblems(layout, d).length === 0) &&
      `${d.name} ${d.label ?? ""}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <div className="flex h-full min-h-0 flex-col">
      {comparisonOpen && <DeviceComparison devices={compared} layout={layout} onClose={() => setComparisonOpen(false)} />}
      <div className="max-h-[60%] shrink-0 space-y-3 overflow-y-auto border-b border-edge p-3">
        <div className="flex gap-1" role="tablist" aria-label="Device source">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "library"}
            onClick={() => setTab("library")}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold ${tab === "library" ? "bg-accent-subtle text-accent-fg" : "text-content-muted"}`}
          >
            Library
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "inventory"}
            onClick={() => setTab("inventory")}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold ${tab === "inventory" ? "bg-accent-subtle text-accent-fg" : "text-content-muted"}`}
          >
            My devices ({layout.unplacedDevices?.length ?? 0})
          </button>
        </div>
        <label className="flex h-9 items-center gap-2 rounded-lg border border-edge bg-fill px-2 text-xs">
          <Search size={14} />
          <input
            aria-label="Search devices"
            placeholder="Search devices"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        {tab === "library" && (
          <select
            aria-label="Device category"
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="h-8 w-full rounded-lg border border-edge bg-surface px-2 text-xs"
          >
            {categories
              .filter((c) => ENABLE_ZERO_U_PDU || c.id !== "pdu-0u")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
          </select>
        )}
        {tab === "library" && <details>
          <summary className="cursor-pointer text-xs font-medium">Specification filters{Object.values(specs).some(Boolean) ? ' · active' : ''}</summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {([['maxU', 'Maximum U'], ['maxDepth', 'Maximum depth (mm)'], ['maxPower', 'Maximum initial load (W)'], ['minPorts', 'Minimum Ethernet ports']] as const).map(([key, label]) => <label key={key} className="text-xs text-content-secondary">{label}
              <input type="number" min="0" step="any" value={specs[key]} onChange={e => setSpecs(current => ({ ...current, [key]: e.target.value }))} className="mt-1 w-full rounded border border-edge bg-surface p-1.5" />
            </label>)}
          </div>
          <p className="mt-2 text-xs text-content-muted">Uses catalog dimensions and initial planning watts, not rated output or verified peak consumption.</p>
        </details>}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span aria-live="polite">{tab === 'library' ? filtered.length : inventory.length} matches</span>
          <button type="button" onClick={() => { useLibraryFilters.setState({ query: '', category: 'all', compatibleOnly: false }); setSpecs({ maxU: '', maxDepth: '', maxPower: '', minPorts: '' }); }} className="rounded border border-edge px-2 py-1">Clear filters</button>
        </div>
        {tab === 'library' && <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!compared.length} onClick={() => setComparisonOpen(true)} className="rounded border border-edge px-2 py-1 text-xs disabled:opacity-40">Compare selected ({compared.length}/3)</button>
          {compared.length > 0 && <button type="button" onClick={() => setComparedIds([])} className="text-xs text-content-muted">Clear comparison</button>}
        </div>}
        <label className="flex items-center gap-2 text-xs text-content-secondary">
          <input
            type="checkbox"
            checked={compatibleOnly}
            onChange={(e) =>
              useLibraryFilters.setState({ compatibleOnly: e.target.checked })
            }
          />
          Fits rack dimensions
        </label>
        {tab === "library" && query.trim() && !compatibleOnly && (
          <p className="text-xs leading-4 text-content-muted">Best matches first; similar matches that fit rack dimensions appear first. All matching devices are shown.</p>
        )}
        {compatibleOnly && (
          <p className="text-xs leading-4 text-content-muted">
            Width, height and usable depth. Free space is checked when placing.
          </p>
        )}
        <p className="text-xs leading-4 text-content-muted">
          {viewMode !== "2d"
            ? "Use Add or Place in 3D. Switch to 2D layout to drag devices."
            : tab === "library"
              ? `Drag to the rack or + to add to ${layout.viewSide}. Save owned gear to My devices.`
              : "Owned gear awaiting placement. Drag to the rack or use Place."}
        </p>
      </div>
      <div
        className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2"
        role="tabpanel"
        aria-label={tab === "library" ? "Library" : "My devices"}
      >
        {tab === "library" ? (
          filtered.map((d) => (
            <article
              key={d.id}
              data-device-category={d.category}
              draggable={viewMode === "2d" && d.rackMountable !== false}
              onDragEnd={() => useDeviceDragStore.getState().end()}
              onDragStart={(e) => {
                useDeviceDragStore
                  .getState()
                  .start({ kind: "template", id: d.id });
                e.dataTransfer.effectAllowed = "copy";
                e.dataTransfer.setData("application/x-rack-template", d.id);
              }}
              className="rounded-lg border border-edge bg-surface-raised p-2.5 hover:border-accent"
              title={`${d.name}${d.description ? ` — ${d.description}` : ""}`}
            >
              <div className="flex items-start gap-2">
                <GripVertical
                  size={12}
                  className="mt-1 shrink-0 text-content-faint"
                />
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded"
                  style={{ backgroundColor: d.color }}
                />
                <h3 className="min-w-0 flex-1 break-words text-sm font-semibold leading-5">
                  {d.name}
                </h3>
                <span className="shrink-0 text-xs text-content-muted">
                  {d.rackMountable === false ? "Ext" : `${d.defaultU}U`}
                </span>
              </div>
              <p className="mt-2 text-xs text-content-muted">
                {d.defaultU === 0 ? `${d.physicalHeightMm} mm long · rear rail` : `${d.widthType} · ${d.depthMm} mm`} · {d.powerW} W ({POWER_BASIS_LABELS[getPowerReference(d).basis]})
              </p>
              {getDeviceDimensionProblems(layout, d)[0] && (
                <p className="mt-1 text-xs leading-4 text-amber-600 dark:text-amber-300">
                  {getDeviceDimensionProblems(layout, d)[0].message}
                </p>
              )}
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input type="checkbox" checked={comparedIds.includes(d.id)} disabled={!comparedIds.includes(d.id) && comparedIds.length >= 3} onChange={e => setComparedIds(current => e.target.checked ? [...current, d.id] : current.filter(id => id !== d.id))} />
                Compare {d.name}
              </label>
              <div className="mt-2 flex gap-1">
                <button
                  type="button"
                  onClick={() => addDeviceFromTemplate(d.id)}
                  disabled={d.rackMountable === false}
                  aria-label={`Add ${d.name} to ${d.defaultU === 0 ? 'rear rail' : layout.viewSide}`}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-edge py-1.5 text-xs hover:bg-fill disabled:opacity-40"
                >
                  <Plus size={12} />
                  {d.rackMountable === false ? "External only" : "Add to rack"}
                </button>
                <button
                  type="button"
                  aria-label={`Save ${d.name} to My devices`}
                  title="Save to My devices"
                  onClick={() => addDeviceToInventory(d.id)}
                  className="rounded border border-edge p-1.5 hover:bg-fill"
                >
                  <Package size={13} />
                </button>
              </div>
            </article>
          ))
        ) : (
          <>
            {inventory.map((d) => (
              <article
                key={d.id}
                draggable={viewMode === "2d" && d.rackMountable !== false}
                onDragEnd={() => useDeviceDragStore.getState().end()}
                onDragStart={(e) => {
                  useDeviceDragStore
                    .getState()
                    .start({ kind: "inventory", id: d.id });
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("application/x-rack-inventory", d.id);
                }}
                className="rounded-lg border border-edge p-2.5"
              >
                <h3 className="break-words text-sm font-semibold leading-5">{d.label || d.name}</h3>
                <p className="mt-1 text-xs text-content-muted">
                  {d.sizeU}U · {d.widthType}
                </p>
                {getDeviceDimensionProblems(layout, d)[0] && (
                  <p className="mt-1 text-xs leading-4 text-amber-600 dark:text-amber-300">
                    {getDeviceDimensionProblems(layout, d)[0].message}
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    aria-label={`Place ${d.name}`}
                    disabled={d.rackMountable === false}
                    onClick={() => placeInventoryDevice(d.id)}
                    className="flex-1 rounded bg-accent-subtle py-1.5 text-xs text-accent-fg disabled:opacity-40"
                  >
                    {d.rackMountable === false ? "External only" : "Place"}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${d.name} from inventory`}
                    onClick={() => removeInventoryDevice(d.id)}
                    className="rounded border border-edge px-2 text-xs"
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
            {inventory.length === 0 && (
              <p className="p-2 text-xs leading-5 text-content-muted">
                {query || compatibleOnly
                  ? "No matching devices. Try changing or clearing the filters."
                  : "No unplaced devices. Use the save icon in Library to add equipment you own."}
              </p>
            )}
            <details className="rounded-lg border border-edge p-2">
              <summary className="cursor-pointer text-xs font-semibold">
                Placed in this rack ({layout.devices.length})
              </summary>
              <div className="mt-2 space-y-1">
                {layout.devices.map((d) => (
                  <button
                    type="button"
                    key={d.id}
                    onClick={() => selectDevice(d.id)}
                    className="block w-full rounded p-2 text-left text-xs hover:bg-fill"
                  >
                    U{d.positionU} · {d.label || d.name}
                  </button>
                ))}
              </div>
            </details>
          </>
        )}
        {tab === "library" && filtered.length === 0 && (
          <p className="p-2 text-xs text-content-muted">
            No matching devices. Try changing or clearing the filters.
          </p>
        )}
      </div>
    </div>
  );
}
