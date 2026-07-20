import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { memo, useEffect, useMemo, useState } from 'react';
import type { DeviceTemplate, PlacedDevice, PortType, RackType, ViewSide } from '../../types/rack';
import { useRackStore } from '../../store/rackStore';
import { getTemplateById, templateFromDevice } from '../../data/deviceCatalog';
import { getDeviceMountSide, getDeviceSpatialZone, getZeroUEarSide } from '../../utils/rackMath';
import { buildPortLayout } from '../../utils/portLayout';
import { getFaceplateTexture } from '../../utils/faceplateSvg';
import { getDeviceWorldBox, ZERO_U_REAR_GAP, ZERO_U_SIDE_GAP } from '../../utils/rackGeometry';
import { UNIT_BOX_GEOMETRY } from './sharedGeometries';

const MAX_DETAILED_PORT_LABELS = 24;

const CANVAS_TEXTURE_CACHE = new Map<string, THREE.CanvasTexture>();
const CANVAS_TEXTURE_REFCOUNT = new Map<string, number>();

function lifecycleTint(color: string, status?: string): string {
  if (status !== 'decommissioning') return color;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const avg = Math.round((r + g + b) / 3);
  const hex = avg.toString(16).padStart(2, '0');
  return `#${hex}${hex}${hex}`;
}

function FaceplateTexture({
  template,
  face,
  width,
  height,
  rotationY
}: {
  template: DeviceTemplate;
  face: ViewSide;
  width: number;
  height: number;
  rotationY?: number;
}) {
  const cacheKey = `${template.id}:${face}`;
  // Start null: reading the cache here would use a texture without taking a
  // refcount. The effect below populates state and owns the refcount.
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    const cachedTexture = CANVAS_TEXTURE_CACHE.get(cacheKey);
    if (cachedTexture) {
      CANVAS_TEXTURE_REFCOUNT.set(cacheKey, (CANVAS_TEXTURE_REFCOUNT.get(cacheKey) ?? 0) + 1);
      setTexture(cachedTexture);
      return () => {
        const nextRef = (CANVAS_TEXTURE_REFCOUNT.get(cacheKey) ?? 1) - 1;
        if (nextRef <= 0) {
          CANVAS_TEXTURE_REFCOUNT.delete(cacheKey);
          const tex = CANVAS_TEXTURE_CACHE.get(cacheKey);
          CANVAS_TEXTURE_CACHE.delete(cacheKey);
          tex?.dispose();
        } else {
          CANVAS_TEXTURE_REFCOUNT.set(cacheKey, nextRef);
        }
      };
    }

    let cancelled = false;
    CANVAS_TEXTURE_REFCOUNT.set(cacheKey, (CANVAS_TEXTURE_REFCOUNT.get(cacheKey) ?? 0) + 1);
    const { canvas, ready } = getFaceplateTexture(template, face, 4);
    ready.then(() => {
      if (cancelled) return;
      // Another instance sharing this in-flight load may have cached a texture
      // first; reuse it instead of creating (and orphaning) a duplicate. The
      // refcount for this instance was already taken above.
      const existing = CANVAS_TEXTURE_CACHE.get(cacheKey);
      if (existing) {
        setTexture(existing);
        return;
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      CANVAS_TEXTURE_CACHE.set(cacheKey, tex);
      setTexture(tex);
    }).catch(() => {
      // On failure, leave texture null; dark faceplate mesh shows behind.
    });
    return () => {
      cancelled = true;
      const nextRef = (CANVAS_TEXTURE_REFCOUNT.get(cacheKey) ?? 1) - 1;
      if (nextRef <= 0) {
        CANVAS_TEXTURE_REFCOUNT.delete(cacheKey);
        const tex = CANVAS_TEXTURE_CACHE.get(cacheKey);
        CANVAS_TEXTURE_CACHE.delete(cacheKey);
        tex?.dispose();
      } else {
        CANVAS_TEXTURE_REFCOUNT.set(cacheKey, nextRef);
      }
    };
  }, [template.id, face, cacheKey]);
  if (!texture) return null;
  return (
    <mesh rotation={[0, rotationY ?? (face === 'front' ? 0 : Math.PI), 0]}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={texture} transparent />
    </mesh>
  );
}

