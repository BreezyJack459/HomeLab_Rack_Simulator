import type { CableRoute, DeviceCategory, PlacedDevice, RackLayout } from '../types/rack';

export const ENABLE_ZERO_U_PDU = true;

// Phase-1 shell redesign (single top bar + canvas header). Default ON after
// desktop/tablet QA. Set localStorage "rack-simulator-new-shell" = "0" and
// reload to fall back to the classic chrome while shared/plugin-owned actions
// continue using the current contribution model.
export const NEW_SHELL =
  typeof localStorage === "undefined" ||
  localStorage.getItem("rack-simulator-new-shell") !== "0";

export const isZeroUPduCategory = (category: DeviceCategory | string | undefined) =>
  category === 'pdu-0u';

export const shouldHideDevice = (device: Pick<PlacedDevice, 'category'>) =>
  !ENABLE_ZERO_U_PDU && isZeroUPduCategory(device.category);

export const layoutUsesHiddenZeroUPdu = (layout: Pick<RackLayout, 'devices'>) =>
  layout.devices.some((device) => shouldHideDevice(device));

/** Display-only projection. Never normalize, persist or export this projection. */
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
