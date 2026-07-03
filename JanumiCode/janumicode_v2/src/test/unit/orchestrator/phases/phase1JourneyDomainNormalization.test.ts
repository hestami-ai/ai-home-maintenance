/**
 * Regression — gpt-oss:20b emits a journey's domain reference with underscores
 * (`DOM-REALTIME_STATUS_UPDATES`) while the accepted domain id uses hyphens
 * (`DOM-REALTIME-STATUS-UPDATES`). The Phase 1.3c `referential_integrity_journey_domain`
 * verifier hard-fails on the mismatch (cal-32 P1). Because these ids live in a
 * bare-string array, `normalizeIdsInTree` can't reach them, so
 * `normalizeJourneyFromWire` hyphen-normalizes each `businessDomainIds` entry.
 */
import { describe, it, expect } from 'vitest';
import { normalizeJourneyFromWire } from '../../../../lib/orchestrator/phases/phase1Normalizers';

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
