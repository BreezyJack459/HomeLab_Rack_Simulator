import { describe, expect, it } from 'vitest';
import type { RackLayout } from '../types/rack';
import { validateImportedLayout } from './layoutValidation';

function buildValidLayout(overrides: Partial<RackLayout> = {}): RackLayout {
  return {
    id: 'layout-1',
    name: 'Test',
    rackType: '19in',
    heightU: 12,
    rackDepthMm: 600,
    weightLimitKg: 200,
    powerBudgetW: 1200,
    viewSide: 'front',
    devices: [],
    cables: [],
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

describe('validateImportedLayout', () => {
  describe('top-level rejections', () => {
    it('rejects null', () => {
      const result = validateImportedLayout(null);
      expect(result.valid).toBe(false);
    });

    it('rejects undefined', () => {
      const result = validateImportedLayout(undefined);
      expect(result.valid).toBe(false);
    });

    it('rejects a primitive string', () => {
      const result = validateImportedLayout('not a layout');
      expect(result.valid).toBe(false);
    });

    it('rejects an array', () => {
      const result = validateImportedLayout([1, 2, 3]);
      expect(result.valid).toBe(false);
    });

    it('rejects an empty object with descriptive errors', () => {
      const result = validateImportedLayout({});
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.join(' ')).toMatch(/id|name|rackType|heightU|devices|cables/);
      }
    });
  });

  describe('field validation', () => {
    it('accepts a fully valid layout', () => {
      const layout = buildValidLayout({
        procurementItems: [
          {
            id: 'proc-1',
            label: 'Cage nuts',
            category: 'rack-hardware',
            quantity: 8,
            status: 'ordered'
          }
        ]
      });
      const result = validateImportedLayout(layout);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.layout.id).toBe('layout-1');
        expect(result.layout.procurementItems).toHaveLength(1);
      }
    });

    it('rejects unknown rackType', () => {
      const result = validateImportedLayout(buildValidLayout({ rackType: '23in' as never }));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.toLowerCase().includes('racktype'))).toBe(true);
      }
    });

    it('rejects negative heightU', () => {
      const result = validateImportedLayout(buildValidLayout({ heightU: -5 }));
      expect(result.valid).toBe(false);
    });

    it('rejects non-number heightU', () => {
      const result = validateImportedLayout(buildValidLayout({ heightU: 'twelve' as never }));
      expect(result.valid).toBe(false);
    });

    it('rejects non-array devices', () => {
      const result = validateImportedLayout(buildValidLayout({ devices: 'oops' as never }));
      expect(result.valid).toBe(false);
    });

    it('rejects non-array cables', () => {
      const result = validateImportedLayout(buildValidLayout({ cables: null as never }));
      expect(result.valid).toBe(false);
    });

    it('rejects non-array procurementItems', () => {
      const result = validateImportedLayout(buildValidLayout({ procurementItems: {} as never }));
      expect(result.valid).toBe(false);
    });

    it('rejects unknown viewSide', () => {
      const result = validateImportedLayout(buildValidLayout({ viewSide: 'left' as never }));
      expect(result.valid).toBe(false);
    });

    it('synthesizes updatedAt when missing', () => {
      const layout = buildValidLayout();
      const { updatedAt: _ignored, ...rest } = layout;
      const result = validateImportedLayout(rest);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(typeof result.layout.updatedAt).toBe('string');
        expect(() => new Date(result.layout.updatedAt)).not.toThrow();
      }
    });
  });

  describe('device validation', () => {
    it('rejects a device missing required id', () => {
      const layout = buildValidLayout({
        devices: [
          {
            // id missing
            category: 'switch',
            name: 'Switch',
            positionU: 0,
            sizeU: 1,
            depthMm: 300,
            widthType: '19in',
            weightKg: 2,
            powerW: 30,
            heatLevel: 2,
            color: '#000'
          } as never
        ]
      });
      const result = validateImportedLayout(layout);
      expect(result.valid).toBe(false);
    });

    it('rejects a device with non-numeric positionU', () => {
      const layout = buildValidLayout({
        devices: [
          {
            id: 'd1',
            category: 'switch',
            name: 'Switch',
            positionU: 'top' as never,
            sizeU: 1,
            depthMm: 300,
            widthType: '19in',
            weightKg: 2,
            powerW: 30,
            heatLevel: 2,
            color: '#000'
          }
        ]
      });
      const result = validateImportedLayout(layout);
      expect(result.valid).toBe(false);
    });

    it('accepts a layout with a minimal valid device', () => {
      const layout = buildValidLayout({
        devices: [
          {
            id: 'd1',
            category: 'switch',
            name: 'Switch',
            positionU: 0,
            sizeU: 1,
            depthMm: 300,
            widthType: '19in',
            weightKg: 2,
            powerW: 30,
            heatLevel: 2,
            color: '#000'
          }
        ]
      });
      const result = validateImportedLayout(layout);
      expect(result.valid).toBe(true);
    });
  });

  describe('cable validation', () => {
    it('rejects a cable missing fromDeviceId', () => {
      const layout = buildValidLayout({
        cables: [
          {
            id: 'c1',
            // fromDeviceId missing
            toDeviceId: 'd2',
            type: 'ethernet',
            color: '#000'
          } as never
        ]
      });
      const result = validateImportedLayout(layout);
      expect(result.valid).toBe(false);
    });

    it('accepts a layout with a minimal valid cable', () => {
      const layout = buildValidLayout({
        cables: [
          {
            id: 'c1',
            fromDeviceId: 'd1',
            toDeviceId: 'd2',
            type: 'ethernet',
            color: '#000'
          }
        ]
      });
      const result = validateImportedLayout(layout);
      expect(result.valid).toBe(true);
    });
  });

  describe('error message accumulation', () => {
    it('reports multiple errors instead of bailing on the first one', () => {
      const result = validateImportedLayout({
        id: 'x',
        name: 'X',
        rackType: 'foo',
        heightU: -1,
        rackDepthMm: 'wide',
        weightLimitKg: 0,
        powerBudgetW: 0,
        viewSide: 'sideways',
        devices: 'no',
        cables: 'no',
        updatedAt: 'now'
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThanOrEqual(5);
      }
    });
  });
});
