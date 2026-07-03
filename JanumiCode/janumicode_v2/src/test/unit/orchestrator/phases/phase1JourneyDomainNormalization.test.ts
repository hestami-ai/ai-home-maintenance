/**
 * Regression — gpt-oss:20b emits a journey's domain reference with underscores
 * (`DOM-REALTIME_STATUS_UPDATES`) while the accepted domain id uses hyphens
 * (`DOM-REALTIME-STATUS-UPDATES`). The Phase 1.3c `referential_integrity_journey_domain`
 * verifier hard-fails on the mismatch (cal-32 P1). Because these ids live in a
 * bare-string array, `normalizeIdsInTree` can't reach them, so
 * `normalizeJourneyFromWire` hyphen-normalizes each `businessDomainIds` entry.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeJourneyFromWire,
  normalizeDomainFromWire,
  normalizeWorkflowV2,
} from '../../../../lib/orchestrator/phases/phase1Normalizers';

describe('normalizeJourneyFromWire — businessDomainIds id-drift normalization', () => {
  it('normalizes underscore drift to hyphens (the cal-32 gpt-oss defect)', () => {
    const raw = { id: 'UJ-AI-CONCIERGE-INTAKE', business_domain_ids: ['DOM-REALTIME_STATUS_UPDATES', 'DOM-PROVIDER-DISCOVERY'] };
    const j = normalizeJourneyFromWire(raw);
    expect(j.businessDomainIds).toEqual(['DOM-REALTIME-STATUS-UPDATES', 'DOM-PROVIDER-DISCOVERY']);
  });

  it('maps snake_case business_domain_ids → camelCase AND normalizes in one pass', () => {
    const raw = { id: 'UJ-X', business_domain_ids: ['DOM-CASE_ASSIGNMENT'] };
    const j = normalizeJourneyFromWire(raw);
    expect(j.businessDomainIds).toEqual(['DOM-CASE-ASSIGNMENT']);
    expect(j.business_domain_ids).toBeDefined(); // snakeToCamel copies, doesn't delete
  });

  it('leaves already-canonical hyphen ids unchanged', () => {
    const raw = { id: 'UJ-X', businessDomainIds: ['DOM-PROVIDER-DISCOVERY', 'DOM-LICENSE-VERIFICATION'] };
    const j = normalizeJourneyFromWire(raw);
    expect(j.businessDomainIds).toEqual(['DOM-PROVIDER-DISCOVERY', 'DOM-LICENSE-VERIFICATION']);
  });

  it('tolerates a missing/non-array businessDomainIds', () => {
    expect(() => normalizeJourneyFromWire({ id: 'UJ-X' })).not.toThrow();
    expect(normalizeJourneyFromWire({ id: 'UJ-X' }).businessDomainIds).toBeUndefined();
  });
});

describe('normalizeDomainFromWire — domain id hyphen normalization (source side of the journey↔domain join)', () => {
  it('normalizes a partial-underscore domain id to canonical hyphens (the cal-33 defect)', () => {
    // cal-33: journey ref was hyphenated by normalizeJourneyFromWire to
    // DOM-AI-CONCIERGE-INTERACTION, but the accepted domain id kept its internal
    // underscore → 1.3c referential_integrity_journey_domain hard-failed.
    const d = normalizeDomainFromWire({ id: 'DOM-AI_CONCIERGE-INTERACTION', name: 'AI Concierge' });
    expect(d.id).toBe('DOM-AI-CONCIERGE-INTERACTION');
  });

  it('leaves an already-canonical hyphen domain id unchanged', () => {
    const d = normalizeDomainFromWire({ id: 'DOM-SERVICE-CALL-LIFECYCLE' });
    expect(d.id).toBe('DOM-SERVICE-CALL-LIFECYCLE');
  });

  it('tolerates a missing/non-string id', () => {
    expect(() => normalizeDomainFromWire({ name: 'x' })).not.toThrow();
    expect(normalizeDomainFromWire({ name: 'x' }).id).toBeUndefined();
  });
});

describe('normalizeWorkflowV2 — domain ref + workflow id hyphen normalization', () => {
  it('hyphenates businessDomainId (snake in) so it joins the canonical domain id', () => {
    const w = normalizeWorkflowV2({ id: 'WF-INTAKE_MATCH', business_domain_id: 'DOM-AI_CONCIERGE-INTERACTION' });
    expect(w.businessDomainId).toBe('DOM-AI-CONCIERGE-INTERACTION');
    expect(w.id).toBe('WF-INTAKE-MATCH');
  });

  it('leaves canonical ids unchanged (camelCase in)', () => {
    const w = normalizeWorkflowV2({ id: 'WF-DISCOVER', businessDomainId: 'DOM-PROVIDER-DISCOVERY' });
    expect(w.businessDomainId).toBe('DOM-PROVIDER-DISCOVERY');
    expect(w.id).toBe('WF-DISCOVER');
  });
});
