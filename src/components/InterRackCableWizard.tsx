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
                  ? 'bg-accent-solid text-content dark:bg-accent dark:text-accent-on'
                  : isDone
                    ? 'bg-emerald-500/20 text-emerald-400 dark:text-emerald-300'
                    : 'bg-fill-strong text-content-muted dark:bg-fill dark:text-content-faint'
              }`}
            >
              {isDone ? <Check size={14} /> : stepNum}
            </div>
            <span
              className={`text-xs font-medium ${
                isActive
                  ? 'text-accent-fg'
                  : isDone
                    ? 'text-emerald-600 dark:text-emerald-300'
                    : 'text-content-faint'
              }`}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <ChevronRight size={14} className="text-content-faint" />
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
      <div className="text-sm font-semibold text-content-secondary">{label}</div>

      <label className="block text-xs text-content-muted">
        Rack
        <select
          className="mt-1 block w-full rounded-md border border-edge-strong bg-fill px-2 py-1.5 text-sm text-content outline-none dark:border-edge-strong dark:bg-surface-raised dark:text-content"
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

      <label className="block text-xs text-content-muted">
        Device
        <select
          className="mt-1 block w-full rounded-md border border-edge-strong bg-fill px-2 py-1.5 text-sm text-content outline-none dark:border-edge-strong dark:bg-surface-raised dark:text-content"
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

      <label className="block text-xs text-content-muted">
        Port
        <select
          className="mt-1 block w-full rounded-md border border-edge-strong bg-fill px-2 py-1.5 text-sm text-content outline-none dark:border-edge-strong dark:bg-surface-raised dark:text-content"
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
      <div className="w-full max-w-lg rounded-xl border border-edge-strong bg-fill shadow-2xl dark:border-edge-strong dark:bg-surface-raised">
        <div className="flex items-center justify-between border-b border-edge-strong px-5 py-3 dark:border-edge-strong">
          <div className="flex items-center gap-2 text-sm font-semibold text-content">
            <Cable size={16} className="text-accent" />
            Add Inter-Rack Cable
          </div>
          <button
            onClick={handleClose}
            className="rounded-md p-1 text-content-muted hover:bg-fill-strong hover:text-content-secondary dark:text-content-muted dark:hover:bg-fill dark:hover:text-content"
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
              <div className="text-sm font-semibold text-content-secondary">Cable Details</div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-content-muted">
                  Cable Type
                  <select
                    className="mt-1 block w-full rounded-md border border-edge-strong bg-fill px-2 py-1.5 text-sm text-content outline-none dark:border-edge-strong dark:bg-surface-raised dark:text-content"
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

                <label className="block text-xs text-content-muted">
                  Length (m)
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    className="mt-1 block w-full rounded-md border border-edge-strong bg-fill px-2 py-1.5 text-sm text-content outline-none dark:border-edge-strong dark:bg-surface-raised dark:text-content"
                    value={lengthM}
                    onChange={(e) => setLengthM(e.target.value)}
                    placeholder="Optional"
                  />
                </label>
              </div>

              <label className="block text-xs text-content-muted">
                Label
                <input
                  type="text"
                  className="mt-1 block w-full rounded-md border border-edge-strong bg-fill px-2 py-1.5 text-sm text-content outline-none dark:border-edge-strong dark:bg-surface-raised dark:text-content"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Optional label"
                />
              </label>

              <div>
                <div className="mb-1 text-xs text-content-muted">Color</div>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setColor(preset.value)}
                      className={`flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs transition ${
                        color === preset.value
                          ? 'border-accent bg-accent-solid/10 text-accent-fg'
                          : 'border-edge-strong bg-fill text-content-secondary hover:bg-fill-strong dark:border-edge-strong dark:bg-fill dark:text-content-muted dark:hover:bg-fill-strong'
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
                    className="h-7 w-12 cursor-pointer rounded-md border border-edge-strong bg-transparent dark:border-edge-strong"
                    value={color || '#06b6d4'}
                    onChange={(e) => setColor(e.target.value)}
                    title="Custom color"
                  />
                </div>
              </div>

              <label className="block text-xs text-content-muted">
                Notes
                <textarea
                  className="mt-1 block w-full rounded-md border border-edge-strong bg-fill px-2 py-1.5 text-sm text-content outline-none dark:border-edge-strong dark:bg-surface-raised dark:text-content"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes"
                />
              </label>

              {/* Summary */}
              <div className="rounded-lg border border-edge bg-fill/60 p-3 text-xs dark:border-edge dark:bg-surface/40">
                <div className="mb-1 font-semibold text-content-secondary dark:text-content-muted">Summary</div>
                <div className="space-y-1 text-content-muted dark:text-content-faint">
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

        <div className="flex items-center justify-between border-t border-edge-strong px-5 py-3 dark:border-edge-strong">
          <button
            onClick={handleClose}
            className="h-8 rounded-md border border-edge-strong bg-fill px-3 text-xs font-medium text-content-secondary hover:bg-fill-strong dark:border-edge-strong dark:bg-fill dark:text-content-secondary dark:hover:bg-fill-strong"
            type="button"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-edge-strong bg-fill px-3 text-xs font-medium text-content-secondary hover:bg-fill-strong dark:border-edge-strong dark:bg-fill dark:text-content-secondary dark:hover:bg-fill-strong"
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
                className="inline-flex h-8 items-center gap-1 rounded-md bg-accent-solid px-3 text-xs font-medium text-content hover:bg-accent-solid-hover disabled:opacity-40 dark:bg-accent dark:text-accent-on dark:hover:bg-accent"
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
                className="inline-flex h-8 items-center gap-1 rounded-md bg-accent-solid px-3 text-xs font-medium text-content hover:bg-accent-solid-hover disabled:opacity-40 dark:bg-accent dark:text-accent-on dark:hover:bg-accent"
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
