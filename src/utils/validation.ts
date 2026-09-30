import { getRackPowerSummary } from './rackPower';
import { batterySupplyLayout } from './upsOutletBackup';
import { getPoeIssues } from './poeBudget';
import { getConnectorIssues } from './connectorCompatibility';
import { getInstallationIssues, getSupportingShelf } from './installationChecks';
import { needsPowerReview, planningPowerBasis, POWER_BASIS_LABELS } from './powerAssumptions';
import { shouldHideDevice } from './featureFlags';
import type { PlacedDevice, RackLayout, ValidationIssue, CableRoute, Workspace } from '../types/rack';
import { getPatchPanelJacks } from './patchPanel';
import { calculateCablePlan, isPdu } from './routing';
import { getCableLengthRequirements, cablePurchaseLengthLabel, cablePurchaseNote } from './cableLengthRequirements';
import { validateCableColorConvention } from './cableColors';
import {
  getDeviceWidthMm,
  getDeviceMountSide,
  getDeviceSpatialZone,
  hasOverlap,
  isDeviceWithinRack,
  isRearZone,
  isSideZone,
  occupiedUnits,
  RACK_SPECS,
  getDeviceXRange,
  getCenterOfGravityU,
  getDepthCompatibilityIssues,
  getDepthSummary,
  rangesOverlap,
  isZeroU
} from './rackMath';
import { buildPowerTopology, isPowerSource, checkPowerRedundancy, getDeviceCapacityW, validatePduOutletAssignments } from './powerChain';
import { getServiceabilityIssues } from './serviceability';
import { reservationOverlapsDevice, reservationWithinRack } from './reservations';
import { validatePrintedMountFit } from './printedMount';
import { getPortFaceMap, getPortMetadata } from './portLayout';
import { canShareShelf, isTrayShelf, shelfDeckHeight, deviceBodyHeightMm, U_HEIGHT_MM } from './rackMath';

function totalWeight(devices: PlacedDevice[]) {
  return devices.reduce((sum, device) => sum + device.weightKg, 0);
}

function blocksAirflow(device: PlacedDevice) {
  return device.category !== 'shelf' && device.category !== 'blank' && device.category !== 'cable-management';
}

function routingWarningTitle(code: string): string {
  switch (code) {
    case 'missing-manager':
      return 'Cable manager recommended';
    case 'power-data-separation':
      return 'Power and data share a tray';
    case 'bend-radius-risk':
      return 'Cable bend radius or slack risk';
    case 'tray-density':
      return 'Cable tray is getting dense';
    case 'patch-discipline':
      return 'Patch route breaks technician discipline';
    case 'pdu-side':
      return 'Power route needs distribution hardware';
    default:
      return 'Cable routing issue';
  }
}

function areMediaCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  // SFP family can interop with fiber/DAC via transceivers
  const sfpFamily = ['sfp', 'sfp+', 'qsfp+', 'dac', 'fiber'];
  if (sfpFamily.includes(a) && sfpFamily.includes(b)) return true;
  // RJ45 is only compatible with itself (SFP+ to RJ45 needs special adapter)
  if (a === 'rj45' || b === 'rj45') return false;
  return true;
}


function validateCableLength(cable: CableRoute, layout: RackLayout): ValidationIssue | null {
  const requirement = getCableLengthRequirements(layout).get(cable.id);
  if (!requirement) return null;
  const short = requirement.requiredMm !== null && !!cable.lengthMm && cable.lengthMm < requirement.requiredMm;
  if (requirement.status !== 'estimated' || short) {
    return {
      id: `${short ? 'cable-short' : 'cable-length-review'}-${cable.id}`,
      evidence: short ? undefined : 'unverified',
      severity: 'warning',
      title: short ? `Cable ${cable.id} may be too short` : `Cable ${cable.id} length needs review`,
      detail: `${cablePurchaseNote(requirement)}${cable.lengthMm ? ` Declared: ${cable.lengthMm}mm.` : ''} Purchase length: ${cablePurchaseLengthLabel(requirement)}.`,
      deviceIds: [cable.fromDeviceId, cable.toDeviceId],
      cableIds: [cable.id]
    };
  }
  return null;
}

