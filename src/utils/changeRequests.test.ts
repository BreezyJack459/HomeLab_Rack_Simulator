import { describe, it, expect } from 'vitest';
import type { ChangeRequest, PlacedDevice, CableRoute } from '../types/rack';
import {
  summarizeChangeRequests,
  validateChangeRequests,
  exportChangeRequestsMarkdown,
  exportChangeRequestsCsv,
} from './changeRequests';

function makeRequest(overrides: Partial<ChangeRequest> = {}): ChangeRequest {
  return {
    id: 'cr-1',
    title: 'Replace UPS battery',
    riskLevel: 'medium',
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeDevice(overrides: Partial<PlacedDevice> = {}): PlacedDevice {
  return {
    id: 'd1',
    category: 'switch',
    name: 'Switch',
    positionU: 1,
    sizeU: 1,
    depthMm: 300,
    widthType: '19in',
    weightKg: 4,
    powerW: 40,
    heatLevel: 2,
    color: '#333',
    ...overrides,
  };
}

function makeCable(overrides: Partial<CableRoute> = {}): CableRoute {
  return {
    id: 'c1',
    fromDeviceId: 'd1',
    fromPort: { type: 'ethernet', index: 0 },
    toDeviceId: 'd2',
    toPort: { type: 'ethernet', index: 0 },
    type: 'ethernet',
    color: '#3b82f6',
    ...overrides,
  };
}

describe('summarizeChangeRequests', () => {
  it('returns zeros for empty list', () => {
    const summary = summarizeChangeRequests([]);
    expect(summary.totalCount).toBe(0);
    expect(summary.pendingCount).toBe(0);
    expect(summary.approvedCount).toBe(0);
    expect(summary.rejectedCount).toBe(0);
    expect(summary.completedCount).toBe(0);
  });

  it('counts by status', () => {
    const requests: ChangeRequest[] = [
      makeRequest({ id: 'r1', status: 'pending' }),
      makeRequest({ id: 'r2', status: 'approved' }),
      makeRequest({ id: 'r3', status: 'rejected' }),
      makeRequest({ id: 'r4', status: 'completed' }),
      makeRequest({ id: 'r5', status: 'pending' }),
    ];
    const summary = summarizeChangeRequests(requests);
    expect(summary.totalCount).toBe(5);
    expect(summary.pendingCount).toBe(2);
    expect(summary.approvedCount).toBe(1);
    expect(summary.rejectedCount).toBe(1);
    expect(summary.completedCount).toBe(1);
  });
});

describe('validateChangeRequests', () => {
  it('returns empty for valid requests', () => {
    const devices = [makeDevice({ id: 'd1' })];
    const requests = [makeRequest({ affectedDeviceIds: ['d1'] })];
    const issues = validateChangeRequests(requests, devices, []);
    expect(issues).toHaveLength(0);
  });

  it('flags missing device', () => {
    const requests = [makeRequest({ title: 'Test', affectedDeviceIds: ['missing'] })];
    const issues = validateChangeRequests(requests, [], []);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].title).toContain('missing device');
  });

  it('flags missing cable', () => {
    const requests = [makeRequest({ title: 'Test', affectedCableIds: ['missing'] })];
    const issues = validateChangeRequests(requests, [], []);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].title).toContain('missing cable');
  });

  it('flags high-risk without rollback plan', () => {
    const requests = [makeRequest({ riskLevel: 'high', rollbackPlan: undefined })];
    const issues = validateChangeRequests(requests, [], []);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].title).toContain('rollback plan');
  });

  it('does not flag high-risk with rollback plan', () => {
    const requests = [makeRequest({ riskLevel: 'high', rollbackPlan: 'Revert to baseline' })];
    const issues = validateChangeRequests(requests, [], []);
    expect(issues).toHaveLength(0);
  });
});

describe('exportChangeRequestsMarkdown', () => {
  it('includes header and table', () => {
    const devices = [makeDevice({ id: 'd1', name: 'Switch' })];
    const requests = [makeRequest({ title: 'Test', affectedDeviceIds: ['d1'] })];
    const md = exportChangeRequestsMarkdown(requests, devices);
    expect(md).toContain('# Change Requests');
    expect(md).toContain('| Title | Risk | Status |');
    expect(md).toContain('Test');
    expect(md).toContain('Switch');
  });
});

describe('exportChangeRequestsCsv', () => {
  it('produces header row', () => {
    const csv = exportChangeRequestsCsv([]);
    expect(csv).toContain('ID,Title,Description,Risk Level,Status,Expected Downtime (min),Rollback Plan,Created At,Approved At,Approved By,Affected Devices,Affected Cables');
  });

  it('includes requests', () => {
    const requests = [makeRequest({ id: 'cr-1', title: 'Test' })];
    const csv = exportChangeRequestsCsv(requests);
    expect(csv).toContain('cr-1');
    expect(csv).toContain('Test');
  });
});
