import { Text } from '@react-three/drei';
import { CatmullRomCurve3, Quaternion, Vector3 } from 'three';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import { CanvasWithRecovery } from './CanvasWithRecovery';
import type { CablePlan, CableRoute, CableType, PlacedDevice, RackLayout } from '../types/rack';
import { DEFAULT_CABLE_COLORS, getCableDisplayColor } from '../utils/cableColors';
import { buildCablePath3D } from '../utils/cablePath3D';
import { getPatchPanelLinkedCableIds } from '../utils/patchPanel';
import { calculateCablePlan } from '../utils/routing';
import { getDeviceMountSide, getDeviceSpatialZone, getZeroUEarSide } from '../utils/rackMath';
import { buildPortLayout } from '../utils/portLayout';
import {
  getDeviceWorldBox,
  RACK_3D_POST_SIZE as POST_SIZE,
  RACK_3D_U_HEIGHT as U_HEIGHT,
  ZERO_U_REAR_DEPTH,
  ZERO_U_REAR_GAP,
  ZERO_U_REAR_SIDE_OFFSET,
  ZERO_U_REAR_WIDTH,
  ZERO_U_SIDE_GAP
} from '../utils/rackGeometry';
import { DEBUG_SPHERE_GEOMETRY, UNIT_BOX_GEOMETRY, VCM_FINGER_GEOMETRY } from './three/sharedGeometries';
import { SceneSetup } from './three/SceneSetup';

const VECTOR_Y_UP = new Vector3(0, 1, 0);
const CABLE_CAMERA_POSITION: [number, number, number] = [4.8, 3.5, 6.4];
const CABLE_CAMERA_TARGET: [number, number, number] = [0.35, 0.05, 0];
const CABLE_GROUND_SIZE: [number, number] = [12, 10];

const CABLE_META: Record<CableType, { color: string; label: string; lane: number; radius: number }> = {
  ethernet: { color: DEFAULT_CABLE_COLORS.ethernet, label: 'Ethernet', lane: 0, radius: 0.009 },
  fiber: { color: DEFAULT_CABLE_COLORS.fiber, label: 'Fiber', lane: 1, radius: 0.007 },
  power: { color: DEFAULT_CABLE_COLORS.power, label: 'Power', lane: 2, radius: 0.012 },
  usb: { color: DEFAULT_CABLE_COLORS.usb, label: 'USB', lane: 3, radius: 0.008 },
  hdmi: { color: DEFAULT_CABLE_COLORS.hdmi, label: 'HDMI', lane: 4, radius: 0.011 },
  atx: { color: DEFAULT_CABLE_COLORS.atx, label: 'ATX', lane: 5, radius: 0.008 },
  coax: { color: DEFAULT_CABLE_COLORS.coax, label: 'Coax', lane: 6, radius: 0.01 },
  structured: { color: DEFAULT_CABLE_COLORS.structured, label: 'Structured', lane: 7, radius: 0.008 },
  patch: { color: DEFAULT_CABLE_COLORS.patch, label: 'Patch', lane: 0, radius: 0.009 }
};

type CableFocusMode = 'dim' | 'hide';
type CableTypeFilter = CableType | 'all';

interface CableViewer3DProps {
  typeFilter: CableTypeFilter;
  focusMode: CableFocusMode;
}

interface Route3D {
  cable: CableRoute;
  plan: CablePlan;
  from: PlacedDevice;
  to: PlacedDevice;
  curve: CatmullRomCurve3;
  color: string;
  radius: number;
}

/* ------------------------------------------------------------------ */
/*  Device geometry helpers                                           */
/* ------------------------------------------------------------------ */

function devicePosition(
  layout: RackLayout,
  device: PlacedDevice,
  rackWidth: number,
  rackDepth: number,
  rackHeight: number
) {
  return getDeviceWorldBox(layout, device, {
    rackWidth,
    rackDepth,
    rackHeight,
    bottom: -rackHeight / 2
  });
}

function translucentDeviceColor(device: PlacedDevice) {
  return device.category === 'cable-management' ? '#94a3b8' : device.color;
}

