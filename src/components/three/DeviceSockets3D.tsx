import { Text } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useMemo, useState } from 'react';
import type { PlacedDevice, PortType } from '../../types/rack';
import { useRackStore } from '../../store/rackStore';
import { getDevicePortSurfaces, PORT_SOCKET_DEPTH, type DeviceWorldBox } from '../../utils/rackGeometry';
import { portChoicesForDevice, portKey, resolveCompatibleCable } from '../../utils/portSelection';
import { UNIT_BOX_GEOMETRY } from './sharedGeometries';

/** Both 3D viewers draw the same sockets that the router connects to. */
export function DeviceSockets3D({ device, box, allowPicking = false }: {
  device: PlacedDevice; box: DeviceWorldBox; allowPicking?: boolean;
}) {
  const surfaces = useMemo(() => getDevicePortSurfaces(device, box), [device, box]);
  const pairingStage = useRackStore((state) => state.pairingStage);
  const onPortPick = useRackStore((state) => state.onPortPick3D);
  const layout = useRackStore(s => s.layout);
  const source = useRackStore(s => s.pairingSource);
  const choices = useMemo(() => portChoicesForDevice(device, layout), [device, layout]);
  const [hovered, setHovered] = useState<string | null>(null);
  const picking = allowPicking && pairingStage !== 'idle' && pairingStage !== 'review';
  return <>
    {surfaces.map((surface) => surface.slots.map((slot) => {
      const key = `${surface.face}-${slot.key}`;
      const choice = choices.find(c => c.type === slot.type && c.index === slot.index && (box.isZeroU || c.side === surface.face));
      const selected = choice && source?.deviceId === device.id && portKey(source.port) === portKey(choice);
      const available = choice && !choice.disabled && (!source || resolveCompatibleCable(layout, source, choice));
      const active = !!selected || (picking && !!available && hovered === key);
      const pick = (event: ThreeEvent<MouseEvent>) => {
        if (event.delta > 4) return;
        if (!available) { event.stopPropagation(); return; }
        event.stopPropagation();
        onPortPick?.({ deviceId: device.id, portType: slot.type as PortType, portIndex: slot.index, face: surface.face, cableTypes: [] });
      };
      return <group key={key} position={[slot.position.x, slot.position.y, slot.position.z]} rotation={[0, surface.rotationY, 0]}>
        <mesh position={[0, 0, -PORT_SOCKET_DEPTH / 2]} scale={[slot.width, slot.height, PORT_SOCKET_DEPTH]}
          onClick={picking ? pick : undefined}
          onPointerOver={picking ? (event) => { event.stopPropagation(); setHovered(key); } : undefined}
          onPointerOut={picking ? () => setHovered(null) : undefined}>
          <primitive attach="geometry" object={UNIT_BOX_GEOMETRY} />
          <meshStandardMaterial color={active ? '#ffffff' : picking && !available ? '#475569' : slot.color} emissive={slot.emissive} emissiveIntensity={active ? 1 : 0.35} roughness={0.6} metalness={0.15} />
        </mesh>
        {(surface.slots.length <= 24 || active) && <Text position={[0, slot.height / 2 + 0.012, 0.001]}
          fontSize={Math.min(0.018, slot.width * 0.4)} color="#e2e8f0" outlineColor="#0f172a" outlineWidth={0.001}
          anchorX="center" anchorY="bottom">
          {slot.index + 1}
        </Text>}
        {allowPicking && slot.speed && (surface.slots.length <= 24 || active) && <Text
          position={[0, -slot.height / 2 - 0.008, 0.001]} fontSize={Math.min(0.011, slot.width * 0.28)}
          color="#e2e8f0" outlineColor="#0f172a" outlineWidth={0.001} anchorX="center" anchorY="top">
          {`${slot.speed}${slot.mediaType && slot.mediaType !== 'rj45' ? ` ${slot.mediaType}` : ''}`}
        </Text>}
      </group>;
    }))}
  </>;
}
