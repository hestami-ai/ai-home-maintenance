/**
 * Characterization test for `reconstructOutOfScopeFromIntent` (Phase 3.1
 * system_boundary). Pins the deterministic out_of_scope reconstruction that
 * only runs when the LLM left `out_of_scope` empty:
 *
 *   Source 1 — intent_statement.out_of_scope[]  (strings OR {capability})
 *   Source 2 — intent_statement.confirmed_constraints[] filtered by exclusion verb
 *   Source 3 — technical_constraints[].text        filtered by exclusion verb
 *
 * Behaviour pinned: passthrough when LLM output is non-empty, dedup
 * (case-insensitive, trimmed), source ordering (1 → 2 → 3), and the
 * exclusion-verb filter.
 */
import { describe, it, expect } from 'vitest';
import { reconstructOutOfScopeFromIntent } from '../../../../lib/orchestrator/phases/phase3';
import type { GovernedStreamRecord } from '../../../../lib/types/records';

function rec(content: Record<string, unknown>): GovernedStreamRecord {
  return { content } as unknown as GovernedStreamRecord;
}

describe('reconstructOutOfScopeFromIntent', () => {
  it('passes through a non-empty LLM out_of_scope unchanged', () => {
    const out = reconstructOutOfScopeFromIntent(['already', 'here'], []);
    expect(out).toEqual(['already', 'here']);
  });

  it('returns [] when LLM output is empty and there are no artifacts', () => {
    expect(reconstructOutOfScopeFromIntent([], [])).toEqual([]);
  });

  it('returns [] when LLM output is undefined and there are no artifacts', () => {
    expect(reconstructOutOfScopeFromIntent(undefined, [])).toEqual([]);
  });

  it('reconstructs source 1: intent_statement.out_of_scope strings and {capability} objects', () => {
    const artifacts = [
      rec({
        kind: 'intent_statement',
        out_of_scope: ['Alpha', { capability: 'Beta' }, { description: 'no cap here' }],
      }),
    ];
    expect(reconstructOutOfScopeFromIntent([], artifacts)).toEqual(['Alpha', 'Beta']);
  });

  it('dedups case-insensitively and trims', () => {
    const artifacts = [
      rec({ kind: 'intent_statement', out_of_scope: ['  Alpha  ', 'alpha', 'ALPHA'] }),
    ];
    expect(reconstructOutOfScopeFromIntent([], artifacts)).toEqual(['Alpha']);
  });

  it('reconstructs source 2: confirmed_constraints filtered by exclusion verb', () => {
    const artifacts = [
      rec({
        kind: 'intent_statement',
        out_of_scope: [],
        confirmed_constraints: ['no microservices', 'use PostgreSQL', 'must not store plaintext'],
      }),
    ];
    expect(reconstructOutOfScopeFromIntent([], artifacts)).toEqual([
      'no microservices',
      'must not store plaintext',
    ]);
  });

  it('falls back to camelCase confirmedConstraints', () => {
    const artifacts = [
      rec({
        kind: 'intent_statement',
        out_of_scope: [],
        confirmedConstraints: ['without third-party auth', 'positive requirement'],
      }),
    ];
    expect(reconstructOutOfScopeFromIntent([], artifacts)).toEqual(['without third-party auth']);
  });

  it('reconstructs source 3: technical_constraints[].text filtered by exclusion verb', () => {
    const artifacts = [
      rec({
        kind: 'technical_constraints_discovery',
        technicalConstraints: [{ text: 'no external dependencies' }, { text: 'use REST' }],
      }),
    ];
    expect(reconstructOutOfScopeFromIntent([], artifacts)).toEqual(['no external dependencies']);
  });

  it('honors source ordering (1 -> 2 -> 3) and dedups across sources', () => {
    const artifacts = [
      rec({
        kind: 'intent_statement',
        out_of_scope: ['Alpha'],
        confirmed_constraints: ['no beta'],
      }),
      rec({
        kind: 'technical_constraints_discovery',
        technical_constraints: [{ text: 'no beta' }, { text: 'without gamma' }],
      }),
    ];
    expect(reconstructOutOfScopeFromIntent([], artifacts)).toEqual([
      'Alpha',
      'no beta',
      'without gamma',
    ]);
  });
});
