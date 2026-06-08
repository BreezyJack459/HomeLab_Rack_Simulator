import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Download, ZoomIn, ZoomOut, RotateCcw, AlertTriangle } from 'lucide-react';
import { useRackStore } from '../store/rackStore';
import type { RackLayout } from '../types/rack';
import {
  buildTopologyGraph,
  layoutTopologyGraph,
  roleToColor,
  roleToLabel,
  cableTypeToColor,
  cableTypeToStroke,
  findSingleUplinkSwitches,
  findSpeedMismatches,
  findMediaMismatches,
  extractVlanFromNotes,
  type TopologyNode,
  type TopologyEdge,
} from '../utils/topologyGraph';

interface Props {
  layout: RackLayout;
}

const NODE_RADIUS = 22;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

export function NetworkTopology({ layout }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectDevice = useRackStore((s) => s.selectDevice);
  const selectedDeviceId = useRackStore((s) => s.selectedDeviceId);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setContainerSize({ width: cr.width, height: cr.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { nodes, edges, singleUplinkIds, speedMismatchIds, mediaMismatchIds } = useMemo(() => {
    const graph = buildTopologyGraph(layout);
    layoutTopologyGraph(graph, containerSize.width, containerSize.height, 120);
    const singleUplinkIds = findSingleUplinkSwitches(graph);
    const speedMismatchIds = new Set(findSpeedMismatches(graph).map((e) => e.id));
    const mediaMismatchIds = new Set(findMediaMismatches(graph).map((e) => e.id));
    return { ...graph, singleUplinkIds, speedMismatchIds, mediaMismatchIds };
  }, [layout, containerSize.width, containerSize.height]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleNodeClick = useCallback((node: TopologyNode) => {
    selectDevice(node.id);
  }, [selectDevice]);

  const handleExportPng = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = containerSize.width * 2;
      canvas.height = containerSize.height * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.download = 'network-topology.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = url;
  }, [containerSize]);

  const handleExportSvg = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = 'network-topology.svg';
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">
        <div className="text-center">
          <p className="text-lg font-medium">No devices to visualize</p>
          <p className="text-sm">Add devices and cables to see the network topology.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-slate-900" onWheel={handleWheel}>
      {/* Toolbar */}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/90 px-2 py-1 shadow">
          <button onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.2))} className="rounded p-1 text-slate-300 hover:bg-slate-700 hover:text-white" title="Zoom in">
            <ZoomIn size={16} />
          </button>
          <span className="min-w-[3ch] text-center text-xs text-slate-400">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z * 0.8))} className="rounded p-1 text-slate-300 hover:bg-slate-700 hover:text-white" title="Zoom out">
            <ZoomOut size={16} />
          </button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="rounded p-1 text-slate-300 hover:bg-slate-700 hover:text-white" title="Reset view">
            <RotateCcw size={16} />
          </button>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/90 px-2 py-1 shadow">
          <button onClick={handleExportPng} className="rounded p-1 text-slate-300 hover:bg-slate-700 hover:text-white" title="Export PNG">
            <Download size={16} />
          </button>
          <button onClick={handleExportSvg} className="rounded p-1 text-slate-300 hover:bg-slate-700 hover:text-white" title="Export SVG">
            <span className="text-xs font-bold">SVG</span>
          </button>
        </div>
        {singleUplinkIds.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg border border-amber-700/50 bg-amber-900/30 px-3 py-1.5 text-xs text-amber-300">
            <AlertTriangle size={14} />
            {singleUplinkIds.length} switch{singleUplinkIds.length > 1 ? 'es' : ''} with ≤1 uplink
          </div>
        )}
        {speedMismatchIds.size > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg border border-rose-700/50 bg-rose-900/30 px-3 py-1.5 text-xs text-rose-300">
            <AlertTriangle size={14} />
            {speedMismatchIds.size} speed mismatch{speedMismatchIds.size > 1 ? 'es' : ''}
          </div>
        )}
        {mediaMismatchIds.size > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg border border-orange-700/50 bg-orange-900/30 px-3 py-1.5 text-xs text-orange-300">
            <AlertTriangle size={14} />
            {mediaMismatchIds.size} media mismatch{mediaMismatchIds.size > 1 ? 'es' : ''}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute right-3 top-3 z-10 rounded-lg border border-slate-700 bg-slate-800/90 p-3 shadow">
        <p className="mb-2 text-xs font-semibold text-slate-300">Roles</p>
        <div className="space-y-1.5">
          {(['gateway', 'distribution-switch', 'firewall', 'nas', 'server', 'ap', 'endpoint'] as const).map((role) => (
            <div key={role} className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: roleToColor(role) }} />
              <span className="text-xs text-slate-400">{roleToLabel(role)}</span>
            </div>
          ))}
        </div>
        <p className="mb-2 mt-3 text-xs font-semibold text-slate-300">Cable Types</p>
        <div className="space-y-1.5">
          {(['ethernet', 'fiber', 'power', 'usb'] as const).map((type) => (
            <div key={type} className="flex items-center gap-2">
              <svg width="20" height="4" className="overflow-visible">
                <line
                  x1="0"
                  y1="2"
                  x2="20"
                  y2="2"
                  stroke={cableTypeToColor(type)}
                  strokeWidth="2"
                  strokeDasharray={cableTypeToStroke(type) === 'dashed' ? '4 2' : cableTypeToStroke(type) === 'dotted' ? '1 2' : undefined}
                />
              </svg>
              <span className="text-xs capitalize text-slate-400">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
          </marker>
        </defs>
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {edges.map((edge) => {
            const source = nodes.find((n) => n.id === edge.sourceId);
            const target = nodes.find((n) => n.id === edge.targetId);
            if (!source || !target) return null;
            const vlan = extractVlanFromNotes(edge.notes);
            const isSelected = selectedDeviceId === edge.sourceId || selectedDeviceId === edge.targetId;
            const hasSpeedMismatch = speedMismatchIds.has(edge.id);
            const hasMediaMismatch = mediaMismatchIds.has(edge.id);
            const edgeLabel = edge.fromSpeed && edge.toSpeed
              ? `${edge.fromSpeed}↔${edge.toSpeed}`
              : edge.fromSpeed || edge.toSpeed || undefined;
            return (
              <g key={edge.id}>
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={hasSpeedMismatch ? '#f43f5e' : hasMediaMismatch ? '#f97316' : isSelected ? '#e2e8f0' : cableTypeToColor(edge.cableType)}
                  strokeWidth={isSelected ? 3 : 2}
                  strokeDasharray={cableTypeToStroke(edge.cableType) === 'dashed' ? '6 3' : cableTypeToStroke(edge.cableType) === 'dotted' ? '2 3' : undefined}
                  opacity={isSelected ? 1 : 0.7}
                />
                {vlan !== null && (
                  <g transform={`translate(${(source.x + target.x) / 2}, ${(source.y + target.y) / 2} - 14)`}>
                    <rect x="-14" y="-9" width="28" height="18" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                    <text y="1" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="ui-monospace, monospace">
                      V{vlan}
                    </text>
                  </g>
                )}
                {edgeLabel && (
                  <g transform={`translate(${(source.x + target.x) / 2}, ${(source.y + target.y) / 2})`}>
                    <rect x="-18" y="-8" width="36" height="16" rx="3" fill="#0f172a" stroke={hasSpeedMismatch ? '#f43f5e' : '#334155'} strokeWidth="1" />
                    <text y="1" textAnchor="middle" fill={hasSpeedMismatch ? '#f43f5e' : '#94a3b8'} fontSize="9" fontFamily="ui-monospace, monospace">
                      {edgeLabel}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isSelected = selectedDeviceId === node.id;
            const isSingleUplink = singleUplinkIds.includes(node.id);
            const color = roleToColor(node.role);
            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNodeClick(node);
                }}
              >
                {/* Glow for selected */}
                {isSelected && (
                  <circle r={NODE_RADIUS + 6} fill="none" stroke="#e2e8f0" strokeWidth="2" opacity="0.6">
                    <animate attributeName="r" values={`${NODE_RADIUS + 4};${NODE_RADIUS + 8};${NODE_RADIUS + 4}`} dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* Warning ring for single uplink */}
                {isSingleUplink && (
                  <circle r={NODE_RADIUS + 3} fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 2" />
                )}
                {/* Node body */}
                <circle r={NODE_RADIUS} fill={color} stroke="#0f172a" strokeWidth={isSelected ? 3 : 2} opacity={0.9} />
                {/* Label */}
                <text y={NODE_RADIUS + 16} textAnchor="middle" fill="#cbd5e1" fontSize="11" fontWeight="500" fontFamily="system-ui, sans-serif">
                  {node.name}
                </text>
                <text y={NODE_RADIUS + 30} textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="system-ui, sans-serif">
                  {roleToLabel(node.role)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
