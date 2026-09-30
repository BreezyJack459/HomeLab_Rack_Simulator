import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { RackLayout } from '../types/rack';
import { GoldenBaselinePanel } from './GoldenBaselinePanel';
import { captureGoldenBaseline, getBaselineMetrics } from '../utils/baseline';
import { validateRackLayout } from '../utils/validation';
import { useRackStore } from '../store/rackStore';
import { findingIdentity } from '../utils/findingExceptions';

const rack = (): RackLayout => ({
  id: 'baseline-rack', name: 'Baseline rack', rackType: '19in', heightU: 12,
  rackDepthMm: 600, weightLimitKg: 200, powerBudgetW: 1200, viewSide: 'front', updatedAt: '2026-09-30T00:00:00Z',
  devices: [{ id: 'server-a', category: 'server', name: 'Server', positionU: 1, sizeU: 1, depthMm: 400,
    widthType: '19in', weightKg: 5, powerW: 100, heatLevel: 2, ports: { power: 2 }, color: '#888888' }],
  cables: [], planningGoals: { version: 1, power: 'independent-ab', remoteRecovery: 'optional', serviceMotion: 'detach-first' },
});

beforeEach(() => {
  localStorage.clear();
  const layout = rack();
  useRackStore.setState({ persistenceBlocked: false, persistenceError: null, recoverySource: null });
  useRackStore.getState().setWorkspace({ id: 'ws-baseline', name: 'Baseline lab', racks: [layout], interRackCables: [], updatedAt: layout.updatedAt });
});

describe('baseline planning goal preservation', () => {
  it('captures the explicit goal before calculating validation metrics', () => {
    const current = rack();
    expect(validateRackLayout(current).some(issue => issue.ruleId === 'power-independent-ab')).toBe(true);
    const baseline = captureGoldenBaseline(current);
    expect(baseline.snapshot.planningGoals).toEqual(current.planningGoals);
    expect(baseline.snapshot.planningGoals).not.toBe(current.planningGoals);
    expect(baseline.metrics.validationIssues).toBe(getBaselineMetrics(current).validationIssues);
    expect(baseline.metrics.riskScore).toBe(getBaselineMetrics(current).riskScore);
  });

  it('opens a baseline copy with the same requirements and a fresh acceptance review', () => {
    const current = useRackStore.getState().layout;
    const issue = validateRackLayout(current).find(item => item.ruleId === 'power-independent-ab')!;
    useRackStore.getState().acceptFindingException(findingIdentity(issue), 'Original review');
    const acceptedOriginal = useRackStore.getState().layout;
    useRackStore.getState().updateRack({ goldenBaseline: captureGoldenBaseline(acceptedOriginal) });
    render(<GoldenBaselinePanel />);
    fireEvent.click(screen.getByRole('button', { name: /open baseline copy/i }));
    const copy = useRackStore.getState().layout;
    expect(copy.id).not.toBe(current.id);
    expect(copy.planningGoals).toEqual(current.planningGoals);
    expect(copy.findingExceptions).toEqual([]);
    expect(acceptedOriginal.findingExceptions).toHaveLength(1);
    expect(validateRackLayout(copy).some(item => item.ruleId === 'power-independent-ab')).toBe(true);
  });
});
