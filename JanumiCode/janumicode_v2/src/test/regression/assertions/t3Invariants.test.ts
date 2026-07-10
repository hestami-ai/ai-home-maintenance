/**
 * Characterization tests for checkT3Invariant — pin the CURRENT observable
 * behavior (passed flags + detail strings) for all five invariant kinds so a
 * behavior-preserving refactor can be verified. Pure function: plain
 * input/output, no DB or LLM.
 */
import { describe, it, expect } from 'vitest';

import { checkT3Invariant } from './t3Invariants.js';
import type { T3InvariantAssertion } from '../fixtureSchema.js';

const inv = (
  over: Partial<T3InvariantAssertion> & Pick<T3InvariantAssertion, 'kind'>,
): T3InvariantAssertion => ({
  name: 'rule',
  path: 'items',
  ...over,
});

describe('checkT3Invariant', () => {
  describe('missing parsed JSON', () => {
    it('fails with "no parsed JSON available" when parsed is null', () => {
      expect(
        checkT3Invariant(inv({ kind: 'array_length' }), null),
      ).toEqual({
        tier: 'T3',
        name: 'rule',
        passed: false,
        detail: 'no parsed JSON available',
      });
    });

    it('treats undefined parsed the same as null', () => {
      expect(
        checkT3Invariant(inv({ kind: 'array_length' }), undefined),
      ).toEqual({
        tier: 'T3',
        name: 'rule',
        passed: false,
        detail: 'no parsed JSON available',
      });
    });
  });

  describe('array_length', () => {
    it('counts a single resolved array and passes within default bounds', () => {
      expect(
        checkT3Invariant(inv({ kind: 'array_length', path: 'items' }), {
          items: [1, 2, 3],
        }),
      ).toEqual({ tier: 'T3', name: 'rule', passed: true, detail: undefined });
    });

    it('counts fanned-out [] elements and passes within explicit bounds', () => {
      expect(
        checkT3Invariant(
          inv({ kind: 'array_length', path: 'items[]', min: 1, max: 5 }),
          { items: [1, 2, 3] },
        ),
      ).toEqual({ tier: 'T3', name: 'rule', passed: true, detail: undefined });
    });

    it('fails below min and reports the explicit max in the detail', () => {
      expect(
        checkT3Invariant(
          inv({ kind: 'array_length', path: 'items', min: 5, max: 10 }),
          { items: [1, 2, 3] },
        ),
      ).toEqual({
        tier: 'T3',
        name: 'rule',
        passed: false,
        detail: 'length 3 outside [5, 10]',
      });
    });

    it('renders ∞ for the upper bound when max is omitted', () => {
      expect(
        checkT3Invariant(
          inv({ kind: 'array_length', path: 'items', min: 5 }),
          { items: [1, 2, 3] },
        ),
      ).toEqual({
        tier: 'T3',
        name: 'rule',
        passed: false,
        detail: 'length 3 outside [5, ∞]',
      });
    });
  });

  describe('forbidden_value_pattern', () => {
    it('fails with "pattern not provided" when no pattern is set', () => {
      expect(
        checkT3Invariant(inv({ kind: 'forbidden_value_pattern', path: 'items' }), {}),
      ).toEqual({
        tier: 'T3',
        name: 'rule',
        passed: false,
        detail: 'pattern not provided',
      });
    });

    it('passes when no string value matches the pattern', () => {
      expect(
        checkT3Invariant(
          inv({ kind: 'forbidden_value_pattern', path: 'tags[]', pattern: 'z' }),
          { tags: ['a', 'b'] },
        ),
      ).toEqual({ tier: 'T3', name: 'rule', passed: true, detail: undefined });
    });

    it('fails listing the first three matching values', () => {
      expect(
        checkT3Invariant(
          inv({ kind: 'forbidden_value_pattern', path: 'tags[]', pattern: 'm' }),
          { tags: ['m1', 'm2', 'm3', 'm4'] },
        ),
      ).toEqual({
        tier: 'T3',
        name: 'rule',
        passed: false,
        detail: '4 forbidden value(s); first: m1, m2, m3',
      });
    });
  });

  describe('required_value_pattern', () => {
    it('fails with "pattern not provided" when no pattern is set', () => {
      expect(
        checkT3Invariant(inv({ kind: 'required_value_pattern', path: 'items' }), {}),
      ).toEqual({
        tier: 'T3',
        name: 'rule',
        passed: false,
        detail: 'pattern not provided',
      });
    });

    it('fails with "path resolved to no values" when nothing resolves', () => {
      expect(
        checkT3Invariant(
          inv({ kind: 'required_value_pattern', path: 'missing[]', pattern: 'x' }),
          {},
        ),
      ).toEqual({
        tier: 'T3',
        name: 'rule',
        passed: false,
        detail: 'path resolved to no values',
      });
    });

    it('passes when every value matches and there is at least one', () => {
      expect(
        checkT3Invariant(
          inv({ kind: 'required_value_pattern', path: 'ids[]', pattern: '^AC-' }),
          { ids: ['AC-1', 'AC-2'] },
        ),
      ).toEqual({ tier: 'T3', name: 'rule', passed: true, detail: undefined });
    });

    it('fails counting non-matching and non-string values with a ratio detail', () => {
      expect(
        checkT3Invariant(
          inv({ kind: 'required_value_pattern', path: 'ids[]', pattern: '^AC-' }),
          { ids: ['AC-1', 'X-2', 5] },
        ),
      ).toEqual({
        tier: 'T3',
        name: 'rule',
        passed: false,
        detail: '2/3 value(s) do not match ^AC-; first: X-2, 5',
      });
    });
  });

  describe('enum_subset', () => {
    it('passes when every value is in the allowed set', () => {
      expect(
        checkT3Invariant(
          inv({
            kind: 'enum_subset',
            path: 'status[]',
            allowed: ['open', 'closed', 'pending'],
          }),
          { status: ['open', 'closed'] },
        ),
      ).toEqual({ tier: 'T3', name: 'rule', passed: true, detail: undefined });
    });

    it('coerces non-strings and fails listing out-of-enum values', () => {
      expect(
        checkT3Invariant(
          inv({ kind: 'enum_subset', path: 'status[]', allowed: ['open'] }),
          { status: ['open', 'weird', 3] },
        ),
      ).toEqual({
        tier: 'T3',
        name: 'rule',
        passed: false,
        detail: '2 out-of-enum value(s); first: weird, 3',
      });
    });

    it('treats an absent allowed list as an empty set', () => {
      expect(
        checkT3Invariant(inv({ kind: 'enum_subset', path: 'status[]' }), {
          status: ['open'],
        }),
      ).toEqual({
        tier: 'T3',
        name: 'rule',
        passed: false,
        detail: '1 out-of-enum value(s); first: open',
      });
    });
  });

  describe('unique_values', () => {
    it('passes when all values are unique', () => {
      expect(
        checkT3Invariant(inv({ kind: 'unique_values', path: 'ids[]' }), {
          ids: ['a', 'b', 'c'],
        }),
      ).toEqual({ tier: 'T3', name: 'rule', passed: true, detail: undefined });
    });

    it('fails counting each repeated string occurrence', () => {
      expect(
        checkT3Invariant(inv({ kind: 'unique_values', path: 'ids[]' }), {
          ids: ['a', 'b', 'a', 'a'],
        }),
      ).toEqual({
        tier: 'T3',
        name: 'rule',
        passed: false,
        detail: '2 duplicate(s); first: a, a',
      });
    });

    it('JSON-stringifies non-string values for duplicate detection', () => {
      expect(
        checkT3Invariant(inv({ kind: 'unique_values', path: 'objs[]' }), {
          objs: [{ x: 1 }, { x: 1 }],
        }),
      ).toEqual({
        tier: 'T3',
        name: 'rule',
        passed: false,
        detail: '1 duplicate(s); first: {"x":1}',
      });
    });
  });
});