/** Render ports on one face using the shared layout engine */
function DevicePortFace({
  device,
  deviceWidth,
  deviceHeight,
  z,
  face,
  rotationY,
}: {
  device: PlacedDevice;
  deviceWidth: number;
  deviceHeight: number;
  z: number;
  face: 'front' | 'rear';
  rotationY?: number;
}) {
  const groups = useMemo(
    () => buildPortLayout(device, deviceWidth, deviceHeight, face),
    [device.category, device.ports, device.portLayouts, device.portFaceOverrides, deviceWidth, deviceHeight, face]
  );
  // Pairing state from store — drives hover glow + click handler
  const pairingStage = useRackStore((s) => s.pairingStage);
  const onPortPick3D = useRackStore((s) => s.onPortPick3D);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const isPairing = pairingStage !== 'idle';
  const slotCount = groups.reduce((total, group) => total + group.slots.length, 0);
  const showDetailedLabels = slotCount <= MAX_DETAILED_PORT_LABELS;

  if (groups.length === 0) return null;

  return (
    <group position={[0, 0, z]} rotation={[0, rotationY ?? 0, 0]}>
      {groups.map((group) => (
        <group key={group.key ?? group.type}>
          {group.slots.map((slot) => {
            const slotKey = `${group.type}-${slot.index}`;
            const isHovered = isPairing && hoveredKey === slotKey;
            return (
              <group key={slot.index} position={[slot.x, slot.y, 0.003]}>
                <mesh
                  scale={[slot.width, slot.height, isHovered ? 0.012 : 0.005]}
                  onPointerOver={isPairing ? (e) => { e.stopPropagation(); setHoveredKey(slotKey); } : undefined}
                  onPointerOut={isPairing ? (e) => { e.stopPropagation(); setHoveredKey(null); } : undefined}
                  onClick={isPairing && onPortPick3D ? (e) => {
                    e.stopPropagation();
                    onPortPick3D({
                      deviceId: device.id,
                      portType: group.type as PortType,
                      portIndex: slot.index,
                      face,
                      cableTypes: []
                    });
                  } : undefined}
                >
                  <primitive attach="geometry" object={UNIT_BOX_GEOMETRY} />
                  <meshStandardMaterial
                    color={isHovered ? '#ffffff' : group.color}
                    emissive={isHovered ? '#06b6d4' : group.emissive}
                    emissiveIntensity={isHovered ? 1.4 : 0.35}
                    roughness={0.5}
                    metalness={0.2}
                  />
                </mesh>
                {(showDetailedLabels || isHovered) && (
                  <>
                    <Text
                      fontSize={Math.min(0.016, slot.width * 0.4)}
                      color={isHovered ? '#ffffff' : '#0f172a'}
                      anchorX="center"
                      anchorY="middle"
                      position={[0, 0, 0.003]}
                    >
                      {`${slot.index + 1}`}
                    </Text>
                    {slot.speed && (
                      <Text
                        fontSize={Math.min(0.011, slot.width * 0.28)}
                        color={isHovered ? '#ffffff' : '#0f172a'}
                        anchorX="center"
                        anchorY="bottom"
                        position={[0, slot.height * 0.42, 0.004]}
                      >
                        {slot.speed}
                        {slot.mediaType && slot.mediaType !== 'rj45' ? ` ${slot.mediaType}` : ''}
                      </Text>
                    )}
                  </>
                )}
              </group>
            );
          })}
          {!showDetailedLabels && (
            <Text
              fontSize={0.026}
              color="#cbd5e1"
              anchorX="center"
              anchorY="middle"
              position={[0, -deviceHeight * 0.34, 0.006]}
              maxWidth={deviceWidth * 0.82}
            >
              {`${group.slots.length} ${group.type}${group.slots[0]?.speed ? ` ${group.slots[0].speed}${group.slots[0].mediaType && group.slots[0].mediaType !== 'rj45' ? ` ${group.slots[0].mediaType}` : ''}` : ''}`}
            </Text>
          )}
        </group>
      ))}
    </group>
  );
}

export const DeviceModel = memo(DeviceModelComponent);

