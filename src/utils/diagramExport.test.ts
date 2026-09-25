import { describe, expect, it } from 'vitest';
import { sampleLayouts } from '../data/sampleLayouts';
import { buildDiagramScene, diagramExportAdapters, exportDiagram } from './diagramExport';

const layout = sampleLayouts[0];

describe('diagram export adapters', () => {
  it('builds one canonical scene for rack devices and valid cable edges', () => {
    const scene = buildDiagramScene(layout);
    expect(scene.nodes[0]).toMatchObject({ kind: 'rack' });
    expect(scene.nodes.filter((node) => node.kind === 'device')).toHaveLength(layout.devices.length);
    expect(scene.edges.length).toBeGreaterThan(0);
    expect(scene.edges.every((edge) => scene.nodes.some((node) => node.id === edge.from))).toBe(true);
  });

  it('keeps 0U devices and their connected routes in every export scene', () => {
    const zeroULayout = sampleLayouts.find((sample) => sample.devices.some((device) => device.sizeU === 0));
    expect(zeroULayout).toBeDefined();
    if (!zeroULayout) return;
    const zeroU = zeroULayout.devices.find((device) => device.sizeU === 0);
    expect(zeroU).toBeDefined();
    if (!zeroU) return;
    const scene = buildDiagramScene(zeroULayout);
    expect(scene.nodes.some((node) => node.id === zeroU.id)).toBe(true);
    expect(scene.edges.filter((edge) => edge.from === zeroU.id || edge.to === zeroU.id)).toHaveLength(
      zeroULayout.cables.filter((cable) => cable.fromDeviceId === zeroU.id || cable.toDeviceId === zeroU.id).length,
    );
  });

  it.each(['drawio', 'excalidraw', 'svg'] as const)('exports %s through the registered adapter', (format) => {
    const result = exportDiagram(layout, format);
    expect(result.filename).toMatch(new RegExp(`\\.${diagramExportAdapters[format].extension}$`));
    expect(result.mimeType).toBe(diagramExportAdapters[format].mimeType);
    expect(result.content.length).toBeGreaterThan(100);
  });

  it('escapes user-controlled XML labels', () => {
    const result = exportDiagram({ ...layout, name: 'Rack <A&B>' }, 'drawio');
    expect(result.content).toContain('Rack &lt;A&amp;B&gt;');
    expect(result.content).not.toContain('Rack <A&B>');
  });

  it('keeps labels and real node-to-node geometry in Excalidraw', () => {
    const scene = buildDiagramScene(layout);
    const document = JSON.parse(exportDiagram(layout, 'excalidraw').content) as {
      elements: Array<Record<string, unknown>>;
    };
    const texts = document.elements.filter((element) => element.type === 'text');
    const arrows = document.elements.filter((element) => element.type === 'arrow');

    expect(texts.map((element) => element.text)).toEqual(
      expect.arrayContaining([...scene.nodes.map((node) => node.label), ...scene.edges.map((edge) => edge.label)]),
    );
    expect(arrows).toHaveLength(scene.edges.length);
    expect(arrows.every((arrow) => {
      const points = arrow.points as number[][];
      return points.length === 2 && (points[1][0] !== points[0][0] || points[1][1] !== points[0][1]);
    })).toBe(true);
  });
});
