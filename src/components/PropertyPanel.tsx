import { ChevronDown, SlidersHorizontal, Trash2, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { HeatLevel, OutletFacing, PlacedDevice, PortLayout, ViewSide, WidthType, ZeroUMountSide, ZeroUMountType } from '../types/rack';
import { ENABLE_ZERO_U_PDU } from '../utils/featureFlags';
import { getDeviceMountSide, getDeviceSpatialZone, getDeviceWidthMm, getDeviceXRange, RACK_SPECS } from '../utils/rackMath';
import { getPortFaceMap } from '../utils/portLayout';

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-xs text-slate-400">
      {label}
      <input
        className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
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

export function PropertyPanel() {
  const layout = useRackStore((state) => state.layout);
  const selectedDeviceId = useRackStore((state) => state.selectedDeviceId);
  const updateDevice = useRackStore((state) => state.updateDevice);
  const removeDevice = useRackStore((state) => state.removeDevice);
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
        [port]: Math.max(0, Math.floor(value))
      }
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
      const poweredDeviceId = cable.fromDeviceId === device.id ? cable.toDeviceId : cable.toDeviceId === device.id ? cable.fromDeviceId : null;
      if (!poweredDeviceId || poweredDeviceId === device.id) return;
      const poweredDevice = layout.devices.find((d) => d.id === poweredDeviceId);
      if (poweredDevice) powerBudget += poweredDevice.powerW;
    });
    const zone = getDeviceSpatialZone(device);
    const feed = zone.includes('left') ? 'A' : zone.includes('right') ? 'B' : '-';
    return { outlets, used, powerBudget, location: zone, feed };
  }, [device, layout.cables, layout.devices]);

  const [isOpen, setIsOpen] = useState(true);

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/78 p-4">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="mb-3 flex w-full items-center justify-between gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400 transition hover:text-slate-200"
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
        <div className="rounded-md border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
          Select a component in the rack to edit name, size, depth, power and port layout.
        </div>
      ) : (
        <div className="space-y-3">
          <label className="text-xs text-slate-400">
            Name
            <input
              className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
              value={device.name}
              onChange={(event) => patch({ name: event.target.value })}
            />
          </label>

          <label className="text-xs text-slate-400">
            Label
            <input
              className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
              value={device.label ?? ''}
              onChange={(event) => patch({ label: event.target.value })}
              placeholder="Optional front label"
            />
          </label>

          <label className="text-xs text-slate-400">
            Description
            <textarea
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white outline-none"
              value={device.description ?? ''}
              onChange={(event) => patch({ description: event.target.value })}
              placeholder="Optional notes or description"
              rows={3}
            />
          </label>

          <label className="text-xs text-slate-400">
            Status
            <select
              className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
              value={device.lifecycleStatus ?? 'active'}
              onChange={(event) => patch({ lifecycleStatus: event.target.value as import('../types/rack').LifecycleStatus })}
            >
              <option value="active">Active</option>
              <option value="planned">Planned</option>
              <option value="decommissioning">Decommissioning</option>
            </select>
          </label>

          {(device.category === 'ups' || device.category === 'pdu' || (ENABLE_ZERO_U_PDU && device.category === 'pdu-0u')) && (
            <label className="text-xs text-slate-400">
              Circuit
              <select
                className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
                value={device.circuit ?? ''}
                onChange={(event) => patch({ circuit: event.target.value ? (event.target.value as 'A' | 'B') : undefined })}
              >
                <option value="">Unassigned</option>
                <option value="A">Circuit A</option>
                <option value="B">Circuit B</option>
              </select>
            </label>
          )}

          <label className="text-xs text-slate-400">
            Mount side
            <select
              className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
              value={getDeviceMountSide(device)}
              onChange={(event) => patch({ mountSide: event.target.value as ViewSide })}
            >
              <option value="front">Front side</option>
              <option value="rear">Rear side</option>
            </select>
          </label>

          {ENABLE_ZERO_U_PDU && device.sizeU === 0 && (
            <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">0U Mount</div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">
                  Mount type
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
                    value={device.mountType ?? 'rear-rail'}
                    onChange={(event) => patch({ mountType: event.target.value as ZeroUMountType })}
                  >
                    <option value="rear-rail">Rear rail (behind rack)</option>
                    <option value="side-rail">Side rail (outer face)</option>
                  </select>
                </label>
                <label className="text-xs text-slate-400">
                  Side
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
                    value={device.mountSide0U ?? 'left'}
                    onChange={(event) => patch({ mountSide0U: event.target.value as ZeroUMountSide })}
                  >
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </label>
                <label className="text-xs text-slate-400">
                  Outlet facing
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
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

          <div className="grid grid-cols-2 gap-3">
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
            <NumberField label="Weight kg" min={0} step={0.1} value={device.weightKg} onChange={(value) => patch({ weightKg: value })} />
            <NumberField label="Power W" min={0} value={device.powerW} onChange={(value) => patch({ powerW: value })} />
            <label className="text-xs text-slate-400">
              Heat
              <select
                className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
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

          <div className="grid grid-cols-[1fr_92px] gap-3">
            <label className="text-xs text-slate-400">
              Width type
              <select
                className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
                value={device.widthType}
                onChange={(event) => patch({ widthType: event.target.value as WidthType })}
              >
                <option value="10in">10-inch</option>
                <option value="19in">19-inch</option>
                <option value="shelf">Shelf-mounted</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Color
              <input
                className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 p-1 outline-none"
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

          <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ports</div>
            <div className="grid grid-cols-3 gap-2">
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
              <div className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-400">
                Width used
                <div className="mt-1 font-semibold text-white">
                  {Math.min(getDeviceWidthMm(device), rackUsableWidth).toFixed(0)} / {rackUsableWidth.toFixed(0)}mm
                </div>
              </div>
            </div>

            {/* Port face placement — per-type front/rear override */}
            {(() => {
              const portTypes = [
                { key: 'ethernet', label: 'Ethernet' },
                { key: 'fiber', label: 'Fiber' },
                { key: 'usb', label: 'USB' },
                { key: 'hdmi', label: 'HDMI' },
                { key: 'power', label: 'Power' },
                { key: 'atx', label: 'ATX' },
                { key: 'coax', label: 'Coax' }
              ] as const;
              const activeTypes = portTypes.filter(
                (pt) => ((device.ports as Record<string, number | undefined>)?.[pt.key] ?? 0) > 0
              );
              if (activeTypes.length === 0) return null;
              const defaults = getPortFaceMap(device.category);
              return (
                <div className="mt-3 border-t border-slate-800 pt-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Port placement</div>
                  <div className="space-y-1.5">
                    {activeTypes.map((pt) => {
                      const defaultFace = defaults[pt.key] ?? 'rear';
                      const override = device.portFaceOverrides?.[pt.key];
                      const currentFace = override ?? defaultFace;
                      return (
                        <div key={pt.key} className="flex items-center gap-2">
                          <span className="w-16 text-xs text-slate-400">{pt.label}</span>
                          <span className="text-[10px] text-slate-600">
                            default {defaultFace}
                          </span>
                          <select
                            className="ml-auto h-7 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white outline-none"
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
                            className={`h-2 w-2 rounded-full ${
                              currentFace === 'front' ? 'bg-cyan-400' : 'bg-orange-400'
                            }`}
                            title={currentFace}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {pdu0uMeta && (
            <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <Zap size={13} />
                0U PDU Status
              </div>
              <div className="space-y-1 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Outlets</span>
                  <span>{pdu0uMeta.outlets} total</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Used</span>
                  <span>
                    {pdu0uMeta.used} ({pdu0uMeta.outlets > 0 ? Math.round((pdu0uMeta.used / pdu0uMeta.outlets) * 100) : 0}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Power budget</span>
                  <span>{pdu0uMeta.powerBudget}W / 2400W</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Location</span>
                  <span className="capitalize">{pdu0uMeta.location.replace('-', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Feed</span>
                  <span>Feed {pdu0uMeta.feed}</span>
                </div>
              </div>
            </div>
          )}

          <button
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 text-sm font-medium text-red-100 hover:bg-red-500/20"
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
