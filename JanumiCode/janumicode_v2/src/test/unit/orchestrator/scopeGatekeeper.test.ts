/**
 * Unit tests for runScopeGatekeeperPrune's deterministic post-processing.
 *
 * We mock the LLMCaller and feed adversarial JSON outputs to verify:
 *   - DEFECT-2 fix: kept_ids ∩ dropped[].id → drop wins
 *   - hallucinated ids in dropped[] (not in input) → stripped
 *   - unaccounted ids (missing from both kept and dropped) → default keep
 *   - unparseable LLM JSON → safe fallback "keep all"
 *   - LLM throw → safe fallback "keep all" with error captured
 *
 * Calibration of the GATEKEEPER PROMPT itself (which items the LLM
 * decides to drop on a given scenario) is NOT tested here — that's an
 * LLM-output-quality concern best covered by recorded-fixture
 * calibration tests against a real provider. These deterministic tests
 * guard the code surface that all calibration outcomes flow through.
 */
import { describe, it, expect } from 'vitest';
import {
  runScopeGatekeeperPrune,
  stripSelfProducedAcceptedSets,
  SELF_PRODUCED_ACCEPTED_FIELDS,
  type BloomItemForPrune,
  type GatekeeperConfig,
  type GatekeeperUpstreamContext,
} from '../../../lib/orchestrator/scopeGatekeeper';
import type { LLMCaller, LLMCallOptions, LLMCallResult } from '../../../lib/llm/llmCaller';

function makeItems(ids: string[]): BloomItemForPrune[] {
  return ids.map((id) => ({ id, label: `[Item] ${id}`, description: 'test item' }));
}

function makeConfig(items: BloomItemForPrune[]): GatekeeperConfig {
  return {
    workflowRunId: 'wf-test',
    phaseId: '1',
    subPhaseId: 'business_domains_bloom',
    bloomDescription: 'test items',
    items,
    upstreamContext: {
      analysisSummary: 'Test product. Excludes feature X.',
      intentConstraints: [{ id: 'CON-1', text: 'no feature X' }],
    },
  };
}

/** A mock LLMCaller that returns a scripted response. */
function mockCaller(response: { text: string; parsed: Record<string, unknown> | null } | Error): LLMCaller {
  return {
    async call(_opts: LLMCallOptions): Promise<LLMCallResult> {
      if (response instanceof Error) throw response;
      return {
        text: response.text,
        parsed: response.parsed,
        toolCalls: [],
        provider: 'mock',
        model: 'mock',
        inputTokens: 100,
        outputTokens: 50,
        usedFallback: false,
        retryAttempts: 0,
      };
    },
  } as unknown as LLMCaller;
}

const routing = { provider: 'mock', model: 'mock' };

