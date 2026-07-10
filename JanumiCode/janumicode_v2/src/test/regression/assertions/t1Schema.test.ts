/**
 * Characterization tests for checkT1Schema — pin the CURRENT observable
 * behavior (per-path check names, passed flags, and detail strings) so a
 * behavior-preserving refactor can be verified. Pure function: plain
 * input/output, no DB or LLM.
 */
import { describe, it, expect } from 'vitest';

import { checkT1Schema } from './t1Schema.js';
import type { T1SchemaAssertion } from '../fixtureSchema.js';

const shapeAssertion = (
  shape: T1SchemaAssertion['shape'],
  required_paths?: string[],
): T1SchemaAssertion => ({ kind: 'json-shape', shape, required_paths });

describe('checkT1Schema', () => {
  describe('missing parsed JSON', () => {
    it('returns a single failing json_parse check when requireJsonParse is true (parsed null)', () => {
      const checks = checkT1Schema(
        shapeAssertion({ foo: 'string' }),
        null,
        'not json at all',
        true,
      );
      expect(checks).toEqual([
        {
          tier: 'T1',
          name: 'json_parse',
          passed: false,
          detail: 'response did not parse as JSON (length 15)',
        },
      ]);
    });

    it('treats undefined parsed the same as null', () => {
      const checks = checkT1Schema(
        shapeAssertion({ foo: 'string' }),
        undefined,
        'abc',
        true,
      );
      expect(checks).toEqual([
        {
          tier: 'T1',
          name: 'json_parse',
          passed: false,
          detail: 'response did not parse as JSON (length 3)',
        },
      ]);
    });

    it('emits one failing shape check per key when requireJsonParse is false', () => {
      const checks = checkT1Schema(
        shapeAssertion({ foo: 'string', bar: 'number' }),
        null,
        '',
        false,
      );
      expect(checks).toEqual([
        { tier: 'T1', name: 'shape:foo', passed: false, detail: 'no parsed JSON available' },
        { tier: 'T1', name: 'shape:bar', passed: false, detail: 'no parsed JSON available' },
      ]);
    });
  });

  describe('shape checks', () => {
    it('passes when every fanned-out value matches the expected type', () => {
      const checks = checkT1Schema(
        shapeAssertion({ 'tasks[].id': 'string' }),
        { tasks: [{ id: 'a' }, { id: 'b' }] },
        '{}',
        true,
      );
      expect(checks).toEqual([
        { tier: 'T1', name: 'shape:tasks[].id', passed: true, detail: undefined },
      ]);
    });

    it('fails with first-bad-sample detail on a type mismatch', () => {
      const checks = checkT1Schema(
        shapeAssertion({ 'tasks[].id': 'string' }),
        { tasks: [{ id: 'a' }, { id: 123 }] },
        '{}',
        true,
      );
      expect(checks).toEqual([
        {
          tier: 'T1',
          name: 'shape:tasks[].id',
          passed: false,
          detail: 'expected string, got number at one of 2 value(s); first bad sample = number',
        },
      ]);
    });

    it('fails when a path resolves to no values (missing property)', () => {
      const checks = checkT1Schema(
        shapeAssertion({ foo: 'string' }),
        { bar: 1 },
        '{}',
        true,
      );
      expect(checks).toEqual([
        {
          tier: 'T1',
          name: 'shape:foo',
          passed: false,
          detail: 'path resolved to no values (expected string)',
        },
      ]);
    });

    it('is vacuously satisfied when traversal passed through an empty array', () => {
      const checks = checkT1Schema(
        shapeAssertion({ 'tasks[].id': 'string' }),
        { tasks: [] },
        '{}',
        true,
      );
      expect(checks).toEqual([
        {
          tier: 'T1',
          name: 'shape:tasks[].id',
          passed: true,
          detail: 'vacuously satisfied: parent array was empty',
        },
      ]);
    });
  });

  describe('required_paths gate', () => {
    it('passes for a present path and fails for a missing one, preserving order', () => {
      const checks = checkT1Schema(
        shapeAssertion({ foo: 'string' }, ['foo', 'missing']),
        { foo: 'x' },
        '{}',
        true,
      );
      expect(checks).toEqual([
        { tier: 'T1', name: 'shape:foo', passed: true, detail: undefined },
        { tier: 'T1', name: 'required:foo', passed: true, detail: undefined },
        {
          tier: 'T1',
          name: 'required:missing',
          passed: false,
          detail: 'required path resolved to no values',
        },
      ]);
    });

    it('omits required checks entirely when required_paths is absent', () => {
      const checks = checkT1Schema(
        shapeAssertion({ foo: 'string' }),
        { foo: 'x' },
        '{}',
        true,
      );
      expect(checks.every((c) => !c.name.startsWith('required:'))).toBe(true);
    });
  });
});
