import { getDeviceWidthMm, U_HEIGHT_MM } from './rackMath';
import { buildPreviewRoute } from './rackSceneModel';
import type { CableRoute, PlacedDevice, PortRef, RackLayout, Workspace } from '../types/rack';
import { resolvePortFace, getPortMetadata, buildPortLayout } from './portLayout';
import { getPortConnectionSpec, checkConnectorCompatibility } from './connectorCompatibility';
import { installationRoleError } from './cableInstallation';
import { isInterRackPortUsed } from './interRackCables';
import { isPortReserved } from './portReservations';
import { calculateCablePlan } from './routing';

export type ChainSocket = { deviceId: string; port: PortRef };
export type ChainRequest = { from: ChainSocket; to: ChainSocket; panels: 0 | 1 | 2; panelIds?: string[] };
export type ChainStep = { kind: 'internal'; from: ChainSocket; to: ChainSocket } | {
  kind: 'new' | 'reuse'; from: ChainSocket; to: ChainSocket; cable: CableRoute; unknowns: string[]; estimatedMm: number | null;
};
export type ChainPlan = { rackId: string; fingerprint: string; request: ChainRequest; key: string; steps: ChainStep[]; newCount: number; reusedCount: number; unknownCount: number; estimatedMm: number; };
export type ChainSearch = { candidates: ChainPlan[]; message: string; bounded: boolean };
const NETWORK = new Set(['ethernet', 'patch', 'structured']);
const MAX_ATTEMPTS = 16000;
const socket = (device: PlacedDevice, index: number, side?: 'front' | 'rear'): ChainSocket => ({ deviceId: device.id, port: { type: 'ethernet', index, side: resolvePortFace(device, { type: 'ethernet', index, side }) } });
export const chainSocketKey = (layout: RackLayout, s: ChainSocket): string => {
  const d = layout.devices.find(d => d.id === s.deviceId);
  return `${layout.id}/${s.deviceId}/${s.port.type}/${d ? resolvePortFace(d, s.port) : s.port.side}/${String(s.port.index).padStart(4, '0')}`;
};
export const chainFingerprint = (layout: RackLayout, workspace: Workspace): string => JSON.stringify({ ...layout, updatedAt: undefined, interRack: workspace.interRackCables });
const validSocket = (layout: RackLayout, s: ChainSocket): boolean => {
  const d = layout.devices.find(d => d.id === s.deviceId);
  if (s.port.side !== undefined && s.port.side !== 'front' && s.port.side !== 'rear') return false;
  if (d && d.category !== 'patch-panel' && !buildPortLayout(d, getDeviceWidthMm(d), d.sizeU * U_HEIGHT_MM, resolvePortFace(d, s.port)).some(g => g.slots.some(p => p.type === s.port.type && p.index === s.port.index))) return false;
  return Boolean(d && s.port.type === 'ethernet' && Number.isInteger(s.port.index) && s.port.index >= 0 && s.port.index < (d.ports?.ethernet ?? 0) && (s.port.side === undefined || s.port.side === resolvePortFace(d, s.port)) && !isPortReserved(layout.portReservations ?? [], s.deviceId, 'ethernet', s.port.index));
};
const claimMatches = (layout: RackLayout, id: string, p: PortRef | undefined, s: ChainSocket): boolean => {
  if (id !== s.deviceId || !p || p.type !== 'ethernet' || p.index !== s.port.index) return false;
  const d = layout.devices.find(d => d.id === id)!;
  return d.category !== 'patch-panel' || !p.side || resolvePortFace(d, p) === s.port.side;
};
const claims = (layout: RackLayout, s: ChainSocket) => layout.cables.filter(c => claimMatches(layout, c.fromDeviceId, c.fromPort, s) || claimMatches(layout, c.toDeviceId, c.toPort, s));
const joins = (layout: RackLayout, c: CableRoute, a: ChainSocket, b: ChainSocket): boolean =>
  (claimMatches(layout, c.fromDeviceId, c.fromPort, a) && claimMatches(layout, c.toDeviceId, c.toPort, b)) || (claimMatches(layout, c.fromDeviceId, c.fromPort, b) && claimMatches(layout, c.toDeviceId, c.toPort, a));

