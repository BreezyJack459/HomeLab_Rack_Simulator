import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useThemeStore } from '../../store/themeStore';

type SceneSetupProps = {
  cameraPosition: [number, number, number];
  fov: number;
  controlsTarget: [number, number, number];
  groundSize?: [number, number];
  /** Ground plane height; defaults to the legacy -2.15. */
  groundY?: number;
  /** Orbit distance limits; defaults preserve the legacy 3..12 range. */
  minDistance?: number;
  maxDistance?: number;
};

export function SceneSetup({
  cameraPosition,
  fov,
  controlsTarget,
  groundSize = [9, 7],
  groundY = -2.15,
  minDistance = 3,
  maxDistance = 12
}: SceneSetupProps) {
  const light = useThemeStore((state) => state.theme === 'light');
  return (
    <>
      <PerspectiveCamera makeDefault position={cameraPosition} fov={fov} />
      <color attach="background" args={[light ? '#e2e8ee' : '#252e3b']} />
      <ambientLight intensity={0.8} />
      <hemisphereLight args={['#edf5ff', '#64748b', 0.8]} />
      <directionalLight position={[4, 7, 5]} intensity={1.65} castShadow shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7}
        shadow-bias={-0.0005} />
      <directionalLight position={[-5, 3, -4]} intensity={1.15} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, groundY, 0]} receiveShadow>
        <planeGeometry args={groundSize} />
        <meshStandardMaterial color={light ? '#d2dbe4' : '#293443'} roughness={0.95} metalness={0} />
      </mesh>
      <gridHelper args={[12, 24, light ? '#b4c0cc' : '#3a4758', light ? '#c1ccd6' : '#334051']} position={[0, groundY + 0.01, 0]} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={minDistance}
        maxDistance={maxDistance}
        maxPolarAngle={Math.PI / 2 - 0.02}
        target={controlsTarget}
      />
    </>
  );
}
