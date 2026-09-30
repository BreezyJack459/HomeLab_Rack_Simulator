import type { PlacedDevice, PortRef, Workspace } from '../types/rack';
import { getPortConnectionSpec } from './connectorCompatibility';

const ownInputs = (device: PlacedDevice) => [device.powerW, device.powerBasis, device.powerPlanningNote,
  device.poeInputMode, device.poeEfficiencyPct, device.poeBudgetW,
  Object.entries(device.portConnectionSpecs ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([key, spec]) =>
    [key, Object.entries(spec).sort(([a], [b]) => a.localeCompare(b))])];

const reviewInputs = (workspace: Workspace, rackId: string, device: PlacedDevice) => {
  const endpoint = (rack: string, id: string, port?: PortRef) => {
    const d = workspace.racks.find(r => r.id === rack)?.devices.find(item => item.id === id);
    const spec = d ? getPortConnectionSpec(d, port) : undefined;
    return [rack, id, port?.type, port?.index, port?.side, d?.powerW,
      spec ? Object.entries(spec).sort(([a], [b]) => a.localeCompare(b)) : null];
  };
  const links: string[] = [];
  for (const rack of workspace.racks) for (const cable of rack.cables) {
    if (cable.poe && rack.id === rackId && [cable.fromDeviceId, cable.toDeviceId].includes(device.id)) {
      links.push(JSON.stringify([cable.type, endpoint(rack.id, cable.fromDeviceId, cable.fromPort), endpoint(rack.id, cable.toDeviceId, cable.toPort), cable.socketFit]));
    }
  }
  for (const cable of workspace.interRackCables) {
    if (cable.poe && ((cable.fromRackId === rackId && cable.fromDeviceId === device.id) || (cable.toRackId === rackId && cable.toDeviceId === device.id))) {
      links.push(JSON.stringify([cable.type, endpoint(cable.fromRackId, cable.fromDeviceId, cable.fromPort), endpoint(cable.toRackId, cable.toDeviceId, cable.toPort), cable.socketFit]));
    }
  }
  return JSON.stringify([ownInputs(device), links.sort()]);
};

/** Invalidate only existing reviewed records whose electrical inputs changed. Imports/undo decide separately. */
export function invalidateChangedPowerReviews(previous: Workspace, next: Workspace): Workspace {
  let changed = false;
  const racks = next.racks.map(rack => {
    const oldRack = previous.racks.find(r => r.id === rack.id);
    let rackChanged = false;
    const devices = rack.devices.map(device => {
      if (!device.powerReviewed) return device;
      const old = oldRack?.devices.find(d => d.id === device.id);
      if (!old || reviewInputs(previous, rack.id, old) === reviewInputs(next, rack.id, device)) return device;
      changed = rackChanged = true;
      return { ...device, powerReviewed: false };
    });
    return rackChanged ? { ...rack, devices } : rack;
  });
  return changed ? { ...next, racks } : next;
}
