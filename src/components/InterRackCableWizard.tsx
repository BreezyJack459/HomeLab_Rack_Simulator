import { useMemo, useState } from 'react';
import { X, Cable, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import type { RackLayout, PortRef, InterRackCableType } from '../types/rack';
import { useRackStore } from '../store/rackStore';
import { portOptionsForDevice } from '../utils/portSelection';
import type { CableType } from '../types/rack';

interface InterRackCableWizardProps {
  open: boolean;
  onClose: () => void;
}

const CABLE_TYPE_OPTIONS: { value: InterRackCableType; label: string }[] = [
  { value: 'fiber', label: 'Fiber' },
  { value: 'sfp+', label: 'SFP+' },
  { value: 'cat6a', label: 'CAT6A' },
  { value: 'dac', label: 'DAC' },
];

const COLOR_PRESETS = [
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#ef4444', label: 'Red' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#64748b', label: 'Slate' },
];

function interRackTypeToCableType(type: InterRackCableType): CableType {
  if (type === 'fiber') return 'fiber';
  return 'ethernet';
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = ['Source', 'Destination', 'Details'];
  return (
    <div className="mb-6 flex items-center justify-center gap-2">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isDone = stepNum < currentStep;
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                isActive
                  ? 'bg-cyan-600 text-white dark:bg-cyan-400 dark:text-slate-950'
                  : isDone
                    ? 'bg-emerald-500/20 text-emerald-400 dark:text-emerald-300'
                    : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
              }`}
            >
              {isDone ? <Check size={14} /> : stepNum}
            </div>
            <span
              className={`text-xs font-medium ${
                isActive
                  ? 'text-cyan-700 dark:text-cyan-300'
                  : isDone
                    ? 'text-emerald-600 dark:text-emerald-300'
                    : 'text-slate-400 dark:text-slate-600'
              }`}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <ChevronRight size={14} className="text-slate-300 dark:text-slate-700" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function EndpointSelector({
  label,
  racks,
  selectedRackId,
  selectedDeviceId,
  selectedPort,
  cableType,
  onChangeRack,
  onChangeDevice,
  onChangePort,
  excludeDeviceId,
}: {
  label: string;
  racks: RackLayout[];
  selectedRackId: string;
  selectedDeviceId: string;
  selectedPort: PortRef | null;
  cableType: InterRackCableType;
  onChangeRack: (rackId: string) => void;
  onChangeDevice: (deviceId: string) => void;
  onChangePort: (port: PortRef | null) => void;
  excludeDeviceId?: string;
}) {
  const selectedRack = racks.find((r) => r.id === selectedRackId);
  const devices = selectedRack?.devices ?? [];
  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);

  const portOptions = useMemo(() => {
    if (!selectedRack || !selectedDevice) return [];
    return portOptionsForDevice(selectedDevice, interRackTypeToCableType(cableType), selectedRack);
  }, [selectedRack, selectedDevice, cableType]);

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</div>

      <label className="block text-xs text-slate-500 dark:text-slate-400">
        Rack
        <select
          className="mt-1 block w-full rounded-md border border-slate-300 bg-slate-100 px-2 py-1.5 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          value={selectedRackId}
          onChange={(e) => {
            onChangeRack(e.target.value);
            onChangeDevice('');
            onChangePort(null);
          }}
        >
          <option value="">Select a rack…</option>
          {racks.map((rack) => (
            <option key={rack.id} value={rack.id}>
              {rack.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs text-slate-500 dark:text-slate-400">
        Device
        <select
          className="mt-1 block w-full rounded-md border border-slate-300 bg-slate-100 px-2 py-1.5 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          value={selectedDeviceId}
          onChange={(e) => {
            onChangeDevice(e.target.value);
            onChangePort(null);
          }}
          disabled={!selectedRackId}
        >
          <option value="">Select a device…</option>
          {devices
            .filter((d) => d.id !== excludeDeviceId)
            .map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
        </select>
      </label>

      <label className="block text-xs text-slate-500 dark:text-slate-400">
        Port
        <select
          className="mt-1 block w-full rounded-md border border-slate-300 bg-slate-100 px-2 py-1.5 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          value={selectedPort ? `${selectedPort.type}:${selectedPort.index}:${selectedPort.side ?? ''}` : ''}
          onChange={(e) => {
            const value = e.target.value;
            if (!value) {
              onChangePort(null);
              return;
            }
            const [type, index, side] = value.split(':');
            onChangePort({
              type: type as PortRef['type'],
              index: Number(index),
              side: side ? (side as 'front' | 'rear') : undefined,
            });
          }}
          disabled={!selectedDeviceId || portOptions.length === 0}
        >
          <option value="">Select a port…</option>
          {portOptions.map((opt) => (
            <option
              key={`${opt.label}:${opt.index}:${opt.side ?? ''}`}
              value={`${interRackTypeToCableType(cableType)}:${opt.index}:${opt.side ?? ''}`}
              disabled={opt.disabled}
            >
              {opt.label} {opt.disabled ? '(used)' : ''}
            </option>
          ))}
          {portOptions.length === 0 && selectedDeviceId && (
            <option disabled>No available ports for this cable type</option>
          )}
        </select>
      </label>
    </div>
  );
}

function InterRackCableWizard({ open, onClose }: InterRackCableWizardProps) {
  const workspace = useRackStore((state) => state.workspace);
  const racks = workspace.racks;

  const [step, setStep] = useState(1);
  const [sourceRackId, setSourceRackId] = useState('');
  const [sourceDeviceId, setSourceDeviceId] = useState('');
  const [sourcePort, setSourcePort] = useState<PortRef | null>(null);
  const [destRackId, setDestRackId] = useState('');
  const [destDeviceId, setDestDeviceId] = useState('');
  const [destPort, setDestPort] = useState<PortRef | null>(null);
  const [cableType, setCableType] = useState<InterRackCableType>('cat6a');
  const [lengthM, setLengthM] = useState('');
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');

  const sourceRack = racks.find((r) => r.id === sourceRackId);
  const sourceDevice = sourceRack?.devices.find((d) => d.id === sourceDeviceId);
  const destRack = racks.find((r) => r.id === destRackId);
  const destDevice = destRack?.devices.find((d) => d.id === destDeviceId);

  const isStep1Valid = Boolean(sourceRack && sourceDevice && sourcePort);
  const isStep2Valid = Boolean(destRack && destDevice && destPort && destDeviceId !== sourceDeviceId);
  const isStep3Valid = isStep1Valid && isStep2Valid;

  function reset() {
    setStep(1);
    setSourceRackId('');
    setSourceDeviceId('');
    setSourcePort(null);
    setDestRackId('');
    setDestDeviceId('');
    setDestPort(null);
    setCableType('cat6a');
    setLengthM('');
    setLabel('');
    setColor('');
    setNotes('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleCreate() {
    if (!isStep3Valid || !sourcePort || !destPort) return;
    const addInterRackCable = useRackStore.getState().addInterRackCable;
    addInterRackCable({
      fromRackId: sourceRackId,
      fromDeviceId: sourceDeviceId,
      fromPort: sourcePort,
      toRackId: destRackId,
      toDeviceId: destDeviceId,
      toPort: destPort,
      type: cableType,
      lengthM: lengthM ? Number(lengthM) : undefined,
      label: label || undefined,
      color: color || undefined,
      notes: notes || undefined,
    });
    handleClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-300 bg-slate-100 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-300 px-5 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Cable size={16} className="text-cyan-600 dark:text-cyan-400" />
            Add Inter-Rack Cable
          </div>
          <button
            onClick={handleClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          <StepIndicator currentStep={step} />

          {step === 1 && (
            <EndpointSelector
              label="Source Endpoint"
              racks={racks}
              selectedRackId={sourceRackId}
              selectedDeviceId={sourceDeviceId}
              selectedPort={sourcePort}
              cableType={cableType}
              onChangeRack={setSourceRackId}
              onChangeDevice={setSourceDeviceId}
              onChangePort={setSourcePort}
            />
          )}

          {step === 2 && (
            <EndpointSelector
              label="Destination Endpoint"
              racks={racks}
              selectedRackId={destRackId}
              selectedDeviceId={destDeviceId}
              selectedPort={destPort}
              cableType={cableType}
              onChangeRack={setDestRackId}
              onChangeDevice={setDestDeviceId}
              onChangePort={setDestPort}
              excludeDeviceId={sourceDeviceId}
            />
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">Cable Details</div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-slate-500 dark:text-slate-400">
                  Cable Type
                  <select
                    className="mt-1 block w-full rounded-md border border-slate-300 bg-slate-100 px-2 py-1.5 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    value={cableType}
                    onChange={(e) => setCableType(e.target.value as InterRackCableType)}
                  >
                    {CABLE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs text-slate-500 dark:text-slate-400">
                  Length (m)
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    className="mt-1 block w-full rounded-md border border-slate-300 bg-slate-100 px-2 py-1.5 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    value={lengthM}
                    onChange={(e) => setLengthM(e.target.value)}
                    placeholder="Optional"
                  />
                </label>
              </div>

              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Label
                <input
                  type="text"
                  className="mt-1 block w-full rounded-md border border-slate-300 bg-slate-100 px-2 py-1.5 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Optional label"
                />
              </label>

              <div>
                <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">Color</div>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setColor(preset.value)}
                      className={`flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs transition ${
                        color === preset.value
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                          : 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                      }`}
                      title={preset.label}
                    >
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: preset.value }}
                      />
                      {preset.label}
                    </button>
                  ))}
                  <input
                    type="color"
                    className="h-7 w-12 cursor-pointer rounded-md border border-slate-300 bg-transparent dark:border-slate-700"
                    value={color || '#06b6d4'}
                    onChange={(e) => setColor(e.target.value)}
                    title="Custom color"
                  />
                </div>
              </div>

              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Notes
                <textarea
                  className="mt-1 block w-full rounded-md border border-slate-300 bg-slate-100 px-2 py-1.5 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes"
                />
              </label>

              {/* Summary */}
              <div className="rounded-lg border border-slate-200 bg-slate-100/60 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/40">
                <div className="mb-1 font-semibold text-slate-600 dark:text-slate-400">Summary</div>
                <div className="space-y-1 text-slate-500 dark:text-slate-500">
                  <div>
                    From: {sourceRack?.name} → {sourceDevice?.name} → {sourcePort ? `${sourcePort.type} ${sourcePort.index + 1}` : '—'}
                  </div>
                  <div>
                    To: {destRack?.name} → {destDevice?.name} → {destPort ? `${destPort.type} ${destPort.index + 1}` : '—'}
                  </div>
                  <div>
                    Type: {cableType}
                    {lengthM ? ` · ${lengthM}m` : ''}
                    {label ? ` · ${label}` : ''}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-300 px-5 py-3 dark:border-slate-700">
          <button
            onClick={handleClose}
            className="h-8 rounded-md border border-slate-300 bg-slate-100 px-3 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            type="button"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-3 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                type="button"
              >
                <ChevronLeft size={14} />
                Back
              </button>
            )}
            {step < 3 && (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 ? !isStep1Valid : !isStep2Valid}
                className="inline-flex h-8 items-center gap-1 rounded-md bg-cyan-600 px-3 text-xs font-medium text-white hover:bg-cyan-700 disabled:opacity-40 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300"
                type="button"
              >
                Next
                <ChevronRight size={14} />
              </button>
            )}
            {step === 3 && (
              <button
                onClick={handleCreate}
                disabled={!isStep3Valid}
                className="inline-flex h-8 items-center gap-1 rounded-md bg-cyan-600 px-3 text-xs font-medium text-white hover:bg-cyan-700 disabled:opacity-40 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300"
                type="button"
              >
                Create
                <Check size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { InterRackCableWizard };
export type { InterRackCableWizardProps };
