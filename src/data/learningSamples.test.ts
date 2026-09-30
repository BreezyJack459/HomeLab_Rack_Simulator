import { describe, expect, it } from 'vitest';
import { advancedSample, beginnerSample, exerciseSample, getSampleDefinition, learningSampleLayouts, sampleDefinitions, sampleLayouts } from './sampleLayouts';
import { validateRackLayout } from '../utils/validation';
import { validateImportedLayout } from '../utils/layoutValidation';
import { summarizeFindings } from '../utils/findingSummary';
import { checkPowerRedundancy } from '../utils/powerChain';
import { getPatchPanelJacks } from '../utils/patchPanel';
import { getServiceStatus } from '../utils/serviceMap';

describe('fictional worked rack examples', () => {
  it('preserves legacy indexes and resolves all seven example definitions without a catalog dependency', () => {
    expect(sampleLayouts).toHaveLength(4);
    expect(sampleLayouts[1].id).toBe('sample-my-onhand-gear');
    expect(learningSampleLayouts).toHaveLength(3);
    expect(sampleDefinitions).toHaveLength(7);
    expect(getSampleDefinition('learn-beginner-10in')?.layout).toBe(beginnerSample);
    expect(getSampleDefinition('unknown')).toBeUndefined();
    expect(learningSampleLayouts.every(layout => layout.devices.every(device => !device.templateId))).toBe(true);
  });

  it.each([beginnerSample, advancedSample].map(layout => [layout.id, layout] as const))('%s is internally consistent under explicitly fictional assumptions', (_id, layout) => {
    const imported = validateImportedLayout(JSON.parse(JSON.stringify(layout)));
    expect(imported.valid).toBe(true);
    const summary = summarizeFindings(validateRackLayout(layout), layout);
    expect(summary.counts.confirmed).toBe(0);
    expect(summary.counts.verification).toBe(0);
    expect(layout.example).toEqual({ version: 1, sampleId: layout.id });
    for (const device of layout.devices) {
      expect(device.powerReviewed).toBe(true);
      expect(device.powerReference?.source).toContain('Fictional');
      expect(device.installationRequirements?.source).toContain('Fictional');
      for (const spec of Object.values(device.portConnectionSpecs ?? {})) expect(spec.source).toContain('Fictional');
    }
  });

  it('leaves optional idle ports neutral and makes the first goal single feed with disconnected service motion', () => {
    expect(beginnerSample.planningGoals).toEqual({ version: 1, power: 'single', remoteRecovery: 'optional', serviceMotion: 'detach-first' });
    expect(beginnerSample.cables).toHaveLength(3);
    expect(beginnerSample.devices.find(device => device.category === 'switch')?.ports?.ethernet).toBe(8);
    expect(validateRackLayout(beginnerSample).some(issue => /unused|unconnected|redundancy|cable-strain/.test(issue.id))).toBe(false);
  });

  it('traces independent A/B feeds, complete patch pairs and healthy recorded dependencies', () => {
    const redundancy = checkPowerRedundancy(advancedSample);
    expect(redundancy).toHaveLength(3);
    expect(redundancy.every(result => result.status === 'pass' && result.circuits.includes('A') && result.circuits.includes('B'))).toBe(true);
    const jacks = getPatchPanelJacks(advancedSample, 'learn-patch');
    expect(jacks.filter(jack => jack.frontCable || jack.rearCable)).toHaveLength(2);
    expect(jacks.filter(jack => jack.frontCable || jack.rearCable).every(jack => jack.state === 'patched')).toBe(true);
    expect(getServiceStatus(advancedSample.services![0], advancedSample).healthy).toBe(true);
  });

  it('contains exactly three actionable root faults, whose documented fixes restore the advanced result', () => {
    const summary = summarizeFindings(validateRackLayout(exerciseSample), exerciseSample);
    expect(summary.counts.confirmed).toBe(3);
    expect(summary.counts.verification).toBe(0);
    expect(summary.groups.filter(group => group.section === 'confirmed').map(group => group.key.split(':')[0]).sort()).toEqual(['cable-installation-length', 'power-limit', 'power-redundancy']);
    expect(getSampleDefinition(exerciseSample.id)?.steps?.map(step => step.ruleId).sort()).toEqual(['cable-installation-length', 'power-independent-ab', 'power-limit']);
    const fixed = structuredClone(exerciseSample);
    fixed.powerBudgetW = 600;
    const feed = fixed.cables.find(cable => cable.id === 'learn-server-feed-b')!;
    feed.fromDeviceId = 'learn-pdu-b'; feed.powerSourceDeviceId = 'learn-pdu-b'; feed.fromPort = { type: 'power', side: 'rear', index: 1 };
    fixed.cables.find(cable => cable.id === 'learn-server-home-run')!.lengthMm = 3000;
    expect(summarizeFindings(validateRackLayout(fixed), fixed).counts).toMatchObject({ confirmed: 0, verification: 0 });
    expect(advancedSample.powerBudgetW).toBe(600);
    expect(advancedSample.cables.find(cable => cable.id === 'learn-server-home-run')?.lengthMm).toBe(3000);
  });
});
