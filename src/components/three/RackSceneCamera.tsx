import { useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import type { RackWorldDimensions, WorldPoint } from '../../utils/rackGeometry';
import { SceneSetup } from './SceneSetup';
import { SmoothCameraRig } from './SmoothCameraRig';
import { buildCameraPresets, fitCameraToPoints, orbitLimits, SCENE_FOV, type CableCameraPreset } from './rack-scene/cameraPresets';

export type SceneFocus = { points: WorldPoint[]; direction: [number, number, number] };
const NO_POINTS: WorldPoint[] = [];

/** Shared by both viewers; resizing and explicit Fit commands reframe the scene. */
export function RackSceneCamera({ dimensions, preset, fitRequest, focus, extraPoints = NO_POINTS }: {
  dimensions: RackWorldDimensions;
  preset: CableCameraPreset;
  fitRequest: number;
  focus?: SceneFocus;
  extraPoints?: WorldPoint[];
}) {
  const size = useThree((state) => state.size);
  const aspect = size.width / Math.max(1, size.height);
  const presets = useMemo(() => buildCameraPresets(dimensions, aspect, extraPoints), [dimensions, aspect, extraPoints]);
  const active = useMemo(() => focus
    ? fitCameraToPoints(focus.points, focus.direction, aspect)
    : presets[preset], [focus, aspect, presets, preset]);
  const limits = orbitLimits(dimensions);
  const fitDistance = Math.hypot(...active.position.map((v, i) => v - active.target[i]));
  return (
    <>
      <SceneSetup
        cameraPosition={presets.overview.position}
        controlsTarget={presets.overview.target}
        fov={SCENE_FOV}
        groundY={dimensions.bottom - 0.08}
        groundSize={[Math.max(12, dimensions.rackWidth * 3), Math.max(12, dimensions.rackDepth * 3)]}
        minDistance={limits.min}
        maxDistance={Math.max(limits.max, fitDistance * 1.5)}
      />
      <SmoothCameraRig position={active.position} target={active.target}
        fitRequest={`${fitRequest}:${size.width}:${size.height}:${dimensions.rackWidth}:${dimensions.rackHeight}:${dimensions.rackDepth}:${active.position.join(',')}:${active.target.join(',')}`} />
    </>
  );
}
