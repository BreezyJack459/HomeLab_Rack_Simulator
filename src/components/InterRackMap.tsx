import { useMemo, useState } from 'react';
import { Network, Server, Cable, ArrowRight, AlertCircle, MapPin, Plus } from 'lucide-react';
import type { RackLayout, InterRackCable, PortRef } from '../types/rack';

interface InterRackMapProps {
  racks: RackLayout[];
  interRackCables: InterRackCable[];
  onSelectCable?: (cableId: string) => void;
  selectedCableId?: string | null;
  onAddCable?: () => void;
}

const RACK_WIDTH = 80;
const U_TO_PX = 4;
const RACK_SPACING = 180;
const PADDING_X = 90;
const PADDING_Y = 90;

const CABLE_TYPE_COLORS: Record<string, string> = {
  fiber: '#06b6d4',
  'sfp+': '#f59e0b',
  cat6a: '#3b82f6',
  dac: '#8b5cf6',
};

const HEALTH_COLORS: Record<string, string> = {
  good: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
};

type HealthStatus = 'good' | 'warning' | 'critical';

function getRackHealth(rack: RackLayout): HealthStatus {
  const deviceCount = rack.devices.length;
  if (deviceCount === 0) return 'warning';
  const occupiedU = rack.devices.reduce((sum, d) => sum + d.sizeU, 0);
  if (occupiedU > rack.heightU * 0.95) return 'critical';
  if (occupiedU > rack.heightU * 0.8) return 'warning';
  return 'good';
}

function getCableColor(cable: InterRackCable): string {
  return cable.color || CABLE_TYPE_COLORS[cable.type] || '#94a3b8';
}

function formatPortRef(port: PortRef): string {
  const side = port.side ? `-${port.side}` : '';
  return `${port.type}-${port.index + 1}${side}`;
}

function getDeviceName(rack: RackLayout, deviceId: string): string {
  const device = rack.devices.find((d) => d.id === deviceId);
  return device?.name ?? deviceId;
}

interface RackPosition {
  rack: RackLayout;
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
  bottomY: number;
}

interface CablePosition {
  cable: InterRackCable;
  fromPos: RackPosition;
  toPos: RackPosition;
  path: string;
  midX: number;
  midY: number;
  color: string;
}

