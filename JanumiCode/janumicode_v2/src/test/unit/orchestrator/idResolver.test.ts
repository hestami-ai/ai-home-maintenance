/**
 * Bounded id resolver — resolves LLM-drifted ids to a canonical oracle id,
 * robustly but safely (always an oracle member or null; never invented).
 */
import { describe, it, expect } from 'vitest';
import { resolveAgainstOracle, idComparisonKey, similarityRatio } from '../../../lib/orchestrator/idResolver';

const COMPS = [
  'comp-url-shortening-service',
  'comp-redirect-handling-service',
  'comp-stats-inspection-service',
  'comp-slug-deletion-service',
];

describe('idComparisonKey', () => {
  it('folds prefix-case + all separators to a bare body key', () => {
    expect(idComparisonKey('comp-redirect_handling_service')).toBe('redirecthandlingservice');
    expect(idComparisonKey('COMP-Redirect-Handling-Service')).toBe('redirecthandlingservice');
    expect(idComparisonKey('comp-redirect-handling-service')).toBe('redirecthandlingservice');
  });
});

describe('resolveAgainstOracle', () => {
  it('returns the exact id when already canonical', () => {
    expect(resolveAgainstOracle('comp-redirect-handling-service', COMPS)).toBe('comp-redirect-handling-service');
  });
  it('resolves underscore/hyphen/case drift to the canonical oracle id', () => {
    expect(resolveAgainstOracle('comp-redirect_handling_service', COMPS)).toBe('comp-redirect-handling-service');
    expect(resolveAgainstOracle('COMP-URL_SHORTENING_SERVICE', COMPS)).toBe('comp-url-shortening-service');
  });
  it('resolves a clear single-char typo above threshold', () => {
    expect(resolveAgainstOracle('comp-redirect-handling-servic', COMPS)).toBe('comp-redirect-handling-service');
  });
  it('returns null for a low-similarity candidate (never invents)', () => {
    expect(resolveAgainstOracle('comp-totally-different-thing', COMPS)).toBeNull();
  });
  it('returns null on empty oracle', () => {
    expect(resolveAgainstOracle('comp-x', [])).toBeNull();
  });
  it('returns null when two oracle ids normalize to the same key (ambiguous)', () => {
    expect(resolveAgainstOracle('comp-a_b', ['comp-a-b', 'comp-ab'])).toBeNull();
  });
  it('resolves TECH-* separator drift against a tech oracle', () => {
    expect(resolveAgainstOracle('TECH-JSON_LOGS', ['TECH-JSON-LOGS', 'TECH-PGSQL-16'])).toBe('TECH-JSON-LOGS');
  });
  it('leaves a true semantic alias unresolved (honest)', () => {
    // POSTGRES vs PGSQL is a semantic alias, not separator drift — below threshold.
    expect(resolveAgainstOracle('TECH-POSTGRES-16', ['TECH-PGSQL-16', 'TECH-JSON-LOGS'])).toBeNull();
  });
});

describe('similarityRatio', () => {
  it('is 1 for identical and lower for edits', () => {
    expect(similarityRatio('abc', 'abc')).toBe(1);
    expect(similarityRatio('abc', 'abd')).toBeCloseTo(2 / 3, 5);
  });
});
