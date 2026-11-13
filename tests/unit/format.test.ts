import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from '../../src/web/src/lib/format.js';

const minute = 60_000;

describe('formatRelativeTime', () => {
  it('uses Lightning list view wording', () => {
    expect(formatRelativeTime(0, 0)).toBe('a few seconds ago');
    expect(formatRelativeTime(0, 59_999)).toBe('a few seconds ago');
    expect(formatRelativeTime(0, minute)).toBe('a minute ago');
    expect(formatRelativeTime(0, 5 * minute)).toBe('5 minutes ago');
    expect(formatRelativeTime(0, 60 * minute)).toBe('an hour ago');
    expect(formatRelativeTime(0, 180 * minute)).toBe('3 hours ago');
  });

  it('treats a future timestamp as just now', () => {
    expect(formatRelativeTime(10 * minute, 0)).toBe('a few seconds ago');
  });
});
