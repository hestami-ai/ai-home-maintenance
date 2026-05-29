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
  type BloomItemForPrune,
  type GatekeeperConfig,
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
