import type { CableRoute, PlacedDevice, RackLayout } from '../types/rack';

export type ChangeClass = 'added' | 'removed' | 'moved' | 'rewired' | 'repowered' | 'renamed' | 'resized' | 'property-changed';

export interface DeviceChange {
  type: 'device';
  class: ChangeClass;
  deviceId: string;
  name: string;
  before?: Partial<PlacedDevice>;
  after?: Partial<PlacedDevice>;
  fieldsChanged?: string[];
}

export interface CableChange {
  type: 'cable';
  class: ChangeClass;
  cableId: string;
  before?: Partial<CableRoute>;
  after?: Partial<CableRoute>;
  fieldsChanged?: string[];
}

export interface LayoutPropertyChange {
  type: 'layout-property';
  property: string;
  before: unknown;
  after: unknown;
}

export type LayoutChange = DeviceChange | CableChange | LayoutPropertyChange;

export interface LayoutDiff {
  changes: LayoutChange[];
  deviceChanges: DeviceChange[];
  cableChanges: CableChange[];
  layoutPropertyChanges: LayoutPropertyChange[];
  addedDevices: DeviceChange[];
  removedDevices: DeviceChange[];
  movedDevices: DeviceChange[];
  renamedDevices: DeviceChange[];
  resizedDevices: DeviceChange[];
  addedCables: CableChange[];
  removedCables: CableChange[];
  rewiredCables: CableChange[];
}

function deviceSignature(d: PlacedDevice): string {
  return `${d.positionU}:${d.xMm ?? 0}:${d.sizeU}:${d.mountSide ?? 'front'}`;
}

function cableSignature(c: CableRoute): string {
  return `${c.fromDeviceId}:${c.fromPort?.type ?? 'none'}:${c.fromPort?.index ?? -1}:${c.toDeviceId}:${c.toPort?.type ?? 'none'}:${c.toPort?.index ?? -1}`;
}

function pickDeviceFields(d: PlacedDevice): Partial<PlacedDevice> {
  return {
    name: d.name,
    positionU: d.positionU,
    xMm: d.xMm,
    sizeU: d.sizeU,
    mountSide: d.mountSide,
    depthMm: d.depthMm,
    powerW: d.powerW,
    weightKg: d.weightKg,
    color: d.color,
    label: d.label,
    lifecycleStatus: d.lifecycleStatus,
    circuit: d.circuit,
  };
}

function pickCableFields(c: CableRoute): Partial<CableRoute> {
  return {
    fromDeviceId: c.fromDeviceId,
    fromPort: c.fromPort,
    toDeviceId: c.toDeviceId,
    toPort: c.toPort,
    type: c.type,
    color: c.color,
    lengthMm: c.lengthMm,
    bundleId: c.bundleId,
  };
}

function diffObjects<T extends Record<string, unknown>>(before: T, after: T): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed.push(key);
    }
  }
  return changed;
}

