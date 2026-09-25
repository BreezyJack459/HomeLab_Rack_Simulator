import type {
  CableRoute,
  CableRouteAnchor,
  PortRef,
  RackLayout,
} from "../types/rack";
import {
  getCablePortFace,
  getDevicePortSurfaces,
  getDevicePortWorldPosition,
  getDeviceWorldBox,
  getRackWorldDimensions,
  type WorldPoint,
} from "./rackGeometry";
import { RACK_SPECS } from "./rackMath";

// Shared with the rendered channel geometry. Anchors follow rack/device edits.
export const CHANNEL_X_OFFSET = 0.24;
export const CHANNEL_Z_OFFSET = 0.14;

export const anchorKey = (anchor: CableRouteAnchor): string =>
  anchor.kind === "channel"
    ? `${anchor.face}-${anchor.side}-U${anchor.positionU}`
    : `${anchor.deviceId}-${anchor.side}`;
export const anchorLabel = (
  anchor: CableRouteAnchor,
  layout: RackLayout,
): string =>
  anchor.kind === "channel"
    ? `${anchor.face} ${anchor.side} · U${anchor.positionU}`
    : `${layout.devices.find((d) => d.id === anchor.deviceId)?.name ?? "Missing manager"} · ${anchor.side}`;

export const isCableRouteAnchor = (
  value: unknown,
): value is CableRouteAnchor => {
  if (!value || typeof value !== "object") return false;
  const anchor = value as Record<string, unknown>;
  if (anchor.side !== "left" && anchor.side !== "right") return false;
  return anchor.kind === "manager"
    ? typeof anchor.deviceId === "string"
    : anchor.kind === "channel" &&
        (anchor.face === "front" || anchor.face === "rear") &&
        typeof anchor.positionU === "number" &&
        Number.isFinite(anchor.positionU) &&
        anchor.positionU >= 1;
};

export const resolveRouteAnchor = (
  anchor: CableRouteAnchor,
  layout: RackLayout,
): WorldPoint | null => {
  if (!isCableRouteAnchor(anchor)) return null;
  const dims = getRackWorldDimensions(layout);
  if (anchor.kind === "channel") {
    if (
      !Number.isFinite(anchor.positionU) ||
      anchor.positionU < 1 ||
      anchor.positionU > layout.heightU ||
      !["left", "right"].includes(anchor.side) ||
      !["front", "rear"].includes(anchor.face)
    )
      return null;
    return {
      x:
        (anchor.side === "left" ? -1 : 1) *
        (dims.rackWidth / 2 + CHANNEL_X_OFFSET),
      y: dims.bottom + (anchor.positionU - 0.5) * 0.18,
      z:
        (anchor.face === "front" ? 1 : -1) *
        (dims.rackDepth / 2 + CHANNEL_Z_OFFSET),
    };
  }
  const device = layout.devices.find(
    (d) => d.id === anchor.deviceId && d.category === "cable-management",
  );
  if (!device) return null;
  const box = getDeviceWorldBox(layout, device, dims);
  return {
    x: box.x + (anchor.side === "left" ? -1 : 1) * box.width * 0.35,
    y: box.y,
    z: box.z,
  };
};

export const portLeadPoints = (
  layout: RackLayout,
  deviceId: string,
  port?: PortRef,
): WorldPoint[] => {
  const device = layout.devices.find((d) => d.id === deviceId);
  if (!device) return [];
  const dims = getRackWorldDimensions(layout);
  const box = getDeviceWorldBox(layout, device, dims);
  const surface = getDevicePortSurfaces(device, box).find(
    (s) => s.face === (box.isZeroU ? "front" : getCablePortFace(device, port)),
  );
  if (
    !surface?.slots.some((s) => s.type === port?.type && s.index === port.index)
  )
    return [];
  const point = getDevicePortWorldPosition(layout, device, port, dims);
  const lead = port?.type === "power" ? 0.26 : 0.16;
  const exit = {
    x: point.x + surface.normal.x * lead,
    y: point.y,
    z: point.z + surface.normal.z * lead,
  };
  return device.category === "pdu" || device.category === "pdu-0u"
    ? [point, exit, { ...exit, y: exit.y - 0.1 }]
    : [point, exit];
};

export const manualRoutePoints = (
  cable: CableRoute,
  layout: RackLayout,
): WorldPoint[] => {
  if (
    !Array.isArray(cable.manualPath) ||
    !cable.manualPath.every(isCableRouteAnchor)
  )
    return [];
  const start = portLeadPoints(layout, cable.fromDeviceId, cable.fromPort);
  const end = portLeadPoints(layout, cable.toDeviceId, cable.toPort);
  const anchors = cable.manualPath.map((anchor) =>
    resolveRouteAnchor(anchor, layout),
  );
  if (!start.length || !end.length || anchors.some((point) => !point))
    return [];
  return [...start, ...(anchors as WorldPoint[]), ...end.reverse()];
};

/** World axes have different display scales; convert each axis back to mm. */
export const routeLengthMm = (
  points: WorldPoint[],
  layout: RackLayout,
): number => {
  const dims = getRackWorldDimensions(layout);
  return points
    .slice(1)
    .reduce(
      (sum, point, i) =>
        sum +
        Math.hypot(
          ((point.x - points[i].x) *
            RACK_SPECS[layout.rackType].usableWidthMm) /
            dims.rackWidth,
          ((point.y - points[i].y) * 44.45) / 0.18,
          ((point.z - points[i].z) * layout.rackDepthMm) / dims.rackDepth,
        ),
      0,
    );
};
