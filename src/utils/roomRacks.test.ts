import { describe, expect, it } from 'vitest';
import { exportRoomRacksMarkdown, findRackOverlaps, getRackDimensions, getRoomBounds, summarizeRoomRacks } from './roomRacks';
import type { RoomRack } from '../types/rack';

const racks: RoomRack[] = [
  { id: 'r1', name: 'Main Rack', xMm: 0, yMm: 0, widthMm: 482.6, depthMm: 1000, heightU: 42, rackType: '19in' },
  { id: 'r2', name: 'Secondary', xMm: 1000, yMm: 0, widthMm: 482.6, depthMm: 1000, heightU: 24, rackType: '19in' },
  { id: 'r3', name: 'Mini', xMm: 0, yMm: 1200, widthMm: 254, depthMm: 600, heightU: 12, rackType: '10in' },
];

describe('getRackDimensions', () => {
  it('returns 19in width for 19in rack', () => {
    const d = getRackDimensions('19in', 42);
    expect(d.widthMm).toBe(482.6);
  });

  it('returns 10in width for 10in rack', () => {
    const d = getRackDimensions('10in', 12);
    expect(d.widthMm).toBe(254);
  });

  it('calculates height from U count', () => {
    const d = getRackDimensions('19in', 42);
    expect(d.heightMm).toBeCloseTo(100 + 42 * 44.45, 1);
  });
});

describe('summarizeRoomRacks', () => {
  it('counts total racks', () => {
    const s = summarizeRoomRacks(racks);
    expect(s.total).toBe(3);
  });

  it('groups by type', () => {
    const s = summarizeRoomRacks(racks);
    expect(s.byType['19in']).toBe(2);
    expect(s.byType['10in']).toBe(1);
  });

  it('sums total height U', () => {
    const s = summarizeRoomRacks(racks);
    expect(s.totalHeightU).toBe(78);
  });

  it('handles empty array', () => {
    const s = summarizeRoomRacks([]);
    expect(s.total).toBe(0);
    expect(s.totalHeightU).toBe(0);
  });
});

describe('findRackOverlaps', () => {
  it('finds overlapping racks', () => {
    const overlapping: RoomRack[] = [
      { id: 'a', name: 'A', xMm: 0, yMm: 0, widthMm: 500, depthMm: 1000, heightU: 42, rackType: '19in' },
      { id: 'b', name: 'B', xMm: 200, yMm: 200, widthMm: 500, depthMm: 1000, heightU: 42, rackType: '19in' },
    ];
    const o = findRackOverlaps(overlapping);
    expect(o.length).toBe(1);
    expect(o[0].rackAName).toBe('A');
    expect(o[0].rackBName).toBe('B');
  });

  it('returns empty for non-overlapping racks', () => {
    const o = findRackOverlaps(racks);
    expect(o.length).toBe(0);
  });
});

describe('getRoomBounds', () => {
  it('calculates room bounds from rack positions', () => {
    const b = getRoomBounds(racks);
    expect(b.minX).toBe(0);
    expect(b.minY).toBe(0);
    expect(b.widthMm).toBeGreaterThan(0);
    expect(b.depthMm).toBeGreaterThan(0);
  });

  it('returns zero for empty array', () => {
    const b = getRoomBounds([]);
    expect(b.widthMm).toBe(0);
    expect(b.depthMm).toBe(0);
  });
});

describe('exportRoomRacksMarkdown', () => {
  it('includes header and summary', () => {
    const md = exportRoomRacksMarkdown(racks);
    expect(md).toContain('Room Rack Layout');
    expect(md).toContain('**Total Racks:** 3');
  });

  it('includes rack details', () => {
    const md = exportRoomRacksMarkdown(racks);
    expect(md).toContain('Main Rack');
    expect(md).toContain('Secondary');
    expect(md).toContain('Mini');
  });

  it('includes overlap warnings when present', () => {
    const overlapping: RoomRack[] = [
      { id: 'a', name: 'A', xMm: 0, yMm: 0, widthMm: 500, depthMm: 1000, heightU: 42, rackType: '19in' },
      { id: 'b', name: 'B', xMm: 200, yMm: 200, widthMm: 500, depthMm: 1000, heightU: 42, rackType: '19in' },
    ];
    const md = exportRoomRacksMarkdown(overlapping);
    expect(md).toContain('Overlap Warnings');
    expect(md).toContain('**A** overlaps **B**');
  });
});
