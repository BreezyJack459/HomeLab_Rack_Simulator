import { beforeEach, describe, expect, it } from 'vitest';
import type { RackLayout, ValidationIssue, Workspace } from '../types/rack';
import { useRackStore, normalizeWorkspace } from './rackStore';
import { parseWorkspaceJson } from '../utils/exporters';
import { validateImportedLayout } from '../utils/layoutValidation';
import { findingIdentity, getFindingAcceptance } from '../utils/findingExceptions';
import { getPlanningGoals } from '../utils/planningGoals';
import { sampleLayouts } from '../data/sampleLayouts';
import { captureGoldenBaseline } from '../utils/baseline';

const storageKey = 'homelab-rack-simulator-workspace';
const layout = (): RackLayout => ({
  id: 'legacy-rack', name: 'Legacy rack', rackType: '19in', heightU: 12, rackDepthMm: 600,
  weightLimitKg: 200, powerBudgetW: 1200, viewSide: 'front', devices: [], cables: [], updatedAt: '2026-09-01T00:00:00.000Z',
});
const workspace = (rack: RackLayout): Workspace => ({
  id: 'ws-review', name: 'Review lab', racks: [rack], interRackCables: [], updatedAt: rack.updatedAt,
});
const issue = (requiredMm = 500): ValidationIssue => ({
  id: 'service-motion-cable-a', ruleId: 'service-motion', rootCauseKey: 'service-motion:cable-a',
  title: 'Cable travel needs review', detail: 'Review extension', severity: 'warning',
  status: 'unknown', applicability: 'active', cableIds: ['cable-a'], cause: { requiredMm },
});

beforeEach(() => {
  localStorage.clear();
  useRackStore.setState({ persistenceBlocked: false, persistenceError: null, recoverySource: null });
  useRackStore.getState().setWorkspace(workspace(layout()));
});

