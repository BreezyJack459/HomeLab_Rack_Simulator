import type { CableRoute, RackLayout, Workspace } from '../types/rack';
import { resolvePortFace } from './portLayout';
import { STANDARD_CABLE_LENGTHS_MM } from './routing';
import { chainFingerprint, chainSocketKey, planPatchChain, validateChainApply, type ChainPlan, type ChainSocket } from './patchChain';

export type ABSocket = ChainSocket;
export type ABRequest = { from: ABSocket; to: ABSocket; mode: 'auto' | 'direct' | 'one-panel' | 'two-panels' };
export type ABStep = { kind: 'internal' | 'reuse' | 'new'; from: ABSocket; to: ABSocket; cable?: CableRoute; estimatedMm?: number; stockedMm?: number; unknowns: string[] };
export type ABPlan = { request: ABRequest; fingerprint: string; key: string; steps: ABStep[]; newCount: number; reusedCount: number; unknownCount: number; estimatedMm: number; chain: ChainPlan };
export type ABResult = { plans: ABPlan[]; message: string; limited: boolean };
export const abFingerprint = chainFingerprint;
export const abSocketKey = chainSocketKey;
export const canonicalABSocket = (layout: RackLayout, s: ABSocket): ABSocket => {
  const d = layout.devices.find(d => d.id === s.deviceId);
  return { deviceId: s.deviceId, port: { ...s.port, side: d ? resolvePortFace(d, s.port) : s.port.side } };
};
export const abSocketClaims = (layout: RackLayout, s: ABSocket): CableRoute[] => layout.cables.filter(c => ([[c.fromDeviceId, c.fromPort], [c.toDeviceId, c.toPort]] as const).some(([id, port]) => {
  if (id !== s.deviceId || port?.type !== s.port.type || port.index !== s.port.index) return false;
  const d = layout.devices.find(d => d.id === id)!;
  return d.category !== 'patch-panel' || !port.side || resolvePortFace(d, port) === s.port.side;
}));
export const toABPlan = (chain: ChainPlan, request: ABRequest = { from: chain.request.from, to: chain.request.to, mode: chain.request.panels === 0 ? 'direct' : chain.request.panels === 1 ? 'one-panel' : 'two-panels' }): ABPlan => ({
  ...chain, request, chain, steps: chain.steps.map(s => s.kind === 'internal' ? { ...s, unknowns: [] } : { ...s, estimatedMm: s.estimatedMm ?? undefined, stockedMm: s.estimatedMm === null ? undefined : STANDARD_CABLE_LENGTHS_MM.find(mm => mm >= s.estimatedMm!), unknowns: s.unknowns }),
});
const compare = (a: ABPlan, b: ABPlan) => a.newCount === 0 || b.newCount === 0 ? a.newCount - b.newCount || a.key.localeCompare(b.key) : b.reusedCount - a.reusedCount || a.newCount - b.newCount || a.unknownCount - b.unknownCount || a.estimatedMm - b.estimatedMm || a.key.localeCompare(b.key);
/** Retain the established Cable UI API around the authoritative explicit-intent planner. */
export const planABCables = (layout: RackLayout, workspace: Workspace, request: ABRequest): ABResult => {
  const counts = request.mode === 'auto' ? [0, 1, 2] as const : [request.mode === 'direct' ? 0 : request.mode === 'one-panel' ? 1 : 2] as const;
  const results = counts.map(panels => planPatchChain(layout, workspace, { from: request.from, to: request.to, panels }));
  const plans = results.flatMap(r => r.candidates.map(p => toABPlan(p, request))).sort(compare).slice(0, 5);
  const limited = results.some(r => r.bounded);
  return { plans, limited, message: plans.length ? `${plans.length} candidate(s). Explicit installation intent is shown per segment. Physical connections only; network/VLAN operation is unverified.${limited ? ' Bounded search; results are not exhaustive.' : ''}` : results[0].message };
};
export const validateABPlan = (layout: RackLayout, workspace: Workspace, plan: ABPlan): ABPlan | null => {
  if (!plan.chain || JSON.stringify(toABPlan(plan.chain, plan.request).steps) !== JSON.stringify(plan.steps)) return null;
  const validation = validateChainApply(layout, workspace, plan.chain);
  if (validation.status === 'invalid') return null;
  const current = planPatchChain(layout, workspace, plan.chain.request).candidates.find(p => p.key === plan.key);
  return current ? toABPlan(current, plan.request) : null;
};
