import { ChevronDown, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { deviceCatalog } from '../data/deviceCatalog';
import { useRackStore } from '../store/rackStore';
import type { DeviceCategory } from '../types/rack';
import { ENABLE_ZERO_U_PDU, shouldHideDevice } from '../utils/featureFlags';

const categories: Array<{ id: 'all' | DeviceCategory; label: string }> = [
  { id: 'all', label: 'All devices' },
  { id: 'patch-panel', label: 'Patch Panel' },
  { id: 'switch', label: 'Switch' },
  { id: 'router', label: 'Router' },
  { id: 'firewall', label: 'Firewall' },
  { id: 'modem', label: 'Modem' },
  { id: 'access-point', label: 'Access Point' },
  { id: 'poe-injector', label: 'PoE Injector' },
  { id: 'mini-pc', label: 'Mini PC' },
  { id: 'nas', label: 'NAS' },
  { id: 'server', label: 'Server' },
  { id: 'ups', label: 'UPS' },
  { id: 'pdu', label: 'PDU (1U)' },
  { id: 'pdu-0u', label: 'PDU (0U)' },
  { id: 'shelf', label: 'Shelf' },
  { id: 'cable-management', label: 'Cable Management' },
  { id: 'blank', label: 'Blank Panel' },
  { id: 'sbc', label: 'SBC' },
  { id: 'ip-kvm', label: 'IP KVM' },
  { id: 'printed-mount', label: '3D Printed' },
  { id: 'custom', label: 'Custom' }
];

export function ComponentLibrary() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | DeviceCategory>('all');
  const [open, setOpen] = useState(false);
  const viewSide = useRackStore((state) => state.layout.viewSide);
  const addDeviceFromTemplate = useRackStore((state) => state.addDeviceFromTemplate);
  const ref = useRef<HTMLDivElement>(null);
  const visibleCategories = useMemo(
    () => categories.filter((item) => ENABLE_ZERO_U_PDU || item.id !== 'pdu-0u'),
    []
  );
  const visibleCatalog = useMemo(
    () => deviceCatalog.filter((device) => !shouldHideDevice(device)),
    []
  );

  useEffect(() => {
    if (!ENABLE_ZERO_U_PDU && category === 'pdu-0u') {
      setCategory('all');
    }
  }, [category]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    visibleCategories.forEach((c) => {
      if (c.id === 'all') {
        map.set(c.id, visibleCatalog.length);
      } else {
        map.set(c.id, visibleCatalog.filter((d) => d.category === c.id).length);
      }
    });
    return map;
  }, [visibleCatalog, visibleCategories]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return visibleCatalog.filter((device) => {
      const categoryMatch = category === 'all' || device.category === category;
      const queryMatch =
        !normalized ||
        device.name.toLowerCase().includes(normalized) ||
        device.description.toLowerCase().includes(normalized) ||
        device.category.toLowerCase().includes(normalized);
      return categoryMatch && queryMatch;
    });
  }, [category, query, visibleCatalog]);

  const selectedLabel = visibleCategories.find((c) => c.id === category)?.label ?? 'All devices';

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-edge p-4 dark:border-edge">
        <h1 className="text-lg font-semibold text-content">Homelab Rack Simulator</h1>
        <p className="mt-1 text-sm text-content-muted">
          Drag devices into the current {viewSide} side or add them to the first free U.
        </p>
        <label className="mt-4 flex h-10 items-center gap-2 rounded-md border border-edge-strong bg-fill px-3 text-sm text-content-secondary dark:border-edge-strong dark:bg-surface-raised dark:text-content-secondary">
          <Search size={16} />
          <input
            className="min-w-0 flex-1 bg-transparent text-content outline-none placeholder:text-content-faint dark:text-content dark:placeholder:text-content-faint"
            placeholder="Search devices"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      {/* Category dropdown */}
      <div className="relative border-b border-edge p-3 dark:border-edge" ref={ref}>
        <button
          className="flex h-9 w-full items-center justify-between rounded-md border border-edge-strong bg-fill px-3 text-sm text-content hover:bg-fill-strong dark:border-edge-strong dark:bg-surface-raised dark:text-content dark:hover:bg-fill"
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && open) {
              event.preventDefault();
              setOpen(false);
            }
          }}
          type="button"
        >
          <span>{selectedLabel}</span>
          <ChevronDown size={15} className={`text-content-muted transition dark:text-content-muted ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-3 right-3 top-12 z-20 max-h-72 overflow-y-auto rounded-md border border-edge-strong bg-fill py-1 shadow-xl thin-scrollbar dark:border-edge-strong dark:bg-surface-raised">
              {visibleCategories.map((item) => {
                const count = counts.get(item.id) ?? 0;
                if (count === 0 && item.id !== 'all') return null;
                return (
                  <button
                    key={item.id}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                      category === item.id
                        ? 'bg-accent-solid/15 text-accent-fg dark:bg-accent/15 dark:text-accent-fg-strong'
                        : 'text-content-secondary hover:bg-fill-strong hover:text-content-secondary dark:hover:bg-fill dark:hover:text-content'
                    }`}
                    onClick={() => {
                      setCategory(item.id);
                      setOpen(false);
                    }}
                    type="button"
                  >
                    <span>{item.label}</span>
                    <span className="ml-3 text-xs text-content-faint">{count}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {/* Active filter pill */}
        {category !== 'all' && (
          <button
            className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent-solid/15 px-2.5 py-0.5 text-xs text-accent-fg hover:bg-accent-solid-hover/25 dark:bg-accent/15 dark:text-accent-fg dark:hover:bg-accent/25"
            onClick={() => setCategory('all')}
            type="button"
          >
            {selectedLabel}
            <span className="text-accent/70">×</span>
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 thin-scrollbar">
        <div className="space-y-3">
          {filtered.map((device) => (
            <article
              key={device.id}
              data-device-category={device.category}
              className={`rounded-lg border bg-fill/82 p-3 transition dark:bg-surface-raised/82 ${
                device.rackMountable === false
                  ? 'border-amber-400/35'
                  : 'border-edge hover:border-accent/70 dark:border-edge dark:hover:border-accent/70'
              }`}
              draggable={device.rackMountable !== false}
              onDragStart={(event) => {
                if (device.rackMountable === false) {
                  event.preventDefault();
                  return;
                }
                event.dataTransfer.effectAllowed = 'copy';
                event.dataTransfer.setData('application/x-rack-template', device.id);
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="mt-1 h-9 w-9 rounded-md border border-black/10 dark:border-white/10"
                  style={{ backgroundColor: device.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="truncate text-sm font-semibold text-content">{device.name}</h2>
                    <span
                      className={`shrink-0 rounded bg-fill px-2 py-0.5 text-xs dark:bg-surface ${
                        device.rackMountable === false ? 'text-amber-700 dark:text-amber-200' : 'text-content-secondary'
                      }`}
                    >
                      {device.rackMountable === false ? 'External' : `${device.defaultU}U`}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-content-muted">{device.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-content-secondary">
                    <span className="rounded bg-fill px-2 py-0.5 dark:bg-surface">{device.widthType}</span>
                    <span className="rounded bg-fill px-2 py-0.5 dark:bg-surface">{device.depthMm}mm</span>
                    <span className="rounded bg-fill px-2 py-0.5 dark:bg-surface">{device.weightKg}kg</span>
                    <span className="rounded bg-fill px-2 py-0.5 dark:bg-surface">{device.powerW}W</span>
                  </div>
                </div>
              </div>
              <button
                className="mt-3 inline-flex h-8 w-full items-center justify-center gap-2 rounded-md bg-fill-strong text-sm font-medium text-content hover:bg-slate-300 disabled:cursor-not-allowed disabled:bg-fill disabled:text-content-faint dark:bg-fill dark:text-content dark:hover:bg-fill-strong dark:disabled:bg-surface dark:disabled:text-content-faint"
                onClick={() => addDeviceFromTemplate(device.id)}
                disabled={device.rackMountable === false}
                type="button"
              >
                <Plus size={15} />
                {device.rackMountable === false ? 'External only' : `Add to ${viewSide}`}
              </button>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
