import type { CableRoute, DeviceCategory, PlacedDevice, RackLayout } from '../types/rack';
import { getPortMetadata } from './portLayout';

export type TopologyNodeRole =
  | 'gateway'
  | 'core-switch'
  | 'distribution-switch'
  | 'access-switch'
  | 'firewall'
  | 'nas'
  | 'server'
  | 'ap'
  | 'poe-injector'
  | 'ups'
  | 'pdu'
  | 'patch-panel'
  | 'endpoint'
  | 'unknown';

export interface TopologyNode {
  id: string;
  name: string;
  category: DeviceCategory;
  role: TopologyNodeRole;
  x: number;
  y: number;
  powerW: number;
  depthMm: number;
}

export interface TopologyEdge {
  id: string;
  sourceId: string;
  targetId: string;
  cableType: string;
  color: string;
  notes?: string;
  fromPort?: import('../types/rack').PortRef;
  toPort?: import('../types/rack').PortRef;
  fromSpeed?: import('../types/rack').PortSpeed;
  toSpeed?: import('../types/rack').PortSpeed;
  fromMedia?: import('../types/rack').MediaType;
  toMedia?: import('../types/rack').MediaType;
}

export interface TopologyGraph {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

const ROLE_MAP: Record<DeviceCategory, TopologyNodeRole> = {
  router: 'gateway',
  switch: 'distribution-switch',
  firewall: 'firewall',
  nas: 'nas',
  server: 'server',
  'access-point': 'ap',
  'poe-injector': 'poe-injector',
  ups: 'ups',
  pdu: 'pdu',
  'pdu-0u': 'pdu',
  'patch-panel': 'patch-panel',
  'mini-pc': 'endpoint',
  'ip-kvm': 'endpoint',
  sbc: 'endpoint',
  modem: 'gateway',
  shelf: 'unknown',
  'cable-management': 'unknown',
  blank: 'unknown',
  custom: 'unknown',
  'printed-mount': 'unknown',
};

export function categoryToRole(category: DeviceCategory): TopologyNodeRole {
  return ROLE_MAP[category] ?? 'unknown';
}

export function buildTopologyGraph(layout: RackLayout): TopologyGraph {
  const devices = layout.devices.filter(device => Object.entries(device.ports ?? {}).some(
    ([type, count]) => type !== 'layoutColumns' && Number.isFinite(count) && count > 0
  ));
  const nodes: TopologyNode[] = devices.map((d) => ({
    id: d.id,
    name: d.name || d.category,
    category: d.category,
    role: categoryToRole(d.category),
    x: 0,
    y: 0,
    powerW: d.powerW ?? 0,
    depthMm: d.depthMm ?? 0,
  }));

  const deviceMap = new Map(devices.map((d) => [d.id, d]));
  const edges: TopologyEdge[] = layout.cables.filter(c => deviceMap.has(c.fromDeviceId) && deviceMap.has(c.toDeviceId)).map((c) => {
    const from = deviceMap.get(c.fromDeviceId);
    const to = deviceMap.get(c.toDeviceId);
    const fromFace = c.fromPort?.side ?? 'rear' as const;
    const toFace = c.toPort?.side ?? 'rear' as const;
    const fromMeta = from && c.fromPort ? getPortMetadata(from, fromFace, c.fromPort.type, c.fromPort.index) : undefined;
    const toMeta = to && c.toPort ? getPortMetadata(to, toFace, c.toPort.type, c.toPort.index) : undefined;
    return {
      id: c.id,
      sourceId: c.fromDeviceId,
      targetId: c.toDeviceId,
      cableType: c.type,
      color: c.color || cableTypeToColor(c.type),
      notes: c.notes,
      fromPort: c.fromPort,
      toPort: c.toPort,
      fromSpeed: fromMeta?.speed ?? c.speed,
      toSpeed: toMeta?.speed ?? c.speed,
      fromMedia: fromMeta?.mediaType ?? c.mediaType,
      toMedia: toMeta?.mediaType ?? c.mediaType,
    };
  });

  return { nodes, edges };
}

export function cableTypeToColor(type: string): string {
  switch (type) {
    case 'ethernet':
      return '#3b82f6';
    case 'fiber':
      return '#a855f7';
    case 'power':
      return '#ef4444';
    case 'usb':
      return '#f59e0b';
    case 'hdmi':
      return '#10b981';
    case 'atx':
      return '#6366f1';
    case 'coax':
      return '#8b5cf6';
    default:
      return '#94a3b8';
  }
}

export function cableTypeToStroke(type: string): string {
  switch (type) {
    case 'ethernet':
      return 'solid';
    case 'fiber':
      return 'dashed';
    case 'power':
      return 'dotted';
    default:
      return 'solid';
  }
}

export function roleToColor(role: TopologyNodeRole): string {
  switch (role) {
    case 'gateway':
      return '#f97316';
    case 'core-switch':
    case 'distribution-switch':
    case 'access-switch':
      return '#3b82f6';
    case 'firewall':
      return '#ef4444';
    case 'nas':
      return '#10b981';
    case 'server':
      return '#8b5cf6';
    case 'ap':
      return '#06b6d4';
    case 'endpoint':
      return '#64748b';
    default:
      return '#94a3b8';
  }
}

export function roleToLabel(role: TopologyNodeRole): string {
  switch (role) {
    case 'gateway':
      return 'Gateway';
    case 'core-switch':
      return 'Core';
    case 'distribution-switch':
      return 'Distro';
    case 'access-switch':
      return 'Access';
    case 'firewall':
      return 'Firewall';
    case 'nas':
      return 'NAS';
    case 'server':
      return 'Server';
    case 'ap':
      return 'AP';
    case 'endpoint':
      return 'Endpoint';
    default:
      return role;
  }
}

/**
 * Simple force-directed layout.
 * Runs a few iterations and returns mutated node positions.
 */
export function layoutTopologyGraph(
  graph: TopologyGraph,
  width: number,
  height: number,
  iterations = 120
): TopologyGraph {
  // Stable seeds and force accumulation keep rebuilds independent of input order.
  const nodes = [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id));
  if (nodes.length === 0) return graph;
  width = Number.isFinite(width) && width > 0 ? width : 800;
  height = Number.isFinite(height) && height > 0 ? height : 600;
  // Leave space for names, the toolbar and the legend.
  const left = Math.min(100, width * 0.2);
  const right = width - Math.min(220, width * 0.25);
  const top = Math.min(80, height * 0.2);
  const bottom = height - Math.min(70, height * 0.2);
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  nodes.forEach((node, index) => {
    const angle = index * Math.PI * (3 - Math.sqrt(5));
    const radius = Math.sqrt(index / nodes.length) * 0.45;
    node.x = cx + Math.cos(angle) * radius * (right - left);
    node.y = cy + Math.sin(angle) * radius * (bottom - top);
  });
  const indices = new Map(nodes.map((node, index) => [node.id, index]));
  // Parallel cables must not pull a device pair closer than a single cable.
  const links = new Map<string, [number, number]>();
  for (const edge of graph.edges) {
    const a = indices.get(edge.sourceId);
    const b = indices.get(edge.targetId);
    if (a === undefined || b === undefined || a === b) continue;
    const pair: [number, number] = [Math.min(a, b), Math.max(a, b)];
    links.set(`${pair[0]}:${pair[1]}`, pair);
  }
  const pairs = [...links.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const k = Math.sqrt(((right - left) * (bottom - top)) / (nodes.length + 1));
  const temperature = Math.min(width, height) / 10;

  for (let i = 0; i < iterations; i++) {
    const displacement = nodes.map(n => ({ x: (cx - n.x) * 0.1, y: (cy - n.y) * 0.1 }));
    // Repulsion
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const na = nodes[a];
        const nb = nodes[b];
        const dx = na.x - nb.x || 0.01;
        const dy = na.y - nb.y;
        const dist = Math.hypot(dx, dy);
        const force = (k * k) / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        displacement[a].x += fx;
        displacement[a].y += fy;
        displacement[b].x -= fx;
        displacement[b].y -= fy;
      }
    }

