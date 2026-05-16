import { describe, expect, it } from 'vitest';
import { exportPhotosMarkdown, summarizePhotos } from './rackPhotos';

const photos = [
  { id: 'p1', label: 'Front view', source: 'https://example.com/front.jpg', capturedAt: '2026-05-01', notes: 'Before reorganization' },
  { id: 'p2', label: 'Rear view', source: '/photos/rear.jpg' },
];

describe('summarizePhotos', () => {
  it('counts total photos', () => {
    const s = summarizePhotos(photos);
    expect(s.total).toBe(2);
  });

  it('counts photos with date', () => {
    const s = summarizePhotos(photos);
    expect(s.withDate).toBe(1);
  });

  it('counts photos with notes', () => {
    const s = summarizePhotos(photos);
    expect(s.withNotes).toBe(1);
  });
});

describe('exportPhotosMarkdown', () => {
  it('includes all photos', () => {
    const md = exportPhotosMarkdown(photos);
    expect(md).toContain('Rack Photo Log');
    expect(md).toContain('Front view');
    expect(md).toContain('Rear view');
    expect(md).toContain('Before reorganization');
  });
});
