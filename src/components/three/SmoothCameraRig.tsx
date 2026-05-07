import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { Vector3 } from 'three';

type SmoothCameraRigProps = {
  position: [number, number, number];
  target?: [number, number, number];
};

const DEFAULT_CAMERA_TARGET: [number, number, number] = [0, 0.2, 0];

export function SmoothCameraRig({ position, target = DEFAULT_CAMERA_TARGET }: SmoothCameraRigProps) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls as { target?: Vector3; update?: () => void } | undefined);
  const targetPosition = useMemo(() => new Vector3(...position), [position]);
  const targetLookAt = useMemo(() => new Vector3(...target), [target]);

  useFrame(() => {
    camera.position.lerp(targetPosition, 0.09);
    if (controls?.target) {
      controls.target.lerp(targetLookAt, 0.12);
      controls.update?.();
      return;
    }

    camera.lookAt(targetLookAt);
  });

  return null;
}