const segment = (layout: RackLayout, workspace: Workspace, a: ChainSocket, b: ChainSocket): Exclude<ChainStep, { kind: 'internal' }> | null => {
  if (a.deviceId === b.deviceId || !validSocket(layout, a) || !validSocket(layout, b) || isInterRackPortUsed(workspace, layout.id, a.deviceId, a.port) || isInterRackPortUsed(workspace, layout.id, b.deviceId, b.port)) return null;
  const ac = claims(layout, a), bc = claims(layout, b);
  if (ac.length > 1 || bc.length > 1) return null;
  const fixed = ac.find(c => joins(layout, c, a, b));
  if (!fixed && (ac.length || bc.length)) return null;
  const ad = layout.devices.find(d => d.id === a.deviceId)!, bd = layout.devices.find(d => d.id === b.deviceId)!;
  const panelEnds = [[ad, a], [bd, b]] as const;
  const panels = panelEnds.filter(([d]) => d.category === 'patch-panel');
  const rear = panels.some(([, s]) => s.port.side === 'rear');
  const c: CableRoute = fixed ?? { id: `planned:${chainSocketKey(layout, a)}>${chainSocketKey(layout, b)}`, fromDeviceId: a.deviceId, fromPort: a.port, toDeviceId: b.deviceId, toPort: b.port,
    type: rear ? 'structured' : panels.length ? 'patch' : 'ethernet', installationRole: rear ? 'permanent-link' : 'patch-cord', color: '#38bdf8', lifecycleStatus: 'planned' };
  if (fixed && [[c.fromDeviceId, c.fromPort], [c.toDeviceId, c.toPort]].some(([id, port]) => layout.devices.find(d => d.id === id)?.category === 'patch-panel' && !(port as PortRef | undefined)?.side)) return null;
  if (!NETWORK.has(c.type) || installationRoleError(layout, c)) return null;
  // Preserve the existing inferred role restrictions; explicit patch cords permit endpoint front access.
  if (c.installationRole === undefined && panels.some(([, s]) => s.port.side === 'front') && panelEnds.some(([d]) => d.category !== 'switch' && d.category !== 'patch-panel')) return null;
  if (rear && panelEnds.some(([d]) => d.category === 'switch')) return null;
  if (panels.some(([, s]) => (c.type === 'structured' && s.port.side !== 'rear') || (c.type === 'patch' && s.port.side !== 'front'))) return null;
  const unknowns: string[] = [];
  for (const [d, s] of panelEnds) {
    const media = getPortMetadata(d, s.port.side!, 'ethernet', s.port.index)?.mediaType;
    const spec = getPortConnectionSpec(d, s.port);
    if (media && media !== 'rj45') return null;
    if (spec?.connector && spec.connector.trim().toLowerCase() !== 'rj45') return null;
    if (!media) unknowns.push(`${d.name}: Ethernet media unspecified.`);
  }
  const compatibility = checkConnectorCompatibility(layout, c);
  if (compatibility.status === 'conflict') return null;
  unknowns.push(...compatibility.unknowns);
  const estimate = calculateCablePlan(c, layout)?.estimatedLengthMm ?? null;
  return { kind: fixed ? 'reuse' : 'new', from: a, to: b, cable: c, unknowns, estimatedMm: estimate };
};

/** Finite topology search: no active-device transit, at most two distinct passive panels.
 * Each panel traverses only the same front/rear jack. Physical links may use different indices. */