describe('runScopeGatekeeperPrune — deterministic post-processing', () => {
  it('returns degenerate "keep all" for empty input', async () => {
    const r = await runScopeGatekeeperPrune(mockCaller({ text: '', parsed: null }), routing, makeConfig([]));
    expect(r.kept_ids).toEqual([]);
    expect(r.dropped).toEqual([]);
    expect(r.duration_ms).toBe(0);
  });

  it('DEFECT-2: when an id appears in BOTH kept_ids and dropped[], drop wins', async () => {
    const items = makeItems(['A', 'B', 'C']);
    const parsed = {
      kept_ids: ['A', 'B', 'C'],
      dropped: [{ id: 'C', reason: 'conflicts with CON-1' }],
      rationale_summary: 'mixed',
    };
    const r = await runScopeGatekeeperPrune(mockCaller({ text: JSON.stringify(parsed), parsed }), routing, makeConfig(items));
    expect(r.kept_ids).toEqual(['A', 'B']);
    expect(r.dropped.map((d) => d.id)).toEqual(['C']);
    expect(r.dropped[0].reason).toBe('conflicts with CON-1');
  });

  it('strips hallucinated ids from dropped[] (id not present in input)', async () => {
    const items = makeItems(['A', 'B']);
    const parsed = {
      kept_ids: ['A', 'B'],
      dropped: [{ id: 'C-HALLUCINATED', reason: 'not in input' }],
      rationale_summary: 'with hallucinated drop',
    };
    const r = await runScopeGatekeeperPrune(mockCaller({ text: JSON.stringify(parsed), parsed }), routing, makeConfig(items));
    expect(r.kept_ids.sort()).toEqual(['A', 'B']);
    expect(r.dropped).toEqual([]);
  });

  it('defaults unaccounted ids (missing from both kept and dropped) to KEEP when no literal match', async () => {
    const items = makeItems(['A', 'B', 'C']);
    const parsed = {
      kept_ids: ['A'],
      dropped: [{ id: 'B', reason: 'x' }],
      // C is missing from both lists; no upstream constraint about it
      rationale_summary: 'partial',
    };
    const r = await runScopeGatekeeperPrune(mockCaller({ text: JSON.stringify(parsed), parsed }), routing, makeConfig(items));
    expect(r.kept_ids.sort()).toEqual(['A', 'C']);
    expect(r.dropped.map((d) => d.id)).toEqual(['B']);
  });

  it('ts-110 safety net: unaccounted id force-dropped when its keyword matches a negative upstream constraint', async () => {
    // The classic ts-110 case: LLM silently omits DOM-RATE_LIMITING
    // from both kept_ids and dropped, but CON-3 ("No rate limiting on
    // URL submission") is a literal Pass-1 match. The deterministic
    // safety net catches it.
    const items: BloomItemForPrune[] = [
      { id: 'DOM-URL_SHORTENING', label: '[Domain] URL Shortening' },
      { id: 'DOM-RATE_LIMITING', label: '[Domain] Rate Limiting' },
    ];
    const parsed = {
      kept_ids: ['DOM-URL_SHORTENING'],
      dropped: [],
      // DOM-RATE_LIMITING silently omitted
      rationale_summary: 'partial',
    };
    const cfg: GatekeeperConfig = {
      workflowRunId: 'wf-ts110',
      phaseId: '1',
      subPhaseId: 'business_domains_bloom',
      bloomDescription: 'domains',
      items,
      upstreamContext: {
        intentConstraints: [{ id: 'CON-3', text: 'No rate limiting on URL submission.' }],
      },
    };
    const r = await runScopeGatekeeperPrune(mockCaller({ text: JSON.stringify(parsed), parsed }), routing, cfg);
    expect(r.kept_ids).toEqual(['DOM-URL_SHORTENING']);
    expect(r.dropped.map(d => d.id)).toEqual(['DOM-RATE_LIMITING']);
    expect(r.dropped[0].reason).toMatch(/safety-net.*rate limiting|safety-net.*rate/i);
  });

  it('safety net does NOT fire when upstream constraint is positive (no negative phrase)', async () => {
    const items: BloomItemForPrune[] = [
      { id: 'DOM-ANALYTICS', label: '[Domain] Analytics' },
    ];
    const parsed = { kept_ids: [], dropped: [], rationale_summary: 'silent' };
    const cfg: GatekeeperConfig = {
      workflowRunId: 'wf-pos',
      phaseId: '1',
      subPhaseId: 'business_domains_bloom',
      bloomDescription: 'domains',
      items,
      upstreamContext: {
        intentConstraints: [{ id: 'CON-9', text: 'Analytics must include click counter per slug.' }],
      },
    };
    const r = await runScopeGatekeeperPrune(mockCaller({ text: JSON.stringify(parsed), parsed }), routing, cfg);
    // CON-9 mentions analytics but is POSITIVE → no force-drop
    expect(r.kept_ids).toEqual(['DOM-ANALYTICS']);
    expect(r.dropped).toEqual([]);
  });

  it('safety net does NOT fire on generic stopword overlap (avoid false positives)', async () => {
    // CON-5 says "No analytics beyond per-slug click counter" — but the
    // overlapping keyword is "analytics" which is a meaningful token.
    // Test the inverse: a constraint with generic stopwords only
    // shouldn't pull every input item into drops.
    const items: BloomItemForPrune[] = [
      { id: 'DOM-PAYMENT', label: '[Domain] Payment Processing' },
    ];
    const parsed = { kept_ids: [], dropped: [], rationale_summary: 'silent' };
    const cfg: GatekeeperConfig = {
      workflowRunId: 'wf-stop',
      phaseId: '1',
      subPhaseId: 'business_domains_bloom',
      bloomDescription: 'domains',
      items,
      upstreamContext: {
        intentConstraints: [{ id: 'CON-X', text: 'No support requirement for legacy systems.' }],
      },
    };
    const r = await runScopeGatekeeperPrune(mockCaller({ text: JSON.stringify(parsed), parsed }), routing, cfg);
    // No item keyword overlaps with the negative constraint → keep
    expect(r.kept_ids).toEqual(['DOM-PAYMENT']);
    expect(r.dropped).toEqual([]);
  });

  it('falls back to "keep all" when LLM returns unparseable JSON', async () => {
    const items = makeItems(['A', 'B']);
    const r = await runScopeGatekeeperPrune(mockCaller({ text: 'not json at all', parsed: null }), routing, makeConfig(items));
    expect(r.kept_ids.sort()).toEqual(['A', 'B']);
    expect(r.dropped).toEqual([]);
    expect(r.error).toBe('unparseable_json');
  });

  it('falls back to "keep all" when LLM call throws', async () => {
    const items = makeItems(['A', 'B', 'C']);
    const r = await runScopeGatekeeperPrune(mockCaller(new Error('provider 503')), routing, makeConfig(items));
    expect(r.kept_ids.sort()).toEqual(['A', 'B', 'C']);
    expect(r.dropped).toEqual([]);
    expect(r.error).toContain('provider 503');
  });

  it('recovers JSON from a text-only response when parsed=null but text contains valid JSON', async () => {
    const items = makeItems(['A', 'B']);
    const obj = {
      kept_ids: ['A'],
      dropped: [{ id: 'B', reason: 'unsupported' }],
      rationale_summary: 'recovered',
    };
    const r = await runScopeGatekeeperPrune(
      mockCaller({ text: 'prose before ' + JSON.stringify(obj) + ' prose after', parsed: null }),
      routing, makeConfig(items),
    );
    expect(r.kept_ids).toEqual(['A']);
    expect(r.dropped.map((d) => d.id)).toEqual(['B']);
  });

  it('handles non-string kept_ids entries gracefully (filters them out)', async () => {
    const items = makeItems(['A', 'B']);
    const parsed = {
      kept_ids: ['A', 42, null, 'B'],
      dropped: [],
      rationale_summary: 'mixed types in kept_ids',
    };
    const r = await runScopeGatekeeperPrune(mockCaller({ text: JSON.stringify(parsed), parsed }), routing, makeConfig(items));
    expect(r.kept_ids.sort()).toEqual(['A', 'B']);
  });

  it('handles dropped[] entries missing required fields (filters them out)', async () => {
    const items = makeItems(['A', 'B', 'C']);
    const parsed = {
      kept_ids: ['A'],
      dropped: [
        { id: 'B', reason: 'valid' },
        { id: 'C' },                        // missing reason → skip
        { reason: 'no id' },                 // missing id → skip
        'not an object',                     // not an object → skip
      ],
      rationale_summary: 'partial drop entries',
    };
    const r = await runScopeGatekeeperPrune(mockCaller({ text: JSON.stringify(parsed), parsed }), routing, makeConfig(items));
    expect(r.kept_ids.sort()).toEqual(['A', 'C']); // C unaccounted → keep; B dropped
    expect(r.dropped.map((d) => d.id)).toEqual(['B']);
  });
});

