import { describe, it, expect, vi } from 'vitest';
import {
  repairJsonViaLLM,
  type JsonRepairRouting,
  type JsonRepairGroundingContext,
  type JsonRepairTraceContext,
} from '../../../lib/llm/jsonRepairLLM';
import type { LLMCaller, LLMCallResult } from '../../../lib/llm/llmCaller';

// ── Test scaffolding ──────────────────────────────────────────────────

interface MockReply {
  /** Pre-parsed object the mock LLMCaller returns as `result.parsed`. */
  parsed?: Record<string, unknown> | null;
  /** Raw text the mock returns (used when parsed is null). */
  text?: string;
  /** Throw an error instead of returning a result. */
  throws?: Error;
}

/**
 * Build a stub LLMCaller whose `call()` returns a queued reply per
 * invocation. Each repair attempt consumes one reply. A test sequences
 * replies to simulate primary-success, primary-fail-fallback-success,
 * both-fail, etc.
 */
function makeStubCaller(replies: MockReply[]): LLMCaller {
  let i = 0;
  const calls: Array<{ provider: string; model: string; prompt: string; agentRole: string | null }> = [];
  const stub = {
    call: vi.fn(async (opts: {
      provider: string;
      model: string;
      prompt: string;
      traceContext?: { agentRole?: string | null };
    }) => {
      calls.push({
        provider: opts.provider,
        model: opts.model,
        prompt: opts.prompt,
        agentRole: opts.traceContext?.agentRole ?? null,
      });
      const reply = replies[i++] ?? { parsed: null };
      if (reply.throws) throw reply.throws;
      return {
        text: reply.text ?? '',
        parsed: reply.parsed ?? null,
        thinking: undefined,
        toolCalls: [],
        provider: opts.provider,
        model: opts.model,
        inputTokens: 0,
        outputTokens: 0,
        usedFallback: false,
        retryAttempts: 0,
      } as LLMCallResult;
    }),
    // Expose calls for assertion.
    __calls: calls,
  };
  return stub as unknown as LLMCaller;
}

const ROUTING: JsonRepairRouting = {
  primary: { provider: 'ollama', model: 'qwen3.5:9b' },
  fallback: { provider: 'ollama', model: 'gemma4:e4b' },
};

const GROUNDING: JsonRepairGroundingContext = {
  originalPrompt: 'You are a domain interpreter. Output JSON of shape { phasingStrategy: [...] }.',
  originalSystem: 'You are JanumiCode v2.',
  originalThinking: 'I should produce a phasing strategy with three phases.',
  originalAgentRole: 'domain_interpreter',
};

const TRACE: JsonRepairTraceContext = {
  workflowRunId: 'run-1',
  phaseId: '1',
  subPhaseId: 'product_intent_discovery',
};

// ── Pathology fixtures (real cases captured from calibration runs) ───

/**
 * Each fixture is a malformed JSON shape that the deleted local
 * recovery passes used to handle. The new flow hands them to the
 * json_repair LLM. Tests below assert the flow fires and the parsed
 * result reaches the caller when the mock model returns valid JSON.
 */
const PATHOLOGY_FIXTURES = {
  duplicateKey: '{"phase": "phase": "Phase 3", "description": "third pillar"}',
  trailingComma: '{"items": [1, 2, 3,], "status": "ok",}',
  strayQuoteAfterNumber: '{"stepNumber": 3", "label": "step three"}',
  strayColonAfterObjectOpen: '{ : "key": "value", "other": 1 }',
  straySlash: '{"path": "/usr/bin", / "comment": "stray slash"}',
  orphanQuoteColon: '{": "value", "real_key": 42}',
  // Properly-formed JSON that the mocked repair model would return:
  validRepair: { phase: 'Phase 3', description: 'third pillar' },
};

// ── Tests ─────────────────────────────────────────────────────────────

