import type { DeviceTemplate, PlacedDevice, PowerBasis, PowerReference } from '../types/rack';

export const POWER_BASIS_LABELS: Record<PowerBasis, string> = {
  unspecified: 'Unspecified', idle: 'Idle', typical: 'Typical operating', maximum: 'Maximum',
  measured: 'Measured / access test', estimated: 'Planning estimate', passive: 'Passive / no consumption',
};

type PowerDevice = Pick<PlacedDevice, 'category' | 'powerW' | 'powerReference' | 'powerBasis' | 'powerReviewed'>;
const PASSIVE_CATEGORIES = new Set(['patch-panel', 'shelf', 'blank', 'cable-management', 'printed-mount']);
export const isPassivePower = (device: Pick<PowerDevice, 'category' | 'powerW'>): boolean =>
  device.powerW === 0 && PASSIVE_CATEGORIES.has(device.category);

export const getPowerReference = (device: Pick<PowerDevice, 'category' | 'powerW' | 'powerReference'>): PowerReference =>
  device.powerReference ?? {
    watts: device.powerW,
    basis: isPassivePower(device) ? 'passive' : 'unspecified',
    source: 'Saved or catalog value; source conditions not recorded',
  };

export const planningPowerBasis = (device: PowerDevice): PowerBasis => device.powerBasis ?? getPowerReference(device).basis;
export const needsPowerReview = (device: PowerDevice): boolean => !isPassivePower(device) && device.powerReviewed !== true;
export const templatePowerFields = (template: DeviceTemplate) => ({
  powerReference: { ...getPowerReference(template) },
  powerBasis: template.powerBasis ?? getPowerReference(template).basis,
  powerReviewed: false,
  powerPlanningNote: template.powerPlanningNote,
});
