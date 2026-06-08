import type { CableRoute, LifecycleStatus, LifecycleViewFilter, PlacedDevice, RackLayout } from '../types/rack';

export interface MigrationSummary {
  plannedDevices: PlacedDevice[];
  activeDevices: PlacedDevice[];
  decommissioningDevices: PlacedDevice[];
  plannedCables: CableRoute[];
  activeCables: CableRoute[];
  decommissioningCables: CableRoute[];
}

export function getLifecycleStatus(status?: LifecycleStatus): LifecycleStatus {
  return status ?? 'active';
}

export function getMigrationSummary(layout: RackLayout): MigrationSummary {
  return {
    plannedDevices: layout.devices.filter((d) => getLifecycleStatus(d.lifecycleStatus) === 'planned'),
    activeDevices: layout.devices.filter((d) => getLifecycleStatus(d.lifecycleStatus) === 'active'),
    decommissioningDevices: layout.devices.filter((d) => getLifecycleStatus(d.lifecycleStatus) === 'decommissioning'),
    plannedCables: layout.cables.filter((c) => getLifecycleStatus(c.lifecycleStatus) === 'planned'),
    activeCables: layout.cables.filter((c) => getLifecycleStatus(c.lifecycleStatus) === 'active'),
    decommissioningCables: layout.cables.filter((c) => getLifecycleStatus(c.lifecycleStatus) === 'decommissioning'),
  };
}

export function lifecycleMatchesFilter(status: LifecycleStatus | undefined, filter: LifecycleViewFilter) {
  const resolved = getLifecycleStatus(status);
  if (filter === 'all') return true;
  if (filter === 'changes') return resolved !== 'active';
  return resolved === filter;
}

export function getFilteredLayoutByLifecycle(layout: RackLayout, filter: LifecycleViewFilter): RackLayout {
  if (filter === 'all') return layout;

  const visibleDeviceIds = new Set(
    layout.devices.filter((device) => lifecycleMatchesFilter(device.lifecycleStatus, filter)).map((device) => device.id)
  );

  return {
    ...layout,
    devices: layout.devices.filter((device) => visibleDeviceIds.has(device.id)),
    cables: layout.cables.filter(
      (cable) =>
        lifecycleMatchesFilter(cable.lifecycleStatus, filter)
        && visibleDeviceIds.has(cable.fromDeviceId)
        && visibleDeviceIds.has(cable.toDeviceId)
    ),
  };
}
