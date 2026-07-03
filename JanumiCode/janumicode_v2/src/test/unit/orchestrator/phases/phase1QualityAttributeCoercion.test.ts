/**
 * Regression — gpt-oss:20b emits Phase 1.5 quality attributes as OBJECTS (not
 * bare strings), and `buildQaItems` does `q.slice(...)` → threw "q.slice is not
 * a function", halting P1 (cal-32). `coerceQualityAttribute` normalizes any item
 * to a display string producer-side so every consumer stays on string[].
 */
import { describe, it, expect } from 'vitest';
import { coerceQualityAttribute } from '../../../../lib/orchestrator/phases/phase1';

describe('coerceQualityAttribute — normalize QA bloom items to strings', () => {
  it('passes strings through unchanged', () => {
    expect(coerceQualityAttribute('Low latency under 200ms')).toBe('Low latency under 200ms');
  });

  it('extracts a label from the object shapes gpt-oss emits', () => {
    expect(coerceQualityAttribute({ attribute: 'Availability 99.9%' })).toBe('Availability 99.9%');
    expect(coerceQualityAttribute({ statement: 'Auditable ledger' })).toBe('Auditable ledger');
    expect(coerceQualityAttribute({ quality_attribute: 'Security' })).toBe('Security');
    // fuller text (description) preferred over a bare name when both exist
    expect(coerceQualityAttribute({ name: 'Scalability', description: 'horizontal scaling to 10k users' }))
      .toBe('horizontal scaling to 10k users');
    // name used when it's the only meaningful field
    expect(coerceQualityAttribute({ name: 'Scalability' })).toBe('Scalability');
  });

  it('falls back to JSON for unrecognized objects (never throws, never [object Object])', () => {
    const out = coerceQualityAttribute({ foo: 42 });
    expect(out).toContain('foo');
    expect(out).not.toBe('[object Object]');
  });

  it('handles null / number defensively', () => {
    expect(coerceQualityAttribute(null)).toBe('');
    expect(coerceQualityAttribute(42)).toBe('42');
  });

  it('output is ALWAYS a string with a .slice method (the exact crash contract)', () => {
    for (const x of ['s', { attribute: 'a' }, { foo: 1 }, null, 7, undefined, []]) {
      const r = coerceQualityAttribute(x);
      expect(typeof r).toBe('string');
      expect(typeof r.slice).toBe('function');
    }
  });
});
