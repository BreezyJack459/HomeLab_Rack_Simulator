import { Box, Cable, Eye, EyeOff, Map as MapIcon, Network, X } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { CablePlan, CableRoute, CableType, PlacedDevice, PortLayout, RackLayout } from '../types/rack';
import { DEFAULT_CABLE_COLORS, getCableDisplayColor } from '../utils/cableColors';
import { getPatchPanelLinkedCableIds } from '../utils/patchPanel';
import { calculateCablePlan, pathDescription } from '../utils/routing';
import { estimateCableLength, formatCableLength, getDeviceSpatialZone, getDeviceXRange, isZeroU, RACK_SPECS } from '../utils/rackMath';
const CableViewer3D = lazy(() => import('./CableViewer3D').then((m) => ({ default: m.CableViewer3D })));

const UNIT_HEIGHT = 40;
const RACK_X = 76;
const RACK_Y = 66;
const LANE_START_OFFSET = 92;
const LANE_SPACING = 30;
const CARD_WIDTH = 320;
const MUTED_CABLE_COLOR = '#64748b';

type CableFocusMode = 'dim' | 'hide';
type CableTypeFilter = CableType | 'all';
type CableMapView = '2d' | '3d';

const cableMeta: Record<CableType, { color: string; label: string; lane: number }> = {
  ethernet: { color: DEFAULT_CABLE_COLORS.ethernet, label: 'Ethernet', lane: 0 },
  fiber: { color: DEFAULT_CABLE_COLORS.fiber, label: 'Fiber', lane: 1 },
  power: { color: DEFAULT_CABLE_COLORS.power, label: 'Power', lane: 2 },
  usb: { color: DEFAULT_CABLE_COLORS.usb, label: 'USB', lane: 3 },
  hdmi: { color: DEFAULT_CABLE_COLORS.hdmi, label: 'HDMI', lane: 4 },
  atx: { color: DEFAULT_CABLE_COLORS.atx, label: 'ATX', lane: 5 },
  coax: { color: DEFAULT_CABLE_COLORS.coax, label: 'Coax', lane: 6 },
  structured: { color: DEFAULT_CABLE_COLORS.structured, label: 'Structured', lane: 7 },
  patch: { color: DEFAULT_CABLE_COLORS.patch, label: 'Patch', lane: 0 }
};

function cablePortLabel(cable: CableRoute) {
  const parts: string[] = [];
  if (cable.fromPort) {
    parts.push(`${cable.fromPort.type} ${cable.fromPort.index + 1}`);
  }
  if (cable.toPort) {
    parts.push(`→ ${cable.toPort.type} ${cable.toPort.index + 1}`);
  }
  return parts.length ? parts.join(' ') : undefined;
}

interface CablePath {
  cable: CableRoute;
  plan: CablePlan;
  from: PlacedDevice;
  to: PlacedDevice;
  path: string;
  color: string;
}

function truncateLabel(label: string, max = 24) {
  return label.length > max ? `${label.slice(0, max - 1)}...` : label;
}

function roundedPolylinePath(points: Array<{ x: number; y: number }>, radius = 18): string {
  if (points.length < 2) return '';
  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const previousVector = { x: previous.x - current.x, y: previous.y - current.y };
    const nextVector = { x: next.x - current.x, y: next.y - current.y };
    const previousLength = Math.hypot(previousVector.x, previousVector.y);
    const nextLength = Math.hypot(nextVector.x, nextVector.y);

    if (previousLength < 0.1 || nextLength < 0.1) {
      path += ` L ${current.x} ${current.y}`;
      continue;
    }

    const curveRadius = Math.min(radius, previousLength / 2, nextLength / 2);
    const entry = {
      x: current.x + (previousVector.x / previousLength) * curveRadius,
      y: current.y + (previousVector.y / previousLength) * curveRadius
    };
    const exit = {
      x: current.x + (nextVector.x / nextLength) * curveRadius,
      y: current.y + (nextVector.y / nextLength) * curveRadius
    };

    path += ` L ${entry.x} ${entry.y} Q ${current.x} ${current.y} ${exit.x} ${exit.y}`;
  }

  const last = points[points.length - 1];
  return `${path} L ${last.x} ${last.y}`;
}