/** Render ports on the X-facing face of a side-mounted 0U device */
function DeviceZeroUSideFace({
  device,
  faceWidth,
  faceHeight,
  xOffset,
  textRotY,
}: {
  device: PlacedDevice;
  faceWidth: number;
  faceHeight: number;
  xOffset: number;
  textRotY: number;
}) {
  const groups = useMemo(
    () => buildPortLayout(device, faceWidth, faceHeight, 'front'),
    [device.category, device.ports, device.portLayouts, device.portFaceOverrides, faceWidth, faceHeight]
  );
  const slotCount = groups.reduce((total, group) => total + group.slots.length, 0);
  const showDetailedLabels = slotCount <= MAX_DETAILED_PORT_LABELS;
  if (groups.length === 0) return null;

  return (
    <group position={[xOffset, 0, 0]}>
      {groups.map((group) => (
        <group key={group.key ?? group.type}>
          {group.slots.map((slot) => (
            <group key={slot.index} position={[0.003, slot.y, slot.x]}>
              <mesh scale={[0.005, slot.height * 0.9, slot.width * 0.9]}>
                <primitive attach="geometry" object={UNIT_BOX_GEOMETRY} />
                <meshStandardMaterial
                  color={group.color}
                  emissive={group.emissive}
                  emissiveIntensity={0.35}
                  roughness={0.5}
                  metalness={0.2}
                />
              </mesh>
              {showDetailedLabels && (
                <Text
                  fontSize={Math.min(0.016, slot.width * 0.4)}
                  color="#0f172a"
                  anchorX="center"
                  anchorY="middle"
                  position={[0.003, 0, 0]}
                  rotation={[0, textRotY, 0]}
                >
                  {`${slot.index + 1}`}
                </Text>
              )}
            </group>
          ))}
          {!showDetailedLabels && (
            <Text
              fontSize={0.026}
              color="#cbd5e1"
              anchorX="center"
              anchorY="middle"
              position={[0.006, -faceHeight * 0.34, 0]}
              rotation={[0, textRotY, 0]}
              maxWidth={faceWidth * 0.82}
            >
              {`${group.slots.length} ${group.type}`}
            </Text>
          )}
        </group>
      ))}
    </group>
  );
}

interface DeviceModelProps {
  device: PlacedDevice;
  rackType: RackType;
  rackDepthMm: number;
  rackWidth: number;
  rackDepth: number;
  rackHeight: number;
  selected?: boolean;
}

function heatEmissive(heatLevel: number) {
  if (heatLevel >= 5) return '#ef4444';
  if (heatLevel >= 4) return '#f97316';
  if (heatLevel >= 3) return '#0f766e';
  return '#111827';
}

