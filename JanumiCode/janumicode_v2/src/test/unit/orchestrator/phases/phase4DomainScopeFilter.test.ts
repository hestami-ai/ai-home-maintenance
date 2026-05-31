/**
 * Unit tests for the deterministic 2-hop domain-scope filter that guards
 * Phase 4.2 component scope.
 *
 * Background (ts-113/114): components carry Phase 4.1 SOFTWARE-domain ids
 * (`domain-shortening`), NOT Phase 1.2 BUSINESS-domain ids (`DOM-*`). The
 * old LLM gatekeeper overlay compared `domain_id` against the business set
 * and dropped 100% of components. The fix moves the domain check to
 * deterministic code: a component is in scope iff its software domain maps
 * (via `maps_to_business_domains`) to >=1 ACCEPTED business domain.
 */
import { describe, it, expect } from 'vitest';
import { deterministicDomainScopeDrops, deterministicComponentDrops } from '../../../../lib/orchestrator/phases/phase4';

const softwareDomains = [
  { id: 'domain-shortening', maps_to_business_domains: ['DOM-URL_SHORTENING', 'DOM-API'] },
  { id: 'domain-analytics', maps_to_business_domains: ['DOM-ANALYTICS'] },          // business domain NOT accepted
  { id: 'domain-mixed', maps_to_business_domains: ['DOM-ANALYTICS', 'DOM-API'] },   // one accepted → in scope
  { id: 'domain-unmapped', maps_to_business_domains: [] },                          // no mapping → out of scope
];

const acceptedBiz = new Set(['DOM-URL_SHORTENING', 'DOM-API', 'DOM-REDIRECTION']);

describe('deterministicDomainScopeDrops — 2-hop component domain scope', () => {
  it('keeps a component whose software domain maps to an accepted business domain', () => {
    const drops = deterministicDomainScopeDrops(
      [{ id: 'comp-a', domain_id: 'domain-shortening' }], softwareDomains, acceptedBiz,
    );
    expect(drops).toEqual([]);
  });

  it('drops a component whose software domain maps ONLY to non-accepted business domains', () => {
    const drops = deterministicDomainScopeDrops(
      [{ id: 'comp-b', domain_id: 'domain-analytics' }], softwareDomains, acceptedBiz,
    );
    expect(drops.map(d => d.id)).toEqual(['comp-b']);
    expect(drops[0].reason).toMatch(/2-hop domain scope/);
  });

  it('keeps a multi-domain software domain if AT LEAST ONE business mapping is accepted', () => {
    const drops = deterministicDomainScopeDrops(
      [{ id: 'comp-c', domain_id: 'domain-mixed' }], softwareDomains, acceptedBiz,
    );
    expect(drops).toEqual([]);
  });

  it('drops a component whose software domain declares no business mapping (unmapped → out of scope)', () => {
    const drops = deterministicDomainScopeDrops(
      [{ id: 'comp-d', domain_id: 'domain-unmapped' }], softwareDomains, acceptedBiz,
    );
    expect(drops.map(d => d.id)).toEqual(['comp-d']);
  });

  it('drops a component referencing an unknown software domain id', () => {
    const drops = deterministicDomainScopeDrops(
      [{ id: 'comp-e', domain_id: 'domain-nonexistent' }], softwareDomains, acceptedBiz,
    );
    expect(drops.map(d => d.id)).toEqual(['comp-e']);
  });

  it('drops a component with no domain_id at all', () => {
    const drops = deterministicDomainScopeDrops(
      [{ id: 'comp-f' }], softwareDomains, acceptedBiz,
    );
    expect(drops.map(d => d.id)).toEqual(['comp-f']);
  });

  it('the ts-113 regression: business-domain ids would have dropped everything; software-domain mapping keeps the real ones', () => {
    const comps = [
      { id: 'comp-url-shortening', domain_id: 'domain-shortening' },
      { id: 'comp-redirection', domain_id: 'domain-mixed' },
    ];
    const drops = deterministicDomainScopeDrops(comps, softwareDomains, acceptedBiz);
    // Both in scope via software→business mapping — none dropped (ts-113
    // dropped both because it compared domain-* against DOM-*).
    expect(drops).toEqual([]);
  });

  it('is robust to hyphen/underscore/case id-format drift between sub-phases', () => {
    // business_domains_bloom emitted underscore ids; software_domains'
    // maps_to emitted hyphen ids (and vice-versa across ts-113/116). An
    // exact-string join would drop everything — the normalized join must
    // still recognize them as the same domain.
    const swUnderscore = [{ id: 'domain-x', maps_to_business_domains: ['DOM-URL_SHORTENING'] }];
    const acceptedHyphen = new Set(['DOM-URL-SHORTENING']);
    expect(
      deterministicDomainScopeDrops([{ id: 'comp-x', domain_id: 'domain-x' }], swUnderscore, acceptedHyphen),
    ).toEqual([]); // matched despite _ vs - mismatch

    const swHyphen = [{ id: 'DOMAIN-Y', maps_to_business_domains: ['dom-redirection'] }];
    const acceptedUpper = new Set(['DOM-REDIRECTION']);
    expect(
      deterministicDomainScopeDrops([{ id: 'comp-y', domain_id: 'domain-y' }], swHyphen, acceptedUpper),
    ).toEqual([]); // matched despite case + software-domain-id case mismatch
  });

  it('mixed batch: keeps in-scope, drops out-of-scope, in one pass', () => {
    const comps = [
      { id: 'keep-1', domain_id: 'domain-shortening' },
      { id: 'drop-1', domain_id: 'domain-analytics' },
      { id: 'keep-2', domain_id: 'domain-mixed' },
      { id: 'drop-2', domain_id: 'domain-unmapped' },
    ];
    const drops = deterministicDomainScopeDrops(comps, softwareDomains, acceptedBiz);
    expect(drops.map(d => d.id).sort()).toEqual(['drop-1', 'drop-2']);
  });
});