describe('repairJsonViaLLM', () => {
  describe('happy path — primary attempt succeeds', () => {
    it('returns parsed result from primary; does not call fallback', async () => {
      const caller = makeStubCaller([
        { parsed: PATHOLOGY_FIXTURES.validRepair },
      ]);
      const result = await repairJsonViaLLM(
        PATHOLOGY_FIXTURES.duplicateKey,
        ROUTING,
        GROUNDING,
        TRACE,
        caller,
      );
      expect(result.parsed).toEqual(PATHOLOGY_FIXTURES.validRepair);
      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0].routing.model).toBe('qwen3.5:9b');
      expect(result.attempts[0].parsed).toEqual(PATHOLOGY_FIXTURES.validRepair);
      expect((caller as unknown as { __calls: unknown[] }).__calls).toHaveLength(1);
    });
  });

  describe('fallback path — primary fails, fallback succeeds', () => {
    it('falls through to fallback model when primary returns parsed=null', async () => {
      const caller = makeStubCaller([
        { parsed: null, text: 'still broken {{{' },
        { parsed: PATHOLOGY_FIXTURES.validRepair },
      ]);
      const result = await repairJsonViaLLM(
        PATHOLOGY_FIXTURES.duplicateKey,
        ROUTING,
        GROUNDING,
        TRACE,
        caller,
      );
      expect(result.parsed).toEqual(PATHOLOGY_FIXTURES.validRepair);
      expect(result.attempts).toHaveLength(2);
      expect(result.attempts[0].parsed).toBeNull();
      expect(result.attempts[0].error).toBeDefined();
      expect(result.attempts[1].routing.model).toBe('gemma4:e4b');
      expect(result.attempts[1].parsed).toEqual(PATHOLOGY_FIXTURES.validRepair);
    });

    it('falls through when primary throws an error', async () => {
      const caller = makeStubCaller([
        { throws: new Error('connection refused') },
        { parsed: PATHOLOGY_FIXTURES.validRepair },
      ]);
      const result = await repairJsonViaLLM(
        PATHOLOGY_FIXTURES.trailingComma,
        ROUTING,
        GROUNDING,
        TRACE,
        caller,
      );
      expect(result.parsed).toEqual(PATHOLOGY_FIXTURES.validRepair);
      expect(result.attempts[0].error).toBe('connection refused');
    });

    it('parses primary text via tryParseJson when result.parsed is null but text is valid JSON', async () => {
      // Some providers leave parsed=null but the text is valid JSON
      // anyway (e.g. wrapped in markdown). The repair function should
      // run extractJsonObject + JSON.parse before declaring failure.
      const caller = makeStubCaller([
        { parsed: null, text: '```json\n{"phase":"Phase 3","description":"third pillar"}\n```' },
      ]);
      const result = await repairJsonViaLLM(
        PATHOLOGY_FIXTURES.duplicateKey,
        ROUTING,
        GROUNDING,
        TRACE,
        caller,
      );
      expect(result.parsed).toEqual({ phase: 'Phase 3', description: 'third pillar' });
      expect(result.attempts).toHaveLength(1);
    });
  });

  describe('total failure path — both attempts fail', () => {
    it('returns parsed=null with both attempt records', async () => {
      const caller = makeStubCaller([
        { parsed: null, text: 'still broken' },
        { parsed: null, text: 'also broken' },
      ]);
      const result = await repairJsonViaLLM(
        PATHOLOGY_FIXTURES.duplicateKey,
        ROUTING,
        GROUNDING,
        TRACE,
        caller,
      );
      expect(result.parsed).toBeNull();
      expect(result.attempts).toHaveLength(2);
      expect(result.attempts[0].parsed).toBeNull();
      expect(result.attempts[1].parsed).toBeNull();
    });

    it('records error message on each failed attempt for diagnostics', async () => {
      const caller = makeStubCaller([
        { throws: new Error('primary down') },
        { throws: new Error('fallback also down') },
      ]);
      const result = await repairJsonViaLLM(
        PATHOLOGY_FIXTURES.duplicateKey,
        ROUTING,
        GROUNDING,
        TRACE,
        caller,
      );
      expect(result.parsed).toBeNull();
      expect(result.attempts[0].error).toBe('primary down');
      expect(result.attempts[1].error).toBe('fallback also down');
    });
  });

  describe('grounding context passed to repair model', () => {
    it('includes original prompt + system + thinking in the repair prompt', async () => {
      const caller = makeStubCaller([{ parsed: PATHOLOGY_FIXTURES.validRepair }]);
      await repairJsonViaLLM(
        PATHOLOGY_FIXTURES.duplicateKey,
        ROUTING,
        GROUNDING,
        TRACE,
        caller,
      );
      const sentPrompt = (caller as unknown as { __calls: Array<{ prompt: string }> }).__calls[0].prompt;
      expect(sentPrompt).toContain(GROUNDING.originalPrompt);
      expect(sentPrompt).toContain(GROUNDING.originalSystem!);
      expect(sentPrompt).toContain(GROUNDING.originalThinking!);
      expect(sentPrompt).toContain(GROUNDING.originalAgentRole!);
      expect(sentPrompt).toContain(PATHOLOGY_FIXTURES.duplicateKey);
    });

    it('includes optional schema hint when provided', async () => {
      const caller = makeStubCaller([{ parsed: PATHOLOGY_FIXTURES.validRepair }]);
      await repairJsonViaLLM(
        PATHOLOGY_FIXTURES.duplicateKey,
        ROUTING,
        { ...GROUNDING, expectedJsonSchema: 'interface PhasingPhase { phase: string; description: string; }' },
        TRACE,
        caller,
      );
      const sentPrompt = (caller as unknown as { __calls: Array<{ prompt: string }> }).__calls[0].prompt;
      expect(sentPrompt).toContain('PhasingPhase');
      expect(sentPrompt).toContain('EXPECTED OUTPUT SCHEMA');
    });

    it('omits schema hint section when not provided', async () => {
      const caller = makeStubCaller([{ parsed: PATHOLOGY_FIXTURES.validRepair }]);
      await repairJsonViaLLM(
        PATHOLOGY_FIXTURES.duplicateKey,
        ROUTING,
        { ...GROUNDING, expectedJsonSchema: null },
        TRACE,
        caller,
      );
      const sentPrompt = (caller as unknown as { __calls: Array<{ prompt: string }> }).__calls[0].prompt;
      expect(sentPrompt).not.toContain('EXPECTED OUTPUT SCHEMA');
    });

    it('marks repair calls with agentRole=json_repair and label=json_repair_attempt_N', async () => {
      const caller = makeStubCaller([
        { parsed: null, text: 'fail' },
        { parsed: PATHOLOGY_FIXTURES.validRepair },
      ]);
      await repairJsonViaLLM(
        PATHOLOGY_FIXTURES.duplicateKey,
        ROUTING,
        GROUNDING,
        TRACE,
        caller,
      );
      const stub = caller as unknown as { call: { mock: { calls: Array<unknown[]> } } };
      const firstCall = stub.call.mock.calls[0][0] as { traceContext: { agentRole: string; label: string } };
      const secondCall = stub.call.mock.calls[1][0] as { traceContext: { agentRole: string; label: string } };
      expect(firstCall.traceContext.agentRole).toBe('json_repair');
      expect(firstCall.traceContext.label).toBe('json_repair_attempt_1');
      expect(secondCall.traceContext.label).toBe('json_repair_attempt_2');
    });
  });

  describe('routing without fallback — primary-only', () => {
    it('returns null after primary failure when no fallback is configured', async () => {
      const caller = makeStubCaller([{ parsed: null, text: 'broken' }]);
      const result = await repairJsonViaLLM(
        PATHOLOGY_FIXTURES.duplicateKey,
        { primary: ROUTING.primary }, // no fallback
        GROUNDING,
        TRACE,
        caller,
      );
      expect(result.parsed).toBeNull();
      expect(result.attempts).toHaveLength(1);
    });
  });

  describe('historical pathologies (regression coverage)', () => {
    // These were the patterns the deleted local recovery passes
    // handled. They now flow through the json_repair LLM. The mock
    // returns a valid object on the first attempt so we're testing
    // the *integration* (does the broken input flow through the
    // repair plumbing intact?), not whether the LLM actually
    // repairs them — the latter requires a live model.
    const cases: Array<[string, string]> = [
      ['duplicate key', PATHOLOGY_FIXTURES.duplicateKey],
      ['trailing comma', PATHOLOGY_FIXTURES.trailingComma],
      ['stray quote after number', PATHOLOGY_FIXTURES.strayQuoteAfterNumber],
      ['stray colon after object open', PATHOLOGY_FIXTURES.strayColonAfterObjectOpen],
      ['stray slash outside strings', PATHOLOGY_FIXTURES.straySlash],
      ['orphan quote-colon property', PATHOLOGY_FIXTURES.orphanQuoteColon],
    ];
    for (const [name, broken] of cases) {
      it(`flows ${name} pathology to repair model intact`, async () => {
        const caller = makeStubCaller([{ parsed: PATHOLOGY_FIXTURES.validRepair }]);
        const result = await repairJsonViaLLM(broken, ROUTING, GROUNDING, TRACE, caller);
        expect(result.parsed).toEqual(PATHOLOGY_FIXTURES.validRepair);
        const sentPrompt = (caller as unknown as { __calls: Array<{ prompt: string }> }).__calls[0].prompt;
        expect(sentPrompt).toContain(broken);
      });
    }
  });
});
