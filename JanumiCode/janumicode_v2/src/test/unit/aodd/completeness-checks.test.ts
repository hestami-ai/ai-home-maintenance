/**
 * Characterization tests for the pure AODD completeness predicates
 * `check5WH` and `runSpotChecks`.
 *
 * These pin the CURRENT observable behavior of both functions — the exact
 * failure strings they return and, critically, their ORDERING and the
 * "invalid regex skips the not_null check for the same spot-check" (the
 * original `continue`) short-circuit — so a decomposition refactor that
 * splits either function into helpers cannot silently change behavior.
 *
 * The existing regression suite (`aodd-completeness.test.ts`) only drives
 * these functions through passing fixtures, so the failure branches below
 * were previously uncovered.
 */

import { describe, expect, it } from 'vitest';

import { check5WH, runSpotChecks } from '../../../lib/aodd';
import type {
  FixtureSpotCheck,
  SubPhaseSummary,
} from '../../../lib/aodd';

/** A fully-valid summary that produces zero 5W+H failures. */
function makeValidSummary(): SubPhaseSummary {
  return {
    schema_version: 1,
    run_id: 'run-1',
    phase_id: '1',
    sub_phase_id: 'sp-1',
    started_at: '2026-01-01T00:00:00.000Z',
    completed_at: '2026-01-01T00:00:01.000Z',
    duration_ms: 1000,
    who: {
      agent_role: 'planner',
      model: 'test-model',
      model_parameters: {},
      invocation_chain: [],
    },
    what: {
      inputs_consumed: [],
      outputs_produced: [],
      decisions: [],
    },
    why: {
      template_key: 'tk',
      template_source_sha: 'sha',
      rendered_prompt_ref: 'ref',
      governing_constraints: [],
    },
    how: {
      retries: 0,
      repairs: 0,
      escalations: 0,
      fallbacks: [],
      status: 'success',
      error: null,
    },
    events: {
      first_event_id: 'e1',
      last_event_id: 'e2',
      count: 3,
    },
  };
}

describe('check5WH (characterization)', () => {
  it('returns no failures for a fully-valid summary', () => {
    expect(check5WH(makeValidSummary())).toEqual([]);
  });

  it('flags an empty who.model', () => {
    const s = makeValidSummary();
    s.who.model = '';
    expect(check5WH(s)).toEqual(['who.model is empty']);
  });

  it('does not flag a null who.agent_role', () => {
    const s = makeValidSummary();
    s.who.agent_role = null;
    expect(check5WH(s)).toEqual([]);
  });

  it('flags non-array what.* fields', () => {
    const s = makeValidSummary();
    // Deliberately violate the type to exercise the runtime guard.
    (s.what as unknown as Record<string, unknown>).inputs_consumed = null;
    (s.what as unknown as Record<string, unknown>).outputs_produced = 5;
    (s.what as unknown as Record<string, unknown>).decisions = 'x';
    expect(check5WH(s)).toEqual([
      'what.inputs_consumed is not an array',
      'what.outputs_produced is not an array',
      'what.decisions is not an array',
    ]);
  });

  it('flags a partially-populated how.error (missing event_id)', () => {
    const s = makeValidSummary();
    s.how.error = { event_id: '', message: 'boom' };
    expect(check5WH(s)).toEqual(['how.error is partially populated']);
  });

  it('flags an invalid how.status with the status value interpolated', () => {
    const s = makeValidSummary();
    (s.how as unknown as Record<string, unknown>).status = 'bogus';
    expect(check5WH(s)).toEqual(['how.status is invalid: bogus']);
  });

  it('flags events.count when below 1', () => {
    const s = makeValidSummary();
    s.events.count = 0;
    expect(check5WH(s)).toEqual(['events.count is invalid']);
  });

  it('emits failures in section order who → what → why → how → when → events', () => {
    const s = makeValidSummary();
    s.who.model = '';
    (s.what as unknown as Record<string, unknown>).inputs_consumed = null;
    s.why.template_key = '';
    (s.how as unknown as Record<string, unknown>).status = 'nope';
    s.started_at = '';
    s.events.first_event_id = '';
    expect(check5WH(s)).toEqual([
      'who.model is empty',
      'what.inputs_consumed is not an array',
      'why.template_key is empty',
      'how.status is invalid: nope',
      'started_at is empty',
      'events.first_event_id is empty',
    ]);
  });
});

