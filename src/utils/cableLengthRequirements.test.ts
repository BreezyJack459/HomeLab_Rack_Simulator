import { describe, expect, it } from 'vitest';
import type { RackLayout } from '../types/rack';
import { getCableLengthRequirements, cablePurchaseLengthLabel } from './cableLengthRequirements';
import { buildRackSceneModel } from './rackSceneModel';
import { buildBom, bomLengthLabel } from './bom';
import { getProcurementChecklist } from './procurement';
import { validateRackLayout } from './validation';

const fixture = (): RackLayout => ({
  id: 'length', name: 'Length', rackType: '19in', heightU: 18, rackDepthMm: 800,
  weightLimitKg: 500, powerBudgetW: 1000, viewSide: 'rear', updatedAt: '',
  devices: [10, 6].map((positionU, i) => ({ id: i ? 'b' : 'a', name: `Server ${i}`, category: 'server', positionU,
    sizeU: 1, depthMm: 400, widthType: '19in', ports: { ethernet: 2 }, powerW: 10, weightKg: 1, heatLevel: 1, color: '#333' })),
  cables: [{ id: 'c', type: 'ethernet', fromDeviceId: 'a', toDeviceId: 'b', fromPort: { type: 'ethernet', index: 0 }, toPort: { type: 'ethernet', index: 0 }, color: '#333', lifecycleStatus: 'planned' }],
});

describe('shared purchasing length', () => {
  it('uses the longer rendered style plus slack across BOM and procurement without mutating saved lengths', () => {
    const layout = fixture();
    layout.cables[0].lengthMm = 1;
    const requirement = getCableLengthRequirements(layout).get('c')!;
    const routes = (['clean', 'realistic'] as const).map(routingMode => buildRackSceneModel(layout, { routingMode }).routes[0]);
    expect(requirement.centrelineMm).toBe(Math.max(...routes.map(route => route.renderedLengthMm!)));
    expect(requirement.requiredMm).toBe(Math.ceil(requirement.centrelineMm! + requirement.slackMm));
    expect(requirement.stockedMm).toBeGreaterThanOrEqual(requirement.requiredMm!);
    expect(bomLengthLabel(buildBom(layout)[0])).toBe(cablePurchaseLengthLabel(requirement));
    expect(getProcurementChecklist(layout).find(item => item.sourceKind === 'cable')?.unit).toBe(cablePurchaseLengthLabel(requirement));
    expect(layout.cables[0].lengthMm).toBe(1);
    const lengthIssue = validateRackLayout(layout).find(issue => issue.id === 'cable-short-c')!;
    expect(lengthIssue).toMatchObject({ ruleId: 'cable-installation-length', status: 'fail', applicability: 'active', cause: { model: 'clean-realistic-3d-estimate', declaredLengthMm: 1, requiredMm: requirement.requiredMm } });
    expect(lengthIssue.detail).toContain(`Purchase length: ${cablePurchaseLengthLabel(requirement)}`);
    expect(lengthIssue.detail).toContain('Installation estimate; verify connectors and actual routing.');
    const moved = { ...layout, devices: layout.devices.map(device => device.id === 'b' ? { ...device, positionU: 1 } : device) };
    expect(getCableLengthRequirements(moved).get('c')!.requiredMm).not.toBe(requirement.requiredMm);
  });

  it('keeps blocked and missing routes in the BOM without suggesting a length', () => {
    for (const missing of [false, true]) {
      const layout = fixture();
      if (missing) layout.devices.pop();
      else layout.devices.push({ ...layout.devices[0], id: 'overlap', mountSide: 'rear', depthMm: 800 });
      const requirement = getCableLengthRequirements(layout).get('c')!;
      expect(requirement.status).toBe('blocked');
      expect(requirement.requiredMm).toBeNull();
      expect(buildBom(layout)[0].lengthMm).toBeNull();
      expect(buildBom(layout)[0].count).toBe(1);
      expect(validateRackLayout(layout).find(issue => issue.id === 'cable-length-review-c')).toMatchObject({ status: 'unknown', applicability: 'active', evidence: 'unverified', cause: { requiredMm: null, routeStatus: 'blocked' } });
      expect(getProcurementChecklist(layout).find(item => item.sourceKind === 'cable')?.unit).toContain('Not estimated');
    }
  });

  it('requires a custom length instead of rounding down to a 10m cable', () => {
    const layout = fixture();
    layout.heightU = 400;
    layout.devices[0].positionU = 400;
    const requirement = getCableLengthRequirements(layout).get('c')!;
    expect(requirement.requiredMm).toBeGreaterThan(10000);
    expect(requirement.stockedMm).toBeNull();
    expect(requirement.status).toBe('custom-length');
    expect(bomLengthLabel(buildBom(layout)[0])).toContain('Custom length ≥');
    expect(getProcurementChecklist(layout).find(item => item.sourceKind === 'cable')?.unit).toBe(cablePurchaseLengthLabel(requirement));
  });
});
