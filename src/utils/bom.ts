import type { CableType, RackLayout } from '../types/rack';
import { getCableLengthRequirements, cablePurchaseNote } from './cableLengthRequirements';

export interface BomLine {
  type: CableType;
  lengthMm: number | null;
  requiredMm: number | null;
  note: string;
  count: number;
  slackMm: number;
  serviceLoopMm: number;
  bendRadiusMm: number;
}

export const bomLengthLabel = (line: BomLine): string => line.lengthMm !== null ? `${line.lengthMm / 1000} m`
  : line.requiredMm !== null ? `Custom length ≥ ${(line.requiredMm / 1000).toFixed(3)} m` : 'Not estimated — route needs review';

export function buildBom(layout: RackLayout): BomLine[] {
  const map = new Map<string, BomLine>();
  const requirements = getCableLengthRequirements(layout);
  layout.cables.forEach((cable) => {
    const requirement = requirements.get(cable.id)!;
    const lengthMm = requirement.stockedMm;
    const { slackMm, serviceLoopMm, bendRadiusMm, requiredMm } = requirement;
    const note = cablePurchaseNote(requirement);
    const key = `${cable.type}-${lengthMm}-${lengthMm === null ? requiredMm : ''}-${slackMm}-${serviceLoopMm}-${bendRadiusMm}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.requiredMm = Math.max(existing.requiredMm ?? 0, requiredMm ?? 0) || null;
      if (requiredMm === existing.requiredMm) existing.note = note;
    } else {
      map.set(key, { type: cable.type, lengthMm, requiredMm, note, count: 1, slackMm, serviceLoopMm, bendRadiusMm });
    }
  });
  return Array.from(map.values()).sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return (a.lengthMm ?? Infinity) - (b.lengthMm ?? Infinity);
  });
}
