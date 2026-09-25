import { withoutHiddenZeroUPdu } from '../utils/featureFlags';
import { CableDrawingControls, CableDrawingScene, useCableRouteDrawing } from './CableRouteDrawing';
import { Text } from '@react-three/drei';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCableWorkspaceStore } from '../store/cableWorkspaceStore';
import { useRackStore } from '../store/rackStore';
import { CanvasWithRecovery } from './CanvasWithRecovery';
import { matchesCableQuery } from '../utils/cableQuery';
import { getPatchPanelLinkedCableIds } from '../utils/patchPanel';
import { getDeviceSpatialZone, getZeroUEarSide } from '../utils/rackMath';
import {
  getDeviceWorldBox,
  getCablePortFace,
  ZERO_U_REAR_DEPTH,
  ZERO_U_REAR_GAP,
  ZERO_U_REAR_SIDE_OFFSET,
  ZERO_U_REAR_WIDTH
} from '../utils/rackGeometry';
import {
  buildPreviewRoute,
  buildRackSceneModel,
  type ManagedRoute
} from '../utils/rackSceneModel';
import { DEBUG_SPHERE_GEOMETRY } from './three/sharedGeometries';
import { RackSceneCamera, type SceneFocus } from './three/RackSceneCamera';
import type { CableCameraPreset } from './three/rack-scene/cameraPresets';
import { SceneNavigationHint, SceneViewToolbar, sceneButtonClass } from './SceneViewToolbar';
import { SceneLabel3D, SelectionBox3D } from './three/SceneSelection';
import { formatPortName, getStoredPortAlias } from '../utils/portDocumentation';
import type { PlacedDevice, PortRef } from '../types/rack';
import { CableChannels3D, CrossoverSupports3D, RackFrame3D, RearPanelGuides3D } from './three/rack-scene/RackFrame3D';
import { DeviceSolid3D } from './three/rack-scene/DeviceSolid3D';
import { PrintedMounts3D } from './three/PrintedMounts3D';
import { buildRouteCurve, GhostManagedCable3D, ManagedCable3D } from './three/rack-scene/ManagedCable3D';

type CableLayer = 'rack' | 'devices' | 'cables';

