import { Edges } from '@react-three/drei';
import { getCableManagerBodyParts, type DeviceWorldBox } from '../../utils/rackGeometry';
import { UNIT_BOX_GEOMETRY } from './sharedGeometries';

/** Open in both 3D views, so a legitimate pass-through never looks like a collision. */
export function CableManagerBody3D({ box, selected = false }: { box: DeviceWorldBox; selected?: boolean }) {
  return <>
    {getCableManagerBodyParts(box).map((part, index) => <mesh key={index}
      position={[part.center.x, part.center.y, part.center.z]}
      scale={[part.size.x, part.size.y, part.size.z]} castShadow receiveShadow>
      <primitive attach="geometry" object={UNIT_BOX_GEOMETRY} />
      <meshStandardMaterial color="#475569" metalness={0.2} roughness={0.7} />
      {selected && <Edges color="#22d3ee" raycast={() => null} />}
    </mesh>)}
  </>;
}
