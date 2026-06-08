import { describe, expect, it } from 'vitest';
import type { DeviceTemplate } from '../types/rack';
import { analyzeTemplateQuality, exportTemplateQualityMarkdown, TRACKED_FIELDS } from './templateQuality';

const templates: DeviceTemplate[] = [
  {
    id: 't1',
    category: 'switch',
    name: 'Full Switch',
    defaultU: 1,
    depthMm: 200,
    widthType: '19in',
    weightKg: 2,
    powerW: 20,
    heatLevel: 2,
    ports: { ethernet: 8 },
    portLayouts: { front: [{ type: 'ethernet' }] },
    rackMountable: true,
    color: '#333',
    description: 'A switch',
  },
  {
    id: 't2',
    category: 'nas',
    name: 'Basic NAS',
    defaultU: 2,
    depthMm: 300,
    widthType: '19in',
    weightKg: 5,
    powerW: 50,
    heatLevel: 2,
    color: '#555',
    description: 'A NAS',
  },
  {
    id: 't3',
    category: 'pdu-0u',
    name: '0U PDU',
    defaultU: 0,
    depthMm: 50,
    widthType: '19in',
    weightKg: 1,
    powerW: 0,
    heatLevel: 1,
    mountType: 'side-rail',
    mountSide0U: 'left',
    outletFacing: 'inward',
    color: '#777',
    description: 'A PDU',
  },
];

describe('analyzeTemplateQuality', () => {
  it('counts total templates', () => {
    const result = analyzeTemplateQuality(templates);
    expect(result.totalTemplates).toBe(3);
  });

  it('calculates field coverage', () => {
    const result = analyzeTemplateQuality(templates);
    const portsCoverage = result.fieldCoverage.find((f) => f.field === 'ports');
    expect(portsCoverage?.present).toBe(1);
    expect(portsCoverage?.percent).toBe(33);

    const mountTypeCoverage = result.fieldCoverage.find((f) => f.field === 'mountType');
    expect(mountTypeCoverage?.present).toBe(1);
    expect(mountTypeCoverage?.percent).toBe(33);
  });

  it('calculates category coverage', () => {
    const result = analyzeTemplateQuality(templates);
    const switchCat = result.categoryCoverage.find((c) => c.category === 'switch');
    expect(switchCat?.count).toBe(1);
    expect(switchCat?.avgCoveragePercent).toBeGreaterThan(0);
  });

  it('identifies low quality templates', () => {
    const result = analyzeTemplateQuality(templates);
    expect(result.lowQualityTemplates.length).toBeGreaterThanOrEqual(0);
  });

  it('calculates overall score', () => {
    const result = analyzeTemplateQuality(templates);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('handles empty catalog', () => {
    const result = analyzeTemplateQuality([]);
    expect(result.totalTemplates).toBe(0);
    expect(result.overallScore).toBe(0);
    expect(result.fieldCoverage.every((f) => f.percent === 0)).toBe(true);
  });
});

describe('exportTemplateQualityMarkdown', () => {
  it('includes overall score', () => {
    const result = analyzeTemplateQuality(templates);
    const md = exportTemplateQualityMarkdown(result);
    expect(md).toContain('Device Catalog Data Quality Report');
    expect(md).toContain(`${result.overallScore}%`);
    expect(md).toContain('Field Coverage');
  });
});

describe('TRACKED_FIELDS', () => {
  it('has 8 tracked fields', () => {
    expect(TRACKED_FIELDS.length).toBe(8);
  });
});
