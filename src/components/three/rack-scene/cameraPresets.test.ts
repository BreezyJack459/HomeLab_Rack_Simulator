import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { buildCameraPresets, fitCameraToPoints, SCENE_FOV, type CameraPresetValue } from './cameraPresets';
import type { WorldPoint } from '../../../utils/rackGeometry';

const expectInFrame = (preset: CameraPresetValue, aspect: number, points: WorldPoint[]) => {
  const camera = new PerspectiveCamera(SCENE_FOV, aspect, 0.1, 1000);
  camera.position.set(...preset.position);
  camera.lookAt(...preset.target);
  camera.updateMatrixWorld();
  for (const point of points) {
    const projected = new Vector3(point.x, point.y, point.z).project(camera);
    expect(Math.abs(projected.x)).toBeLessThan(0.95);
    expect(Math.abs(projected.y)).toBeLessThan(0.95);
    expect(projected.z).toBeGreaterThan(-1);
    expect(projected.z).toBeLessThan(1);
  }
};

describe('3D camera framing', () => {
  for (const heightU of [6, 18, 42]) {
    for (const aspect of [0.6, 1.6, 2.4]) {
      it(`frames every corner of a ${heightU}U rack at aspect ${aspect} in all views`, () => {
        const dimensions = { rackWidth: 3.72, rackDepth: 3.3, rackHeight: heightU * 0.18, bottom: -heightU * 0.09 };
        const corners = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => ({
          x: x * dimensions.rackWidth / 2, y: y * dimensions.rackHeight / 2, z: z * dimensions.rackDepth / 2,
        }))));
        for (const preset of Object.values(buildCameraPresets(dimensions, aspect))) expectInFrame(preset, aspect, corners);
      });
    }
  }

  it('includes side-mounted devices and cable bends outside the rack', () => {
    const dimensions = { rackWidth: 3.72, rackDepth: 3.3, rackHeight: 7.56, bottom: -3.78 };
    const extra = [{ x: -3.4, y: 1.2, z: -3.2 }, { x: 4.2, y: -3.7, z: 2.2 }];
    for (const preset of Object.values(buildCameraPresets(dimensions, 0.7, extra))) expectInFrame(preset, 0.7, extra);
  });

  it('fits the whole route including a bend beyond both endpoints', () => {
    const route = [{ x: 0, y: 2, z: 1.5 }, { x: 3.5, y: 2, z: 2.2 }, { x: 3.5, y: -3, z: -2.2 }, { x: 0, y: -3, z: -1.5 }];
    for (const aspect of [0.6, 1.6]) expectInFrame(fitCameraToPoints(route, [1, 0.5, -1.4], aspect), aspect, route);
  });

  it('keeps endpoint close-ups in front of the camera even for a single point', () => {
    const point = { x: -2, y: 3, z: -1.65 };
    expectInFrame(fitCameraToPoints([point], [0, 0.15, -1], 1), 1, [point]);
  });
});
