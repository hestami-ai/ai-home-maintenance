/**
 * Regression tests for the LLM-powered gap suggestion generator.
 *
 * The base gap report's `suggested_fix` is a hardcoded recipe table
 * keyed by legacy record names — it misses JanumiCode v2.3 artifact
 * kinds (most real gaps fall through to the generic
 * "Implement handler" string). The LLM enhancer grounds the
 * suggestion in the governed-stream tail so a coding agent running
 * the virtuous cycle gets a pointer at the actual handler / prompt /
 * validator to change.
 *
 * These tests pin:
 *   1. On success, the LLM text flows into the return value verbatim.
 *   2. On LLM failure, the function returns null — the pipeline must
 *      not crash just because the gap enhancer couldn't reach a
 *      provider.
 *   3. The prompt includes the failed_at_phase pointer and at least
 *      one record-tail line so the LLM has context to work from.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import { generateLLMGapSuggestion } from '../../../../src/test/harness/gapReportEnhancer';
import type { LLMCaller } from '../../../lib/llm/llmCaller';
import type { GapReport } from '../../../../src/test/harness/types';

describe('generateLLMGapSuggestion', () => {
  let db: Database;
  const runId = 'run-llm-gap';

  beforeEach(() => {
    db = createTestDatabase();
    db.prepare(`INSERT INTO workflow_runs (id, workspace_id, current_phase_id, status, initiated_at, janumicode_version_sha) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(runId, 'ws-test', '1', 'running', new Date().toISOString(), 'dev');

    let idCounter = 0;
    const writer = new GovernedStreamWriter(db, () => `rec-${++idCounter}`);
    writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '1',
      sub_phase_id: '1.2',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: 'dev',
      content: { kind: 'intent_bloom', candidate_product_concepts: [] },
    });
    writer.writeRecord({
      record_type: 'agent_output',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '1',
      sub_phase_id: '1.4',
      produced_by_agent_role: 'domain_interpreter',
      janumicode_version_sha: 'dev',
      content: { text: 'Partial synthesis output ...' },
    });
  });

  afterEach(() => { db.close(); });

  const baseReport: GapReport = {
    phase: '1',
    failed_at_phase: '1',
    failed_at_sub_phase: '1.4',
    missing_records: [
      {
        record_type: 'artifact_produced[kind=intent_statement]',
        phase: '1',
        sub_phase: '1.4',
        reason: 'Phase 1.4 must synthesize an intent_statement.',
      },
    ],
    schema_violations: [],
    assertion_failures: [],
    suggested_fix: 'Generic fallback suggestion.',
    spec_references: [],
  };

  function stubCaller(responseText: string | Error): LLMCaller {
    const call = vi.fn().mockImplementation(async () => {
      if (responseText instanceof Error) throw responseText;
      return {
        text: responseText,
        parsed: null,
        toolCalls: [],
        provider: 'stub',
        model: 'stub-model',
        inputTokens: null,
        outputTokens: null,
        usedFallback: false,
        retryAttempts: 0,
      };
    });
    return { call } as unknown as LLMCaller;
  }

  it('returns the LLM response text on success', async () => {
    const caller = stubCaller('Check Phase 1.4 synthesizer prompt — the agent output shows a partial rendering.');
    const suggestion = await generateLLMGapSuggestion(db, runId, baseReport, caller, {
      provider: 'stub',
      model: 'stub-model',
    });
    expect(suggestion).toBe('Check Phase 1.4 synthesizer prompt — the agent output shows a partial rendering.');
  });

  it('returns null on LLM error so the pipeline keeps running', async () => {
    const caller = stubCaller(new Error('provider unreachable'));
    const suggestion = await generateLLMGapSuggestion(db, runId, baseReport, caller, {
      provider: 'stub',
      model: 'stub-model',
    });
    expect(suggestion).toBeNull();
  });

  it('returns null on empty response', async () => {
    const caller = stubCaller('   ');
    const suggestion = await generateLLMGapSuggestion(db, runId, baseReport, caller, {
      provider: 'stub',
      model: 'stub-model',
    });
    expect(suggestion).toBeNull();
  });

  it('grounds the prompt in failed_at_phase and the governed-stream tail', async () => {
    const capturedCalls: Array<{ prompt: string }> = [];
    const caller = {
      call: vi.fn().mockImplementation(async (opts: { prompt: string }) => {
        capturedCalls.push({ prompt: opts.prompt });
        return {
          text: 'ok',
          parsed: null,
          toolCalls: [],
          provider: 'stub',
          model: 'stub-model',
          inputTokens: null,
          outputTokens: null,
          usedFallback: false,
          retryAttempts: 0,
        };
      }),
    } as unknown as LLMCaller;

    await generateLLMGapSuggestion(db, runId, baseReport, caller, {
      provider: 'stub',
      model: 'stub-model',
    });
    expect(capturedCalls).toHaveLength(1);
    const prompt = capturedCalls[0].prompt;
    expect(prompt).toContain('Failed at phase: 1');
    expect(prompt).toContain('intent_statement');
    // Governed-stream tail should carry at least one of our writes.
    expect(prompt).toMatch(/artifact_produced|agent_output/);
  });
});
