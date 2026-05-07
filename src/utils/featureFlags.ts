import type { CableRoute, DeviceCategory, PlacedDevice, RackLayout } from '../types/rack';

export const ENABLE_ZERO_U_PDU = false;

export const isZeroUPduCategory = (category: DeviceCategory | string | undefined) =>
  category === 'pdu-0u';

export const shouldHideDevice = (device: Pick<PlacedDevice, 'category'>) =>
  !ENABLE_ZERO_U_PDU && isZeroUPduCategory(device.category);

export const layoutUsesHiddenZeroUPdu = (layout: Pick<RackLayout, 'devices'>) =>
  layout.devices.some((device) => shouldHideDevice(device));

export function withoutHiddenZeroUPdu(layout: RackLayout): RackLayout {
  if (ENABLE_ZERO_U_PDU) return layout;

  const hiddenIds = new Set(
    layout.devices
      .filter((device) => shouldHideDevice(device))
      .map((device) => device.id)
  );

  if (hiddenIds.size === 0) return layout;

  const keepCable = (cable: CableRoute) =>
    !hiddenIds.has(cable.fromDeviceId) && !hiddenIds.has(cable.toDeviceId);

  return {
    ...layout,
    devices: layout.devices.filter((device) => !hiddenIds.has(device.id)),
    cables: (layout.cables ?? []).filter(keepCable)
  };
}
