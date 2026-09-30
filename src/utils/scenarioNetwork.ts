import type { RackLayout } from '../types/rack';

const networkTypes = new Set(['ethernet', 'fiber', 'patch', 'structured']);
const forwardingCategories = new Set(['switch', 'router', 'firewall', 'modem', 'patch-panel', 'poe-injector']);

/** Physical link candidates only: no VLAN, routing protocol or patch-jack continuity claim. */
export function assessSwitchRemoval(layout: RackLayout, removedId: string) {
  const devices = new Map(layout.devices.map(d => [d.id, d]));
  const links = layout.cables.filter(c => networkTypes.has(c.type) && devices.has(c.fromDeviceId) && devices.has(c.toDeviceId));
  const adjacent = new Set(links.flatMap(c => c.fromDeviceId === removedId ? [c.toDeviceId] : c.toDeviceId === removedId ? [c.fromDeviceId] : []));
  const gateways = layout.devices.filter(d => ['router', 'firewall', 'modem'].includes(d.category)).map(d => d.id);
  const reached = (removed: boolean) => {
    const seen = new Set<string>();
    const queue = [...gateways];
    while (queue.length) {
      const id = queue.pop()!;
      if (seen.has(id) || (removed && id === removedId)) continue;
      seen.add(id);
      // An endpoint with two NICs is not assumed to forward other devices' traffic.
      if (!forwardingCategories.has(devices.get(id)!.category)) continue;
      for (const link of links) {
        if (link.fromDeviceId === id) queue.push(link.toDeviceId);
        else if (link.toDeviceId === id) queue.push(link.fromDeviceId);
      }
    }
    return seen;
  };
  const before = reached(false);
  const after = reached(true);
  return { adjacent, before, after, hasGateway: gateways.length > 0, linkCount: links.filter(c => c.fromDeviceId === removedId || c.toDeviceId === removedId).length };
}

/** Boot ordering is a restart dependency, not evidence that a running service stops. */
export function bootDependents(layout: RackLayout, failedId: string): Set<string> {
  const reached = new Set([failedId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const device of layout.devices) {
      if (!reached.has(device.id) && device.bootDependsOn?.some(id => reached.has(id))) {
        reached.add(device.id);
        changed = true;
      }
    }
  }
  reached.delete(failedId);
  return reached;
}