describe('deterministicComponentDrops — authoritative domain + user-story coverage', () => {
  const sw = [
    { id: 'domain-shortening', maps_to_business_domains: ['DOM-URL-SHORTENING'] },
    { id: 'domain-orphan', maps_to_business_domains: ['DOM-ANALYTICS'] }, // not accepted
  ];
  const acceptedBiz = new Set(['DOM-URL-SHORTENING', 'DOM-API']);
  const acceptedUS = new Set(['US-001', 'US-009', 'US-010', 'US-011']);

  it('keeps a component that is domain-valid AND traces to an accepted story', () => {
    const drops = deterministicComponentDrops(
      [{ id: 'comp-a', domain_id: 'domain-shortening', traces_to: ['US-001'] }], sw, acceptedBiz, acceptedUS,
    );
    expect(drops).toEqual([]);
  });

  it('ts-116 regression: keeps comp-encryption-service (LLM dropped it) because it traces to accepted stories', () => {
    const drops = deterministicComponentDrops(
      [{ id: 'comp-encryption-service', domain_id: 'domain-shortening', traces_to: ['US-009', 'US-010', 'US-011'] }],
      sw, acceptedBiz, acceptedUS,
    );
    expect(drops).toEqual([]); // kept despite the LLM's advisory drop
  });

  it('drops a component whose traces_to are ALL non-accepted stories', () => {
    const drops = deterministicComponentDrops(
      [{ id: 'comp-stale', domain_id: 'domain-shortening', traces_to: ['US-099', 'US-100'] }], sw, acceptedBiz, acceptedUS,
    );
    expect(drops.map(d => d.id)).toEqual(['comp-stale']);
    expect(drops[0].reason).toMatch(/user-story coverage/);
  });

  it('keeps a cross-cutting component with EMPTY traces_to (not dropped on US grounds)', () => {
    const drops = deterministicComponentDrops(
      [{ id: 'comp-monitoring', domain_id: 'domain-shortening', traces_to: [] }], sw, acceptedBiz, acceptedUS,
    );
    expect(drops).toEqual([]);
  });

  it('keeps a cross-cutting component with NO traces_to field at all', () => {
    const drops = deterministicComponentDrops(
      [{ id: 'comp-logging', domain_id: 'domain-shortening' }], sw, acceptedBiz, acceptedUS,
    );
    expect(drops).toEqual([]);
  });

  it('domain-scope failure takes precedence and reports the domain reason', () => {
    const drops = deterministicComponentDrops(
      [{ id: 'comp-orphan', domain_id: 'domain-orphan', traces_to: ['US-001'] }], sw, acceptedBiz, acceptedUS,
    );
    expect(drops.map(d => d.id)).toEqual(['comp-orphan']);
    expect(drops[0].reason).toMatch(/2-hop domain scope/);
  });

  it('mixed batch: domain-drop, us-drop, and keeps coexist', () => {
    const comps = [
      { id: 'keep-valid', domain_id: 'domain-shortening', traces_to: ['US-001'] },
      { id: 'drop-domain', domain_id: 'domain-orphan', traces_to: ['US-001'] },
      { id: 'drop-us', domain_id: 'domain-shortening', traces_to: ['US-404'] },
      { id: 'keep-crosscut', domain_id: 'domain-shortening', traces_to: [] },
    ];
    const drops = deterministicComponentDrops(comps, sw, acceptedBiz, acceptedUS);
    expect(drops.map(d => d.id).sort()).toEqual(['drop-domain', 'drop-us']);
  });
});
