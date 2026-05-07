import { Text } from '@react-three/drei';
import type { RackLayout } from '../../types/rack';
import { RACK_SPECS } from '../../utils/rackMath';
import { useRackStore } from '../../store/rackStore';
import { DeviceModel } from './DeviceModel';
import { UNIT_BOX_GEOMETRY } from './sharedGeometries';

const U_HEIGHT = 0.18;
const POST_SIZE = 0.045;
const FRONT_EAR_WIDTH = 0.18;

interface RackModelProps {
  layout: RackLayout;
}

function Rail({ position, scale }: { position: [number, number, number]; scale: [number, number, number] }) {
  return (
    <mesh position={position} scale={scale} castShadow receiveShadow>
      <primitive attach="geometry" object={UNIT_BOX_GEOMETRY} />
      <meshStandardMaterial color="#334155" metalness={0.45} roughness={0.34} />
    </mesh>
  );
}

export function RackModel({ layout }: RackModelProps) {
  const selectedDeviceId = useRackStore((state) => state.selectedDeviceId);
  const rackHeight = layout.heightU * U_HEIGHT;
  const width = layout.rackType === '10in' ? 1.95 : 3.72;
  const depth = Math.max(1.4, Math.min(3.3, layout.rackDepthMm / 210));
  const bottom = -rackHeight / 2;
  const label = RACK_SPECS[layout.rackType].label;

  return (
    <group position={[0, 0.1, 0]}>
      <Text
        position={[0, rackHeight / 2 + 0.28, depth / 2 + 0.08]}
        fontSize={0.12}
        color="#e5e7eb"
        anchorX="center"
        anchorY="middle"
      >
        {`${label} / ${layout.heightU}U`}
      </Text>

      {[-1, 1].flatMap((xSide) =>
        [-1, 1].map((zSide) => (
          <Rail
            key={`${xSide}-${zSide}`}
            position={[xSide * (width / 2), 0, zSide * (depth / 2)]}
            scale={[POST_SIZE, rackHeight, POST_SIZE]}
          />
        ))
      )}

      {Array.from({ length: layout.heightU + 1 }, (_, index) => {
        const y = bottom + index * U_HEIGHT;
        const isTopOrBottom = index === 0 || index === layout.heightU;
        return (
          <group key={index}>
            {isTopOrBottom && <Rail position={[0, y, depth / 2]} scale={[width + POST_SIZE, 0.014, POST_SIZE]} />}
            {!isTopOrBottom && (
              <>
                <Rail
                  position={[-width / 2 + FRONT_EAR_WIDTH / 2, y, depth / 2]}
                  scale={[FRONT_EAR_WIDTH, 0.014, POST_SIZE]}
                />
                <Rail
                  position={[width / 2 - FRONT_EAR_WIDTH / 2, y, depth / 2]}
                  scale={[FRONT_EAR_WIDTH, 0.014, POST_SIZE]}
                />
              </>
            )}
            <Rail position={[0, y, -depth / 2]} scale={[width + POST_SIZE, 0.014, POST_SIZE]} />
            <Rail position={[-width / 2, y, 0]} scale={[POST_SIZE, 0.014, depth + POST_SIZE]} />
            <Rail position={[width / 2, y, 0]} scale={[POST_SIZE, 0.014, depth + POST_SIZE]} />
          </group>
        );
      })}

      <mesh position={[0, bottom - 0.035, 0]} receiveShadow>
        <boxGeometry args={[width + 0.18, 0.045, depth + 0.18]} />
        <meshStandardMaterial color="#111827" roughness={0.82} />
      </mesh>

      {layout.devices.map((device) => (
        <DeviceModel key={device.id} device={device} layout={layout} rackWidth={width} rackDepth={depth} rackHeight={rackHeight} selected={device.id === selectedDeviceId} />
      ))}

      {Array.from({ length: layout.heightU }, (_, index) => {
        const unit = index + 1;
        const y = bottom + (unit - 0.5) * U_HEIGHT;
        if (layout.heightU > 18 && unit % 2 === 0) return null;
        return (
          <Text
            key={unit}
            position={[-width / 2 - 0.14, y, depth / 2 + 0.02]}
            fontSize={0.045}
            color="#94a3b8"
            anchorX="right"
            anchorY="middle"
          >
            {`U${unit}`}
          </Text>
        );
      })}
    </group>
  );
}
