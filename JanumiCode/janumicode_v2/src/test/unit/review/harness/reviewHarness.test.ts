import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runReviewHarness } from '../../../../lib/review/harness/reviewHarness';
import type { LLMCaller, LLMCallResult, LLMTraceContext } from '../../../../lib/llm/llmCaller';
import type { GovernedStreamWriter } from '../../../../lib/orchestrator/governedStreamWriter';
import type { TemplateLoader } from '../../../../lib/orchestrator/templateLoader';
import type { GovernedStreamRecord } from '../../../../lib/types/records';

// ── Stub helpers ────────────────────────────────────────────────────

interface WrittenRecord {
  id: string;
  options: Parameters<GovernedStreamWriter['writeRecord']>[0];
}

function makeWriter(): {
  writer: GovernedStreamWriter;
  written: WrittenRecord[];
  superseded: { recordId: string; supersededById: string }[];
} {
  const written: WrittenRecord[] = [];
  const superseded: { recordId: string; supersededById: string }[] = [];
  let counter = 0;
  const writer = {
    writeRecord: (options: Parameters<GovernedStreamWriter['writeRecord']>[0]) => {
      const id = `rec-${++counter}`;
      written.push({ id, options });
      return { id, ...options } as unknown as GovernedStreamRecord;
    },
    supersedByRollback: (recordId: string, supersededById: string) => {
      superseded.push({ recordId, supersededById });
    },
  } as unknown as GovernedStreamWriter;
  return { writer, written, superseded };
}

function makeLLMCaller(impl?: (opts: unknown) => Promise<LLMCallResult>): {
  caller: LLMCaller;
  callMock: ReturnType<typeof vi.fn>;
} {
  const callMock = vi.fn(impl ?? (async () => emptyResult()));
  const caller = { call: callMock } as unknown as LLMCaller;
  return { caller, callMock };
}

function emptyResult(extra: Partial<LLMCallResult> = {}): LLMCallResult {
  return {
    text: '',
    parsed: null,
    thinking: '',
    toolCalls: [],
    provider: 'stub',
    model: 'stub',
    inputTokens: 0,
    outputTokens: 0,
    usedFallback: false,
    retryAttempts: 0,
    ...extra,
  };
}

function makeTemplateLoader(found: boolean = false): TemplateLoader {
  // findTemplate returns null when found=false (Commit 1 has no
  // validator templates yet). render is a no-op.
  return {
    findTemplate: vi.fn(() => (found ? { metadata: { required_variables: [] }, body: 'sys' } : null)),
    render: vi.fn(() => ({ rendered: 'sys', missing_variables: [] })),
  } as unknown as TemplateLoader;
}

