import { ChevronDown, SlidersHorizontal, Trash2, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type {
  HeatLevel,
  LifecycleStatus,
  OutletFacing,
  PlacedDevice,
  ShutdownPriority,
  ViewSide,
  WidthType,
  ZeroUMountSide,
  ZeroUMountType,
} from '../types/rack';
import { ENABLE_ZERO_U_PDU } from '../utils/featureFlags';
import {
  getDeviceMountSide,
  getDeviceSpatialZone,
  getDeviceWidthMm,
  getDeviceXRange,
  RACK_SPECS,
} from '../utils/rackMath';
import { getPortFaceMap } from '../utils/portLayout';

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
      {label}
      <input
        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function PropertySection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/70">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          {title}
        </span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? '' : '-rotate-90'}`} />
      </button>
      {isOpen && <div className="mt-3 space-y-3">{children}</div>}
    </section>
  );
}

function canSetShutdownPriority(device: PlacedDevice): boolean {
  return device.category !== 'blank' && device.category !== 'cable-management';
}

function renderPortPlacement(device: PlacedDevice, patch: (patchValue: Partial<PlacedDevice>) => void) {
  const portTypes = [
    { key: 'ethernet', label: 'Ethernet' },
    { key: 'fiber', label: 'Fiber' },
    { key: 'usb', label: 'USB' },
    { key: 'hdmi', label: 'HDMI' },
    { key: 'power', label: 'Power' },
    { key: 'atx', label: 'ATX' },
    { key: 'coax', label: 'Coax' },
  ] as const;
  const activeTypes = portTypes.filter(
    (pt) => ((device.ports as Record<string, number | undefined>)?.[pt.key] ?? 0) > 0
  );
  if (activeTypes.length === 0) return null;

  const defaults = getPortFaceMap(device.category);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/70">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        Port placement
      </div>
      <div className="space-y-1.5">
        {activeTypes.map((pt) => {
          const defaultFace = defaults[pt.key] ?? 'rear';
          const override = device.portFaceOverrides?.[pt.key];
          const currentFace = override ?? defaultFace;
          return (
            <div key={pt.key} className="flex items-center gap-2">
              <span className="w-16 text-xs text-slate-500 dark:text-slate-400">{pt.label}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-600">default {defaultFace}</span>
              <select
                className="ml-auto h-7 rounded-md border border-slate-300 bg-slate-100 px-2 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                value={override ?? ''}
                onChange={(event) => {
                  const value = event.target.value as 'front' | 'rear' | '';
                  const next = { ...(device.portFaceOverrides ?? {}) };
                  if (value === '') {
                    delete next[pt.key];
                  } else {
                    next[pt.key] = value;
                  }
                  patch({ portFaceOverrides: Object.keys(next).length > 0 ? next : undefined });
                }}
              >
                <option value="">Default ({defaultFace})</option>
                <option value="front">Front</option>
                <option value="rear">Rear</option>
              </select>
              <span
                className={`h-2 w-2 rounded-full ${currentFace === 'front' ? 'bg-cyan-400' : 'bg-orange-400'}`}
                title={currentFace}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderPortAliases(
  device: PlacedDevice,
  patch: (patchValue: Partial<PlacedDevice>) => void,
  selectedAliasKey: string,
  setSelectedAliasKey: (value: string) => void,
  aliasInput: string,
  setAliasInput: (value: string) => void
) {
  const prefixMap: Record<string, string> = {
    ethernet: 'eth',
    fiber: 'fiber',
    usb: 'usb',
    hdmi: 'hdmi',
    power: 'power',
    atx: 'atx',
    coax: 'coax',
  };
  const portKeys: string[] = [];
  if (device.ports) {
    for (const [type, count] of Object.entries(device.ports)) {
      if (type === 'layoutColumns') continue;
      const prefix = prefixMap[type] ?? type;
      for (let i = 0; i < (count ?? 0); i += 1) {
        portKeys.push(`${prefix}${i}`);
      }
    }
  }
  const aliases = device.portAliases ?? {};

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/70">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        Port aliases
      </div>
      {portKeys.length === 0 ? (
        <div className="text-xs text-slate-500 dark:text-slate-400">No ports available for aliasing</div>
      ) : (
        <>
          {Object.keys(aliases).length > 0 && (
            <div className="mb-2 space-y-1">
              {Object.entries(aliases).map(([key, alias]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{key}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">→</span>
                  <span className="flex-1 text-xs text-slate-700 dark:text-slate-200">{alias}</span>
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                    onClick={() => {
                      const next = { ...aliases };
                      delete next[key];
                      patch({ portAliases: Object.keys(next).length > 0 ? next : undefined });
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <select
              className="h-7 rounded-md border border-slate-300 bg-slate-100 px-2 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              value={selectedAliasKey}
              onChange={(event) => setSelectedAliasKey(event.target.value)}
            >
              <option value="">Select port…</option>
              {portKeys
                .filter((key) => !aliases[key])
                .map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
            </select>
            <input
              type="text"
              className="h-7 flex-1 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              placeholder="Alias name"
              value={aliasInput}
              onChange={(event) => setAliasInput(event.target.value)}
            />
            <button
              type="button"
              className="inline-flex h-7 items-center rounded-md border border-slate-300 bg-slate-200 px-2 text-xs font-medium text-slate-700 hover:bg-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              onClick={() => {
                if (!selectedAliasKey || !aliasInput.trim()) return;
                patch({
                  portAliases: {
                    ...aliases,
                    [selectedAliasKey]: aliasInput.trim(),
                  },
                });
                setSelectedAliasKey('');
                setAliasInput('');
              }}
            >
              Add
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function PropertyPanel() {
  const layout = useRackStore((state) => state.layout);
  const selectedDeviceId = useRackStore((state) => state.selectedDeviceId);
  const updateDevice = useRackStore((state) => state.updateDevice);
  const removeDevice = useRackStore((state) => state.removeDevice);
  const setViewMode = useRackStore((state) => state.setViewMode);
  const selectDevice = useRackStore((state) => state.selectDevice);
  const device = useMemo(
    () => layout.devices.find((item) => item.id === selectedDeviceId) ?? null,
    [layout.devices, selectedDeviceId]
  );

  function patch(patchValue: Partial<PlacedDevice>) {
    if (!device) return;
    updateDevice(device.id, patchValue);
  }

  function patchPort(port: keyof NonNullable<PlacedDevice['ports']>, value: number) {
    if (!device) return;
    patch({
      ports: {
        ...(device.ports ?? {}),
        [port]: Math.max(0, Math.floor(value)),
      },
    });
  }

  const rackUsableWidth = RACK_SPECS[layout.rackType].usableWidthMm;
  const selectedXRange = device ? getDeviceXRange(layout, device) : null;

  const pdu0uMeta = useMemo(() => {
    if (!ENABLE_ZERO_U_PDU || !device || device.category !== 'pdu-0u') return null;
    const outlets = device.ports?.power ?? 0;
    const used = layout.cables.filter(
      (cable) => cable.fromDeviceId === device.id || cable.toDeviceId === device.id
    ).length;
    let powerBudget = 0;
    layout.cables.forEach((cable) => {
      if (cable.type !== 'power') return;
      const poweredDeviceId =
        cable.fromDeviceId === device.id
          ? cable.toDeviceId
          : cable.toDeviceId === device.id
            ? cable.fromDeviceId
            : null;
      if (!poweredDeviceId || poweredDeviceId === device.id) return;
      const poweredDevice = layout.devices.find((d) => d.id === poweredDeviceId);
      if (poweredDevice) powerBudget += poweredDevice.powerW;
    });
    const zone = getDeviceSpatialZone(device);
    const feed = zone.includes('left') ? 'A' : zone.includes('right') ? 'B' : '-';
    return { outlets, used, powerBudget, location: zone, feed };
  }, [device, layout.cables, layout.devices]);

  const [isOpen, setIsOpen] = useState(true);
  const [selectedAliasKey, setSelectedAliasKey] = useState('');
  const [aliasInput, setAliasInput] = useState('');

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-100/78 p-3.5 dark:border-slate-800 dark:bg-slate-900/78">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="mb-2.5 flex w-full items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={15} />
          Properties
        </div>
        <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          {!device ? (
            <div className="space-y-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4 text-sm dark:border-slate-700 dark:bg-slate-950/60">
              <div className="font-medium text-slate-700 dark:text-slate-200">No component selected</div>
              <div className="text-slate-500 dark:text-slate-400">
                Select a device in the rack canvas to edit identity, physical fit, power and ports.
              </div>
              <div className="flex flex-wrap gap-2">
                {layout.devices.length > 0 && (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    onClick={() => {
                      selectDevice(layout.devices[0].id);
                      setViewMode('2d');
                    }}
                  >
                    Focus first device
                  </button>
                )}
                {layout.cables.length > 0 && (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    onClick={() => setViewMode('cables')}
                  >
                    Open cable map
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-white/70 to-white/30 p-3 shadow-sm dark:from-cyan-500/10 dark:via-slate-950/70 dark:to-slate-950/50">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
                      Selection
                    </div>
                    <div className="mt-1 truncate text-base font-semibold text-slate-900 dark:text-white">
                      {device.name}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Edit identity, fit, power and connectivity from the focused device surface.
                    </p>
                  </div>
                  <div className="grid shrink-0 grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                      {device.category}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                      U{device.positionU}{device.sizeU > 1 ? `-${device.positionU + device.sizeU - 1}` : ''}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                      {device.widthType}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                      {getDeviceMountSide(device)}
                    </span>
                  </div>
                </div>
              </div>

              <PropertySection title="Overview">
                <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Name
                  <input
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    value={device.name}
                    onChange={(event) => patch({ name: event.target.value })}
                  />
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Label
                  <input
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    value={device.label ?? ''}
                    onChange={(event) => patch({ label: event.target.value })}
                    placeholder="Optional front label"
                  />
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400 md:col-span-2">
                  Description
                  <textarea
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    value={device.description ?? ''}
                    onChange={(event) => patch({ description: event.target.value })}
                    placeholder="Optional notes or description"
                    rows={3}
                  />
                </label>
                </div>
              </PropertySection>

              <PropertySection title="Physical">
                <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs text-slate-500 dark:text-slate-400 md:col-span-2">
                  Mount side
                  <select
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    value={getDeviceMountSide(device)}
                    onChange={(event) => patch({ mountSide: event.target.value as ViewSide })}
                  >
                    <option value="front">Front side</option>
                    <option value="rear">Rear side</option>
                  </select>
                </label>

                {ENABLE_ZERO_U_PDU && device.sizeU === 0 && (
                  <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-100 p-3 dark:border-slate-800 dark:bg-slate-950">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      0U Mount
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Mount type
                        <select
                          className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          value={device.mountType ?? 'rear-rail'}
                          onChange={(event) => patch({ mountType: event.target.value as ZeroUMountType })}
                        >
                          <option value="rear-rail">Rear rail (behind rack)</option>
                          <option value="side-rail">Side rail (outer face)</option>
                        </select>
                      </label>
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Side
                        <select
                          className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          value={device.mountSide0U ?? 'left'}
                          onChange={(event) => patch({ mountSide0U: event.target.value as ZeroUMountSide })}
                        >
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                        </select>
                      </label>
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Outlet facing
                        <select
                          className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          value={device.outletFacing ?? 'forward'}
                          onChange={(event) => patch({ outletFacing: event.target.value as OutletFacing })}
                        >
                          <option value="forward">Forward (toward rack)</option>
                          <option value="outward">Outward (away from rack)</option>
                          <option value="inward">Inward (toward center)</option>
                        </select>
                      </label>
                    </div>
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  <NumberField label="Position U" min={1} max={layout.heightU} value={device.positionU} onChange={(value) => patch({ positionU: value })} />
                  <NumberField
                    label="X offset mm"
                    min={0}
                    max={Math.max(0, rackUsableWidth - Math.min(getDeviceWidthMm(device), rackUsableWidth))}
                    value={Math.round(selectedXRange?.x ?? 0)}
                    onChange={(value) => patch({ xMm: value })}
                  />
                  <NumberField label="Rack size U" min={1} max={layout.heightU} value={device.sizeU} onChange={(value) => patch({ sizeU: value })} />
                  <NumberField label="Depth mm" min={1} value={device.depthMm} onChange={(value) => patch({ depthMm: value })} />
                  <NumberField label="Mount envelope mm" min={0} value={device.mountEnvelopeMm ?? 0} onChange={(value) => patch({ mountEnvelopeMm: value })} />
                  <NumberField label="Weight kg" min={0} step={0.1} value={device.weightKg} onChange={(value) => patch({ weightKg: value })} />
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_92px] gap-3">
                  <label className="text-xs text-slate-500 dark:text-slate-400">
                    Width type
                    <select
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      value={device.widthType}
                      onChange={(event) => patch({ widthType: event.target.value as WidthType })}
                    >
                      <option value="10in">10-inch</option>
                      <option value="19in">19-inch</option>
                      <option value="shelf">Shelf-mounted</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>
                  <label className="text-xs text-slate-500 dark:text-slate-400">
                    Color
                    <input
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white p-1 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-700 dark:bg-slate-950"
                      type="color"
                      value={device.color}
                      onChange={(event) => patch({ color: event.target.value })}
                    />
                  </label>
                </div>

                {(device.widthType === 'custom' || device.widthType === 'shelf') && (
                  <NumberField
                    label="Custom width mm"
                    min={40}
                    value={device.customWidthMm ?? 220}
                    onChange={(value) => patch({ customWidthMm: value })}
                  />
                )}
                </div>
              </PropertySection>

              <PropertySection title="Power & Lifecycle">
                <div className="grid gap-3 md:grid-cols-2">
                  <NumberField label="Power W" min={0} value={device.powerW} onChange={(value) => patch({ powerW: value })} />
                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    Heat
                    <select
                      className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      value={device.heatLevel}
                      onChange={(event) => patch({ heatLevel: Number(event.target.value) as HeatLevel })}
                    >
                      {[1, 2, 3, 4, 5].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                  Status
                  <select
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    value={device.lifecycleStatus ?? 'active'}
                    onChange={(event) => patch({ lifecycleStatus: event.target.value as LifecycleStatus })}
                  >
                    <option value="active">Active</option>
                    <option value="planned">Planned</option>
                    <option value="decommissioning">Decommissioning</option>
                  </select>
                </label>

                {canSetShutdownPriority(device) && (
                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    Outage priority
                    <select
                      className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      value={device.shutdownPriority ?? 'non-critical'}
                      onChange={(event) => patch({ shutdownPriority: event.target.value as ShutdownPriority })}
                    >
                      <option value="critical">Critical - keep online longest</option>
                      <option value="graceful">Graceful - needs clean shutdown</option>
                      <option value="non-critical">Non-critical - shed first</option>
                    </select>
                  </label>
                )}

                {canSetShutdownPriority(device) && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400 md:col-span-2">
                      Boot depends on
                      <select
                        multiple
                        className="min-h-[5rem] w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        value={device.bootDependsOn ?? []}
                        onChange={(event) => {
                          const options = Array.from(event.target.selectedOptions).map((o) => o.value);
                          patch({ bootDependsOn: options.length > 0 ? options : undefined });
                        }}
                      >
                        {layout.devices
                          .filter(
                            (d) =>
                              d.id !== device.id &&
                              d.category !== 'blank' &&
                              d.category !== 'cable-management'
                          )
                          .map((d) => (
                          <option key={d.id} value={d.id}>
                              {d.name} (U{d.positionU})
                            </option>
                          ))}
                      </select>
                    </label>

                    <NumberField
                      label="Boot delay (seconds)"
                      value={device.bootDelaySeconds ?? 0}
                      min={0}
                      step={1}
                      onChange={(value) => patch({ bootDelaySeconds: value > 0 ? value : undefined })}
                    />
                  </div>
                )}

                {(device.category === 'ups' || device.category === 'pdu' || (ENABLE_ZERO_U_PDU && device.category === 'pdu-0u')) && (
                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    Circuit
                    <select
                      className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      value={device.circuit ?? ''}
                      onChange={(event) => patch({ circuit: event.target.value ? (event.target.value as 'A' | 'B') : undefined })}
                    >
                      <option value="">Unassigned</option>
                      <option value="A">Circuit A</option>
                      <option value="B">Circuit B</option>
                    </select>
                  </label>
                )}
              </PropertySection>

              <PropertySection title="Ports & Connectivity">
                <div className="rounded-2xl border border-slate-200 bg-slate-100 p-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
                    <NumberField label="ETH" min={0} value={device.ports?.ethernet ?? 0} onChange={(value) => patchPort('ethernet', value)} />
                    <NumberField label="Fiber" min={0} value={device.ports?.fiber ?? 0} onChange={(value) => patchPort('fiber', value)} />
                    <NumberField label="USB" min={0} value={device.ports?.usb ?? 0} onChange={(value) => patchPort('usb', value)} />
                    <NumberField label="HDMI" min={0} value={device.ports?.hdmi ?? 0} onChange={(value) => patchPort('hdmi', value)} />
                    <NumberField label="Power" min={0} value={device.ports?.power ?? 0} onChange={(value) => patchPort('power', value)} />
                    <NumberField label="ATX" min={0} value={device.ports?.atx ?? 0} onChange={(value) => patchPort('atx', value)} />
                    <NumberField label="Coax" min={0} value={device.ports?.coax ?? 0} onChange={(value) => patchPort('coax', value)} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <NumberField
                      label="Port columns"
                      min={1}
                      value={device.ports?.layoutColumns ?? device.ports?.ethernet ?? 1}
                      onChange={(value) => patchPort('layoutColumns', value)}
                    />
                    <div className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                      Width used
                      <div className="mt-1 font-semibold text-slate-900 dark:text-white">
                        {Math.min(getDeviceWidthMm(device), rackUsableWidth).toFixed(0)} / {rackUsableWidth.toFixed(0)}mm
                      </div>
                    </div>
                  </div>
                  {renderPortPlacement(device, patch)}
                  {renderPortAliases(
                    device,
                    patch,
                    selectedAliasKey,
                    setSelectedAliasKey,
                    aliasInput,
                    setAliasInput
                  )}
                </div>
              </PropertySection>

              {pdu0uMeta && (
                <div className="rounded-2xl border border-slate-200 bg-slate-100 p-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    <Zap size={13} />
                    0U PDU Status
                  </div>
                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400 dark:text-slate-500">Outlets</span>
                      <span>{pdu0uMeta.outlets} total</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 dark:text-slate-500">Used</span>
                      <span>
                        {pdu0uMeta.used} ({pdu0uMeta.outlets > 0 ? Math.round((pdu0uMeta.used / pdu0uMeta.outlets) * 100) : 0}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 dark:text-slate-500">Power budget</span>
                      <span>{pdu0uMeta.powerBudget}W / 2400W</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 dark:text-slate-500">Location</span>
                      <span className="capitalize">{pdu0uMeta.location.replace('-', ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 dark:text-slate-500">Feed</span>
                      <span>Feed {pdu0uMeta.feed}</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 text-sm font-medium text-red-800 hover:bg-red-500/20 dark:text-red-100"
                onClick={() => removeDevice(device.id)}
                type="button"
              >
                <Trash2 size={15} />
                Remove component
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
