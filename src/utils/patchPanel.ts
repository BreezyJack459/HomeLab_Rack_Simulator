import type { CableRoute, PlacedDevice, RackLayout } from '../types/rack';

export type PatchPanelJackState = 'empty' | 'landed' | 'patched' | 'dark-patch';

export type PatchPanelJack = {
  index: number;
  panel: PlacedDevice;
  rearCable?: CableRoute;
  frontCable?: CableRoute;
  rearPeer?: PlacedDevice;
  frontPeer?: PlacedDevice;
  state: PatchPanelJackState;
};

function isPatchPanel(device: PlacedDevice): boolean {
  return device.category === 'patch-panel';
}

function patchPanelPortCount(panel: PlacedDevice): number {
  return panel.ports?.ethernet ?? 0;
}

function otherDeviceForCable(layout: RackLayout, cable: CableRoute, deviceId: string): PlacedDevice | undefined {
  const peerId = cable.fromDeviceId === deviceId ? cable.toDeviceId : cable.fromDeviceId;
  return layout.devices.find((device) => device.id === peerId);
}

function patchPanelPortForCable(cable: CableRoute, panelId: string, side: 'front' | 'rear'): number | null {
  if (cable.fromDeviceId === panelId && cable.fromPort?.type === 'ethernet' && cable.fromPort.side === side) {
    return cable.fromPort.index;
  }
  if (cable.toDeviceId === panelId && cable.toPort?.type === 'ethernet' && cable.toPort.side === side) {
    return cable.toPort.index;
  }
  return null;
}

function jackState(frontCable: CableRoute | undefined, rearCable: CableRoute | undefined): PatchPanelJackState {
  if (frontCable && rearCable) return 'patched';
  if (rearCable) return 'landed';
  if (frontCable) return 'dark-patch';
  return 'empty';
}

export function getPatchPanelJacks(layout: RackLayout, panelId: string): PatchPanelJack[] {
  const panel = layout.devices.find((device) => device.id === panelId && isPatchPanel(device));
  if (!panel) return [];

  return Array.from({ length: patchPanelPortCount(panel) }, (_, index): PatchPanelJack => {
    const frontCable = layout.cables.find((cable) => patchPanelPortForCable(cable, panel.id, 'front') === index);
    const rearCable = layout.cables.find((cable) => patchPanelPortForCable(cable, panel.id, 'rear') === index);
    return {
      index,
      panel,
      frontCable,
      rearCable,
      frontPeer: frontCable ? otherDeviceForCable(layout, frontCable, panel.id) : undefined,
      rearPeer: rearCable ? otherDeviceForCable(layout, rearCable, panel.id) : undefined,
      state: jackState(frontCable, rearCable)
    };
  });
}

export function getPatchPanelJackForCable(layout: RackLayout, cable: CableRoute): PatchPanelJack | null {
  const panelEndpoint = [cable.fromDeviceId, cable.toDeviceId]
    .map((deviceId) => layout.devices.find((device) => device.id === deviceId))
    .find((device): device is PlacedDevice => Boolean(device && isPatchPanel(device)));
  if (!panelEndpoint) return null;

  const port = cable.fromDeviceId === panelEndpoint.id ? cable.fromPort : cable.toPort;
  if (!port || port.type !== 'ethernet' || port.side === undefined) return null;
  return getPatchPanelJacks(layout, panelEndpoint.id).find((jack) => jack.index === port.index) ?? null;
}

export function getPatchPanelLinkedCableIds(layout: RackLayout, cableId: string | null | undefined): Set<string> {
  const selectedCable = cableId ? layout.cables.find((cable) => cable.id === cableId) : undefined;
  if (!selectedCable) return new Set();

  const jack = getPatchPanelJackForCable(layout, selectedCable);
  if (!jack) return new Set([selectedCable.id]);

  return new Set(
    [selectedCable.id, jack.rearCable?.id, jack.frontCable?.id]
      .filter((id): id is string => Boolean(id))
  );
}

export function patchPanelJackStatusLabel(jack: PatchPanelJack, side: 'front' | 'rear'): string {
  const number = jack.index + 1;
  if (side === 'front') {
    if (jack.frontCable) return `Jack ${number} front patched`;
    if (jack.rearCable) return `Jack ${number} front open / rear landed`;
    return `Jack ${number} front open`;
  }
  if (jack.rearCable) return `Jack ${number} rear landed`;
  if (jack.frontCable) return `Jack ${number} rear missing / front patched`;
  return `Jack ${number} rear open`;
}

export function patchPanelRouteLabel(layout: RackLayout, cable: CableRoute): string | null {
  const jack = getPatchPanelJackForCable(layout, cable);
  if (!jack) return null;

  const rearName = jack.rearPeer?.name ?? 'no rear home run';
  const frontName = jack.frontPeer?.name ?? 'not patched to switch';
  return `Jack ${jack.index + 1}: rear ${rearName} -> front ${frontName}`;
}
