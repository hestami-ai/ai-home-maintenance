/**
 * Characterization tests for the minimal JSONPath evaluator.
 *
 * These pin the CURRENT observable behavior of parseJsonPath /
 * evalJsonPath / evalJsonPathDetailed / typeCheck / describeType before the
 * cognitive-complexity refactor of evalJsonPathDetailed. Assertions are
 * derived from the original traversal semantics (prop/array segments,
 * empty-array flag, missing-key skipping), independent of the refactor.
 */
import { describe, it, expect } from 'vitest';
import {
  parseJsonPath,
  evalJsonPath,
  evalJsonPathDetailed,
  typeCheck,
  describeType,
} from './jsonPath.js';

describe('parseJsonPath', () => {
  it('parses a simple property', () => {
    expect(parseJsonPath('a')).toEqual([{ kind: 'prop', name: 'a' }]);
  });

  it('parses nested properties', () => {
    expect(parseJsonPath('a.b')).toEqual([
      { kind: 'prop', name: 'a' },
      { kind: 'prop', name: 'b' },
    ]);
  });

  it('parses a property followed by an array marker', () => {
    expect(parseJsonPath('a[]')).toEqual([
      { kind: 'prop', name: 'a' },
      { kind: 'array' },
    ]);
  });

  it('parses an array of objects drilling into a subkey', () => {
    expect(parseJsonPath('a[].b')).toEqual([
      { kind: 'prop', name: 'a' },
      { kind: 'array' },
      { kind: 'prop', name: 'b' },
    ]);
  });

  it('parses nested array markers as multiple array segments', () => {
    expect(parseJsonPath('a[][]')).toEqual([
      { kind: 'prop', name: 'a' },
      { kind: 'array' },
      { kind: 'array' },
    ]);
  });

  it('skips empty tokens (leading/trailing/double dots)', () => {
    expect(parseJsonPath('')).toEqual([]);
    expect(parseJsonPath('a..b')).toEqual([
      { kind: 'prop', name: 'a' },
      { kind: 'prop', name: 'b' },
    ]);
  });
});

describe('evalJsonPathDetailed', () => {
  it('returns the root itself for an empty path', () => {
    const root = { a: 1 };
    expect(evalJsonPathDetailed(root, '')).toEqual({
      values: [root],
      traversedEmptyArray: false,
    });
  });

  it('resolves a simple property', () => {
    expect(evalJsonPathDetailed({ a: 1 }, 'a')).toEqual({
      values: [1],
      traversedEmptyArray: false,
    });
  });

  it('resolves a nested property', () => {
    expect(evalJsonPathDetailed({ a: { b: 2 } }, 'a.b')).toEqual({
      values: [2],
      traversedEmptyArray: false,
    });
  });

  it('returns no values when a top-level key is missing', () => {
    expect(evalJsonPathDetailed({ a: 1 }, 'x')).toEqual({
      values: [],
      traversedEmptyArray: false,
    });
  });

  it('returns no values when an intermediate key is missing', () => {
    expect(evalJsonPathDetailed({ a: { b: 2 } }, 'a.x')).toEqual({
      values: [],
      traversedEmptyArray: false,
    });
  });

  it('flattens array element values', () => {
    expect(evalJsonPathDetailed({ a: [1, 2, 3] }, 'a[]')).toEqual({
      values: [1, 2, 3],
      traversedEmptyArray: false,
    });
  });

  it('flags an empty array traversal with no values', () => {
    expect(evalJsonPathDetailed({ a: [] }, 'a[]')).toEqual({
      values: [],
      traversedEmptyArray: true,
    });
  });

  it('drills into each element of an array of objects', () => {
    expect(evalJsonPathDetailed({ a: [{ b: 1 }, { b: 2 }] }, 'a[].b')).toEqual({
      values: [1, 2],
      traversedEmptyArray: false,
    });
  });

  it('flags empty array even when a later subkey segment follows', () => {
    expect(evalJsonPathDetailed({ a: [] }, 'a[].b')).toEqual({
      values: [],
      traversedEmptyArray: true,
    });
  });

  it('keeps the empty-array flag set once any array in a segment is empty', () => {
    expect(
      evalJsonPathDetailed({ a: [{ b: [] }, { b: [9] }] }, 'a[].b[]'),
    ).toEqual({ values: [9], traversedEmptyArray: true });
  });

  it('flattens doubly-nested arrays', () => {
    expect(evalJsonPathDetailed({ a: [[1], [2, 3]] }, 'a[][]')).toEqual({
      values: [1, 2, 3],
      traversedEmptyArray: false,
    });
  });

  it('drops values when a prop segment lands on an array', () => {
    expect(evalJsonPathDetailed({ a: [1, 2] }, 'a.b')).toEqual({
      values: [],
      traversedEmptyArray: false,
    });
  });

  it('drops values when a prop segment lands on null', () => {
    expect(evalJsonPathDetailed({ a: null }, 'a.b')).toEqual({
      values: [],
      traversedEmptyArray: false,
    });
  });

  it('drops non-array values under an array segment without flagging empty', () => {
    expect(evalJsonPathDetailed({ a: 5 }, 'a[]')).toEqual({
      values: [],
      traversedEmptyArray: false,
    });
  });
});

describe('evalJsonPath', () => {
  it('returns only the values list', () => {
    expect(evalJsonPath({ a: [{ b: 1 }, { b: 2 }] }, 'a[].b')).toEqual([1, 2]);
  });

  it('returns an empty list for an empty-array traversal', () => {
    expect(evalJsonPath({ a: [] }, 'a[]')).toEqual([]);
  });
});

describe('typeCheck', () => {
  it('accepts matching primitives and reports the type on mismatch', () => {
    expect(typeCheck('hi', 'string')).toBeNull();
    expect(typeCheck(1, 'number')).toBeNull();
    expect(typeCheck(true, 'boolean')).toBeNull();
    expect(typeCheck([], 'array')).toBeNull();
    expect(typeCheck({}, 'object')).toBeNull();
    expect(typeCheck(null, 'null')).toBeNull();
  });

  it('rejects arrays as objects', () => {
    expect(typeCheck([], 'object')).toBe('expected object, got array');
  });

  it('reports mismatches with the observed type', () => {
    expect(typeCheck(1, 'string')).toBe('expected string, got number');
    expect(typeCheck(null, 'object')).toBe('expected object, got null');
  });

  it('reports an unknown expected type', () => {
    expect(typeCheck(1, 'weird')).toBe('unknown expected type "weird"');
  });
});

describe('describeType', () => {
  it('distinguishes null, array, and typeof', () => {
    expect(describeType(null)).toBe('null');
    expect(describeType([1])).toBe('array');
    expect(describeType('x')).toBe('string');
    expect(describeType(3)).toBe('number');
    expect(describeType({})).toBe('object');
  });
});
