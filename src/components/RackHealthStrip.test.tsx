import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { ValidationIssue } from '../types/rack';
import type { getRackTotals } from '../utils/validation';
import { findingIdentity } from '../utils/findingExceptions';
import { summarizeFindings } from '../utils/findingSummary';
import { countHeatIssues, RackHealthStrip } from './RackHealthStrip';

const makeTotals = (overrides: Partial<ReturnType<typeof getRackTotals>> = {}) =>
  ({
    weightKg: 0,
    powerW: 0,
    heatScore: 0,
    occupiedU: 0,
    reservedU: 0,
    usableDepthMm: 800,
    deepestMm: 0,
    depthIssues: 0,
    ...overrides,
  }) as ReturnType<typeof getRackTotals>;

const makeIssue = (id: string, title: string): ValidationIssue => ({
  id,
  severity: 'warning',
  title,
  detail: '',
});

const layout = { heightU: 24, powerBudgetW: 3000, weightLimitKg: 300 };

const chipStatus = (testId: string) => screen.getByTestId(testId).dataset.status;

describe('RackHealthStrip', () => {
  it('marks capacity good below 85%, warn from 85%, critical at 100%', () => {
    const { rerender } = render(
      <RackHealthStrip totals={makeTotals({ occupiedU: 20 })} layout={layout} issues={[]} />,
    );
    expect(chipStatus('health-chip-capacity')).toBe('good');

    rerender(<RackHealthStrip totals={makeTotals({ occupiedU: 21 })} layout={layout} issues={[]} />);
    expect(chipStatus('health-chip-capacity')).toBe('warn');

    rerender(<RackHealthStrip totals={makeTotals({ occupiedU: 24 })} layout={layout} issues={[]} />);
    expect(chipStatus('health-chip-capacity')).toBe('critical');
  });

  it('marks power good below 80%, warn from 80%, critical at 100%', () => {
    const { rerender } = render(
      <RackHealthStrip totals={makeTotals({ powerW: 2000 })} layout={layout} issues={[]} />,
    );
    expect(chipStatus('health-chip-power')).toBe('good');

    rerender(<RackHealthStrip totals={makeTotals({ powerW: 2400 })} layout={layout} issues={[]} />);
    expect(chipStatus('health-chip-power')).toBe('warn');

    rerender(<RackHealthStrip totals={makeTotals({ powerW: 3000 })} layout={layout} issues={[]} />);
    expect(chipStatus('health-chip-power')).toBe('critical');
  });

  it('marks weight good below 80%, warn from 80%, critical at 100%', () => {
    const { rerender } = render(
      <RackHealthStrip totals={makeTotals({ weightKg: 200 })} layout={layout} issues={[]} />,
    );
    expect(chipStatus('health-chip-weight')).toBe('good');

    rerender(<RackHealthStrip totals={makeTotals({ weightKg: 240 })} layout={layout} issues={[]} />);
    expect(chipStatus('health-chip-weight')).toBe('warn');

    rerender(<RackHealthStrip totals={makeTotals({ weightKg: 300 })} layout={layout} issues={[]} />);
    expect(chipStatus('health-chip-weight')).toBe('critical');
  });

  it('counts heat/airflow/thermal issues by id and title', () => {
    const issues = [
      makeIssue('heat-cluster-1', 'Devices packed tightly'),
      makeIssue('depth-1', 'Rear airflow blocked'),
      makeIssue('thermal-probe-1', 'Sensor offline'),
      makeIssue('overlap-1', 'Devices overlap'),
      makeIssue('HEAT-CAPS', 'already uppercase id matches'),
    ];
    expect(countHeatIssues(issues)).toBe(4);
  });

  it('marks heat good with no heat issues and warn with one or more', () => {
    const { rerender } = render(
      <RackHealthStrip totals={makeTotals()} layout={layout} issues={[]} />,
    );
    expect(chipStatus('health-chip-heat')).toBe('good');
    expect(screen.getByTestId('health-chip-heat')).toHaveTextContent('No reported issues');

    rerender(
      <RackHealthStrip
        totals={makeTotals()}
        layout={layout}
        issues={[makeIssue('airflow-1', 'Airflow blocked')]}
      />,
    );
    expect(chipStatus('health-chip-heat')).toBe('warn');
    expect(screen.getByTestId('health-chip-heat')).toHaveTextContent('1');
  });

  it('marks unconfigured power and weight budgets without reporting false health', () => {
    render(
      <RackHealthStrip
        totals={makeTotals({ occupiedU: 3, powerW: 500, weightKg: 40 })}
        layout={{ heightU: 0, powerBudgetW: 0, weightLimitKg: 0 }}
        issues={[]}
      />,
    );
    expect(chipStatus('health-chip-capacity')).toBe('good');
    expect(chipStatus('health-chip-power')).toBe('unconfigured');
    expect(chipStatus('health-chip-weight')).toBe('unconfigured');
    expect(screen.getByTestId('health-chip-power')).toHaveTextContent('Not configured');
    expect(screen.getByTestId('health-chip-weight')).toHaveTextContent('Not configured');
    expect(screen.getByTestId('health-chip-capacity')).toHaveTextContent('3 / 0 U');
  });

  it('formats fractional totals without floating-point noise', () => {
    render(<RackHealthStrip totals={makeTotals({ weightKg: 14.280000000000001, powerW: 629.1000000000001 })} layout={layout} issues={[]} />);
    expect(screen.getByTestId('health-chip-weight')).toHaveTextContent('14.28 / 300.00 kg');
    expect(screen.getByTestId('health-chip-power')).toHaveTextContent('629.1 / 3000 W');
  });

  it('opens the health workspace from any interactive chip', () => {
    const onOpenCheck = vi.fn();
    render(
      <RackHealthStrip
        totals={makeTotals()}
        layout={layout}
        issues={[]}
        onOpenCheck={onOpenCheck}
      />,
    );

    fireEvent.click(screen.getByTestId('health-chip-power'));
    expect(onOpenCheck).toHaveBeenLastCalledWith('power');
    fireEvent.click(screen.getByTestId('health-chip-heat'));
    expect(onOpenCheck).toHaveBeenLastCalledWith('thermal');
    fireEvent.click(screen.getByTestId('health-chip-weight'));
    expect(onOpenCheck).toHaveBeenLastCalledWith('weight');
  });
});


