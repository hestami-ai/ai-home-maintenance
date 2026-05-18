/**
 * Regression test runner — render + invoke + assert.
 *
 * Three exports:
 *   renderFromFixture — deterministic re-render of the current template
 *                       with the fixture's captured variables.
 *   invokeFromFixture — single Ollama call using the fixture's
 *                       invocation_params + rendered prompt. Live only.
 *   applyAssertions   — apply T1+T2+T3 assertions to a response.
 */

import { resolve } from 'node:path';

import { TemplateLoader } from '../../lib/orchestrator/templateLoader.js';
import { LLMCaller } from '../../lib/llm/llmCaller.js';
import { OllamaProvider } from '../../lib/llm/providers/ollama.js';
import { parseJsonWithRecovery } from '../../lib/llm/jsonRecovery.js';
import type {
  AssertionResult,
  AssertionCheck,
  Fixture,
} from './fixtureSchema.js';
import { checkT1Schema } from './assertions/t1Schema.js';
import { checkT2IdPreservation } from './assertions/t2IdPreservation.js';
import { checkT3Invariant } from './assertions/t3Invariants.js';
import { ollamaBaseUrl } from './ollamaPrecheck.js';

export interface RunResult {
  fresh_response_text: string;
  fresh_parsed_json: unknown | null;
  fresh_duration_ms: number;
}

// ── Source root resolution ──────────────────────────────────────────

/** Repo / package root — `src/test/regression/runner.ts` → up 3 levels. */
export const SOURCE_ROOT = resolve(__dirname, '..', '..', '..');

let _loader: TemplateLoader | null = null;
export function getTemplateLoader(): TemplateLoader {
  if (!_loader) _loader = new TemplateLoader(SOURCE_ROOT);
  return _loader;
}

// ── Rendering ───────────────────────────────────────────────────────

export function renderFromFixture(
  fixture: Fixture,
): { rendered: string; missingVariables: string[]; template_found: boolean } {
  const loader = getTemplateLoader();
  const tpl = loader.findTemplate(
    fixture.template_ref.agent_role,
    fixture.template_ref.sub_phase,
    fixture.template_ref.lens,
  );
  if (!tpl) {
    return { rendered: '', missingVariables: [], template_found: false };
  }
  const result = loader.render(tpl, fixture.template_variables);
  return {
    rendered: result.rendered,
    missingVariables: result.missing_variables,
    template_found: true,
  };
}

// ── Invocation ──────────────────────────────────────────────────────

let _caller: LLMCaller | null = null;
function getCaller(baseUrl?: string): LLMCaller {
  if (!_caller) {
    _caller = new LLMCaller({ maxRetries: 1 });
    _caller.registerProvider(new OllamaProvider(baseUrl ?? ollamaBaseUrl()));
  }
  return _caller;
}

export async function invokeFromFixture(
  fixture: Fixture,
  rendered: string,
): Promise<RunResult> {
  const caller = getCaller(fixture.invocation_params.base_url);
  const started = Date.now();
  // makeLLMValidator templates: rendered template is the SYSTEM message,
  // captured user_message carries the audit material. Standard producers:
  // rendered template IS the user prompt.
  const callArgs = fixture.user_message !== undefined
    ? { system: rendered, prompt: fixture.user_message }
    : { prompt: rendered };
  const result = await caller.call({
    provider: fixture.invocation_params.provider,
    model: fixture.invocation_params.model,
    ...callArgs,
    temperature: fixture.invocation_params.temperature,
    responseFormat: fixture.invocation_params.response_format,
    maxTokens: fixture.invocation_params.max_tokens,
  });
  const duration = Date.now() - started;
  let parsed: unknown | null = result.parsed;
  if (parsed === null && fixture.invocation_params.response_format === 'json') {
    const recovered = parseJsonWithRecovery(result.text);
    parsed = recovered.parsed ?? null;
  }
  return {
    fresh_response_text: result.text,
    fresh_parsed_json: parsed,
    fresh_duration_ms: duration,
  };
}

// ── Assertions ──────────────────────────────────────────────────────

export function applyAssertions(
  fixture: Fixture,
  responseText: string,
  parsedJson: unknown | null,
): AssertionResult {
  const checks: AssertionCheck[] = [];
  const requireJsonParse = fixture.assertions.require_json_parse
    ?? fixture.invocation_params.response_format === 'json';

  if (requireJsonParse && parsedJson === null) {
    checks.push({
      tier: 'T1',
      name: 'json_parse',
      passed: false,
      detail: `response did not parse as JSON (length ${responseText.length})`,
    });
  }

  if (fixture.assertions.t1_schema) {
    const t1 = checkT1Schema(
      fixture.assertions.t1_schema,
      parsedJson,
      responseText,
      requireJsonParse,
    );
    for (const c of t1) checks.push(c);
  }

  for (const a of fixture.assertions.t2_id_preservation) {
    checks.push(checkT2IdPreservation(a, fixture, parsedJson));
  }

  for (const a of fixture.assertions.t3_invariants) {
    checks.push(checkT3Invariant(a, parsedJson));
  }

  return {
    passed: checks.every((c) => c.passed),
    checks,
  };
}

export function formatFailureReport(result: AssertionResult): string {
  const fails = result.checks.filter((c) => !c.passed);
  if (fails.length === 0) return 'all checks passed';
  return fails
    .map((c) => `  [${c.tier}] ${c.name}: ${c.detail ?? '(no detail)'}`)
    .join('\n');
}
