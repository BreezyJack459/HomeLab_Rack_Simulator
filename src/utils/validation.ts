import type { PlacedDevice, RackLayout, ValidationIssue } from '../types/rack';
import { getPatchPanelJacks } from './patchPanel';
import { calculateCablePlan, isPdu } from './routing';
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
  rangesOverlap,
  isZeroU
} from './rackMath';
import { getCircuitLoads, checkPowerRedundancy, getDeviceCapacityW } from './powerChain';
import { getServiceabilityIssues } from './serviceability';

function totalWeight(devices: PlacedDevice[]) {
  return devices.reduce((sum, device) => sum + device.weightKg, 0);
}

function totalPower(devices: PlacedDevice[]) {
  return devices.reduce((sum, device) => sum + device.powerW, 0);
}

function isShelfSupport(device: PlacedDevice) {
  return device.category === 'shelf';
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

export function validateRackLayout(layout: RackLayout): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const rackSpec = RACK_SPECS[layout.rackType];
  const occupiedBySide = {
    front: occupiedUnits(layout.devices.filter((device) => getDeviceMountSide(device) === 'front' && blocksAirflow(device)), layout.heightU),
    rear: occupiedUnits(layout.devices.filter((device) => getDeviceMountSide(device) === 'rear' && blocksAirflow(device)), layout.heightU)
  };

  // Per-device checks stay independent so imported JSON can be audited even if editing prevented the same issue.
  layout.devices.forEach((device) => {
    if (!isZeroU(device) && !isDeviceWithinRack(layout, device)) {
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

    if (!isZeroU(device) && hasOverlap(layout, layout.devices, device)) {
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

    if (device.depthMm > layout.rackDepthMm) {
      issues.push({
        id: `depth-${device.id}`,
        severity: 'warning',
        title: `${device.name} may be too deep`,
        detail: `${device.depthMm}mm device depth exceeds the configured ${layout.rackDepthMm}mm rack depth.`,
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

    if (device.widthType === 'shelf' && !isZeroU(device)) {
      const hasNearbyShelf = layout.devices.some((shelf) => {
        if (!isShelfSupport(shelf)) return false;
        if (getDeviceMountSide(shelf) !== getDeviceMountSide(device)) return false;
        const shelfX = getDeviceXRange(layout, shelf);
        const deviceX = getDeviceXRange(layout, device);
        return (
          rangesOverlap(shelf.positionU, shelf.sizeU, Math.max(1, device.positionU - 1), device.sizeU + 1) &&
          rangesOverlap(shelfX.x, shelfX.width, deviceX.x, deviceX.width)
        );
      });
      if (!hasNearbyShelf) {
        issues.push({
          id: `shelf-${device.id}`,
          severity: 'info',
          title: `${device.name} needs shelf support`,
          detail: 'Shelf-mounted devices should sit on or directly above a shelf component in the plan.',
          deviceIds: [device.id]
        });
      }
    }
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

  const power = totalPower(layout.devices);
  if (power > layout.powerBudgetW) {
    issues.push({
      id: 'power-limit',
      severity: 'critical',
      title: 'Power budget exceeded',
      detail: `Estimated usage is ${power}W, above the configured ${layout.powerBudgetW}W budget.`
    });
  } else if (power > layout.powerBudgetW * 0.8) {
    issues.push({
      id: 'power-near-limit',
      severity: 'warning',
      title: 'Power usage is near the budget',
      detail: `Estimated usage is ${power}W, over 80% of the configured budget.`
    });
  }

  // Per-circuit safe breaker utilization
  const circuitLoads = getCircuitLoads(layout);
  for (const cl of circuitLoads) {
    const totalCapacity = cl.sources.reduce((sum, s) => sum + (getDeviceCapacityW(s) ?? 0), 0);
    if (totalCapacity > 0 && cl.totalW > totalCapacity * 0.8) {
      issues.push({
        id: `circuit-overload-${cl.circuit}`,
        severity: 'warning',
        title: `Circuit ${cl.circuit} load exceeds safe breaker utilization`,
        detail: `Circuit ${cl.circuit} load is ${cl.totalW}W, over 80% of ${totalCapacity}W total source capacity. Consider adding more capacity or moving devices to the other circuit.`,
        deviceIds: cl.sources.map((s) => s.id),
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

    // 1. Endpoint → switch direct connection ban
    if ((fromIsEndpoint && toIsSwitch) || (fromIsSwitch && toIsEndpoint)) {
      issues.push({
        id: `endpoint-switch-direct-${cable.id}`,
        severity: 'critical',
        title: 'Endpoint connected directly to switch',
        detail: `${from.name} → ${to.name}: endpoints must connect to patch panel rear ports; switches must connect to patch panel front ports.`,
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
      if (!hasPatchPanel) {
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
        title: 'Redundant power feeds share the same circuit',
        detail: `${result.device.name} has ${result.powerCables.length} power cable(s) but they all trace back to Circuit ${result.circuits[0] ?? 'unassigned'}. For true redundancy, connect each PSU to a different circuit (A and B).`,
        deviceIds: [result.device.id],
        cableIds: result.powerCables.map((c) => c.id),
      });
    }
  }

  // Serviceability checks
  issues.push(...getServiceabilityIssues(layout));

  return issues;
}

export function getRackTotals(layout: RackLayout) {
  const devices = layout.devices.filter((d) => !isZeroU(d));
  const rearClearanceMm = layout.rearClearanceMm ?? 0;
  const railMinDepthMm = layout.railMinDepthMm ?? 0;
  const railMaxDepthMm = layout.railMaxDepthMm ?? layout.rackDepthMm;
  const usableDepth = Math.max(0, layout.rackDepthMm - rearClearanceMm);
  const deepestMm = devices.reduce((max, d) => Math.max(max, d.depthMm), 0);
  const tooDeep = devices.filter((d) => d.depthMm > usableDepth).length;
  const tooShallow = devices.filter((d) => d.depthMm < railMinDepthMm).length;
  const tooDeepForRails = devices.filter((d) => d.depthMm > railMaxDepthMm).length;

  return {
    weightKg: totalWeight(layout.devices),
    powerW: totalPower(layout.devices),
    heatScore: layout.devices.reduce((sum, device) => sum + device.heatLevel * Math.max(1, device.sizeU), 0),
    occupiedU: occupiedUnits(layout.devices, layout.heightU).size,
    usableDepthMm: usableDepth,
    deepestMm,
    depthIssues: tooDeep + tooShallow + tooDeepForRails,
  };
}
