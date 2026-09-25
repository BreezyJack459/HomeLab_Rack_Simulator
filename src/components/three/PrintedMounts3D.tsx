import { useMemo } from 'react';
import type { RackLayout } from '../../types/rack';
import { buildPrintedMountAssemblies } from '../../utils/printedMountGeometry';

export function PrintedMounts3D({ layout }: { layout: RackLayout }) {
  const assemblies = useMemo(() => buildPrintedMountAssemblies(layout), [layout]);
  return <group name="printed-mounts" userData={{ assemblyCount: assemblies.length }}>
    {assemblies.map(assembly => <group key={assembly.id} name={`printed-mount-${assembly.id}`} userData={{ deviceIds: assembly.deviceIds }}>
      {assembly.parts.map((part, index) => <mesh key={index} name={`printed-${part.kind}`} castShadow receiveShadow
        position={[part.center.x, part.center.y, part.center.z]} rotation={part.kind === 'bolt' ? [Math.PI / 2, 0, 0] : [0, 0, 0]}>
        {part.kind === 'bolt'
          ? <cylinderGeometry args={[part.size.x / 2, part.size.x / 2, part.size.z, 6]} />
          : <boxGeometry args={[part.size.x, part.size.y, part.size.z]} />}
        <meshStandardMaterial color={part.kind === 'bolt' ? '#94a3b8' : part.kind === 'joiner' ? '#334155' : '#475569'}
          roughness={part.kind === 'bolt' ? 0.38 : 0.85} metalness={part.kind === 'bolt' ? 0.65 : 0.05} />
      </mesh>)}
    </group>)}
  </group>;
}
