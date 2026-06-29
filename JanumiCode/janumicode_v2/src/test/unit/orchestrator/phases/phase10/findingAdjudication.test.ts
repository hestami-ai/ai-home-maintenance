import { describe, it, expect } from 'vitest';

import {
  gatherRunFindings,
  parseAdjudicationResponse,
  renderAdjudicationPrompt,
  runFindingAdjudication,
  summarizeAdjudications,
  type FindingForAdjudication,
} from '../../../../../lib/orchestrator/phases/phase10/findingAdjudication';
import type { GovernedStreamRecord } from '../../../../../lib/types/records';

function makeWriter(records: Partial<GovernedStreamRecord>[]): {
  getRecordsByType: (runId: string, type: string) => GovernedStreamRecord[];
  getRecord: (id: string) => GovernedStreamRecord | null;
} {
  const full = records.map((r, i) => ({
    id: r.id ?? `rec-${i}`, record_type: r.record_type ?? 'unknown',
    is_current_version: r.is_current_version ?? true,
    derived_from_record_ids: r.derived_from_record_ids ?? [], content: r.content ?? {}, ...r,
  })) as GovernedStreamRecord[];
  return {
    getRecordsByType: (_r, type) => full.filter((x) => x.record_type === type && x.is_current_version),
    getRecord: (id) => full.find((x) => x.id === id) ?? null,
  };
}

function rrFinding(id: string, validatorId: string): Partial<GovernedStreamRecord> {
  return {
    id, record_type: 'reasoning_review_finding_record', is_current_version: true,
    content: { kind: 'reasoning_review_finding', harness_id: 'h1', validator_id: validatorId, severity: 'HIGH', finding_type: 'ft', summary: `${id} summary`, location: '', recommendation: 'do x' },
  };
}

function packet(coherence: { blocking?: string[]; advisory?: string[] }): Partial<GovernedStreamRecord> {
  return {
    record_type: 'implementation_packet', is_current_version: true,
    content: { kind: 'implementation_packet', coherence: { blocking_failures: coherence.blocking ?? [], advisory_findings: coherence.advisory ?? [], passed: false, annotations: { ai_proposed_root_count: 0, ai_proposed_root_ids: [] } } },
  };
}

describe('gatherRunFindings', () => {
  it('collects substantive reasoning-review + per-packet coherence, dedups identical coherence lines', () => {
    const writer = makeWriter([
      rrFinding('f1', 'grounding_validator'),
      rrFinding('f2', 'json_output_discipline_check'), // auto-fix → dropped
      packet({ blocking: ['P3_AC_NO_TEST: US-005/AC-US005-001 has no test case'], advisory: ['A3_UNMEASURABLE_EVAL_CRITERION: NFR-008 vague'] }),
      packet({ blocking: ['P3_AC_NO_TEST: US-005/AC-US005-001 has no test case'] }), // identical → deduped
    ]);
    const out = gatherRunFindings(writer as never, 'wf');
    const refs = out.map((f) => f.ref);
    expect(out.filter((f) => f.source === 'reasoning_review').map((f) => f.label)).toEqual(['grounding_validator']);
    const coh = out.filter((f) => f.source === 'coherence');
    expect(coh).toHaveLength(2); // P3 (deduped to one) + A3
    expect(refs.every((r) => /^(RR|COH)-\d+$/.test(r))).toBe(true);
  });
});

describe('parseAdjudicationResponse', () => {
  const known = new Set(['RR-1', 'COH-1']);
  it('keeps known refs with valid verdicts, drops unknown/invalid/dupes', () => {
    const raw = `noise {"finding_adjudications":[
      {"finding_ref":"RR-1","verdict":"resolved_by_implementation","rationale":"impl handles it"},
      {"finding_ref":"COH-1","verdict":"still_open","rationale":"no test authored"},
      {"finding_ref":"RR-1","verdict":"waived","rationale":"dup ref"},
      {"finding_ref":"RR-99","verdict":"waived","rationale":"unknown ref"},
      {"finding_ref":"COH-1","verdict":"bogus","rationale":"bad verdict"}
    ]} trailing`;
    const out = parseAdjudicationResponse(raw, known);
    expect(out).toEqual([
      { finding_ref: 'RR-1', verdict: 'resolved_by_implementation', rationale: 'impl handles it' },
      { finding_ref: 'COH-1', verdict: 'still_open', rationale: 'no test authored' },
    ]);
  });
  it('returns [] on unparseable output', () => {
    expect(parseAdjudicationResponse('not json at all', known)).toEqual([]);
    expect(parseAdjudicationResponse('{"other":1}', known)).toEqual([]);
  });
});

describe('renderAdjudicationPrompt', () => {
  it('lists each finding with its ref and asks for the JSON verdict shape', () => {
    const findings: FindingForAdjudication[] = [
      { ref: 'RR-1', source: 'reasoning_review', label: 'measurement_method_executability', severity: 'HIGH', summary: 'no instrument', recommendation: 'name a tool' },
    ];
    const p = renderAdjudicationPrompt(findings, 'wrote 6 files');
    expect(p).toContain('finding_adjudications');
    expect(p).toContain('RR-1 [reasoning_review/HIGH] measurement_method_executability: no instrument | recommendation: name a tool');
    expect(p).toContain('wrote 6 files');
  });
});

describe('runFindingAdjudication (defensive)', () => {
  it('short-circuits with a note when there are no findings', async () => {
    const writer = makeWriter([]);
    const r = await runFindingAdjudication({ writer: writer as never, workflowRunId: 'wf', implementationSummary: '', invokeLlm: async () => { throw new Error('should not be called'); } });
    expect(r.findings).toHaveLength(0);
    expect(r.note).toMatch(/no unadjudicated findings/);
  });

  it('returns a note (never throws) when the LLM invocation fails', async () => {
    const writer = makeWriter([rrFinding('f1', 'grounding_validator')]);
    const r = await runFindingAdjudication({ writer: writer as never, workflowRunId: 'wf', implementationSummary: '', invokeLlm: async () => { throw new Error('ollama down'); } });
    expect(r.adjudications).toHaveLength(0);
    expect(r.note).toMatch(/adjudication skipped: ollama down/);
  });

  it('parses verdicts and summarizes on the happy path', async () => {
    const writer = makeWriter([
      rrFinding('f1', 'grounding_validator'),
      packet({ blocking: ['P3_AC_NO_TEST: AC-1 has no test'] }),
    ]);
    const r = await runFindingAdjudication({
      writer: writer as never, workflowRunId: 'wf', implementationSummary: 'impl',
      invokeLlm: async () => JSON.stringify({ finding_adjudications: [
        { finding_ref: 'RR-1', verdict: 'resolved_by_implementation', rationale: 'ok' },
        { finding_ref: 'COH-1', verdict: 'still_open', rationale: 'missing test' },
      ] }),
    });
    expect(r.summary).toEqual({ total: 2, resolved: 1, still_open: 1, waived: 0, unadjudicated: 0 });
  });
});

describe('summarizeAdjudications', () => {
  it('counts verdicts and unadjudicated remainder', () => {
    const findings = Array.from({ length: 4 }, (_, i) => ({ ref: `RR-${i}` } as FindingForAdjudication));
    const s = summarizeAdjudications(findings, [
      { finding_ref: 'RR-0', verdict: 'resolved_by_implementation', rationale: '' },
      { finding_ref: 'RR-1', verdict: 'waived', rationale: '' },
    ]);
    expect(s).toEqual({ total: 4, resolved: 1, still_open: 0, waived: 1, unadjudicated: 2 });
  });
});
