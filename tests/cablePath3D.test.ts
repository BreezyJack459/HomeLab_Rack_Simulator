import { expect, test } from 'vitest';
import { sampleLayouts } from '../src/data/sampleLayouts';
import type { RackLayout } from '../src/types/rack';
import { buildCablePath3D } from '../src/utils/cablePath3D';
import { getDevicePortWorldPosition } from '../src/utils/rackGeometry';
import { calculateCablePlan } from '../src/utils/routing';

const edgeLab = sampleLayouts.find((layout) => layout.id === 'sample-10in-edge-lab') as RackLayout;

test('realistic front patch routes bow farther forward for rounded service loops', () => {
  const cable = edgeLab.cables.find((item) => item.id === 'sample10-cable-1');
  expect(cable).toBeTruthy();

  const plan = calculateCablePlan(cable!, edgeLab);
  expect(plan).toBeTruthy();
  expect(plan?.discipline).toBe('patch');

  const rackHeight = edgeLab.heightU * 0.44;
  const rackWidth = 1.95;
  const rackDepth = Math.max(1.4, Math.min(3.3, edgeLab.rackDepthMm / 210));
  const dimensions = { rackWidth, rackDepth, rackHeight, bottom: -rackHeight / 2 };
  const from = edgeLab.devices.find((device) => device.id === cable!.fromDeviceId);
  const to = edgeLab.devices.find((device) => device.id === cable!.toDeviceId);
  expect(from).toBeTruthy();
  expect(to).toBeTruthy();

  const fromPort = getDevicePortWorldPosition(edgeLab, from!, cable!.fromPort, dimensions);
  const toPort = getDevicePortWorldPosition(edgeLab, to!, cable!.toPort, dimensions);
  const frontPlane = Math.max(fromPort.z, toPort.z);

  const cleanCurve = buildCablePath3D(cable!, plan!, edgeLab, rackWidth, rackDepth, rackHeight, 0, 'clean');
  const realisticCurve = buildCablePath3D(cable!, plan!, edgeLab, rackWidth, rackDepth, rackHeight, 0, 'realistic');

  expect(cleanCurve).toBeTruthy();
  expect(realisticCurve).toBeTruthy();

  const cleanMaxZ = Math.max(...cleanCurve!.points.map((point) => point.z));
  const realisticMaxZ = Math.max(...realisticCurve!.points.map((point) => point.z));
  const realisticMinY = Math.min(...realisticCurve!.points.map((point) => point.y));
  const lowerPortY = Math.min(fromPort.y, toPort.y);

  expect(cleanMaxZ).toBeGreaterThan(frontPlane);
  expect(realisticMaxZ).toBeGreaterThan(cleanMaxZ + 0.03);
  expect(realisticCurve!.points.length).toBeGreaterThan(cleanCurve!.points.length);
  expect(realisticMinY).toBeLessThan(lowerPortY - 0.04);
});
