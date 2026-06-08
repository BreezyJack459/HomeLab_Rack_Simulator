import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CleaningSchedule } from '../types/rack';
import {
  CLEANING_INTERVAL_DAYS,
  getCleaningIntervalDays,
  getNextCleaningDue,
  daysUntilCleaning,
  isCleaningOverdue,
  daysSinceCleaning,
  defaultCleaningChecklist,
  exportCleaningScheduleMarkdown,
} from './cleaningSchedule';

describe('CLEANING_INTERVAL_DAYS', () => {
  it('defines intervals for all environments', () => {
    expect(CLEANING_INTERVAL_DAYS.bedroom).toBe(90);
    expect(CLEANING_INTERVAL_DAYS.office).toBe(90);
    expect(CLEANING_INTERVAL_DAYS.closet).toBe(60);
    expect(CLEANING_INTERVAL_DAYS.garage).toBe(45);
    expect(CLEANING_INTERVAL_DAYS.basement).toBe(60);
  });
});

describe('getCleaningIntervalDays', () => {
  it('returns correct days per environment', () => {
    expect(getCleaningIntervalDays('bedroom')).toBe(90);
    expect(getCleaningIntervalDays('garage')).toBe(45);
  });
});

describe('getNextCleaningDue', () => {
  it('returns null when no last cleaned date', () => {
    expect(getNextCleaningDue(undefined, 'bedroom')).toBeNull();
  });

  it('calculates next due date from last cleaned', () => {
    const last = '2026-01-01';
    const result = getNextCleaningDue(last, 'bedroom');
    expect(result).toBe('2026-04-01'); // +90 days from Jan 1
  });

  it('uses garage interval (45 days)', () => {
    const last = '2026-01-01';
    const result = getNextCleaningDue(last, 'garage');
    expect(result).toBe('2026-02-15'); // +45 days
  });
});

describe('daysUntilCleaning', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when no last cleaned date', () => {
    expect(daysUntilCleaning(undefined, 'bedroom')).toBeNull();
  });

  it('returns positive days when cleaning is upcoming', () => {
    vi.setSystemTime(new Date('2026-01-15'));
    const last = '2026-01-01';
    const days = daysUntilCleaning(last, 'bedroom');
    expect(days).toBe(76); // 90 - 14 = 76
  });

  it('returns 1 when due tomorrow', () => {
    vi.setSystemTime(new Date('2026-03-31'));
    const last = '2026-01-01';
    const days = daysUntilCleaning(last, 'bedroom');
    expect(days).toBe(1);
  });

  it('returns negative days when overdue', () => {
    vi.setSystemTime(new Date('2026-04-15'));
    const last = '2026-01-01';
    const days = daysUntilCleaning(last, 'bedroom');
    expect(days).toBeLessThan(0);
  });
});

describe('isCleaningOverdue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false when upcoming', () => {
    vi.setSystemTime(new Date('2026-01-15'));
    expect(isCleaningOverdue('2026-01-01', 'bedroom')).toBe(false);
  });

  it('returns false when due tomorrow', () => {
    vi.setSystemTime(new Date('2026-03-31'));
    expect(isCleaningOverdue('2026-01-01', 'bedroom')).toBe(false);
  });

  it('returns true when overdue', () => {
    vi.setSystemTime(new Date('2026-05-01'));
    expect(isCleaningOverdue('2026-01-01', 'bedroom')).toBe(true);
  });

  it('returns false when never cleaned', () => {
    expect(isCleaningOverdue(undefined, 'bedroom')).toBe(false);
  });
});

describe('daysSinceCleaning', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when never cleaned', () => {
    expect(daysSinceCleaning(undefined)).toBeNull();
  });

  it('returns days since last cleaning', () => {
    vi.setSystemTime(new Date('2026-01-15'));
    expect(daysSinceCleaning('2026-01-01')).toBe(14);
  });
});

describe('defaultCleaningChecklist', () => {
  it('returns 6 checklist items', () => {
    const items = defaultCleaningChecklist();
    expect(items).toHaveLength(6);
    expect(items[0].label).toBe('Clean front dust filter');
    expect(items.every((i) => !i.checked)).toBe(true);
  });
});

describe('exportCleaningScheduleMarkdown', () => {
  it('handles missing schedule', () => {
    const md = exportCleaningScheduleMarkdown(undefined);
    expect(md).toContain('No cleaning schedule configured');
  });

  it('includes environment and interval', () => {
    const schedule: CleaningSchedule = {
      environment: 'garage',
      lastCleanedAt: '2026-01-01',
    };
    const md = exportCleaningScheduleMarkdown(schedule);
    expect(md).toContain('garage');
    expect(md).toContain('45 days');
    expect(md).toContain('2026-01-01');
    expect(md).toContain('Cleaning Checklist');
  });

  it('includes notes when present', () => {
    const schedule: CleaningSchedule = {
      environment: 'bedroom',
      lastCleanedAt: '2026-01-01',
      notes: 'Use compressed air',
    };
    const md = exportCleaningScheduleMarkdown(schedule);
    expect(md).toContain('Use compressed air');
  });
});
