import type { DevicePlanningGoals, PlanningGoals } from '../types/rack';
import { useRackStore } from '../store/rackStore';
import { normalizePlanningGoals } from '../utils/planningGoals';

const goals = [
  { key: 'power', label: 'power goal', options: [['unspecified', 'Not specified'], ['single', 'Single supply is sufficient'], ['independent-ab', 'Independent A/B supplies required']] },
  { key: 'remoteRecovery', label: 'remote recovery goal', options: [['optional', 'Optional'], ['required', 'Recovery access required']] },
  { key: 'serviceMotion', label: 'service motion goal', options: [['unspecified', 'Not specified'], ['detach-first', 'Disconnect cables before removal'], ['live-with-cables', 'Move equipment with cables attached']] },
] as const;

export function PlanningGoalsControls() {
  const layout = useRackStore(state => state.layout);
  const selectedId = useRackStore(state => state.selectedDeviceId);
  const updateRack = useRackStore(state => state.updateRack);
  const updateDevice = useRackStore(state => state.updateDevice);
  const device = layout.devices.find(item => item.id === selectedId);
  const rackGoals = normalizePlanningGoals(layout.planningGoals);
  const changeRack = (key: keyof Omit<PlanningGoals, 'version'>, value: string) =>
    updateRack({ planningGoals: { ...layout.planningGoals, ...rackGoals, [key]: value } as PlanningGoals, findingReviewVersion: 1 });
  const changeDevice = (key: keyof Omit<PlanningGoals, 'version'>, value: string) => {
    if (!device) return;
    const next = { ...device.planningGoals, version: 1, [key]: value } as DevicePlanningGoals;
    if (!value) delete next[key];
    updateDevice(device.id, { planningGoals: Object.keys(next).length > 1 ? next : undefined });
  };
  return <details className="rounded-lg border border-edge p-3" data-testid="planning-goals-controls">
    <summary className="cursor-pointer text-sm font-semibold">Planning goals</summary>
    <p className="mt-2 text-xs leading-5 text-content-muted">Idle optional ports are normal. Choose requirements for this plan; recorded paths and estimates do not certify the physical installation.</p>
    <fieldset className="mt-3 space-y-3">
      <legend className="text-xs font-semibold">Rack defaults</legend>
      {goals.map(goal => <label key={goal.key} className="block text-xs text-content-secondary">
        Rack {goal.label}
        <select aria-label={`Rack ${goal.label}`} value={rackGoals[goal.key]} onChange={event => changeRack(goal.key, event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-edge bg-fill px-2">
          {goal.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>)}
    </fieldset>
    {(layout.policies ?? []).some(policy => policy.enabled && policy.type === 'dual-psu-circuit-split') && <p className="mt-3 text-xs text-content-muted">The enabled Dual PSU Circuit Split policy also requires independent supplies. Changing the goal does not disable that policy.</p>}
    {device && <details className="mt-3 rounded-lg border border-edge p-2">
      <summary className="cursor-pointer text-xs font-semibold">Override for {device.name}</summary>
      <fieldset className="mt-3 space-y-3">
        <legend className="sr-only">Selected device goals</legend>
        {goals.map(goal => <label key={goal.key} className="block text-xs text-content-secondary">
          Device {goal.label}
          <select aria-label={`Device ${goal.label}`} value={device.planningGoals?.[goal.key] ?? ''} onChange={event => changeDevice(goal.key, event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-edge bg-fill px-2">
            <option value="">Use rack default</option>
            {goal.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>)}
      </fieldset>
    </details>}
  </details>;
}