describe('stripSelfProducedAcceptedSets — gatekeeper self-reference guard', () => {
  function fullContext(): GatekeeperUpstreamContext {
    return {
      analysisSummary: 'summary',
      acceptedDomains: [{ id: 'DOM-A', name: 'A' }],
      acceptedPersonas: [{ id: 'P-A', name: 'A' }],
      acceptedJourneys: [{ id: 'UJ-A', title: 'A' }],
      acceptedWorkflows: [{ id: 'WF-A', name: 'A' }],
      acceptedEntities: [{ id: 'ENT-A', name: 'A' }],
      acceptedUserStories: [{ id: 'US-A', action: 'do' }],
      acceptedNfrs: [{ id: 'NFR-A' }],
      acceptedComponents: [{ id: 'comp-a', name: 'A' }],
    };
  }

  it('business_domains_bloom: strips its OWN acceptedDomains + acceptedPersonas, keeps the rest', () => {
    const out = stripSelfProducedAcceptedSets(fullContext(), 'business_domains_bloom');
    expect(out.acceptedDomains).toBeUndefined();
    expect(out.acceptedPersonas).toBeUndefined();
    // Everything else is genuinely upstream → preserved.
    expect(out.acceptedJourneys).toBeDefined();
    expect(out.acceptedWorkflows).toBeDefined();
    expect(out.analysisSummary).toBe('summary');
  });

  it('user_journey_bloom strips only acceptedJourneys (keeps upstream domains/personas)', () => {
    const out = stripSelfProducedAcceptedSets(fullContext(), 'user_journey_bloom');
    expect(out.acceptedJourneys).toBeUndefined();
    expect(out.acceptedDomains).toBeDefined();
    expect(out.acceptedPersonas).toBeDefined();
  });

  it('downstream fr_bloom_skeleton strips its OWN acceptedUserStories, keeps Phase 1 sets', () => {
    const out = stripSelfProducedAcceptedSets(fullContext(), 'fr_bloom_skeleton');
    expect(out.acceptedUserStories).toBeUndefined();
    expect(out.acceptedDomains).toBeDefined();
    expect(out.acceptedJourneys).toBeDefined();
  });

  it('nfr_bloom_skeleton strips acceptedNfrs; component_skeleton strips acceptedComponents', () => {
    expect(stripSelfProducedAcceptedSets(fullContext(), 'nfr_bloom_skeleton').acceptedNfrs).toBeUndefined();
    expect(stripSelfProducedAcceptedSets(fullContext(), 'component_skeleton').acceptedComponents).toBeUndefined();
    // ...but each keeps the other's set (they ARE legitimate upstream for each other).
    expect(stripSelfProducedAcceptedSets(fullContext(), 'nfr_bloom_skeleton').acceptedUserStories).toBeDefined();
    expect(stripSelfProducedAcceptedSets(fullContext(), 'component_skeleton').acceptedUserStories).toBeDefined();
  });

  it('task_skeleton / test_case_skeleton produce no accepted set → context unchanged', () => {
    const before = fullContext();
    for (const sp of ['task_skeleton', 'test_case_skeleton', 'integrations_qa_bloom', 'release_plan']) {
      const out = stripSelfProducedAcceptedSets(fullContext(), sp);
      expect(Object.keys(out).sort()).toEqual(Object.keys(before).sort());
    }
  });

  it('every mapped sub-phase removes exactly the fields it declares as self-produced', () => {
    for (const [sp, fields] of Object.entries(SELF_PRODUCED_ACCEPTED_FIELDS)) {
      const out = stripSelfProducedAcceptedSets(fullContext(), sp);
      for (const f of fields) expect(out[f], `${sp} should strip ${String(f)}`).toBeUndefined();
    }
  });

  it('does not mutate the input context', () => {
    const input = fullContext();
    stripSelfProducedAcceptedSets(input, 'business_domains_bloom');
    expect(input.acceptedDomains).toBeDefined();
    expect(input.acceptedPersonas).toBeDefined();
  });

  it('acceptedSoftwareDomains is NOT stripped at component_skeleton (it is the namespace components reference)', () => {
    const ctx: GatekeeperUpstreamContext = {
      acceptedDomains: [{ id: 'DOM-URL_SHORTENING', name: 'URL Shortening' }],
      acceptedSoftwareDomains: [{ id: 'domain-shortening', name: 'Shortening' }],
      acceptedComponents: [{ id: 'comp-a', name: 'A', domain_id: 'domain-shortening' }],
    };
    const out = stripSelfProducedAcceptedSets(ctx, 'component_skeleton');
    // component_skeleton produces acceptedComponents → stripped.
    expect(out.acceptedComponents).toBeUndefined();
    // Software domains are upstream (Phase 4.1), needed for the domain_id
    // check → preserved. Business domains also preserved.
    expect(out.acceptedSoftwareDomains).toBeDefined();
    expect(out.acceptedSoftwareDomains?.[0].id).toBe('domain-shortening');
    expect(out.acceptedDomains).toBeDefined();
  });
});

