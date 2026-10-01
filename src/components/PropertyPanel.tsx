import { PortSpecificationsEditor } from './PortSpecificationsEditor';
import { InstallationFields } from './InstallationFields';
import { getPowerReference, planningPowerBasis, POWER_BASIS_LABELS } from '../utils/powerAssumptions';
import { ChevronDown, SlidersHorizontal, Trash2, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { IssuePropertyTarget } from '../utils/checkWorkflow';
import { useRackStore } from '../store/rackStore';
import type {
  HeatLevel,
  PowerBasis,
  LifecycleStatus,
  OutletFacing,
  PlacedDevice,
  ShutdownPriority,
  ViewSide,
  WidthType,
  ZeroUMountSide,
  ZeroUMountType,
} from '../types/rack';
import { ENABLE_ZERO_U_PDU, shouldHideDevice } from '../utils/featureFlags';
import {
  getDeviceMountSide,
  getDeviceSpatialZone,
  getDeviceWidthMm,
  getDeviceXRange,
  RACK_SPECS,
  zeroUHeightMm,
  zeroUBottomMm,
  zeroUDepthMm,
  U_HEIGHT_MM,
} from '../utils/rackMath';
import { isPowerSource } from '../utils/powerChain';
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
    <label className="space-y-1 text-xs text-content-muted">
      {label}
      <input
        className="h-10 w-full rounded-lg border border-edge-strong bg-surface px-2.5 text-sm text-content outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-edge-strong dark:bg-surface dark:text-content"
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
  focusTarget,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  focusTarget?: IssuePropertyTarget;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen || !!focusTarget);
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => { if (focusTarget) setIsOpen(true); }, [focusTarget]);
  useEffect(() => {
    if (!focusTarget || !isOpen) return;
    const frame = requestAnimationFrame(() => {
      const section = sectionRef.current;
      if (!section) return;
      const label = focusTarget.field ? [...section.querySelectorAll('label')].find(item => item.textContent?.trim().startsWith(focusTarget.field!)) : undefined;
      const target = label?.querySelector<HTMLElement>('input,select,textarea') ?? section.querySelector<HTMLElement>('button');
      target?.focus({ preventScroll: true });
      target?.scrollIntoView?.({ block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusTarget, isOpen]);

  return (
    <section ref={sectionRef} className={`border-t border-edge py-3 ${focusTarget ? 'ring-2 ring-accent/40' : ''}`}>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-xs font-semibold text-content-secondary">
          {title}
        </span>
        <ChevronDown size={14} className={`motion-safe:transition-transform ${isOpen ? '' : '-rotate-90'}`} />
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
    <div className="border-t border-edge py-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-content-faint">
        Port placement
      </div>
      <div className="space-y-1.5">
        {activeTypes.map((pt) => {
          const defaultFace = defaults[pt.key] ?? 'rear';
          const override = device.portFaceOverrides?.[pt.key];
          const currentFace = override ?? defaultFace;
          return (
            <div key={pt.key} className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-2">
              <span className="pt-1 text-xs text-content-muted">{pt.label}</span>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-[10px] text-content-faint">default {defaultFace}</span>
                <select
                  className="h-10 min-w-0 flex-1 rounded-md border border-edge-strong bg-fill px-2 text-xs text-content outline-none dark:border-edge-strong dark:bg-surface-raised dark:text-content"
                  aria-label={`${pt.label} port face`}
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
                  className={`h-2 w-2 shrink-0 rounded-full ${currentFace === 'front' ? 'bg-accent' : 'bg-orange-400'}`}
                  title={currentFace}
                />
              </div>
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
    <div className="border-t border-edge py-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-content-faint">
        Port aliases
      </div>
      {portKeys.length === 0 ? (
        <div className="text-xs text-content-muted">No ports available for aliasing</div>
      ) : (
        <>
          {Object.keys(aliases).length > 0 && (
            <div className="mb-2 space-y-1">
              {Object.entries(aliases).map(([key, alias]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="shrink-0 text-xs font-medium text-content-secondary">{key}</span>
                  <span className="shrink-0 text-xs text-content-faint">→</span>
                  <span className="min-w-0 flex-1 break-words text-xs text-content-secondary dark:text-content">{alias}</span>
                  <button
                    type="button"
                    aria-label={`Remove alias for ${key}`}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-content-faint hover:text-red-500 dark:text-content-faint dark:hover:text-red-400"
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
          <div className="grid gap-2">
            <select
              className="h-10 min-w-0 rounded-md border border-edge-strong bg-fill px-2 text-xs text-content outline-none dark:border-edge-strong dark:bg-surface-raised dark:text-content"
              aria-label="Port to alias"
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
              className="h-10 min-w-0 rounded-md border border-edge-strong bg-surface px-2 text-xs text-content outline-none dark:border-edge-strong dark:bg-surface dark:text-content"
              aria-label="Port alias name"
              placeholder="Alias name"
              value={aliasInput}
              onChange={(event) => setAliasInput(event.target.value)}
            />
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-edge-strong bg-fill-strong px-2 text-xs font-medium text-content-secondary hover:bg-fill dark:border-edge-strong dark:bg-fill dark:text-content dark:hover:bg-fill-strong"
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

export function PropertyPanel({ focusTarget }: { focusTarget?: IssuePropertyTarget }) {
  const layout = useRackStore((state) => state.layout);
  const selectedDeviceId = useRackStore((state) => state.selectedDeviceId);
  const updateDevice = useRackStore((state) => state.updateDevice);
  const removeDevice = useRackStore((state) => state.removeDevice);
  const setViewMode = useRackStore((state) => state.setViewMode);
  const selectDevice = useRackStore((state) => state.selectDevice);
  const device = useMemo(
    () => layout.devices.find((item) => item.id === selectedDeviceId && !shouldHideDevice(item)) ?? null,
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
    const feed = device.circuit;
    return { outlets, used, powerBudget, location: zone, feed };
  }, [device, layout.cables, layout.devices]);

  const [isOpen, setIsOpen] = useState(true);
  useEffect(() => { if (focusTarget) setIsOpen(true); }, [focusTarget]);
  const [selectedAliasKey, setSelectedAliasKey] = useState('');
  const [aliasInput, setAliasInput] = useState('');

  return (
    <section className="min-w-0">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="device-properties-content"
        onClick={() => setIsOpen((v) => !v)}
        className="mb-3 flex min-h-11 w-full items-center justify-between gap-2 border-b border-edge pb-2 text-xs font-semibold text-content-secondary hover:text-content"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={15} />
          Properties
        </div>
        <ChevronDown size={16} className={`motion-safe:transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
      </button>
      <div id="device-properties-content" hidden={!isOpen}>
        <div className="min-w-0">
          {!device ? (
            <div className="space-y-3 py-4 text-sm">
              <div className="font-medium text-content-secondary dark:text-content">No component selected</div>
              <div className="text-content-muted">
                Select a device in the rack canvas to edit identity, physical fit, power and ports.
              </div>
              <div className="flex flex-wrap gap-2">
                {layout.devices.length > 0 && (
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center rounded-md border border-edge-strong bg-fill-strong px-3 text-xs font-medium text-content-secondary hover:bg-fill dark:border-edge-strong dark:bg-fill dark:text-content dark:hover:bg-fill-strong"
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
                    className="inline-flex min-h-11 items-center rounded-md border border-edge-strong bg-fill-strong px-3 text-xs font-medium text-content-secondary hover:bg-fill dark:border-edge-strong dark:bg-fill dark:text-content dark:hover:bg-fill-strong"
                    onClick={() => setViewMode('cables')}
                  >
                    Open cable map
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="border-l-2 border-accent pl-3 py-1">
                <div className="flex flex-col gap-2">
                  <div className="min-w-0">
                    <div className="break-words text-base font-semibold leading-6 text-content">
                      {device.name}
                    </div>
                  </div>
                  <div
                    data-testid="property-selection-meta"
                    className="flex flex-wrap gap-1 text-[10px] text-content-secondary"
                  >
                    <span className="rounded-md bg-fill px-2 py-1 text-center">
                      {device.category}
                    </span>
                    {device.mountingSupport === 'printed-mount' && <span className="rounded-md bg-accent-subtle px-2 py-1 text-accent-fg">3D-printed mount</span>}
                    <span className="rounded-md bg-fill px-2 py-1 text-center">
                      {device.sizeU === 0 ? '0U' : `U${device.positionU}`}{device.sizeU > 1 ? `-${device.positionU + device.sizeU - 1}` : ''}
                    </span>
                    <span className="rounded-md bg-fill px-2 py-1 text-center">
                      {device.widthType === 'shelf' && device.mountingSupport === 'printed-mount' ? 'compact' : device.widthType}
                    </span>
                    <span className="rounded-md bg-fill px-2 py-1 text-center">
                      {getDeviceMountSide(device)}
                    </span>
                  </div>
                </div>
              </div>

              <label className="block text-xs text-content-muted">
                  Name
                  <input
                    className="mt-1 h-10 w-full rounded-lg border border-edge-strong bg-surface px-2.5 text-sm text-content outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-edge-strong dark:bg-surface dark:text-content"
                    value={device.name}
                    onChange={(event) => patch({ name: event.target.value })}
                  />
                </label>
                {device.sizeU !== 0 && <><label className="block text-xs text-content-muted">
                  Mount side
                  <select
                    className="mt-1 h-10 w-full rounded-lg border border-edge-strong bg-surface px-2.5 text-sm text-content outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-edge-strong dark:bg-surface dark:text-content"
                    value={getDeviceMountSide(device)}
                    onChange={(event) => patch({ mountSide: event.target.value as ViewSide })}
                  >
                    <option value="front">Front side</option>
                    <option value="rear">Rear side</option>
                  </select>
                </label>
                  <NumberField label="Position U" min={1} max={layout.heightU} value={device.positionU} onChange={(value) => patch({ positionU: value })} /></>}
              <PropertySection title="Labels & notes" defaultOpen={false}>
                <div className="grid gap-3">


                <label className="text-xs text-content-muted">
                  Label
                  <input
                    className="mt-1 h-10 w-full rounded-lg border border-edge-strong bg-surface px-2.5 text-sm text-content outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-edge-strong dark:bg-surface dark:text-content"
                    value={device.label ?? ''}
                    onChange={(event) => patch({ label: event.target.value })}
                    placeholder="Optional front label"
                  />
                </label>
                <label className="text-xs text-content-muted">
                  Description
                  <textarea
                    className="mt-1 w-full rounded-lg border border-edge-strong bg-surface px-2.5 py-2 text-sm text-content outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-edge-strong dark:bg-surface dark:text-content"
                    value={device.description ?? ''}
                    onChange={(event) => patch({ description: event.target.value })}
                    placeholder="Optional notes or description"
                    rows={3}
                  />
                </label>
                </div>
              </PropertySection>

              <PropertySection key={device.sizeU === 0 ? 'zero-u' : 'standard'} title="Dimensions & placement" focusTarget={focusTarget?.section === "Dimensions & placement" ? focusTarget : undefined} defaultOpen={device.sizeU === 0}>
                  {device.category === 'shelf' && <div className="space-y-3 rounded-xl border border-edge p-3">
                    <label className="block space-y-1 text-xs text-content-muted">
                      <span>Shelf placement</span>
                      <select className="h-10 w-full rounded-lg border border-edge-strong bg-surface px-2 text-content" value={device.shelfStyle ?? 'solid'} onChange={event => patch({ shelfStyle: event.target.value as 'solid' | 'tray' })}>
                        <option value="solid">Separate U (existing shelf)</option>
                        <option value="tray">Thin tray — share U with devices</option>
                      </select>
                    </label>
                    {device.shelfStyle === 'tray' && <>
                      <p className="text-xs text-content-muted">Place compact devices at this shelf’s starting U and mount side. Leave 3 mm at each side. Devices must fit the tray depth and their reserved U height. Moving the shelf does not move equipment.</p>
                      <NumberField label="Tray thickness mm" value={device.shelfThicknessMm ?? 2} min={1} onChange={value => patch({ shelfThicknessMm: Math.max(1, value) })} />
                      <NumberField label="Deck bottom above U boundary mm" value={device.shelfDeckOffsetMm ?? 0} min={0} onChange={value => patch({ shelfDeckOffsetMm: Math.max(0, value) })} />
                      <NumberField label="Shelf load limit kg (0 = unspecified)" value={device.shelfLoadLimitKg ?? 0} min={0} onChange={value => patch({ shelfLoadLimitKg: Math.max(0, value) })} />
                    </>}
                  </div>}
                  {device.sizeU !== 0 && ['shelf', 'custom'].includes(device.widthType) && device.category !== 'shelf' && <div className="grid gap-3">
                    <NumberField label="Actual device height mm" value={device.physicalHeightMm ?? Math.max(1, device.sizeU * 44.45 - 4.445)} min={1} step={0.1} onChange={value => patch({ physicalHeightMm: Math.max(1, value) })} />
                    <NumberField label="Clearance above mm" value={device.clearanceAboveMm ?? 0} min={0} onChange={value => patch({ clearanceAboveMm: Math.max(0, value) })} />
                    <p className="text-xs text-content-muted">Default height is estimated from Rack size U. Enter measured height and required ventilation clearance for a precise tray fit.</p>
                  </div>}
                <div className="space-y-3">


                {ENABLE_ZERO_U_PDU && device.sizeU === 0 && (
                  <div className="rounded-lg bg-fill-subtle p-3">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-content-faint">
                      0U Mount
                    </div>
                    <div className="grid gap-2">
                      <NumberField label="PDU length mm" min={1} max={Math.floor(layout.heightU * U_HEIGHT_MM - zeroUBottomMm(device))} value={Math.round(zeroUHeightMm(layout, device))}
                        onChange={value => patch({ physicalHeightMm: value, depthMm: zeroUDepthMm(device) })} />
                      <NumberField label="Height above base mm" min={0} max={Math.floor(layout.heightU * U_HEIGHT_MM - zeroUHeightMm(layout, device))} value={Math.round(zeroUBottomMm(device))}
                        onChange={value => patch({ positionU: 1 + value / U_HEIGHT_MM })} />
                      <p className="text-xs text-content-muted">0U uses no rack units. Left/right are named looking into the rack from the front. Mounting brackets and cabinet clearance are approximate.</p>
                      <label className="text-xs text-content-muted">
                        Mount type
                        <select
                          className="mt-1 h-10 w-full rounded-lg border border-edge-strong bg-surface px-2.5 text-sm text-content outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-edge-strong dark:bg-surface dark:text-content"
                          value={device.mountType ?? 'rear-rail'}
                          onChange={(event) => patch({ mountType: event.target.value as ZeroUMountType })}
                        >
                          <option value="rear-rail">Rear rail (behind rack)</option>
                          <option value="side-rail">Side rail (outer face)</option>
                        </select>
                      </label>
                      <label className="text-xs text-content-muted">
                        Side
                        <select
                          className="mt-1 h-10 w-full rounded-lg border border-edge-strong bg-surface px-2.5 text-sm text-content outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-edge-strong dark:bg-surface dark:text-content"
                          value={device.mountSide0U ?? 'left'}
                          onChange={(event) => patch({ mountSide0U: event.target.value as ZeroUMountSide })}
                        >
                          <option value="left">Left (from front)</option>
                          <option value="right">Right (from front)</option>
                        </select>
                      </label>
                      <label className="text-xs text-content-muted">
                        Outlet facing
                        <select
                          className="mt-1 h-10 w-full rounded-lg border border-edge-strong bg-surface px-2.5 text-sm text-content outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-edge-strong dark:bg-surface dark:text-content"
                          value={device.outletFacing ?? 'forward'}
                          onChange={(event) => patch({ outletFacing: event.target.value as OutletFacing })}
                        >
                          <option value="forward">Toward rack front</option>
                          <option value="outward">Toward rear door</option>
                          <option value="inward">Inward (toward center)</option>
                        </select>
                      </label>
                    </div>
                  </div>
                )}

                <div className="grid gap-3">

                  {device.sizeU !== 0 && (device.widthType === 'shelf' || device.widthType === 'custom') && device.category !== 'printed-mount' && device.category !== 'shelf' && (
                    <div className="space-y-2 rounded-xl border border-edge p-3">
                      <label className="block space-y-1 text-xs text-content-muted">
                        <span>Mounting support</span>
                        <select
                          className="h-10 w-full rounded-lg border border-edge-strong bg-surface px-2.5 text-sm text-content"
                          value={device.mountingSupport ?? 'shelf'}
                          onChange={event => patch({ mountingSupport: event.target.value as 'shelf' | 'printed-mount' })}
                        >
                          <option value="shelf">Shelf support</option>
                          <option value="printed-mount">3D-printed rack mount</option>
                        </select>
                      </label>
                      {device.mountingSupport === 'printed-mount' && <>
                        <p className="text-xs leading-relaxed text-content-muted">Mounted with a printed bracket or modular rack panel at the device’s U position. No separate shelf is required in the plan.</p>
                        <label className="block space-y-1 text-xs text-content-muted">
                          <span>Printed mount model URL</span>
                          <input type="url" value={device.printedMountUrl ?? ''} placeholder="https://www.printables.com/model/…"
                            className="h-10 w-full rounded-lg border border-edge-strong bg-surface px-2.5 text-sm text-content"
                            onChange={event => patch({ printedMountUrl: event.target.value })} />
                        </label>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-accent">
                          <a href="https://leprachuan.github.io/rack-mount-generator/" target="_blank" rel="noopener noreferrer" className="underline">Open bracket generator ↗</a>
                          <a href="https://github.com/WebMaka/CageMakerPRCG" target="_blank" rel="noopener noreferrer" className="underline">CageMaker ↗</a>
                        </div>
                        <p className="text-xs leading-relaxed text-content-faint">Both 3D views show a simplified bracket. Printed mounts at the same U on the same face join into one modular panel. Check actual model dimensions and load rating; this preview is not a printable STL and does not reserve extra rack space.</p>
                      </>}
                    </div>
                  )}
                  {device.sizeU !== 0 && <><NumberField
                    label="X offset mm"
                    min={0}
                    max={Math.max(0, rackUsableWidth - Math.min(getDeviceWidthMm(device), rackUsableWidth))}
                    value={Math.round(selectedXRange?.x ?? 0)}
                    onChange={(value) => patch({ xMm: value })}
                  />
                  <NumberField label="Rack size U" min={1} max={layout.heightU} value={device.sizeU} onChange={(value) => patch({ sizeU: value })} /></>}
                  <NumberField label="Depth mm" min={1} value={device.sizeU === 0 ? zeroUDepthMm(device) : device.depthMm} onChange={(value) => patch({ depthMm: value, ...(device.sizeU === 0 ? { physicalHeightMm: zeroUHeightMm(layout, device) } : {}) })} />
                  <NumberField label="Mount envelope mm" min={0} value={device.mountEnvelopeMm ?? 0} onChange={(value) => patch({ mountEnvelopeMm: value })} />
                  <NumberField label="Weight kg" min={0} step={0.1} value={device.weightKg} onChange={(value) => patch({ weightKg: value })} />
                </div>

                <div className="grid gap-3 [grid-template-columns:minmax(0,1fr)_92px]">
                  <label className="text-xs text-content-muted">
                    Width type
                    <select
                      className="mt-1 h-10 w-full rounded-lg border border-edge-strong bg-surface px-2.5 text-sm text-content outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-edge-strong dark:bg-surface dark:text-content"
                      value={device.widthType}
                      disabled={device.sizeU === 0}
                      onChange={(event) => patch({ widthType: event.target.value as WidthType })}
                    >
                      <option value="10in">10-inch</option>
                      <option value="19in">19-inch</option>
                      <option value="shelf">{device.mountingSupport === 'printed-mount' ? 'Compact device' : 'Shelf-mounted'}</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>
                  <label className="text-xs text-content-muted">
                    Color
                    <input
                      className="mt-1 h-10 w-full rounded-lg border border-edge-strong bg-surface p-1 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-edge-strong dark:bg-surface"
                      type="color"
                      value={device.color}
                      onChange={(event) => patch({ color: event.target.value })}
                    />
                  </label>
                </div>

                {(device.widthType === 'custom' || device.widthType === 'shelf') && (
                  <div className="max-w-full">
                    <NumberField
                      label="Custom width mm"
                      min={40}
                      value={device.customWidthMm ?? 220}
                      onChange={(value) => patch({ customWidthMm: value })}
                    />
                  </div>
                )}
                </div>
              </PropertySection>

              <PropertySection title="Socket specifications" focusTarget={focusTarget?.section === "Socket specifications" ? focusTarget : undefined} defaultOpen={false}>
                <PortSpecificationsEditor layout={layout} device={device} onChange={patch} />
              </PropertySection>

              <PropertySection title="Installation requirements" focusTarget={focusTarget?.section === "Installation requirements" ? focusTarget : undefined} defaultOpen={false}>
                <InstallationFields layout={layout} device={device} onChange={patch} />
              </PropertySection>

              <PropertySection title="Power & Lifecycle" focusTarget={focusTarget?.section === "Power & Lifecycle" ? focusTarget : undefined} defaultOpen={false}>
                <div className="grid gap-3">
                  <NumberField label="Planning power (W)" min={0} value={device.powerW} onChange={(value) => patch({ powerW: value })} />
                  <p className="text-xs text-content-muted">
                    Reference: {getPowerReference(device).watts} W · {POWER_BASIS_LABELS[getPowerReference(device).basis]}. {getPowerReference(device).source}
                  </p>
                  <label className="space-y-1 text-xs text-content-muted">
                    Planning power basis
                    <select className="h-10 w-full rounded-lg border border-edge-strong bg-surface px-2 text-content"
                      value={planningPowerBasis(device)} onChange={event => patch({ powerBasis: event.target.value as PowerBasis })}>
                      {Object.entries(POWER_BASIS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs text-content-muted">
                    Planning load notes / measurement source
                    <input type="text" value={device.powerPlanningNote ?? ''}
                      placeholder="Workload, installed drives, meter reading or specification source"
                      className="h-10 w-full rounded-lg border border-edge-strong bg-surface px-2 text-content"
                      onChange={event => patch({ powerPlanningNote: event.target.value || undefined })} />
                  </label>
                  <label className="flex items-start gap-2 text-xs text-content-muted">
                    <input type="checkbox" checked={device.powerReviewed === true} onChange={event => patch({ powerReviewed: event.target.checked })} />
                    I reviewed this planning load for my hardware and workload
                  </label>
                  <p className="text-xs text-content-muted">This value is the planning-load basis. Supply and UPS calculations also use declared PoE draw and conversion assumptions. Idle is not a peak-load budget; maximum is not typical usage. Changing load inputs, socket specifications or connected PoE demand clears the review, including changes in another rack.</p>
                  {isPowerSource(device) && (
                    <label className="space-y-1 text-xs text-content-muted">
                      Rated output capacity (W)
                      <input
                        type="number" min="1" step="any"
                        className="h-10 w-full rounded-lg border border-edge-strong bg-surface px-2.5 text-sm text-content"
                        placeholder="Unknown — check equipment rating"
                        value={device.powerCapacityW ?? ''}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value === '') patch({ powerCapacityW: undefined });
                          else if (Number.isFinite(Number(value)) && Number(value) > 0) patch({ powerCapacityW: Number(value) });
                        }}
                      />
                      <span className="block">Use the continuous output rating in watts, not VA or socket count. Blank means capacity is unverified.</span>
                    </label>
                  )}
                  {isPowerSource(device) && device.powerCapacityReference && <div className="space-y-1 rounded border border-edge p-2 text-xs text-content-muted" aria-label="Output rating reference">
                    <p className="font-semibold">Recorded output reference: {device.powerCapacityReference.watts} W</p>
                    <p>{device.powerCapacityReference.model} · Checked {device.powerCapacityReference.checkedAt}</p>
                    <p className="break-words">{/^https?:\/\//i.test(device.powerCapacityReference.source)
                      ? <a className="underline" href={device.powerCapacityReference.source} target="_blank" rel="noopener noreferrer">{device.powerCapacityReference.source}</a>
                      : device.powerCapacityReference.source}</p>
                    <p>{device.powerCapacityW === undefined
                      ? 'Current output capacity is unknown. The reference does not fill in a blank rating.'
                      : device.powerCapacityW !== device.powerCapacityReference.watts
                        ? 'Current output capacity differs from this reference. Calculations use your current value; verify it for your exact hardware.'
                        : 'Current output capacity matches this recorded reference. Confirm the exact model and regional variant.'}</p>
                  </div>}
                  {device.category === 'ups' && <div className="space-y-2 rounded border border-edge p-2">
                    <p className="text-xs font-semibold">Battery estimate assumptions</p>
                    <label className="block text-xs">Battery energy (Wh)
                      <input type="number" min="0" step="any" className="mt-1 w-full rounded border border-edge bg-surface p-2" value={device.batteryWh ?? ''} placeholder="Unknown" onChange={e => {
                        const value = e.target.value;
                        if (value === '') patch({ batteryWh: undefined });
                        else if (Number.isFinite(Number(value)) && Number(value) >= 0) patch({ batteryWh: Number(value) });
                      }} />
                    </label>
                    {([['efficiencyPct', 'Inverter efficiency (%)', 85], ['usableCapacityPct', 'Usable battery capacity (%)', 80], ['chargePct', 'Starting charge (%)', 100]] as const).map(([key, label, fallback]) => <label key={key} className="block text-xs">{label}
                      <input type="number" min={key === 'efficiencyPct' ? 0.1 : 0} max="100" step="any" className="mt-1 w-full rounded border border-edge bg-surface p-2" value={device.upsBatteryAssumptions?.[key] ?? ''} placeholder={`Default ${fallback}%`} onChange={e => {
                        const value = e.target.value;
                        if (value === '' || (Number.isFinite(Number(value)) && Number(value) <= 100 && (key === 'efficiencyPct' ? Number(value) > 0 : Number(value) >= 0))) patch({ upsBatteryAssumptions: { ...device.upsBatteryAssumptions, [key]: value === '' ? undefined : Number(value) } });
                      }} />
                    </label>)}
                    <p className="text-xs text-content-muted">Usable capacity is your allowance for aging and discharge limits. Blank percentages use the shown defaults. Energy estimates do not verify transfer time or discharge curves.</p>
                  </div>}
                  <label className="space-y-1 text-xs text-content-muted">
                    Heat
                    <select
                      className="h-10 w-full rounded-lg border border-edge-strong bg-surface px-2.5 text-sm text-content outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-edge-strong dark:bg-surface dark:text-content"
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
                <label className="space-y-1 text-xs text-content-muted">
                  Status
                  <select
                    className="h-10 w-full rounded-lg border border-edge-strong bg-surface px-2.5 text-sm text-content outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-edge-strong dark:bg-surface dark:text-content"
                    value={device.lifecycleStatus ?? 'active'}
                    onChange={(event) => patch({ lifecycleStatus: event.target.value as LifecycleStatus })}
                  >
                    <option value="active">Active</option>
                    <option value="planned">Planned</option>
                    <option value="decommissioning">Decommissioning</option>
                  </select>
                </label>

                {canSetShutdownPriority(device) && (
                  <label className="space-y-1 text-xs text-content-muted">
                    Outage priority
                    <select
                      className="h-10 w-full rounded-lg border border-edge-strong bg-surface px-2.5 text-sm text-content outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-edge-strong dark:bg-surface dark:text-content"
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
                  <div className="grid gap-3">
                    <label className="space-y-1 text-xs text-content-muted">
                      Boot depends on
                      <select
                        multiple
                        className="min-h-[5rem] w-full rounded-lg border border-edge-strong bg-surface px-2.5 py-1.5 text-sm text-content outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-edge-strong dark:bg-surface dark:text-content"
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
                  <label className="space-y-1 text-xs text-content-muted">
                    Circuit
                    <select
                      className="h-10 w-full rounded-lg border border-edge-strong bg-surface px-2.5 text-sm text-content outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-edge-strong dark:bg-surface dark:text-content"
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

              <PropertySection title="Ports & Connectivity" defaultOpen={false}>
                <div className="rounded-lg bg-fill-subtle p-3">
                  <div className="grid grid-cols-2 gap-2">
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
                    <div className="rounded-lg border border-edge-strong bg-fill px-3 py-2 text-xs text-content-muted dark:border-edge dark:bg-surface-raised dark:text-content-muted">
                      Width used
                      <div className="mt-1 font-semibold text-content">
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
                <div className="rounded-lg bg-fill-subtle p-3">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-content-faint">
                    <Zap size={13} />
                    0U PDU Status
                  </div>
                  <div className="space-y-1 text-xs text-content-secondary">
                    <div className="flex justify-between">
                      <span className="text-content-faint">Outlets</span>
                      <span>{pdu0uMeta.outlets} total</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-content-faint">Used</span>
                      <span>
                        {pdu0uMeta.used} ({pdu0uMeta.outlets > 0 ? Math.round((pdu0uMeta.used / pdu0uMeta.outlets) * 100) : 0}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-content-faint">Connected planning load</span>
                      <span>{pdu0uMeta.powerBudget} W</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-content-faint">Output rating</span>
                      <span>{device.powerCapacityW === undefined ? 'Unverified' : `${device.powerCapacityW} W`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-content-faint">Location</span>
                      <span className="capitalize">{pdu0uMeta.location.replace('-', ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-content-faint">Recorded circuit</span>
                      <span>{pdu0uMeta.feed ?? 'Unspecified'}</span>
                    </div>
                  </div>
                </div>
              )}

              <button type="button" onClick={() => useRackStore.getState().moveDeviceToInventory(device.id)} className="min-h-11 w-full rounded-lg border border-edge px-3 py-2 text-xs text-content-secondary hover:bg-fill">Move to My devices</button>
              <button
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 text-sm font-medium text-red-800 hover:bg-red-500/20 dark:text-red-100"
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