/** Render port squares on one face using the shared layout engine */
function DeviceFacePorts({
  device,
  faceZ,
  deviceWidth,
  deviceHeight,
  face,
}: {
  device: PlacedDevice;
  faceZ: number;
  deviceWidth: number;
  deviceHeight: number;
  face: 'front' | 'rear';
}) {
  const groups = buildPortLayout(device, deviceWidth, deviceHeight, face);
  if (groups.length === 0) return null;

  return (
    <group position={[0, 0, faceZ]}>
      {groups.map((group) => (
        <group key={group.key ?? group.type}>
          {group.slots.map((slot) => (
            <group key={slot.index} position={[slot.x, slot.y, 0.003]}>
              <mesh scale={[slot.width, slot.height, 0.004]}>
                <primitive attach="geometry" object={UNIT_BOX_GEOMETRY} />
                <meshStandardMaterial
                  color={group.color}
                  emissive={group.emissive}
                  emissiveIntensity={0.45}
                  roughness={0.5}
                  metalness={0.2}
                />
              </mesh>
              <Text
                fontSize={Math.min(0.014, slot.width * 0.4)}
                color="#0f172a"
                anchorX="center"
                anchorY="middle"
                position={[0, 0, 0.003]}
              >
                {`${slot.index + 1}`}
              </Text>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Strain-relief boot geometry                                       */
/* ------------------------------------------------------------------ */

function StrainRelief({
  curve,
  radius,
  color,
  atStart
}: {
  curve: CatmullRomCurve3;
  radius: number;
  color: string;
  atStart: boolean;
}) {
  // StrainRelief receives a new CatmullRomCurve3 on every render, so useMemo
  // on the curve reference would never hit. The math here is cheap enough to
  // recompute each frame (two getPointAt/getTangentAt calls per boot).
  const t = atStart ? 0 : 1;
  const endpoint = curve.getPointAt(t);
  const tangent = curve.getTangentAt(t).normalize();
  const dot = VECTOR_Y_UP.dot(tangent);
  const quat = new Quaternion();
  if (Math.abs(dot) > 0.9999) {
    quat.setFromAxisAngle(new Vector3(1, 0, 0), dot > 0 ? 0 : Math.PI);
  } else {
    const axis = new Vector3().crossVectors(VECTOR_Y_UP, tangent).normalize();
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    quat.setFromAxisAngle(axis, angle);
  }
  const pos = endpoint;

  return (
    <mesh position={pos} quaternion={quat} castShadow>
      {/* Much smaller, subtler boot: barely thicker than cable, short length */}
      <cylinderGeometry args={[radius * 1.5, radius * 1.15, radius * 2.5, 6]} />
      <meshStandardMaterial
        color={color}
        roughness={0.85}
        metalness={0.0}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Bundle helpers                                                    */
/* ------------------------------------------------------------------ */

function bundleColor(routes: Route3D[]): string {
  const counts = new Map<string, number>();
  routes.forEach((r) => {
    counts.set(r.color, (counts.get(r.color) ?? 0) + 1);
  });
  let bestColor = '#6B7280';
  let bestCount = 0;
  for (const [color, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestColor = color;
    }
  }
  return bestColor;
}

function bundleRadius(count: number): number {
  return 0.006 + count * 0.003;
}

/* ------------------------------------------------------------------ */
/*  Smooth tube cable renderer                                        */
/* ------------------------------------------------------------------ */

function CableTube({
  route,
  selectedCableId,
  selectedCableIds,
  typeFilter,
  focusMode,
  onSelect
}: {
  route: Route3D;
  selectedCableId: string | null;
  selectedCableIds: Set<string>;
  typeFilter: CableTypeFilter;
  focusMode: CableFocusMode;
  onSelect: (id: string) => void;
}) {
  const selected = selectedCableIds.has(route.cable.id);
  const muted = selectedCableId !== null && !selected;
  const typeMuted = selectedCableId === null && typeFilter === 'all' && route.cable.type === 'structured';
  const isMuted = muted || typeMuted;
  if (isMuted && focusMode === 'hide') return null;
  const bootRadius = route.plan.discipline === 'power' ? route.radius * 1.25 : route.radius;
  const tubularSegments = isMuted ? 30 : route.plan.discipline === 'power' ? 72 : 60;
  const radialSegments = isMuted ? 6 : 10;

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onSelect(route.cable.id);
      }}
    >
      {/* Strain relief boots at both ends */}
      <StrainRelief curve={route.curve} radius={bootRadius} color={isMuted ? '#475569' : route.color} atStart />
      <StrainRelief curve={route.curve} radius={bootRadius} color={isMuted ? '#475569' : route.color} atStart={false} />

      {/* Main cable jacket */}
      <mesh castShadow>
        <tubeGeometry args={[route.curve, tubularSegments, selected ? route.radius * 1.8 : route.radius, radialSegments, false]} />
        <meshStandardMaterial
          color={isMuted ? '#64748b' : route.color}
          emissive={isMuted ? '#0f172a' : route.color}
          emissiveIntensity={selected ? 0.45 : isMuted ? 0.02 : 0.12}
          opacity={selected ? 1 : isMuted ? 0.2 : 0.88}
          transparent
          roughness={0.72}
          metalness={0.02}
        />
      </mesh>
    </group>
  );
}

function BundleTube({
  routes,
  selectedCableId,
  selectedCableIds,
  typeFilter,
  focusMode,
  onSelect,
  onExpand
}: {
  routes: Route3D[];
  selectedCableId: string | null;
  selectedCableIds: Set<string>;
  typeFilter: CableTypeFilter;
  focusMode: CableFocusMode;
  onSelect: (id: string) => void;
  onExpand: () => void;
}) {
  const representative = routes[0];
  if (!representative) return null;

  const count = routes.length;
  const color = bundleColor(routes);
  const radius = bundleRadius(count);

  const anySelected = routes.some((r) => selectedCableIds.has(r.cable.id));
  const muted = selectedCableId !== null && !anySelected;
  const isMuted = muted || (selectedCableId === null && typeFilter === 'all' && representative.cable.type === 'structured');
  if (isMuted && focusMode === 'hide') return null;

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onExpand();
      }}
    >
      <mesh castShadow>
        <tubeGeometry args={[representative.curve, 60, anySelected ? radius * 1.6 : radius, 12, false]} />
        <meshStandardMaterial
          color={isMuted ? '#64748b' : color}
          emissive={isMuted ? '#0f172a' : color}
          emissiveIntensity={anySelected ? 0.35 : isMuted ? 0.02 : 0.1}
          opacity={anySelected ? 1 : isMuted ? 0.2 : 0.88}
          transparent
          roughness={0.72}
          metalness={0.02}
        />
      </mesh>
      {/* Bundle count label */}
      <Text
        position={representative.curve.getPointAt(0.5)}
        fontSize={0.035}
        color={isMuted ? '#94a3b8' : '#e2e8f0'}
        anchorX="center"
        anchorY="middle"
      >
        {`Bundle: ${count} cables`}
      </Text>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export function CableViewer3D({ typeFilter, focusMode }: CableViewer3DProps) {
  const layout = useRackStore((state) => state.layout);
  const selectedCableId = useRackStore((state) => state.selectedCableId);
  const selectCable = useRackStore((state) => state.selectCable);
  const debugMode = useRackStore((state) => state.debugMode);
  const cableRoutingMode = useRackStore((state) => state.cableRoutingMode);
  const setCableRoutingMode = useRackStore((state) => state.setCableRoutingMode);
  const rackHeight = layout.heightU * U_HEIGHT;
  const rackWidth = layout.rackType === '10in' ? 1.95 : 3.72;
  const rackDepth = Math.max(1.4, Math.min(3.3, layout.rackDepthMm / 210));
  const bottom = -rackHeight / 2;
  const selectedCableIds = useMemo(
    () => getPatchPanelLinkedCableIds(layout, selectedCableId),
    [layout.cables, layout.devices, selectedCableId]
  );
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(new Set());

  const visibleRoutes = useMemo(() => {
    const perTypeCounts = new Map<CableType, number>();
    return layout.cables
      .filter((cable) => typeFilter === 'all' || cable.type === typeFilter || selectedCableIds.has(cable.id))
      .map((cable): Route3D | null => {
        const from = layout.devices.find((device) => device.id === cable.fromDeviceId);
        const to = layout.devices.find((device) => device.id === cable.toDeviceId);
        if (!from || !to) return null;
        const plan = calculateCablePlan(cable, layout);
        if (!plan) return null;
        const meta = CABLE_META[cable.type];
        const typeIndex = perTypeCounts.get(cable.type) ?? 0;
        perTypeCounts.set(cable.type, typeIndex + 1);
        const curve = buildCablePath3D(cable, plan, layout, rackWidth, rackDepth, rackHeight, typeIndex, cableRoutingMode);
        if (!curve) return null;
        return {
          cable,
          plan,
          from,
          to,
          curve,
          color: getCableDisplayColor(cable.type, cable.color || meta.color),
          radius: Math.max(meta.radius, plan.render.cableRadiusMm / 1000)
        };
      })
      .filter(Boolean) as Route3D[];
  }, [layout.cables, layout.devices, layout.rackType, layout.rackDepthMm, layout.heightU, rackDepth, rackHeight, rackWidth, typeFilter, selectedCableIds, cableRoutingMode]);

  const recommendation = useMemo(() => {
    const managementCount = layout.devices.filter((device) => device.category === 'cable-management').length;
    const rearPower = layout.cables.filter((cable) => cable.type === 'power').length;
    if (layout.cables.length >= 6 && managementCount === 0) return 'Add a 1U cable manager or brush panel near the busiest patch area.';
    if (rearPower >= 3) return 'Power routes split to the nearest side tray; use the rear PDU and lacing bar for strain relief.';
    if (layout.cables.length >= 4) return 'Group Ethernet and power into separate side trays to keep service access clear.';
    return 'Cable routes use side trays first, then vertical drops, so paths stay readable.';
  }, [layout.cables, layout.devices]);
  const maxDpr = visibleRoutes.length > 60 ? 1.25 : visibleRoutes.length > 30 ? 1.5 : 2;
  const canvasDpr: [number, number] = [1, Math.min(window.devicePixelRatio || 1, maxDpr)];

  return (
    <div className="relative h-[calc(100vh-250px)] min-h-[620px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel dark:border-slate-800 dark:bg-slate-950">
      <div className="absolute left-4 top-4 z-10 max-w-sm rounded-lg border border-slate-200 bg-white/88 px-4 py-3 text-sm shadow-panel dark:border-slate-800 dark:bg-slate-950/88">
        <div className="font-semibold text-slate-900 dark:text-white">3D cable routing</div>
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{recommendation}</div>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCableRoutingMode('clean')}
            className={`h-7 rounded border px-2 text-xs ${cableRoutingMode === 'clean' ? 'border-cyan-500 bg-cyan-500/20 text-cyan-800 dark:text-cyan-100' : 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}
          >
            Clean routing
          </button>
          <button
            type="button"
            onClick={() => setCableRoutingMode('realistic')}
            className={`h-7 rounded border px-2 text-xs ${cableRoutingMode === 'realistic' ? 'border-cyan-500 bg-cyan-500/20 text-cyan-800 dark:text-cyan-100' : 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}
          >
            Realistic routing
          </button>
        </div>
      </div>
      <CanvasWithRecovery shadows dpr={canvasDpr} data-testid="cable-routing-3d">
        <SceneSetup
          cameraPosition={CABLE_CAMERA_POSITION}
          fov={43}
          background="#080d14"
          controlsTarget={CABLE_CAMERA_TARGET}
          ambientIntensity={0.64}
          keyLightIntensity={1.2}
          groundSize={CABLE_GROUND_SIZE}
        />

        <group position={[0, 0.05, 0]}>
          {/* Rack posts */}
          {[-1, 1].flatMap((xSide) =>
            [-1, 1].map((zSide) => (
              <mesh
                key={`${xSide}-${zSide}`}
                position={[xSide * (rackWidth / 2), 0, zSide * (rackDepth / 2)]}
                scale={[POST_SIZE, rackHeight, POST_SIZE]}
                castShadow
                receiveShadow
              >
                <primitive attach="geometry" object={UNIT_BOX_GEOMETRY} />
                <meshStandardMaterial color="#334155" metalness={0.45} roughness={0.34} transparent opacity={0.72} />
              </mesh>
            ))
          )}

          {/* Rack rails */}
          {Array.from({ length: layout.heightU + 1 }, (_, index) => {
            const y = bottom + index * U_HEIGHT;
            return (
              <group key={index}>
                <mesh position={[0, y, rackDepth / 2]} scale={[rackWidth + POST_SIZE, 0.012, POST_SIZE]} receiveShadow>
                  <primitive attach="geometry" object={UNIT_BOX_GEOMETRY} />
                  <meshStandardMaterial color="#334155" transparent opacity={0.28} />
                </mesh>
                <mesh position={[0, y, -rackDepth / 2]} scale={[rackWidth + POST_SIZE, 0.012, POST_SIZE]} receiveShadow>
                  <primitive attach="geometry" object={UNIT_BOX_GEOMETRY} />
                  <meshStandardMaterial color="#334155" transparent opacity={0.2} />
                </mesh>
              </group>
            );
          })}

          {/* Vertical Cable Managers with finger details */}
          {[
            { side: 'right' as const, label: 'DATA VCM', color: '#38bdf8', railX: rackWidth / 2 + 0.18 },
            { side: 'left' as const, label: 'PWR VCM', color: '#fb923c', railX: -rackWidth / 2 - 0.18 }
          ].map((vcm) => (
            <group key={vcm.side}>
              {/* Main VCM body */}
              <mesh position={[vcm.railX, 0, rackDepth / 2 + 0.12]} scale={[0.1, rackHeight, 0.06]}>
                <primitive attach="geometry" object={UNIT_BOX_GEOMETRY} />
                <meshStandardMaterial color="#1e293b" metalness={0.3} roughness={0.6} />
              </mesh>
              {/* Finger rings */}
              {Array.from({ length: Math.floor(rackHeight / 0.14) }, (_, i) => {
                const y = -rackHeight / 2 + 0.08 + i * 0.14;
                return (
                  <group key={i} position={[vcm.railX, y, rackDepth / 2 + 0.16]}>
                    <mesh rotation={[0, 0, Math.PI / 2]}>
                      <primitive attach="geometry" object={VCM_FINGER_GEOMETRY} />
                      <meshStandardMaterial color={vcm.color} metalness={0.5} roughness={0.4} />
                    </mesh>
                  </group>
                );
              })}
              {/* Rear VCM body */}
              <mesh position={[vcm.railX, 0, -rackDepth / 2 - 0.12]} scale={[0.1, rackHeight, 0.06]}>
                <primitive attach="geometry" object={UNIT_BOX_GEOMETRY} />
                <meshStandardMaterial color="#1e293b" metalness={0.3} roughness={0.6} transparent opacity={0.6} />
              </mesh>
              {/* Label */}
              <Text
                position={[vcm.railX + (vcm.side === 'left' ? -0.18 : 0.18), rackHeight / 2 + 0.12, rackDepth / 2 + 0.12]}
                fontSize={0.05}
                color={vcm.color}
                anchorX={vcm.side === 'left' ? 'right' : 'left'}
              >
                {vcm.label}
              </Text>
            </group>
          ))}

          {/* Devices */}
          {layout.devices.map((device) => {
            const pos = devicePosition(layout, device, rackWidth, rackDepth, rackHeight);
            const isZeroU = device.sizeU === 0;
            const isRearRail0U = isZeroU && device.mountType !== 'side-rail';
            const height = pos.height;
            const isHCM = device.category === 'cable-management';
            const isZeroULeft = isZeroU && getZeroUEarSide(device) === 'left';
            const outletFacing = device.outletFacing ?? 'forward';
            const innerFaceX = isZeroULeft ? pos.width / 2 : -pos.width / 2;
            const zeroUPortZ = outletFacing === 'outward' ? -pos.depth / 2 - 0.014 : pos.depth / 2 + 0.014;
            return (
              <group key={device.id} position={[pos.x, pos.y, pos.z]}>
                {isZeroU && (
                  <>
                    {isRearRail0U ? (
                      <>
                        <mesh position={[0, height * 0.46, pos.depth / 2 + ZERO_U_REAR_GAP / 2]}>
                          <boxGeometry args={[pos.width * 0.72, 0.018, ZERO_U_REAR_GAP]} />
                          <meshStandardMaterial color="#1e293b" roughness={0.55} metalness={0.26} />
                        </mesh>
                        <mesh position={[0, -height * 0.46, pos.depth / 2 + ZERO_U_REAR_GAP / 2]}>
                          <boxGeometry args={[pos.width * 0.72, 0.018, ZERO_U_REAR_GAP]} />
                          <meshStandardMaterial color="#1e293b" roughness={0.55} metalness={0.26} />
                        </mesh>
                      </>
                    ) : (
                      <mesh
                        position={[isZeroULeft ? pos.width / 2 + ZERO_U_SIDE_GAP / 2 : -pos.width / 2 - ZERO_U_SIDE_GAP / 2, 0, 0]}
                        rotation={[0, 0, Math.PI / 2]}
                      >
                        <cylinderGeometry args={[0.006, 0.006, ZERO_U_SIDE_GAP, 8]} />
                        <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.18} roughness={0.45} />
                      </mesh>
                    )}
                  </>
                )}
                {isHCM ? (
                  <>
                    {/* Horizontal Cable Manager: slotted front face */}
                    <mesh castShadow receiveShadow>
                      <boxGeometry args={[pos.width, height, pos.depth]} />
                      <meshStandardMaterial color="#1e293b" metalness={0.2} roughness={0.7} />
                    </mesh>
                    {/* Finger slots */}
                    {Array.from({ length: Math.max(4, Math.floor(pos.width / 0.08)) }, (_, i) => (
                      <mesh
                        key={i}
                        position={[
                          -pos.width / 2 + 0.04 + i * (pos.width / Math.max(4, Math.floor(pos.width / 0.08))),
                          0,
                          pos.depth / 2 + 0.005
                        ]}
                      >
                        <boxGeometry args={[0.006, height * 0.8, 0.012]} />
                        <meshStandardMaterial color="#475569" metalness={0.4} roughness={0.5} />
                      </mesh>
                    ))}
                    <Text
                      position={[0, 0, pos.depth / 2 + 0.025]}
                      fontSize={0.03}
                      color="#94a3b8"
                      anchorX="center"
                    >
                      HCM
                    </Text>
                  </>
                ) : (
                  <mesh castShadow receiveShadow>
                    <boxGeometry args={[pos.width, height, pos.depth]} />
                    <meshStandardMaterial
                      color={isZeroU ? '#475569' : translucentDeviceColor(device)}
                      transparent
                      opacity={isZeroU ? 0.72 : 0.34}
                      roughness={0.72}
                      metalness={0.1}
                    />
                  </mesh>
                )}
                {!isHCM && !isZeroU && (
                  <Text
                    position={[0, height / 2 + 0.035, getDeviceMountSide(device) === 'rear' ? -pos.depth / 2 - 0.02 : pos.depth / 2 + 0.02]}
                    rotation={getDeviceMountSide(device) === 'rear' ? [0, Math.PI, 0] : undefined}
                    fontSize={0.04}
                    maxWidth={pos.width * 0.88}
                    color="#e2e8f0"
                    anchorX="center"
                  >
                    {device.label || device.name}
                  </Text>
                )}
                {!isHCM && isZeroU && (
                  <Text
                    position={
                      isRearRail0U && outletFacing !== 'inward'
                        ? [0, height / 2 + 0.035, zeroUPortZ + (outletFacing === 'outward' ? -0.02 : 0.02)]
                        : [innerFaceX + (isZeroULeft ? 0.03 : -0.03), height / 2 + 0.035, 0]
                    }
                    rotation={
                      isRearRail0U && outletFacing !== 'inward'
                        ? (outletFacing === 'outward' ? [0, Math.PI, 0] : undefined)
                        : [0, isZeroULeft ? Math.PI / 2 : -Math.PI / 2, 0]
                    }
                    fontSize={0.04}
                    maxWidth={isRearRail0U ? Math.max(pos.width * 2.2, 0.22) : pos.depth * 0.88}
                    color="#e2e8f0"
                    anchorX="center"
                  >
                    {device.label || device.name}
                  </Text>
                )}
                {!isHCM && !isZeroU && (
                  <>
                    <DeviceFacePorts
                      device={device}
                      faceZ={pos.depth / 2 + 0.006}
                      deviceWidth={pos.width}
                      deviceHeight={height}
                      face="front"
                    />
                    <DeviceFacePorts
                      device={device}
                      faceZ={-pos.depth / 2 - 0.006}
                      deviceWidth={pos.width}
                      deviceHeight={height}
                      face="rear"
                    />
                  </>
                )}
                {!isHCM && isZeroU && (
                  isRearRail0U && outletFacing !== 'inward' ? (
                    <DeviceFacePorts
                      device={device}
                      faceZ={zeroUPortZ}
                      deviceWidth={pos.width * 0.9}
                      deviceHeight={height}
                      face="front"
                    />
                  ) : (
                    <group position={[innerFaceX, 0, 0]}>
                      {(() => {
                        const groups = buildPortLayout(device, pos.depth, height, 'front');
                        if (groups.length === 0) return null;
                        const textRotY = innerFaceX > 0 ? Math.PI / 2 : -Math.PI / 2;
                        return groups.map((group) => (
                          <group key={group.key ?? group.type}>
                            {group.slots.map((slot) => (
                              <group key={slot.index} position={[0.003, slot.y, slot.x]}>
                                <mesh scale={[0.004, slot.height * 0.9, slot.width * 0.9]}>
                                  <primitive attach="geometry" object={UNIT_BOX_GEOMETRY} />
                                  <meshStandardMaterial
                                    color={group.color}
                                    emissive={group.emissive}
                                    emissiveIntensity={0.45}
                                    roughness={0.5}
                                    metalness={0.2}
                                  />
                                </mesh>
                                <Text
                                  fontSize={Math.min(0.014, slot.width * 0.4)}
                                  color="#0f172a"
                                  anchorX="center"
                                  anchorY="middle"
                                  position={[0.003, 0, 0]}
                                  rotation={[0, textRotY, 0]}
                                >
                                  {`${slot.index + 1}`}
                                </Text>
                              </group>
                            ))}
                          </group>
                        ));
                      })()}
                    </group>
                  )
                )}
              </group>
            );
          })}

          {/* Cables */}
          {(() => {
            const bundleMap = new Map<string, Route3D[]>();
            const unbundled: Route3D[] = [];
            for (const route of visibleRoutes) {
              const bid = route.cable.bundleId;
              if (bid) {
                const arr = bundleMap.get(bid) ?? [];
                arr.push(route);
                bundleMap.set(bid, arr);
              } else {
                unbundled.push(route);
              }
            }
            return (
              <>
                {/* Unbundled cables */}
                {unbundled.map((route) => (
                  <CableTube
                    key={route.cable.id}
                    route={route}
                    selectedCableId={selectedCableId}
                    selectedCableIds={selectedCableIds}
                    typeFilter={typeFilter}
                    focusMode={focusMode}
                    onSelect={selectCable}
                  />
                ))}
                {/* Bundles */}
                {Array.from(bundleMap.entries()).map(([bundleId, routes]) => {
                  if (routes.length === 1) {
                    return (
                      <CableTube
                        key={routes[0].cable.id}
                        route={routes[0]}
                        selectedCableId={selectedCableId}
                        selectedCableIds={selectedCableIds}
                        typeFilter={typeFilter}
                        focusMode={focusMode}
                        onSelect={selectCable}
                      />
                    );
                  }
                  const isExpanded = expandedBundles.has(bundleId);
                  if (isExpanded) {
                    return routes.map((route) => (
                      <CableTube
                        key={route.cable.id}
                        route={route}
                        selectedCableId={selectedCableId}
                        selectedCableIds={selectedCableIds}
                        typeFilter={typeFilter}
                        focusMode={focusMode}
                        onSelect={selectCable}
                      />
                    ));
                  }
                  return (
                    <BundleTube
                      key={`bundle-${bundleId}`}
                      routes={routes}
                      selectedCableId={selectedCableId}
                      selectedCableIds={selectedCableIds}
                      typeFilter={typeFilter}
                      focusMode={focusMode}
                      onSelect={selectCable}
                      onExpand={() => {
                        setExpandedBundles((prev) => {
                          const next = new Set(prev);
                          if (next.has(bundleId)) next.delete(bundleId);
                          else next.add(bundleId);
                          return next;
                        });
                      }}
                    />
                  );
                })}
              </>
            );
          })()}

          {/* Debug overlays */}
          {debugMode && (
            <>
              {/* Zone wireframes */}
              <mesh position={[0, 0, rackDepth / 4]}>
                <boxGeometry args={[rackWidth, rackHeight, rackDepth / 2]} />
                <meshBasicMaterial color="#22c55e" wireframe transparent opacity={0.22} />
              </mesh>
              <mesh position={[0, 0, -rackDepth / 4]}>
                <boxGeometry args={[rackWidth, rackHeight, rackDepth / 2]} />
                <meshBasicMaterial color="#ef4444" wireframe transparent opacity={0.22} />
              </mesh>
              <mesh position={[-rackWidth / 2 - ZERO_U_REAR_WIDTH / 2 - ZERO_U_REAR_SIDE_OFFSET, 0, -rackDepth / 2 - ZERO_U_REAR_DEPTH / 2 - ZERO_U_REAR_GAP]}>
                <boxGeometry args={[ZERO_U_REAR_WIDTH + 0.08, rackHeight, ZERO_U_REAR_DEPTH + 0.12]} />
                <meshBasicMaterial color="#3b82f6" wireframe transparent opacity={0.22} />
              </mesh>
              <mesh position={[rackWidth / 2 + ZERO_U_REAR_WIDTH / 2 + ZERO_U_REAR_SIDE_OFFSET, 0, -rackDepth / 2 - ZERO_U_REAR_DEPTH / 2 - ZERO_U_REAR_GAP]}>
                <boxGeometry args={[ZERO_U_REAR_WIDTH + 0.08, rackHeight, ZERO_U_REAR_DEPTH + 0.12]} />
                <meshBasicMaterial color="#3b82f6" wireframe transparent opacity={0.22} />
              </mesh>

              {/* Debug post anchors */}
              {[
                { x: -rackWidth / 2, z: rackDepth / 2, label: 'FL-post', color: '#22c55e' },
                { x: rackWidth / 2, z: rackDepth / 2, label: 'FR-post', color: '#22c55e' },
                { x: -rackWidth / 2, z: -rackDepth / 2, label: 'RL-post', color: '#ef4444' },
                { x: rackWidth / 2, z: -rackDepth / 2, label: 'RR-post', color: '#ef4444' },
              ].map((post) => (
                <group key={post.label}>
                  <mesh position={[post.x, -rackHeight / 2 + 0.08, post.z]} scale={[0.025, 0.025, 0.025]}>
                    <primitive attach="geometry" object={DEBUG_SPHERE_GEOMETRY} />
                    <meshBasicMaterial color={post.color} />
                  </mesh>
                  <Text
                    position={[post.x, -rackHeight / 2 + 0.18, post.z]}
                    fontSize={0.035}
                    color={post.color}
                    anchorX="center"
                  >
                    {post.label}
                  </Text>
                </group>
              ))}

              {/* Debug 0U anchors and mount info */}
              {layout.devices.filter((d) => d.sizeU === 0).map((device) => {
                const zone = getDeviceSpatialZone(device);
                const pos = devicePosition(layout, device, rackWidth, rackDepth, rackHeight);
                const color = zone.includes('left') ? '#fb923c' : '#38bdf8';
                const label = device.mountType === 'side-rail'
                  ? `${getZeroUEarSide(device)} side 0U`
                  : `${getZeroUEarSide(device)} rear 0U`;
                return (
                  <group key={`debug-${device.id}`}>
                    {/* Anchor sphere at device base */}
                    <mesh position={[pos.x, -rackHeight / 2 + 0.08, pos.z]} scale={[0.03, 0.03, 0.03]}>
                      <primitive attach="geometry" object={DEBUG_SPHERE_GEOMETRY} />
                      <meshBasicMaterial color={color} />
                    </mesh>
                    {/* Zone label */}
                    <Text
                      position={[pos.x, -rackHeight / 2 + 0.2, pos.z]}
                      fontSize={0.035}
                      color={color}
                      anchorX="center"
                    >
                      {label}
                    </Text>
                    {/* Mount info label */}
                    <Text
                      position={[pos.x, -rackHeight / 2 + 0.28, pos.z]}
                      fontSize={0.025}
                      color="#fbbf24"
                      anchorX="center"
                    >
                      {`${device.mountType ?? '?'} / ${device.mountSide0U ?? '?'} / ${device.outletFacing ?? '?'}`}
                    </Text>
                  </group>
                );
              })}

              {/* Vertical rail markers */}
              <mesh position={[-rackWidth / 2 - 0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.012, 0.012, rackHeight, 8]} />
                <meshBasicMaterial color="#fb923c" transparent opacity={0.8} />
              </mesh>
              <Text
                position={[-rackWidth / 2 - 0.18, rackHeight / 2 + 0.1, 0]}
                fontSize={0.05}
                color="#fb923c"
                anchorX="right"
              >
                V-rail-L
              </Text>
              <mesh position={[rackWidth / 2 + 0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.012, 0.012, rackHeight, 8]} />
                <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} />
              </mesh>
              <Text
                position={[rackWidth / 2 + 0.18, rackHeight / 2 + 0.1, 0]}
                fontSize={0.05}
                color="#38bdf8"
                anchorX="left"
              >
                V-rail-R
              </Text>

              {/* Cable node labels */}
              {visibleRoutes.map((route) => {
                const nodes = route.cable.nodes ?? [];
                if (nodes.length === 0) return null;
                const points = route.curve.getPoints(Math.max(nodes.length - 1, 1));
                return (
                  <group key={`debug-labels-${route.cable.id}`}>
                    {nodes.map((node, i) => {
                      const pt = points[Math.min(i, points.length - 1)];
                      let label = '';
                      if (node.type === 'device') label = node.port ? `${node.port.type}${node.port.index + 1}` : 'device';
                      else if (node.type === 'h-manager') label = 'H-mgr';
                      else if (node.type === 'v-rail-left') label = 'V-rail-L';
                      else if (node.type === 'v-rail-right') label = 'V-rail-R';
                      return (
                        <Text
                          key={`${route.cable.id}-node-${i}`}
                          position={[pt.x, pt.y, pt.z + 0.04]}
                          fontSize={0.022}
                          color="#e2e8f0"
                          anchorX="center"
                        >
                          {label}
                        </Text>
                      );
                    })}
                  </group>
                );
              })}
            </>
          )}
        </group>

      </CanvasWithRecovery>
    </div>
  );
}
