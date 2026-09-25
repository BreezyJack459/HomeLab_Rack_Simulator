import { Edges, Html } from '@react-three/drei';
import type { ReactNode } from 'react';
import type { DeviceWorldBox } from '../../utils/rackGeometry';

const noRaycast = () => null;

export function SelectionBox3D({ box }: { box: DeviceWorldBox }) {
  return (
    <mesh position={[box.x, box.y, box.z]} raycast={noRaycast}>
      <boxGeometry args={[box.width + 0.02, box.height + 0.02, box.depth + 0.02]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      <Edges color="#22d3ee" raycast={noRaycast} />
    </mesh>
  );
}

/** Only selected objects get screen-sized labels; the overview stays uncluttered. */
export function SceneLabel3D({ position, children, placement = 'above' }: {
  position: [number, number, number]; children: ReactNode; placement?: 'above' | 'below';
}) {
  return (
    <Html position={position} center occlude zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
      <div data-testid="scene-selection-label" className={`w-max max-w-52 rounded-lg border border-accent bg-surface px-3 py-2 text-xs text-content shadow-lg ${placement === 'above' ? '-translate-y-full' : 'translate-y-3'}`}>
        {children}
      </div>
    </Html>
  );
}
