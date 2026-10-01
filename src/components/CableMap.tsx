import { ABCableConnector } from './ABCableConnector';
import { withoutHiddenZeroUPdu } from '../utils/featureFlags';
import { Box, Eye, EyeOff, Map as MapIcon, Network, Table2, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useCableWorkspaceStore } from '../store/cableWorkspaceStore';
import { useRackStore } from '../store/rackStore';
import type { CablePlan, CableRoute, CableType, PlacedDevice, PortLayout, RackLayout } from '../types/rack';
import { DEFAULT_CABLE_COLORS, getCableDisplayColor } from '../utils/cableColors';
import { matchesCableQuery } from '../utils/cableQuery';
import { getPatchPanelLinkedCableIds } from '../utils/patchPanel';
import { manualRoutePoints } from '../utils/manualCableRoute';
import { getRackWorldDimensions } from '../utils/rackGeometry';
import { calculateCablePlan } from '../utils/routing';
import { getDeviceSpatialZone, getDeviceXRange, isZeroU, RACK_SPECS } from '../utils/rackMath';
import { VisualCableConnector } from './VisualCableConnector';
import { CableTable } from './CableTable';
const CableViewer3D = lazy(() => import('./CableViewer3D').then((m) => ({ default: m.CableViewer3D })));

const UNIT_HEIGHT = 40;
const RACK_X = 76;
const RACK_Y = 66;
const LANE_START_OFFSET = 92;
const LANE_SPACING = 30;
const MUTED_CABLE_COLOR = '#64748b';

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


