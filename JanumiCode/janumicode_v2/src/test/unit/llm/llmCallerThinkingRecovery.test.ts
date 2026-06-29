/**
 * Layer 2c — thinking-channel recovery.
 *
 * Root cause (cal-29, 2026-06-28, see project_gemma4_31b_decomposition_divergence):
 * gemma4:31b-it-qat on complex compliance NFRs emits its ENTIRE answer —
 * final JSON values, even a self-check "starts with {" — into the THINKING
 * channel and leaves the response channel EMPTY (no done frame). The two
 * pre-existing repair layers (2a deterministic, 2b LLM) both require a
 * NON-EMPTY response, so neither fires; the answer the model already spent
 * 40-50s producing is discarded, the call resolves as a silent empty
 * success, and a zero-tolerance gate (Phase-2.2c) blocks the whole run.
 *
 * Layer 2c hands the thinking to the SAME json_repair sequence in
 * reasoning-channel mode and recovers the answer without re-generation.
 */

import { describe, it, expect } from 'vitest';
import { LLMCaller } from '../../../lib/llm/llmCaller';
import type { LLMCallOptions, LLMCallResult, LLMProviderAdapter } from '../../../lib/llm/llmCaller';

const RECOVERED = {
  id: 'NFR-007',
  threshold: '100% of credential lapses removed from search within 60 minutes.',
  measurement_method: 'Continuous audit log correlation between expiry events and index updates.',
};

const SWALLOWED_THINKING = [
  '*   Threshold Analysis: seed says removal within 1 hour.',
  '*   `threshold`: "100% of credential lapses removed from search within 60 minutes."',
  '*   `measurement_method`: "Continuous audit log correlation between expiry events and index updates."',
  '*   No markdown fences? Yes. Starts with `{`, ends with `}`? Yes. No prose? Yes.',
].join('\n');

interface ProviderBehavior {
  /** Result for the main (non-repair) call. */
  main: Partial<LLMCallResult>;
  /** Result for the json_repair call. */
  repair?: Partial<LLMCallResult>;
}

function makeProvider(behavior: ProviderBehavior): {
  provider: LLMProviderAdapter;
  calls: Array<{ agentRole: string | null; prompt: string }>;
} {
  const calls: Array<{ agentRole: string | null; prompt: string }> = [];
  const base = (options: LLMCallOptions): LLMCallResult => ({
    text: '', parsed: null, thinking: undefined, toolCalls: [],
    provider: options.provider, model: options.model,
    inputTokens: 0, outputTokens: 0, usedFallback: false, retryAttempts: 0,
  });
  const provider: LLMProviderAdapter = {
    name: 'ollama',
    async call(options: LLMCallOptions): Promise<LLMCallResult> {
      const role = options.traceContext?.agentRole ?? null;
      calls.push({ agentRole: role, prompt: options.prompt });
      if (role === 'json_repair') {
        return { ...base(options), ...(behavior.repair ?? {}) };
      }
      return { ...base(options), ...behavior.main };
    },
  };
  return { provider, calls };
}

function newCaller(provider: LLMProviderAdapter): LLMCaller {
  const caller = new LLMCaller({ maxRetries: 1 });
  caller.registerProvider(provider);
  caller.setJsonRepairRouting({ primary: { provider: 'ollama', model: 'qwen3.5:9b' } });
  return caller;
}

describe('LLMCaller — Layer 2c thinking-channel recovery', () => {
  it('recovers JSON from the thinking channel when the response channel is empty', async () => {
    const { provider, calls } = makeProvider({
      main: { text: '', parsed: null, thinking: SWALLOWED_THINKING, outputTokens: null },
      repair: { text: JSON.stringify(RECOVERED), parsed: RECOVERED },
    });
    const caller = newCaller(provider);

    const result = await caller.call({
      provider: 'ollama', model: 'gemma4:31b-it-qat',
      prompt: 'Enrich NFR-007 threshold + measurement_method.',
      responseFormat: 'json',
      traceContext: { workflowRunId: 'r1', phaseId: '2', subPhaseId: 'nfr_bloom_enrichment', agentRole: 'requirements_agent' },
    });

    expect(result.parsed).toEqual(RECOVERED);
    const repairCall = calls.find(c => c.agentRole === 'json_repair');
    expect(repairCall).toBeDefined();
    // Reasoning-channel framing, against the thinking content (not broken JSON).
    expect(repairCall!.prompt).toContain('AGENT REASONING CONTAINING THE ANSWER');
    expect(repairCall!.prompt).toContain(SWALLOWED_THINKING);
    expect(repairCall!.prompt).not.toContain('BROKEN JSON OUTPUT');
  });

  it('does NOT fire when the response channel is non-empty (normal path)', async () => {
    const { provider, calls } = makeProvider({
      main: { text: JSON.stringify(RECOVERED), parsed: RECOVERED, thinking: SWALLOWED_THINKING },
    });
    const caller = newCaller(provider);

    const result = await caller.call({
      provider: 'ollama', model: 'gemma4:31b-it-qat',
      prompt: 'Enrich NFR-007.', responseFormat: 'json',
      traceContext: { workflowRunId: 'r1', phaseId: '2', subPhaseId: 'nfr_bloom_enrichment', agentRole: 'requirements_agent' },
    });

    expect(result.parsed).toEqual(RECOVERED);
    expect(calls.some(c => c.agentRole === 'json_repair')).toBe(false);
  });

  it('leaves parsed=null (→ caller re-generates) when the thinking is truncated/unrecoverable', async () => {
    const { provider } = makeProvider({
      main: { text: '', parsed: null, thinking: '*   Drafting Measurement Method: "Automated rule-validation suite comparing', outputTokens: null },
      repair: { text: '{"_repair_error":"unrepairable","reason":"truncated"}', parsed: { _repair_error: 'unrepairable', reason: 'truncated' } },
    });
    const caller = newCaller(provider);

    const result = await caller.call({
      provider: 'ollama', model: 'gemma4:31b-it-qat',
      prompt: 'Enrich NFR-005.', responseFormat: 'json',
      traceContext: { workflowRunId: 'r1', phaseId: '2', subPhaseId: 'nfr_bloom_enrichment', agentRole: 'requirements_agent' },
    });

    // The _repair_error sentinel must NOT masquerade as the real answer.
    expect(result.parsed).toBeNull();
  });

  it('does NOT fire for non-json responseFormat even when thinking is present', async () => {
    const { provider, calls } = makeProvider({
      main: { text: '', parsed: null, thinking: SWALLOWED_THINKING },
    });
    const caller = newCaller(provider);

    await caller.call({
      provider: 'ollama', model: 'gemma4:31b-it-qat',
      prompt: 'Summarize.', // no responseFormat: 'json'
      traceContext: { workflowRunId: 'r1', phaseId: '2', subPhaseId: 'x', agentRole: 'requirements_agent' },
    });

    expect(calls.some(c => c.agentRole === 'json_repair')).toBe(false);
  });

  it('does NOT fire for a json_repair call itself (no recursion)', async () => {
    const { provider, calls } = makeProvider({
      main: { text: '', parsed: null, thinking: SWALLOWED_THINKING },
    });
    const caller = newCaller(provider);

    await caller.call({
      provider: 'ollama', model: 'qwen3.5:9b',
      prompt: 'repair', responseFormat: 'json',
      traceContext: { workflowRunId: 'r1', phaseId: '2', subPhaseId: 'x', agentRole: 'json_repair' },
    });

    // The single call IS the repair role; recovery must not re-enter.
    expect(calls.filter(c => c.agentRole === 'json_repair')).toHaveLength(1);
  });
});
