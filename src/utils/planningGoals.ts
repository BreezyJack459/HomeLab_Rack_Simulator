import type { PlanningGoals, PlacedDevice, RackLayout } from '../types/rack';

/** Read-time defaults do not alter legacy plans or enable new requirements. */
export const normalizePlanningGoals = (goals?: Partial<PlanningGoals>): PlanningGoals => ({
  version: 1,
  power: goals?.power ?? 'unspecified',
  remoteRecovery: goals?.remoteRecovery ?? 'optional',
  serviceMotion: goals?.serviceMotion ?? 'unspecified',
});

export const getPlanningGoals = (layout: RackLayout, device?: PlacedDevice): PlanningGoals =>
  normalizePlanningGoals({ ...layout.planningGoals, ...device?.planningGoals });

/** An enabled legacy redundancy policy is already an explicit requirement. */
export const requiresIndependentPower = (layout: RackLayout, device: PlacedDevice): boolean =>
  getPlanningGoals(layout, device).power === 'independent-ab' ||
  (device.category === 'server' && (device.ports?.power ?? 0) >= 2 &&
    (layout.policies ?? []).some(policy => policy.enabled && policy.type === 'dual-psu-circuit-split'));
