/**
 * Increment 2 — Synthesizer bounded ReAct loop.
 *
 * Drives the Synthesizer with a scripted fake LLM so we can assert the loop
 * mechanics precisely (no DB writes, no real model, GPU-free):
 *   - tool result → observation → chained final answer;
 *   - the common single-answer turn costs exactly one round-trip;
 *   - a forced final turn guarantees a non-empty answer (never dead-ends);
 *   - the no-progress / duplicate-call guard executes a repeated tool once.
 */

import { describe, it, expect } from 'vitest';
import { Synthesizer } from '../../../lib/agents/clientLiaison/synthesizer';
import { CapabilityRegistry, type CapabilityContext } from '../../../lib/agents/clientLiaison/capabilities/index';
import { getStatus } from '../../../lib/agents/clientLiaison/capabilities/informationRetrieval/index';
import type { PriorityLLMCaller } from '../../../lib/llm/priorityLLMCaller';
import type { LLMCallOptions, LLMCallResult } from '../../../lib/llm/llmCaller';
import type { TemplateLoader } from '../../../lib/orchestrator/templateLoader';
import type { OpenQuery, QueryClassification, RetrievalResult } from '../../../lib/agents/clientLiaison/types';

function llmResult(partial: Partial<LLMCallResult>): LLMCallResult {
  return {
    text: '',
    parsed: null,
    toolCalls: [],
    provider: 'mock',
    model: 'm',
    inputTokens: null,
    outputTokens: null,
    usedFallback: false,
    retryAttempts: 0,
    ...partial,
  };
}

/** A PriorityLLMCaller stand-in that replays a scripted list of results. */
function scriptedLLM(script: LLMCallResult[]) {
  const calls: LLMCallOptions[] = [];
  const llm = {
    async call(options: LLMCallOptions): Promise<LLMCallResult> {
      calls.push(options);
      return script.shift() ?? llmResult({});
    },
  } as unknown as PriorityLLMCaller;
  return { llm, calls };
}

const templates = {
  getTemplate: () => ({}),
  render: () => ({ rendered: 'SYNTHESIS PROMPT', missing_variables: [] }),
} as unknown as TemplateLoader;

function makeRegistry(): CapabilityRegistry {
  const r = new CapabilityRegistry();
  r.register(getStatus);
  return r;
}

function makeCtx(): CapabilityContext {
  return {
    workspaceId: 'w',
    workspaceRoot: '/w',
    activeRun: { id: 'run-1', status: 'in_progress' } as never,
    currentPhase: '1',
    currentSubPhase: null,
    runStatus: 'in_progress',
    orchestrator: {
      deepMemoryResearch: {},
      janumiCodeVersionSha: 'sha-1',
    } as never,
    db: {
      getWorkflowStatus: () => ({
        run: { id: 'run-1' },
        currentPhaseId: '1',
        currentSubPhaseId: null,
        status: 'in_progress',
        recentRecords: [],
      }),
    } as never,
    eventBus: {} as never,
    embedding: {} as never,
  };
}

const QUERY: OpenQuery = {
  id: 'q1',
  text: 'what is the status?',
  workflowRunId: 'run-1',
  currentPhaseId: '1',
  references: [],
};
const CLASSIFICATION: QueryClassification = {
  queryType: 'status_check',
  confidence: 1,
  shouldQueue: false,
};
const RETRIEVAL: RetrievalResult = { records: [], strategy: 'none' };

describe('Synthesizer ReAct loop (Increment 2)', () => {
  it('chains a tool call, observes the result, then answers', async () => {
    const { llm, calls } = scriptedLLM([
      llmResult({ toolCalls: [{ name: 'getStatus', params: {} }] }),
      llmResult({ text: 'All good — currently in Phase 1.' }),
    ]);
    const synth = new Synthesizer(llm, templates, makeRegistry(), { provider: 'mock', model: 'm' });

    const res = await synth.synthesize(QUERY, CLASSIFICATION, RETRIEVAL, makeCtx());

    expect(res.responseText).toBe('All good — currently in Phase 1.');
    const executed = res.capabilityCalls.filter((c) => c.name === 'getStatus' && c.result !== undefined);
    expect(executed).toHaveLength(1);
    expect(calls).toHaveLength(2); // observe turn + answer turn
  });

  it('answers a direct text turn in a single round-trip (no wasted iterations)', async () => {
    const { llm, calls } = scriptedLLM([llmResult({ text: 'Here is your answer.' })]);
    const synth = new Synthesizer(llm, templates, makeRegistry(), { provider: 'mock', model: 'm' });

    const res = await synth.synthesize(QUERY, CLASSIFICATION, RETRIEVAL, makeCtx());

    expect(res.responseText).toBe('Here is your answer.');
    expect(calls).toHaveLength(1);
  });

  it('never dead-ends: an always-empty model still yields a non-empty answer', async () => {
    const { llm, calls } = scriptedLLM([]); // every call returns an empty result
    const synth = new Synthesizer(llm, templates, makeRegistry(), { provider: 'mock', model: 'm' });

    const res = await synth.synthesize(QUERY, CLASSIFICATION, RETRIEVAL, makeCtx());

    expect(res.responseText.length).toBeGreaterThan(0);
    // Bounded — the loop must not spin past the iteration budget.
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.length).toBeLessThanOrEqual(4);
    // The final turn is forced tool-free.
    expect(calls[calls.length - 1].toolChoice).toBe('none');
  });

  it('executes a duplicated tool call only once (no-progress guard)', async () => {
    const { llm } = scriptedLLM([
      llmResult({ toolCalls: [{ name: 'getStatus', params: {} }] }),
      llmResult({ toolCalls: [{ name: 'getStatus', params: {} }] }), // same call again
      llmResult({ text: 'done' }),
    ]);
    const synth = new Synthesizer(llm, templates, makeRegistry(), { provider: 'mock', model: 'm' });

    const res = await synth.synthesize(QUERY, CLASSIFICATION, RETRIEVAL, makeCtx());

    expect(res.responseText).toBe('done');
    const executed = res.capabilityCalls.filter((c) => c.name === 'getStatus' && c.result !== undefined);
    expect(executed).toHaveLength(1);
  });
});
