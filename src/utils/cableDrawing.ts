import type { CableRoute, RackLayout } from "../types/rack";
import { DEFAULT_CABLE_COLORS } from "./cableColors";
import {
  inferCableType,
  portChoicesForDevice,
  portKey,
  type PortChoice,
} from "./portSelection";
import { getRouteObstacles, routeIsClear } from "./routeFeasibility";
import type { WorldPoint } from "./rackGeometry";

export const drawingCable = (
  layout: RackLayout,
  source: PortChoice,
  target: PortChoice,
): CableRoute | null => {
  if (source.deviceId === target.deviceId || source.type !== target.type)
    return null;
  const from = layout.devices.find((d) => d.id === source.deviceId);
  const to = layout.devices.find((d) => d.id === target.deviceId);
  if (!from || !to) return null;
  // Re-read occupancy at commit time, including the two faces of a patch panel.
  const a = portChoicesForDevice(from, layout).find(
    (p) => portKey(p) === portKey(source),
  );
  const b = portChoicesForDevice(to, layout).find(
    (p) => portKey(p) === portKey(target),
  );
  if (!a || !b || a.disabled || b.disabled) return null;
  const types = a.cableTypes.filter((type) => b.cableTypes.includes(type));
  const inferred = inferCableType(from, to);
  const type = types.find((type) => type === inferred) ?? types[0];
  if (!type) return null;
  return {
    id: "drawing-preview",
    fromDeviceId: from.id,
    toDeviceId: to.id,
    fromPort: { type: a.type, index: a.index, side: a.side },
    toPort: { type: b.type, index: b.index, side: b.side },
    type,
    color: DEFAULT_CABLE_COLORS[type],
    manualPath: [],
  };
};

export const drawingObstruction = (
  layout: RackLayout,
  points: WorldPoint[],
  sourceId: string,
  targetId?: string,
): string | null => {
  if (points.length < 2) return "This routing point is no longer available.";
  const obstacles = getRouteObstacles(layout).filter(
    (o) => o.kind === "body" || (o.owner !== sourceId && o.owner !== targetId),
  );
  const blocked = obstacles.find((o) => !routeIsClear(points, [o]));
  if (!blocked) return null;
  const name =
    layout.devices.find((d) => d.id === blocked.owner)?.name ?? "Device";
  return `${name}: ${blocked.kind === "body" ? "the cable would pass through the device" : "the cable would block connector access"}. Choose another point.`;
};
