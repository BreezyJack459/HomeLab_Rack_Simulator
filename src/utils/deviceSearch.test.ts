import { describe, expect, it } from 'vitest';
import { deviceCatalog } from '../data/deviceCatalog';
import { getDeviceSearchRank } from './deviceSearch';

const pc = { id: 'optiplex-7050', name: 'Dell OptiPlex 7050', category: 'mini-pc' as const, description: 'Compact desktop' };

describe('device search', () => {
  it.each(['mini pc', 'Mini-PC', '  MINI__PC  ', 'minipc'])('finds every Mini PC category member for %s', query => {
    const pcs = deviceCatalog.filter(device => device.category === 'mini-pc');
    expect(pcs.length).toBeGreaterThan(0);
    for (const device of pcs) expect(getDeviceSearchRank(device, query, 'Mini PC')).not.toBeNull();
  });

  it('ranks a category match ahead of accessories mentioning it', () => {
    const shelf = { ...pc, id: 'shelf', name: 'Mini PC shelf', category: 'shelf' as const };
    expect(getDeviceSearchRank(pc, 'mini pc')).toBeLessThan(getDeviceSearchRank(shelf, 'mini pc')!);
  });

  it('matches separated model numbers, mixed category/name terms, display labels and aliases', () => {
    expect(getDeviceSearchRank(pc, 'optiplex-7050')).not.toBeNull();
    expect(getDeviceSearchRank(pc, 'Dell mini pc')).not.toBeNull();
    expect(getDeviceSearchRank(pc, 'mini computer')).not.toBeNull();
    expect(getDeviceSearchRank({ ...pc, category: 'blank' }, 'blank panel', 'Blank Panel')).not.toBeNull();
    expect(getDeviceSearchRank({ ...pc, category: 'sbc' }, 'single-board computer')).not.toBeNull();
    expect(getDeviceSearchRank(pc, 'Dell mini pc impossible')).toBeNull();
  });

  it('prefers a specific name or model to incidental description matches', () => {
    const accessory = { ...pc, id: 'mount', name: 'Desktop mount', category: 'printed-mount' as const, description: 'For Dell OptiPlex 7050' };
    expect(getDeviceSearchRank(pc, 'Dell OptiPlex 7050')).toBeLessThan(getDeviceSearchRank(accessory, 'Dell OptiPlex 7050')!);
    expect(getDeviceSearchRank(pc, 'OptiPlex7050')).toBeLessThan(getDeviceSearchRank(accessory, 'OptiPlex7050')!);
  });
});
