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
  const nodes: TopologyNode[] = layout.devices.map((d) => ({
    id: d.id,
    name: d.name || d.category,
    category: d.category,
    role: categoryToRole(d.category),
    x: 0,
    y: 0,
    powerW: d.powerW ?? 0,
    depthMm: d.depthMm ?? 0,
  }));

  const deviceMap = new Map(layout.devices.map((d) => [d.id, d]));
  const edges: TopologyEdge[] = layout.cables.map((c) => {
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
  const { nodes, edges } = graph;
  if (nodes.length === 0) return graph;

  // Initialize random positions near center
  nodes.forEach((n) => {
    n.x = width / 2 + (Math.random() - 0.5) * width * 0.4;
    n.y = height / 2 + (Math.random() - 0.5) * height * 0.4;
  });

  const k = Math.sqrt((width * height) / (nodes.length + 1)) * 0.8;
  const temperature = Math.min(width, height) / 10;

  for (let i = 0; i < iterations; i++) {
    // Repulsion
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const na = nodes[a];
        const nb = nodes[b];
        let dx = na.x - nb.x;
        let dy = na.y - nb.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (k * k) / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        na.x += fx * 0.05;
        na.y += fy * 0.05;
        nb.x -= fx * 0.05;
        nb.y -= fy * 0.05;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const na = nodes.find((n) => n.id === edge.sourceId);
      const nb = nodes.find((n) => n.id === edge.targetId);
      if (!na || !nb) continue;
      let dx = nb.x - na.x;
      let dy = nb.y - na.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force * 0.05;
      const fy = (dy / dist) * force * 0.05;
      na.x += fx;
      na.y += fy;
      nb.x -= fx;
      nb.y -= fy;
    }

    // Gravity to center
    for (const n of nodes) {
      const dx = width / 2 - n.x;
      const dy = height / 2 - n.y;
      n.x += dx * 0.01;
      n.y += dy * 0.01;
    }

    // Cool down
    const t = temperature * (1 - i / iterations);
    for (const n of nodes) {
      const dx = n.x - width / 2;
      const dy = n.y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist > t) {
        n.x = width / 2 + (dx / dist) * t;
        n.y = height / 2 + (dy / dist) * t;
      }
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
