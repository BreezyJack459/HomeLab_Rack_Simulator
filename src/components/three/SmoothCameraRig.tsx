import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Vector3 } from 'three';

type SmoothCameraRigProps = {
  position: [number, number, number];
  target?: [number, number, number];
  fitRequest?: number | string;
};

const DEFAULT_CAMERA_TARGET: [number, number, number] = [0, 0.2, 0];
const CONVERGENCE_THRESHOLD = 0.01;

export function SmoothCameraRig({ position, target = DEFAULT_CAMERA_TARGET, fitRequest = 0 }: SmoothCameraRigProps) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls as OrbitControlsImpl | undefined);
  const targetPosition = useMemo(() => new Vector3(...position), [position]);
  const targetLookAt = useMemo(() => new Vector3(...target), [target]);
  const isTransitioningRef = useRef(true);
  const reduceMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    // Selection/hover can update the suggested target without moving the view.
    // Only an explicit camera command, rack resize or canvas resize starts a fit.
    isTransitioningRef.current = true;
  }, [fitRequest]);

  useEffect(() => {
    const cancel = () => { isTransitioningRef.current = false; };
    controls?.addEventListener('start', cancel);
    return () => controls?.removeEventListener('start', cancel);
  }, [controls]);

  useFrame((_, delta) => {
    if (!isTransitioningRef.current) return;

    const posDist = camera.position.distanceTo(targetPosition);
    const targetDist = controls?.target?.distanceTo(targetLookAt) ?? Infinity;

    if (posDist < CONVERGENCE_THRESHOLD && targetDist < CONVERGENCE_THRESHOLD) {
      camera.position.copy(targetPosition);
      controls?.target.copy(targetLookAt);
      controls?.update();
      isTransitioningRef.current = false;
      return;
    }

    camera.position.lerp(targetPosition, reduceMotion ? 1 : 1 - Math.exp(-9 * delta));
    if (controls?.target) {
      controls.target.lerp(targetLookAt, reduceMotion ? 1 : 1 - Math.exp(-9 * delta));
      controls.update?.();
      return;
    }

    camera.lookAt(targetLookAt);
  });

  return null;
}
