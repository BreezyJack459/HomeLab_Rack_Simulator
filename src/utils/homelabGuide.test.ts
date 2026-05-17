import { describe, expect, it } from 'vitest';
import { exportReportMarkdown, generateReport } from './homelabGuide';
import type { HomelabAnswers } from './homelabGuide';

const baseAnswers: HomelabAnswers = {
  goal: 'general',
  budget: 'enthusiast',
  noise: 'low',
  room: 'office',
  existing: 'nothing',
  growth: 'incremental',
  networkKnowledge: 'intermediate',
  powerConstraint: 'ample',
};

describe('generateReport', () => {
  it('recommends 10in for hobby budget', () => {
    const report = generateReport({ ...baseAnswers, budget: 'hobby' });
    expect(report.rackType).toBe('10in');
    expect(report.rackSizeU).toBe(9);
  });

  it('recommends 19in for serious budget', () => {
    const report = generateReport({ ...baseAnswers, budget: 'serious' });
    expect(report.rackType).toBe('19in');
    expect(report.rackSizeU).toBe(24);
  });

  it('warns about bedroom noise', () => {
    const report = generateReport({ ...baseAnswers, room: 'bedroom', noise: 'low' });
    expect(report.warnings.some((w) => w.includes('Bedroom'))).toBe(true);
  });

  it('warns about full-build on hobby budget', () => {
    const report = generateReport({ ...baseAnswers, budget: 'hobby', growth: 'full-build' });
    expect(report.warnings.some((w) => w.includes('Full-build'))).toBe(true);
  });

  it('includes NAS for storage goal', () => {
    const report = generateReport({ ...baseAnswers, goal: 'nas-storage' });
    expect(report.starterDevices.some((d) => d.category === 'nas')).toBe(true);
  });

  it('includes server for kubernetes goal', () => {
    const report = generateReport({ ...baseAnswers, goal: 'kubernetes' });
    expect(report.starterDevices.some((d) => d.category === 'server')).toBe(true);
  });

  it('has 4 growth phases', () => {
    const report = generateReport(baseAnswers);
    expect(report.growthPhases.length).toBe(4);
  });

  it('provides a sample layout name', () => {
    const report = generateReport(baseAnswers);
    expect(report.sampleLayoutName).toBeTruthy();
  });
});

describe('exportReportMarkdown', () => {
  it('includes header and summary', () => {
    const report = generateReport(baseAnswers);
    const md = exportReportMarkdown(baseAnswers, report);
    expect(md).toContain('Zero-to-Homelab Guide Report');
    expect(md).toContain('Recommended Rack');
  });

  it('includes starter devices', () => {
    const report = generateReport(baseAnswers);
    const md = exportReportMarkdown(baseAnswers, report);
    expect(md).toContain('Starter Devices');
    expect(md).toContain('router');
  });

  it('includes growth phases', () => {
    const report = generateReport(baseAnswers);
    const md = exportReportMarkdown(baseAnswers, report);
    expect(md).toContain('Growth Phases');
    expect(md).toContain('Phase 1');
  });

  it('includes warnings when present', () => {
    const report = generateReport({ ...baseAnswers, room: 'bedroom', noise: 'low' });
    const md = exportReportMarkdown(baseAnswers, report);
    expect(md).toContain('Warnings');
  });
});
