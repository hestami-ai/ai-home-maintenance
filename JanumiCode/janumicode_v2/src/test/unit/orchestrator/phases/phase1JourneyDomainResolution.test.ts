/**
 * Regression — Phase 1.3c `referential_integrity_journey_domain` keeps
 * hard-failing because gpt-oss:20b drifts a journey's `businessDomainIds`
 * from the accepted business-domain id in a NEW way each run:
 *   - cal-33: underscore drift `DOM-AI_CONCIERGE-INTERACTION` (fix #5, hyphen normalize)
 *   - cal-36: plural drift `DOM-USERS-AUTHENTICATION` vs `DOM-USER-AUTHENTICATION`
 *     — a semantic/token drift the hyphen normalizer CANNOT reach.
 *   - cal-39: TRUNCATION `DOM-COMMUNICATION` vs `DOM-COMMUNITY-COMMUNICATION`
 *     — a dropped whole token, ~0.6 similarity, below any safe Levenshtein
 *     threshold. Handled by the `resolveByTokenSubset` fallback (unique
 *     strict-token-superset host).
 *
 * `resolveJourneyDomainRefs` generalizes the per-variant normalizers into a
 * deterministic oracle-resolution pass: each ref is re-anchored to the
 * ACCEPTED-domain set via the sanctioned `resolveAgainstOracle` (exact →
 * normalized-key → high-confidence Levenshtein; oracle-bounded, null on
 * ambiguity). Resolvable refs are rewritten to the canonical id; unresolvable
 * refs are KEPT verbatim so 1.3c flags a genuine error (no fabrication).
 */
import { describe, it, expect } from 'vitest';
import { resolveJourneyDomainRefs } from '../../../../lib/orchestrator/phases/phase1';

const ORACLE = [
  'DOM-USER-AUTHENTICATION',
  'DOM-AI-CONCIERGE-INTERACTION',
  'DOM-PAYMENT-PROCESSING',
  'DOM-PROVIDER-DISCOVERY',
  'DOM-COMMUNITY-COMMUNICATION',
];

describe('resolveJourneyDomainRefs — journey→domain oracle resolution', () => {
  it('(1) resolves plural/singular token drift to the accepted id (the cal-36 defect)', () => {
    const journeys = [{ id: 'UJ-1', businessDomainIds: ['DOM-USERS-AUTHENTICATION'] }];
    const { journeys: out, remapped } = resolveJourneyDomainRefs(journeys, ORACLE);
    expect(out[0].businessDomainIds).toEqual(['DOM-USER-AUTHENTICATION']);
    expect(remapped).toEqual([
      { journey: 'UJ-1', from: 'DOM-USERS-AUTHENTICATION', to: 'DOM-USER-AUTHENTICATION' },
    ]);
  });

  it('(2) resolves underscore drift to the accepted id (subsumes fix #5)', () => {
    const journeys = [{ id: 'UJ-2', businessDomainIds: ['DOM-AI_CONCIERGE-INTERACTION'] }];
    const { journeys: out, remapped } = resolveJourneyDomainRefs(journeys, ORACLE);
    expect(out[0].businessDomainIds).toEqual(['DOM-AI-CONCIERGE-INTERACTION']);
    expect(remapped).toEqual([
      { journey: 'UJ-2', from: 'DOM-AI_CONCIERGE-INTERACTION', to: 'DOM-AI-CONCIERGE-INTERACTION' },
    ]);
  });

  it('(2b) resolves a TRUNCATION (dropped token) via token-subset (the cal-39 defect)', () => {
    const journeys = [{ id: 'UJ-2b', businessDomainIds: ['DOM-COMMUNICATION'] }];
    const { journeys: out, remapped } = resolveJourneyDomainRefs(journeys, ORACLE);
    expect(out[0].businessDomainIds).toEqual(['DOM-COMMUNITY-COMMUNICATION']);
    expect(remapped).toEqual([
      { journey: 'UJ-2b', from: 'DOM-COMMUNICATION', to: 'DOM-COMMUNITY-COMMUNICATION' },
    ]);
  });

  it('(3) leaves an exact-match ref unchanged and records no remap', () => {
    const journeys = [{ id: 'UJ-3', businessDomainIds: ['DOM-USER-AUTHENTICATION', 'DOM-PAYMENT-PROCESSING'] }];
    const { journeys: out, remapped } = resolveJourneyDomainRefs(journeys, ORACLE);
    expect(out[0].businessDomainIds).toEqual(['DOM-USER-AUTHENTICATION', 'DOM-PAYMENT-PROCESSING']);
    expect(remapped).toEqual([]);
  });

  it('(4) KEEPS a genuinely-unknown ref verbatim (no near oracle member) so 1.3c flags it', () => {
    const journeys = [{ id: 'UJ-4', businessDomainIds: ['DOM-NONEXISTENT-XYZ'] }];
    const { journeys: out, remapped } = resolveJourneyDomainRefs(journeys, ORACLE);
    // Unresolvable → kept as-is, NOT rewritten to some wrong accepted domain.
    expect(out[0].businessDomainIds).toEqual(['DOM-NONEXISTENT-XYZ']);
    expect(remapped).toEqual([]);
  });

  it('(5) reports each change (journey id, from, to) across multiple journeys/refs', () => {
    const journeys = [
      { id: 'UJ-A', businessDomainIds: ['DOM-USERS-AUTHENTICATION', 'DOM-PAYMENT-PROCESSING'] },
      { id: 'UJ-B', businessDomainIds: ['DOM-AI_CONCIERGE-INTERACTION'] },
    ];
    const { journeys: out, remapped } = resolveJourneyDomainRefs(journeys, ORACLE);
    // A: first ref remapped, second (exact) untouched.
    expect(out[0].businessDomainIds).toEqual(['DOM-USER-AUTHENTICATION', 'DOM-PAYMENT-PROCESSING']);
    expect(out[1].businessDomainIds).toEqual(['DOM-AI-CONCIERGE-INTERACTION']);
    expect(remapped).toEqual([
      { journey: 'UJ-A', from: 'DOM-USERS-AUTHENTICATION', to: 'DOM-USER-AUTHENTICATION' },
      { journey: 'UJ-B', from: 'DOM-AI_CONCIERGE-INTERACTION', to: 'DOM-AI-CONCIERGE-INTERACTION' },
    ]);
  });

  it('is pure — does not mutate the input journeys', () => {
    const journeys = [{ id: 'UJ-P', businessDomainIds: ['DOM-USERS-AUTHENTICATION'] }];
    resolveJourneyDomainRefs(journeys, ORACLE);
    expect(journeys[0].businessDomainIds).toEqual(['DOM-USERS-AUTHENTICATION']);
  });

  it('tolerates a journey with a missing/non-array businessDomainIds', () => {
    const journeys = [{ id: 'UJ-N' } as { id: string; businessDomainIds?: unknown }];
    const { journeys: out, remapped } = resolveJourneyDomainRefs(journeys, ORACLE);
    expect(out[0]).toBe(journeys[0]); // returned unchanged (same object)
    expect(remapped).toEqual([]);
  });

  it('resolves nothing (all kept) when the oracle is empty', () => {
    const journeys = [{ id: 'UJ-E', businessDomainIds: ['DOM-USERS-AUTHENTICATION'] }];
    const { journeys: out, remapped } = resolveJourneyDomainRefs(journeys, []);
    expect(out[0].businessDomainIds).toEqual(['DOM-USERS-AUTHENTICATION']);
    expect(remapped).toEqual([]);
  });
});
