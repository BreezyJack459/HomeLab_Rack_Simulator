import { Text } from '@react-three/drei';
import type { CableCrossover, RackFrameModel, RearCableGuide, TrayChannel } from '../../../utils/rackSceneModel';
import { SCENE_COLORS } from '../../../utils/rackSceneModel';
import { UNIT_BOX_GEOMETRY } from '../sharedGeometries';

/** Rear crossbars are mounted to both posts; clips retain the crossing lines. */
export function CrossoverSupports3D({ supports }: { supports: CableCrossover[] }) {
  return <group>
    {supports.map((support) => <group key={support.id}>
      {support.members.map((member, index) => <mesh key={index}
        position={[member.center.x, member.center.y, member.center.z]}
        scale={[member.size.x, member.size.y, member.size.z]} castShadow>
        <primitive attach="geometry" object={UNIT_BOX_GEOMETRY} />
        <meshStandardMaterial color="#64748b" metalness={0.55} roughness={0.55} />
      </mesh>)}
      {support.clips.map((clip, index) => <mesh key={index}
        position={[clip.x, clip.y, clip.z]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.075, 0.012, 6, 16]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.15} roughness={0.8} />
      </mesh>)}
    </group>)}
  </group>;
}

/** Small lacing supports and reusable straps at each rear panel bundle. */
export function RearPanelGuides3D({ guides }: { guides: RearCableGuide[] }) {
  return <group>
    {guides.map((guide) => <group key={guide.id}>
      <mesh position={[guide.support.center.x, guide.support.center.y, guide.support.center.z]}
        scale={[guide.support.size.x, guide.support.size.y, guide.support.size.z]}>
        <primitive attach="geometry" object={UNIT_BOX_GEOMETRY} />
        <meshStandardMaterial color="#475569" roughness={0.7} metalness={0.35} />
      </mesh>
      <mesh position={[guide.tie.x, guide.tie.y, guide.tie.z]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.06, 0.009, 5, 16]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.9} />
      </mesh>
    </group>)}
  </group>;
}

/**
 * Opaque rack frame: four posts, top/bottom cross members, and inner
 * mounting rails. Replaces the old translucent post/rail composition.
 */
export function RackFrame3D({ frame }: { frame: RackFrameModel }) {
  return (
    <group>
      {frame.posts.map((post, index) => (
        <mesh
          key={`post-${index}`}
          position={[post.center.x, post.center.y, post.center.z]}
          scale={[post.size.x, post.size.y, post.size.z]}
          castShadow
          receiveShadow
        >
          <primitive attach="geometry" object={UNIT_BOX_GEOMETRY} />
          <meshStandardMaterial color={SCENE_COLORS.frame} metalness={0.35} roughness={0.5} />
        </mesh>
      ))}
      {frame.crossbars.map((bar, index) => (
        <mesh
          key={`bar-${index}`}
          position={[bar.center.x, bar.center.y, bar.center.z]}
          scale={[bar.size.x, bar.size.y, bar.size.z]}
          castShadow
          receiveShadow
        >
          <primitive attach="geometry" object={UNIT_BOX_GEOMETRY} />
          <meshStandardMaterial color={SCENE_COLORS.frame} metalness={0.35} roughness={0.5} />
        </mesh>
      ))}
      {frame.mountingRails.map((rail, index) => (
        <mesh
          key={`rail-${index}`}
          position={[rail.center.x, rail.center.y, rail.center.z]}
          scale={[rail.size.x, rail.size.y, rail.size.z]}
        >
          <primitive attach="geometry" object={UNIT_BOX_GEOMETRY} />
          <meshStandardMaterial color={SCENE_COLORS.rail} metalness={0.4} roughness={0.45} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Left/right vertical cable-management channels on both faces. Each side
 * carries separate data/power lanes, chosen by the source port's rack half.
 */
export function CableChannels3D({
  channels,
  rackHeight
}: {
  channels: TrayChannel[];
  rackHeight: number;
}) {
  return (
    <group>
      {channels.map((channel) => (
        <group key={channel.id}>
          {channel.members.map((member, index) => (
            <mesh
              key={`${channel.id}-member-${index}`}
              position={[member.center.x, member.center.y, member.center.z]}
              scale={[member.size.x, member.size.y, member.size.z]}
              castShadow
              receiveShadow
            >
              <primitive attach="geometry" object={UNIT_BOX_GEOMETRY} />
              <meshStandardMaterial
                color="#232f40"
                metalness={0.3}
                roughness={0.6}
                transparent={channel.face === 'rear'}
                opacity={channel.face === 'rear' ? 0.85 : 1}
              />
            </mesh>
          ))}
          <Text
            position={[
              channel.laneCenter.x + (channel.side === 'left' ? -0.16 : 0.16),
              rackHeight / 2 + 0.12,
              channel.laneCenter.z
            ]}
            fontSize={0.05}
            color={channel.accentColor}
            anchorX={channel.side === 'left' ? 'right' : 'left'}
          >
            {channel.label}
          </Text>
        </group>
      ))}
    </group>
  );
}