it('surfaces PoE failures without downgrading an overloaded rack to a warning', () => {
  const warning = makeIssue('power-poe-link-one', 'PoE power unverified');
  const { rerender } = render(<RackHealthStrip totals={makeTotals({ powerW: 10 })} layout={layout} issues={[warning]} />);
  expect(chipStatus('health-chip-power')).toBe('warn');
  rerender(<RackHealthStrip totals={makeTotals({ powerW: 10 })} layout={layout} issues={[{ ...warning, severity: 'critical', status: 'fail' }]} />);
  expect(chipStatus('health-chip-power')).toBe('critical');
  rerender(<RackHealthStrip totals={makeTotals({ powerW: 3100 })} layout={layout} issues={[warning]} />);
  expect(chipStatus('health-chip-power')).toBe('critical');
});

it('counts a thermal root once and retains unknown health after acceptance', () => {
  const issues: ValidationIssue[] = ['one', 'two'].map(id => ({ ...makeIssue(`airflow-${id}`, 'Airflow dimensions need review'), status: 'unknown', rootCauseKey: 'airflow:server', deviceIds: ['server'], cause: { field: id } }));
  const group = summarizeFindings(issues).groups[0];
  const acceptedLayout = { ...layout, findingExceptions: [{ id: 'accepted', ...findingIdentity(group.representative), reason: 'Await cabinet measurement', acceptedAt: '2026-09-30T00:00:00.000Z' }] };
  render(<RackHealthStrip totals={makeTotals()} layout={acceptedLayout} issues={issues} />);
  expect(countHeatIssues(issues)).toBe(1);
  expect(screen.getByTestId('health-chip-heat')).toHaveTextContent('1 root cause · Review');
  expect(chipStatus('health-chip-heat')).toBe('warn');
});

it('does not hide an accepted known physical conflict from capacity health', () => {
  const conflict: ValidationIssue = { ...makeIssue('width-server', 'Server too wide'), status: 'fail', severity: 'critical', deviceIds: ['server'] };
  const acceptedLayout = { ...layout, findingExceptions: [{ id: 'accepted', ...findingIdentity(conflict), reason: 'Replace before purchase', acceptedAt: '2026-09-30T00:00:00.000Z' }] };
  render(<RackHealthStrip totals={makeTotals()} layout={acceptedLayout} issues={[conflict]} />);
  expect(chipStatus('health-chip-capacity')).toBe('critical');
});