    // Attraction along edges
    for (const [a, b] of pairs) {
      const dx = nodes[b].x - nodes[a].x;
      const dy = nodes[b].y - nodes[a].y;
      const dist = Math.hypot(dx, dy) || 1;
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      displacement[a].x += fx;
      displacement[a].y += fy;
      displacement[b].x -= fx;
      displacement[b].y -= fy;
    }

    // Cool the movement per iteration, never the distance from the centre.
    const t = temperature * (1 - i / iterations);
    nodes.forEach((node, index) => {
      const { x, y } = displacement[index];
      const scale = Math.min(1, t / (Math.hypot(x, y) || 1));
      node.x = Math.max(left, Math.min(right, node.x + x * scale));
      node.y = Math.max(top, Math.min(bottom, node.y + y * scale));
    });
  }

  // Separate node-and-label footprints after the forces settle, including
  // disconnected devices which may otherwise collect along the canvas edges.
  for (let pass = 0; pass < 80; pass++) {
    let overlaps = false;
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const na = nodes[a];
        const nb = nodes[b];
        const overlapX = 180 - Math.abs(na.x - nb.x);
        const overlapY = 92 - Math.abs(na.y - nb.y);
        if (overlapX <= 0 || overlapY <= 0) continue;
        overlaps = true;
        const axis = overlapX < overlapY ? 'x' : 'y';
        const gap = (axis === 'x' ? overlapX : overlapY) + 0.1;
        const min = axis === 'x' ? left : top;
        const max = axis === 'x' ? right : bottom;
        const direction = na[axis] < nb[axis] ? -1 : 1;
        const before = na[axis];
        na[axis] = Math.max(min, Math.min(max, before + direction * gap / 2));
        const moved = Math.abs(na[axis] - before);
        const otherBefore = nb[axis];
        nb[axis] = Math.max(min, Math.min(max, otherBefore - direction * (gap - moved)));
        const remaining = gap - moved - Math.abs(nb[axis] - otherBefore);
        na[axis] = Math.max(min, Math.min(max, na[axis] + direction * remaining));
      }
    }
    if (!overlaps) break;
  }
  // If boundary constraints trap several labels together, assign the nearest
  // free grid slots. Keep the force layout where there is already enough room.
  const crowded = nodes.some((node, index) => nodes.slice(index + 1).some(other =>
    Math.abs(node.x - other.x) < 179 && Math.abs(node.y - other.y) < 91));
  if (crowded) {
    const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length * (right - left) / (bottom - top) * 92 / 180)));
    const rows = Math.ceil(nodes.length / columns);
    const slots = Array.from({ length: columns * rows }, (_, index) => ({
      x: columns === 1 ? cx : left + (index % columns) * (right - left) / (columns - 1),
      y: rows === 1 ? cy : top + Math.floor(index / columns) * (bottom - top) / (rows - 1),
    }));
    for (const node of nodes) {
      let nearest = 0;
      for (let i = 1; i < slots.length; i++) {
        if (Math.hypot(slots[i].x - node.x, slots[i].y - node.y) < Math.hypot(slots[nearest].x - node.x, slots[nearest].y - node.y)) nearest = i;
      }
      const [slot] = slots.splice(nearest, 1);
      node.x = slot.x;
      node.y = slot.y;
    }
  }
  return graph;
}

