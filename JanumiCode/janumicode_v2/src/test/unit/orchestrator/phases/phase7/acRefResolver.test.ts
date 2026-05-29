/**
 * Phase 7 AC ref resolver — deterministic bridge for LLM id drift.
 * Canonical AC ids are produced by Phase 2's `mintCompositeAcIds`
 * (see phase2/acIdNormalizer.ts): `AC-US{nnn}-{mmm}` workflow-globally
 * unique. The resolver catches the residual drift modes the LLM can
 * still produce despite reading composite ids from its prompt input.
 *
 * Drift modes pinned here (synthesized from observed patterns):
 *   AC-US-001-001  (extra hyphen)
 *   ac-us001-001   (case drift)
 *   AC-US001-1     (lost zero-padding)
 *   US001-AC001    (reordered)
 *   AC-001         (legacy per-story id slipping through)
 *   AC-FEATURE-X   (description-derived; falls back to text-match)
 */

import { describe, it, expect } from 'vitest';
import {
  buildCanonicalAcIndex,
  resolveAcReferences,
} from '../../../../../lib/orchestrator/phases/phase7/acRefResolver';

const STORIES = [
  {
    id: 'US-001',
    acceptance_criteria: [
      { id: 'AC-US001-001', description: 'Shortened URL is unique per long URL', measurable_condition: 'POST /shorten returns a unique short_id for distinct long URLs' },
      { id: 'AC-US001-002', description: 'Expired short URL returns 410', measurable_condition: 'GET /<short_id> returns 410 when expires_at < now()' },
    ],
  },
  {
    id: 'US-002',
    acceptance_criteria: [
      { id: 'AC-US002-001', description: 'Login failure rate limit kicks in', measurable_condition: 'After 5 failed POST /login in 60s the 6th returns 429' },
      { id: 'AC-US002-002', description: 'Successful login resets failure counter', measurable_condition: 'POST /login with valid credentials zeroes the failure counter for that user' },
    ],
  },
];

describe('buildCanonicalAcIndex', () => {
  it('indexes composite AC ids across every resolution map', () => {
    const idx = buildCanonicalAcIndex(STORIES);
    expect(idx.ids).toEqual(['AC-US001-001', 'AC-US001-002', 'AC-US002-001', 'AC-US002-002']);
    expect(idx.byNormalizedId.get('acus001001')).toBe('AC-US001-001');
    expect(idx.byCompositeKey.get('us1_ac1')).toBe('AC-US001-001');
    expect(idx.byCompositeKey.get('us2_ac2')).toBe('AC-US002-002');
    // Trailing-number buckets now collide (every story's first AC ends in 1),
    // so trailing-number resolution becomes intentionally ambiguous.
    expect(idx.byTrailingNumber.get('1')?.length).toBeGreaterThan(1);
  });

  it('handles stories with no acceptance_criteria gracefully', () => {
    const idx = buildCanonicalAcIndex([{ id: 'US-X' }]);
    expect(idx.ids).toEqual([]);
  });
});

describe('resolveAcReferences', () => {
  const idx = buildCanonicalAcIndex(STORIES);

  it('passes through exact composite ids unchanged', () => {
    const r = resolveAcReferences(['AC-US001-001', 'AC-US002-002'], idx);
    expect(r.resolvedIds).toEqual(['AC-US001-001', 'AC-US002-002']);
    expect(r.bridgedCount).toBe(0);
    expect(r.log.every(l => l.via === 'exact')).toBe(true);
  });

  it('resolves case drift via normalized_id (ac-us001-001 → AC-US001-001)', () => {
    const r = resolveAcReferences(['ac-us001-001'], idx);
    expect(r.resolvedIds).toEqual(['AC-US001-001']);
    expect(r.log[0].via).toBe('normalized_id');
  });

  it('resolves extra-hyphen drift via normalized_id (AC-US-001-001 → AC-US001-001)', () => {
    // Both strings normalize to `acus001001` after stripping
    // non-alphanumerics, so normalized_id catches this earlier in the
    // chain than composite_key.
    const r = resolveAcReferences(['AC-US-001-001'], idx);
    expect(r.resolvedIds).toEqual(['AC-US001-001']);
    expect(r.log[0].via).toBe('normalized_id');
  });

  it('resolves lost-zero-padding drift via composite_key (AC-US001-1 → AC-US001-001)', () => {
    const r = resolveAcReferences(['AC-US001-1'], idx);
    expect(r.resolvedIds).toEqual(['AC-US001-001']);
    expect(r.log[0].via).toBe('composite_key');
  });

  it('resolves reordered drift via composite_key (US001-AC001 → AC-US001-001)', () => {
    const r = resolveAcReferences(['US001-AC001'], idx);
    expect(r.resolvedIds).toEqual(['AC-US001-001']);
    expect(r.log[0].via).toBe('composite_key');
  });

  it('resolves multi-digit numbers correctly (AC-US-2-2 → AC-US002-002)', () => {
    const r = resolveAcReferences(['AC-US-2-2'], idx);
    expect(r.resolvedIds).toEqual(['AC-US002-002']);
    expect(r.log[0].via).toBe('composite_key');
  });

  it('refuses to resolve legacy bare AC-001 (ambiguous — would map to any story)', () => {
    // `AC-001` has no story scope. Trailing-number bucket is ambiguous
    // (multiple stories carry a `*-001` AC). Resolver preserves the
    // ref so coverage analysis surfaces the drift.
    const r = resolveAcReferences(['AC-001'], idx);
    expect(r.resolvedIds).toEqual(['AC-001']);
    expect(r.unresolvedCount).toBe(1);
  });

  it('falls back to text_match when no id signal is decodable', () => {
    // `AC-LOGIN-FAILURE` doesn't carry a story or AC number, but the
    // contextText describes US002 AC1's rate-limit behaviour.
    const r = resolveAcReferences(['AC-LOGIN-FAILURE'], idx, {
      contextText: 'After 5 failed login attempts the user receives a rate limit response',
    });
    expect(r.resolvedIds).toEqual(['AC-US002-001']);
    expect(r.log[0].via).toBe('text_match');
  });

  it('preserves an unresolved ref so coverage can flag it', () => {
    const r = resolveAcReferences(['AC-COMPLETELY-MADE-UP'], idx);
    expect(r.resolvedIds).toEqual(['AC-COMPLETELY-MADE-UP']);
    expect(r.unresolvedCount).toBe(1);
    expect(r.log[0].via).toBe('unresolved');
  });

  it('dedupes when multiple drifted refs resolve to the same canonical id', () => {
    const r = resolveAcReferences(['AC-US001-001', 'ac-us001-001', 'AC-US001-1'], idx);
    expect(r.resolvedIds).toEqual(['AC-US001-001']);
    expect(r.bridgedCount).toBe(2);
  });

  it('handles mixed exact + drifted refs in one call', () => {
    const r = resolveAcReferences(['AC-US002-002', 'AC-US001-1', 'ac-us001-002'], idx);
    expect(r.resolvedIds).toEqual(['AC-US002-002', 'AC-US001-001', 'AC-US001-002']);
    expect(r.log.map(l => l.via)).toEqual(['exact', 'composite_key', 'normalized_id']);
  });

  it('returns empty result for an empty refs array', () => {
    const r = resolveAcReferences([], idx);
    expect(r.resolvedIds).toEqual([]);
    expect(r.log).toEqual([]);
  });

  it('ignores whitespace-only refs without throwing', () => {
    const r = resolveAcReferences(['  ', '', 'AC-US001-001'], idx);
    expect(r.resolvedIds).toEqual(['AC-US001-001']);
  });
});