function makeTraceContext(role: string | null = 'orchestrator'): LLMTraceContext {
  return {
    workflowRunId: 'wf-1',
    phaseId: '1',
    subPhaseId: 'intent_quality_check',
    agentRole: role as LLMTraceContext['agentRole'],
    label: 'test',
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('runReviewHarness — dispatch infrastructure', () => {
  let writerCtx: ReturnType<typeof makeWriter>;
  beforeEach(() => {
    writerCtx = makeWriter();
  });

  it('dispatches the IQC bundle for orchestrator/intent_quality_check', async () => {
    const { caller } = makeLLMCaller();
    const outcome = await runReviewHarness(
      {
        agentInvocationId: 'inv-1',
        agentOutputId: 'out-1',
        traceContext: makeTraceContext(),
        prompt: 'p',
        result: emptyResult({ text: '{}', parsed: { ok: true } }),
      },
      caller,
      writerCtx.writer,
      'sha',
      makeTemplateLoader(false),
    );

    expect(outcome.skipped).toBe(false);
    expect(outcome.validatorsDispatched).toContain('contract_schema_validator');
    expect(outcome.validatorsDispatched).toContain('completeness_evidence_adequacy');
    expect(outcome.validatorsDispatched).toContain('coherence_evidence_audit');
    expect(outcome.validatorsDispatched).toContain('grounding_validator');
    expect(outcome.validatorsDispatched).toContain('final_synthesis');
  });

  it('records validator_unavailable for LLM validators that lack a wired template (Commit 4 state)', async () => {
    // After Commits 3 and 4, deterministic validators with bodies execute
    // and may emit findings. Universal cross-role LLM validators with an
    // `invoke` function flag validator_unavailable when their template is
    // missing. Family-class / role-specific LLM bodies remain stubbed
    // (Commits 5–7) and also flag validator_unavailable.
    const { caller } = makeLLMCaller();
    const outcome = await runReviewHarness(
      {
        agentInvocationId: 'inv-1',
        agentOutputId: 'out-1',
        traceContext: makeTraceContext(),
        prompt: 'p',
        result: emptyResult({ text: '{}', parsed: { ok: true } }),
      },
      caller,
      writerCtx.writer,
      'sha',
      makeTemplateLoader(false),
    );

    // At least one failure of each kind should be present.
    expect(outcome.validatorFailures.length).toBeGreaterThan(0);
    for (const failure of outcome.validatorFailures) {
      expect(failure.error).toContain('validator_unavailable');
    }
  });

  it('loop guard skips when agentRole is harness', async () => {
    const { caller, callMock } = makeLLMCaller();
    const outcome = await runReviewHarness(
      {
        agentInvocationId: 'inv-1',
        agentOutputId: 'out-1',
        traceContext: makeTraceContext('harness'),
        prompt: 'p',
        result: emptyResult({ text: 'r' }),
      },
      caller,
      writerCtx.writer,
      'sha',
      makeTemplateLoader(false),
    );
    expect(outcome.skipped).toBe(true);
    expect(outcome.skipReason).toBe('loop_guard:harness');
    expect(outcome.validatorsDispatched).toEqual([]);
    expect(callMock).not.toHaveBeenCalled();
    expect(writerCtx.written).toEqual([]);
  });

  it('loop guard skips when agentRole is json_repair', async () => {
    const { caller } = makeLLMCaller();
    const outcome = await runReviewHarness(
      {
        agentInvocationId: 'inv-1',
        agentOutputId: 'out-1',
        traceContext: makeTraceContext('json_repair'),
        prompt: 'p',
        result: emptyResult({ text: 'r' }),
      },
      caller,
      writerCtx.writer,
      'sha',
      makeTemplateLoader(false),
    );
    expect(outcome.skipped).toBe(true);
    expect(outcome.skipReason).toBe('loop_guard:json_repair');
  });

  it('loop guard skips when agentRole is reasoning_review', async () => {
    const { caller } = makeLLMCaller();
    const outcome = await runReviewHarness(
      {
        agentInvocationId: 'inv-1',
        agentOutputId: 'out-1',
        traceContext: makeTraceContext('reasoning_review'),
        prompt: 'p',
        result: emptyResult({ text: 'r' }),
      },
      caller,
      writerCtx.writer,
      'sha',
      makeTemplateLoader(false),
    );
    expect(outcome.skipped).toBe(true);
  });

  it('writes the parent harness record FIRST with status=running, then a final completed record + supersedes', async () => {
    const { caller } = makeLLMCaller();
    await runReviewHarness(
      {
        agentInvocationId: 'inv-1',
        agentOutputId: 'out-1',
        traceContext: makeTraceContext(),
        prompt: 'p',
        result: emptyResult({ text: '{}', parsed: { ok: true } }),
      },
      caller,
      writerCtx.writer,
      'sha',
      makeTemplateLoader(false),
    );

    const harnessRecords = writerCtx.written.filter(
      (r) => r.options.record_type === 'reasoning_review_harness_record',
    );
    expect(harnessRecords.length).toBe(2);
    expect((harnessRecords[0].options.content as { status: string }).status).toBe('running');
    expect((harnessRecords[1].options.content as { status: string }).status).toBe('completed');
    // Same harness_id linkage across both.
    expect((harnessRecords[0].options.content as { harness_id: string }).harness_id).toBe(
      (harnessRecords[1].options.content as { harness_id: string }).harness_id,
    );
    // The first record was superseded by the second.
    expect(writerCtx.superseded).toEqual([
      { recordId: harnessRecords[0].id, supersededById: harnessRecords[1].id },
    ]);
  });

  it('emits findings derived from the harness record id when validators return findings', async () => {
    // Wire one LLM validator with a (mock) template + LLM response
    // containing a finding, so we exercise the finding-record path.
    const llmResult: LLMCallResult = emptyResult({
      text: '{"findings":[{"severity":"HIGH","type":"x","summary":"s","location":"l","detail":"d","recommendation":"r"}]}',
      parsed: {
        findings: [
          {
            severity: 'HIGH',
            type: 'x',
            summary: 's',
            location: 'l',
            detail: 'd',
            recommendation: 'r',
          },
        ],
      },
    });
    const { caller } = makeLLMCaller(async () => llmResult);

    const outcome = await runReviewHarness(
      {
        agentInvocationId: 'inv-1',
        agentOutputId: 'out-1',
        traceContext: makeTraceContext(),
        prompt: 'p',
        result: emptyResult({ text: '{}', parsed: { ok: true } }),
      },
      caller,
      writerCtx.writer,
      'sha',
      // findTemplate returns a stub template for every LLM validator
      // so each LLM entry exercises the call path.
      makeTemplateLoader(true),
    );

    expect(outcome.findings.length).toBeGreaterThan(0);
    const findingRecords = writerCtx.written.filter(
      (r) => r.options.record_type === 'reasoning_review_finding_record',
    );
    expect(findingRecords.length).toBe(outcome.findings.length);
    // Each finding-record's derived_from references the running harness record.
    const harnessRunningRecord = writerCtx.written.find(
      (r) =>
        r.options.record_type === 'reasoning_review_harness_record' &&
        (r.options.content as { status: string }).status === 'running',
    );
    expect(harnessRunningRecord).toBeDefined();
    for (const fr of findingRecords) {
      expect(fr.options.derived_from_record_ids).toEqual([harnessRunningRecord!.id]);
    }
  });

  it('saturation sub-phase dispatches the universal-only bundle (no saturation entries fire)', async () => {
    const { caller } = makeLLMCaller();
    const outcome = await runReviewHarness(
      {
        agentInvocationId: 'inv-1',
        agentOutputId: 'out-1',
        traceContext: {
          workflowRunId: 'wf-1',
          phaseId: '2',
          subPhaseId: 'fr_saturation',
          agentRole: 'requirements_agent' as LLMTraceContext['agentRole'],
          label: 'test',
        },
        prompt: 'p',
        result: emptyResult({ text: '{}', parsed: { ok: true } }),
      },
      caller,
      writerCtx.writer,
      'sha',
      makeTemplateLoader(false),
    );
    expect(outcome.validatorsDispatched).not.toContain('tier_decomposition_validator');
    expect(outcome.validatorsDispatched).not.toContain('measurement_adequacy_validator');
    expect(outcome.validatorsDispatched).toContain('contract_schema_validator');
    expect(outcome.validatorsDispatched).toContain('grounding_validator');
    expect(outcome.validatorsDispatched).toContain('reasoning_quality_validator');
    expect(outcome.validatorsDispatched).toContain('final_synthesis');
  });

  it('does not throw when an LLM call rejects — captures as a validator failure', async () => {
    const { caller } = makeLLMCaller(async () => {
      throw new Error('connection refused');
    });
    const outcome = await runReviewHarness(
      {
        agentInvocationId: 'inv-1',
        agentOutputId: 'out-1',
        traceContext: makeTraceContext(),
        prompt: 'p',
        result: emptyResult({ text: '{}', parsed: { ok: true } }),
      },
      caller,
      writerCtx.writer,
      'sha',
      makeTemplateLoader(true),
    );
    // Every LLM validator with an `invoke` function hits the rejection
    // and surfaces llm_call_failed. Deterministic validators with bodies
    // (contract_schema_validator, status_consistency_iqc) run cleanly
    // and do not appear in failures.
    expect(outcome.validatorFailures.length).toBeGreaterThan(0);
    expect(outcome.validatorFailures.some((f) => f.error.includes('llm_call_failed'))).toBe(true);
  });

  it('populates decision_recommendation + decision_rationale on the final harness record (Commit 8)', async () => {
    const { caller } = makeLLMCaller();
    await runReviewHarness(
      {
        agentInvocationId: 'inv-1',
        agentOutputId: 'out-1',
        traceContext: makeTraceContext(),
        prompt: 'p',
        result: emptyResult({ text: '{}', parsed: { ok: true } }),
      },
      caller,
      writerCtx.writer,
      'sha',
      // missing templates -> validator_unavailable failures -> escalate ACCEPT to REVISE
      makeTemplateLoader(false),
    );
    const completed = writerCtx.written
      .filter((r) => r.options.record_type === 'reasoning_review_harness_record')
      .map((r) => r.options.content as Record<string, unknown>)
      .find((c) => c.status === 'completed');
    expect(completed).toBeDefined();
    expect(completed!.decision_recommendation).toBeDefined();
    expect(typeof completed!.decision_rationale).toBe('string');
    expect(Array.isArray(completed!.contractDesignFindings)).toBe(true);
  });

  it('aggregates input/output tokens across LLM validators (Commit 9)', async () => {
    // Each LLM call returns 100 input / 50 output tokens. With templates
    // present every LLM validator's invoke runs, plus final_synthesis's
    // narrative LLM call. Test asserts non-zero aggregates and that
    // per-finding records carry token columns.
    const { caller } = makeLLMCaller(async () =>
      emptyResult({
        text: '{"findings":[]}',
        parsed: { findings: [] },
        inputTokens: 100,
        outputTokens: 50,
      }),
    );
    await runReviewHarness(
      {
        agentInvocationId: 'inv-1',
        agentOutputId: 'out-1',
        traceContext: makeTraceContext(),
        prompt: 'p',
        result: emptyResult({ text: '{}', parsed: { ok: true } }),
      },
      caller,
      writerCtx.writer,
      'sha',
      makeTemplateLoader(true),
    );
    const completed = writerCtx.written
      .filter((r) => r.options.record_type === 'reasoning_review_harness_record')
      .map((r) => r.options.content as Record<string, unknown>)
      .find((c) => c.status === 'completed');
    expect(completed).toBeDefined();
    expect(typeof completed!.total_input_tokens).toBe('number');
    expect(typeof completed!.total_output_tokens).toBe('number');
    expect(completed!.total_input_tokens as number).toBeGreaterThan(0);
    expect(completed!.total_output_tokens as number).toBeGreaterThan(0);

    // Find at least one finding record with populated tokens (the
    // final_synthesis decision finding lands with tokens captured from
    // the narrative LLM call).
    const findingRecords = writerCtx.written
      .filter((r) => r.options.record_type === 'reasoning_review_finding_record')
      .map((r) => r.options.content as Record<string, unknown>);
    const withTokens = findingRecords.filter(
      (c) => typeof c.input_tokens === 'number' && (c.input_tokens as number) > 0,
    );
    expect(withTokens.length).toBeGreaterThan(0);
  });

  it('finding records degrade gracefully when LLM provides no token counts', async () => {
    const { caller } = makeLLMCaller(async () =>
      emptyResult({
        parsed: { findings: [] },
        inputTokens: null,
        outputTokens: null,
      }),
    );
    await runReviewHarness(
      {
        agentInvocationId: 'inv-1',
        agentOutputId: 'out-1',
        traceContext: makeTraceContext(),
        prompt: 'p',
        result: emptyResult({ text: '{}', parsed: { ok: true } }),
      },
      caller,
      writerCtx.writer,
      'sha',
      makeTemplateLoader(true),
    );
    const completed = writerCtx.written
      .filter((r) => r.options.record_type === 'reasoning_review_harness_record')
      .map((r) => r.options.content as Record<string, unknown>)
      .find((c) => c.status === 'completed');
    expect(completed!.total_input_tokens).toBe(0);
    expect(completed!.total_output_tokens).toBe(0);
  });

  // ── json_output_discipline_check short-circuit (catalog §1 option a) ──

  it('short-circuits LLM validator chain when json_output_discipline_check fires HIGH, writes REVISE with fixed rationale', async () => {
    // Use technical_spec_agent/data_model_skeleton — one of the bundles
    // that includes json_output_discipline_check as the pre-validator.
    // Pass markdown-fenced JSON as the raw outputText to trigger the
    // json_output_discipline_check HIGH finding.
    const { caller, callMock } = makeLLMCaller(async () =>
      emptyResult({ text: '{"findings":[]}', parsed: { findings: [] } }),
    );

    await runReviewHarness(
      {
        agentInvocationId: 'inv-1',
        agentOutputId: 'out-1',
        traceContext: {
          workflowRunId: 'wf-1',
          phaseId: '5',
          subPhaseId: 'data_model_skeleton',
          agentRole: 'technical_spec_agent' as LLMTraceContext['agentRole'],
          label: 'test',
        },
        prompt: 'p',
        // Markdown-fenced JSON triggers json_output_discipline_check HIGH.
        result: emptyResult({
          text: '```json\n{"data_models":[]}\n```',
          parsed: { data_models: [] },
        }),
      },
      caller,
      writerCtx.writer,
      'sha',
      // Templates present so LLM validators would run IF not short-circuited.
      makeTemplateLoader(true),
    );

    // Assert: final_synthesis LLM invoke was NOT called (all LLM validators
    // short-circuited). LLM caller may have been called for pre-validator
    // (json_output_discipline_check is deterministic — no LLM call) but
    // must not have been called for final_synthesis or other LLM validators.
    // Since json_output_discipline_check is deterministic, callMock should
    // not have been called at all.
    expect(callMock).not.toHaveBeenCalled();

    // Assert: harness record has REVISE decision with the fixed short-circuit rationale.
    const completed = writerCtx.written
      .filter((r) => r.options.record_type === 'reasoning_review_harness_record')
      .map((r) => r.options.content as Record<string, unknown>)
      .find((c) => c.status === 'completed');
    expect(completed).toBeDefined();
    expect(completed!.decision_recommendation).toBe('REVISE');
    expect(typeof completed!.decision_rationale).toBe('string');
    expect((completed!.decision_rationale as string)).toContain('json_output_discipline_check');
    expect((completed!.decision_rationale as string)).toContain('short-circuited');

    // Assert: the json_output_discipline_check finding is present in allFindings.
    const findingRecords = writerCtx.written.filter(
      (r) => r.options.record_type === 'reasoning_review_finding_record',
    );
    const preValidatorFinding = findingRecords.find(
      (r) =>
        (r.options.content as Record<string, unknown>).validator_id ===
        'json_output_discipline_check',
    );
    expect(preValidatorFinding).toBeDefined();
    expect((preValidatorFinding!.options.content as Record<string, unknown>).severity).toBe('HIGH');
  });
});
