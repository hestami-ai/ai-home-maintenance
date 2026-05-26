/**
 * Unit tests for the field-diff computation.
 *
 * The diff is the load-bearing piece of the trace layer's UX —
 * specifically the case-rename detection (snake_case vs camelCase)
 * and size_changed (silent-drop signal). Both have explicit tests
 * here because both have been actual production bugs.
 */

import { describe, it, expect } from 'vitest';
import { computeFieldDiff, fieldDiffIsEmpty } from '../../../lib/trace/fieldDiff';

describe('computeFieldDiff', () => {
  it('returns empty diff for identical objects', () => {
    const d = computeFieldDiff({ a: 1, b: 'x' }, { a: 1, b: 'x' });
    expect(fieldDiffIsEmpty(d)).toBe(true);
  });

  it('detects added top-level keys', () => {
    const d = computeFieldDiff({ a: 1 }, { a: 1, b: 2 });
    expect(d.added).toEqual(['b']);
    expect(d.removed).toBeUndefined();
  });

  it('detects removed top-level keys (the silent-drop signal)', () => {
    const d = computeFieldDiff({ a: 1, dropped: 'gone' }, { a: 1 });
    expect(d.removed).toEqual(['dropped']);
  });

  it('detects type changes', () => {
    const d = computeFieldDiff({ a: 'string' }, { a: 42 });
    expect(d.type_changed).toEqual(['a']);
  });

  it('detects size changes on top-level arrays', () => {
    const d = computeFieldDiff(
      { items: [1, 2, 3, 4] },
      { items: [] },
    );
    expect(d.size_changed).toEqual([{ field: 'items', from: 4, to: 0 }]);
  });

  it('detects snake_case → camelCase rename heuristically (matched shapes)', () => {
    // Simulates a normalizer reading wrong-cased key and writing the
    // canonical-cased one without preserving the source key.
    const d = computeFieldDiff(
      { user_stories: [{ id: 'US-1' }, { id: 'US-2' }] },
      { userStories: [{ id: 'US-1' }, { id: 'US-2' }] },
    );
    expect(d.renamed).toEqual([{ from: 'user_stories', to: 'userStories' }]);
    expect(d.added).toBeUndefined();
    expect(d.removed).toBeUndefined();
  });

  it('does not pair rename when array lengths differ', () => {
    const d = computeFieldDiff(
      { user_stories: [{ id: 'US-1' }] },
      { userStories: [{ id: 'US-1' }, { id: 'US-2' }, { id: 'US-3' }] },
    );
    // Different lengths → not paired. Surfaces as add+remove.
    expect(d.renamed).toBeUndefined();
    expect(d.added).toEqual(['userStories']);
    expect(d.removed).toEqual(['user_stories']);
  });

  it('handles non-object inputs gracefully (returns empty diff)', () => {
    expect(fieldDiffIsEmpty(computeFieldDiff(null, { a: 1 }))).toBe(true);
    expect(fieldDiffIsEmpty(computeFieldDiff({ a: 1 }, null))).toBe(true);
    expect(fieldDiffIsEmpty(computeFieldDiff('string', { a: 1 }))).toBe(true);
  });

  it('combines multiple signals on one diff', () => {
    const d = computeFieldDiff(
      { kept: 1, will_drop: [1, 2], items: [1, 2, 3] },
      { kept: 1, also_new: 'x', items: [] },
    );
    expect(d.removed).toEqual(['will_drop']);
    expect(d.added).toEqual(['also_new']);
    expect(d.size_changed).toEqual([{ field: 'items', from: 3, to: 0 }]);
  });
});
