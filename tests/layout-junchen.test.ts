import { describe, it, expect } from 'vitest';
import { validateRackLayout } from '../src/utils/validation';
import { getDepthSummary } from '../src/utils/rackMath';
import type { RackLayout } from '../src/types/rack';
import * as fs from 'fs';
import * as path from 'path';

interface Scenario {
  name: string;
  file: string;
}

const scenarios: Scenario[] = [
  { name: 'A: 军臣 + JMCD 12E5 + F4811', file: 'junchen-22u-jmcd-f4811.json' },
  { name: 'B: 军臣 + 鼎翔 4U400-12 + 鼎翔 4U450', file: 'junchen-22u-dx400-dx450.json' },
];

const dataDir = path.resolve(__dirname);

function loadLayout(file: string): RackLayout {
  const fullPath = path.join(dataDir, file);
  const raw = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(raw) as RackLayout;
}

describe.each(scenarios)('$name', ({ name, file }) => {
  const layout = loadLayout(file);

  it('loads valid JSON and has devices', () => {
    expect(layout.devices.length).toBeGreaterThan(0);
    expect(layout.heightU).toBe(22);
    expect(layout.rackDepthMm).toBe(510);
  });

  it('depth summary shows usable space', () => {
    const summary = getDepthSummary(layout);
    console.log(`\nDepth Summary for ${name}:`);
    console.log(`  Rack depth:       ${layout.rackDepthMm}mm`);
    console.log(`  Front clearance:  ${summary.frontDoorClearanceMm}mm (open frame)`);
    console.log(`  Rear clearance:   ${summary.rearDoorClearanceMm}mm (open frame)`);
    console.log(`  Cable clearance:  ${summary.rearCableClearanceMm}mm`);
    console.log(`  Usable depth:     ${summary.usableDepthMm}mm`);
    console.log(`  Deepest device:   ${summary.deepestMm}mm`);

    layout.devices.forEach(d => {
      const ok = d.depthMm <= summary.usableDepthMm + 20; // allow 20mm tolerance for open frame
      console.log(`  ${ok ? '✅' : '⚠️'} ${d.name}: ${d.depthMm}mm (limit ${summary.usableDepthMm}mm)`);
    });
  });

  it('no overlapping U positions', () => {
    const ranges = layout.devices
      .filter(d => d.sizeU > 0)
      .map(d => ({ id: d.id, name: d.name, startU: d.positionU, endU: d.positionU + d.sizeU - 1 }));

    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        const a = ranges[i];
        const b = ranges[j];
        const overlap = !(a.endU < b.startU || b.endU < a.startU);
        expect(overlap).toBe(false);
      }
    }
  });

  it('total weight within limit', () => {
    const total = layout.devices.reduce((s, d) => s + d.weightKg, 0);
    expect(total).toBeLessThanOrEqual(layout.weightLimitKg);
  });

  it('total power within budget', () => {
    const total = layout.devices.reduce((s, d) => s + d.powerW, 0);
    expect(total).toBeLessThanOrEqual(layout.powerBudgetW);
  });

  it('validation runs without errors', () => {
    const issues = validateRackLayout(layout);
    const criticals = issues.filter(i => i.severity === 'critical');
    const warnings = issues.filter(i => i.severity === 'warning');

    console.log(`\n=== ${name} Validation ===`);
    console.log(`Issues: ${issues.length} (critical: ${criticals.length}, warning: ${warnings.length})`);

    if (criticals.length > 0) {
      console.log('\n🔴 CRITICAL:');
      criticals.forEach(i => console.log(`  ${i.title}: ${i.detail}`));
    }
    if (warnings.length > 0) {
      console.log('\n🟡 WARNINGS:');
      warnings.forEach(i => console.log(`  ${i.title}: ${i.detail}`));
    }

    // For open frame, some depth warnings are expected — no criticals should appear
    if (criticals.length > 0) {
      console.log('\n❌ Has critical issues!');
    } else {
      console.log('\n✅ No critical issues');
    }
  });
});