export const planPatchChain = (layout: RackLayout, workspace: Workspace, request: ChainRequest): ChainSearch => {
  if (!validSocket(layout, request.from) || !validSocket(layout, request.to) || request.from.deviceId === request.to.deviceId || ![0, 1, 2].includes(request.panels)) return { candidates: [], message: 'Choose two different devices with valid, unreserved Ethernet sockets.', bounded: false };
  const endpoint = (s: ChainSocket) => socket(layout.devices.find(d => d.id === s.deviceId)!, s.port.index, s.port.side);
  const from = endpoint(request.from), to = endpoint(request.to);
  const panels = layout.devices.filter(d => d.category === 'patch-panel' && d.id !== from.deviceId && d.id !== to.deviceId && (!request.panelIds?.length || request.panelIds.includes(d.id))).sort((a, b) => a.id.localeCompare(b.id));
  const variants = panels.flatMap(d => Array.from({ length: Math.min(d.ports?.ethernet ?? 0, 128) }, (_, index) => ['front', 'rear'].map(side => ({ entry: socket(d, index, side as 'front' | 'rear'), exit: socket(d, index, side === 'front' ? 'rear' : 'front') }))).flat()).sort((a, b) => {
    const reuse = (v: { entry: ChainSocket; exit: ChainSocket }) => claims(layout, v.entry).length + claims(layout, v.exit).length;
    return reuse(b) - reuse(a) || chainSocketKey(layout, a.entry).localeCompare(chainSocketKey(layout, b.entry));
  });
  let attempts = 0;
  const candidates: ChainPlan[] = [];
  const edgeCache = new Map<string, ReturnType<typeof segment>>();
  const edge = (a: ChainSocket, b: ChainSocket) => {
    const key = `${chainSocketKey(layout, a)}>${chainSocketKey(layout, b)}`;
    if (!edgeCache.has(key)) edgeCache.set(key, segment(layout, workspace, a, b));
    return edgeCache.get(key)!;
  };
  const fingerprint = chainFingerprint(layout, workspace);
  const add = (hops: typeof variants) => {
    if (++attempts > MAX_ATTEMPTS) return;
    const steps: ChainStep[] = [];
    let start = from;
    for (const hop of hops) {
      const link = edge(start, hop.entry);
      if (!link || !validSocket(layout, hop.exit)) return;
      steps.push(link, { kind: 'internal', from: hop.entry, to: hop.exit });
      start = hop.exit;
    }
    const final = edge(start, to);
    if (!final) return;
    steps.push(final);
    const physical = steps.filter((s): s is Exclude<ChainStep, { kind: 'internal' }> => s.kind !== 'internal');
    const key = steps.map(s => `${s.kind === 'internal' ? 'hop' : 'edge'}:${chainSocketKey(layout, s.from)}>${chainSocketKey(layout, s.to)}`).join('|');
    candidates.push({ rackId: layout.id, fingerprint, request, key, steps, newCount: physical.filter(s => s.kind === 'new').length, reusedCount: physical.filter(s => s.kind === 'reuse').length, unknownCount: physical.reduce((n, s) => n + s.unknowns.length, 0), estimatedMm: physical.reduce((n, s) => n + (s.estimatedMm ?? 1e9), 0) });
  };
  if (request.panels === 0) add([]);
  else for (const a of variants) {
    if (attempts >= MAX_ATTEMPTS) break;
    if (request.panels === 1) add([a]);
    else for (const b of variants) {
      if (attempts >= MAX_ATTEMPTS) break;
      if (a.entry.deviceId !== b.entry.deviceId) add([a, b]);
    }
  }
  const compare = (a: ChainPlan, b: ChainPlan) => a.newCount === 0 || b.newCount === 0 ? a.newCount - b.newCount || a.key.localeCompare(b.key) : b.reusedCount - a.reusedCount || a.newCount - b.newCount || a.unknownCount - b.unknownCount || a.estimatedMm - b.estimatedMm || a.key.localeCompare(b.key);
  candidates.sort(compare);
  // Geometry planning is substantially more expensive than socket graph search.
  // Refine a bounded shortlist through the shared Clean/Realistic engine.
  const geometry = new Map<string, { estimatedMm: number | null; warning?: string }>();
  const refined = candidates.slice(0, 24).map(plan => {
    const steps = plan.steps.map(step => {
      if (step.kind === 'internal') return step;
      const key = step.cable.id;
      if (!geometry.has(key)) {
        const clean = buildPreviewRoute(step.cable, layout, 0, 'clean');
        const realistic = buildPreviewRoute(step.cable, layout, 0, 'realistic');
        const estimatedMm = clean?.renderedLengthMm != null && realistic?.renderedLengthMm != null
          ? Math.ceil(Math.max(clean.renderedLengthMm, realistic.renderedLengthMm) + (calculateCablePlan(step.cable, layout)?.slackMm ?? 0)) : null;
        geometry.set(key, { estimatedMm, ...(estimatedMm === null ? { warning: 'No feasible rendered route estimate; review spacing/cable management before purchasing.' } : {}) });
      }
      const result = geometry.get(key)!;
      return { ...step, estimatedMm: result.estimatedMm, unknowns: [...step.unknowns, ...(result.warning ? [result.warning] : [])] };
    });
    const physical = steps.filter((s): s is Exclude<ChainStep, { kind: 'internal' }> => s.kind !== 'internal');
    return { ...plan, steps, unknownCount: physical.reduce((n, s) => n + s.unknowns.length, 0), estimatedMm: physical.reduce((n, s) => n + (s.estimatedMm ?? 1e9), 0) };
  }).sort(compare);
  const bounded = attempts >= MAX_ATTEMPTS || panels.some(d => (d.ports?.ethernet ?? 0) > 128);
  return { candidates: refined.slice(0, 6), bounded, message: candidates.length ? `${candidates.length} compatible paths${bounded ? ' within search limit' : ''}. Physical connections only; network/VLAN operation is unverified.` : 'No compatible path. Check occupied/reserved sockets, media and panel front/rear roles. Existing cables are never rewired.' };
};