describe('component gatekeeper prompt renders software-domain namespace (ts-113 fix)', () => {
  it('buildGatekeeperPrompt includes the Accepted Software Domains section with domain-* ids', async () => {
    const { buildGatekeeperPrompt } = await import('../../../lib/orchestrator/scopeGatekeeper');
    const cfg: GatekeeperConfig = {
      workflowRunId: 'wf', phaseId: '4', subPhaseId: 'component_skeleton',
      bloomDescription: 'software components',
      items: [{ id: 'comp-url-shortening', label: 'comp [domain: domain-shortening]' }],
      upstreamContext: {
        acceptedDomains: [{ id: 'DOM-URL_SHORTENING', name: 'URL Shortening' }],
        acceptedSoftwareDomains: [{ id: 'domain-shortening', name: 'Shortening' }],
      },
    };
    const prompt = buildGatekeeperPrompt(cfg);
    expect(prompt).toContain('Accepted Software Domains');
    expect(prompt).toContain('domain-shortening');
    // and still carries the business set distinctly
    expect(prompt).toContain('DOM-URL_SHORTENING');
  });
});

describe('release_plan gatekeeper prompt renders the actual contained ids (slice-138 fix)', () => {
  it('buildReleasePlanGatekeeperPrompt emits each release\'s contained member ids, not just counts', async () => {
    const { buildReleasePlanGatekeeperPrompt } = await import('../../../lib/orchestrator/scopeGatekeeper');
    const cfg: GatekeeperConfig = {
      workflowRunId: 'wf', phaseId: '1', subPhaseId: 'release_plan',
      bloomDescription: 'release plan',
      items: [{
        id: 'REL-1',
        label: 'Release 1: Core',
        description: 'core shortener',
        tradeoffs: 'rationale • contains 2j/1w/1e/0c/0i/0v',
        // The detail block is what phase1.mapItems now populates.
        detail: [
          '      contains:',
          '      journeys (2): UJ-CREATE-SHORTLINK, UJ-REDIRECT-SHORTLINK',
          '      workflows (1): WF-URL-SHORTENING',
          '      entities (1): ENT-MAPPING',
          '      compliance (0): —',
          '      integrations (0): —',
          '      vocabulary (0): —',
        ].join('\n'),
      }],
      upstreamContext: {
        acceptedJourneys: [
          { id: 'UJ-CREATE-SHORTLINK', name: 'Create' },
          { id: 'UJ-REDIRECT-SHORTLINK', name: 'Redirect' },
        ],
        acceptedWorkflows: [{ id: 'WF-URL-SHORTENING', name: 'Shorten' }],
        acceptedEntities: [{ id: 'ENT-MAPPING', name: 'Mapping' }],
      },
    };
    const prompt = buildReleasePlanGatekeeperPrompt(cfg);
    // The specific contained ids must be present so the gatekeeper can
    // id-match them against the accepted sets — the whole point of the fix.
    expect(prompt).toContain('UJ-CREATE-SHORTLINK');
    expect(prompt).toContain('UJ-REDIRECT-SHORTLINK');
    expect(prompt).toContain('WF-URL-SHORTENING');
    expect(prompt).toContain('ENT-MAPPING');
    // And the instruction text now points at the contains: block, not counts.
    expect(prompt).toContain("'contains:' block");
  });

  it('THROWS (fail-closed) when a release claims members but no ids were rendered (blind gatekeeper)', async () => {
    const { buildReleasePlanGatekeeperPrompt } = await import('../../../lib/orchestrator/scopeGatekeeper');
    const blindCfg: GatekeeperConfig = {
      workflowRunId: 'wf', phaseId: '1', subPhaseId: 'release_plan',
      bloomDescription: 'release plan',
      items: [{
        id: 'REL-1',
        label: 'Release 1: Core',
        // Claims 6 journeys / 3 workflows / 1 entity but NO detail block — the
        // exact slice-138 defect.
        tradeoffs: 'rationale • contains 6j/3w/1e/0c/0i/0v',
      }],
      upstreamContext: {
        acceptedJourneys: [{ id: 'UJ-CREATE-SHORTLINK', name: 'Create' }],
      },
    };
    expect(() => buildReleasePlanGatekeeperPrompt(blindCfg)).toThrow(/assembly defect/i);
  });

  it('does NOT throw for a legitimately empty release (0 contained artifacts)', async () => {
    const { buildReleasePlanGatekeeperPrompt } = await import('../../../lib/orchestrator/scopeGatekeeper');
    const emptyCfg: GatekeeperConfig = {
      workflowRunId: 'wf', phaseId: '1', subPhaseId: 'release_plan',
      bloomDescription: 'release plan',
      items: [{
        id: 'REL-EMPTY',
        label: 'Release: Backlog',
        tradeoffs: 'placeholder • contains 0j/0w/0e/0c/0i/0v',
      }],
      upstreamContext: { acceptedJourneys: [{ id: 'UJ-X', name: 'X' }] },
    };
    // An empty release is a VALID (droppable) state the gatekeeper can judge
    // without ids — the guard must not false-positive on it.
    expect(() => buildReleasePlanGatekeeperPrompt(emptyCfg)).not.toThrow();
  });
});
