import { placedDeviceFromTemplate } from './placedDeviceFromTemplate';
import { getInstallationChecks } from './installationChecks';
import type { DeviceTemplate, PlacedDevice, RackLayout, ValidationIssue, ValidationSeverity, ViewSide, Workspace } from '../types/rack';
import {
  clampDevicePosition,
  clampDeviceX,
  findFirstFreeSlot,
  getDefaultDeviceX,
  getDeviceMountSide,
  getDeviceWidthMm,
  hasOverlap,
  isDeviceWithinRack,
  isZeroU
} from './rackMath';
import { deviceOverlapsReservations } from './reservations';
import { getRackTotals, validateRackLayout } from './validation';

export type FitCheckCategory = 'physical' | 'installation' | 'weight' | 'power' | 'heat' | 'stability' | 'reservation';

export interface FitCheckIssue {
  category: FitCheckCategory;
  severity: ValidationSeverity;
  title: string;
  detail: string;
}

export interface FitCheckPosition {
  positionU: number;
  xMm: number;
}

export interface FitCheckResult {
  canFit: boolean;
  proposedDevice: PlacedDevice;
  proposedPosition: FitCheckPosition;
  issues: FitCheckIssue[];
  checks: Record<FitCheckCategory, 'pass' | 'fail' | 'warning'>;
  before: ReturnType<typeof getRackTotals>;
  after: ReturnType<typeof getRackTotals>;
}

const PROPOSED_ID = 'fit-check-proposed';

function templateToProposedDevice(
  template: DeviceTemplate,
  positionU: number,
  xMm: number | undefined,
  mountSide: ViewSide
): PlacedDevice {
  return placedDeviceFromTemplate(template, PROPOSED_ID, positionU, xMm, mountSide);
}

function categorizeIssue(issue: ValidationIssue): FitCheckCategory | null {
  const id = issue.id;

  if (id.startsWith('physical-height-') || id.startsWith('bounds-') || id.startsWith('zone-0u-') || id.startsWith('overlap-') ||
      id.startsWith('width-') || id.startsWith('depth-') || id.startsWith('shelf-')) {
    return 'physical';
  }
  if (id.startsWith('reservation-')) {
    return 'reservation';
  }
  if (id === 'weight-limit' || id === 'weight-near-limit') {
    return 'weight';
  }
  if (id === 'power-input-topology' || id.startsWith('power-assumption-') || id.startsWith('power-poe-') || id === 'power-limit' || id === 'power-near-limit' || id.startsWith('circuit-overload-')) {
    return 'power';
  }
  if (id === 'center-of-gravity-high' || id.startsWith('ups-high-') || id.startsWith('heavy-high-')) {
    return 'stability';
  }
  if (id.startsWith('airflow-') || id.startsWith('heat-cluster-')) {
    return 'heat';
  }

  // Cable and other issues are not typically caused by adding a single device
  // and are usually pre-existing; skip them for fit check clarity
  return null;
}

function isRelevantToProposedDevice(issue: ValidationIssue): boolean {
  return issue.deviceIds?.includes(PROPOSED_ID) ?? false;
}

function isGlobalLimitIssue(issue: ValidationIssue): boolean {
  const globalIds = [
    'weight-limit',
    'weight-near-limit',
    'power-limit',
    'power-near-limit',
    'center-of-gravity-high',
    'cable-clutter'
  ];
  return issue.id === 'power-input-topology' || issue.id.startsWith('power-poe-') || globalIds.includes(issue.id) || issue.id.startsWith('circuit-overload-');
}

