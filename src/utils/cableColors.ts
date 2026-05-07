import type { CableType } from '../types/rack';

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

const LEGACY_STRUCTURED_COLOR = '#475569';

export const getCableDisplayColor = (type: CableType, color?: string): string => {
  if (type === 'structured' && (!color || color.toLowerCase() === LEGACY_STRUCTURED_COLOR)) {
    return DEFAULT_CABLE_COLORS.structured;
  }
  return color || DEFAULT_CABLE_COLORS[type];
};
