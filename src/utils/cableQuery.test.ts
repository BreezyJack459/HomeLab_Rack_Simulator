import { describe, expect, it } from 'vitest';
import { sampleLayouts } from '../data/sampleLayouts';
import { matchesCableQuery } from './cableQuery';

describe('matchesCableQuery', () => {
  it('uses one query contract for labels, notes, endpoints and ports', () => {
    const layout = sampleLayouts[0];
    const cable = { ...layout.cables[0], label: 'ISP uplink alpha', notes: 'blue tray', fromPort: { type: 'ethernet' as const, index: 2 } };
    expect(matchesCableQuery(cable, layout, 'uplink alpha')).toBe(true);
    expect(matchesCableQuery(cable, layout, 'blue tray')).toBe(true);
    const port = cable.fromPort ?? cable.toPort;
    expect(port).toBeDefined();
    if (port) expect(matchesCableQuery(cable, layout, `${port.type} ${port.index + 1}`)).toBe(true);
    expect(matchesCableQuery(cable, layout, 'definitely absent')).toBe(false);
  });
});
