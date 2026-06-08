import type { CableType, RackLayout } from '../types/rack';
import { calculateCablePlan, estimateCableLength } from './routing';

export interface BomLine {
  type: CableType;
  lengthMm: number;
  count: number;
  slackMm: number;
  serviceLoopMm: number;
  bendRadiusMm: number;
}

export function buildBom(layout: RackLayout): BomLine[] {
  const map = new Map<string, BomLine>();
  layout.cables.forEach((cable) => {
    const plan = calculateCablePlan(cable, layout);
    const lengthMm = plan?.standardLengthMm ?? estimateCableLength(layout, cable);
    const slackMm = plan?.slackMm ?? 0;
    const serviceLoopMm = plan?.render.serviceLoopMm ?? 0;
    const bendRadiusMm = plan?.render.bendRadiusMm ?? 0;
    const key = `${cable.type}-${lengthMm}-${slackMm}-${serviceLoopMm}-${bendRadiusMm}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, { type: cable.type, lengthMm, count: 1, slackMm, serviceLoopMm, bendRadiusMm });
    }
  });
  return Array.from(map.values()).sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.lengthMm - b.lengthMm;
  });
}
