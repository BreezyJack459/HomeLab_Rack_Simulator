import { expect, it } from 'vitest';
import type { ValidationIssue } from '../types/rack';
import { issueGroupTitle, propertyTargetForIssue } from './checkWorkflow';

const issue = (id: string, patch: Partial<ValidationIssue> = {}): ValidationIssue => ({ id, severity: 'warning', title: 'Device warning', detail: 'Review device', ...patch });

it('routes depth and missing installation hardware to their actual edit fields', () => {
  expect(propertyTargetForIssue(issue('depth-server'))).toEqual({ section: 'Dimensions & placement', field: 'Depth mm' });
  expect(propertyTargetForIssue(issue('installation-kit-server'))).toEqual({ section: 'Installation requirements', field: 'Installed mounting kit / shelf model' });
  expect(propertyTargetForIssue(issue('power-capacity-unknown-ups'))?.field).toBe('Rated output capacity (W)');
  expect(propertyTargetForIssue(issue('power-poe-budget-switch'))?.section).toBe('Socket specifications');
});

it('leaves unrelated issues unmapped even when a device title mentions depth', () => {
  expect(propertyTargetForIssue(issue('custom-rule', { title: 'depth-server is missing' }))).toBeUndefined();
});

it('groups only explicitly unverified evidence and keeps failed checks distinct', () => {
  expect(issueGroupTitle(issue('installation-rails-a', { evidence: 'unverified' }))).toBe('Rail fit needs verification');
  expect(issueGroupTitle(issue('installation-rails-b'))).toBe('Device warning');
  expect(issueGroupTitle(issue('cable-length-review-a', { evidence: 'unverified' }))).toBe('Cable length needs review');
  expect(issueGroupTitle(issue('cable-strain-a-server', { evidence: 'unverified' }))).toBe('Service cable length needs review');
  expect(issueGroupTitle(issue('cable-strain-b-server'))).toBe('Device warning');
  expect(issueGroupTitle(issue('cable-short-a', { title: 'Cable A is too short' }))).toBe('Cable A is too short');
});
