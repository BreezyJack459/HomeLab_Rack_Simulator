import { describe, expect, it } from 'vitest';
import { sampleLayouts } from '../data/sampleLayouts';
import { buildTopologyGraph, layoutTopologyGraph } from './topologyGraph';

describe('topology device visibility', () => {
  it('shows port-equipped devices even without cables, and excludes shelves and portless accessories', () => {
    const layout = sampleLayouts[1];
    const graph = buildTopologyGraph({ ...layout, cables: [] });
    expect(graph.nodes).toHaveLength(10);
    expect(graph.nodes.some(node => node.category === 'shelf' || node.category === 'cable-management')).toBe(false);
    for (const category of ['patch-panel', 'router', 'switch', 'modem', 'poe-injector', 'mini-pc', 'nas', 'ups', 'pdu']) {
      expect(graph.nodes.some(node => node.category === category)).toBe(true);
    }
  });

  it('ignores missing or empty ports and layout metadata, and removes dangling edges', () => {
    const layout = structuredClone(sampleLayouts[1]);
    layout.devices.forEach((device, index) => {
      device.ports = [undefined, {}, { ethernet: 0 }, { layoutColumns: 8 }][index % 4];
    });
    expect(buildTopologyGraph(layout)).toEqual({ nodes: [], edges: [] });
    layout.devices[0].ports = { ethernet: 24 };
    expect(buildTopologyGraph(layout).nodes).toHaveLength(1);
    expect(buildTopologyGraph(layout).edges).toEqual([]);
  });
});

describe('topology layout', () => {
  for (const layout of sampleLayouts) {
    it(`spreads ${layout.name} across the canvas instead of cooling into the centre`, () => {
      const graph = layoutTopologyGraph(buildTopologyGraph(layout), 1200, 700);
      const xs = graph.nodes.map(n => n.x);
      const ys = graph.nodes.map(n => n.y);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(400);
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(250);
      for (const node of graph.nodes) {
        expect(node.x).toBeGreaterThanOrEqual(100);
        expect(node.x).toBeLessThanOrEqual(980);
        expect(node.y).toBeGreaterThanOrEqual(80);
        expect(node.y).toBeLessThanOrEqual(630);
        for (const other of graph.nodes) {
          if (node.id !== other.id) expect(Math.hypot(node.x - other.x, node.y - other.y)).toBeGreaterThan(55);
        }
      }
    });
  }

  it('keeps labels apart with both sidebars open', () => {
    for (const width of [830, 885, 1200]) {
      const { nodes } = layoutTopologyGraph(buildTopologyGraph(sampleLayouts[1]), width, 670);
      for (const [index, node] of nodes.entries()) {
        for (const other of nodes.slice(index + 1)) {
          expect(Math.abs(node.x - other.x) >= 179 || Math.abs(node.y - other.y) >= 91).toBe(true);
        }
      }
    }
  });

  it('keeps positions stable across rebuilds and input order changes', () => {
    const graph = buildTopologyGraph(sampleLayouts[0]);
    const first = layoutTopologyGraph(structuredClone(graph), 1200, 700);
    graph.nodes.reverse();
    graph.edges.reverse();
    const second = layoutTopologyGraph(graph, 1200, 700);
    for (const node of first.nodes) expect(second.nodes.find(n => n.id === node.id)).toEqual(node);
  });

  it('handles empty, single-node and temporarily unmeasured containers', () => {
    expect(layoutTopologyGraph({ nodes: [], edges: [] }, 0, 0).nodes).toEqual([]);
    for (const [width, height] of [[0, 0], [NaN, Infinity], [320, 400]]) {
      const graph = buildTopologyGraph(sampleLayouts[0]);
      graph.nodes = graph.nodes.slice(0, 1);
      for (const node of layoutTopologyGraph(graph, width, height).nodes) {
        expect(Number.isFinite(node.x)).toBe(true);
        expect(Number.isFinite(node.y)).toBe(true);
      }
    }
  });
});
