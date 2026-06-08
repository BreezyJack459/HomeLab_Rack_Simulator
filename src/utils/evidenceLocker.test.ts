import { describe, it, expect } from 'vitest';
import type { RackLayout, EvidenceRecord } from '../types/rack';
import {
  summarizeEvidence,
  evidenceForEntity,
  evidenceTypeLabel,
  entityOptions,
  exportEvidenceCsv,
  exportEvidenceMarkdown,
} from './evidenceLocker';

function makeLayout(overrides: Partial<RackLayout> = {}): RackLayout {
  return {
    id: 'rack-1',
    name: 'Test Rack',
    rackType: '19in',
    heightU: 12,
    rackDepthMm: 600,
    powerBudgetW: 1000,
    weightLimitKg: 200,
    viewSide: 'front',
    devices: [],
    cables: [],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeRecord(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: 'ev-1',
    entityType: 'device',
    entityId: 'd1',
    type: 'receipt',
    title: 'Purchase Receipt',
    source: 'scan_001.pdf',
    ...overrides,
  };
}

describe('summarizeEvidence', () => {
  it('returns zeros for empty records', () => {
    const summary = summarizeEvidence([]);
    expect(summary.totalRecords).toBe(0);
    expect(summary.redactedCount).toBe(0);
    expect(summary.safeToExportCount).toBe(0);
  });

  it('counts by type and entity', () => {
    const records: EvidenceRecord[] = [
      makeRecord({ id: 'ev-1', type: 'receipt', entityType: 'device' }),
      makeRecord({ id: 'ev-2', type: 'receipt', entityType: 'device' }),
      makeRecord({ id: 'ev-3', type: 'serial-photo', entityType: 'rack', entityId: 'rack-1' }),
    ];
    const summary = summarizeEvidence(records);
    expect(summary.totalRecords).toBe(3);
    expect(summary.byType['receipt']).toBe(2);
    expect(summary.byType['serial-photo']).toBe(1);
    expect(summary.byEntity['device']).toBe(2);
    expect(summary.byEntity['rack']).toBe(1);
  });

  it('counts redacted and safe-to-export', () => {
    const records: EvidenceRecord[] = [
      makeRecord({ redacted: true, safeToExport: true }),
      makeRecord({ id: 'ev-2', redacted: false, safeToExport: false }),
    ];
    const summary = summarizeEvidence(records);
    expect(summary.redactedCount).toBe(1);
    expect(summary.safeToExportCount).toBe(1);
    expect(summary.missingExportFlagCount).toBe(0);
  });
});

describe('evidenceForEntity', () => {
  it('filters by entity type and id', () => {
    const records: EvidenceRecord[] = [
      makeRecord({ entityType: 'device', entityId: 'd1' }),
      makeRecord({ id: 'ev-2', entityType: 'device', entityId: 'd2' }),
      makeRecord({ id: 'ev-3', entityType: 'rack', entityId: 'rack-1' }),
    ];
    const result = evidenceForEntity(records, 'device', 'd1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ev-1');
  });
});

describe('evidenceTypeLabel', () => {
  it('returns human-readable labels', () => {
    expect(evidenceTypeLabel('receipt')).toBe('Receipt');
    expect(evidenceTypeLabel('serial-photo')).toBe('Serial Photo');
    expect(evidenceTypeLabel('config-backup-hash')).toBe('Config Hash');
    expect(evidenceTypeLabel('unknown' as EvidenceRecord['type'])).toBe('unknown');
  });
});

describe('entityOptions', () => {
  it('includes rack, devices, and cables', () => {
    const layout = makeLayout({
      devices: [
        {
          id: 'd1',
          name: 'Switch',
          category: 'switch',
          positionU: 1,
          sizeU: 1,
          depthMm: 300,
          widthType: '19in',
          weightKg: 4,
          powerW: 40,
          heatLevel: 2,
          color: '#333',
        },
      ],
      cables: [
        {
          id: 'c1',
          fromDeviceId: 'd1',
          fromPort: { type: 'ethernet', index: 0 },
          toDeviceId: 'd2',
          toPort: { type: 'ethernet', index: 1 },
          type: 'ethernet',
          color: '#3b82f6',
        },
      ],
    });
    const options = entityOptions(layout);
    expect(options.some((o) => o.type === 'rack' && o.name === 'Test Rack')).toBe(true);
    expect(options.some((o) => o.type === 'device' && o.name === 'Switch')).toBe(true);
    expect(options.some((o) => o.type === 'cable' && o.name.includes('Switch'))).toBe(true);
  });
});

describe('exportEvidenceCsv', () => {
  it('produces header row', () => {
    const layout = makeLayout();
    const csv = exportEvidenceCsv([], layout);
    expect(csv).toContain('ID,Type,Title,Entity Type,Entity Name,Source,Captured,Redacted,Safe to Export,Notes');
  });

  it('includes records', () => {
    const layout = makeLayout();
    const csv = exportEvidenceCsv([makeRecord()], layout);
    expect(csv).toContain('ev-1');
    expect(csv).toContain('receipt');
    expect(csv).toContain('Purchase Receipt');
  });
});

describe('exportEvidenceMarkdown', () => {
  it('includes header and table', () => {
    const layout = makeLayout();
    const md = exportEvidenceMarkdown([], layout);
    expect(md).toContain('# Evidence Locker — Test Rack');
    expect(md).toContain('| Type | Title | Entity | Source | Date | Export Safe |');
  });
});
