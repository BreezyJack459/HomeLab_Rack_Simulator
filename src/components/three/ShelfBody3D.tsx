import type { PlacedDevice } from '../../types/rack';
import { getShelfBodyParts, type DeviceWorldBox } from '../../utils/rackGeometry';

export function ShelfBody3D({ device, box, selected = false }: { device: PlacedDevice; box: DeviceWorldBox; selected?: boolean }) {
  return <group name={`tray-shelf-${device.id}`}>
    {getShelfBodyParts(device, box).map((part, index) => <mesh key={index} castShadow receiveShadow position={[part.center.x, part.center.y, part.center.z]}>
      <boxGeometry args={[part.size.x, part.size.y, part.size.z]} />
      <meshStandardMaterial color={selected ? '#0891b2' : device.color} roughness={0.65} metalness={0.3} />
    </mesh>)}
  </group>;
}
