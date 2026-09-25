import { describe, expect, test } from 'vitest';
import type { CableRoute, PlacedDevice, RackLayout } from '../types/rack';
import { buildRackSceneModel, laneOffsetForIndex, type ManagedRoute } from './rackSceneModel';
import { getDevicePortWorldPosition, getDeviceWorldBox, getRackWorldDimensions } from './rackGeometry';
import dense42u60Json from '../../tests/fixtures/dense-42u-60.json';
import dense42u100Json from '../../tests/fixtures/dense-42u-100.json';

const denseFixtures: Record<number, RackLayout> = {
  60: dense42u60Json as RackLayout,
  100: dense42u100Json as RackLayout
};

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const makeDevice = (overrides: Partial<PlacedDevice> & { id: string }): PlacedDevice => ({
  category: 'server',
  name: overrides.id,
  positionU: 1,
  sizeU: 1,
  depthMm: 400,
  widthType: '19in',
  weightKg: 5,
  powerW: 100,
  heatLevel: 2,
  color: '#3b82f6',
  ...overrides
});

const makeCable = (
  overrides: Partial<CableRoute> & { id: string; fromDeviceId: string; toDeviceId: string }
): CableRoute => ({
  type: 'ethernet',
  color: '',
  ...overrides
});

const makeLayout = (partial: Partial<RackLayout>): RackLayout => ({
  id: 'fixture',
  name: 'Fixture',
  rackType: '19in',
  heightU: 18,
  rackDepthMm: 800,
  weightLimitKg: 500,
  powerBudgetW: 4000,
  viewSide: 'front',
  devices: [],
  cables: [],
  updatedAt: '2026-08-13T00:00:00.000Z',
  ...partial
});

/** 18U mixed-face rack: front switch + HCM, rear-mounted storage, rear PDU. */
const mixedFace18U = makeLayout({
  id: 'fixture-18u-mixed',
  heightU: 18,
  devices: [
    makeDevice({ id: 'sw', category: 'switch', positionU: 18, ports: { ethernet: 24 }, color: '#38bdf8' }),
    makeDevice({ id: 'hcm', category: 'cable-management', positionU: 17, depthMm: 100 }),
    makeDevice({ id: 'srv', category: 'server', positionU: 14, sizeU: 2, ports: { ethernet: 2, power: 2 } }),
    makeDevice({
      id: 'stor',
      category: 'nas',
      positionU: 10,
      sizeU: 2,
      mountSide: 'rear',
      ports: { ethernet: 4, power: 2 }
    }),
    makeDevice({ id: 'pdu', category: 'pdu', positionU: 1, mountSide: 'rear', ports: { power: 8 }, color: '#fb923c' })
  ],
  cables: [
    makeCable({ id: 'c-eth-1', fromDeviceId: 'sw', toDeviceId: 'srv', fromPort: { type: 'ethernet', index: 0 }, toPort: { type: 'ethernet', index: 0 } }),
    makeCable({ id: 'c-eth-2', fromDeviceId: 'sw', toDeviceId: 'stor', fromPort: { type: 'ethernet', index: 1 }, toPort: { type: 'ethernet', index: 0 } }),
    makeCable({ id: 'c-pwr-1', type: 'power', fromDeviceId: 'pdu', toDeviceId: 'srv', fromPort: { type: 'power', index: 0 }, toPort: { type: 'power', index: 0 } }),
    makeCable({ id: 'c-pwr-2', type: 'power', fromDeviceId: 'pdu', toDeviceId: 'stor', fromPort: { type: 'power', index: 1 }, toPort: { type: 'power', index: 0 } })
  ]
});

