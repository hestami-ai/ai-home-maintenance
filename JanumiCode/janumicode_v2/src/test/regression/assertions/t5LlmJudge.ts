/**
 * T5 — LLM-as-judge assertions. A separate model evaluates whether the
 * fresh response complies with a stated design principle.
 *
 * Currently a single kind: `principle_compliance`. The judge prompt asks
 * the model to assess whether the fresh decomposition output applies
 * Single-Service Principle at Tier A and SRP at Tier C/D (matching the
 * prompt-level guidance added to component_decomposition prompts).
 *
 * Cost: one extra LLM call per fixture per judge. Opt-in via the
 * `JANUMICODE_REGRESSION_LLM_JUDGE` env var (any truthy value enables;
 * absent/empty disables and the check is skipped as a no-op pass).
 *
 * Severity defaults to `advisory` — judge disagreements report but do
 * not fail the overall assertion run.
 */
import type { AssertionCheck, T5LlmJudgeAssertion } from '../fixtureSchema.js';
import { LLMCaller } from '../../../lib/llm/llmCaller.js';
import { OllamaProvider } from '../../../lib/llm/providers/ollama.js';
import { parseJsonWithRecovery } from '../../../lib/llm/jsonRecovery.js';
import { ollamaBaseUrl } from '../ollamaPrecheck.js';

let _judgeCaller: LLMCaller | null = null;
function getJudgeCaller(baseUrl?: string): LLMCaller {
  if (!_judgeCaller) {
    _judgeCaller = new LLMCaller({ maxRetries: 1 });
    _judgeCaller.registerProvider(new OllamaProvider(baseUrl ?? ollamaBaseUrl()));
  }
  return _judgeCaller;
}

export function isJudgeEnabled(): boolean {
  const v = process.env.JANUMICODE_REGRESSION_LLM_JUDGE;
  return v !== undefined && v !== '' && v !== '0' && v.toLowerCase() !== 'false';
}

const DEFAULT_PRINCIPLE_COMPLIANCE_PROMPT = `You are evaluating a software-component decomposition for compliance with two design principles applied at different tiers:

1. **Single-Service Principle at Tier A (top-level components / services).** Each top-level component should encapsulate ONE business capability. A Tier-A component SHOULD bundle several closely-related responsibilities that all serve the same capability. Splitting a single capability into multiple Tier-A siblings (e.g. "Order Validation Service", "Order Persistence Service", "Order Emission Service") is over-decomposition — they should be one "Order Lifecycle" component.

2. **Single-Responsibility Principle at Tier C/D (modules, atomic units).** Each module-level node should have ONE reason to change.

A common failure mode is applying SRP at Tier A: producing many fine-grained Tier-A components each with a single verb-led responsibility, often with ID-suffix drift (-A, -B, -C variants of the same noun) and chatty cross-sibling dependencies. This produces microservice sprawl.

Below is a component decomposition output. Evaluate whether it shows signs of SRP-at-Tier-A over-decomposition. Output STRICT JSON with this shape (no markdown fences, no prose):

{
  "pass": <boolean>,
  "smells_detected": [<short string identifiers, e.g. "single_verb_siblings", "id_suffix_drift", "low_cohesion_split">],
  "reasoning": "<one or two sentences explaining the verdict>"
}

Component decomposition output:
<<<RESPONSE>>>
`;

interface JudgeVerdict {
  pass: boolean;
  smells_detected: string[];
  reasoning: string;
}

function parseJudgeOutput(text: string, parsed: unknown): JudgeVerdict | null {
  let obj = parsed;
  if (obj === null) {
    const r = parseJsonWithRecovery(text);
    obj = r.parsed ?? null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const pass = typeof o.pass === 'boolean' ? o.pass : null;
  if (pass === null) return null;
  const smells = Array.isArray(o.smells_detected)
    ? o.smells_detected.filter((x): x is string => typeof x === 'string')
    : [];
  const reasoning = typeof o.reasoning === 'string' ? o.reasoning : '';
  return { pass, smells_detected: smells, reasoning };
}

export async function checkT5LlmJudge(
  assertion: T5LlmJudgeAssertion,
  responseText: string,
): Promise<AssertionCheck> {
  const severity = assertion.severity ?? 'advisory';
  if (!isJudgeEnabled()) {
    return {
      tier: 'T5',
      name: assertion.name,
      passed: true,
      severity,
      detail: 'judge disabled (JANUMICODE_REGRESSION_LLM_JUDGE unset) — skipped',
    };
  }
  if (!responseText || responseText.trim().length === 0) {
    return {
      tier: 'T5',
      name: assertion.name,
      passed: false,
      severity,
      detail: 'no response text to judge',
    };
  }

  const promptTemplate = assertion.judge_prompt_template ?? DEFAULT_PRINCIPLE_COMPLIANCE_PROMPT;
  const judgePrompt = promptTemplate.replace('<<<RESPONSE>>>', responseText);
  const judgeModel = assertion.judge_model ?? process.env.JANUMICODE_REGRESSION_LLM_JUDGE_MODEL ?? 'gemma3:4b';
  const judgeProvider = assertion.judge_provider ?? 'ollama';

  let result: { text: string; parsed: unknown };
  try {
    const caller = getJudgeCaller();
    const r = await caller.call({
      provider: judgeProvider,
      model: judgeModel,
      prompt: judgePrompt,
      temperature: 0.1,
      responseFormat: 'json',
    });
    result = { text: r.text, parsed: r.parsed };
  } catch (err) {
    return {
      tier: 'T5',
      name: assertion.name,
      passed: false,
      severity,
      detail: `judge invocation failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const verdict = parseJudgeOutput(result.text, result.parsed);
  if (!verdict) {
    return {
      tier: 'T5',
      name: assertion.name,
      passed: false,
      severity,
      detail: `judge output could not be parsed (length ${result.text.length}); preview: ${result.text.slice(0, 200)}`,
    };
  }
  return {
    tier: 'T5',
    name: assertion.name,
    passed: verdict.pass,
    severity,
    detail: verdict.pass
      ? `judge: ${verdict.reasoning}`
      : `judge flagged smells [${verdict.smells_detected.join(', ')}]: ${verdict.reasoning}`,
  };
}