describe('finding review persistence and additive migration', () => {
  it('resolves neutral legacy goals without populating them or changing policies/evidence', () => {
    const legacy = { ...layout(), policies: [{ id: 'policy-original', enabled: false, type: 'dual-psu-circuit-split', severity: 'warning', params: { threshold: 20 } }],
      evidenceRecords: [{ id: 'evidence-original', entityType: 'rack', entityId: 'legacy-rack', type: 'install-photo', title: 'Original record', source: 'owned photo' }],
      customExtension: { original: true },
    } as RackLayout;
    const normalized = normalizeWorkspace(workspace(legacy));
    const restored = parseWorkspaceJson(JSON.stringify(normalized));
    expect(getPlanningGoals(restored.racks[0])).toEqual({ version: 1, power: 'unspecified', remoteRecovery: 'optional', serviceMotion: 'unspecified' });
    expect(restored.racks[0]).not.toHaveProperty('planningGoals');
    expect(restored.racks[0]).not.toHaveProperty('findingReviewVersion');
    expect(restored.racks[0].policies).toEqual(legacy.policies);
    expect(restored.racks[0].evidenceRecords).toEqual(legacy.evidenceRecords);
    expect(restored.racks[0]).toHaveProperty('customExtension.original', true);
  });

  it('normalizes explicitly imported partial goals only and preserves new extension fields', () => {
    const imported = { ...layout(), planningGoals: { version: 1, power: 'single', extension: 'keep' } } as unknown as RackLayout;
    const result = parseWorkspaceJson(JSON.stringify(workspace(imported))).racks[0];
    expect(result.planningGoals).toEqual({ version: 1, power: 'single', remoteRecovery: 'optional', serviceMotion: 'unspecified', extension: 'keep' });
    expect(getPlanningGoals(result, { planningGoals: { version: 1, remoteRecovery: 'required' } } as never).power).toBe('single');
  });

  it('roundtrips device overrides and existing reviews without enabling a rack goal', () => {
    const device = { ...sampleLayouts[1].devices[0], powerReviewed: true,
      planningGoals: { version: 1 as const, remoteRecovery: 'required' as const },
    };
    const result = parseWorkspaceJson(JSON.stringify(workspace({ ...layout(), devices: [device] }))).racks[0];
    expect(result).not.toHaveProperty('planningGoals');
    expect(result.devices[0].planningGoals).toEqual(device.planningGoals);
    expect(result.devices[0].powerReviewed).toBe(true);
    expect(getPlanningGoals(result, result.devices[0]).remoteRecovery).toBe('required');
    expect(getPlanningGoals(result, result.devices[0]).power).toBe('unspecified');
  });

  it.each([
    ['devices[0].planningGoals.version', { version: 0 }],
    ['devices[0].planningGoals.power', { version: 1, power: 'redundant' }],
    ['devices[0].planningGoals.remoteRecovery', { version: 1, remoteRecovery: null }],
  ])('rejects malformed device override %s', (field, goals) => {
    const invalid = { ...layout(), devices: [{ ...sampleLayouts[1].devices[0], planningGoals: goals }] };
    const result = validateImportedLayout(invalid);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.join(';')).toContain(field);
    expect(() => parseWorkspaceJson(JSON.stringify(workspace(invalid as never)))).toThrow(field);
  });

  it('retains valid nested baseline goals, device overrides and unknown snapshot fields', () => {
    const current = { ...layout(), planningGoals: { version: 1 as const, power: 'single' as const, remoteRecovery: 'optional' as const, serviceMotion: 'detach-first' as const },
      devices: [{ ...sampleLayouts[1].devices[0], planningGoals: { version: 1 as const, remoteRecovery: 'required' as const } }],
    };
    const baseline = captureGoldenBaseline(current);
    const imported = { ...current, goldenBaseline: { ...baseline, snapshot: { ...baseline.snapshot, customExtension: { original: true } } } };
    const restored = parseWorkspaceJson(JSON.stringify(workspace(imported))).racks[0];
    expect(restored.goldenBaseline?.snapshot.planningGoals).toEqual(current.planningGoals);
    expect(restored.goldenBaseline?.snapshot.devices[0].planningGoals).toEqual(current.devices[0].planningGoals);
    expect(restored.goldenBaseline?.snapshot).toHaveProperty('customExtension.original', true);
  });

  it.each([
    ['goldenBaseline.snapshot.planningGoals.version', { planningGoals: { version: 2 } }],
    ['goldenBaseline.snapshot.devices[0].planningGoals.version', { devices: [{ planningGoals: { version: 2 } }] }],
    ['goldenBaseline.snapshot.unplacedDevices[0].planningGoals.power', { unplacedDevices: [{ planningGoals: { version: 1, power: 'bad' } }] }],
  ])('rejects malformed new baseline field %s before it can be opened', (field, patch) => {
    const baseline = captureGoldenBaseline(layout());
    const invalid = { ...layout(), goldenBaseline: { ...baseline, snapshot: { ...baseline.snapshot, ...patch } } };
    expect(() => parseWorkspaceJson(JSON.stringify(workspace(invalid as never)))).toThrow(field);
    const before = useRackStore.getState().layout;
    const raw = JSON.stringify(workspace(invalid as never));
    localStorage.setItem(storageKey, raw);
    expect(useRackStore.getState().loadWorkspace()).toBe(false);
    expect(useRackStore.getState().layout).toBe(before);
    expect(useRackStore.getState().recoverySource).toBe(raw);
  });

  it('names the inventory collection in malformed unplaced device override errors', () => {
    const invalid = { ...layout(), unplacedDevices: [{ ...sampleLayouts[1].devices[0], planningGoals: { version: 2 } }] };
    expect(() => parseWorkspaceJson(JSON.stringify(workspace(invalid as never)))).toThrow('unplacedDevices[0].planningGoals.version');
  });

  it('requires a reason and saves acceptance with undo/redo and reload support', () => {
    const identity = findingIdentity(issue());
    expect(useRackStore.getState().acceptFindingException(identity, '  ')).toBe(false);
    expect(useRackStore.getState().layout.findingExceptions).toBeUndefined();
    expect(useRackStore.getState().acceptFindingException(identity, ' Cable detached before maintenance ')).toBe(true);
    const exception = useRackStore.getState().layout.findingExceptions![0];
    expect(exception.reason).toBe('Cable detached before maintenance');
    expect(useRackStore.getState().layout.findingReviewVersion).toBe(1);
    expect(getFindingAcceptance(useRackStore.getState().layout, identity).state).toBe('accepted');
    useRackStore.getState().undo();
    expect(getFindingAcceptance(useRackStore.getState().layout, identity).state).toBe('open');
    useRackStore.getState().redo();
    useRackStore.getState().saveLocal();
    expect(useRackStore.getState().loadWorkspace()).toBe(true);
    expect(useRackStore.getState().layout.findingExceptions).toEqual([exception]);
  });

  it('preserves acceptance on unrelated edits and reopens changed scoped evidence', () => {
    const identity = findingIdentity(issue());
    useRackStore.getState().acceptFindingException(identity, 'Maintenance procedure verified');
    useRackStore.getState().updateRack({ name: 'A display name change', rearClearanceMm: 400 });
    const current = useRackStore.getState().layout;
    expect(getFindingAcceptance(current, identity).state).toBe('accepted');
    expect(getFindingAcceptance(current, findingIdentity(issue(800))).state).toBe('reopened');
    expect(current.findingExceptions).toHaveLength(1);
    useRackStore.getState().reopenFindingException(current.findingExceptions![0].id);
    expect(getFindingAcceptance(useRackStore.getState().layout, identity).state).toBe('open');
  });

  it('updates only the same scope acceptance and leaves other reasons intact', () => {
    const first = findingIdentity(issue());
    const second = { ...first, targetKey: 'service-motion:cable-b' };
    useRackStore.getState().acceptFindingException(first, 'First reason');
    useRackStore.getState().acceptFindingException(second, 'Second reason');
    useRackStore.getState().acceptFindingException(findingIdentity(issue(800)), 'Updated relevant evidence');
    expect(useRackStore.getState().layout.findingExceptions).toHaveLength(2);
    expect(getFindingAcceptance(useRackStore.getState().layout, second).exception?.reason).toBe('Second reason');
  });

  it('duplicates goals while requiring fresh exception review for the copied rack', () => {
    useRackStore.getState().updateRack({ planningGoals: { version: 1, power: 'single', remoteRecovery: 'optional', serviceMotion: 'detach-first' } });
    useRackStore.getState().acceptFindingException(findingIdentity(issue()), 'Original scope accepted');
    const original = useRackStore.getState().layout;
    useRackStore.getState().duplicateRack(original.id, 'Copied rack');
    const current = useRackStore.getState();
    expect(current.layout.planningGoals).toEqual(original.planningGoals);
    expect(current.layout.findingExceptions).toEqual([]);
    expect(current.workspace.racks.find(rack => rack.id === original.id)?.findingExceptions).toEqual(original.findingExceptions);
    expect(parseWorkspaceJson(JSON.stringify(current.workspace)).racks).toHaveLength(2);
  });

  it.each([
    ['planningGoals.version', { planningGoals: { version: 2 } }],
    ['planningGoals.power', { planningGoals: { version: 1, power: 'enabled' } }],
    ['planningGoals.remoteRecovery', { planningGoals: { version: 1, remoteRecovery: true } }],
    ['planningGoals.serviceMotion', { planningGoals: { version: 1, serviceMotion: 'always' } }],
    ['findingReviewVersion', { findingReviewVersion: 2 }],
    ['findingExceptions', { findingExceptions: 'skip' }],
    ['findingExceptions[0].reason', { findingExceptions: [{ ...findingIdentity(issue()), id: 'exception', reason: '', acceptedAt: '2026-09-30T00:00:00Z' }] }],
    ['findingExceptions[0].fingerprint', { findingExceptions: [{ ...findingIdentity(issue()), id: 'exception', reason: 'Checked', fingerprint: 4, acceptedAt: '2026-09-30T00:00:00Z' }] }],
    ['findingExceptions[0].acceptedAt', { findingExceptions: [{ ...findingIdentity(issue()), id: 'exception', reason: 'Checked', acceptedAt: 'yesterday' }] }],
  ])('rejects malformed %s actionably and protects the existing workspace', (field, patch) => {
    const before = useRackStore.getState().layout;
    const invalid = { ...layout(), ...patch };
    const validation = validateImportedLayout(invalid);
    expect(validation.valid).toBe(false);
    if (!validation.valid) expect(validation.errors.join(';')).toContain(field);
    expect(() => parseWorkspaceJson(JSON.stringify(workspace(invalid as never)))).toThrow(field);
    const raw = JSON.stringify(workspace(invalid as never));
    localStorage.setItem(storageKey, raw);
    expect(useRackStore.getState().loadWorkspace()).toBe(false);
    expect(useRackStore.getState().layout).toBe(before);
    expect(useRackStore.getState().recoverySource).toBe(raw);
    useRackStore.getState().saveLocal();
    expect(localStorage.getItem(storageKey)).toBe(raw);
  });
});
