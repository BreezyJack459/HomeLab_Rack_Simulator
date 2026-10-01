import { installationRoleError } from './cableInstallation';
import { isCableRouteAnchor } from './manualCableRoute';
import type { CableRoute, RackLayout } from '../types/rack';

export type LayoutValidationResult =
  | { valid: true; layout: RackLayout }
  | { valid: false; errors: string[] };

const RACK_TYPES = new Set(['10in', '19in']);
const POWER_BASES = new Set(['unspecified', 'idle', 'typical', 'maximum', 'measured', 'estimated', 'passive']);
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

function validatePlanningGoals(value: unknown, prefix: string): string[] {
  if (!isPlainObject(value)) return [`${prefix} must be an object`];
  const errors: string[] = [];
  if (value.version !== 1) errors.push(`${prefix}.version must be 1`);
  const options: Record<string, string[]> = {
    power: ['single', 'independent-ab', 'unspecified'],
    remoteRecovery: ['required', 'optional'],
    serviceMotion: ['detach-first', 'live-with-cables', 'unspecified'],
  };
  for (const [key, allowed] of Object.entries(options)) {
    if (value[key] !== undefined && (typeof value[key] !== 'string' || !allowed.includes(value[key] as string))) {
      errors.push(`${prefix}.${key} must be ${allowed.join(', ')}`);
    }
  }
  return errors;
}

