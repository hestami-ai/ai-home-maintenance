/**
 * Smoke tests for traceNormalize. Verifies that the wrapper is a
 * transparent pass-through (returns output unchanged) regardless of
 * whether the trace layer is configured. Field-diff correctness is
 * covered separately in fieldDiff.test.ts.
 */

import { describe, it, expect } from 'vitest';
import { traceNormalize, traceNormalizeFn } from '../../../lib/trace/traceNormalize';

describe('traceNormalize', () => {
  it('returns the output unchanged (pass-through, trace disabled)', () => {
    const input = { user_stories: [1, 2, 3] };
    const output = { userStories: [1, 2, 3] };
    const result = traceNormalize('test', input, output);
    expect(result).toBe(output);
  });

  it('handles primitives without throwing', () => {
    expect(traceNormalize('test', 1, 2)).toBe(2);
    expect(traceNormalize('test', 'a', 'b')).toBe('b');
  });
});

describe('traceNormalizeFn', () => {
  it('invokes the normalizer and returns its output', () => {
    const result = traceNormalizeFn(
      'test',
      { a: 1 },
      (i) => ({ a: i.a + 1 }),
    );
    expect(result).toEqual({ a: 2 });
  });

  it('re-throws if the normalizer throws', () => {
    expect(() =>
      traceNormalizeFn('test', { a: 1 }, () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
  });
});
