import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { sampleLayouts } from '../src/data/sampleLayouts';
import { buildRackSceneModel } from '../src/utils/rackSceneModel';
import { getCableManagerBodyParts, getDevicePortSurfaces } from '../src/utils/rackGeometry';
import { buildRouteCurve } from '../src/components/three/rack-scene/ManagedCable3D';
import { routeLengthMm } from '../src/utils/manualCableRoute';
import type { RackLayout } from '../src/types/rack';
import dense60 from './fixtures/dense-42u-60.json';
import dense100 from './fixtures/dense-42u-100.json';

describe('rendered cable curves', () => {
  const fixtures = [...sampleLayouts.filter((layout) => layout.cables.length), dense60 as RackLayout, dense100 as RackLayout];
  for (const layout of fixtures) for (const routingMode of ['clean', 'realistic'] as const) {
    it(`${layout.name}, ${routingMode}: rendered curves clear device bodies and meet visible sockets`, () => {
      const model = buildRackSceneModel(layout, { routingMode });
      for (const route of model.routes) {
        const curve = buildRouteCurve(route.points)!;
        expect(curve).not.toBeNull();
        const measuredMm = routeLengthMm(curve.curves.flatMap(segment => segment.getPoints(128)), layout);
        expect(Math.abs(route.renderedLengthMm! - measuredMm), `${route.cableId}: rendered length in physical axes`).toBeLessThan(0.1);
        for (const [deviceId, portRef, endpoint, t] of [
          [route.cable.fromDeviceId, route.cable.fromPort, route.fromPort, 0],
          [route.cable.toDeviceId, route.cable.toPort, route.toPort, 1],
        ] as const) {
          const solid = model.devices.find((device) => device.deviceId === deviceId)!;
          const device = layout.devices.find((item) => item.id === deviceId)!;
          const surfaces = getDevicePortSurfaces(device, solid.box);
          const surface = surfaces.find((item) => item.slots.some((slot) => slot.type === portRef?.type && slot.index === portRef.index)
            && (device.category !== 'patch-panel' || item.face === (portRef?.side ?? 'front')));
          if (portRef && (device.ports?.[portRef.type] ?? 0) > portRef.index) expect(surface, `${route.cableId}: visible socket`).toBeDefined();
          if (surface) {
            const slot = surface.slots.find((slot) => slot.type === portRef?.type && slot.index === portRef.index)!;
            expect(new Vector3(solid.box.x + slot.position.x, solid.box.y + slot.position.y, solid.box.z + slot.position.z).distanceTo(curve.getPointAt(t)), route.cableId).toBeLessThan(1e-8);
            const normal = new Vector3(surface.normal.x, surface.normal.y, surface.normal.z);
            expect(curve.getTangentAt(t).multiplyScalar(t === 0 ? 1 : -1).dot(normal), route.cableId).toBeGreaterThan(0.999);
          }
          expect(curve.getPointAt(t).distanceTo(new Vector3(endpoint.x, endpoint.y, endpoint.z))).toBeLessThan(1e-8);
        }
        let collision: string | null = null;
        for (const point of curve.getSpacedPoints(600)) {
          const hit = model.devices.find(({ box, kind }) => {
            const parts = kind === 'hcm' ? getCableManagerBodyParts(box)
              : [{ center: { x: 0, y: 0, z: 0 }, size: { x: box.width, y: box.height, z: box.depth } }];
            return parts.some((part) => Math.abs(point.x - box.x - part.center.x) < part.size.x / 2 - 0.004
              && Math.abs(point.y - box.y - part.center.y) < part.size.y / 2 - 0.004
              && Math.abs(point.z - box.z - part.center.z) < part.size.z / 2 - 0.004);
          });
          if (hit) { collision = `${route.cableId} penetrates ${hit.deviceId}`; break; }
        }
        expect(collision).toBeNull();
      }
    });
  }

  for (const routingMode of ['clean', 'realistic'] as const) it(`bows front patch cords away from the panel in ${routingMode} mode`, () => {
    const layout = sampleLayouts.find((item) => item.name === 'My On-hand Gear')!;
    const route = buildRackSceneModel(layout, { routingMode }).routes.find((item) => item.cableId === 'onhand-cable-switch-uplink')!;
    const points = buildRouteCurve(route.points)!.getSpacedPoints(200);
    expect(route.usesTrunk).toBe(false);
    expect(Math.max(...points.map((p) => p.z))).toBeGreaterThan(Math.max(route.fromPort.z, route.toPort.z) + 0.2);
    expect(Math.min(...points.map((p) => p.y))).toBeLessThan(Math.min(route.fromPort.y, route.toPort.y));
  });

  it('does not overshoot the socket plane when rounding a short exit into a long lateral run', () => {
    const curve = buildRouteCurve([{ x: 0, y: 0, z: 0.018 }, { x: 0, y: 0, z: 0.078 }, { x: 3, y: 0, z: 0.078 }, { x: 3, y: -2, z: 0.078 }])!;
    for (const point of curve.getSpacedPoints(500)) expect(point.z).toBeGreaterThanOrEqual(0.018 - 1e-8);
  });
});

