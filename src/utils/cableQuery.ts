import type { CableRoute, RackLayout } from '../types/rack';

function portText(port: CableRoute['fromPort']) {
  return port ? `${port.type} ${port.index + 1}` : '';
}

export function matchesCableQuery(cable: CableRoute, layout: Pick<RackLayout, 'devices'>, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const from = layout.devices.find((device) => device.id === cable.fromDeviceId);
  const to = layout.devices.find((device) => device.id === cable.toDeviceId);
  return [cable.id, cable.label, cable.type, cable.notes, from?.name, from?.label, to?.name, to?.label,
    portText(cable.fromPort), portText(cable.toPort)]
    .some((value) => value?.toLowerCase().includes(normalized));
}