function DeviceModelComponent({ device, rackType, rackDepthMm, rackWidth, rackDepth, rackHeight, selected }: DeviceModelProps) {
  const selectDevice = useRackStore((state) => state.selectDevice);
  const selectCable = useRackStore((state) => state.selectCable);
  const debugMode = useRackStore((state) => state.debugMode);
  const box = getDeviceWorldBox(
    { rackType, rackDepthMm },
    device,
    {
      rackWidth,
      rackDepth,
      rackHeight,
      bottom: -rackHeight / 2
    }
  );
  const { x, y, z, width, depth, height, isZeroU, isRearRail0U, isRearMounted } = box;
  const template = getTemplateById(device.templateId) ?? templateFromDevice(device);
  const overflowDepth = !isZeroU ? Math.max(0, depth - rackDepth) : 0;
  const overflowCenterZ = isRearMounted
    ? depth / 2 - overflowDepth / 2
    : -depth / 2 + overflowDepth / 2;
  const zone = getDeviceSpatialZone(device);
  const earSide = isZeroU ? getZeroUEarSide(device) : 'right';
  const isZeroULeft = earSide === 'left';

  // Port face offsets
  const faceZ = isRearMounted ? -depth / 2 - 0.006 : depth / 2 + 0.006;

  const zeroUPortSideX = isZeroULeft ? width / 2 : -width / 2;
  const zeroUPortZ = (device.outletFacing ?? 'forward') === 'outward'
    ? -depth / 2 - 0.014
    : depth / 2 + 0.014;
  const sideTextRotY = isZeroULeft ? Math.PI / 2 : -Math.PI / 2;

  const isShelf = device.category === 'shelf';

  return (
    <group position={[x, y, z]}>
      {isZeroU && (
        <>
          {selected && (
            <mesh position={isRearRail0U ? [0, 0, ZERO_U_REAR_GAP / 2] : [0, 0, 0]}>
              <boxGeometry
                args={[
                  isRearRail0U ? width + 0.035 : width + 0.06,
                  height + 0.035,
                  isRearRail0U ? depth + ZERO_U_REAR_GAP + 0.035 : depth + 0.07
                ]}
              />
              <meshBasicMaterial color="#67e8f9" wireframe transparent opacity={0.42} />
            </mesh>
          )}
          {isRearRail0U ? (
            <>
              <mesh position={[0, height * 0.46, depth / 2 + ZERO_U_REAR_GAP / 2]}>
                <boxGeometry args={[width * 0.72, 0.018, ZERO_U_REAR_GAP]} />
                <meshStandardMaterial color="#1e293b" roughness={0.55} metalness={0.26} />
              </mesh>
              <mesh position={[0, -height * 0.46, depth / 2 + ZERO_U_REAR_GAP / 2]}>
                <boxGeometry args={[width * 0.72, 0.018, ZERO_U_REAR_GAP]} />
                <meshStandardMaterial color="#1e293b" roughness={0.55} metalness={0.26} />
              </mesh>
            </>
          ) : (
            <mesh
              position={[isZeroULeft ? width / 2 + ZERO_U_SIDE_GAP / 2 : -width / 2 - ZERO_U_SIDE_GAP / 2, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.006, 0.006, ZERO_U_SIDE_GAP, 8]} />
              <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.18} roughness={0.45} />
            </mesh>
          )}
        </>
      )}
      {/* Main device body */}
      <mesh
        castShadow
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          selectDevice(device.id);
          selectCable(null);
        }}
      >
        <boxGeometry args={[width, height, isShelf ? Math.max(depth, 0.55) : depth]} />
        <meshStandardMaterial
          color={lifecycleTint(device.color, device.lifecycleStatus)}
          transparent={device.lifecycleStatus === 'planned'}
          opacity={device.lifecycleStatus === 'planned' ? 0.55 : 1}
          emissive={selected ? '#06b6d4' : heatEmissive(device.heatLevel)}
          emissiveIntensity={selected ? (isZeroU ? 0.15 : 0.35) : isZeroU ? 0.12 : device.heatLevel >= 4 ? 0.16 : 0.04}
          metalness={isShelf ? 0.32 : isZeroU ? 0.25 : 0.12}
          roughness={isZeroU ? 0.45 : 0.58}
        />
      </mesh>

      {overflowDepth > 0 && (
        <mesh position={[0, 0, overflowCenterZ]} castShadow receiveShadow>
          <boxGeometry args={[width + 0.012, height + 0.012, overflowDepth]} />
          <meshStandardMaterial
            color="#ef4444"
            emissive="#b91c1c"
            emissiveIntensity={selected ? 0.58 : 0.4}
            transparent
            opacity={0.72}
            metalness={0.16}
            roughness={0.42}
          />
        </mesh>
      )}

      {/* Selection highlight */}
      {selected && (
        <mesh position={isZeroU ? (isRearRail0U && (device.outletFacing ?? 'forward') !== 'inward' ? [0, 0, zeroUPortZ] : [zeroUPortSideX, 0, 0]) : [0, 0, faceZ]}>
          {isZeroU ? (
            isRearRail0U && (device.outletFacing ?? 'forward') !== 'inward'
              ? <boxGeometry args={[width + 0.03, height + 0.03, 0.006]} />
              : <boxGeometry args={[0.006, height + 0.03, depth + 0.03]} />
          ) : (
            <boxGeometry args={[width + 0.03, height + 0.03, 0.006]} />
          )}
          <meshStandardMaterial color="#06b6d4" transparent opacity={0.6} />
        </mesh>
      )}

      {/* Face plate */}
      {isZeroU ? (
        <mesh position={isRearRail0U && (device.outletFacing ?? 'forward') !== 'inward' ? [0, 0, zeroUPortZ] : [zeroUPortSideX, 0, 0]} castShadow>
          {isRearRail0U && (device.outletFacing ?? 'forward') !== 'inward' ? (
            <boxGeometry args={[width + 0.012, height + 0.01, 0.014]} />
          ) : (
            <boxGeometry args={[0.018, height + 0.01, depth + 0.012]} />
          )}
          <meshStandardMaterial color="#0f172a" roughness={0.7} metalness={0.18} />
        </mesh>
      ) : (
        <mesh position={[0, 0, faceZ]} castShadow>
          <boxGeometry args={[width + 0.012, height + 0.01, 0.018]} />
          <meshStandardMaterial color={isShelf ? '#64748b' : '#0f172a'} roughness={0.7} metalness={0.18} />
        </mesh>
      )}

      {/* Faceplate textures */}
      {!isZeroU && (
        <>
          <group position={[0, 0, isRearMounted ? -depth / 2 - 0.016 : depth / 2 + 0.016]}>
            <FaceplateTexture
              template={template}
              face="front"
              width={width}
              height={height}
              rotationY={isRearMounted ? Math.PI : 0}
            />
          </group>
          <group position={[0, 0, isRearMounted ? depth / 2 + 0.016 : -depth / 2 - 0.016]}>
            <FaceplateTexture
              template={template}
              face="rear"
              width={width}
              height={height}
              rotationY={isRearMounted ? 0 : Math.PI}
            />
          </group>
        </>
      )}

      {/* Ports */}
      {device.ports && (
        <>
          {isZeroU ? (
            <>
              {isRearRail0U && (device.outletFacing ?? 'forward') !== 'inward' ? (
                <DevicePortFace
                  device={device}
                  deviceWidth={width * 0.9}
                  deviceHeight={height}
                  z={zeroUPortZ}
                  face="front"
                />
              ) : (
                <DeviceZeroUSideFace
                  device={device}
                  faceWidth={depth}
                  faceHeight={height}
                  xOffset={zeroUPortSideX}
                  textRotY={sideTextRotY}
                />
              )}
            </>
          ) : (
            <>
              <DevicePortFace
                device={device}
                deviceWidth={width * 0.9}
                deviceHeight={height}
                z={isRearMounted ? -depth / 2 - 0.02 : depth / 2 + 0.02}
                face="front"
                rotationY={isRearMounted ? Math.PI : 0}
              />
              <DevicePortFace
                device={device}
                deviceWidth={width * 0.9}
                deviceHeight={height}
                z={isRearMounted ? depth / 2 + 0.02 : -depth / 2 - 0.02}
                face="rear"
                rotationY={isRearMounted ? 0 : Math.PI}
              />
            </>
          )}
        </>
      )}

      {/* Device label */}
      {isZeroU ? (
        <Text
          position={
            isRearRail0U && (device.outletFacing ?? 'forward') !== 'inward'
              ? [0, height * 0.08, zeroUPortZ + ((device.outletFacing ?? 'forward') === 'outward' ? -0.02 : 0.02)]
              : [zeroUPortSideX + (isZeroULeft ? 0.032 : -0.032), height * 0.08, 0]
          }
          rotation={
            isRearRail0U && (device.outletFacing ?? 'forward') !== 'inward'
              ? ((device.outletFacing ?? 'forward') === 'outward' ? [0, Math.PI, 0] : undefined)
              : [0, isZeroULeft ? Math.PI / 2 : -Math.PI / 2, 0]
          }
          fontSize={Math.min(0.06, Math.max(0.038, height * 0.28))}
          maxWidth={isRearRail0U ? Math.max(width * 2.2, 0.22) : depth * 0.84}
          color="#f8fafc"
          anchorX="center"
          anchorY="middle"
        >
          {device.label || device.name}
        </Text>
      ) : (
        <Text
          position={[0, height * 0.08, isRearMounted ? -depth / 2 - 0.032 : depth / 2 + 0.032]}
          rotation={isRearMounted ? [0, Math.PI, 0] : undefined}
          fontSize={Math.min(0.06, Math.max(0.038, height * 0.28))}
          maxWidth={width * 0.84}
          color="#f8fafc"
          anchorX="center"
          anchorY="middle"
        >
          {device.label || device.name}
        </Text>
      )}

      {/* Debug: mount info labels */}
      {debugMode && isZeroU && (
        <>
          <Text
            position={[0, height / 2 + 0.08, 0]}
            rotation={[0, isZeroULeft ? Math.PI / 2 : -Math.PI / 2, 0]}
            fontSize={0.03}
            color="#fbbf24"
            anchorX="center"
          >
            {`zone:${zone} mount:${device.mountType ?? '?'}`}
          </Text>
          <Text
            position={[0, height / 2 + 0.04, 0]}
            rotation={[0, isZeroULeft ? Math.PI / 2 : -Math.PI / 2, 0]}
            fontSize={0.025}
            color="#fbbf24"
            anchorX="center"
          >
            {`${isRearRail0U ? 'rear-post' : 'side-channel'} ${earSide}`}
          </Text>
        </>
      )}

      {/* Debug: bounding box + markers for 0U devices */}
      {debugMode && isZeroU && (
        <>
          <mesh>
            <boxGeometry args={[width + 0.01, height + 0.01, depth + 0.01]} />
            <meshBasicMaterial color="#f59e0b" wireframe transparent opacity={0.5} />
          </mesh>
          {!isRearRail0U && (
            <mesh
              position={[isZeroULeft ? width / 2 + ZERO_U_SIDE_GAP / 2 : -width / 2 - ZERO_U_SIDE_GAP / 2, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.003, 0.003, ZERO_U_SIDE_GAP, 6]} />
              <meshBasicMaterial color="#f59e0b" transparent opacity={0.9} />
            </mesh>
          )}
        </>
      )}
    </group>
  );
}
