import type { CableRoute, PlacedDevice, RackLayout } from '../types/rack';
import { getPortConnectionSpec } from './connectorCompatibility';
import { buildPowerTopology } from './powerChain';

/** Resolve the actual source socket even when the cable was picked in reverse. */
export const upsOutletBackup = (source: PlacedDevice, cable: CableRoute) => {
  const port = cable.fromDeviceId === source.id ? cable.fromPort : cable.toPort;
  if (!port || port.type !== 'power') return undefined;
  return getPortConnectionSpec(source, port)?.upsBackup;
};

/** Retain normal utility wiring separately: surge-only outlets still carry normal load. */
export const batterySupplyLayout = (layout: RackLayout) => {
  const topology = buildPowerTopology(layout);
  const removed = new Set<string>();
  const unknowns: { sourceId: string; cableId: string; detail: string }[] = [];
  for (const edge of topology.edges) {
    const source = topology.devices.get(edge.sourceId)!;
    if (source.category !== 'ups') continue;
    const backup = upsOutletBackup(source, edge.cable);
    if (backup !== 'battery') removed.add(edge.cable.id);
    if (backup === undefined) unknowns.push({ sourceId: source.id, cableId: edge.cable.id,
      detail: `${source.name}: battery backup for cable ${edge.cable.label ?? edge.cable.id} is unknown. Record the exact UPS output socket and its backup type in Socket specifications.` });
  }
  return { layout: { ...layout, cables: layout.cables.filter(c => !removed.has(c.id)) }, unknowns };
};
