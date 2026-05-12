import type { RackLayout, PlacedDevice, CableRoute } from '../types/rack';

export interface MigrationSummary {
  plannedDevices: PlacedDevice[];
  activeDevices: PlacedDevice[];
  decommissioningDevices: PlacedDevice[];
  plannedCables: CableRoute[];
  activeCables: CableRoute[];
  decommissioningCables: CableRoute[];
}

export function getMigrationSummary(layout: RackLayout): MigrationSummary {
  return {
    plannedDevices: layout.devices.filter((d) => d.lifecycleStatus === 'planned'),
    activeDevices: layout.devices.filter((d) => !d.lifecycleStatus || d.lifecycleStatus === 'active'),
    decommissioningDevices: layout.devices.filter((d) => d.lifecycleStatus === 'decommissioning'),
    plannedCables: layout.cables.filter((c) => c.lifecycleStatus === 'planned'),
    activeCables: layout.cables.filter((c) => !c.lifecycleStatus || c.lifecycleStatus === 'active'),
    decommissioningCables: layout.cables.filter((c) => c.lifecycleStatus === 'decommissioning'),
  };
}
