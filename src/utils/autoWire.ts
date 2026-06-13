import type { CableRoute, PlacedDevice, RackLayout } from '../types/rack';
import { autoResolveCable, inferCableType } from './portSelection';

export interface AutoWireOptions {
  connectPower?: boolean;
  connectNetwork?: boolean;
}

export interface AutoWireResult {
  cables: Omit<CableRoute, 'id'>[];
  created: number;
  skipped: number;
}

const INFRA_CATEGORIES = new Set([
  'pdu',
  'ups',
  'switch',
  'patch-panel',
  'cable-management',
  'blank'
]);

function isInfrastructure(device: PlacedDevice): boolean {
  return INFRA_CATEGORIES.has(device.category);
}

function deviceCenterU(device: PlacedDevice): number {
  return device.positionU + (device.sizeU - 1) / 2;
}

function nearestDevice(
  source: PlacedDevice,
  candidates: PlacedDevice[]
): PlacedDevice | null {
  if (candidates.length === 0) return null;
  const sourceU = deviceCenterU(source);
  return candidates.reduce((best, current) => {
    const bestDist = Math.abs(deviceCenterU(best) - sourceU);
    const currentDist = Math.abs(deviceCenterU(current) - sourceU);
    return currentDist < bestDist ? current : best;
  });
}

function hasExistingCable(
  layout: RackLayout,
  fromId: string,
  toId: string,
  cableType: string
): boolean {
  return layout.cables.some(
    (c) =>
      ((c.fromDeviceId === fromId && c.toDeviceId === toId) ||
        (c.fromDeviceId === toId && c.toDeviceId === fromId)) &&
      c.type === cableType
  );
}

export function autoWireLayout(
  layout: RackLayout,
  options: AutoWireOptions = {}
): AutoWireResult {
  const { connectPower = true, connectNetwork = true } = options;
  const cables: Omit<CableRoute, 'id'>[] = [];
  let skipped = 0;

  const pdus = layout.devices.filter((d) => d.category === 'pdu');
  const switches = layout.devices.filter((d) => d.category === 'switch');
  const patchPanels = layout.devices.filter((d) => d.category === 'patch-panel');
  const endpoints = layout.devices.filter((d) => !isInfrastructure(d));

  for (const endpoint of endpoints) {
    if (connectPower && pdus.length > 0 && (endpoint.ports?.power ?? 0) > 0) {
      const target = nearestDevice(endpoint, pdus);
      if (target) {
        if (hasExistingCable(layout, endpoint.id, target.id, 'power')) {
          skipped++;
        } else {
          const resolved = autoResolveCable(endpoint, target, layout);
          if (resolved && resolved.cableType === 'power') {
            cables.push({
              fromDeviceId: endpoint.id,
              fromPort: resolved.fromPort,
              toDeviceId: target.id,
              toPort: resolved.toPort,
              type: resolved.cableType,
              color: resolved.color
            });
          } else {
            skipped++;
          }
        }
      }
    }

    if (
      connectNetwork &&
      (endpoint.ports?.ethernet ?? 0) + (endpoint.ports?.fiber ?? 0) > 0
    ) {
      const targets = switches.length > 0 ? switches : patchPanels;
      if (targets.length > 0) {
        const target = nearestDevice(endpoint, targets);
        if (target) {
          const cableType = inferCableType(endpoint, target);
          if (
            !cableType ||
            hasExistingCable(layout, endpoint.id, target.id, cableType)
          ) {
            skipped++;
          } else {
            const resolved = autoResolveCable(endpoint, target, layout);
            if (resolved) {
              cables.push({
                fromDeviceId: endpoint.id,
                fromPort: resolved.fromPort,
                toDeviceId: target.id,
                toPort: resolved.toPort,
                type: resolved.cableType,
                color: resolved.color
              });
            } else {
              skipped++;
            }
          }
        }
      }
    }
  }

  if (connectNetwork && patchPanels.length > 0) {
    for (const sw of switches) {
      if ((sw.ports?.ethernet ?? 0) + (sw.ports?.fiber ?? 0) === 0) continue;
      const target = nearestDevice(sw, patchPanels);
      if (!target) continue;
      const cableType = inferCableType(sw, target);
      if (
        !cableType ||
        hasExistingCable(layout, sw.id, target.id, cableType)
      ) {
        skipped++;
        continue;
      }
      const resolved = autoResolveCable(sw, target, layout);
      if (resolved) {
        cables.push({
          fromDeviceId: sw.id,
          fromPort: resolved.fromPort,
          toDeviceId: target.id,
          toPort: resolved.toPort,
          type: resolved.cableType,
          color: resolved.color
        });
      } else {
        skipped++;
      }
    }
  }

  return { cables, created: cables.length, skipped };
}