export function diffLayouts(before: RackLayout, after: RackLayout): LayoutDiff {
  const changes: LayoutChange[] = [];

  const beforeDevices = new Map(before.devices.map((d) => [d.id, d]));
  const afterDevices = new Map(after.devices.map((d) => [d.id, d]));

  const beforeCables = new Map(before.cables.map((c) => [c.id, c]));
  const afterCables = new Map(after.cables.map((c) => [c.id, c]));

  // Devices
  for (const [id, afterDev] of afterDevices) {
    const beforeDev = beforeDevices.get(id);
    if (!beforeDev) {
      const change: DeviceChange = {
        type: 'device',
        class: 'added',
        deviceId: id,
        name: afterDev.name,
        after: pickDeviceFields(afterDev),
      };
      changes.push(change);
    } else {
      const beforeSig = deviceSignature(beforeDev);
      const afterSig = deviceSignature(afterDev);
      const fields = diffObjects(pickDeviceFields(beforeDev), pickDeviceFields(afterDev));

      if (fields.length > 0) {
        let cls: ChangeClass = 'property-changed';
        if (beforeDev.name !== afterDev.name) cls = 'renamed';
        if (beforeDev.positionU !== afterDev.positionU || beforeDev.xMm !== afterDev.xMm || beforeDev.mountSide !== afterDev.mountSide) {
          cls = 'moved';
        }
        if (beforeDev.sizeU !== afterDev.sizeU) cls = 'resized';
        if (beforeDev.powerW !== afterDev.powerW || beforeDev.circuit !== afterDev.circuit) {
          cls = 'repowered';
        }

        const change: DeviceChange = {
          type: 'device',
          class: cls,
          deviceId: id,
          name: afterDev.name,
          before: pickDeviceFields(beforeDev),
          after: pickDeviceFields(afterDev),
          fieldsChanged: fields,
        };
        changes.push(change);
      }
    }
  }

  for (const [id, beforeDev] of beforeDevices) {
    if (!afterDevices.has(id)) {
      const change: DeviceChange = {
        type: 'device',
        class: 'removed',
        deviceId: id,
        name: beforeDev.name,
        before: pickDeviceFields(beforeDev),
      };
      changes.push(change);
    }
  }

  // Cables
  for (const [id, afterCable] of afterCables) {
    const beforeCable = beforeCables.get(id);
    if (!beforeCable) {
      const change: CableChange = {
        type: 'cable',
        class: 'added',
        cableId: id,
        after: pickCableFields(afterCable),
      };
      changes.push(change);
    } else {
      const beforeSig = cableSignature(beforeCable);
      const afterSig = cableSignature(afterCable);
      const fields = diffObjects(pickCableFields(beforeCable), pickCableFields(afterCable));

      if (fields.length > 0) {
        const cls: ChangeClass = beforeSig !== afterSig ? 'rewired' : 'property-changed';
        const change: CableChange = {
          type: 'cable',
          class: cls,
          cableId: id,
          before: pickCableFields(beforeCable),
          after: pickCableFields(afterCable),
          fieldsChanged: fields,
        };
        changes.push(change);
      }
    }
  }

  for (const [id, beforeCable] of beforeCables) {
    if (!afterCables.has(id)) {
      const change: CableChange = {
        type: 'cable',
        class: 'removed',
        cableId: id,
        before: pickCableFields(beforeCable),
      };
      changes.push(change);
    }
  }

  // Layout properties
  const layoutProps: (keyof RackLayout)[] = [
    'name',
    'rackType',
    'heightU',
    'rackDepthMm',
    'weightLimitKg',
    'powerBudgetW',
    'rearClearanceMm',
  ];
  for (const prop of layoutProps) {
    if (JSON.stringify(before[prop]) !== JSON.stringify(after[prop])) {
      const change: LayoutPropertyChange = {
        type: 'layout-property',
        property: prop,
        before: before[prop],
        after: after[prop],
      };
      changes.push(change);
    }
  }

  const deviceChanges = changes.filter((c): c is DeviceChange => c.type === 'device');
  const cableChanges = changes.filter((c): c is CableChange => c.type === 'cable');
  const layoutPropertyChanges = changes.filter((c): c is LayoutPropertyChange => c.type === 'layout-property');

  return {
    changes,
    deviceChanges,
    cableChanges,
    layoutPropertyChanges,
    addedDevices: deviceChanges.filter((c) => c.class === 'added'),
    removedDevices: deviceChanges.filter((c) => c.class === 'removed'),
    movedDevices: deviceChanges.filter((c) => c.class === 'moved'),
    renamedDevices: deviceChanges.filter((c) => c.class === 'renamed'),
    resizedDevices: deviceChanges.filter((c) => c.class === 'resized'),
    addedCables: cableChanges.filter((c) => c.class === 'added'),
    removedCables: cableChanges.filter((c) => c.class === 'removed'),
    rewiredCables: cableChanges.filter((c) => c.class === 'rewired'),
  };
}
