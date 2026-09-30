import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { SampleDefinition } from '../data/learningSamples';
import type { RackLayout } from '../types/rack';
import { SamplePicker } from './SamplePicker';
import { ExampleGuide } from './ExampleGuide';

afterEach(cleanup);
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
});
const definition = (id: string, kind: SampleDefinition['kind']): SampleDefinition => ({
  kind, title: id, titleZh: '示例', description: 'An illustrative example', descriptionZh: '示範用途', audience: 'Learning planners',
  outcomes: ['Check fitted rack geometry'], assumptions: ['Fictional measurements must be verified'],
  layout: { id, rackType: '19in', heightU: 12, devices: [], cables: [] } as unknown as RackLayout,
  ...(kind === 'exercise' ? { steps: [{ ruleId: 'width', title: 'Repair the known width conflict', remedy: 'Choose an appropriately sized fictional component' }] } : {}),
});
const definitions = [definition('beginner', 'beginner'), definition('advanced', 'advanced'), definition('exercise', 'exercise'), ...[1, 2, 3, 4].map(id => definition(`legacy${id}`, 'legacy'))];

it('prioritizes three learning cards and retains four legacy choices in an expandable section', () => {
  const onSelect = vi.fn();
  render(<SamplePicker definitions={definitions} onSelect={onSelect} onClose={vi.fn()} />);
  const dialog = screen.getByRole('dialog', { name: 'Load sample layout' });
  expect(within(dialog).getByRole('button', { name: 'Load beginner' })).toBeVisible();
  expect(within(dialog).getByRole('button', { name: 'Load exercise' })).toBeVisible();
  expect(within(dialog).getByText('INTENTIONAL FAULTS · 故意設置問題')).toBeVisible();
  expect(within(dialog).getByText('Legacy examples / 原有示例 (4)')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Load legacy1', hidden: true })).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Load advanced' }));
  expect(onSelect).toHaveBeenCalledWith('advanced');
});

it('closes without selecting on Close or native cancel', () => {
  const onClose = vi.fn(); const onSelect = vi.fn();
  render(<SamplePicker definitions={definitions} onSelect={onSelect} onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false, cancelable: true }));
  expect(onClose).toHaveBeenCalledTimes(2);
  expect(onSelect).not.toHaveBeenCalled();
});

it('keeps fictional assumptions and exercise remedies inspectable without a physical-fit promise', () => {
  render(<ExampleGuide sample={definitions[2]} />);
  expect(screen.getByRole('complementary', { name: 'Example learning guide' })).toBeInTheDocument();
  expect(screen.getByText('INTENTIONAL FAULTS · 故意設置問題')).toBeVisible();
  expect(screen.getByText('Fictional measurements must be verified')).toBeInTheDocument();
  expect(screen.getByText('Choose an appropriately sized fictional component')).toBeInTheDocument();
  expect(screen.getByText(/Missing evidence remains unverified in Check/)).toBeInTheDocument();
});