export function checkDeviceFit(
  layout: RackLayout,
  template: DeviceTemplate,
  options?: {
    positionU?: number;
    mountSide?: ViewSide;
    xMm?: number;
  },
  workspace?: Workspace
): FitCheckResult | null {
  const mountSide = options?.mountSide ?? layout.viewSide;

  // Build draft device for slot finding
  const draftDevice = templateToProposedDevice(template, options?.positionU ?? 1, options?.xMm, mountSide);

  // Determine placement
  let position: FitCheckPosition;
  if (options?.positionU !== undefined) {
    position = {
      positionU: clampDevicePosition(layout, draftDevice.sizeU, options.positionU),
      xMm: clampDeviceX(
        layout,
        draftDevice,
        options.xMm ?? getDefaultDeviceX(layout, draftDevice)
      )
    };
  } else {
    const slot = findFirstFreeSlot(layout, draftDevice);
    if (!slot) {
      // No free slot — still return a result so UI can show the failure
      position = {
        positionU: 1,
        xMm: getDefaultDeviceX(layout, draftDevice)
      };
    } else {
      position = slot;
    }
  }

  const proposedDevice = templateToProposedDevice(template, position.positionU, position.xMm, mountSide);

  // Check basic physical fit immediately
  const physicalPreChecks: FitCheckIssue[] = [];

  if (!isZeroU(proposedDevice) && !isDeviceWithinRack(layout, proposedDevice)) {
    physicalPreChecks.push({
      category: 'physical',
      severity: 'critical',
      title: `${template.name} does not fit in rack`,
      detail: `The device needs U${proposedDevice.positionU}-U${proposedDevice.positionU + proposedDevice.sizeU - 1}, but the rack is only ${layout.heightU}U.`
    });
  }

  if (!isZeroU(proposedDevice) && hasOverlap(layout, layout.devices, proposedDevice)) {
    physicalPreChecks.push({
      category: 'physical',
      severity: 'critical',
      title: `${template.name} overlaps another device`,
      detail: 'The chosen position conflicts with an existing component.'
    });
  }

  const reservation = deviceOverlapsReservations(layout, proposedDevice);
  if (reservation) {
    physicalPreChecks.push({
      category: 'reservation',
      severity: 'critical',
      title: `${template.name} overlaps reserved space`,
      detail: `Position conflicts with reservation "${reservation.name}".`
    });
  }

  if (getDeviceWidthMm(proposedDevice) > rackSpec(layout).usableWidthMm + 1) {
    physicalPreChecks.push({
      category: 'physical',
      severity: 'critical',
      title: `${template.name} is too wide`,
      detail: `${proposedDevice.widthType} equipment will not fit inside a ${rackSpec(layout).label} rack.`
    });
  }

  // Build simulated layout
  const simulatedLayout: RackLayout = {
    ...layout,
    devices: [...layout.devices, proposedDevice]
  };

  const before = getRackTotals(layout, workspace);
  const after = getRackTotals(simulatedLayout, workspace);

  for (const check of getInstallationChecks(simulatedLayout, proposedDevice)) {
    if (check.status !== 'passed') physicalPreChecks.push({ category: 'installation', severity: check.status === 'failed' ? 'critical' : 'warning', title: check.status === 'failed' ? 'Installation requirement not met' : 'Installation data needs review', detail: check.detail });
  }

  // Run full validation on simulated layout
  const allIssues = validateRackLayout(simulatedLayout, workspace);

  // Filter to issues relevant to the proposed device or global limits
  const relevantIssues = allIssues.filter(
    (issue) => isRelevantToProposedDevice(issue) || isGlobalLimitIssue(issue)
  );

  // Map to fit check issues, including pre-checks
  const issues: FitCheckIssue[] = [
    ...physicalPreChecks,
    ...relevantIssues
      .map((issue) => {
        const category = categorizeIssue(issue);
        if (!category) return null;
        return {
          category,
          severity: issue.severity,
          title: issue.title,
          detail: issue.detail
        };
      })
      .filter((issue): issue is FitCheckIssue => issue !== null)
  ];

  // Deduplicate by title+detail
  const seen = new Set<string>();
  const dedupedIssues = issues.filter((issue) => {
    const key = `${issue.category}:${issue.title}:${issue.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Determine per-category status
  const checks: Record<FitCheckCategory, 'pass' | 'fail' | 'warning'> = {
    physical: 'pass',
    installation: 'pass',
    weight: 'pass',
    power: 'pass',
    heat: 'pass',
    stability: 'pass',
    reservation: 'pass'
  };

  for (const issue of dedupedIssues) {
    const current = checks[issue.category];
    if (issue.severity === 'critical') {
      checks[issue.category] = 'fail';
    } else if (issue.severity === 'warning' && current === 'pass') {
      checks[issue.category] = 'warning';
    }
  }

  // If no slot was found, report it as the root cause
  if (options?.positionU === undefined && !findFirstFreeSlot(layout, draftDevice)) {
    const noSlotIssue: FitCheckIssue = {
      category: 'physical',
      severity: 'critical',
      title: 'No free slot available',
      detail: `Could not find a free ${template.defaultU}U space for ${template.name} on the ${mountSide} side.`
    };
    const key = `${noSlotIssue.category}:${noSlotIssue.title}:${noSlotIssue.detail}`;
    if (!seen.has(key)) {
      dedupedIssues.push(noSlotIssue);
      seen.add(key);
    }
    checks.physical = 'fail';
  }

  const canFit = !Object.values(checks).some((s) => s === 'fail');

  return {
    canFit,
    proposedDevice,
    proposedPosition: position,
    issues: dedupedIssues,
    checks,
    before,
    after
  };
}

function rackSpec(layout: Pick<RackLayout, 'rackType'>) {
  const specs = {
    '10in': { label: '10-inch', usableWidthMm: 254 },
    '19in': { label: '19-inch', usableWidthMm: 482.6 }
  } as const;
  return specs[layout.rackType];
}