function InterRackMap({ racks, interRackCables, onSelectCable, selectedCableId, onAddCable }: InterRackMapProps) {
  const [hoveredCableId, setHoveredCableId] = useState<string | null>(null);

  const { svgWidth, svgHeight, rackPositions, cablePositions } = useMemo(() => {
    const n = racks.length;
    const totalWidth = PADDING_X * 2 + Math.max(0, n - 1) * RACK_SPACING + RACK_WIDTH;
    const maxRackHeight = Math.max(...racks.map((r) => r.heightU * U_TO_PX), 40);
    const totalHeight = Math.max(360, maxRackHeight + PADDING_Y * 2 + 100);
    const centerY = totalHeight / 2 - 10;

    const positions: RackPosition[] = racks.map((rack, i) => {
      const x = PADDING_X + i * RACK_SPACING;
      const height = rack.heightU * U_TO_PX;
      const y = centerY - height / 2;
      return {
        rack,
        x,
        y,
        width: RACK_WIDTH,
        height,
        cx: x + RACK_WIDTH / 2,
        cy: y + height / 2,
        bottomY: y + height,
      };
    });

    const rackMap = new Map(positions.map((p) => [p.rack.id, p]));

    const cables: CablePosition[] = interRackCables
      .map((cable) => {
        const fromPos = rackMap.get(cable.fromRackId);
        const toPos = rackMap.get(cable.toRackId);
        if (!fromPos || !toPos) return null;

        const startX = fromPos.cx;
        const startY = fromPos.bottomY;
        const endX = toPos.cx;
        const endY = toPos.bottomY;
        const dist = Math.abs(endX - startX);
        const arcDepth = Math.min(100, dist * 0.35 + 30);

        const path = `M ${startX} ${startY} C ${startX} ${startY + arcDepth}, ${endX} ${endY + arcDepth}, ${endX} ${endY}`;
        const midX = (startX + endX) / 2;
        const midY = startY + arcDepth * 0.65;

        return {
          cable,
          fromPos,
          toPos,
          path,
          midX,
          midY,
          color: getCableColor(cable),
        };
      })
      .filter(Boolean) as CablePosition[];

    return { svgWidth: totalWidth, svgHeight: totalHeight, rackPositions: positions, cablePositions: cables };
  }, [racks, interRackCables]);

  const selectedCable = useMemo(
    () => interRackCables.find((c) => c.id === selectedCableId) ?? null,
    [interRackCables, selectedCableId]
  );

  const selectedFromRack = useMemo(
    () => racks.find((r) => r.id === selectedCable?.fromRackId) ?? null,
    [racks, selectedCable]
  );
  const selectedToRack = useMemo(
    () => racks.find((r) => r.id === selectedCable?.toRackId) ?? null,
    [racks, selectedCable]
  );

  if (racks.length === 0 || racks.length === 1) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-slate-200 bg-slate-900 p-8 dark:border-slate-800">
        <div className="text-center">
          <MapPin size={40} className="mx-auto mb-3 text-slate-500" />
          <p className="text-lg font-medium text-slate-300">Add more racks to see inter-rack connections</p>
          <p className="mt-1 text-sm text-slate-500">A workspace needs at least two racks to show an inter-rack map.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-slate-900 p-6 thin-scrollbar">
      <div className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
        <Network size={16} />
        Inter-Rack Map
      </div>

      <div className="relative min-w-max rounded-xl border border-slate-700 bg-slate-950/60 p-5 shadow-panel">
        <svg
          className="block"
          data-testid="inter-rack-map-svg"
          height={svgHeight}
          role="img"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          width={svgWidth}
        >
          <defs>
            <pattern id="inter-rack-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.8" fill="#334155" opacity="0.35" />
            </pattern>
            <filter id="cable-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="1" floodColor="#020617" floodOpacity="0.5" stdDeviation="1.5" />
            </filter>
          </defs>

          <rect fill="url(#inter-rack-grid)" height={svgHeight} width={svgWidth} x="0" y="0" />

          {/* Cables — render behind racks */}
          {cablePositions.map(({ cable, path, color }) => {
            const isSelected = selectedCableId === cable.id;
            const isHovered = hoveredCableId === cable.id;
            const dimmed = selectedCableId !== null && selectedCableId !== cable.id && !isHovered;
            const strokeWidth = isSelected ? 3 : isHovered ? 2.5 : 2;
            return (
              <g
                key={cable.id}
                data-inter-rack-cable={cable.id}
                onClick={() => onSelectCable?.(cable.id)}
                onMouseEnter={() => setHoveredCableId(cable.id)}
                onMouseLeave={() => setHoveredCableId(null)}
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
              >
                <path
                  d={path}
                  fill="none"
                  opacity={dimmed ? 0.15 : 0.35}
                  stroke="#020617"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={strokeWidth + 4}
                />
                <path
                  d={path}
                  fill="none"
                  filter="url(#cable-glow)"
                  opacity={dimmed ? 0.35 : 0.9}
                  stroke={color}
                  strokeDasharray={cable.type === 'fiber' ? '6 4' : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={strokeWidth}
                />
              </g>
            );
          })}

          {/* Cable labels at midpoint */}
          {cablePositions.map(({ cable, midX, midY, color }) => {
            const isSelected = selectedCableId === cable.id;
            const dimmed = selectedCableId !== null && selectedCableId !== cable.id;
            if (dimmed && !isSelected) return null;
            const label = cable.label || `${cable.type}${cable.lengthM ? ` · ${cable.lengthM}m` : ''}`;
            return (
              <g key={`label-${cable.id}`} transform={`translate(${midX}, ${midY})`}>
                <rect
                  fill="#0f172a"
                  height="18"
                  rx="4"
                  stroke={color}
                  strokeOpacity="0.5"
                  strokeWidth="1"
                  width={label.length * 6.5 + 12}
                  x={-(label.length * 6.5 + 12) / 2}
                  y="-9"
                />
                <text
                  fill="#cbd5e1"
                  fontSize="10"
                  fontWeight="500"
                  textAnchor="middle"
                  y="3"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Rack nodes */}
          {rackPositions.map(({ rack, x, y, width, height }) => {
            const health = getRackHealth(rack);
            const borderColor = HEALTH_COLORS[health];
            return (
              <g key={rack.id} data-inter-rack-node={rack.id}>
                {/* Rack name above */}
                <text fill="#e2e8f0" fontSize="12" fontWeight="600" textAnchor="middle" x={x + width / 2} y={y - 18}>
                  {rack.name}
                </text>

                {/* Rack rectangle */}
                <rect
                  fill="#1e293b"
                  height={height}
                  rx="6"
                  stroke={borderColor}
                  strokeWidth={health === 'good' ? 2 : 2.5}
                  width={width}
                  x={x}
                  y={y}
                />

                {/* Rack icon */}
                <g transform={`translate(${x + width / 2 - 10}, ${y + 10})`}>
                  <Server size={20} color="#64748b" />
                </g>

                {/* HeightU tick marks */}
                {Array.from({ length: Math.min(rack.heightU, 20) }, (_, i) => {
                  const tickY = y + (i / Math.min(rack.heightU, 20)) * height;
                  return (
                    <line
                      key={`tick-${rack.id}-${i}`}
                      stroke="#475569"
                      strokeOpacity="0.4"
                      strokeWidth="1"
                      x1={x + 6}
                      x2={x + width - 6}
                      y1={tickY}
                      y2={tickY}
                    />
                  );
                })}

                {/* Device count label inside bottom */}
                <text fill="#94a3b8" fontSize="9" textAnchor="middle" x={x + width / 2} y={y + height - 8}>
                  {rack.devices.length} devices · {rack.heightU}U
                </text>

                {/* Sub-label below */}
                <text fill="#64748b" fontSize="10" textAnchor="middle" x={x + width / 2} y={y + height + 16}>
                  {rack.devices.length} devices · {rack.heightU}U
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-800 pt-4">
          <span className="text-xs font-semibold text-slate-400">Cable Types</span>
          {(['fiber', 'sfp+', 'cat6a', 'dac'] as const).map((type) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-6 rounded-full" style={{ backgroundColor: CABLE_TYPE_COLORS[type] }} />
              <span className="text-xs capitalize text-slate-500">{type}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: HEALTH_COLORS.good }} />
              <span className="text-xs text-slate-500">Healthy</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: HEALTH_COLORS.warning }} />
              <span className="text-xs text-slate-500">Warning</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: HEALTH_COLORS.critical }} />
              <span className="text-xs text-slate-500">Critical</span>
            </div>
          </div>
        </div>
      </div>

      {/* Empty state for no cables */}
      {interRackCables.length === 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-400">
          <AlertCircle size={16} className="shrink-0 text-amber-500" />
          <span className="flex-1">No inter-rack cables yet.</span>
          {onAddCable && (
            <button
              onClick={onAddCable}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20"
              type="button"
            >
              <Plus size={12} />
              Add Cable
            </button>
          )}
        </div>
      )}

      {/* Selected cable detail card */}
      {selectedCable && selectedFromRack && selectedToRack && (
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800/80 p-4 shadow">
          <div className="mb-3 flex items-center gap-2">
            <Cable size={16} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-200">{selectedCable.label || selectedCable.id}</span>
            <span
              className="ml-2 inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: getCableColor(selectedCable) }}
            />
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">Type &amp; Length</div>
              <div className="text-slate-300">
                {selectedCable.type}
                {selectedCable.lengthM ? ` · ${selectedCable.lengthM}m` : ''}
              </div>
            </div>

            {selectedCable.notes && (
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">Notes</div>
                <div className="text-slate-300">{selectedCable.notes}</div>
              </div>
            )}

            <div className="sm:col-span-2">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Route</div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="rounded-md bg-slate-900/60 px-3 py-2">
                  <div className="text-xs text-slate-500">From</div>
                  <div className="text-slate-200">
                    {selectedFromRack.name}
                  </div>
                  <div className="text-slate-400">
                    {getDeviceName(selectedFromRack, selectedCable.fromDeviceId)}
                  </div>
                  <div className="font-mono text-xs text-slate-500">
                    {formatPortRef(selectedCable.fromPort)}
                  </div>
                </div>

                <ArrowRight size={16} className="mx-1 hidden text-slate-500 sm:block" />

                <div className="rounded-md bg-slate-900/60 px-3 py-2">
                  <div className="text-xs text-slate-500">To</div>
                  <div className="text-slate-200">
                    {selectedToRack.name}
                  </div>
                  <div className="text-slate-400">
                    {getDeviceName(selectedToRack, selectedCable.toDeviceId)}
                  </div>
                  <div className="font-mono text-xs text-slate-500">
                    {formatPortRef(selectedCable.toPort)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { InterRackMap };
export type { InterRackMapProps };
