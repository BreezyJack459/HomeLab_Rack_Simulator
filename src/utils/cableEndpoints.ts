import type { PlacedDevice, PortRef, PortType } from '../types/rack';
import { getStoredPortAlias } from './portDocumentation';
import { resolvePortFace } from './portLayout';

export const PORT_TYPE_NAMES: Record<PortType, string> = {
  ethernet: 'LAN', usb: 'USB', hdmi: 'HDMI', power: 'Power', fiber: 'Fiber', atx: 'ATX', coax: 'Coax',
};

export const formatCableEndpoint = (device: PlacedDevice | undefined, port: PortRef | undefined, fallback = 'Unknown device'): string => {
  const name = device?.label?.trim() || device?.name || fallback;
  if (!port) return `${name} · Port not assigned`;
  const alias = device ? getStoredPortAlias(device, port)?.value : undefined;
  const face = device ? resolvePortFace(device, port) : port.side;
  return `${name} · ${alias || `${PORT_TYPE_NAMES[port.type]} ${port.index + 1}`}${face ? ` (${face})` : ''}`;
};