export interface CablePath {
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
  if (cable.manualPath !== undefined) {
    const dimensions = getRackWorldDimensions(layout);
    return roundedPolylinePath(manualRoutePoints(cable, layout).map(point => ({
      x: RACK_X + (point.x / dimensions.rackWidth + 0.5) * rackWidth,
      y: RACK_Y + (0.5 - point.y / dimensions.rackHeight) * layout.heightU * UNIT_HEIGHT,
    })), 8);
  }
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

interface CableMapProps {
  embedded?: boolean;
  layout?: RackLayout;
}

export function CableMap({ layout: layoutOverride, embedded = false }: CableMapProps) {
  const storeLayout = useRackStore((state) => state.layout);
  const layout = useMemo(() => withoutHiddenZeroUPdu(layoutOverride ?? storeLayout), [layoutOverride, storeLayout]);
  const selectedCableId = useRackStore((state) => state.selectedCableId);
  const selectCable = useRackStore((state) => state.selectCable);
  const selectDevice = useRackStore((state) => state.selectDevice);
  const previewCable = useRackStore(s => s.previewCable);
  const previewPlan = previewCable ? calculateCablePlan(previewCable, layout) : null;
  const connecting = useCableWorkspaceStore(s => s.connectionRequested);
  const mapView = useCableWorkspaceStore((state) => state.subview);
  const setMapView = useCableWorkspaceStore((state) => state.setSubview);
  const query = useCableWorkspaceStore((state) => state.query);
  const setQuery = useCableWorkspaceStore((state) => state.setQuery);
  const hiddenTypes = useCableWorkspaceStore((state) => state.hiddenTypes);
  const setTypeVisible = useCableWorkspaceStore((state) => state.setTypeVisible);
  const showAllTypes = useCableWorkspaceStore((state) => state.showAllTypes);
  const focusMode = useCableWorkspaceStore((state) => state.focusMode);
  const setFocusMode = useCableWorkspaceStore((state) => state.setFocusMode);
  const [showEmptyTypes, setShowEmptyTypes] = useState(false);
  const abRequested = useCableWorkspaceStore(state => state.abRequested);
  const [showConnectionCableView, setShowConnectionCableView] = useState(false);
  useEffect(() => { if (!connecting) setShowConnectionCableView(false); }, [connecting]);

  const rackWidth = RACK_SPECS[layout.rackType].visualWidthPx;
  const rackHeight = layout.heightU * UNIT_HEIGHT;
  const laneStartX = RACK_X + rackWidth + LANE_START_OFFSET;
  const mapWidth = laneStartX + LANE_SPACING * 8 + 30;
  const mapHeight = Math.max(620, RACK_Y * 2 + rackHeight);
  const selectedCableIds = useMemo(
    () => getPatchPanelLinkedCableIds(layout, selectedCableId),
    [layout.cables, layout.devices, selectedCableId]
  );

  const cablePaths = useMemo(() => {
    return layout.cables
      .filter((cable) => {
        if (selectedCableIds.has(cable.id)) return true;
        if (hiddenTypes.includes(cable.type)) return false;
        return matchesCableQuery(cable, layout, query);
      })
      .map((cable): CablePath | null => {
        const from = layout.devices.find((device) => device.id === cable.fromDeviceId);
        const to = layout.devices.find((device) => device.id === cable.toDeviceId);
        if (!from || !to) return null;

        const plan = calculateCablePlan(cable, layout);
        if (!plan) return null;
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
  }, [layout.cables, layout.devices, layout.rackType, layout.rackDepthMm, layout.heightU, rackWidth, hiddenTypes, query, selectedCableIds]);

  const hasSelectedCable = selectedCableId !== null && cablePaths.some((path) => selectedCableIds.has(path.cable.id));
  const routeSummary = hiddenTypes.length === 0 && query.trim() === ''
    ? `${layout.cables.length}`
    : `${cablePaths.length} / ${layout.cables.length}`;

  const cableCounts = useMemo(() => {
    return layout.cables.reduce<Record<CableType, number>>(
      (counts, cable) => {
        counts[cable.type] += 1;
        return counts;
      },
      { ethernet: 0, power: 0, fiber: 0, usb: 0, hdmi: 0, atx: 0, coax: 0, structured: 0, patch: 0 }
    );
  }, [layout.cables]);

  // Density: zero-count types collapse behind a "+N more" toggle so the filter
  // row only shows types that actually exist in the layout.
  const allCableTypes = Object.keys(cableMeta) as CableType[];
  const emptyTypeCount = allCableTypes.filter((type) => cableCounts[type] === 0).length;
  const visibleCableTypes = allCableTypes.filter(
    (type) => showEmptyTypes || cableCounts[type] > 0 || hiddenTypes.includes(type)
  );

  return (
    <div className={`h-full overflow-auto bg-fill/55 thin-scrollbar dark:bg-surface/55 ${connecting ? showConnectionCableView && embedded ? 'lg:grid lg:min-h-0 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-3 lg:overflow-hidden' : 'lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden' : ''} ${embedded || mapView === '3d' ? 'flex min-h-0 flex-col p-2' : 'p-8'}`}>
      {abRequested && <ABCableConnector />}
      {connecting && <VisualCableConnector showCableView={showConnectionCableView} onToggleCableView={() => {
        if (!showConnectionCableView && mapView === 'table') setMapView('3d');
        setShowConnectionCableView(value => !value);
      }} />}
      {!embedded && <div className={connecting && !showConnectionCableView ? "lg:hidden" : "shrink-0"}>
      <div className={`flex shrink-0 flex-wrap items-center justify-between gap-3 ${mapView === '3d' ? 'mb-3' : 'mb-5'}`}>
        <div>
          <div className="flex items-center gap-2 text-base font-semibold text-content">
            <Network size={16} />
            Cable map
          </div>
          {mapView !== '3d' && <p className="mt-2 max-w-3xl text-sm text-content-muted">
            Patch panels and nearby devices route directly; longer runs leave into side cable trays before dropping vertically.
          </p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-edge bg-fill p-1 dark:border-edge dark:bg-surface-raised">
            <button
              className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                mapView === '2d' ? 'bg-accent-solid text-content dark:bg-accent dark:text-accent-on' : 'text-content-secondary hover:bg-fill-strong hover:text-content-secondary dark:hover:bg-fill dark:hover:text-content'
              }`}
              onClick={() => setMapView('2d')}
              type="button"
            >
              <MapIcon size={15} />
              2D map
            </button>
            <button
              className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                mapView === '3d' ? 'bg-accent-solid text-content dark:bg-accent dark:text-accent-on' : 'text-content-secondary hover:bg-fill-strong hover:text-content-secondary dark:hover:bg-fill dark:hover:text-content'
              }`}
              onClick={() => setMapView('3d')}
              type="button"
            >
              <Box size={15} />
              3D routing
            </button>
            <button
              className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                mapView === 'table' ? 'bg-accent-solid text-content dark:bg-accent dark:text-accent-on' : 'text-content-secondary hover:bg-fill-strong hover:text-content-secondary dark:hover:bg-fill dark:hover:text-content'
              }`}
              onClick={() => setMapView('table')}
              type="button"
            >
              <Table2 size={15} />
              Table
            </button>
          </div>
          <div className={`rounded-lg border border-edge bg-surface/80 text-right dark:border-edge dark:bg-surface-raised/80 ${mapView === '3d' ? 'px-3 py-1' : 'px-4 py-3'}`}>
            <div className="text-2xl font-semibold text-content">{routeSummary}</div>
            <div className="text-xs text-content-faint">
              routes visible
            </div>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2 pb-3">
        <input
          aria-label="Filter cable routes"
          className="h-8 w-52 rounded-md border border-edge bg-fill-subtle px-3 text-sm text-content placeholder-content-faint outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 dark:border-edge-strong dark:bg-surface-raised dark:text-content"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter cables…"
          type="search"
          value={query}
        />
        <button
          className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs transition ${
            hiddenTypes.length === 0
              ? 'border-accent bg-accent/10 text-accent-fg-strong'
              : 'border-edge bg-fill text-content-secondary hover:border-edge-strong hover:text-content dark:border-edge dark:bg-surface-raised dark:text-content-secondary dark:hover:border-edge-strong dark:hover:text-content'
          }`}
          onClick={showAllTypes}
          type="button"
        >
          All
          <span className="text-content-faint">{layout.cables.length}</span>
        </button>
        {visibleCableTypes.map((type) => (
          <button
            key={type}
            className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs transition ${
              !hiddenTypes.includes(type)
                ? 'border-accent bg-accent-solid/10 text-accent-fg-strong dark:border-accent dark:bg-accent/10 dark:text-accent-fg-strong'
                : 'border-edge bg-fill text-content-secondary hover:border-edge-strong hover:text-content dark:border-edge dark:bg-surface-raised dark:text-content-secondary dark:hover:border-edge-strong dark:hover:text-content'
            }`}
            onClick={() => setTypeVisible(type, hiddenTypes.includes(type))}
            type="button"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cableMeta[type].color }} />
            {cableMeta[type].label}
            <span className="text-content-faint">{cableCounts[type]}</span>
          </button>
        ))}
        {emptyTypeCount > 0 && (
          <button
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-content-faint transition hover:text-content-secondary dark:text-content-faint dark:hover:text-content-secondary"
            onClick={() => setShowEmptyTypes((value) => !value)}
            type="button"
          >
            {showEmptyTypes ? 'Show less' : `+${emptyTypeCount} more`}
          </button>
        )}
        <div className="ml-auto flex items-center gap-2 rounded-md border border-edge bg-fill p-1 dark:border-edge dark:bg-surface-raised">
          <button
            className={`inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition ${
              focusMode === 'all' ? 'bg-slate-300 text-content dark:bg-fill-strong dark:text-content' : 'text-content-muted hover:bg-fill-strong hover:text-content-muted dark:hover:bg-fill dark:hover:text-content'
            }`}
            onClick={() => setFocusMode('all')}
            type="button"
          >
            <Eye size={13} />
            Show all
          </button>
          <button
            className={`inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition ${
              focusMode === 'dim' ? 'bg-slate-300 text-content dark:bg-fill-strong dark:text-content' : 'text-content-muted hover:bg-fill-strong hover:text-content-muted dark:hover:bg-fill dark:hover:text-content'
            }`}
            onClick={() => setFocusMode('dim')}
            type="button"
          >
            <Eye size={13} />
            Dim others
          </button>
          <button
            className={`inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition ${
              focusMode === 'hide' ? 'bg-slate-300 text-content dark:bg-fill-strong dark:text-content' : 'text-content-muted hover:bg-fill-strong hover:text-content-muted dark:hover:bg-fill dark:hover:text-content'
            }`}
            onClick={() => setFocusMode('hide')}
            type="button"
          >
            <EyeOff size={13} />
            Hide others
          </button>
          {hasSelectedCable && (
            <button
              className="inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium text-content-muted transition hover:bg-fill-strong hover:text-content-muted dark:hover:bg-fill dark:hover:text-content"
              onClick={() => selectCable(null)}
              type="button"
            >
              <X size={13} />
              Clear
            </button>
          )}
        </div>
      </div>

      </div>}
      <div className={connecting ? `min-h-[400px] shrink-0 h-[500px] ${showConnectionCableView ? 'lg:flex lg:h-auto lg:min-h-0 lg:min-w-0 lg:flex-1 lg:flex-col lg:overflow-auto' : 'lg:hidden'}` : "flex min-h-0 flex-1 flex-col"}>
      {mapView === 'table' ? (
        <CableTable
          embedded={embedded}
          cablePaths={cablePaths}
          layout={layout}
          onSelectCable={selectCable}
          selectedCableId={selectedCableId}
        />
      ) : mapView === '3d' ? (
        <Suspense fallback={<div className="flex h-96 items-center justify-center text-content-muted">Loading 3D cable routing…</div>}>
          <CableViewer3D fitAvailableHeight={connecting && showConnectionCableView} />
        </Suspense>
      ) : (
      <div className={embedded ? "relative min-h-0 flex-1" : "relative min-w-max rounded-xl border border-edge bg-surface/88 p-5 shadow-panel dark:border-edge dark:bg-surface/88"}>
        <svg
          className="block"
          data-testid="cable-map-svg"
          height={embedded ? '100%' : mapHeight}
          role="img"
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          width={embedded ? '100%' : mapWidth}
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
            .filter((type) => !hiddenTypes.includes(type))
            .map((type) => {
            const meta = cableMeta[type];
            const laneX = laneStartX + meta.lane * LANE_SPACING;
            return (
              <g key={type}>
                <rect fill={meta.color} height={rackHeight} opacity="0.08" rx="8" width="18" x={laneX - 9} y={RACK_Y} />
                <line stroke={meta.color} strokeDasharray="4 6" strokeLinecap="round" strokeOpacity="0.4" strokeWidth="2" x1={laneX} x2={laneX} y1={RACK_Y} y2={RACK_Y + rackHeight} />
              </g>
            );
          })}

          {cablePaths.map(({ cable, path, color, from, to }) => {
            const selected = selectedCableIds.has(cable.id);
            const isMuted = focusMode !== 'all' && hasSelectedCable && !selected;
            if (isMuted && focusMode === 'hide') return null;

            const displayColor = isMuted ? MUTED_CABLE_COLOR : color;
            const routeState = selected ? 'selected' : isMuted ? 'muted' : 'normal';

            const fromX = connectionX(layout, from, rackWidth, cable.type, cable.fromPort ?? undefined);
            const fromY = devicePortY(from, layout.heightU, cable.fromPort?.index, cable.fromPort?.type ?? cable.type);
            const toX = connectionX(layout, to, rackWidth, cable.type, cable.toPort ?? undefined);
            const toY = devicePortY(to, layout.heightU, cable.toPort?.index, cable.toPort?.type ?? cable.type);

            const fromLabel = cable.fromPort ? `${cable.fromPort.type} ${cable.fromPort.index + 1}` : from.name;
            const toLabel = cable.toPort ? `${cable.toPort.type} ${cable.toPort.index + 1}` : to.name;

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
                {/* Port endpoint dots */}
                <circle
                  fill={isMuted ? '#1e293b' : '#ffffff'}
                  stroke={displayColor}
                  strokeWidth={selected ? 2 : 1.5}
                  r={selected ? 5 : 3.5}
                  cx={fromX}
                  cy={fromY}
                  opacity={isMuted ? 0.3 : 0.95}
                  style={{ pointerEvents: 'none' }}
                />
                <circle
                  fill={isMuted ? '#1e293b' : '#ffffff'}
                  stroke={displayColor}
                  strokeWidth={selected ? 2 : 1.5}
                  r={selected ? 5 : 3.5}
                  cx={toX}
                  cy={toY}
                  opacity={isMuted ? 0.3 : 0.95}
                  style={{ pointerEvents: 'none' }}
                />
                {/* Selected cable port labels */}
                {selected && (
                  <>
                    <text
                      fill={displayColor}
                      fontSize={9}
                      fontWeight={600}
                      textAnchor={cable.type === 'power' ? 'start' : 'end'}
                      x={cable.type === 'power' ? fromX + 8 : fromX - 8}
                      y={fromY + 3}
                    >
                      {fromLabel}
                    </text>
                    <text
                      fill={displayColor}
                      fontSize={9}
                      fontWeight={600}
                      textAnchor={cable.type === 'power' ? 'start' : 'end'}
                      x={cable.type === 'power' ? toX + 8 : toX - 8}
                      y={toY + 3}
                    >
                      {toLabel}
                    </text>
                  </>
                )}
              </g>
            );
          })}
          {previewCable && previewPlan && <path data-testid="connection-preview-path" d={buildNodePath(previewPlan, layout, rackWidth, previewCable)} fill="none" stroke={previewCable.color} strokeWidth={4} strokeDasharray="8 5" pointerEvents="none" />}
        </svg>
      </div>
      )}
      </div>
    </div>
  );
}