/** 42U rack with side-rail and rear-rail 0U PDUs. */
const zeroU42U = makeLayout({
  id: 'fixture-42u-0u',
  heightU: 42,
  devices: [
    makeDevice({
      id: 'pdu-side',
      category: 'pdu-0u',
      sizeU: 0,
      mountType: 'side-rail',
      mountSide0U: 'left',
      depthMm: 100,
      ports: { power: 12 },
      color: '#fb923c'
    }),
    makeDevice({
      id: 'pdu-rear',
      category: 'pdu-0u',
      sizeU: 0,
      mountType: 'rear-rail',
      mountSide0U: 'right',
      outletFacing: 'forward',
      depthMm: 60,
      ports: { power: 12 },
      color: '#f97316'
    }),
    makeDevice({ id: 'sw42', category: 'switch', positionU: 42, ports: { ethernet: 24 } }),
    makeDevice({ id: 'srv42-a', category: 'server', positionU: 38, sizeU: 2, ports: { ethernet: 2, power: 2 } }),
    makeDevice({ id: 'srv42-b', category: 'server', positionU: 34, sizeU: 2, ports: { ethernet: 2, power: 2 } }),
    makeDevice({ id: 'srv42-c', category: 'server', positionU: 30, sizeU: 2, ports: { ethernet: 2, power: 2 } })
  ],
  cables: [
    makeCable({ id: 'z-pwr-1', type: 'power', fromDeviceId: 'pdu-side', toDeviceId: 'srv42-a', fromPort: { type: 'power', index: 0 }, toPort: { type: 'power', index: 0 } }),
    makeCable({ id: 'z-pwr-2', type: 'power', fromDeviceId: 'pdu-rear', toDeviceId: 'srv42-b', fromPort: { type: 'power', index: 0 }, toPort: { type: 'power', index: 0 } }),
    makeCable({ id: 'z-pwr-3', type: 'power', fromDeviceId: 'pdu-rear', toDeviceId: 'srv42-c', fromPort: { type: 'power', index: 1 }, toPort: { type: 'power', index: 0 } }),
    makeCable({ id: 'z-eth-1', fromDeviceId: 'sw42', toDeviceId: 'srv42-a', fromPort: { type: 'ethernet', index: 0 }, toPort: { type: 'ethernet', index: 0 } }),
    makeCable({ id: 'z-eth-2', fromDeviceId: 'sw42', toDeviceId: 'srv42-b', fromPort: { type: 'ethernet', index: 1 }, toPort: { type: 'ethernet', index: 0 } }),
    makeCable({ id: 'z-eth-3', fromDeviceId: 'sw42', toDeviceId: 'srv42-c', fromPort: { type: 'ethernet', index: 2 }, toPort: { type: 'ethernet', index: 0 } })
  ]
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const expectFinite = (route: ManagedRoute) => {
  for (const point of route.points) {
    expect(Number.isFinite(point.x), `${route.cableId} x`).toBe(true);
    expect(Number.isFinite(point.y), `${route.cableId} y`).toBe(true);
    expect(Number.isFinite(point.z), `${route.cableId} z`).toBe(true);
  }
};

const sampleSegments = (route: ManagedRoute) => {
  const samples: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < route.points.length - 1; i++) {
    const a = route.points[i];
    const b = route.points[i + 1];
    for (const t of [0.25, 0.5, 0.75]) {
      samples.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t
      });
    }
  }
  return samples;
};

