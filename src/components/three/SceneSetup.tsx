import { OrbitControls, PerspectiveCamera } from '@react-three/drei';

type SceneSetupProps = {
  cameraPosition: [number, number, number];
  fov: number;
  background: string;
  controlsTarget: [number, number, number];
  ambientIntensity: number;
  keyLightIntensity: number;
  groundSize?: [number, number];
};

export function SceneSetup({
  cameraPosition,
  fov,
  background,
  controlsTarget,
  ambientIntensity,
  keyLightIntensity,
  groundSize = [9, 7]
}: SceneSetupProps) {
  return (
    <>
      <PerspectiveCamera makeDefault position={cameraPosition} fov={fov} />
      <color attach="background" args={[background]} />
      <ambientLight intensity={ambientIntensity} />
      <directionalLight position={[4, 7, 5]} intensity={keyLightIntensity} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-5, 3, -4]} intensity={0.35} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.15, 0]} receiveShadow>
        <planeGeometry args={groundSize} />
        <meshStandardMaterial color="#0f172a" roughness={0.92} metalness={0.05} />
      </mesh>
      <gridHelper args={[8, 16, '#334155', '#1f2937']} position={[0, -2.14, 0]} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={3}
        maxDistance={12}
        target={controlsTarget}
      />
    </>
  );
}
