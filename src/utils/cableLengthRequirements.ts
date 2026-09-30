import type { RackLayout } from '../types/rack';
import { buildRackSceneModel } from './rackSceneModel';
import { STANDARD_CABLE_LENGTHS_MM } from './routing';

export type CableLengthRequirement = {
  status: 'estimated' | 'blocked' | 'custom-length';
  centrelineMm: number | null;
  requiredMm: number | null;
  stockedMm: number | null;
  slackMm: number;
  serviceLoopMm: number;
  bendRadiusMm: number;
};

const cache = new WeakMap<RackLayout, Map<string, CableLengthRequirement>>();

/** Purchasing uses the longer rendered style plus one installation allowance.
 * Immutable layout identity includes all cables, so filtering does not change lanes.
 */
export const getCableLengthRequirements = (layout: RackLayout): Map<string, CableLengthRequirement> => {
  const cached = cache.get(layout);
  if (cached) return cached;
  const clean = new Map(buildRackSceneModel(layout, { routingMode: 'clean' }).routes.map(route => [route.cableId, route]));
  const realistic = new Map(buildRackSceneModel(layout, { routingMode: 'realistic' }).routes.map(route => [route.cableId, route]));
  const result = new Map<string, CableLengthRequirement>();
  for (const cable of layout.cables) {
    const a = clean.get(cable.id);
    const b = realistic.get(cable.id);
    const plan = a?.plan ?? b?.plan;
    const centrelineMm = a?.renderedLengthMm != null && b?.renderedLengthMm != null
      ? Math.max(a.renderedLengthMm, b.renderedLengthMm) : null;
    const slackMm = plan?.slackMm ?? 0;
    const requiredMm = centrelineMm === null ? null : Math.ceil(centrelineMm + slackMm);
    const stockedMm = requiredMm === null ? null : STANDARD_CABLE_LENGTHS_MM.find(length => length >= requiredMm) ?? null;
    result.set(cable.id, {
      status: requiredMm === null ? 'blocked' : stockedMm === null ? 'custom-length' : 'estimated',
      centrelineMm, requiredMm, stockedMm, slackMm,
      serviceLoopMm: plan?.render.serviceLoopMm ?? 0,
      bendRadiusMm: plan?.render.bendRadiusMm ?? 0,
    });
  }
  cache.set(layout, result);
  return result;
};

export const cablePurchaseLengthLabel = (requirement: CableLengthRequirement): string =>
  requirement.stockedMm !== null ? `${requirement.stockedMm / 1000} m`
    : requirement.requiredMm !== null ? `Custom length ≥ ${(requirement.requiredMm / 1000).toFixed(3)} m`
      : 'Not estimated — route needs review';

export const cablePurchaseNote = (requirement: CableLengthRequirement): string =>
  requirement.requiredMm === null ? 'Blocked or missing route; resolve the route before choosing a cable length.'
    : `Longer Clean/Realistic 3D centreline ${Math.ceil(requirement.centrelineMm!)}mm plus installation slack ${requirement.slackMm}mm. Installation estimate; verify connectors and actual routing.${requirement.stockedMm === null ? ' Required length exceeds the standard-length table; select a suitable custom length.' : ''}`;