/** X of the longest vertical segment — the side-channel trunk. */
const trunkX = (route: ManagedRoute) => {
  let best = 0;
  let bestDy = -1;
  for (let i = 0; i < route.points.length - 1; i++) {
    const dy = Math.abs(route.points[i + 1].y - route.points[i].y);
    if (dy > bestDy) {
      bestDy = dy;
      best = (route.points[i].x + route.points[i + 1].x) / 2;
    }
  }
  return best;
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('buildRackSceneModel — 18U mixed-face', () => {
  const model = buildRackSceneModel(mixedFace18U);
  const dimensions = getRackWorldDimensions(mixedFace18U);

  test('uses canonical rack dimensions', () => {
    expect(model.dimensions).toEqual(dimensions);
  });

  test('device solids match canonical world boxes', () => {
    expect(model.devices).toHaveLength(mixedFace18U.devices.length);
    for (const device of mixedFace18U.devices) {
      const solid = model.devices.find((item) => item.deviceId === device.id);
      expect(solid, device.id).toBeTruthy();
      const box = getDeviceWorldBox(mixedFace18U, device, dimensions);
      expect(solid!.box).toEqual(box);
    }
  });

  test('frame has 4 opaque posts, crossbars and mounting rails', () => {
    expect(model.frame.posts).toHaveLength(4);
    expect(model.frame.crossbars.length).toBeGreaterThanOrEqual(8);
    expect(model.frame.mountingRails).toHaveLength(2);
  });

  test('exposes partitioned left and right channels on both faces', () => {
    expect(model.channels).toHaveLength(4);
    for (const channel of model.channels) {
      expect(channel.separation).toBe('partitioned');
      expect(Math.sign(channel.laneCenter.x)).toBe(channel.side === 'left' ? -1 : 1);
    }
  });

  test('every cable produces a route with canonical port endpoints', () => {
    expect(model.routes).toHaveLength(mixedFace18U.cables.length);
    for (const cable of mixedFace18U.cables) {
      const route = model.routes.find((item) => item.cableId === cable.id);
      expect(route, cable.id).toBeTruthy();
      const from = mixedFace18U.devices.find((device) => device.id === cable.fromDeviceId)!;
      const to = mixedFace18U.devices.find((device) => device.id === cable.toDeviceId)!;
      const fromPort = getDevicePortWorldPosition(mixedFace18U, from, cable.fromPort, dimensions);
      const toPort = getDevicePortWorldPosition(mixedFace18U, to, cable.toPort, dimensions);
      expect(route!.fromPort).toEqual(fromPort);
      expect(route!.toPort).toEqual(toPort);
      expect(route!.points[0]).toEqual(fromPort);
      expect(route!.points[route!.points.length - 1]).toEqual(toPort);
      expectFinite(route!);
    }
  });

  test('trunk routes follow the source port half of the rack', () => {
    const { rackWidth } = dimensions;
    for (const route of model.routes.filter((item) => item.usesTrunk)) {
      const x = trunkX(route);
      expect(Math.abs(x), route.cableId).toBeGreaterThan(rackWidth / 2);
      expect(Math.sign(x), route.cableId).toBe(route.fromPort.x < 0 ? -1 : 1);
    }
  });

  test('routes do not cross device volumes after the port lead-in', () => {
    const tolerance = 0.004;
    for (const route of model.routes) {
      for (const sample of sampleSegments(route)) {
        const nearFrom = Math.hypot(sample.x - route.fromPort.x, sample.y - route.fromPort.y, sample.z - route.fromPort.z) < 0.1;
        const nearTo = Math.hypot(sample.x - route.toPort.x, sample.y - route.toPort.y, sample.z - route.toPort.z) < 0.1;
        if (nearFrom || nearTo) continue;
        for (const solid of model.devices) {
          const { box } = solid;
          const inside =
            Math.abs(sample.x - box.x) < box.width / 2 - tolerance &&
            Math.abs(sample.y - box.y) < box.height / 2 - tolerance &&
            Math.abs(sample.z - box.z) < box.depth / 2 - tolerance;
          expect(inside, `${route.cableId} inside ${solid.deviceId} at ${JSON.stringify(sample)}`).toBe(false);
        }
      }
    }
  });

  test('model build is deterministic', () => {
    const again = buildRackSceneModel(mixedFace18U);
    expect(JSON.stringify(again)).toBe(JSON.stringify(model));
  });

  test('lane assignment does not depend on cable order', () => {
    const shuffled = makeLayout({
      ...mixedFace18U,
      cables: [...mixedFace18U.cables].reverse()
    });
    const shuffledModel = buildRackSceneModel(shuffled);
    for (const route of model.routes) {
      const other = shuffledModel.routes.find((item) => item.cableId === route.cableId);
      expect(other!.lane).toEqual(route.lane);
      expect(other!.points).toEqual(route.points);
    }
  });
});

describe('buildRackSceneModel — 42U with 0U PDUs', () => {
  const model = buildRackSceneModel(zeroU42U);
  const dimensions = getRackWorldDimensions(zeroU42U);

  test('0U devices get side/rear solids on the correct plane', () => {
    const side = model.devices.find((item) => item.deviceId === 'pdu-side');
    const rear = model.devices.find((item) => item.deviceId === 'pdu-rear');
    expect(side!.kind).toBe('zero-u-side');
    expect(rear!.kind).toBe('zero-u-rear');
    expect(side!.box.x).toBeLessThan(-dimensions.rackWidth / 2);
    expect(rear!.box.x).toBeGreaterThan(dimensions.rackWidth / 2);
    expect(rear!.box.z).toBeLessThan(-dimensions.rackDepth / 2);
  });

  test('every cable produces a finite route with canonical endpoints', () => {
    expect(model.routes).toHaveLength(zeroU42U.cables.length);
    for (const route of model.routes) {
      expectFinite(route);
      const cable = zeroU42U.cables.find((item) => item.id === route.cableId)!;
      const from = zeroU42U.devices.find((device) => device.id === cable.fromDeviceId)!;
      const to = zeroU42U.devices.find((device) => device.id === cable.toDeviceId)!;
      expect(route.fromPort).toEqual(getDevicePortWorldPosition(zeroU42U, from, cable.fromPort, dimensions));
      expect(route.toPort).toEqual(getDevicePortWorldPosition(zeroU42U, to, cable.toPort, dimensions));
    }
  });

  test('power routes from 0U PDUs follow their source side', () => {
    for (const route of model.routes.filter((item) => item.separation === 'power' && item.usesTrunk)) {
      expect(Math.sign(trunkX(route)), route.cableId).toBe(route.fromPort.x < 0 ? -1 : 1);
    }
  });

  test('model build is deterministic for 42U', () => {
    const again = buildRackSceneModel(zeroU42U);
    expect(JSON.stringify(again)).toBe(JSON.stringify(model));
  });
});

describe('laneOffsetForIndex', () => {
  test('is deterministic and bounded inside the duct', () => {
    for (let i = 0; i < 60; i++) {
      const lane = laneOffsetForIndex(i);
      expect(lane).toEqual(laneOffsetForIndex(i));
      expect(Math.abs(lane.offsetX)).toBeLessThanOrEqual(0.03 + 1e-9);
      expect(Math.abs(lane.offsetZ)).toBeLessThanOrEqual(0.05 + 1e-9);
    }
  });
});

describe('buildRackSceneModel — dense-layout performance fixtures', () => {
  for (const count of [60, 100]) {
    test(`42U / ${count} routes: all routes built, finite, within budget`, () => {
      const layout = denseFixtures[count];
      const start = performance.now();
      const model = buildRackSceneModel(layout);
      const elapsedMs = performance.now() - start;
      // Hardware context is recorded with the run; the assertion is a
      // generous regression guard, not the measurement itself.
      console.log(
        `[perf] rackSceneModel 42U/${count} routes: ${elapsedMs.toFixed(1)}ms`
      );

      expect(model.routes).toHaveLength(count);
      for (const route of model.routes) {
        expectFinite(route);
      }
      // Model build must stay cheap enough to run on every layout change.
      expect(elapsedMs).toBeLessThan(500);
    });
  }
});

describe.each(['clean', 'realistic'] as const)('side-first rear routing — %s', (routingMode) => {
  const source = makeDevice({ id: 'mini', positionU: 4, widthType: 'custom', customWidthMm: 100, xMm: 120, depthMm: 120, ports: { ethernet: 2, power: 2 } });
  const destination = makeDevice({ id: 'target', positionU: 18, ports: { ethernet: 2, power: 2 } });
  const cable = makeCable({ id: 'rear-link', fromDeviceId: source.id, toDeviceId: destination.id, fromPort: { type: 'ethernet', index: 0 }, toPort: { type: 'ethernet', index: 0 } });
  const build = (extra: PlacedDevice[] = [], route = cable) => buildRackSceneModel(makeLayout({ devices: [source, destination, ...extra], cables: [route] }), { routingMode });
  const firstLateral = (route: ManagedRoute) => route.points.find((p) => Math.abs(p.x - route.fromPort.x) > 0.1)!;

  test('turns a shallow rear port sideways before travelling to the rear rack plane', () => {
    const model = build([makeDevice({ id: 'deep-other-row', positionU: 15, depthMm: 780 })]);
    const route = model.routes[0];
    expect(route.usesTrunk).toBe(true);
    const turn = firstLateral(route);
    expect(Math.abs(turn.z - route.fromPort.z)).toBeLessThan(0.12);
    expect(turn.x).toBeLessThan(-model.dimensions.rackWidth / 2);
    // Any long depth run after the socket exit belongs at the side.
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1];
      const b = route.points[i];
      if (Math.abs(a.z - b.z) > 0.3) expect(Math.abs(a.x)).toBeGreaterThan(model.dimensions.rackWidth / 2);
    }
  });

  test('clears a deeper neighbour in the same lateral corridor', () => {
    const neighbour = makeDevice({ id: 'deep-left', positionU: 4, widthType: 'custom', customWidthMm: 100, xMm: 0, depthMm: 500 });
    const model = build([neighbour]);
    const box = model.devices.find((d) => d.deviceId === neighbour.id)!.box;
    expect(firstLateral(model.routes[0]).z).toBeLessThan(box.z - box.depth / 2 - 0.06);
  });

  test('does not detour around a neighbour on the opposite side', () => {
    const neighbour = makeDevice({ id: 'deep-right', positionU: 4, widthType: 'custom', customWidthMm: 100, xMm: 330, depthMm: 700 });
    const route = build([neighbour]).routes[0];
    expect(Math.abs(firstLateral(route).z - route.fromPort.z)).toBeLessThan(0.12);
  });

  test('uses either rack side for data and power, with separate lanes', () => {
    for (const xMm of [0, 350]) {
      const shifted = { ...source, xMm };
      const routes = (['ethernet', 'power'] as const).map((type) => makeCable({ ...cable, id: type, type, fromPort: { type, index: 0 }, toPort: { type, index: 0 } }));
      const model = buildRackSceneModel(makeLayout({ devices: [shifted, destination], cables: routes }), { routingMode });
      for (const route of model.routes) expect(Math.sign(trunkX(route))).toBe(xMm === 0 ? -1 : 1);
      const laneZ = model.routes.map((route) => {
        const segment = route.points.slice(1).map((b, i) => ({ a: route.points[i], b }))
          .sort((a, b) => Math.abs(b.a.y - b.b.y) - Math.abs(a.a.y - a.b.y))[0];
        return segment.a.z;
      });
      expect(Math.abs(laneZ[0] - laneZ[1])).toBeGreaterThan(0.05);
    }
  });
});
