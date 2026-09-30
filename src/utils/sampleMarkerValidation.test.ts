import { describe, expect, it } from 'vitest';
import type { RackLayout } from '../types/rack';
import { validateImportedLayout } from './layoutValidation';

const rack = (example?: unknown): RackLayout => ({
  id: 'owned-rack', name: 'Sample copy', rackType: '10in', heightU: 6, rackDepthMm: 300,
  weightLimitKg: 30, powerBudgetW: 300, viewSide: 'front', devices: [], cables: [], updatedAt: '2026-09-30T00:00:00Z',
  ...(example !== undefined ? { example } : {}),
} as RackLayout);

describe('example origin marker validation', () => {
  it('keeps existing plans without a marker and preserves valid unknown extension data', () => {
    expect(validateImportedLayout(rack()).valid).toBe(true);
    const marker = { version: 1, sampleId: 'learn-beginner-10in', extension: { original: true } };
    const result = validateImportedLayout(rack(marker));
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.layout.example).toEqual(marker);
  });

  it.each([
    ['example', null],
    ['example', []],
    ['example.version', { version: 2, sampleId: 'learn-beginner-10in' }],
    ['example.version', { sampleId: 'learn-beginner-10in' }],
    ['example.sampleId', { version: 1, sampleId: '' }],
    ['example.sampleId', { version: 1, sampleId: '   ' }],
    ['example.sampleId', { version: 1, sampleId: 42 }],
  ])('rejects malformed %s actionably', (field, marker) => {
    const result = validateImportedLayout(rack(marker));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.join(';')).toContain(field);
  });
});
