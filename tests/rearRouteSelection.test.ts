import { describe, expect, it } from 'vitest';
import { buildRackSceneModel } from '../src/utils/rackSceneModel';
import {
  getRouteObstacles,
  overlapsObstacle,
  routeIsClear,
  routeLength
} from '../src/utils/routeFeasibility';
import type { CableRoute, PlacedDevice, RackLayout } from '../src/types/rack';

const device = (id: string, positionU: number, patch: Partial<PlacedDevice> = {}): PlacedDevice => ({
  id,
  name: id,
  category: 'server',
  positionU,
  sizeU: 1,
  depthMm: 400,
  widthType: '19in',
  ports: { ethernet: 2 },
  color: '#64748b',
  weightKg: 1,
  powerW: 10,
  heatLevel: 1,
  ...patch
});
const cable: CableRoute = {
  id: 'link',
  type: 'ethernet',
  color: '#38bdf8',
  fromDeviceId: 'a',
  toDeviceId: 'b',
  fromPort: { type: 'ethernet', index: 0 },
  toPort: { type: 'ethernet', index: 0 }
};
const layout = (devices: PlacedDevice[], cables = [cable], heightU = 18): RackLayout => ({
  id: 'candidate-fixture',
  name: 'Candidate fixture',
  rackType: '19in',
  heightU,
  rackDepthMm: 800,
  weightLimitKg: 500,
  powerBudgetW: 4000,
  viewSide: 'rear',
  devices,
  cables,
  updatedAt: '2026-09-09'
});

for (const routingMode of ['clean', 'realistic'] as const)
  describe(`rear route selection — ${routingMode}`, () => {
    it('uses a clear natural drop without adding hardware or going to the back rail', () => {
      const input = layout([device('a', 10), device('b', 6)]);
      const route = buildRackSceneModel(input, { routingMode }).routes[0];
      expect(route.routingDecision.kind).toBe('drop');
      expect(route.usesTrunk).toBe(false);
      expect(route.crossovers).toEqual([]);
      expect(route.rearGuides).toEqual([]);
      expect(routeLength(route.points)).toBeLessThan(1.3);
      expect(Math.max(...route.points.map((point) => Math.abs(point.x)))).toBeLessThan(1.86);
    });

    it('connects nearby devices directly with socket-aligned lead-outs', () => {
      const input = layout([
        device('a', 10, { widthType: 'custom', customWidthMm: 100, xMm: 60 }),
        device('b', 10, { widthType: 'custom', customWidthMm: 100, xMm: 210 })
      ]);
      const route = buildRackSceneModel(input, { routingMode }).routes[0];
      expect(route.routingDecision.kind).toBe('direct');
      expect(route.points[1].x).toBe(route.fromPort.x);
      expect(route.points[1].z).toBeLessThan(route.fromPort.z);
      expect(route.points[route.points.length - 2].z).toBeLessThan(route.toPort.z);
    });

    it('rejects a drop through intervening equipment and selects a clear side route', () => {
      const input = layout([device('a', 10), device('b', 6), device('blocker', 8, { depthMm: 750 })]);
      const route = buildRackSceneModel(input, { routingMode }).routes[0];
      expect(route.routingDecision.kind).toBe('side');
      expect(
        routeIsClear(
          route.points,
          getRouteObstacles(input).filter((obstacle) => obstacle.kind === 'body')
        )
      ).toBe(true);
      expect(route.points.some((point) => Math.abs(point.x) > 1.86)).toBe(true);
    });

    it('reports an impossible imported layout instead of drawing an unchecked fallback', () => {
      const input = layout([
        device('a', 10),
        device('b', 6),
        device('overlapping-import', 10, { mountSide: 'rear', depthMm: 800 })
      ]);
      const route = buildRackSceneModel(input, { routingMode }).routes[0];
      expect(route.routingDecision.kind).toBe('blocked');
      expect(route.points).toEqual([]);
      expect(route.crossovers).toEqual([]);
    });

    it('moves added supports away from a PDU and its socket access envelopes', () => {
      const input = layout(
        [
          device('a', 1, {
            category: 'switch',
            widthType: 'custom',
            customWidthMm: 100,
            xMm: 350,
            depthMm: 100
          }),
          device('b', 4, { category: 'patch-panel', depthMm: 65, ports: { ethernet: 24 } }),
          device('pdu', 4, { category: 'pdu', mountSide: 'rear', depthMm: 50, ports: { power: 8 } })
        ],
        [{ ...cable, toPort: { type: 'ethernet', index: 0, side: 'rear' } }],
        4
      );
      const model = buildRackSceneModel(input, { routingMode });
      expect(model.crossovers.length).toBeGreaterThan(0);
      const pduObstacles = getRouteObstacles(input).filter((obstacle) => obstacle.owner === 'pdu');
      for (const support of model.crossovers) {
        const envelopes = [
          ...support.members,
          ...support.clips.map((center) => ({ center, size: { x: 0.03, y: 0.18, z: 0.18 } }))
        ];
        for (const part of envelopes)
          for (const obstacle of pduObstacles) expect(overlapsObstacle(part, obstacle, 0.015)).toBe(false);
      }
    });
  });

it('Clean and Realistic keep the same route family, rail and support selection', () => {
  for (const blocker of [false, true]) {
    const input = layout([
      device('a', 10),
      device('b', 6),
      ...(blocker ? [device('obstacle', 8, { depthMm: 750 })] : [])
    ]);
    const clean = buildRackSceneModel(input, { routingMode: 'clean' }).routes[0];
    const realistic = buildRackSceneModel(input, { routingMode: 'realistic' }).routes[0];
    expect(realistic.routingDecision).toEqual(clean.routingDecision);
    expect(realistic.crossovers.map((support) => support.id)).toEqual(
      clean.crossovers.map((support) => support.id)
    );
  }
});

it('detects thin blockers between route points', () => {
  expect(
    routeIsClear(
      [
        { x: -1, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 }
      ],
      [
        {
          owner: 'thin-panel',
          kind: 'body',
          center: { x: 0.123, y: 0, z: 0 },
          size: { x: 0.005, y: 1, z: 1 }
        }
      ]
    )
  ).toBe(false);
});
