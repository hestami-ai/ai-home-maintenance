/**
 * Live-ollama integration test for json_repair.
 *
 * Tests that the repair flow can actually fix real-world JSON
 * pathologies by hitting a running ollama instance with the configured
 * primary (qwen3.5:9b) and fallback (gemma4:e4b) models.
 *
 * Skipped gracefully when ollama isn't reachable. Requires:
 *   - `ollama serve` running
 *   - `qwen3.5:9b` model pulled
 *   - `gemma4:e4b` model pulled
 *
 * Each pathology was captured from a real calibration run failure.
 * The previous local recovery passes handled them via regex; this
 * suite confirms the LLM repair path produces a parseable object for
 * each. Doesn't assert exact shape — LLMs aren't deterministic — only
 * that the output parses and is a non-empty object.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  repairJsonViaLLM,
  type JsonRepairRouting,
  type JsonRepairGroundingContext,
  type JsonRepairTraceContext,
} from '../../../lib/llm/jsonRepairLLM';
import { LLMCaller } from '../../../lib/llm/llmCaller';
import { OllamaProvider } from '../../../lib/llm/providers/ollama';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';

let llmCaller: LLMCaller;
let ollamaReachable = false;

async function probeOllama(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    return res.ok;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  ollamaReachable = await probeOllama();
  if (!ollamaReachable) {
    console.warn(`[live-ollama] skipping json_repair tests — ${OLLAMA_URL} not reachable`);
    return;
  }
  llmCaller = new LLMCaller({ maxRetries: 1 });
  llmCaller.registerProvider(new OllamaProvider());
});

const ROUTING: JsonRepairRouting = {
  primary: { provider: 'ollama', model: 'qwen3.5:9b', temperature: 0 },
  fallback: { provider: 'ollama', model: 'gemma4:e4b', temperature: 0 },
};

const TRACE: JsonRepairTraceContext = {
  workflowRunId: 'live-test-run',
  phaseId: '1',
  subPhaseId: 'product_intent_discovery',
};

function grounding(opts: Partial<JsonRepairGroundingContext> = {}): JsonRepairGroundingContext {
  return {
    originalPrompt: opts.originalPrompt ?? 'Output a JSON object describing a phasing strategy.',
    originalSystem: opts.originalSystem ?? 'You are a domain interpreter for a software workflow.',
    originalThinking: opts.originalThinking ?? null,
    originalAgentRole: opts.originalAgentRole ?? 'domain_interpreter',
    expectedJsonSchema: opts.expectedJsonSchema ?? null,
  };
}

/**
 * Each pathology fixture below was captured from a real calibration
 * run. Test naming `[live-ollama]` so failures don't block CI when
 * ollama isn't available.
 */

describe('repairJsonViaLLM [live-ollama] — real-world pathologies', () => {
  it('repairs duplicate-key pathology (cal-25 product_intent_discovery)', async () => {
    if (!ollamaReachable) return;
    const broken = `{
  "phasingStrategy": [
    { "phase": "Phase 1", "description": "Home Real Property Assistant" },
    { "phase": "phase": "Phase 3", "description": "Community Association Management" }
  ]
}`;
    const result = await repairJsonViaLLM(
      broken,
      ROUTING,
      grounding({
        expectedJsonSchema: 'interface PhasingPhase { phase: string; description: string; } interface Out { phasingStrategy: PhasingPhase[]; }',
      }),
      TRACE,
      llmCaller,
    );
    expect(result.parsed).not.toBeNull();
    expect(typeof result.parsed).toBe('object');
    const parsed = result.parsed as { phasingStrategy?: Array<{ phase: string }> };
    expect(Array.isArray(parsed.phasingStrategy)).toBe(true);
    expect(parsed.phasingStrategy?.length).toBeGreaterThanOrEqual(2);
  }, 120_000);

  it('repairs trailing-comma pathology', async () => {
    if (!ollamaReachable) return;
    const broken = `{
  "items": [
    {"field": "x", "status": "present", "severity": "low",},
  ],
  "overall_status": "pass",
}`;
    const result = await repairJsonViaLLM(
      broken,
      ROUTING,
      grounding({
        expectedJsonSchema: 'interface Out { items: Array<{ field: string; status: string; severity: string; }>; overall_status: string; }',
      }),
      TRACE,
      llmCaller,
    );
    expect(result.parsed).not.toBeNull();
    const parsed = result.parsed as { overall_status?: string; items?: unknown[] };
    expect(parsed.overall_status).toBe('pass');
    expect(Array.isArray(parsed.items)).toBe(true);
  }, 120_000);

  it('repairs stray-quote-after-number pathology', async () => {
    if (!ollamaReachable) return;
    const broken = `{
  "steps": [
    {"stepNumber": 3", "label": "step three"},
    {"stepNumber": 4, "label": "step four"}
  ]
}`;
    const result = await repairJsonViaLLM(
      broken,
      ROUTING,
      grounding({
        expectedJsonSchema: 'interface Step { stepNumber: number; label: string; } interface Out { steps: Step[]; }',
      }),
      TRACE,
      llmCaller,
    );
    expect(result.parsed).not.toBeNull();
    const parsed = result.parsed as { steps?: Array<{ stepNumber: number; label: string }> };
    expect(Array.isArray(parsed.steps)).toBe(true);
    expect(typeof parsed.steps?.[0].stepNumber).toBe('number');
  }, 120_000);

  it('repairs orphan-quote-colon pathology', async () => {
    if (!ollamaReachable) return;
    const broken = `{
  "": "junk_value",
  "real_key": 42,
  "other": "value"
}`;
    const result = await repairJsonViaLLM(
      broken,
      ROUTING,
      grounding({
        expectedJsonSchema: 'interface Out { real_key: number; other: string; }',
      }),
      TRACE,
      llmCaller,
    );
    expect(result.parsed).not.toBeNull();
    const parsed = result.parsed as { real_key?: number; other?: string };
    expect(parsed.real_key).toBe(42);
    expect(parsed.other).toBe('value');
  }, 120_000);

  it('falls back to gemma when qwen returns junk (live model behavior is non-deterministic; this case may flake)', async () => {
    // Synthetic case that's hard to repair without context. We pass
    // no schema hint and intentionally vague grounding so the primary
    // model has a higher chance of producing junk; this exercises the
    // primary→fallback transition end-to-end.
    if (!ollamaReachable) return;
    const broken = `{ ??? "broken": "very" ??? }`;
    const result = await repairJsonViaLLM(
      broken,
      ROUTING,
      grounding({}),
      TRACE,
      llmCaller,
    );
    // We don't assert success here — just that we exercised the path
    // and got either a parseable result or a clean two-attempt failure.
    expect(result.attempts.length).toBeGreaterThanOrEqual(1);
    if (!result.parsed) {
      expect(result.attempts.length).toBe(2);
    }
  }, 180_000);
});
