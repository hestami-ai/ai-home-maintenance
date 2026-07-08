/**
 * P5.1b adjudicator — pure prompt-build + response-parse (the LLM call is injected
 * and tested separately). Pins: the prompt lists concepts + verdict options; the
 * parser tolerates envelope shapes, filters to requested keys, drops invalid
 * verdicts, and dedups — so a malformed LLM reply degrades to deterministic
 * defaults rather than fabricating.
 */
import { describe, it, expect } from 'vitest';
import { buildAdjudicatorPrompt, parseAdjudicationVerdicts, makeEntityOwnershipAdjudicator } from '../../../../lib/orchestrator/phases/phase5/entityOwnershipAdjudicator';
import type { AdjudicationRequest } from '../../../../lib/orchestrator/phases/phase5/entityOwnershipBridge';

const reqs: AdjudicationRequest[] = [
  { concept_key: 'workorder', concept_name: 'WorkOrder', members: [{ component_id: 'comp-wo', fields: ['id', 'status'] }, { component_id: 'comp-inv', fields: ['id', 'cost'] }] },
  { concept_key: 'address', concept_name: 'Address', members: [{ component_id: 'comp-a', fields: ['street', 'zip'] }] },
];

describe('buildAdjudicatorPrompt', () => {
  it('lists each concept with its per-component fields and the three verdict options', () => {
    const p = buildAdjudicatorPrompt(reqs, 'comp-wo — owns work orders [domain-wo]');
    expect(p).toMatch(/owned_aggregate/);
    expect(p).toMatch(/shared_value_object/);
    expect(p).toMatch(/separate/);
    expect(p).toContain('concept_key "workorder"');
    expect(p).toContain('comp-wo: {id, status}');
    expect(p).toContain('comp-wo — owns work orders [domain-wo]'); // component context injected
  });
});

describe('parseAdjudicationVerdicts', () => {
  const keys = new Set(['workorder', 'address']);
  it('parses the {verdicts:[...]} envelope and keeps valid entries', () => {
    const out = parseAdjudicationVerdicts({ verdicts: [
      { concept_key: 'workorder', verdict: 'owned_aggregate', owner_component_id: 'comp-wo', rationale: 'has lifecycle' },
      { concept_key: 'address', verdict: 'shared_value_object' },
    ] }, keys);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ concept_key: 'workorder', verdict: 'owned_aggregate', owner_component_id: 'comp-wo' });
    expect(out[1].verdict).toBe('shared_value_object');
  });

  it('also accepts a bare array', () => {
    expect(parseAdjudicationVerdicts([{ concept_key: 'workorder', verdict: 'separate' }], keys)).toHaveLength(1);
  });

  it('drops unknown keys, invalid verdicts, and duplicates', () => {
    const out = parseAdjudicationVerdicts({ verdicts: [
      { concept_key: 'nope', verdict: 'owned_aggregate' },          // unknown key
      { concept_key: 'workorder', verdict: 'made_up' },             // invalid verdict
      { concept_key: 'address', verdict: 'separate' },
      { concept_key: 'address', verdict: 'owned_aggregate' },       // duplicate → ignored
    ] }, keys);
    expect(out).toEqual([{ concept_key: 'address', verdict: 'separate', owner_component_id: undefined, rationale: undefined }]);
  });

  it('returns [] for garbage', () => {
    expect(parseAdjudicationVerdicts(null, keys)).toEqual([]);
    expect(parseAdjudicationVerdicts('nope', keys)).toEqual([]);
  });
});

describe('makeEntityOwnershipAdjudicator', () => {
  it('returns [] without calling the LLM when there are no concepts', async () => {
    let called = false;
    const adj = makeEntityOwnershipAdjudicator({ call: async () => { called = true; return { parsed: {}, text: '' }; }, workflowRunId: 'r' });
    expect(await adj([])).toEqual([]);
    expect(called).toBe(false);
  });

  it('falls back to [] when the LLM call throws (deterministic defaults apply)', async () => {
    const adj = makeEntityOwnershipAdjudicator({ call: async () => { throw new Error('boom'); }, workflowRunId: 'r' });
    expect(await adj(reqs)).toEqual([]);
  });
});