function validateDevice(device: unknown, index: number, collection = 'devices'): string[] {
  const errors: string[] = [];
  const prefix = `${collection}[${index}]`;

  if (!isPlainObject(device)) {
    errors.push(`${prefix}: not an object`);
    return errors;
  }

  if (!isNonEmptyString(device.id)) errors.push(`${prefix}.id missing or invalid`);
  if (!isNonEmptyString(device.category)) errors.push(`${prefix}.category missing or invalid`);
  if (!isNonEmptyString(device.name)) errors.push(`${prefix}.name missing or invalid`);
  if (device.planningGoals !== undefined) errors.push(...validatePlanningGoals(device.planningGoals, `${prefix}.planningGoals`));
  if (typeof device.positionU !== 'number' || !Number.isFinite(device.positionU)) {
    errors.push(`${prefix}.positionU must be a number`);
  }
  if (typeof device.sizeU !== 'number' || device.sizeU < 0 || !Number.isFinite(device.sizeU)) {
    errors.push(`${prefix}.sizeU must be a non-negative number`);
  }
  if (device.physicalHeightMm !== undefined && !isPositiveNumber(device.physicalHeightMm)) errors.push(`${prefix}.physicalHeightMm must be > 0`);
  if (!isPositiveNumber(device.depthMm)) errors.push(`${prefix}.depthMm must be > 0`);
  if (!isNonEmptyString(device.widthType)) errors.push(`${prefix}.widthType missing or invalid`);
  if (!isNonNegativeNumber(device.weightKg)) errors.push(`${prefix}.weightKg must be >= 0`);
  if (device.portConnectionSpecs !== undefined) {
    if (!isPlainObject(device.portConnectionSpecs)) errors.push(`${prefix}.portConnectionSpecs must be an object`);
    else for (const [key, spec] of Object.entries(device.portConnectionSpecs)) {
      if (!/^(ethernet|fiber|usb|hdmi|power|atx|coax):(front|rear):\d+$/.test(key) || !isPlainObject(spec)) {
        errors.push(`${prefix}.portConnectionSpecs has an invalid socket key or value`);
        continue;
      }
      for (const field of ['connector', 'polarity', 'source', 'poeProfile']) if (spec[field] !== undefined && typeof spec[field] !== 'string') errors.push(`${prefix}.portConnectionSpecs.${key}.${field} must be text`);
      if (spec.poeRole !== undefined && !['none', 'pse', 'pd'].includes(String(spec.poeRole))) errors.push(`${prefix}.portConnectionSpecs.${key}.poeRole is invalid`);
      if (spec.upsBackup !== undefined && !['battery', 'surge-only'].includes(String(spec.upsBackup))) errors.push(`${prefix}.portConnectionSpecs.${key}.upsBackup is invalid`);
      for (const field of ['poeLimitW', 'poeRequiredW', 'poeDrawW']) if (spec[field] !== undefined && !isNonNegativeNumber(spec[field])) errors.push(`${prefix}.portConnectionSpecs.${key}.${field} must be non-negative`);
      if (spec.role !== undefined && !['unknown', 'input', 'output', 'bidirectional', 'passive'].includes(String(spec.role))) errors.push(`${prefix}.portConnectionSpecs.${key}.role is invalid`);
      if (spec.powerKind !== undefined && !['ac', 'dc'].includes(String(spec.powerKind))) errors.push(`${prefix}.portConnectionSpecs.${key}.powerKind is invalid`);
      if (spec.nominalVoltageV !== undefined && !isPositiveNumber(spec.nominalVoltageV)) errors.push(`${prefix}.portConnectionSpecs.${key}.nominalVoltageV must be positive`);
    }
  }
  if (device.installationKit !== undefined && typeof device.installationKit !== 'string') errors.push(`${prefix}.installationKit must be text`);
  if (device.installationRequirements !== undefined) {
    const requirements = device.installationRequirements;
    if (!isPlainObject(requirements) || !['unknown', 'rails', 'front-mount', 'shelf', 'printed-mount'].includes(String(requirements.support))) {
      errors.push(`${prefix}.installationRequirements is invalid`);
    } else {
      for (const key of ['railMinMm', 'railMaxMm', 'rearClearanceMm']) {
        if (requirements[key] !== undefined && !isNonNegativeNumber(requirements[key])) errors.push(`${prefix}.installationRequirements.${key} must be non-negative`);
      }
      if (requirements.source !== undefined && typeof requirements.source !== 'string') errors.push(`${prefix}.installationRequirements.source must be text`);
    }
  }
  if (device.powerBasis !== undefined && !POWER_BASES.has(String(device.powerBasis))) errors.push(`${prefix}.powerBasis is invalid`);
  if (device.powerPlanningNote !== undefined && typeof device.powerPlanningNote !== 'string') errors.push(`${prefix}.powerPlanningNote must be text`);
  if (device.powerReviewed !== undefined && typeof device.powerReviewed !== 'boolean') errors.push(`${prefix}.powerReviewed must be boolean`);
  if (device.powerReference !== undefined) {
    const reference = device.powerReference;
    if (!isPlainObject(reference) || !isNonNegativeNumber(reference.watts) || !POWER_BASES.has(String(reference.basis)) ||
      (reference.source !== undefined && typeof reference.source !== 'string')) errors.push(`${prefix}.powerReference is invalid`);
  }
  if (device.batteryWh !== undefined && !isNonNegativeNumber(device.batteryWh)) errors.push(`${prefix}.batteryWh must be non-negative`);
  if (device.upsBatteryAssumptions !== undefined) {
    const assumptions = device.upsBatteryAssumptions;
    if (!isPlainObject(assumptions)) errors.push(`${prefix}.upsBatteryAssumptions must be an object`);
    else for (const key of ['efficiencyPct', 'usableCapacityPct', 'chargePct']) {
      const value = assumptions[key];
      if (value !== undefined && (!isNonNegativeNumber(value) || (value as number) > 100 || (key === 'efficiencyPct' && value === 0))) errors.push(`${prefix}.upsBatteryAssumptions.${key} must be ${key === 'efficiencyPct' ? '> 0 and ' : ''}at most 100`);
    }
  }
  if (device.poeInputMode !== undefined && !['self-only', 'includes-poe'].includes(device.poeInputMode as string)) errors.push(`${prefix}.poeInputMode is invalid`);
  if (device.poeEfficiencyPct !== undefined && (!isNonNegativeNumber(device.poeEfficiencyPct) || device.poeEfficiencyPct <= 0 || device.poeEfficiencyPct > 100)) errors.push(`${prefix}.poeEfficiencyPct must be above 0 and at most 100`);
  if (device.poeBudgetW !== undefined && !isNonNegativeNumber(device.poeBudgetW)) errors.push(`${prefix}.poeBudgetW must be non-negative`);
  if (device.powerCapacityW !== undefined && !isPositiveNumber(device.powerCapacityW)) errors.push(`${prefix}.powerCapacityW must be > 0`);
  if (device.powerCapacityReference !== undefined) {
    const ref = device.powerCapacityReference;
    if (!isPlainObject(ref) || !isPositiveNumber(ref.watts) || typeof ref.model !== 'string' || !ref.model.trim() ||
      typeof ref.source !== 'string' || !ref.source.trim() || typeof ref.checkedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ref.checkedAt)) {
      errors.push(`${prefix}.powerCapacityReference is invalid`);
    }
  }
  if (!isNonNegativeNumber(device.powerW)) errors.push(`${prefix}.powerW must be >= 0`);
  if (typeof device.heatLevel !== 'number' || !Number.isFinite(device.heatLevel) || device.heatLevel < 1 || device.heatLevel > 5) {
    errors.push(`${prefix}.heatLevel must be a finite number between 1 and 5`);
  }
  if (!isNonEmptyString(device.color)) errors.push(`${prefix}.color missing or invalid`);
  if (
    device.shutdownPriority !== undefined &&
    device.shutdownPriority !== 'critical' &&
    device.shutdownPriority !== 'graceful' &&
    device.shutdownPriority !== 'non-critical'
  ) {
    errors.push(`${prefix}.shutdownPriority must be "critical", "graceful", or "non-critical"`);
  }

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
  if (cable.installationRole !== undefined && !['patch-cord', 'permanent-link'].includes(cable.installationRole as string)) errors.push(`${prefix}.installationRole is invalid`);
  if (cable.routingOrigin !== undefined && cable.routingOrigin !== 'panel-tidy') errors.push(`${prefix}.routingOrigin is invalid`);
  if (cable.poe !== undefined && typeof cable.poe !== 'boolean') errors.push(`${prefix}.poe must be boolean`);
  if (cable.socketFit !== undefined && (!isPlainObject(cable.socketFit) ||
    ['from', 'to'].some(key => cable.socketFit && isPlainObject(cable.socketFit) && cable.socketFit[key] !== undefined && typeof cable.socketFit[key] !== 'string'))) {
    errors.push(`${prefix}.socketFit must contain optional from/to socket names`);
  }
  if (cable.powerSourceDeviceId !== undefined && (cable.type !== 'power' ||
    (cable.powerSourceDeviceId !== cable.fromDeviceId && cable.powerSourceDeviceId !== cable.toDeviceId))) {
    errors.push(`${prefix}.powerSourceDeviceId must be an endpoint of a power cable`);
  }
  if (cable.manualPath !== undefined && (!Array.isArray(cable.manualPath) || !cable.manualPath.every(isCableRouteAnchor))) {
    errors.push(`${prefix}.manualPath must be a list of channel or manager routing points`);
  }
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
  if (data.example !== undefined) {
    if (!isPlainObject(data.example)) errors.push('example must be an object');
    else {
      if (data.example.version !== 1) errors.push('example.version must be 1');
      if (!isNonEmptyString(data.example.sampleId) || !data.example.sampleId.trim()) errors.push('example.sampleId must be a non-empty string');
    }
  }
  if (data.planningGoals !== undefined) errors.push(...validatePlanningGoals(data.planningGoals, 'planningGoals'));
  // Preserve the legacy snapshot shape while guarding newly understood
  // planning intent before the baseline can be opened as another layout.
  const snapshot = isPlainObject(data.goldenBaseline) && isPlainObject(data.goldenBaseline.snapshot)
    ? data.goldenBaseline.snapshot : undefined;
  if (snapshot) {
    if (snapshot.planningGoals !== undefined) errors.push(...validatePlanningGoals(snapshot.planningGoals, 'goldenBaseline.snapshot.planningGoals'));
    for (const collection of ['devices', 'unplacedDevices']) {
      const records = snapshot[collection];
      if (Array.isArray(records)) records.forEach((device, index) => {
        if (isPlainObject(device) && device.planningGoals !== undefined) {
          errors.push(...validatePlanningGoals(device.planningGoals, `goldenBaseline.snapshot.${collection}[${index}].planningGoals`));
        }
      });
    }
  }
  if (data.findingReviewVersion !== undefined && data.findingReviewVersion !== 1) errors.push('findingReviewVersion must be 1');
  if (data.findingExceptions !== undefined) {
    if (!Array.isArray(data.findingExceptions)) errors.push('findingExceptions must be an array');
    else data.findingExceptions.forEach((record, index) => {
      const prefix = `findingExceptions[${index}]`;
      if (!isPlainObject(record)) { errors.push(`${prefix} must be an object`); return; }
      for (const key of ['id', 'ruleId', 'targetKey', 'fingerprint', 'reason']) {
        if (!isNonEmptyString(record[key]) || !(record[key] as string).trim()) errors.push(`${prefix}.${key} must be a non-empty string`);
      }
      if (typeof record.acceptedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(record.acceptedAt) || !Number.isFinite(Date.parse(record.acceptedAt))) {
        errors.push(`${prefix}.acceptedAt must be an ISO date-time`);
      }
    });
  }
  if (typeof data.rackType !== 'string' || !RACK_TYPES.has(data.rackType)) {
    errors.push('rackType must be "10in" or "19in"');
  }
  if (!isPositiveNumber(data.heightU)) errors.push('heightU must be a positive number');
  if (!isPositiveNumber(data.rackDepthMm)) errors.push('rackDepthMm must be a positive number');
  if (data.rearClearanceMm !== undefined && !isNonNegativeNumber(data.rearClearanceMm)) errors.push('rearClearanceMm must be a non-negative number');
  if (data.frontDoorClearanceMm !== undefined && !isNonNegativeNumber(data.frontDoorClearanceMm)) errors.push('frontDoorClearanceMm must be a non-negative number');
  if (data.rearDoorClearanceMm !== undefined && !isNonNegativeNumber(data.rearDoorClearanceMm)) errors.push('rearDoorClearanceMm must be a non-negative number');
  if (data.mountingPostSpacingMm !== undefined && !isPositiveNumber(data.mountingPostSpacingMm)) errors.push('mountingPostSpacingMm must be positive');
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

  if (data.procurementItems !== undefined && !Array.isArray(data.procurementItems)) {
    errors.push('procurementItems must be an array when present');
  }

  for (const key of ['reservations', 'unplacedDevices', 'readinessChecks', 'commissioningChecks', 'changeEvents', 'changeRequests', 'policies', 'debtItems', 'services', 'portReservations', 'patchPanelDocs', 'credentials', 'domainAssignments', 'sensorReadings', 'evidenceRecords']) {
    if (data[key] !== undefined && (!Array.isArray(data[key]) || !(data[key] as unknown[]).every(isPlainObject))) {
      errors.push(`${key} must be an array of records`);
    }
  }
  if (Array.isArray(data.services)) data.services.forEach((service, index) => {
    if (!isPlainObject(service)) return; // The collection guard above reports this.
    const prefix = `services[${index}]`;
    if (!isNonEmptyString(service.id)) errors.push(`${prefix}.id must be a non-empty string`);
    if (typeof service.name !== 'string') errors.push(`${prefix}.name must be a string`);
    if (typeof service.criticality !== 'string' || !['critical', 'high', 'medium', 'low'].includes(service.criticality)) errors.push(`${prefix}.criticality must be critical, high, medium or low`);
    for (const key of ['hostDeviceId', 'backupDeviceId']) {
      if (service[key] !== undefined && typeof service[key] !== 'string') errors.push(`${prefix}.${key} must be a device ID string`);
    }
    for (const key of ['storageDeviceIds', 'networkDeviceIds', 'powerDeviceIds']) {
      if (service[key] !== undefined && (!Array.isArray(service[key]) || !(service[key] as unknown[]).every(isNonEmptyString))) {
        errors.push(`${prefix}.${key} must be an array of non-empty device ID strings`);
      }
    }
    if (service.notes !== undefined && typeof service.notes !== 'string') errors.push(`${prefix}.notes must be a string`);
  });
  if (Array.isArray(data.reservations)) data.reservations.forEach((r, index) => {
    if (!isPlainObject(r) || !isNonEmptyString(r.id) || typeof r.name !== 'string' || !isPositiveNumber(r.positionU) || !isPositiveNumber(r.sizeU)) errors.push(`reservations[${index}] is invalid`);
  });
  if (Array.isArray(data.unplacedDevices)) data.unplacedDevices.forEach((device, index) => errors.push(...validateDevice(device, index, 'unplacedDevices')));

  if (errors.length === 0 && Array.isArray(data.cables)) {
    for (const cable of data.cables) {
      const reason = installationRoleError(data as unknown as RackLayout, cable as CableRoute);
      if (reason) errors.push(reason);
    }
  }
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Preserve extension fields as well as the validated planning data.
  const layout: RackLayout = {
    ...data,
    id: String(data.id),
    name: typeof data.name === 'string' ? data.name : '',
    rackType: String(data.rackType) as RackLayout['rackType'],
    heightU: Number(data.heightU),
    rackDepthMm: Number(data.rackDepthMm),
    rearClearanceMm: data.rearClearanceMm !== undefined ? Number(data.rearClearanceMm) : undefined,
    frontDoorClearanceMm: data.frontDoorClearanceMm !== undefined ? Number(data.frontDoorClearanceMm) : undefined,
    rearDoorClearanceMm: data.rearDoorClearanceMm !== undefined ? Number(data.rearDoorClearanceMm) : undefined,
    railMinDepthMm: data.railMinDepthMm !== undefined ? Number(data.railMinDepthMm) : undefined,
    railMaxDepthMm: data.railMaxDepthMm !== undefined ? Number(data.railMaxDepthMm) : undefined,
    weightLimitKg: Number(data.weightLimitKg),
    powerBudgetW: Number(data.powerBudgetW),
    electricityRatePerKwh: data.electricityRatePerKwh !== undefined ? Number(data.electricityRatePerKwh) : undefined,
    viewSide: String(data.viewSide) as RackLayout['viewSide'],
    devices: Array.isArray(data.devices) ? data.devices : [],
    cables: Array.isArray(data.cables) ? data.cables : [],
    reservations: Array.isArray(data.reservations) ? data.reservations : [],
    procurementItems: Array.isArray(data.procurementItems) ? data.procurementItems : [],
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
  };

  return { valid: true, layout };
}
