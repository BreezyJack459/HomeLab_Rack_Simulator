import type { CableType, CableRoute, ValidationIssue } from '../types/rack';

export const DEFAULT_CABLE_COLORS: Record<CableType, string> = {
  ethernet: '#38bdf8',
  power: '#fb923c',
  fiber: '#c084fc',
  usb: '#facc15',
  hdmi: '#22c55e',
  atx: '#f43f5e',
  coax: '#a3e635',
  structured: '#2dd4bf',
  patch: '#0ea5e9'
};

/** Data-centre cable colour conventions (ISO / TIA-606 aligned) */
export const DC_CABLE_COLOR_STANDARD: Record<CableType, string> = {
  ethernet:   '#3B82F6', // Blue  — standard data
  fiber:      '#EAB308', // Yellow — optical
  power:      '#1F2937', // Black  — IEC power
  usb:        '#8B5CF6', // Purple
  hdmi:       '#EC4899', // Pink
  atx:        '#6B7280', // Grey
  coax:       '#F59E0B', // Amber
  structured: '#6B7280', // Grey
  patch:      '#3B82F6', // Blue (patch = ethernet)
};

const LEGACY_STRUCTURED_COLOR = '#475569';

export const getCableDisplayColor = (type: CableType, color?: string): string => {
  if (type === 'structured' && (!color || color.toLowerCase() === LEGACY_STRUCTURED_COLOR)) {
    return DEFAULT_CABLE_COLORS.structured;
  }
  return color || DEFAULT_CABLE_COLORS[type];
};

export function validateCableColorConvention(cable: CableRoute): ValidationIssue | null {
  if (!cable.color) return null;
  const expected = DC_CABLE_COLOR_STANDARD[cable.type];
  if (!expected) return null;
  if (cable.color.toLowerCase() !== expected.toLowerCase()) {
    return {
      id: `cable-color-${cable.id}`,
      severity: 'info',
      title: `Non-standard cable colour`,
      detail: `${cable.type} cables are conventionally ${expected}. Current: ${cable.color}.`,
      deviceIds: [cable.fromDeviceId, cable.toDeviceId],
      cableIds: [cable.id]
    };
  }
  return null;
}
