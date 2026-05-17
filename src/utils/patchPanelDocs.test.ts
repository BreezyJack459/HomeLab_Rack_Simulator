import { describe, it, expect } from 'vitest';
import type { CableRoute, PlacedDevice } from '../types/rack';
import {
  getPatchPanelDocs,
  findPatchPanelDoc,
  getPatchPanelDocSummary,
  validatePatchPanelDocs,
  exportPatchPanelDocsMarkdown,
  exportPatchPanelDocsCsv,
} from './patchPanelDocs';

function makePatchPanel(overrides: Partial<PlacedDevice> = {}): PlacedDevice {
  return {
    id: 'pp1',
    category: 'patch-panel',
    name: 'Patch Panel',
    positionU: 1,
    sizeU: 1,
    depthMm: 100,
    widthType: '19in',
    weightKg: 2,
    powerW: 0,
    heatLevel: 1,
    color: '#555',
    ports: { ethernet: 24 },
    ...overrides,
  };
}

function makeCable(overrides: Partial<CableRoute> = {}): CableRoute {
  return {
    id: 'c1',
    fromDeviceId: 'sw1',
    fromPort: { type: 'ethernet', index: 0 },
    toDeviceId: 'pp1',
    toPort: { type: 'ethernet', index: 0 },
    type: 'ethernet',
    color: '#3b82f6',
    ...overrides,
  };
}

describe('getPatchPanelDocs', () => {
  it('returns docs for device', () => {
    const docs = [
      { portIndex: 0, deviceId: 'pp1', destinationRoom: 'Office' },
      { portIndex: 1, deviceId: 'pp1', destinationRoom: 'Bedroom' },
      { portIndex: 2, deviceId: 'pp2', destinationRoom: 'Garage' },
    ];
    const device = makePatchPanel();
    const deviceDocs = getPatchPanelDocs(device.id, docs);
    expect(deviceDocs).toHaveLength(2);
    expect(deviceDocs[0].destinationRoom).toBe('Office');
  });

  it('returns empty array when no docs', () => {
    const device = makePatchPanel();
    const deviceDocs = getPatchPanelDocs(device.id, []);
    expect(deviceDocs).toHaveLength(0);
  });
});

describe('findPatchPanelDoc', () => {
  it('finds doc by port index', () => {
    const docs = [
      { portIndex: 0, deviceId: 'pp1', destinationRoom: 'Office' },
      { portIndex: 5, deviceId: 'pp1', destinationRoom: 'Garage' },
    ];
    const found = findPatchPanelDoc(docs, 5);
    expect(found?.destinationRoom).toBe('Garage');
  });

  it('returns undefined when not found', () => {
    const docs = [{ portIndex: 0, deviceId: 'pp1', destinationRoom: 'Office' }];
    const found = findPatchPanelDoc(docs, 3);
    expect(found).toBeUndefined();
  });
});

describe('getPatchPanelDocSummary', () => {
  it('returns zeros for empty device', () => {
    const device = makePatchPanel({ ports: { ethernet: 0 } });
    const summary = getPatchPanelDocSummary(device, []);
    expect(summary.totalPorts).toBe(0);
    expect(summary.documentedPorts).toBe(0);
  });

  it('counts documented ports correctly', () => {
    const device = makePatchPanel({ ports: { ethernet: 24 } });
    const docs = [
      { portIndex: 0, deviceId: 'pp1', destinationRoom: 'Office', wireCode: 'T568B' as const, testedSpeed: '1G' },
      { portIndex: 1, deviceId: 'pp1', destinationRoom: 'Bedroom' },
      { portIndex: 2, deviceId: 'pp1', wireCode: 'T568A' as const },
    ];
    const summary = getPatchPanelDocSummary(device, docs);
    expect(summary.totalPorts).toBe(24);
    expect(summary.documentedPorts).toBe(3);
    expect(summary.portsWithRoom).toBe(2);
    expect(summary.portsWithWireCode).toBe(2);
    expect(summary.portsTested).toBe(1);
  });
});

describe('validatePatchPanelDocs', () => {
  it('returns empty for patch panel with no cables', () => {
    const device = makePatchPanel();
    const issues = validatePatchPanelDocs(device, [], []);
    expect(issues).toHaveLength(0);
  });

  it('flags missing docs for cabled ports', () => {
    const device = makePatchPanel();
    const cables = [makeCable({ toDeviceId: 'pp1', toPort: { type: 'ethernet', index: 0 } })];
    const issues = validatePatchPanelDocs(device, [], cables);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('info');
    expect(issues[0].title).toContain('lacks documentation');
  });

  it('does not flag docs for non-patch-panel devices', () => {
    const device = makePatchPanel({ category: 'switch' });
    const cables = [makeCable({ toDeviceId: 'pp1' })];
    const issues = validatePatchPanelDocs(device, [], cables);
    expect(issues).toHaveLength(0);
  });

  it('flags docs for non-existent ports', () => {
    const device = makePatchPanel({ ports: { ethernet: 8 } });
    const docs = [{ portIndex: 15, deviceId: 'pp1', destinationRoom: 'Office' }];
    const issues = validatePatchPanelDocs(device, docs, []);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].title).toContain('invalid port');
  });
});

describe('exportPatchPanelDocsMarkdown', () => {
  it('includes header and table rows', () => {
    const device = makePatchPanel({
      name: 'PP-01',
      ports: { ethernet: 2 },
    });
    const docs = [
      { portIndex: 0, deviceId: 'pp1', destinationRoom: 'Office', wireCode: 'T568B' as const },
    ];
    const md = exportPatchPanelDocsMarkdown(device, docs);
    expect(md).toContain('# Patch Panel Documentation: PP-01');
    expect(md).toContain('| Port | Room | Wall Plate |');
    expect(md).toContain('Office');
    expect(md).toContain('T568B');
  });
});

describe('exportPatchPanelDocsCsv', () => {
  it('produces header row', () => {
    const device = makePatchPanel({ ports: { ethernet: 0 } });
    const csv = exportPatchPanelDocsCsv(device, []);
    expect(csv).toContain('Port,Room,Wall Plate,Wire Code,Punch-Down Date,Tested Speed,Notes');
  });

  it('includes port data', () => {
    const device = makePatchPanel({ ports: { ethernet: 2 } });
    const docs = [
      { portIndex: 0, deviceId: 'pp1', destinationRoom: 'Office', wireCode: 'T568B' as const },
    ];
    const csv = exportPatchPanelDocsCsv(device, docs);
    expect(csv).toContain('1,"Office",,T568B,,,');
    expect(csv).toContain('2,,,,,,');
  });
});
