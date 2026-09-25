import type { CableRoute, PlacedDevice, RackLayout } from '../types/rack';
import { getDeviceWidthMm, getZeroUEarSide, RACK_SPECS } from './rackMath';

export type DiagramFormat = 'drawio' | 'excalidraw' | 'svg';

export type DiagramNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  kind: 'rack' | 'device';
};

export type DiagramEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  color: string;
};

export type DiagramScene = {
  title: string;
  width: number;
  height: number;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
};

export type DiagramExportResult = {
  filename: string;
  mimeType: string;
  content: string;
};

export type DiagramExportAdapter = {
  id: DiagramFormat;
  label: string;
  extension: string;
  mimeType: string;
  serialize: (scene: DiagramScene) => string;
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'rack-layout';

const deviceNode = (
  layout: RackLayout,
  device: PlacedDevice,
  rackX: number,
  rackY: number,
  rackWidth: number,
  unitHeight: number,
): DiagramNode => {
  const usableWidth = RACK_SPECS[layout.rackType].usableWidthMm;
  const deviceWidthMm = getDeviceWidthMm(device);
  const width = Math.max(36, Math.min(rackWidth, (deviceWidthMm / usableWidth) * rackWidth));
  const xOffset = ((device.xMm ?? 0) / usableWidth) * rackWidth;
  return {
    id: device.id,
    label: device.label || device.name,
    x: rackX + Math.max(0, Math.min(rackWidth - width, xOffset)),
    y: rackY + (layout.heightU - device.positionU - device.sizeU + 1) * unitHeight,
    width,
    height: Math.max(unitHeight, device.sizeU * unitHeight),
    color: device.color,
    kind: 'device',
  };
};

const cableLabel = (cable: CableRoute) => {
  if (cable.label?.trim()) return cable.label.trim();
  const fromPort = cable.fromPort ? `${cable.fromPort.type}${cable.fromPort.index + 1}` : '?';
  const toPort = cable.toPort ? `${cable.toPort.type}${cable.toPort.index + 1}` : '?';
  return `${cable.type} ${fromPort}–${toPort}`;
};

export function buildDiagramScene(layout: RackLayout): DiagramScene {
  const unitHeight = 34;
  const rackWidth = 520;
  const rackX = 80;
  const rackY = 80;
  const rackHeight = layout.heightU * unitHeight;
  const rackNode: DiagramNode = {
    id: `rack-${layout.id}`,
    label: `${layout.name} · ${layout.heightU}U`,
    x: rackX,
    y: rackY,
    width: rackWidth,
    height: rackHeight,
    color: '#111827',
    kind: 'rack',
  };
  let leftZeroU = 0;
  let rightZeroU = 0;
  const zeroUNodes = layout.devices.filter((device) => device.sizeU === 0).map((device): DiagramNode => {
    const side = getZeroUEarSide(device);
    const index = side === 'left' ? leftZeroU++ : rightZeroU++;
    return {
      id: device.id,
      label: device.label || device.name,
      x: side === 'left' ? rackX - 68 - index * 64 : rackX + rackWidth + 12 + index * 64,
      y: rackY,
      width: 56,
      height: rackHeight,
      color: device.color,
      kind: 'device',
    };
  });
  const nodes = [
    rackNode,
    ...layout.devices
      .filter((device) => device.sizeU > 0)
      .map((device) => deviceNode(layout, device, rackX, rackY, rackWidth, unitHeight)),
    ...zeroUNodes,
  ];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = layout.cables
    .filter((cable) => nodeIds.has(cable.fromDeviceId) && nodeIds.has(cable.toDeviceId))
    .map((cable): DiagramEdge => ({
      id: cable.id,
      from: cable.fromDeviceId,
      to: cable.toDeviceId,
      label: cableLabel(cable),
      color: cable.color,
    }));
  return {
    title: layout.name,
    width: rackWidth + 160,
    height: rackHeight + 160,
    nodes,
    edges,
  };
}

const drawioAdapter: DiagramExportAdapter = {
  id: 'drawio',
  label: 'draw.io',
  extension: 'drawio',
  mimeType: 'application/vnd.jgraph.mxfile',
  serialize: (scene) => {
    const vertices = scene.nodes.map((node) =>
      `<mxCell id="${escapeXml(node.id)}" value="${escapeXml(node.label)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${escapeXml(node.color)};fontColor=#ffffff;" vertex="1" parent="1"><mxGeometry x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" as="geometry"/></mxCell>`,
    );
    const edges = scene.edges.map((edge) =>
      `<mxCell id="${escapeXml(edge.id)}" value="${escapeXml(edge.label)}" style="edgeStyle=orthogonalEdgeStyle;strokeColor=${escapeXml(edge.color)};rounded=1;" edge="1" parent="1" source="${escapeXml(edge.from)}" target="${escapeXml(edge.to)}"><mxGeometry relative="1" as="geometry"/></mxCell>`,
    );
    return `<mxfile host="RackSim"><diagram name="${escapeXml(scene.title)}"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${vertices.join('')}${edges.join('')}</root></mxGraphModel></diagram></mxfile>`;
  },
};

const excalidrawAdapter: DiagramExportAdapter = {
  id: 'excalidraw',
  label: 'Excalidraw',
  extension: 'excalidraw',
  mimeType: 'application/json',
  serialize: (scene) => {
    const nodeById = new Map(scene.nodes.map((node) => [node.id, node]));
    const seed = (id: string) => id.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const nodeElements = scene.nodes.flatMap((node) => {
      const textId = `${node.id}-label`;
      const relatedEdges = scene.edges
        .filter((edge) => edge.from === node.id || edge.to === node.id)
        .map((edge) => ({ id: edge.id, type: 'arrow' }));
      return [{
        id: node.id,
        type: 'rectangle',
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        angle: 0,
        strokeColor: '#94a3b8',
        backgroundColor: node.color,
        fillStyle: 'solid',
        strokeWidth: 1,
        roughness: 0,
        opacity: 100,
        groupIds: [],
        roundness: { type: 3 },
        seed: seed(node.id),
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        boundElements: [{ id: textId, type: 'text' }, ...relatedEdges],
        updated: 1,
        link: null,
        locked: false,
      }, {
        id: textId,
        type: 'text',
        x: node.x + 8,
        y: node.y + Math.max(4, node.height / 2 - 10),
        width: Math.max(20, node.width - 16),
        height: 20,
        angle: 0,
        strokeColor: '#ffffff',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        roughness: 0,
        opacity: 100,
        groupIds: [],
        seed: seed(textId),
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        boundElements: null,
        updated: 1,
        link: null,
        locked: false,
        text: node.label,
        originalText: node.label,
        fontSize: 16,
        fontFamily: 1,
        textAlign: 'center',
        verticalAlign: 'middle',
        containerId: node.id,
        lineHeight: 1.25,
      }];
    });
    const edgeElements = scene.edges.flatMap((edge, index) => {
      const from = nodeById.get(edge.from);
      const to = nodeById.get(edge.to);
      if (!from || !to) return [];
      const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
      const end = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const labelId = `${edge.id}-label`;
      return [{
        id: edge.id,
        type: 'arrow',
        x,
        y,
        width: Math.max(1, Math.abs(end.x - start.x)),
        height: Math.max(1, Math.abs(end.y - start.y)),
        angle: 0,
        strokeColor: edge.color,
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 2,
        roughness: 0,
        opacity: 100,
        groupIds: [],
        roundness: { type: 2 },
        seed: index + 1,
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        boundElements: [{ id: labelId, type: 'text' }],
        updated: 1,
        link: null,
        locked: false,
        points: [[start.x - x, start.y - y], [end.x - x, end.y - y]],
        startBinding: { elementId: edge.from, focus: 0, gap: 1 },
        endBinding: { elementId: edge.to, focus: 0, gap: 1 },
        startArrowhead: null,
        endArrowhead: 'arrow',
      }, {
        id: labelId,
        type: 'text',
        x: (start.x + end.x) / 2 - 60,
        y: (start.y + end.y) / 2 - 10 + index * 2,
        width: 120,
        height: 20,
        angle: 0,
        strokeColor: edge.color,
        backgroundColor: '#ffffff',
        fillStyle: 'solid',
        strokeWidth: 1,
        roughness: 0,
        opacity: 100,
        groupIds: [],
        seed: seed(labelId),
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        boundElements: null,
        updated: 1,
        link: null,
        locked: false,
        text: edge.label,
        originalText: edge.label,
        fontSize: 14,
        fontFamily: 1,
        textAlign: 'center',
        verticalAlign: 'middle',
        containerId: edge.id,
        lineHeight: 1.25,
      }];
    });
    return JSON.stringify({
      type: 'excalidraw',
      version: 2,
      source: 'RackSim',
      elements: [...nodeElements, ...edgeElements],
      appState: { viewBackgroundColor: '#ffffff', gridSize: 20 },
      files: {},
    }, null, 2);
  },
};

const svgAdapter: DiagramExportAdapter = {
  id: 'svg',
  label: 'SVG',
  extension: 'svg',
  mimeType: 'image/svg+xml',
  serialize: (scene) => {
    const nodeById = new Map(scene.nodes.map((node) => [node.id, node]));
    const edges = scene.edges.map((edge) => {
      const from = nodeById.get(edge.from);
      const to = nodeById.get(edge.to);
      if (!from || !to) return '';
      return `<path d="M ${from.x + from.width} ${from.y + from.height / 2} C ${scene.width - 30} ${from.y} ${scene.width - 30} ${to.y} ${to.x + to.width} ${to.y + to.height / 2}" fill="none" stroke="${escapeXml(edge.color)}" stroke-width="3"><title>${escapeXml(edge.label)}</title></path>`;
    });
    const nodes = scene.nodes.map((node) => `<g><rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="6" fill="${escapeXml(node.color)}" stroke="#94a3b8"/><text x="${node.x + 10}" y="${node.y + 20}" fill="#fff" font-family="sans-serif" font-size="12">${escapeXml(node.label)}</text></g>`);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${scene.width} ${scene.height}" role="img" aria-label="${escapeXml(scene.title)}">${edges.join('')}${nodes.join('')}</svg>`;
  },
};

export const diagramExportAdapters: Record<DiagramFormat, DiagramExportAdapter> = {
  drawio: drawioAdapter,
  excalidraw: excalidrawAdapter,
  svg: svgAdapter,
};

export function exportDiagram(layout: RackLayout, format: DiagramFormat): DiagramExportResult {
  const adapter = diagramExportAdapters[format];
  const scene = buildDiagramScene(layout);
  return {
    filename: `${slug(layout.name)}.${adapter.extension}`,
    mimeType: adapter.mimeType,
    content: adapter.serialize(scene),
  };
}
