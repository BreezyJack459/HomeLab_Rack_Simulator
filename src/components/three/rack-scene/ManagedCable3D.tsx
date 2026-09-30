import { Html, Text, useCursor } from '@react-three/drei';
import { useMemo, useState } from 'react';
import { CurvePath, LineCurve3, QuadraticBezierCurve3, Quaternion, Vector3, type Curve } from 'three';
import type { CableFocusMode } from '../../../store/cableWorkspaceStore';
import type { WorldPoint } from '../../../utils/rackGeometry';
import type { ManagedRoute } from '../../../utils/rackSceneModel';
import { managedRouteCurve } from '../../../utils/managedRouteCurve';

const VECTOR_Y_UP = new Vector3(0, 1, 0);

/** Convert canonical route points into a smooth, constant-radius curve. */
export function buildRouteCurve(points: WorldPoint[]): CurvePath<Vector3> | null {
  const segments = managedRouteCurve(points);
  if (!segments.length) return null;
  const vector = (point: WorldPoint) => new Vector3(point.x, point.y, point.z);
  const curve = new CurvePath<Vector3>();
  for (const segment of segments) {
    curve.add(segment.kind === 'line'
      ? new LineCurve3(vector(segment.from), vector(segment.to))
      : new QuadraticBezierCurve3(vector(segment.from), vector(segment.control), vector(segment.to)));
  }
  return curve;
}

function StrainRelief({
  curve,
  radius,
  color,
  atStart
}: {
  curve: Curve<Vector3>;
  radius: number;
  color: string;
  atStart: boolean;
}) {
  // The curve reference changes with every model rebuild, so the cheap
  // endpoint math below intentionally recomputes per render.
  const t = atStart ? 0 : 1;
  const tangent = curve.getTangentAt(t).normalize().multiplyScalar(atStart ? 1 : -1);
  // The socket face is the tip; the whole sleeve sits outside the chassis.
  const length = radius * 4;
  const endpoint = curve.getPointAt(t).addScaledVector(tangent, length / 2);
  const dot = VECTOR_Y_UP.dot(tangent);
  const quat = new Quaternion();
  if (Math.abs(dot) > 0.9999) {
    quat.setFromAxisAngle(new Vector3(1, 0, 0), dot > 0 ? 0 : Math.PI);
  } else {
    const axis = new Vector3().crossVectors(VECTOR_Y_UP, tangent).normalize();
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    quat.setFromAxisAngle(axis, angle);
  }

  return (
    <mesh position={endpoint} quaternion={quat} castShadow>
      <cylinderGeometry args={[radius * 1.15, radius * 1.5, length, 8]} />
      <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
    </mesh>
  );
}

/**
 * One individually selectable managed cable: strain-relief boots at both
 * canonical port endpoints, a constant-radius tube through management space,
 * and a restrained halo when selected. Non-selected routes stay fully
 * visible and colored in `all` focus mode.
 */
export function ManagedCable3D({
  route,
  selectedCableId,
  selectedCableIds,
  focusMode,
  onSelect,
  label
}: {
  route: ManagedRoute;
  selectedCableId: string | null;
  selectedCableIds: Set<string>;
  focusMode: CableFocusMode;
  onSelect: (id: string) => void;
  label: string;
}) {
  const [hovered, setHovered] = useState(false);
  const curve = useMemo(() => buildRouteCurve(route.points), [route]);
  const selected = selectedCableIds.has(route.cableId);
  const isMuted = focusMode !== 'all' && selectedCableId !== null && !selected;
  useCursor(hovered && !(isMuted && focusMode === 'hide'));
  if (!curve) return null;
  if (isMuted && focusMode === 'hide') return null;

  const radius = route.radiusMm / 1000;
  const bootRadius = route.discipline === 'power' ? radius * 1.25 : radius;
  const tubularSegments = Math.max(isMuted ? 30 : route.discipline === 'power' ? 72 : 60,
    Math.min(240, route.points.length * (isMuted ? 2 : 3)));
  const radialSegments = isMuted ? 6 : 10;
  const displayColor = isMuted ? '#64748b' : route.color;

  return (
    <group
      onClick={(event) => {
        if (event.delta > 4) return;
        event.stopPropagation();
        onSelect(route.cableId);
      }}
      onPointerOver={(event) => { event.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
    >
      {/* A wider invisible hit area makes thin cables easier to pick. */}
      <mesh>
        <tubeGeometry args={[curve, 48, Math.max(radius * 3, 0.022), 6, false]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      {hovered && !selected && <Html position={curve.getPointAt(0.5)} center zIndexRange={[9, 0]} style={{ pointerEvents: 'none' }}>
        <div className="w-52 -translate-y-full rounded-md border border-edge-strong bg-surface px-3 py-2 text-xs text-content shadow-lg">{label}</div>
      </Html>}
      <StrainRelief curve={curve} radius={bootRadius} color={isMuted ? '#475569' : route.color} atStart />
      <StrainRelief curve={curve} radius={bootRadius} color={isMuted ? '#475569' : route.color} atStart={false} />

      {selected && (
        <mesh>
          <tubeGeometry args={[curve, 60, radius * 2.4, 10, false]} />
          <meshStandardMaterial
            color={route.color}
            emissive={route.color}
            emissiveIntensity={0.4}
            opacity={0.16}
            transparent
            depthWrite={false}
            roughness={1}
            metalness={0}
          />
        </mesh>
      )}

      <mesh castShadow>
        <tubeGeometry args={[curve, tubularSegments, selected ? radius * 1.6 : radius, radialSegments, false]} />
        <meshStandardMaterial
          color={displayColor}
          emissive={displayColor}
          emissiveIntensity={selected || hovered ? 0.35 : isMuted ? 0.01 : 0.04}
          opacity={selected ? 1 : isMuted ? 0.2 : 1}
          transparent={isMuted}
          depthWrite={!isMuted}
          roughness={0.9}
          metalness={0}
        />
      </mesh>
    </group>
  );
}

/** Translucent preview tube for the planner's not-yet-saved cable. */
export function GhostManagedCable3D({ route }: { route: ManagedRoute }) {
  const curve = useMemo(() => buildRouteCurve(route.points), [route]);
  if (!curve) return null;
  const radius = route.radiusMm / 1000;
  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 56, radius * 1.45, 10, false]} />
        <meshStandardMaterial
          color={route.color}
          emissive={route.color}
          emissiveIntensity={0.16}
          opacity={0.38}
          transparent
          depthWrite={false}
          roughness={0.95}
          metalness={0}
        />
      </mesh>
      <Text position={curve.getPointAt(0.5)} fontSize={0.032} color="#a5f3fc" anchorX="center" anchorY="middle">
        Preview
      </Text>
    </group>
  );
}