function deviceCenterY(device: PlacedDevice, heightU: number) {
  return RACK_Y + (heightU - (device.positionU + device.sizeU / 2 - 0.5)) * UNIT_HEIGHT;
}

function buildNodePath(
  plan: CablePlan,
  layout: RackLayout,
  rackWidth: number,
  cable: CableRoute
): string {
  const nodes = plan.nodes;
  if (nodes.length === 0) return '';

  const from = layout.devices.find((d) => d.id === cable.fromDeviceId);
  const to = layout.devices.find((d) => d.id === cable.toDeviceId);
  const isDirectFront = !nodes.some((n) => n.type === 'v-rail-left' || n.type === 'v-rail-right');
  const midY = from && to
    ? (devicePortY(from, layout.heightU, cable.fromPort?.index, cable.fromPort?.type ?? cable.type) +
       devicePortY(to, layout.heightU, cable.toPort?.index, cable.toPort?.type ?? cable.type)) / 2
    : 0;

  const points: Array<{ x: number; y: number }> = [];

  // Front panel patching dresses into the nearest horizontal manager, then
  // travels along one bus lane. This keeps port jumpers from crossing.
  if (isDirectFront && plan.fromFace === 'front' && plan.toFace === 'front' && from && to) {
    const fromX = connectionX(layout, from, rackWidth, cable.type, cable.fromPort);
    const toX = connectionX(layout, to, rackWidth, cable.type, cable.toPort);
    const fromY = devicePortY(from, layout.heightU, cable.fromPort?.index, cable.fromPort?.type ?? cable.type);
    const toY = devicePortY(to, layout.heightU, cable.toPort?.index, cable.toPort?.type ?? cable.type);
    const midX = (fromX + toX) / 2;
    const managerWaypoint = plan.waypoints.find((point) => point.role === 'horizontal-manager' && point.deviceId);
    const manager = managerWaypoint
      ? layout.devices.find((device) => device.id === managerWaypoint.deviceId && device.category === 'cable-management')
      : undefined;
    const laneOffset = ((((cable.fromPort?.index ?? 0) + (cable.toPort?.index ?? 0)) % 6) - 2.5) * 4;
    const managerY = (manager ? deviceCenterY(manager, layout.heightU) : (fromY + toY) / 2) + laneOffset;

    points.push({ x: fromX, y: fromY });
    points.push({ x: fromX, y: managerY });
    points.push({ x: midX, y: managerY });
    points.push({ x: toX, y: managerY });
    points.push({ x: toX, y: toY });

    const deduped = points.filter((p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y);
    if (deduped.length < 2) return '';
    return roundedPolylinePath(deduped, 14);
  }

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const device = layout.devices.find((d) => d.id === node.deviceId);
    if (!device) continue;

    if (node.type === 'device') {
      const x = connectionX(layout, device, rackWidth, cable.type, node.port);
      const y = devicePortY(device, layout.heightU, node.port?.index, node.port?.type ?? cable.type);
      points.push({ x, y });
    } else if (node.type === 'h-manager') {
      const isFrom = node.deviceId === cable.fromDeviceId && from != null;
      const isTo = node.deviceId === cable.toDeviceId && to != null;
      // For direct front paths, place h-manager at midY for a clean U-shape
      const y = isDirectFront && (isFrom || isTo)
        ? midY
        : isFrom
          ? devicePortY(from, layout.heightU, cable.fromPort?.index, cable.fromPort?.type ?? cable.type)
          : isTo
            ? devicePortY(to, layout.heightU, cable.toPort?.index, cable.toPort?.type ?? cable.type)
            : deviceCenterY(device, layout.heightU);
      // Direct front paths: h-manager sits between the two device centers, not at rack center
      const x = isDirectFront && from && to
        ? (connectionX(layout, from, rackWidth, cable.type, cable.fromPort) + connectionX(layout, to, rackWidth, cable.type, cable.toPort)) / 2
        : RACK_X + rackWidth / 2;
      points.push({ x, y });
    } else if (node.type === 'v-rail-left') {
      const isFrom = node.deviceId === cable.fromDeviceId && from != null;
      const isTo = node.deviceId === cable.toDeviceId && to != null;
      const y = isFrom
        ? devicePortY(from, layout.heightU, cable.fromPort?.index, cable.fromPort?.type ?? cable.type)
        : isTo
          ? devicePortY(to, layout.heightU, cable.toPort?.index, cable.toPort?.type ?? cable.type)
          : deviceCenterY(device, layout.heightU);
      points.push({ x: RACK_X - 40, y });
    } else if (node.type === 'v-rail-right') {
      const isFrom = node.deviceId === cable.fromDeviceId && from != null;
      const isTo = node.deviceId === cable.toDeviceId && to != null;
      const y = isFrom
        ? devicePortY(from, layout.heightU, cable.fromPort?.index, cable.fromPort?.type ?? cable.type)
        : isTo
          ? devicePortY(to, layout.heightU, cable.toPort?.index, cable.toPort?.type ?? cable.type)
          : deviceCenterY(device, layout.heightU);
      points.push({ x: RACK_X + rackWidth + 40, y });
    }
  }

  // Deduplicate consecutive identical points
  const deduped = points.filter((p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y);

  if (deduped.length < 2) return '';
  return roundedPolylinePath(deduped, cable.type === 'power' ? 24 : 18);
}

function deviceTopY(device: PlacedDevice, heightU: number) {
  return RACK_Y + (heightU - (device.positionU + device.sizeU - 1)) * UNIT_HEIGHT + 4;
}

function devicePortY(device: PlacedDevice, heightU: number, portIndex: number | undefined, portType: string) {
  const center = deviceCenterY(device, heightU);
  if (portIndex === undefined) return center;
  const portCount = (device.ports as Record<string, number | undefined>)?.[portType];
  if (typeof portCount !== 'number' || portCount <= 1) return center;
  const deviceHeight = device.sizeU * UNIT_HEIGHT;
  const spread = Math.min(deviceHeight * 0.72, 36);
  const offset = ((portIndex / (portCount - 1)) - 0.5) * spread;
  return center + offset;
}

function connectionX(
  layout: RackLayout,
  device: PlacedDevice,
  rackWidth: number,
  cableType: CableType,
  portRef?: { type: string; index: number }
) {
  const usableWidth = RACK_SPECS[layout.rackType].usableWidthMm;
  const range = getDeviceXRange(layout, device);
  const leftX = RACK_X + (range.x / usableWidth) * rackWidth;
  const rightX = RACK_X + ((range.x + Math.min(range.width, usableWidth)) / usableWidth) * rackWidth;

  // Patch cables: front-to-front short jumpers — each port has its own X position
  if (cableType === 'patch') {
    const portIndex = portRef?.index ?? 0;
    const portType = portRef?.type ?? 'ethernet';
    const portCount = (device.ports as Record<string, number | undefined>)?.[portType] ?? 1;
    if (portCount <= 1) return rightX - 4;
    // Spread ports horizontally across the device front face
    const spreadWidth = Math.min((Math.min(range.width, usableWidth) / usableWidth) * rackWidth * 0.65, 36);
    const offset = (portIndex / Math.max(portCount - 1, 1)) * spreadWidth;
    return rightX - 4 - offset;
  }

  // Non-patch data/power cables: small per-port offset to separate parallel runs
  const baseX = cableType === 'power' ? leftX + 6 : rightX - 6;
  if (portRef && portRef.index > 0) {
    const portType = portRef.type ?? 'ethernet';
    const portCount = (device.ports as Record<string, number | undefined>)?.[portType] ?? 1;
    if (portCount > 1) {
      const maxOffset = cableType === 'power' ? 10 : 8;
      const offset = (portRef.index / Math.max(portCount - 1, 1)) * maxOffset;
      return baseX + (cableType === 'power' ? offset : -offset);
    }
  }
  return baseX;
}

export function CableMap() {
  const layout = useRackStore((state) => state.layout);
  const selectedCableId = useRackStore((state) => state.selectedCableId);
  const selectCable = useRackStore((state) => state.selectCable);
  const selectDevice = useRackStore((state) => state.selectDevice);
  const [focusMode, setFocusMode] = useState<CableFocusMode>('dim');
  const [typeFilter, setTypeFilter] = useState<CableTypeFilter>('all');
  const [mapView, setMapView] = useState<CableMapView>('2d');

  const rackWidth = RACK_SPECS[layout.rackType].visualWidthPx;
  const rackHeight = layout.heightU * UNIT_HEIGHT;
  const laneStartX = RACK_X + rackWidth + LANE_START_OFFSET;
  const routeListX = laneStartX + LANE_SPACING * 7 + 54;
  const mapWidth = routeListX + CARD_WIDTH + 70;
  const mapHeight = Math.max(620, RACK_Y * 2 + rackHeight);
  const selectedCableIds = useMemo(
    () => getPatchPanelLinkedCableIds(layout, selectedCableId),
    [layout, selectedCableId]
  );

  const cablePaths = useMemo(() => {
    return layout.cables
      .filter((cable) => typeFilter === 'all' || cable.type === typeFilter || selectedCableIds.has(cable.id))
      .map((cable): CablePath | null => {
        const from = layout.devices.find((device) => device.id === cable.fromDeviceId);
        const to = layout.devices.find((device) => device.id === cable.toDeviceId);
        if (!from || !to) return null;

        const plan = calculateCablePlan(cable, layout);
        if (!plan) return null;
        const nodes = plan.nodes;
        const path = buildNodePath(plan, layout, rackWidth, cable);

        return {
          cable,
          plan,
          from,
          to,
          path,
          color: getCableDisplayColor(cable.type, cable.color || cableMeta[cable.type].color)
        };
      })
      .filter(Boolean) as CablePath[];
  }, [layout, rackWidth, typeFilter, selectedCableIds]);

  const hasSelectedCable = selectedCableId !== null && cablePaths.some((path) => selectedCableIds.has(path.cable.id));
  const routeSummary = typeFilter === 'all' ? `${layout.cables.length}` : `${cablePaths.length} / ${layout.cables.length}`;

  function handleSetTypeFilter(nextType: CableTypeFilter) {
    setTypeFilter((current) => (current === nextType ? 'all' : nextType));
    selectCable(null);
  }

  const cableCounts = useMemo(() => {
    return layout.cables.reduce<Record<CableType, number>>(
      (counts, cable) => {
        counts[cable.type] += 1;
        return counts;
      },
      { ethernet: 0, power: 0, fiber: 0, usb: 0, hdmi: 0, atx: 0, coax: 0, structured: 0, patch: 0 }
    );
  }, [layout.cables]);

  return (
    <div className="h-full overflow-auto bg-slate-950/55 p-8 thin-scrollbar">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
            <Network size={16} />
            Cable Map
          </div>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Patch panels and nearby devices route directly; longer runs leave into side cable trays before dropping vertically.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
            <button
              className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                mapView === '2d' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
              }`}
              onClick={() => setMapView('2d')}
              type="button"
            >
              <MapIcon size={15} />
              2D map
            </button>
            <button
              className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                mapView === '3d' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
              }`}
              onClick={() => setMapView('3d')}
              type="button"
            >
              <Box size={15} />
              3D routing
            </button>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-4 py-3 text-right">
            <div className="text-2xl font-semibold text-white">{routeSummary}</div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
              {typeFilter === 'all' ? 'routes' : `${cableMeta[typeFilter].label} routes`}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pb-4">
        <button
          className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs transition ${
            typeFilter === 'all'
              ? 'border-cyan-300 bg-cyan-300/10 text-cyan-100'
              : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:text-slate-100'
          }`}
          onClick={() => handleSetTypeFilter('all')}
          type="button"
        >
          All
          <span className="text-slate-500">{layout.cables.length}</span>
        </button>
        {(Object.keys(cableMeta) as CableType[]).map((type) => (
          <button
            key={type}
            className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs transition ${
              typeFilter === type
                ? 'border-cyan-300 bg-cyan-300/10 text-cyan-100'
                : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:text-slate-100'
            }`}
            onClick={() => handleSetTypeFilter(type)}
            type="button"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cableMeta[type].color }} />
            {cableMeta[type].label}
            <span className="text-slate-500">{cableCounts[type]}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 p-1">
          <button
            className={`inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition ${
              focusMode === 'dim' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            }`}
            onClick={() => setFocusMode('dim')}
            type="button"
          >
            <Eye size={13} />
            Dim others
          </button>
          <button
            className={`inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition ${
              focusMode === 'hide' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            }`}
            onClick={() => setFocusMode('hide')}
            type="button"
          >
            <EyeOff size={13} />
            Hide others
          </button>
          {hasSelectedCable && (
            <button
              className="inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
              onClick={() => selectCable(null)}
              type="button"
            >
              <X size={13} />
              Clear
            </button>
          )}
        </div>
      </div>

      {mapView === '3d' ? (
        <Suspense fallback={<div className="flex h-96 items-center justify-center text-slate-400">Loading 3D cable routing…</div>}>
          <CableViewer3D typeFilter={typeFilter} focusMode={focusMode} />
        </Suspense>
      ) : (
      <div className="relative min-w-max rounded-xl border border-slate-800 bg-slate-950/88 p-5 shadow-panel">
        <svg
          className="block"
          data-testid="cable-map-svg"
          height={mapHeight}
          role="img"
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          width={mapWidth}
        >
          <defs>
            <filter id="cable-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" floodColor="#020617" floodOpacity="0.65" stdDeviation="2" />
            </filter>
          </defs>

          <text fill="#e2e8f0" fontSize="14" fontWeight="700" x={RACK_X} y="26">
            {layout.name}
          </text>
          <text fill="#64748b" fontSize="11" x={RACK_X} y="44">
            {RACK_SPECS[layout.rackType].label} / {layout.heightU}U / structured cable map
          </text>

          <rect fill="#020617" height={rackHeight} rx="8" stroke="#334155" strokeWidth="2" width={rackWidth} x={RACK_X} y={RACK_Y} />

          {/* Vertical Cable Managers */}
          <g>
            {/* Left VCM (power side) */}
            <rect fill="#0f172a" height={rackHeight} rx="3" stroke="#451a03" strokeOpacity="0.6" strokeWidth="1" width="16" x={RACK_X - 20} y={RACK_Y} />
            {Array.from({ length: Math.floor(rackHeight / 10) }, (_, i) => (
              <line
                key={`vcm-l-${i}`}
                stroke="#78350f"
                strokeLinecap="round"
                strokeOpacity="0.5"
                strokeWidth="1.5"
                x1={RACK_X - 18}
                x2={RACK_X - 6}
                y1={RACK_Y + 6 + i * 10}
                y2={RACK_Y + 6 + i * 10}
              />
            ))}
            <text fill="#92400e" fontSize="9" textAnchor="middle" transform={`rotate(-90 ${RACK_X - 12} ${RACK_Y + rackHeight / 2})`} x={RACK_X - 12} y={RACK_Y + rackHeight / 2}>
              PWR VCM
            </text>
            {/* Right VCM (data side) */}
            <rect fill="#0f172a" height={rackHeight} rx="3" stroke="#0c4a6e" strokeOpacity="0.6" strokeWidth="1" width="16" x={RACK_X + rackWidth + 4} y={RACK_Y} />
            {Array.from({ length: Math.floor(rackHeight / 10) }, (_, i) => (
              <line
                key={`vcm-r-${i}`}
                stroke="#075985"
                strokeLinecap="round"
                strokeOpacity="0.5"
                strokeWidth="1.5"
                x1={RACK_X + rackWidth + 6}
                x2={RACK_X + rackWidth + 18}
                y1={RACK_Y + 6 + i * 10}
                y2={RACK_Y + 6 + i * 10}
              />
            ))}
            <text fill="#0ea5e9" fontSize="9" textAnchor="middle" transform={`rotate(90 ${RACK_X + rackWidth + 12} ${RACK_Y + rackHeight / 2})`} x={RACK_X + rackWidth + 12} y={RACK_Y + rackHeight / 2}>
              DATA VCM
            </text>
          </g>

          {Array.from({ length: layout.heightU }, (_, index) => {
            const unit = layout.heightU - index;
            const y = RACK_Y + index * UNIT_HEIGHT;
            return (
              <g key={unit}>
                <line stroke="#1e293b" strokeWidth="1" x1={RACK_X} x2={RACK_X + rackWidth} y1={y} y2={y} />
                <text fill="#94a3b8" fontSize="11" textAnchor="end" x={RACK_X - 26} y={y + UNIT_HEIGHT / 2 + 4}>
                  U{unit}
                </text>
                <text fill="#94a3b8" fontSize="11" x={RACK_X + rackWidth + 26} y={y + UNIT_HEIGHT / 2 + 4}>
                  U{unit}
                </text>
              </g>
            );
          })}

          {layout.devices.filter((device) => device.category !== 'cable-management').map((device) => {
            if (isZeroU(device)) {
              const zone = getDeviceSpatialZone(device);
              const side = zone.includes('left') ? 'left' : 'right';
              const width = 22;
              const height = Math.max(36, rackHeight - 8);
              const x = side === 'left' ? RACK_X - 50 : RACK_X + rackWidth + 28;
              const y = RACK_Y + 4;
              return (
                <g key={device.id} data-cable-map-device={device.id} onClick={() => selectDevice(device.id)} role="button" tabIndex={0}>
                  <rect fill={device.color} height={height} opacity="0.9" rx="7" stroke="#e2e8f0" strokeOpacity="0.42" width={width} x={x} y={y} />
                  <text
                    fill="#ffffff"
                    fontSize="10"
                    fontWeight="700"
                    textAnchor="middle"
                    transform={`rotate(-90 ${x + width / 2} ${y + height / 2})`}
                    x={x + width / 2}
                    y={y + height / 2 + 3}
                  >
                    {truncateLabel(device.label || device.name, 30)}
                  </text>
                  <circle cx={x + width / 2} cy={y + height / 2} fill="#e2e8f0" r="3.5" />
                </g>
              );
            }
            const range = getDeviceXRange(layout, device);
            const usableWidth = RACK_SPECS[layout.rackType].usableWidthMm;
            const x = RACK_X + (range.x / usableWidth) * rackWidth;
            const y = deviceTopY(device, layout.heightU);
            const width = (Math.min(range.width, usableWidth) / usableWidth) * rackWidth;
            const height = device.sizeU * UNIT_HEIGHT - 8;
            return (
              <g key={device.id} data-cable-map-device={device.id} onClick={() => selectDevice(device.id)} role="button" tabIndex={0}>
                <rect fill={device.color} height={height} opacity="0.9" rx="7" stroke="#e2e8f0" strokeOpacity="0.42" width={width} x={x} y={y} />
                <text fill="#ffffff" fontSize={height < 36 ? 10 : 12} fontWeight="700" x={x + 10} y={y + Math.min(20, height - 8)}>
                  {truncateLabel(device.label || device.name, width < 150 ? 16 : 28)}
                </text>
                <circle cx={x + width - 10} cy={deviceCenterY(device, layout.heightU)} fill="#e2e8f0" r="3.5" />
              </g>
            );
          })}

          {/* Cable management devices: render as distinct HCM slots */}
          {layout.devices
            .filter((device) => device.category === 'cable-management')
            .map((device) => {
              const range = getDeviceXRange(layout, device);
              const usableWidth = RACK_SPECS[layout.rackType].usableWidthMm;
              const x = RACK_X + (range.x / usableWidth) * rackWidth;
              const y = deviceTopY(device, layout.heightU);
              const width = (Math.min(range.width, usableWidth) / usableWidth) * rackWidth;
              const height = device.sizeU * UNIT_HEIGHT - 8;
              return (
                <g key={`hcm-${device.id}`}>
                  <rect fill="#1e293b" height={height} opacity="0.95" rx="4" stroke="#475569" strokeDasharray="3 3" strokeWidth="1" width={width} x={x} y={y} />
                  {Array.from({ length: Math.max(3, Math.floor(width / 18)) }, (_, i) => (
                    <line
                      key={i}
                      stroke="#64748b"
                      strokeLinecap="round"
                      strokeOpacity="0.5"
                      strokeWidth="1.5"
                      x1={x + 8 + i * 18}
                      x2={x + 8 + i * 18}
                      y1={y + 4}
                      y2={y + height - 4}
                    />
                  ))}
                  <text fill="#94a3b8" fontSize="9" textAnchor="middle" x={x + width / 2} y={y + height / 2 + 3}>
                    HCM
                  </text>
                </g>
              );
            })}

          {/* Horizontal Cable Manager markers for patch cable U-turns */}
          {cablePaths
            .filter(({ cable }) => cable.type === 'patch')
            .map(({ cable, from, to }) => {
              const fromX = connectionX(layout, from, rackWidth, cable.type, cable.fromPort);
              const toX = connectionX(layout, to, rackWidth, cable.type, cable.toPort);
              const fromY = devicePortY(from, layout.heightU, cable.fromPort?.index, cable.fromPort?.type ?? cable.type);
              const toY = devicePortY(to, layout.heightU, cable.toPort?.index, cable.toPort?.type ?? cable.type);
              const midX = (fromX + toX) / 2;
              const midY = (fromY + toY) / 2;
              const frontOffset = Math.min(18, Math.max(10, Math.abs(fromY - toY) * 0.35 + 6));
              return (
                <g key={`patch-hcm-${cable.id}`} opacity="0.7">
                  <rect fill="#0c4a6e" height="10" rx="2" width="24" x={midX - 12} y={midY - frontOffset - 5} />
                  <text fill="#7dd3fc" fontSize="7" textAnchor="middle" x={midX} y={midY - frontOffset + 1}>
                    PATCH
                  </text>
                </g>
              );
            })}

          {(Object.keys(cableMeta) as CableType[])
            .filter((type) => typeFilter === 'all' || type === typeFilter)
            .map((type) => {
            const meta = cableMeta[type];
            const laneX = laneStartX + meta.lane * LANE_SPACING;
            return (
              <g key={type}>
                <rect fill={meta.color} height={rackHeight} opacity="0.08" rx="8" width="18" x={laneX - 9} y={RACK_Y} />
                <line stroke={meta.color} strokeDasharray="4 6" strokeLinecap="round" strokeOpacity="0.4" strokeWidth="2" x1={laneX} x2={laneX} y1={RACK_Y} y2={RACK_Y + rackHeight} />
                <text fill="#94a3b8" fontSize="10" textAnchor="middle" transform={`rotate(-90 ${laneX} ${RACK_Y - 16})`} x={laneX} y={RACK_Y - 16}>
                  {meta.label}
                </text>
              </g>
            );
          })}

          {cablePaths.map(({ cable, path, color }, index) => {
            const selected = selectedCableIds.has(cable.id);
            const muted = hasSelectedCable && !selected;
            const typeMuted = !hasSelectedCable && typeFilter === 'all' && cable.type === 'structured';
            const isMuted = muted || typeMuted;
            if (isMuted && focusMode === 'hide') return null;

            const displayColor = isMuted ? MUTED_CABLE_COLOR : color;
            const routeState = selected ? 'selected' : isMuted ? 'muted' : 'normal';
            return (
              <g
                key={cable.id}
                data-cable-map-route={cable.id}
                data-cable-map-route-state={routeState}
                onClick={() => selectCable(cable.id)}
                role="button"
                tabIndex={0}
              >
                <path
                  d={path}
                  fill="none"
                  filter="url(#cable-soft-shadow)"
                  opacity={selected ? 0.62 : isMuted ? 0.12 : 0.28}
                  stroke="#020617"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={selected ? 11 : isMuted ? 6 : 8}
                />
                <path
                  d={path}
                  fill="none"
                  opacity={selected ? 1 : isMuted ? 0.28 : 0.78}
                  stroke={displayColor}
                  strokeDasharray={cable.type === 'fiber' ? '8 7' : cable.type === 'power' ? '1 8' : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={selected ? 5 : isMuted ? 2 : 3}
                />
                <circle
                  fill={displayColor}
                  r={selected ? 4.5 : isMuted ? 2.8 : 3.2}
                  cx={routeListX - 26}
                  cy={RACK_Y + 18 + index * 24}
                  opacity={isMuted ? 0.36 : 0.9}
                />
              </g>
            );
          })}
        </svg>

        <div className="absolute top-20" style={{ left: routeListX, width: CARD_WIDTH }}>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <Cable size={14} />
            Route List
          </div>
          <div className="max-h-[calc(100vh-260px)] space-y-2 overflow-y-auto pr-1 thin-scrollbar">
            {cablePaths.length === 0 && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/78 p-4 text-sm text-slate-400">
                {typeFilter === 'all' ? 'No cable routes yet.' : `No ${cableMeta[typeFilter].label.toLowerCase()} cable routes.`}
              </div>
            )}
            {cablePaths.map(({ cable, plan, from, to, color }) => {
              const selected = selectedCableIds.has(cable.id);
              const muted = hasSelectedCable && !selected;
              const typeMuted = !hasSelectedCable && typeFilter === 'all' && cable.type === 'structured';
              const isMuted = muted || typeMuted;
              return (
                <button
                  key={cable.id}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selected
                      ? 'border-cyan-300 bg-cyan-300/10'
                      : isMuted
                        ? 'border-slate-800 bg-slate-950/70 opacity-70 hover:border-slate-700'
                        : 'border-slate-800 bg-slate-900/82 hover:border-slate-700'
                  }`}
                  data-cable-map-card={cable.id}
                  data-cable-map-card-state={selected ? 'selected' : isMuted ? 'muted' : 'normal'}
                  onClick={() => selectCable(cable.id)}
                  type="button"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: isMuted ? MUTED_CABLE_COLOR : color }} />
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{cableMeta[cable.type].label}</span>
                  </div>
                  <div className={`mt-2 text-sm font-medium ${isMuted ? 'text-slate-400' : 'text-slate-100'}`}>
                    {from.name} <span className="text-slate-500">to</span> {to.name}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {pathDescription(cable, plan.nodes, layout)}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <span>U{from.positionU} to U{to.positionU}</span>
                    <span>·</span>
                    <span>{formatCableLength(plan.standardLengthMm)} std</span>
                    <span>·</span>
                    <span>{plan.discipline} / {plan.rail ? `${plan.rail} tray` : 'front manager'}</span>
                    {cablePortLabel(cable) && (
                      <>
                        <span>·</span>
                        <span>{cablePortLabel(cable)}</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