export const validateChainApply = (layout: RackLayout, workspace: Workspace, plan: ChainPlan): { status: 'ready' | 'connected' | 'invalid'; message: string } => {
  if (layout.id !== plan.rackId) return { status: 'invalid', message: 'Preview belongs to another rack. Preview again.' };
  const topologyKey = plan.steps.map(s => `${s.kind === 'internal' ? 'hop' : 'edge'}:${chainSocketKey(layout, s.from)}>${chainSocketKey(layout, s.to)}`).join('|');
  if (topologyKey !== plan.key) return { status: 'invalid', message: 'Preview is invalid. Preview again; no cables added.' };
  const steps = plan.steps.filter((s): s is Exclude<ChainStep, { kind: 'internal' }> => s.kind !== 'internal');
  const fresh = planPatchChain(layout, workspace, plan.request).candidates.find(p => p.key === plan.key);
  const current = steps.map(s => segment(layout, workspace, s.from, s.to));
  if (fresh && current.every((s, i) => s?.kind === 'reuse' && (steps[i].kind !== 'reuse' || steps[i].cable.id === s.cable.id))) {
    const addedIds = new Set(current.flatMap((s, i) => steps[i].kind === 'new' && s ? [s.cable.id] : []));
    const beforeApply = { ...layout, cables: layout.cables.filter(c => !addedIds.has(c.id)) };
    // Repetition is allowed only when the current state differs by these additions.
    // Any subsequent device/spec/route edit still requires a fresh preview.
    if (plan.fingerprint === chainFingerprint(beforeApply, workspace)) return { status: 'connected', message: 'A–B is already physically connected. No cables added.' };
  }
  if (plan.fingerprint !== chainFingerprint(layout, workspace)) return { status: 'invalid', message: 'Layout changed since preview. Preview again; no cables added.' };
  if (!fresh || JSON.stringify(fresh.steps) !== JSON.stringify(plan.steps)) return { status: 'invalid', message: 'Preview is invalid. Preview again; no cables added.' };
  return { status: 'ready', message: 'Ready' };
};