export function validateRackLayout(layout: RackLayout, workspace?: Workspace): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const hidden = layout.devices.filter(shouldHideDevice);
  if (hidden.length) issues.push({
    id: 'unsupported-zero-u', severity: 'warning', title: 'Unsupported 0U hardware preserved',
    detail: '0U physical planning is disabled. Devices and attached cables are retained in JSON, but are not rendered or editable. Export JSON for a compatible version; do not rely on this view to validate their fit.',
    deviceIds: hidden.map(d => d.id),
  });
  // Direct links are normal in a homelab; an enabled policy can require structured cabling.
  const directLinkSeverityRank: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  const directLinkPolicy = (layout.policies ?? []).filter((policy) =>
    policy.type === 'no-endpoint-switch-direct' && policy.enabled,
  ).sort((a, b) => (directLinkSeverityRank[a.severity] ?? 2) - (directLinkSeverityRank[b.severity] ?? 2))[0];
  const rackSpec = RACK_SPECS[layout.rackType];
  const reservations = layout.reservations ?? [];
  const depthSummary = getDepthSummary(layout);
  const occupiedBySide = {
    front: occupiedUnits(layout.devices.filter((device) => getDeviceMountSide(device) === 'front' && blocksAirflow(device)), layout.heightU),
    rear: occupiedUnits(layout.devices.filter((device) => getDeviceMountSide(device) === 'rear' && blocksAirflow(device)), layout.heightU)
  };

  reservations.forEach((reservation) => {
    if (!reservationWithinRack(layout, reservation)) {
      issues.push({
        id: `reservation-bounds-${reservation.id}`,
        severity: 'critical',
        title: `${reservation.name} reservation is outside the rack`,
        detail: `Reserved range U${reservation.positionU}-U${reservation.positionU + reservation.sizeU - 1} exceeds the ${layout.heightU}U rack.`
      });
    }

    layout.devices.forEach((device) => {
      if (!reservationOverlapsDevice(layout, reservation, device)) return;
      const severity = device.lifecycleStatus === 'planned' ? 'warning' : device.lifecycleStatus === 'decommissioning' ? 'info' : 'critical';
      issues.push({
        id: `reservation-overlap-${reservation.id}-${device.id}`,
        severity,
        title: `${device.name} occupies reserved rack space`,
        detail: `${reservation.name} reserves U${reservation.positionU}-U${reservation.positionU + reservation.sizeU - 1} on the ${reservation.mountSide} side. Move ${device.name}, resize the reservation, or remove the reservation if the future slot is now in use.`,
        deviceIds: [device.id]
      });
    });
  });

  // Per-device checks stay independent so imported JSON can be audited even if editing prevented the same issue.
  layout.devices.forEach((device) => {
    if (!isDeviceWithinRack(layout, device)) {
      issues.push({
        id: `bounds-${device.id}`,
        severity: 'critical',
        title: `${device.name} is outside the rack`,
        detail: device.sizeU > 0
          ? `The device occupies U${device.positionU}-U${device.positionU + device.sizeU - 1}, beyond the ${layout.heightU}U rack.`
          : `The device is positioned outside the ${layout.heightU}U rack.`,
        deviceIds: [device.id]
      });
    }

    if (isZeroU(device) && !isSideZone(device) && !isRearZone(device)) {
      issues.push({
        id: `zone-0u-${device.id}`,
        severity: 'critical',
        title: `${device.name} must be rail-mounted`,
        detail: '0U devices must be placed in a side-left, side-right, rear-left, or rear-right zone.',
        deviceIds: [device.id]
      });
    }

    if (hasOverlap(layout, layout.devices, device)) {
      const severity = device.lifecycleStatus === 'planned' ? 'warning' : device.lifecycleStatus === 'decommissioning' ? 'info' : 'critical';
      issues.push({
        id: `overlap-${device.id}`,
        severity,
        title: `${device.name} overlaps another device`,
        detail: 'Move or resize one of the components so its U range and horizontal footprint do not collide.',
        deviceIds: [device.id]
      });
    }

    if (getDeviceWidthMm(device) > rackSpec.usableWidthMm + 1) {
      issues.push({
        id: `width-${device.id}`,
        severity: 'critical',
        title: `${device.name} is too wide`,
        detail: `${device.widthType} equipment will not fit inside a ${rackSpec.label} rack without a shelf or adapter.`,
        deviceIds: [device.id]
      });
    }

    if (device.depthMm > depthSummary.usableDepthMm) {
      issues.push({
        id: `depth-${device.id}`,
        severity: 'warning',
        title: `${device.name} may be too deep`,
        detail: `${device.depthMm}mm device depth exceeds the ${depthSummary.usableDepthMm}mm usable depth after rear cable and door clearances. Additional usable depth required: ${(device.depthMm - depthSummary.usableDepthMm).toFixed(1)} mm.`,
        deviceIds: [device.id]
      });
    }

    if (device.category === 'ups' && device.positionU > Math.max(2, Math.floor(layout.heightU * 0.25))) {
      issues.push({
        id: `ups-high-${device.id}`,
        severity: 'warning',
        title: 'UPS is placed high in the rack',
        detail: `${device.name} is heavy and should usually sit near the bottom for stability.`,
        deviceIds: [device.id]
      });
    }

    if (device.weightKg >= 8 && device.positionU > layout.heightU * 0.5) {
      issues.push({
        id: `heavy-high-${device.id}`,
        severity: 'warning',
        title: 'Heavy device is above mid-height',
        detail: `${device.name} weighs ${device.weightKg}kg. Consider moving it lower.`,
        deviceIds: [device.id]
      });
    }

    if (!isZeroU(device) && device.heatLevel >= 4) {
      const occupied = occupiedBySide[getDeviceMountSide(device)];
      const belowFree = !occupied.has(device.positionU - 1);
      const aboveFree = !occupied.has(device.positionU + device.sizeU);
      if (!belowFree && !aboveFree) {
        issues.push({
          id: `airflow-${device.id}`,
          severity: 'warning',
          title: 'High-heat device has little airflow gap',
          detail: `${device.name} is surrounded by occupied U positions. Leave a blank panel or free U nearby if possible.`,
          deviceIds: [device.id]
        });
      }
    }

    if (isTrayShelf(device)) {
      const supported = layout.devices.filter(item => canShareShelf(layout, device, item));
      const load = supported.reduce((sum, item) => sum + item.weightKg, 0);
      if ((device.shelfLoadLimitKg ?? 0) > 0 && load > device.shelfLoadLimitKg!) issues.push({ id: `tray-load-${device.id}`, severity: 'warning', title: `${device.name}: shelf overloaded`, detail: `${load.toFixed(1)} kg / ${device.shelfLoadLimitKg} kg limit.`, deviceIds: [device.id, ...supported.map(item => item.id)] });
      if (shelfDeckHeight(device) > device.sizeU * U_HEIGHT_MM) issues.push({ id: `tray-height-${device.id}`, severity: 'critical', title: `${device.name}: tray too high`, detail: 'Lower deck or increase Rack size U.', deviceIds: [device.id] });
    }
    if (device.physicalHeightMm !== undefined && deviceBodyHeightMm(device) + (device.clearanceAboveMm ?? 0) > device.sizeU * U_HEIGHT_MM) issues.push({ id: `physical-height-${device.id}`, severity: 'critical', title: `${device.name}: too tall`, detail: 'Increase Rack size U.', deviceIds: [device.id] });

    if ((device.widthType === 'shelf' || device.widthType === 'custom') && device.category !== 'shelf' && device.mountingSupport !== 'printed-mount' && !isZeroU(device)) {
      const hasNearbyShelf = getSupportingShelf(layout, device) !== undefined;
      if (!hasNearbyShelf) {
        issues.push({
          id: `shelf-${device.id}`,
          severity: 'info',
          title: `${device.name} needs shelf support`,
          detail: 'Add a shelf on or directly below this device, or choose 3D-printed rack mount under Properties → Mounting support if an installed mount supports it.',
          deviceIds: [device.id]
        });
      }
    }

    issues.push(...validatePrintedMountFit(device, layout));
  });

  const weight = totalWeight(layout.devices);
  if (weight > layout.weightLimitKg) {
    issues.push({
      id: 'weight-limit',
      severity: 'critical',
      title: 'Rack weight limit exceeded',
      detail: `Total device weight is ${weight.toFixed(1)}kg, above the configured ${layout.weightLimitKg}kg limit.`
    });
  } else if (weight > layout.weightLimitKg * 0.8) {
    issues.push({
      id: 'weight-near-limit',
      severity: 'warning',
      title: 'Rack weight is near the limit',
      detail: `Total device weight is ${weight.toFixed(1)}kg, over 80% of the configured limit.`
    });
  }

  const cg = getCenterOfGravityU(layout);
  if (cg && cg.cgU > layout.heightU * 0.6) {
    issues.push({
      id: 'center-of-gravity-high',
      severity: 'warning',
      title: 'Rack center of gravity is high',
      detail: `Center of gravity is at U${cg.cgU.toFixed(1)} (${((cg.cgU / layout.heightU) * 100).toFixed(0)}% of rack height). Move heavy devices lower for stability.`,
    });
  }

  const powerSummary = getRackPowerSummary(layout, workspace);
  const power = powerSummary.powerW;
  issues.push(...powerSummary.issues);
  if (powerSummary.powerAttributionActive) issues.push({ id: 'power-attribution', severity: 'info', title: 'Rack power is attributed to supply inputs', detail: `Device planning sum: ${Number(powerSummary.devicePowerW.toFixed(2))} W. Attributed rack input: ${Number(power.toFixed(2))} W. PoE output and conversion losses are assigned to the supply rack; PoE-only receivers are not counted again here. Independent wired feeds retain full planning load. This is conditional planning input, not measured wall power or local heat output.` });
  if (power > layout.powerBudgetW) {
    issues.push({
      id: 'power-limit',
      severity: 'critical',
      title: 'Power budget exceeded',
      detail: `Attributed input is ${Number(power.toFixed(2))}W, above the configured ${layout.powerBudgetW}W budget.`
    });
  } else if (power > layout.powerBudgetW * 0.8) {
    issues.push({
      id: 'power-near-limit',
      severity: 'warning',
      title: 'Power usage is near the budget',
      detail: `Attributed input is ${Number(power.toFixed(2))}W, over 80% of the configured budget.`
    });
  }

  for (const [index, warning] of buildPowerTopology(layout).warnings.entries()) {
    issues.push({ id: `power-topology-${index}`, severity: 'warning', title: 'Power topology needs review', detail: warning });
  }

  for (const device of layout.devices.filter(needsPowerReview)) {
    issues.push({
      id: `power-assumption-${device.id}`, severity: 'warning', evidence: 'unverified', title: 'Planning power needs review',
      detail: `${device.name} uses ${device.powerW}W (${POWER_BASIS_LABELS[planningPowerBasis(device)]}) in power, runtime and energy estimates. Review the workload and installed configuration in Power & Lifecycle before relying on these results.`,
      deviceIds: [device.id],
    });
  }

  issues.push(...getInstallationIssues(layout), ...getConnectorIssues(layout));
  issues.push(...batterySupplyLayout(layout).unknowns.map(w => ({
    id: `power-ups-backup-${w.cableId}`, severity: 'warning' as const, evidence: 'unverified' as const, title: 'UPS outlet backup is unverified',
    detail: w.detail, deviceIds: [w.sourceId], cableIds: [w.cableId],
  })));
  const poeWorkspace: Workspace = workspace ? { ...workspace, racks: workspace.racks.map(rack => rack.id === layout.id ? layout : rack) } : { id: 'local-audit', name: layout.name, racks: [layout], interRackCables: [], updatedAt: layout.updatedAt };
  issues.push(...getPoeIssues(poeWorkspace, layout.id));

  // Unknown ratings must not appear as a successful electrical capacity check.
  for (const device of layout.devices.filter(isPowerSource)) {
    if (getDeviceCapacityW(device) === undefined) {
      issues.push({
        id: `power-capacity-unknown-${device.id}`, evidence: 'unverified',
        severity: 'warning',
        title: 'Power output capacity is unverified',
        detail: `${device.name} has no verified output rating in watts. Enter its continuous rated output in device properties; socket count does not establish capacity. Circuit breaker capacity is not verified by this check.`,
        deviceIds: [device.id],
      });
    }
  }

  const highHeatDevices = layout.devices.filter((device) => !isZeroU(device) && device.heatLevel >= 4);
  for (let i = 0; i < highHeatDevices.length; i += 1) {
    for (let j = i + 1; j < highHeatDevices.length; j += 1) {
      const a = highHeatDevices[i];
      const b = highHeatDevices[j];
      if (getDeviceMountSide(a) !== getDeviceMountSide(b)) continue;
      const distance = Math.min(
        Math.abs(a.positionU - (b.positionU + b.sizeU - 1)),
        Math.abs(b.positionU - (a.positionU + a.sizeU - 1))
      );
      if (distance <= 1) {
        issues.push({
          id: `heat-cluster-${a.id}-${b.id}`,
          severity: 'warning',
          title: 'High-heat devices are grouped together',
          detail: `${a.name} and ${b.name} are close together. Consider separating them or adding airflow space.`,
          deviceIds: [a.id, b.id]
        });
      }
    }
  }

  if (layout.cables.length > Math.max(10, layout.devices.length * 2)) {
    issues.push({
      id: 'cable-clutter',
      severity: 'warning',
      title: 'Cable clutter risk',
      detail: `${layout.cables.length} planned cable routes may be hard to manage. Add cable management or shorten routes.`
    });
  }

  const missingCableDevice = layout.cables.find(
    (cable) =>
      !layout.devices.some((device) => device.id === cable.fromDeviceId) ||
      !layout.devices.some((device) => device.id === cable.toDeviceId)
  );
  if (missingCableDevice) {
    issues.push({
      id: 'missing-cable-device',
      severity: 'critical',
      title: 'Cable route references a missing device',
      detail: 'Remove the stale cable route or reconnect it to an existing component.'
    });
  }

  // Technician route-plan checks are generated by the same planner used by 2D/3D rendering.
  layout.cables.forEach((cable) => {
    const plan = calculateCablePlan(cable, layout);
    if (!plan) return;
    plan.warnings.forEach((warning) => {
      issues.push({
        id: `route-${warning.code}-${cable.id}`,
        severity: warning.severity,
        title: routingWarningTitle(warning.code),
        detail: warning.message,
        deviceIds: warning.deviceIds,
        cableIds: [cable.id]
      });
    });
  });

  // Cable length validation
  layout.cables.forEach((cable) => {
    const issue = validateCableLength(cable, layout);
    if (issue) issues.push(issue);
  });

  // Cable colour convention validation
  layout.cables.forEach((cable) => {
    const issue = validateCableColorConvention(cable);
    if (issue) issues.push(issue);
  });

  // Duplicate port usage check
  const portClaims = new Map<string, string>();
  layout.cables.forEach((cable) => {
    const claimKey = (deviceId: string, port: { type: string; index: number; side?: string } | undefined) =>
      port ? `${deviceId}:${port.type}:${port.index}:${port.side ?? 'default'}` : null;

    const fromKey = claimKey(cable.fromDeviceId, cable.fromPort);
    const toKey = claimKey(cable.toDeviceId, cable.toPort);

    [fromKey, toKey].forEach((key) => {
      if (!key) return;
      const existingCableId = portClaims.get(key);
      if (existingCableId && existingCableId !== cable.id) {
        const [deviceId, portType, portIndex] = key.split(':');
        const device = layout.devices.find((d) => d.id === deviceId);
        issues.push({
          id: `duplicate-port-${key}`,
          severity: 'warning',
          title: `Port ${portType} ${Number(portIndex) + 1} on ${device?.name ?? 'device'} is used by multiple cables`,
          detail: 'A single port should only have one cable route assigned to it.',
          deviceIds: [deviceId],
          cableIds: [existingCableId, cable.id]
        });
      } else {
        portClaims.set(key, cable.id);
      }
    });
  });

  // Patch panel jack-pair checks: rear punch-down and front patch cord are the same real-world jack.
  layout.devices
    .filter((device) => device.category === 'patch-panel')
    .forEach((panel) => {
      getPatchPanelJacks(layout, panel.id).forEach((jack) => {
        if (jack.state === 'dark-patch') {
          issues.push({
            id: `patch-jack-dark-${panel.id}-${jack.index}`,
            severity: 'warning',
            title: 'Patch panel jack is patched but has no rear home run',
            detail: `${panel.name} jack ${jack.index + 1} is patched on the front${jack.frontPeer ? ` to ${jack.frontPeer.name}` : ''}, but nothing is landed on the rear punch-down side.`,
            deviceIds: [panel.id, jack.frontPeer?.id].filter(Boolean) as string[],
            cableIds: jack.frontCable ? [jack.frontCable.id] : undefined
          });
        }

        if (jack.state === 'landed') {
          issues.push({
            id: `patch-jack-unpatched-${panel.id}-${jack.index}`,
            severity: 'info',
            title: 'Patch panel jack is landed but not patched',
            detail: `${panel.name} jack ${jack.index + 1} has a rear home run${jack.rearPeer ? ` to ${jack.rearPeer.name}` : ''}, but no front patch cord to a switch port.`,
            deviceIds: [panel.id, jack.rearPeer?.id].filter(Boolean) as string[],
            cableIds: jack.rearCable ? [jack.rearCable.id] : undefined
          });
        }
      });
    });

  // Routing validation: power vs network separation
  layout.cables.forEach((cable) => {
    const from = layout.devices.find((d) => d.id === cable.fromDeviceId);
    const to = layout.devices.find((d) => d.id === cable.toDeviceId);
    if (!from || !to) return;

    // Network cables cannot connect to 0U devices
    const networkTypes = ['ethernet', 'fiber', 'patch', 'structured'];
    if (networkTypes.includes(cable.type) && (isZeroU(from) || isZeroU(to))) {
      issues.push({
        id: `network-0u-${cable.id}`,
        severity: 'critical',
        title: 'Network cable connected to 0U device',
        detail: 'Network cables (ethernet, fiber, patch, structured) cannot connect to 0U devices.',
        deviceIds: [isZeroU(from) ? from.id : to.id],
        cableIds: [cable.id]
      });
    }

    // Power cables should preferably connect to a PDU.
    if (cable.type === 'power') {
      if (!isPdu(from) && !isPdu(to)) {
        issues.push({
          id: `power-no-pdu-${cable.id}`,
          severity: 'info',
          title: 'Power cable not connected to a PDU',
          detail: 'Power cables should ideally connect to a PDU for proper power distribution.',
          deviceIds: [from.id, to.id],
          cableIds: [cable.id]
        });
      }
      const poweredDevice = isPdu(from) ? to : isPdu(to) ? from : null;
      const connectedPdu = isPdu(from) ? from : isPdu(to) ? to : null;
      if (poweredDevice && getDeviceMountSide(poweredDevice) !== 'rear') {
        issues.push({
          id: `power-front-${cable.id}`,
          severity: 'info',
          title: 'Power cable from front-mounted device',
          detail: `${poweredDevice.name}: power cables should ideally exit from the device rear toward the PDU.`,
          deviceIds: [poweredDevice.id],
          cableIds: [cable.id]
        });
      }
      // Power cable should prefer nearest PDU
      if (poweredDevice && connectedPdu) {
        const pdus = layout.devices.filter((d) => isPdu(d));
        const connectedDistance =
          connectedPdu.sizeU === 0
            ? Math.abs((poweredDevice.xMm ?? 0) - (connectedPdu.xMm ?? 0))
            : Math.abs(poweredDevice.positionU - (connectedPdu.positionU + (connectedPdu.sizeU - 1) / 2));
        const hasNearer = pdus.some((candidate) => {
          if (candidate.id === connectedPdu.id) return false;
          const dist =
            candidate.sizeU === 0
              ? Math.abs((poweredDevice.xMm ?? 0) - (candidate.xMm ?? 0))
              : Math.abs(poweredDevice.positionU - (candidate.positionU + (candidate.sizeU - 1) / 2));
          return dist < connectedDistance;
        });
        if (hasNearer) {
          issues.push({
            id: `power-nearer-pdu-${cable.id}`,
            severity: 'warning',
            title: 'Power cable could use nearer PDU',
            detail: `${poweredDevice.name} is connected to a PDU that is not the nearest one available.`,
            deviceIds: [poweredDevice.id],
            cableIds: [cable.id]
          });
        }
      }
    }

    // Network cables should go through patch panel (no direct device-to-device)
    const isPatchPanel = (d: PlacedDevice) => d.category === 'patch-panel';
    const isSwitch = (d: PlacedDevice) => d.category === 'switch';
    const isEndpoint = (d: PlacedDevice) => !isPatchPanel(d) && !isSwitch(d);
    const fromIsPatch = isPatchPanel(from);
    const toIsPatch = isPatchPanel(to);
    const fromIsSwitch = isSwitch(from);
    const toIsSwitch = isSwitch(to);
    const fromIsEndpoint = isEndpoint(from);
    const toIsEndpoint = isEndpoint(to);

    // 1. Endpoint → switch direct connection guidance
    if ((fromIsEndpoint && toIsSwitch) || (fromIsSwitch && toIsEndpoint)) {
      issues.push({
        id: `endpoint-switch-direct-${cable.id}`,
        severity: directLinkPolicy?.severity ?? 'info',
        title: 'Endpoint connected directly to switch',
        detail: directLinkPolicy
          ? `${from.name} → ${to.name}: your structured-cabling policy requires endpoints on patch panel rear ports and switches on front ports.`
          : `${from.name} → ${to.name}: direct links are allowed for homelabs. A patch panel is optional for easier cable organization.`,
        deviceIds: [from.id, to.id],
        cableIds: [cable.id]
      });
    }

    // 2. Endpoint → patch-panel front connection ban
    if (fromIsEndpoint && toIsPatch && cable.toPort?.side === 'front') {
      issues.push({
        id: `patch-front-endpoint-${cable.id}`,
        severity: 'critical',
        title: 'Endpoint connected to patch panel front port',
        detail: `${to.name} port ${cable.toPort.index + 1}: endpoint devices must connect to patch panel rear ports only.`,
        deviceIds: [to.id],
        cableIds: [cable.id]
      });
    }
    if (toIsEndpoint && fromIsPatch && cable.fromPort?.side === 'front') {
      issues.push({
        id: `patch-front-endpoint-${cable.id}`,
        severity: 'critical',
        title: 'Endpoint connected to patch panel front port',
        detail: `${from.name} port ${cable.fromPort.index + 1}: endpoint devices must connect to patch panel rear ports only.`,
        deviceIds: [from.id],
        cableIds: [cable.id]
      });
    }

    // 3. Switch → patch-panel rear connection ban
    if (fromIsSwitch && toIsPatch && cable.toPort?.side === 'rear') {
      issues.push({
        id: `patch-rear-switch-${cable.id}`,
        severity: 'critical',
        title: 'Switch connected to patch panel rear port',
        detail: `${to.name} port ${cable.toPort.index + 1}: switches must connect to patch panel front ports only.`,
        deviceIds: [to.id],
        cableIds: [cable.id]
      });
    }
    if (toIsSwitch && fromIsPatch && cable.fromPort?.side === 'rear') {
      issues.push({
        id: `patch-rear-switch-${cable.id}`,
        severity: 'critical',
        title: 'Switch connected to patch panel rear port',
        detail: `${from.name} port ${cable.fromPort.index + 1}: switches must connect to patch panel front ports only.`,
        deviceIds: [from.id],
        cableIds: [cable.id]
      });
    }

    // 4. Structured / patch cable type enforcement
    if (cable.type === 'structured') {
      if (!fromIsPatch && !toIsPatch) {
        issues.push({
          id: `structured-no-panel-${cable.id}`,
          severity: 'critical',
          title: 'Structured cable missing patch panel',
          detail: `${from.name} → ${to.name}: structured cables must connect to a patch panel rear port.`,
          deviceIds: [from.id, to.id],
          cableIds: [cable.id]
        });
      }
      if (fromIsPatch && cable.fromPort?.side !== 'rear') {
        issues.push({
          id: `structured-front-${cable.id}`,
          severity: 'critical',
          title: 'Structured cable on patch panel front port',
          detail: `${from.name} port ${cable.fromPort!.index + 1}: structured cables must use patch panel rear ports.`,
          deviceIds: [from.id],
          cableIds: [cable.id]
        });
      }
      if (toIsPatch && cable.toPort?.side !== 'rear') {
        issues.push({
          id: `structured-front-${cable.id}`,
          severity: 'critical',
          title: 'Structured cable on patch panel front port',
          detail: `${to.name} port ${cable.toPort!.index + 1}: structured cables must use patch panel rear ports.`,
          deviceIds: [to.id],
          cableIds: [cable.id]
        });
      }
    }

    if (cable.type === 'patch') {
      if (!((fromIsPatch && toIsSwitch) || (fromIsSwitch && toIsPatch))) {
        issues.push({
          id: `patch-invalid-pair-${cable.id}`,
          severity: 'critical',
          title: 'Patch cable must connect patch panel to switch',
          detail: `${from.name} → ${to.name}: patch cables must connect a patch panel front port to a switch port.`,
          deviceIds: [from.id, to.id],
          cableIds: [cable.id]
        });
      }
      if (fromIsPatch && cable.fromPort?.side !== 'front') {
        issues.push({
          id: `patch-rear-${cable.id}`,
          severity: 'critical',
          title: 'Patch cable on patch panel rear port',
          detail: `${from.name} port ${cable.fromPort!.index + 1}: patch cables must use patch panel front ports.`,
          deviceIds: [from.id],
          cableIds: [cable.id]
        });
      }
      if (toIsPatch && cable.toPort?.side !== 'front') {
        issues.push({
          id: `patch-rear-${cable.id}`,
          severity: 'critical',
          title: 'Patch cable on patch panel rear port',
          detail: `${to.name} port ${cable.toPort!.index + 1}: patch cables must use patch panel front ports.`,
          deviceIds: [to.id],
          cableIds: [cable.id]
        });
      }
    }

    // Legacy ethernet/fiber: warn if bypassing patch panel
    if (cable.type === 'ethernet' || cable.type === 'fiber') {
      const hasPatchPanel = fromIsPatch || toIsPatch;
      if (!hasPatchPanel && !((fromIsEndpoint && toIsSwitch) || (fromIsSwitch && toIsEndpoint))) {
        issues.push({
          id: `network-direct-${cable.id}`,
          severity: 'info',
          title: 'Network cable bypasses patch panel',
          detail: `${from.name} → ${to.name}: network cables should route via patch panel for structured cabling.`,
          deviceIds: [from.id, to.id],
          cableIds: [cable.id]
        });
      }
    }

    // Port speed / media type mismatch checks
    const fromMeta = cable.fromPort
      ? getPortMetadata(from, cable.fromPort.side ?? getPortFaceMap(from.category, from.portFaceOverrides)[cable.fromPort.type] ?? 'rear', cable.fromPort.type, cable.fromPort.index)
      : undefined;
    const toMeta = cable.toPort
      ? getPortMetadata(to, cable.toPort.side ?? getPortFaceMap(to.category, to.portFaceOverrides)[cable.toPort.type] ?? 'rear', cable.toPort.type, cable.toPort.index)
      : undefined;

    if (fromMeta?.speed && toMeta?.speed && fromMeta.speed !== toMeta.speed) {
      issues.push({
        id: `speed-mismatch-${cable.id}`,
        severity: 'warning',
        title: 'Port speed mismatch',
        detail: `${from.name} (${fromMeta.speed}) ↔ ${to.name} (${toMeta.speed}): connected ports have different speed ratings.`,
        deviceIds: [from.id, to.id],
        cableIds: [cable.id]
      });
    }

    if (fromMeta?.mediaType && toMeta?.mediaType && !areMediaCompatible(fromMeta.mediaType, toMeta.mediaType)) {
      issues.push({
        id: `media-incompatible-${cable.id}`,
        severity: 'warning',
        title: 'Incompatible media types',
        detail: `${from.name} (${fromMeta.mediaType}) ↔ ${to.name} (${toMeta.mediaType}): these media types require an adapter or transceiver to connect.`,
        deviceIds: [from.id, to.id],
        cableIds: [cable.id]
      });
    }

    // Cable type vs port media mismatch
    const cableMedia = cable.mediaType ?? fromMeta?.mediaType ?? toMeta?.mediaType;
    if (cableMedia && fromMeta?.mediaType && toMeta?.mediaType) {
      if ((cable.type === 'fiber' && cableMedia !== 'fiber' && cableMedia !== 'sfp' && cableMedia !== 'sfp+' && cableMedia !== 'qsfp+') ||
          (cable.type === 'ethernet' && cableMedia !== 'rj45' && cableMedia !== 'sfp' && cableMedia !== 'sfp+' && cableMedia !== 'dac')) {
        issues.push({
          id: `cable-media-mismatch-${cable.id}`,
          severity: 'warning',
          title: 'Cable type may not match port media',
          detail: `${from.name} ↔ ${to.name}: ${cable.type} cable with ${cableMedia} port. Verify transceiver compatibility.`,
          deviceIds: [from.id, to.id],
          cableIds: [cable.id]
        });
      }
    }
  });

  // Dual PSU servers should use PDU A + B split
  const servers = layout.devices.filter((d) => d.category === 'server' && (d.ports?.power ?? 0) >= 2);
  servers.forEach((server) => {
    const powerCables = layout.cables.filter(
      (cable) => cable.type === 'power' && (cable.fromDeviceId === server.id || cable.toDeviceId === server.id)
    );
    if (powerCables.length === 0) return;
    const pduZones = powerCables
      .map((cable) => {
        const pdu = layout.devices.find((d) => isPdu(d) && (d.id === cable.fromDeviceId || d.id === cable.toDeviceId));
        return pdu ? getDeviceSpatialZone(pdu) : null;
      })
      .filter(Boolean) as string[];
    const uniqueZones = Array.from(new Set(pduZones));
    const hasLeft = uniqueZones.includes('side-left');
    const hasRight = uniqueZones.includes('side-right');
    if (!hasLeft || !hasRight) {
      issues.push({
        id: `dual-psu-split-${server.id}`,
        severity: 'warning',
        title: 'Dual PSU server should split across PDU A and B',
        detail: `${server.name} has ${powerCables.length} power cable(s) but they all route to the same PDU side. Connect one PSU to a left-side PDU (Feed A) and the other to a right-side PDU (Feed B).`,
        deviceIds: [server.id]
      });
    }
  });

  // Circuit-level redundancy check for dual-PSU servers
  const redundancyResults = checkPowerRedundancy(layout);
  for (const result of redundancyResults) {
    if (!result.isRedundant) {
      issues.push({
        id: `redundancy-${result.device.id}`,
        severity: 'warning',
        title: 'Independent power feeds are unverified',
        detail: `${result.device.name}: independent A/B supply paths are not confirmed. Check circuit labels, distinct PSU sockets, supply directions and shared upstream equipment. Remaining-feed capacity and UPS battery operation still require verification.`,
        deviceIds: [result.device.id],
        cableIds: result.powerCables.map((c) => c.id),
      });
    }
  }

  // PDU outlet-level validation
  const outletIssues = validatePduOutletAssignments(layout);
  for (const oi of outletIssues) {
    const severity: ValidationIssue['severity'] =
      oi.type === 'duplicate-assignment' || oi.type === 'outlet-overload' ? 'critical' : 'warning';
    const titleMap: Record<string, string> = {
      'unknown-count': 'Power source outlet count unknown',
      'duplicate-assignment': 'Duplicate PDU outlet assignment',
      'unassigned-cable': 'Unassigned PDU power cable',
      'conflicting-assignment': 'Power socket and legacy outlet disagree',
      'outlet-overload': 'PDU outlet index out of range',
      'ab-mismatch': 'Dual-PSU device on same circuit',
    };
    issues.push({
      id: `outlet-${oi.type}-${oi.pduId}-${oi.outletIndex}`,
      severity,
      title: titleMap[oi.type] ?? 'PDU outlet issue',
      detail: oi.detail,
      deviceIds: oi.deviceIds,
      cableIds: oi.cableIds,
    });
  }

  // Serviceability checks
  issues.push(...getServiceabilityIssues(layout));

  return issues;
}

export function getRackTotals(layout: RackLayout, workspace?: Workspace) {
  const devices = layout.devices.filter((d) => !isZeroU(d));
  const depthSummary = getDepthSummary(layout);
  const deepestMm = devices.reduce((max, d) => Math.max(max, d.depthMm), 0);
  const depthIssues = getDepthCompatibilityIssues(layout).length;
  const power = getRackPowerSummary(layout, workspace);

  return {
    weightKg: totalWeight(layout.devices),
    powerW: power.powerW,
    devicePowerW: power.devicePowerW,
    powerInputUnverified: power.powerInputUnverified,
    poeAttributedDevices: power.poeAttributedDevices,
    heatScore: layout.devices.reduce((sum, device) => sum + device.heatLevel * Math.max(1, device.sizeU), 0),
    occupiedU: occupiedUnits(layout.devices, layout.heightU).size,
    reservedU: occupiedUnits(
      (layout.reservations ?? []).map((reservation) => ({
        id: reservation.id,
        positionU: reservation.positionU,
        sizeU: reservation.sizeU
      })) as PlacedDevice[],
      layout.heightU
    ).size,
    usableDepthMm: depthSummary.usableDepthMm,
    deepestMm,
    depthIssues,
  };
}