const endpointName = (device: PlacedDevice | undefined, port: PortRef | undefined): string =>
  `${device?.label || device?.name || 'Device'} · ${port ? (device && getStoredPortAlias(device, port)?.value) || formatPortName(port) : 'Unspecified port'}`;

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export function CableViewer3D() {
  const [drawingActive, setDrawingActive] = useState(false);
  const [editingCableId, setEditingCableId] = useState<string | null>(null);
  const closeDrawing = useCallback(() => setDrawingActive(false), []);
  const drawing = useCableRouteDrawing(drawingActive, closeDrawing, editingCableId);
  const storedLayout = useRackStore((state) => state.layout);
  const layout = useMemo(() => withoutHiddenZeroUPdu(storedLayout), [storedLayout]);
  const selectedCableId = useRackStore((state) => state.selectedCableId);
  const selectCable = useRackStore((state) => state.selectCable);
  const debugMode = useRackStore((state) => state.debugMode);
  const cableRoutingMode = useRackStore((state) => state.cableRoutingMode);
  const setCableRoutingMode = useRackStore((state) => state.setCableRoutingMode);
  const previewCable = useRackStore((state) => state.previewCable);
  const query = useCableWorkspaceStore((state) => state.query);
  const hiddenTypes = useCableWorkspaceStore((state) => state.hiddenTypes);
  const focusMode = useCableWorkspaceStore((state) => state.focusMode);

  // Canonical scene model: opaque frame, device solids, management channels,
  // and managed route paths. Rebuilt only when the layout or routing mode
  // changes — filtering never reshuffles lanes.
  const sceneModel = useMemo(
    () => buildRackSceneModel(layout, { routingMode: cableRoutingMode }),
    [layout, cableRoutingMode]
  );
  const { rackWidth, rackDepth, rackHeight, bottom } = sceneModel.dimensions;

  const selectedCableIds = useMemo(
    () => getPatchPanelLinkedCableIds(layout, selectedCableId),
    [layout.cables, layout.devices, selectedCableId]
  );
  const [cameraPreset, setCameraPreset] = useState<CableCameraPreset>('overview');
  useEffect(() => { if (drawingActive) { setCameraPreset(drawing.face); setCameraFocus('rack'); } }, [drawingActive, drawing.face]);
  const [cameraFocus, setCameraFocus] = useState<'rack' | 'route' | 'start' | 'end'>('rack');
  const [fitRequest, setFitRequest] = useState(0);
  const [layers, setLayers] = useState<Record<CableLayer, boolean>>({ rack: true, devices: true, cables: true });

  const extraPoints = useMemo(() => [
    ...sceneModel.routes.flatMap((route) => route.points),
    ...sceneModel.devices.flatMap(({ box }) => [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => ({
      x: box.x + x * box.width / 2, y: box.y + y * box.height / 2, z: box.z + z * box.depth / 2,
    }))))),
  ], [sceneModel]);

  const visibleRoutes = useMemo(
    () =>
      sceneModel.routes.filter((route) => {
        if (selectedCableIds.has(route.cableId)) return true;
        if (hiddenTypes.includes(route.cable.type)) return false;
        return matchesCableQuery(route.cable, layout, query);
      }),
    [sceneModel, hiddenTypes, query, selectedCableIds, layout]
  );

  const previewRoute = useMemo((): ManagedRoute | null => {
    if (!previewCable) return null;
    const from = layout.devices.find((device) => device.id === previewCable.fromDeviceId);
    const to = layout.devices.find((device) => device.id === previewCable.toDeviceId);
    if (!from || !to) return null;
    const sameGroupCount = visibleRoutes.filter(
      (route) => route.cable.type === previewCable.type
    ).length;
    return buildPreviewRoute(previewCable, layout, sameGroupCount, cableRoutingMode);
  }, [
    previewCable?.id,
    previewCable?.fromDeviceId,
    previewCable?.fromPort?.type,
    previewCable?.fromPort?.index,
    previewCable?.fromPort?.side,
    previewCable?.toDeviceId,
    previewCable?.toPort?.type,
    previewCable?.toPort?.index,
    previewCable?.toPort?.side,
    previewCable?.type,
    previewCable?.color,
    previewCable?.manualPath,
    layout,
    visibleRoutes,
    cableRoutingMode
  ]);

  const maxDpr = visibleRoutes.length > 60 ? 1.25 : visibleRoutes.length > 30 ? 1.5 : 2;
  const canvasDpr: [number, number] = [1, Math.min(window.devicePixelRatio || 1, maxDpr)];
  const selectedRoute = visibleRoutes.find((route) => route.cableId === selectedCableId) ?? null;
  const fromDevice = layout.devices.find((device) => device.id === selectedRoute?.cable.fromDeviceId);
  const toDevice = layout.devices.find((device) => device.id === selectedRoute?.cable.toDeviceId);
  const fromLabel = endpointName(fromDevice, selectedRoute?.cable.fromPort);
  const toLabel = endpointName(toDevice, selectedRoute?.cable.toPort);
  const focus = useMemo((): SceneFocus | undefined => {
    if (!selectedRoute || cameraFocus === 'rack') return undefined;
    if (cameraFocus === 'route') {
      const rear = fromDevice && getCablePortFace(fromDevice, selectedRoute.cable.fromPort) === 'rear';
      return {
        points: buildRouteCurve(selectedRoute.points)?.getSpacedPoints(100) ?? [selectedRoute.fromPort, selectedRoute.toPort],
        direction: [1, 0.5, rear ? -1.4 : 1.4],
      };
    }
    const start = cameraFocus === 'start';
    const point = start ? selectedRoute.fromPort : selectedRoute.toPort;
    const device = start ? fromDevice : toDevice;
    const port = start ? selectedRoute.cable.fromPort : selectedRoute.cable.toPort;
    // Prefer the route's existing lead-out direction, including side-mounted outlets.
    const adjacent = start ? selectedRoute.points[1] : selectedRoute.points[selectedRoute.points.length - 2];
    const dx = (adjacent?.x ?? point.x) - point.x;
    const dz = (adjacent?.z ?? point.z) - point.z;
    const length = Math.hypot(dx, dz);
    const rear = device && getCablePortFace(device, port) === 'rear';
    const box = sceneModel.devices.find((solid) => solid.deviceId === device?.id)?.box;
    // Keep the device around the port in view, rather than magnifying a connector alone.
    const context = box ? [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => ({
      x: box.x + x * Math.max(0.6, box.width / 2),
      y: point.y + y * Math.max(0.25, Math.min(0.8, box.height / 2)),
      z: box.z + z * Math.max(0.15, box.depth / 2),
    })))) : [point];
    return {
      points: [...context, point],
      direction: length > 0.001 ? [dx / length, 0.15, dz / length] : [0, 0.15, rear ? -1 : 1],
    };
  }, [cameraFocus, selectedRoute, fromDevice, toDevice, sceneModel.devices]);

  const chooseFocus = (value: typeof cameraFocus) => {
    setCameraFocus(value);
    setFitRequest((n) => n + 1);
  };

  const chooseCable = (id: string) => {
    // A new selection highlights endpoints without unexpectedly moving the camera.
    setCameraFocus('rack');
    selectCable(id);
  };

  return (
    <div className="relative flex min-h-[320px] flex-1 flex-col overflow-hidden rounded-xl border border-edge bg-surface" data-testid="cable-viewer-3d">
      <SceneViewToolbar title="3D cable routing" preset={focus ? null : cameraPreset}
        onPreset={(value) => { setCameraPreset(value); chooseFocus('rack'); }}
        onFit={() => { setCameraPreset('overview'); chooseFocus('rack'); }}>
        <button className={sceneButtonClass} aria-pressed={drawingActive} onClick={() => { setEditingCableId(null); setDrawingActive(v => !v); selectCable(null); }}>Draw route</button>
        {selectedCableId && !drawingActive && <button className={sceneButtonClass} onClick={() => { setEditingCableId(selectedCableId); setDrawingActive(true); }}>Redraw route</button>}
        <details className="relative" onKeyDown={(event) => {
          if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); }
        }}>
          <summary className={`${sceneButtonClass} cursor-pointer list-none`}>Display</summary>
          <div className="absolute right-0 top-10 z-20 w-56 space-y-3 rounded-lg border border-edge bg-surface p-3 shadow-lg">
            <fieldset className="space-y-2">
              <legend className="mb-1 text-xs font-semibold text-content">Routing style</legend>
              {(['clean', 'realistic'] as const).map((mode) => <button key={mode} type="button"
                className={`${sceneButtonClass} mr-1 capitalize`} aria-pressed={cableRoutingMode === mode}
                onClick={() => setCableRoutingMode(mode)}>{mode}</button>)}
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-xs font-semibold text-content">Visible layers</legend>
              {(['rack', 'devices', 'cables'] as CableLayer[]).map((layer) => <label key={layer} className="flex items-center gap-2 text-xs capitalize text-content">
                <input type="checkbox" checked={layers[layer]} onChange={() => setLayers((current) => ({ ...current, [layer]: !current[layer] }))} />{layer}
              </label>)}
            </fieldset>
          </div>
        </details>
      </SceneViewToolbar>
      <div className="relative flex min-h-0 flex-1">
      <CableDrawingControls drawing={drawing} />
      <div className="relative min-w-0 flex-1">
      <CanvasWithRecovery shadows dpr={canvasDpr} data-testid="cable-routing-3d">
        <RackSceneCamera dimensions={sceneModel.dimensions} preset={cameraPreset} fitRequest={fitRequest} focus={focus} extraPoints={extraPoints} />
        <group>
          {/* Opaque rack frame + management channels */}
          <group visible={layers.rack || drawingActive}>
            <RackFrame3D frame={sceneModel.frame} />
            <CableChannels3D channels={sceneModel.channels} rackHeight={rackHeight} />
            <RearPanelGuides3D guides={sceneModel.rearGuides} />
            <CrossoverSupports3D supports={sceneModel.crossovers} />
          </group>

          {/* Opaque device solids */}
          <group visible={layers.devices || drawingActive}>
            <PrintedMounts3D layout={layout} />
            {sceneModel.devices.map((solid) => {
              const device = layout.devices.find((item) => item.id === solid.deviceId);
              if (!device) return null;
              return <group key={solid.deviceId}>
                <DeviceSolid3D solid={solid} device={device} />
                {selectedRoute && (solid.deviceId === fromDevice?.id || solid.deviceId === toDevice?.id) && <SelectionBox3D box={solid.box} />}
              </group>;
            })}
          </group>

          {/* Managed cables */}
          {layers.cables && !drawingActive && <group>
            {visibleRoutes.map((route) => (
              <ManagedCable3D
                key={route.cableId}
                route={route}
                selectedCableId={selectedCableId}
                selectedCableIds={selectedCableIds}
                focusMode={focusMode}
                onSelect={chooseCable}
                label={`${endpointName(layout.devices.find((d) => d.id === route.cable.fromDeviceId), route.cable.fromPort)} ↔ ${endpointName(layout.devices.find((d) => d.id === route.cable.toDeviceId), route.cable.toPort)}`}
              />
            ))}
            {previewRoute && <GhostManagedCable3D route={previewRoute} />}
            {selectedRoute && ([['A', selectedRoute.fromPort, fromLabel], ['B', selectedRoute.toPort, toLabel]] as const).map(([letter, point, label]) => (
              <group key={letter}>
                <SceneLabel3D position={[point.x, point.y + (letter === 'A' ? 0.09 : -0.09), point.z]} placement={letter === 'A' ? 'above' : 'below'}>
                  <span className="mr-1.5 font-bold text-accent-fg">{letter}</span>{label}
                </SceneLabel3D>
              </group>
            ))}
          </group>}

          <CableDrawingScene drawing={drawing} />
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
                { x: rackWidth / 2, z: -rackDepth / 2, label: 'RR-post', color: '#ef4444' }
              ].map((post) => (
                <group key={post.label}>
                  <mesh position={[post.x, bottom + 0.08, post.z]} scale={[0.025, 0.025, 0.025]}>
                    <primitive attach="geometry" object={DEBUG_SPHERE_GEOMETRY} />
                    <meshBasicMaterial color={post.color} />
                  </mesh>
                  <Text position={[post.x, bottom + 0.18, post.z]} fontSize={0.035} color={post.color} anchorX="center">
                    {post.label}
                  </Text>
                </group>
              ))}

              {/* Debug 0U anchors and mount info */}
              {layout.devices.filter((device) => device.sizeU === 0).map((device) => {
                const zone = getDeviceSpatialZone(device);
                const pos = getDeviceWorldBox(layout, device, sceneModel.dimensions);
                const color = zone.includes('left') ? '#fb923c' : '#38bdf8';
                const label = device.mountType === 'side-rail'
                  ? `${getZeroUEarSide(device)} side 0U`
                  : `${getZeroUEarSide(device)} rear 0U`;
                return (
                  <group key={`debug-${device.id}`}>
                    <mesh position={[pos.x, bottom + 0.08, pos.z]} scale={[0.03, 0.03, 0.03]}>
                      <primitive attach="geometry" object={DEBUG_SPHERE_GEOMETRY} />
                      <meshBasicMaterial color={color} />
                    </mesh>
                    <Text position={[pos.x, bottom + 0.2, pos.z]} fontSize={0.035} color={color} anchorX="center">
                      {label}
                    </Text>
                    <Text position={[pos.x, bottom + 0.28, pos.z]} fontSize={0.025} color="#fbbf24" anchorX="center">
                      {`${device.mountType ?? '?'} / ${device.mountSide0U ?? '?'} / ${device.outletFacing ?? '?'}`}
                    </Text>
                  </group>
                );
              })}

              {/* Cable node labels along each route */}
              {visibleRoutes.map((route) => {
                const nodes = route.cable.nodes ?? [];
                if (nodes.length === 0) return null;
                const curve = buildRouteCurve(route.points);
                if (!curve) return null;
                const points = curve.getPoints(Math.max(nodes.length - 1, 1));
                return (
                  <group key={`debug-labels-${route.cableId}`}>
                    {nodes.map((node, i) => {
                      const point = points[Math.min(i, points.length - 1)];
                      let label = '';
                      if (node.type === 'device') label = node.port ? `${node.port.type}${node.port.index + 1}` : 'device';
                      else if (node.type === 'h-manager') label = 'H-mgr';
                      else if (node.type === 'v-rail-left') label = 'V-rail-L';
                      else if (node.type === 'v-rail-right') label = 'V-rail-R';
                      return (
                        <Text
                          key={`${route.cableId}-node-${i}`}
                          position={[point.x, point.y, point.z + 0.04]}
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
      <SceneNavigationHint />
      </div>
      </div>
      {visibleRoutes.some((route) => route.routingDecision.kind === 'blocked') && <div role="status" className="max-h-24 overflow-y-auto border-t border-edge bg-surface px-3 py-2 text-xs text-amber-400">
        {visibleRoutes.filter((route) => route.routingDecision.kind === 'blocked').map((route) => <button key={route.cableId}
          className="mr-3 underline" onClick={() => chooseCable(route.cableId)}>
          Review route: {endpointName(layout.devices.find((device) => device.id === route.cable.fromDeviceId), route.cable.fromPort)}
        </button>)}
      </div>}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-edge bg-surface px-3 py-2 text-xs text-content-secondary" aria-live="polite">
        {selectedRoute ? <>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="break-words"><strong className="mr-2 text-accent-fg">A</strong>{fromLabel}</div>
            <div className="break-words"><strong className="mr-2 text-accent-fg">B</strong>{toLabel}</div>
            <div className={selectedRoute.routingDecision.kind === 'blocked' ? 'text-amber-400' : 'text-content-secondary'}>3D route: {selectedRoute.routingDecision.reason}</div>
          </div>
          <div className="flex flex-wrap gap-1">
            <button className={sceneButtonClass} type="button" aria-pressed={cameraFocus === 'route'} onClick={() => chooseFocus('route')}>Fit route</button>
            <button className={sceneButtonClass} type="button" aria-pressed={cameraFocus === 'start'} onClick={() => chooseFocus('start')}>Start A</button>
            <button className={sceneButtonClass} type="button" aria-pressed={cameraFocus === 'end'} onClick={() => chooseFocus('end')}>End B</button>
            <button className={sceneButtonClass} type="button" onClick={() => { setCameraFocus('rack'); selectCable(null); }}>Clear</button>
          </div>
        </> : <span>{visibleRoutes.length} routes · Hover to identify a cable; click to trace its endpoints.</span>}
      </div>
    </div>
  );
}