describe('rear patch panel harnesses', () => {
  const layout = sampleLayouts.find((item) => item.name === 'My On-hand Gear')!;
  for (const routingMode of ['clean', 'realistic'] as const) {
    it(`${routingMode}: fans rear ports into stable local bundles on their own side`, () => {
      const model = buildRackSceneModel(layout, { routingMode });
      const panel = layout.devices.find((d) => d.id === 'onhand-patch-panel')!;
      const panelBox = model.devices.find((d) => d.deviceId === panel.id)!.box;
      const rear = getDevicePortSurfaces(panel, panelBox).find((s) => s.face === 'rear')!;
      let checked = 0;
      for (const route of model.routes) {
        const atStart = route.cable.fromDeviceId === panel.id && route.cable.fromPort?.side === 'rear';
        const atEnd = route.cable.toDeviceId === panel.id && route.cable.toPort?.side === 'rear';
        if (!atStart && !atEnd) continue;
        checked++;
        if (route.rearGuides.length === 0) {
          expect(route.routingDecision.kind).not.toBe('blocked');
          continue;
        }
        expect(route.rearGuides).toHaveLength(1);
        const guide = route.rearGuides[0];
        const points = atStart ? route.points : [...route.points].reverse();
        const port = points[0];
        expect(Math.sign(guide.tie.x)).toBe(port.x < 0 ? -1 : 1);
        // Fan-out begins close to the socket, instead of a straight run across
        // the whole rack depth. The bend has many distinct X and Z samples.
        const sideways = points.find((p) => Math.abs(p.x - port.x) > 0.07)!;
        expect(Math.abs(sideways.z - port.z)).toBeLessThan(0.65);
        expect(new Set(points.slice(2, 24).map((p) => p.x.toFixed(4))).size).toBeGreaterThan(10);
        expect(new Set(points.slice(2, 24).map((p) => p.z.toFixed(4))).size).toBeGreaterThan(10);
        const socket = rear.slots.find((slot) => slot.index === (atStart ? route.cable.fromPort : route.cable.toPort)!.index)!;
        expect(port.x).toBeCloseTo(panelBox.x + socket.position.x);
      }
      expect(checked).toBeGreaterThan(8);
      expect(model.rearGuides.length).toBeLessThan(checked);
      expect(buildRackSceneModel({ ...layout, cables: [...layout.cables].reverse() }, { routingMode }).rearGuides).toEqual(model.rearGuides);
      // Hiding/disconnecting a strand must not move the remaining harness.
      const reduced = buildRackSceneModel({ ...layout, cables: layout.cables.slice(1) }, { routingMode });
      for (const guide of reduced.rearGuides) expect(guide).toEqual(model.rearGuides.find((g) => g.id === guide.id));
    });
  }
  it('keeps harness supports fixed while Realistic changes the cable curves', () => {
    const clean = buildRackSceneModel(layout, { routingMode: 'clean' });
    const realistic = buildRackSceneModel(layout, { routingMode: 'realistic' });
    for (const guide of clean.rearGuides) {
      expect(realistic.rearGuides.find((g) => g.id === guide.id)).toEqual(guide);
    }
    expect(clean.routes.some((route) => route.rearGuides.length > 0
      && JSON.stringify(route.points) !== JSON.stringify(realistic.routes.find((item) => item.cableId === route.cableId)!.points))).toBe(true);
  });
});

describe('supported rear crossovers', () => {
  const original = sampleLayouts.find((item) => item.name === 'My On-hand Gear')!;
  for (const routingMode of ['clean', 'realistic'] as const) {
    for (const hasManager of [true, false]) {
      it(`${routingMode}, rear manager ${hasManager}: crossings stay within rack height and pass through mounted clips`, () => {
        const layout = { ...original, devices: original.devices.filter((d) => hasManager || !(d.category === 'cable-management' && d.mountSide === 'rear')) };
        const model = buildRackSceneModel(layout, { routingMode });
        const crossingRoutes = model.routes.filter((route) => route.crossovers.length);
        expect(crossingRoutes.length).toBeGreaterThan(0);
        for (const route of crossingRoutes) {
          expect(Math.max(...route.points.map((p) => p.y))).toBeLessThanOrEqual(model.dimensions.rackHeight / 2);
          const support = route.crossovers[0];
          expect(Math.abs(support.center.y) + 0.075).toBeLessThan(model.dimensions.rackHeight / 2);
          // Mounting plates are on both actual rear post centerlines.
          for (const side of [-1, 1]) expect(support.members.some((part) =>
            Math.abs(part.center.x - side * model.dimensions.rackWidth / 2) < 1e-8
            && Math.abs(part.center.z + model.dimensions.rackDepth / 2) < 1e-8)).toBe(true);
          const curve = buildRouteCurve(route.points)!;
          const samples = curve.getSpacedPoints(3000);
          for (const clip of support.clips) {
            // Include cable thickness: a centerline next to a clip is not enough.
            const distance = Math.min(...samples.map((p) => p.distanceTo(new Vector3(clip.x, clip.y, clip.z))));
            expect(distance + route.radiusMm / 1000, `${route.cableId} misses clip`).toBeLessThan(0.075 - 0.012);
          }
        }
        const shuffled = buildRackSceneModel({ ...layout, cables: [...layout.cables].reverse() }, { routingMode });
        expect(shuffled.crossovers).toEqual(model.crossovers);
      });
    }
  }
});
