import type { CableRoute, PlacedDevice, RackLayout } from '../types/rack';
import { getPatchPanelJackForCable } from './patchPanel';

export interface CableTraceHop {
  cable: CableRoute;
  fromDevice: PlacedDevice;
  toDevice: PlacedDevice;
  panelJack?: {
    panel: PlacedDevice;
    index: number;
    entrySide: 'front' | 'rear';
    exitSide: 'front' | 'rear';
  };
}

export interface CableTraceResult {
  startDevice: PlacedDevice;
  endDevice: PlacedDevice;
  hops: CableTraceHop[];
  complete: boolean;
  brokenReason?: string;
}

function isPatchPanel(device: PlacedDevice): boolean {
  return device.category === 'patch-panel';
}

function findDevice(layout: RackLayout, deviceId: string): PlacedDevice | undefined {
  return layout.devices.find((d) => d.id === deviceId);
}

function traceOneSide(
  layout: RackLayout,
  startCable: CableRoute,
  comingFromId: string
): { hops: CableTraceHop[]; terminal: PlacedDevice | null; complete: boolean; brokenReason?: string } {
  const hops: CableTraceHop[] = [];
  let currentCable = startCable;
  let currentFromId = comingFromId;
  const visited = new Set<string>();

  while (true) {
    if (visited.has(currentCable.id)) {
      return { hops, terminal: null, complete: false, brokenReason: 'Circular reference detected' };
    }
    visited.add(currentCable.id);

    const fromDev = findDevice(layout, currentFromId);
    if (!fromDev) {
      return { hops, terminal: null, complete: false, brokenReason: 'Missing device in layout' };
    }

    const toDevId = currentCable.fromDeviceId === currentFromId ? currentCable.toDeviceId : currentCable.fromDeviceId;
    const toDev = findDevice(layout, toDevId);
    if (!toDev) {
      return { hops, terminal: null, complete: false, brokenReason: 'Missing device in layout' };
    }

    if (!isPatchPanel(toDev)) {
      hops.push({ cable: currentCable, fromDevice: fromDev, toDevice: toDev });
      return { hops, terminal: toDev, complete: true };
    }

    const jack = getPatchPanelJackForCable(layout, currentCable);
    if (!jack) {
      hops.push({ cable: currentCable, fromDevice: fromDev, toDevice: toDev });
      return { hops, terminal: toDev, complete: false, brokenReason: 'Could not identify patch panel jack' };
    }

    const entrySide = currentCable.id === jack.frontCable?.id ? 'front' : 'rear';
    const nextCable = currentCable.id === jack.frontCable?.id ? jack.rearCable : jack.frontCable;

    if (!nextCable) {
      const openSide = entrySide === 'front' ? 'rear' : 'front';
      hops.push({
        cable: currentCable,
        fromDevice: fromDev,
        toDevice: toDev,
        panelJack: { panel: toDev, index: jack.index, entrySide, exitSide: openSide }
      });
      return { hops, terminal: toDev, complete: false, brokenReason: `Jack ${jack.index + 1} ${openSide} side is open` };
    }

    const exitSide = nextCable.id === jack.frontCable?.id ? 'front' : 'rear';
    hops.push({
      cable: currentCable,
      fromDevice: fromDev,
      toDevice: toDev,
      panelJack: { panel: toDev, index: jack.index, entrySide, exitSide }
    });

    currentFromId = toDev.id;
    currentCable = nextCable;
  }
}

export function traceCable(layout: RackLayout, cableId: string): CableTraceResult | null {
  const startCable = layout.cables.find((c) => c.id === cableId);
  if (!startCable) return null;

  const fromDevice = findDevice(layout, startCable.fromDeviceId);
  const toDevice = findDevice(layout, startCable.toDeviceId);
  if (!fromDevice || !toDevice) return null;

  const left = traceOneSide(layout, startCable, startCable.fromDeviceId);
  const right = traceOneSide(layout, startCable, startCable.toDeviceId);

  // Simple case: no patch panels on either side (both sides have exactly 1 hop = startCable)
  if (left.hops.length === 1 && right.hops.length === 1) {
    return {
      startDevice: left.hops[0].fromDevice,
      endDevice: left.hops[0].toDevice,
      hops: [{ cable: startCable, fromDevice: left.hops[0].fromDevice, toDevice: left.hops[0].toDevice }],
      complete: left.complete && right.complete,
      brokenReason: left.brokenReason ?? right.brokenReason,
    };
  }

  // Extract hops beyond startCable for each side
  const leftBeyond = left.hops.slice(1);
  const rightBeyond = right.hops.slice(1);

  // Reverse rightBeyond so it flows toward the center
  const reversedRight = [...rightBeyond].reverse().map((hop) => ({
    ...hop,
    fromDevice: hop.toDevice,
    toDevice: hop.fromDevice,
    panelJack: hop.panelJack
      ? {
          ...hop.panelJack,
          entrySide: hop.panelJack.exitSide,
          exitSide: hop.panelJack.entrySide,
        }
      : undefined,
  }));

  // Center hop is startCable, oriented from fromDevice to toDevice
  const centerHop: CableTraceHop = {
    cable: startCable,
    fromDevice,
    toDevice,
    panelJack: left.hops[0]?.panelJack,
  };

  const allHops = [...reversedRight, centerHop, ...leftBeyond];

  const startDevice = right.hops.length > 0 ? right.hops[right.hops.length - 1].toDevice : fromDevice;
  const endDevice = left.hops.length > 0 ? left.hops[left.hops.length - 1].toDevice : toDevice;

  return {
    startDevice: startDevice ?? fromDevice,
    endDevice: endDevice ?? toDevice,
    hops: allHops,
    complete: left.complete && right.complete,
    brokenReason: left.brokenReason ?? right.brokenReason,
  };
}

export function getConnectedCableIds(layout: RackLayout, deviceId: string, portType?: string, portIndex?: number): string[] {
  return layout.cables
    .filter((c) => {
      if (c.fromDeviceId !== deviceId && c.toDeviceId !== deviceId) return false;
      if (portType === undefined) return true;
      const port = c.fromDeviceId === deviceId ? c.fromPort : c.toPort;
      return port?.type === portType && (portIndex === undefined || port.index === portIndex);
    })
    .map((c) => c.id);
}
