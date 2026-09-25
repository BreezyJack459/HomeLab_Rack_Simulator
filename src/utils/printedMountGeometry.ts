import type { RackLayout } from '../types/rack';
import { getDeviceWorldBox, getRackWorldDimensions, RACK_3D_POST_SIZE, type WorldPoint } from './rackGeometry';

export type PrintedMountPart = { kind: 'panel' | 'cradle' | 'joiner' | 'ear' | 'bolt'; center: WorldPoint; size: WorldPoint };
export type PrintedMountAssembly = { id: string; deviceIds: string[]; side: 'front' | 'rear'; positionU: number; parts: PrintedMountPart[] };

/** Shared illustrative rack-mounted cages, never a replacement for printable CAD. */
export const buildPrintedMountAssemblies = (layout: RackLayout): PrintedMountAssembly[] => {
  const dimensions = getRackWorldDimensions(layout);
  const solids = layout.devices.map(device => ({ device, box: getDeviceWorldBox(layout, device, dimensions) }));
  const groups = new Map<string, typeof solids>();
  for (const item of solids) {
    if (item.device.mountingSupport !== 'printed-mount' || item.box.isZeroU) continue;
    const key = `${item.device.mountSide ?? 'front'}:${item.device.positionU}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, entries]) => {
    const members = entries.sort((a, b) => a.box.x - b.box.x || a.device.id.localeCompare(b.device.id));
    const side = members[0].device.mountSide ?? 'front';
    const sign = side === 'rear' ? -1 : 1;
    const faceZ = sign * (dimensions.rackDepth / 2 + 0.036);
    const left = -(dimensions.rackWidth + RACK_3D_POST_SIZE) / 2;
    const right = -left;
    const bottom = Math.min(...members.map(({ box }) => box.y - box.height / 2)) - 0.007;
    const top = Math.max(...members.map(({ box }) => box.y + box.height / 2)) + 0.007;
    const parts: PrintedMountPart[] = [];
    const add = (kind: PrintedMountPart['kind'], x: number, y: number, z: number, w: number, h: number, d: number) => {
      if (Math.min(w, h, d) <= 0.00001) return;
      // Reject members that would pass through another device, including deep
      // equipment on the opposite face. Surface contact is intentional.
      if (solids.some(({ box }) => Math.abs(x - box.x) < (w + box.width) / 2 - 0.00001 &&
        Math.abs(y - box.y) < (h + box.height) / 2 - 0.00001 && Math.abs(z - box.z) < (d + box.depth) / 2 - 0.00001)) return;
      parts.push({ kind, center: { x, y, z }, size: { x: w, y: h, z: d } });
    };
    // Cut openings for ALL equipment across this face and height, even when
    // neighbouring equipment has not been assigned a printed mount.
    const openings = solids.filter(({ box }) => !box.isZeroU &&
      (box.isRearMounted ? 'rear' : 'front') === side && box.y + box.height / 2 > bottom && box.y - box.height / 2 < top
    ).map(({ box }) => ({ left: box.x - box.width / 2 - 0.006, right: box.x + box.width / 2 + 0.006,
      bottom: box.y - box.height / 2 - 0.001, top: box.y + box.height / 2 + 0.001 }));
    const ys = [...new Set([bottom, top, ...openings.flatMap(hole => [Math.max(bottom, hole.bottom), Math.min(top, hole.top)])])].sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) {
      const y = (ys[i - 1] + ys[i]) / 2;
      const holes = openings.filter(hole => y > hole.bottom && y < hole.top).sort((a, b) => a.left - b.left);
      let start = left;
      for (const hole of holes) {
        const end = Math.min(right, hole.left);
        add('panel', (start + end) / 2, y, faceZ, end - start, ys[i] - ys[i - 1], 0.012);
        start = Math.max(start, hole.right);
      }
      add('panel', (start + right) / 2, y, faceZ, right - start, ys[i] - ys[i - 1], 0.012);
    }
    for (const { box } of members) {
      // Shallow cradle stops before the rear sockets and cable lead-outs.
      const depth = Math.max(0.04, box.depth - 0.045);
      const z = sign * (dimensions.rackDepth / 2 + 0.03 - depth / 2);
      add('cradle', box.x, box.y - box.height / 2 - 0.003, z, box.width + 0.012, 0.006, depth);
      for (const direction of [-1, 1]) {
        add('cradle', box.x + direction * (box.width / 2 + 0.006), box.y, z,
          0.012, box.height, depth);
      }
    }
    for (let i = 1; i < members.length; i++) {
      const gapLeft = members[i - 1].box.x + members[i - 1].box.width / 2 + 0.006;
      const gapRight = members[i].box.x - members[i].box.width / 2 - 0.006;
      const x = (gapLeft + gapRight) / 2;
      const width = Math.min(0.045, gapRight - gapLeft);
      if (width < 0.014) continue;
      // A darker splice plate and screw distinguish joined modules from a
      // single uninterrupted sheet. It occupies only the gap between openings.
      const y = (bottom + top) / 2;
      if (openings.some(hole => x + width / 2 > hole.left && x - width / 2 < hole.right && y > hole.bottom && y < hole.top)) continue;
      add('joiner', x, y, faceZ + sign * 0.009, width, (top - bottom) * 0.7, 0.006);
      add('bolt', x, y, faceZ + sign * 0.014, 0.01, 0.01, 0.006);
    }
    for (const x of [-dimensions.rackWidth / 2, dimensions.rackWidth / 2]) {
      // Fill the offset between the faceplate back and the rack post surface.
      const postSurface = dimensions.rackDepth / 2 + RACK_3D_POST_SIZE / 2;
      const panelBack = Math.abs(faceZ) - 0.006;
      add('ear', x, (bottom + top) / 2, sign * (postSurface + panelBack) / 2,
        RACK_3D_POST_SIZE, top - bottom, panelBack - postSurface);
      for (const y of [bottom + (top - bottom) * 0.23, bottom + (top - bottom) * 0.77]) {
        add('bolt', x, y, faceZ + sign * 0.01, 0.014, 0.014, 0.008);
      }
    }
    return { id, deviceIds: members.map(item => item.device.id), side, positionU: members[0].device.positionU, parts };
  });
};