export function findSingleUplinkSwitches(graph: TopologyGraph): string[] {
  const uplinkCounts = new Map<string, number>();
  for (const edge of graph.edges) {
    if (edge.cableType === 'ethernet' || edge.cableType === 'fiber') {
      const source = graph.nodes.find((n) => n.id === edge.sourceId);
      const target = graph.nodes.find((n) => n.id === edge.targetId);
      if (source?.role === 'distribution-switch' || source?.role === 'access-switch') {
        uplinkCounts.set(source.id, (uplinkCounts.get(source.id) || 0) + 1);
      }
      if (target?.role === 'distribution-switch' || target?.role === 'access-switch') {
        uplinkCounts.set(target.id, (uplinkCounts.get(target.id) || 0) + 1);
      }
    }
  }
  return Array.from(uplinkCounts.entries())
    .filter(([, count]) => count <= 1)
    .map(([id]) => id);
}

export function extractVlanFromNotes(notes?: string): number | null {
  if (!notes) return null;
  const match = notes.match(/VLAN\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

export function findSpeedMismatches(graph: TopologyGraph): TopologyEdge[] {
  return graph.edges.filter((edge) => {
    if (!edge.fromSpeed || !edge.toSpeed) return false;
    return edge.fromSpeed !== edge.toSpeed;
  });
}

export function findMediaMismatches(graph: TopologyGraph): TopologyEdge[] {
  return graph.edges.filter((edge) => {
    if (!edge.fromMedia || !edge.toMedia) return false;
    if (edge.fromMedia === edge.toMedia) return false;
    const sfpFamily = ['sfp', 'sfp+', 'qsfp+', 'dac', 'fiber'];
    const fromIsSfp = sfpFamily.includes(edge.fromMedia);
    const toIsSfp = sfpFamily.includes(edge.toMedia);
    // SFP family members are compatible with each other via transceivers
    if (fromIsSfp && toIsSfp) return false;
    // RJ45 is only compatible with itself
    return true;
  });
}
