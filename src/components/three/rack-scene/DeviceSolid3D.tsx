import { Text } from '@react-three/drei';
import type { PlacedDevice } from '../../../types/rack';
import { getZeroUEarSide } from '../../../utils/rackMath';
import { ZERO_U_REAR_GAP, ZERO_U_SIDE_GAP } from '../../../utils/rackGeometry';
import type { DeviceSolid } from '../../../utils/rackSceneModel';
import { DeviceSockets3D } from '../DeviceSockets3D';
import { CableManagerBody3D } from '../CableManagerBody3D';
import { ShelfBody3D } from '../ShelfBody3D';
import { isTrayShelf } from '../../../utils/rackMath';

/**
 * Opaque device solid with a faceplate plate and real port squares. Replaces
 * the old transparent device blocks; positions and sizes come straight from
 * the canonical scene model.
 */
export function DeviceSolid3D({
  solid,
  device
}: {
  solid: DeviceSolid;
  device: PlacedDevice;
}) {
  const { box } = solid;
  const height = box.height;
  if (isTrayShelf(device)) return <group position={[box.x, box.y, box.z]}><ShelfBody3D device={device} box={box} /></group>;

  if (solid.kind === 'hcm') {
    return (
      <group position={[box.x, box.y, box.z]}>
        <CableManagerBody3D box={box} />
      </group>
    );
  }

  if (solid.kind === 'zero-u-side') {
    const isLeft = getZeroUEarSide(device) === 'left';
    const innerFaceX = isLeft ? box.width / 2 : -box.width / 2;
    return (
      <group position={[box.x, box.y, box.z]}>
        {/* Rail bracket */}
        <mesh
          position={[isLeft ? box.width / 2 + ZERO_U_SIDE_GAP / 2 : -box.width / 2 - ZERO_U_SIDE_GAP / 2, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.006, 0.006, ZERO_U_SIDE_GAP, 8]} />
          <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.18} roughness={0.45} />
        </mesh>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[box.width, height, box.depth]} />
          <meshStandardMaterial color={solid.color} roughness={0.65} metalness={0.2} />
        </mesh>
        <Text
          position={[innerFaceX + (isLeft ? 0.03 : -0.03), height / 2 + 0.035, 0]}
          rotation={[0, isLeft ? Math.PI / 2 : -Math.PI / 2, 0]}
          fontSize={0.04}
          maxWidth={box.depth * 0.88}
          color="#e2e8f0"
          anchorX="center"
        >
          {solid.label}
        </Text>
        <DeviceSockets3D device={device} box={box} />
      </group>
    );
  }

  if (solid.kind === 'zero-u-rear') {
    const outletFacing = device.outletFacing ?? 'forward';
    const portZ = outletFacing === 'outward' ? -box.depth / 2 - 0.014 : box.depth / 2 + 0.014;
    return (
      <group position={[box.x, box.y, box.z]}>
        {/* Mounting brackets toward the rear rail */}
        <mesh position={[0, height * 0.46, box.depth / 2 + ZERO_U_REAR_GAP / 2]}>
          <boxGeometry args={[box.width * 0.72, 0.018, ZERO_U_REAR_GAP]} />
          <meshStandardMaterial color="#232f40" roughness={0.55} metalness={0.26} />
        </mesh>
        <mesh position={[0, -height * 0.46, box.depth / 2 + ZERO_U_REAR_GAP / 2]}>
          <boxGeometry args={[box.width * 0.72, 0.018, ZERO_U_REAR_GAP]} />
          <meshStandardMaterial color="#232f40" roughness={0.55} metalness={0.26} />
        </mesh>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[box.width, height, box.depth]} />
          <meshStandardMaterial color={solid.color} roughness={0.65} metalness={0.2} />
        </mesh>
        <DeviceSockets3D device={device} box={box} />
        {outletFacing !== 'inward' && (
          <>
            <Text
              position={[0, height / 2 + 0.035, portZ + (outletFacing === 'outward' ? -0.02 : 0.02)]}
              rotation={outletFacing === 'outward' ? [0, Math.PI, 0] : undefined}
              fontSize={0.04}
              maxWidth={Math.max(box.width * 2.2, 0.22)}
              color="#e2e8f0"
              anchorX="center"
            >
              {solid.label}
            </Text>

          </>
        )}
      </group>
    );
  }

  // Standard racked device: opaque body + faceplate plate + ports.
  return (
    <group position={[box.x, box.y, box.z]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[box.width, height, box.depth]} />
        <meshStandardMaterial color={solid.color} roughness={0.68} metalness={0.16} />
      </mesh>
      {/* Faceplate plates on both faces for a solid, finished look */}
      <mesh position={[0, 0, box.depth / 2 + 0.002]}>
        <boxGeometry args={[box.width, height * 0.96, 0.006]} />
        <meshStandardMaterial color={solid.faceColor} roughness={0.6} metalness={0.22} />
      </mesh>
      <mesh position={[0, 0, -box.depth / 2 - 0.002]}>
        <boxGeometry args={[box.width, height * 0.96, 0.006]} />
        <meshStandardMaterial color={solid.faceColor} roughness={0.6} metalness={0.22} />
      </mesh>
      <Text
        position={[0, height / 2 + 0.035, solid.mountSide === 'rear' ? -box.depth / 2 - 0.02 : box.depth / 2 + 0.02]}
        rotation={solid.mountSide === 'rear' ? [0, Math.PI, 0] : undefined}
        fontSize={0.04}
        maxWidth={box.width * 0.88}
        color="#e2e8f0"
        anchorX="center"
      >
        {solid.label}
      </Text>
      <DeviceSockets3D device={device} box={box} />
    </group>
  );
}
