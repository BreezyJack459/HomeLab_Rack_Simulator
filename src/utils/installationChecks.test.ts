import { describe, expect, it } from 'vitest';
import type { PlacedDevice, RackLayout } from '../types/rack';
import { getInstallationChecks, getInstallationIssues, getSupportingShelf } from './installationChecks';
import { getDepthCompatibilityIssues } from './rackMath';
import { validateImportedLayout } from './layoutValidation';
import { deviceCatalog } from '../data/deviceCatalog';
import { useRackStore } from '../store/rackStore';

const device: PlacedDevice = { id: 'server', name: 'Server', category: 'server', sizeU: 1, positionU: 1, depthMm: 300, widthType: '19in', powerW: 50, weightKg: 5, heatLevel: 2, color: '#000',
  installationRequirements: { support: 'rails', railMinMm: 650, railMaxMm: 1000 }, installationKit: 'Kit R1' };
const layout: RackLayout = { id: 'rack', name: 'Rack', rackType: '19in', heightU: 42, rackDepthMm: 1200, powerBudgetW: 1000, weightLimitKg: 200, viewSide: 'front', devices: [device], cables: [], updatedAt: '' };

describe('recorded installation requirements', () => {
  it('never substitutes cabinet or chassis depth for unmeasured post spacing', () => {
    expect(getInstallationChecks(layout, device).find(c => c.id === 'rails')?.status).toBe('unknown');
    expect(getInstallationChecks({ ...layout, mountingPostSpacingMm: 700 }, device).find(c => c.id === 'rails')?.status).toBe('passed');
  });
  it('accepts both range boundaries and quantifies deficits independently of chassis depth', () => {
    for (const spacing of [650, 1000]) expect(getInstallationChecks({ ...layout, mountingPostSpacingMm: spacing }, device)[0].status).toBe('passed');
    expect(getInstallationChecks({ ...layout, mountingPostSpacingMm: 600 }, device)[0]).toMatchObject({ status: 'failed', detail: expect.stringContaining('50.0') });
    expect(getInstallationChecks({ ...layout, mountingPostSpacingMm: 1100 }, device)[0]).toMatchObject({ status: 'failed', detail: expect.stringContaining('100.0') });
    expect(getDepthCompatibilityIssues({ ...layout, mountingPostSpacingMm: 600 })[0].reasons).toContain('rail-min');
    expect(getDepthCompatibilityIssues({ ...layout, mountingPostSpacingMm: 1100 })[0].reasons).toContain('rail-max');
  });
  it('keeps unknown kit and clearance separate from a passing rail-range check', () => {
    const current = { ...device, installationKit: undefined, installationRequirements: { ...device.installationRequirements!, rearClearanceMm: 90 } };
    const checks = getInstallationChecks({ ...layout, mountingPostSpacingMm: 700 }, current);
    expect(checks.map(c => [c.id, c.status])).toEqual([['rails', 'passed'], ['kit', 'unknown'], ['clearance', 'unknown']]);
    expect(getInstallationChecks({ ...layout, rearClearanceMm: 40 }, current).find(c => c.id === 'clearance')?.detail).toContain('50.0');
  });
  it('reports contradictory ranges, impossible rack measurements and support mismatches', () => {
    expect(getInstallationChecks({ ...layout, mountingPostSpacingMm: 1300 }, device)[0].status).toBe('failed');
    expect(getInstallationChecks(layout, { ...device, installationRequirements: { support: 'rails', railMinMm: 1000, railMaxMm: 600 } })[0].status).toBe('failed');
    expect(getInstallationChecks(layout, { ...device, mountingSupport: 'printed-mount', installationRequirements: { support: 'shelf' } })[0].status).toBe('failed');
    expect(getInstallationIssues({ ...layout, devices: [{ ...device, installationRequirements: undefined }] })[0].detail).toContain('Chassis dimensions alone');
  });
  it('copies existing catalog rail ranges on placement and preserves them through JSON validation', () => {
    const template = deviceCatalog.find(d => d.installationRequirements?.railMinMm === 650)!;
    useRackStore.getState().loadLayout({ ...layout, devices: [], mountingPostSpacingMm: 700 });
    useRackStore.getState().addDeviceFromTemplate(template.id);
    const saved = useRackStore.getState().layout;
    expect(saved.devices[0].installationRequirements).toEqual(template.installationRequirements);
    expect(validateImportedLayout(JSON.parse(JSON.stringify(saved))).valid).toBe(true);
    expect(validateImportedLayout({ ...layout, mountingPostSpacingMm: -1 }).valid).toBe(false);
    expect(validateImportedLayout({ ...layout, devices: [{ ...device, installationRequirements: { support: 'rails', railMinMm: '650' } }] }).valid).toBe(false);
  });
});


it('requires the full shelf footprint, depth, side and direct support position', () => {
  const compact = { ...device, positionU: 2, widthType: 'custom' as const, customWidthMm: 250, xMm: 50, depthMm: 300 };
  const shelf = { ...device, id: 'shelf', category: 'shelf' as const, positionU: 1, widthType: 'custom' as const, customWidthMm: 200, xMm: 0, depthMm: 400 };
  expect(getSupportingShelf({ ...layout, devices: [compact, shelf] }, compact)).toBeUndefined();
  const fullShelf = { ...shelf, customWidthMm: 400 };
  expect(getSupportingShelf({ ...layout, devices: [compact, fullShelf] }, compact)?.id).toBe('shelf');
  for (const patch of [{ depthMm: 200 }, { positionU: 3 }, { mountSide: 'rear' as const }]) {
    expect(getSupportingShelf({ ...layout, devices: [compact, { ...fullShelf, ...patch }] }, compact)).toBeUndefined();
  }
});


it('identifies unknown evidence for Check grouping while retaining failed rail warnings', () => {
  expect(getInstallationIssues(layout)[0]).toMatchObject({ evidence: 'unverified', severity: 'warning' });
  const failed = getInstallationIssues({ ...layout, mountingPostSpacingMm: 600 })[0];
  expect(failed.severity).toBe('warning');
  expect(failed.evidence).toBeUndefined();
});
