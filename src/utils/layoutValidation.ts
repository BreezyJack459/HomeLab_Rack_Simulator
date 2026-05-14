import type { RackLayout } from '../types/rack';

export type LayoutValidationResult =
  | { valid: true; layout: RackLayout }
  | { valid: false; errors: string[] };

const RACK_TYPES = new Set(['10in', '19in']);
const VIEW_SIDES = new Set(['front', 'rear']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function validateDevice(device: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `devices[${index}]`;

  if (!isPlainObject(device)) {
    errors.push(`${prefix}: not an object`);
    return errors;
  }

  if (!isNonEmptyString(device.id)) errors.push(`${prefix}.id missing or invalid`);
  if (!isNonEmptyString(device.category)) errors.push(`${prefix}.category missing or invalid`);
  if (!isNonEmptyString(device.name)) errors.push(`${prefix}.name missing or invalid`);
  if (typeof device.positionU !== 'number' || !Number.isFinite(device.positionU)) {
    errors.push(`${prefix}.positionU must be a number`);
  }
  if (typeof device.sizeU !== 'number' || device.sizeU < 0 || !Number.isFinite(device.sizeU)) {
    errors.push(`${prefix}.sizeU must be a non-negative number`);
  }
  if (!isPositiveNumber(device.depthMm)) errors.push(`${prefix}.depthMm must be > 0`);
  if (!isNonEmptyString(device.widthType)) errors.push(`${prefix}.widthType missing or invalid`);
  if (!isNonNegativeNumber(device.weightKg)) errors.push(`${prefix}.weightKg must be >= 0`);
  if (!isNonNegativeNumber(device.powerW)) errors.push(`${prefix}.powerW must be >= 0`);
  if (typeof device.heatLevel !== 'number' || !Number.isFinite(device.heatLevel) || device.heatLevel < 1 || device.heatLevel > 5) {
    errors.push(`${prefix}.heatLevel must be a finite number between 1 and 5`);
  }
  if (!isNonEmptyString(device.color)) errors.push(`${prefix}.color missing or invalid`);

  return errors;
}

function isValidPort(port: unknown): boolean {
  if (!isPlainObject(port)) return false;
  return typeof port.type === 'string' && typeof port.index === 'number' && Number.isFinite(port.index);
}

function validateCable(cable: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `cables[${index}]`;

  if (!isPlainObject(cable)) {
    errors.push(`${prefix}: not an object`);
    return errors;
  }

  if (!isNonEmptyString(cable.id)) errors.push(`${prefix}.id missing or invalid`);
  if (!isNonEmptyString(cable.fromDeviceId)) errors.push(`${prefix}.fromDeviceId missing or invalid`);
  if (!isNonEmptyString(cable.toDeviceId)) errors.push(`${prefix}.toDeviceId missing or invalid`);
  if (!isNonEmptyString(cable.type)) errors.push(`${prefix}.type missing or invalid`);
  if (!isNonEmptyString(cable.color)) errors.push(`${prefix}.color missing or invalid`);
  if (cable.fromPort !== undefined && !isValidPort(cable.fromPort)) {
    errors.push(`${prefix}.fromPort must be an object with type (string) and index (number)`);
  }
  if (cable.toPort !== undefined && !isValidPort(cable.toPort)) {
    errors.push(`${prefix}.toPort must be an object with type (string) and index (number)`);
  }

  return errors;
}

/**
 * Runtime guard for imported JSON. Anything reaching `loadLayout` should pass
 * this first — `normalizeLayout()` in the store handles deeper field-level
 * cleanup (clamping xMm, deriving mountSide, regenerating cable.nodes), but it
 * trusts the top-level shape and will throw on `data.devices.forEach` if the
 * caller passed a non-array.
 *
 * Returns accumulated errors (not the first error) so users see every problem
 * with their file in one pass.
 */
export function validateImportedLayout(data: unknown): LayoutValidationResult {
  if (!isPlainObject(data)) {
    return { valid: false, errors: ['Imported file is not a JSON object'] };
  }

  const errors: string[] = [];

  if (!isNonEmptyString(data.id)) errors.push('id must be a non-empty string');
  if (typeof data.name !== 'string') errors.push('name must be a string');
  if (typeof data.rackType !== 'string' || !RACK_TYPES.has(data.rackType)) {
    errors.push('rackType must be "10in" or "19in"');
  }
  if (!isPositiveNumber(data.heightU)) errors.push('heightU must be a positive number');
  if (!isPositiveNumber(data.rackDepthMm)) errors.push('rackDepthMm must be a positive number');
  if (data.rearClearanceMm !== undefined && !isNonNegativeNumber(data.rearClearanceMm)) errors.push('rearClearanceMm must be a non-negative number');
  if (data.railMinDepthMm !== undefined && !isNonNegativeNumber(data.railMinDepthMm)) errors.push('railMinDepthMm must be a non-negative number');
  if (data.railMaxDepthMm !== undefined && !isNonNegativeNumber(data.railMaxDepthMm)) errors.push('railMaxDepthMm must be a non-negative number');
  if (!isNonNegativeNumber(data.weightLimitKg)) errors.push('weightLimitKg must be a non-negative number');
  if (!isNonNegativeNumber(data.powerBudgetW)) errors.push('powerBudgetW must be a non-negative number');
  if (typeof data.viewSide !== 'string' || !VIEW_SIDES.has(data.viewSide)) {
    errors.push('viewSide must be "front" or "rear"');
  }

  if (!Array.isArray(data.devices)) {
    errors.push('devices must be an array');
  } else {
    data.devices.forEach((device, index) => {
      errors.push(...validateDevice(device, index));
    });
  }

  if (!Array.isArray(data.cables)) {
    errors.push('cables must be an array');
  } else {
    data.cables.forEach((cable, index) => {
      errors.push(...validateCable(cable, index));
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Build a validated RackLayout object explicitly instead of casting raw input
  const layout: RackLayout = {
    id: String(data.id),
    name: typeof data.name === 'string' ? data.name : '',
    rackType: String(data.rackType) as RackLayout['rackType'],
    heightU: Number(data.heightU),
    rackDepthMm: Number(data.rackDepthMm),
    rearClearanceMm: data.rearClearanceMm !== undefined ? Number(data.rearClearanceMm) : undefined,
    railMinDepthMm: data.railMinDepthMm !== undefined ? Number(data.railMinDepthMm) : undefined,
    railMaxDepthMm: data.railMaxDepthMm !== undefined ? Number(data.railMaxDepthMm) : undefined,
    weightLimitKg: Number(data.weightLimitKg),
    powerBudgetW: Number(data.powerBudgetW),
    electricityRatePerKwh: data.electricityRatePerKwh !== undefined ? Number(data.electricityRatePerKwh) : undefined,
    viewSide: String(data.viewSide) as RackLayout['viewSide'],
    devices: Array.isArray(data.devices) ? data.devices : [],
    cables: Array.isArray(data.cables) ? data.cables : [],
    reservations: Array.isArray(data.reservations) ? data.reservations : [],
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
  };

  return { valid: true, layout };
}