describe('runSpotChecks (characterization)', () => {
  it('returns no failures when checks is undefined', () => {
    expect(runSpotChecks(makeValidSummary(), undefined)).toEqual([]);
  });

  it('returns no failures when checks is empty', () => {
    expect(runSpotChecks(makeValidSummary(), [])).toEqual([]);
  });

  it('passes an equals check that matches', () => {
    const checks: FixtureSpotCheck[] = [{ path: 'who.model', equals: 'test-model' }];
    expect(runSpotChecks(makeValidSummary(), checks)).toEqual([]);
  });

  it('fails an equals check that does not match', () => {
    const checks: FixtureSpotCheck[] = [{ path: 'who.model', equals: 'other' }];
    expect(runSpotChecks(makeValidSummary(), checks)).toEqual([
      'spot check who.model: expected "other", got "test-model"',
    ]);
  });

  it('passes a matches check with a matching regex', () => {
    const checks: FixtureSpotCheck[] = [{ path: 'who.model', matches: 'test' }];
    expect(runSpotChecks(makeValidSummary(), checks)).toEqual([]);
  });

  it('fails a matches check with a non-matching regex', () => {
    const checks: FixtureSpotCheck[] = [{ path: 'who.model', matches: '^zzz' }];
    expect(runSpotChecks(makeValidSummary(), checks)).toEqual([
      'spot check who.model: "test-model" did not match /^zzz/',
    ]);
  });

  it('fails a not_null check on a null value', () => {
    const s = makeValidSummary();
    s.who.agent_role = null;
    const checks: FixtureSpotCheck[] = [{ path: 'who.agent_role', not_null: true }];
    expect(runSpotChecks(s, checks)).toEqual([
      'spot check who.agent_role: required non-null/non-empty, got null',
    ]);
  });

  it('fails a not_null check on an empty array', () => {
    const checks: FixtureSpotCheck[] = [
      { path: 'what.inputs_consumed', not_null: true },
    ];
    expect(runSpotChecks(makeValidSummary(), checks)).toEqual([
      'spot check what.inputs_consumed: required non-null/non-empty, got []',
    ]);
  });

  it('reports an invalid regex and skips the not_null check on the same spot-check', () => {
    // Original behavior: an invalid `matches` regex pushes an "invalid regex"
    // failure and `continue`s to the next check — so the `not_null` clause on
    // the SAME check is never evaluated (even though who.agent_role is null,
    // which would otherwise fail not_null).
    const checks: FixtureSpotCheck[] = [
      { path: 'who.agent_role', matches: '[', not_null: true },
    ];
    const result = runSpotChecks(makeValidSummary(), checks);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('spot check who.agent_role: invalid regex "["');
    expect(result[0]).not.toContain('required non-null');
  });

  it('accumulates failures across multiple checks in order', () => {
    const s = makeValidSummary();
    s.who.agent_role = null;
    const checks: FixtureSpotCheck[] = [
      { path: 'who.model', equals: 'other' },
      { path: 'why.template_key', matches: '^zzz' },
      { path: 'who.agent_role', not_null: true },
    ];
    expect(runSpotChecks(s, checks)).toEqual([
      'spot check who.model: expected "other", got "test-model"',
      'spot check why.template_key: "tk" did not match /^zzz/',
      'spot check who.agent_role: required non-null/non-empty, got null',
    ]);
  });

  it('evaluates equals then matches then not_null within a single check', () => {
    // A single check may set all three clauses; a value that fails equals and
    // matches (but is non-empty) yields exactly those two failures, in order.
    const checks: FixtureSpotCheck[] = [
      { path: 'who.model', equals: 'other', matches: '^zzz', not_null: true },
    ];
    expect(runSpotChecks(makeValidSummary(), checks)).toEqual([
      'spot check who.model: expected "other", got "test-model"',
      'spot check who.model: "test-model" did not match /^zzz/',
    ]);
  });
});
