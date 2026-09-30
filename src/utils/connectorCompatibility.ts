import type { CableRoute, PlacedDevice, PortConnectionSpec, PortRef, RackLayout, ValidationIssue } from '../types/rack';
import { resolvePortFace } from './portLayout';

export const portSpecificationKey = (device: PlacedDevice, port: PortRef): string =>
  `${port.type}:${resolvePortFace(device, port)}:${port.index}`;
export const getPortConnectionSpec = (device: PlacedDevice, port?: PortRef): PortConnectionSpec | undefined =>
  port ? device.portConnectionSpecs?.[portSpecificationKey(device, port)] : undefined;

export type ConnectorCompatibility = {
  status: 'conflict' | 'unverified' | 'recorded-match';
  conflicts: string[];
  unknowns: string[];
  supplyDeviceId?: string;
};
const normalized = (text: string | undefined) => text?.trim().toLowerCase();

/** Recorded socket and cable-end constraints, not certification of the actual hardware. */
export const checkConnectorCompatibility = (layout: RackLayout, cable: CableRoute): ConnectorCompatibility => {
  const from = layout.devices.find(d => d.id === cable.fromDeviceId);
  const to = layout.devices.find(d => d.id === cable.toDeviceId);
  const conflicts: string[] = [];
  const unknowns: string[] = [];
  if (!from || !to || !cable.fromPort || !cable.toPort) return {
    status: 'unverified', conflicts, unknowns: ['Assign both physical sockets before checking connectors.'],
  };
  const a = getPortConnectionSpec(from, cable.fromPort);
  const b = getPortConnectionSpec(to, cable.toPort);
  for (const [name, spec, fit] of [[from.name, a, cable.socketFit?.from], [to.name, b, cable.socketFit?.to]] as const) {
    if (!spec?.connector?.trim()) unknowns.push(`${name}: socket connector is unspecified.`);
    if (!fit?.trim()) unknowns.push(`${name}: the connector this cable end fits is unspecified.`);
    if (spec?.connector?.trim() && fit?.trim() && normalized(spec.connector) !== normalized(fit)) {
      conflicts.push(`${name}: cable end is recorded for ${fit}, but the socket is ${spec.connector}. Check the cable or adapter.`);
    }
  }
  const aRole = a?.role ?? 'unknown';
  const bRole = b?.role ?? 'unknown';
  if (aRole === 'unknown' || bRole === 'unknown') unknowns.push('Socket input/output roles are not fully recorded.');
  if (aRole === bRole && (aRole === 'input' || aRole === 'output')) conflicts.push(`Both sockets are ${aRole}s; a direct connection has no matching input/output pair.`);
  const supplyDeviceId = aRole === 'output' && bRole === 'input' ? from.id : bRole === 'output' && aRole === 'input' ? to.id : undefined;
  if (cable.type === 'power') {
    if (!supplyDeviceId) unknowns.push('Power direction requires one recorded output and one input.');
    if (supplyDeviceId && cable.powerSourceDeviceId && cable.powerSourceDeviceId !== supplyDeviceId) conflicts.push('Selected upstream supply contradicts the recorded socket roles.');
    if (!a?.powerKind || !b?.powerKind) unknowns.push('AC/DC supply kind is not fully recorded.');
    else if (a.powerKind !== b.powerKind) conflicts.push('AC and DC sockets require a suitable converter; a direct power cable is not compatible.');
    if (a?.nominalVoltageV === undefined || b?.nominalVoltageV === undefined) unknowns.push('Operating voltage is not fully recorded.');
    else if (a.nominalVoltageV !== b.nominalVoltageV) conflicts.push(`Recorded operating voltages differ (${a.nominalVoltageV} V / ${b.nominalVoltageV} V). Verify input range or conversion before connection.`);
    if (a?.powerKind === 'dc' || b?.powerKind === 'dc') {
      if (!a?.polarity || !b?.polarity) unknowns.push('DC polarity/pinout is not fully recorded.');
      else if (normalized(a.polarity) !== normalized(b.polarity)) conflicts.push('Recorded DC polarity/pinout differs.');
    }
  }
  return { status: conflicts.length ? 'conflict' : unknowns.length ? 'unverified' : 'recorded-match', conflicts, unknowns, supplyDeviceId };
};

export const getConnectorIssues = (layout: RackLayout): ValidationIssue[] => layout.cables.flatMap(cable => {
  const result = checkConnectorCompatibility(layout, cable);
  if (result.status === 'recorded-match') return [];
  return [{ id: `connector-${cable.id}`, severity: result.status === 'conflict' ? 'warning' as const : 'info' as const,
    evidence: result.status === 'unverified' ? 'unverified' as const : undefined,
    title: result.status === 'conflict' ? 'Recorded connector constraints conflict' : 'Connector compatibility is unverified',
    detail: [...result.conflicts, ...result.unknowns].join(' '), cableIds: [cable.id], deviceIds: [cable.fromDeviceId, cable.toDeviceId] }];
});
