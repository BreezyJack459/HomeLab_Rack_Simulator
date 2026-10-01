import type { CableRoute, CableRouteAnchor, RackLayout } from '../types/rack';
import { buildPreviewRoute, buildRackSceneModel, type ManagedRoute } from './rackSceneModel';
import { resolvePortFace } from './portLayout';
import { calculateCableNodes } from './routing';
import type { WorldPoint } from './rackGeometry';

export type PanelTidyResult = { cables: CableRoute[]; changed: number; manualKept: number; blocked: number; message: string };
const intersects = (a: WorldPoint, b: WorldPoint, c: WorldPoint, d: WorldPoint): boolean => {
  const turn = (p: WorldPoint, q: WorldPoint, r: WorldPoint) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  // Crossing counts are a front/rear projection heuristic, not physical collision certification.
  return turn(a, b, c) * turn(a, b, d) < -1e-10 && turn(c, d, a) * turn(c, d, b) < -1e-10;
};
const crossings = (route: ManagedRoute, others: ManagedRoute[]): number => others.reduce((sum, other) => sum + route.points.slice(1).reduce((n, b, i) => n + other.points.slice(1).filter((d, j) => intersects(route.points[i], b, other.points[j], d)).length, 0), 0);
const clear = (route: ManagedRoute | null): route is ManagedRoute => Boolean(route && route.routingDecision.kind !== 'blocked' && route.renderedLengthMm !== null);

/** Routing only. Preserve endpoints, physical metadata and unrelated routes; user manual anchors stay fixed. */
export const tidyPanelCables = (layout: RackLayout, panelId: string): PanelTidyResult => {
  if (!layout.devices.some(d => d.id === panelId && d.category === 'patch-panel')) return { cables: layout.cables, changed: 0, manualKept: 0, blocked: 0, message: 'Choose an existing patch panel.' };
  let working = layout; let changed = 0; let manualKept = 0; let blocked = 0;
  const ids = layout.cables.filter(c => c.fromDeviceId === panelId || c.toDeviceId === panelId).map(c => c.id).sort();
  const changedIds = new Set<string>();
  if (ids.length > 128) return { cables: layout.cables, changed: 0, manualKept: 0, blocked: 0, message: 'No tidy applied: this panel exceeds the 128-cable routing limit. Routes preserved.' };
  let stable = false;
  for (let pass = 0; pass < 32; pass++) {
    let passChanges = 0; manualKept = 0; blocked = 0;
    for (const id of ids) {
    const cable = working.cables.find(c => c.id === id)!;
    if (cable.manualPath !== undefined && cable.routingOrigin !== 'panel-tidy') { manualKept++; continue; }
    const scene = buildRackSceneModel(working); const base = scene.routes.find(r => r.cableId === id);
    const lane = base?.lane.index ?? 0;
    const from = working.devices.find(d => d.id === cable.fromDeviceId), to = working.devices.find(d => d.id === cable.toDeviceId);
    if (!from || !to || !cable.fromPort || !cable.toPort || cable.fromPort.index < 0 || cable.toPort.index < 0 || cable.fromPort.index >= (from.ports?.[cable.fromPort.type] ?? 0) || cable.toPort.index >= (to.ports?.[cable.toPort.type] ?? 0)) { blocked++; continue; }
    const anchors: CableRouteAnchor[][] = [[]];
    for (const side of ['left', 'right'] as const) anchors.push([
      { kind: 'channel', side, face: resolvePortFace(from, cable.fromPort), positionU: Math.min(layout.heightU, Math.max(1, from.positionU + (from.sizeU - 1) / 2)) },
      { kind: 'channel', side, face: resolvePortFace(to, cable.toPort), positionU: Math.min(layout.heightU, Math.max(1, to.positionU + (to.sizeU - 1) / 2)) },
    ]);
    const others = scene.routes.filter(r => r.cableId !== id && clear(r));
    const baselineReal = buildPreviewRoute(cable, working, lane, 'realistic');
    let bestCable = cable; let bestCross = clear(base ?? null) && clear(baselineReal) ? crossings(base!, others) : Infinity;
    let bestLength = clear(base ?? null) && clear(baselineReal) ? Math.max(base!.renderedLengthMm!, baselineReal.renderedLengthMm!) : Infinity;
    for (const path of anchors) {
      const candidate = { ...cable, manualPath: path, routingOrigin: 'panel-tidy' as const };
      const a = buildPreviewRoute(candidate, working, lane), b = buildPreviewRoute(candidate, working, lane, 'realistic');
      if (!clear(a) || !clear(b)) continue;
      const count = crossings(a, others), length = Math.max(a.renderedLengthMm!, b.renderedLengthMm!);
      if (count < bestCross || (count === bestCross && length < bestLength - 0.5)) { bestCable = candidate; bestCross = count; bestLength = length; }
    }
    if (bestLength === Infinity) { blocked++; continue; }
    if (bestCable !== cable) {
      const next = { ...bestCable, nodes: calculateCableNodes(bestCable, working) };
      if (JSON.stringify(next) !== JSON.stringify(cable)) { working = { ...working, cables: working.cables.map(c => c.id === id ? next : c) }; changedIds.add(id); passChanges++; }
    }
    }
    if (!passChanges) { stable = true; break; }
  }
  if (!stable) return { cables: layout.cables, changed: 0, manualKept, blocked, message: 'No tidy applied: routing optimization did not settle within its limit. Routes preserved.' };
  changed = changedIds.size;
  return { cables: working.cables, changed, manualKept, blocked, message: `${changed ? `Tidied ${changed} panel cable route(s). One Undo restores them.` : 'No routing improvement found.'} Endpoints and recorded cable lengths preserved. ${manualKept} manual route(s) kept; ${blocked} route(s) need clearance review.` };
};
