/**
 * LLM-based JSON repair fallback.
 *
 * When a model call requested `responseFormat: 'json'` and the
 * response can't be parsed, hand the broken text to a dedicated
 * `json_repair` agent — a meta-role that any other agent can fall
 * back to. Two attempts in sequence:
 *
 *   1. PRIMARY repair model (default: qwen3.5:9b — large, capable)
 *   2. FALLBACK repair model (default: gemma4:e4b — different family,
 *      different bias)
 *
 * Both attempts receive the original prompt + system + thinking chain
 * as grounding context so the repair model understands what the JSON
 * was supposed to represent. Without that context, a repair model
 * could produce syntactically valid but semantically wrong JSON
 * (e.g. invent fields, drop values it can't interpret).
 *
 * If both attempts fail, the caller halts. There is no third layer.
 *
 * Single-GPU constraint: the two attempts are strictly sequential.
 * The async signature is just for normal control flow.
 */

import { tryParseJson } from './jsonRecovery';
import type { LLMCaller } from './llmCaller';

export interface JsonRepairModelRouting {
  provider: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
}

export interface JsonRepairRouting {
  primary: JsonRepairModelRouting;
  fallback?: JsonRepairModelRouting;
}

export interface JsonRepairGroundingContext {
  /** The original prompt that produced the malformed JSON. */
  originalPrompt: string;
  /** The original system prompt, if any. */
  originalSystem?: string | null;
  /** The model's thinking chain from the original call, if it emitted one. */
  originalThinking?: string | null;
  /** The agent role that produced the malformed JSON (for diagnostics). */
  originalAgentRole?: string | null;
  /**
   * Schema hint for the expected JSON shape. Free-form: a JSON Schema,
   * a TypeScript interface, or an example object. Passed verbatim to
   * the repair prompt so the model can match the shape downstream code
   * expects, rather than inventing fields or dropping unfamiliar ones.
   */
  expectedJsonSchema?: string | null;
  /**
   * When true, `brokenText` is NOT malformed JSON — it is the model's
   * reasoning/thinking channel, into which it emitted its final answer
   * while leaving the response channel empty (observed: gemma4:31b-it-qat
   * on complex compliance NFRs — see project_gemma4_31b_decomposition_divergence).
   * The prompt then asks to EXTRACT the agent's intended final JSON
   * object from that reasoning rather than fix broken syntax.
   */
  inputIsReasoningChannel?: boolean;
}

export interface JsonRepairTraceContext {
  workflowRunId: string;
  phaseId: string | null;
  subPhaseId: string | null;
}

export interface JsonRepairAttempt {
  routing: JsonRepairModelRouting;
  parsed: Record<string, unknown> | null;
  error?: string;
  durationMs: number;
}

export interface JsonRepairResult {
  parsed: Record<string, unknown> | null;
  attempts: JsonRepairAttempt[];
}

/**
 * Run the json_repair sequence: primary → (if needed) fallback.
 * Returns the repaired parse on first success, or both attempt records
 * on total failure for diagnostic purposes.
 */
export async function repairJsonViaLLM(
  brokenText: string,
  routing: JsonRepairRouting,
  grounding: JsonRepairGroundingContext,
  trace: JsonRepairTraceContext,
  llmCaller: LLMCaller,
): Promise<JsonRepairResult> {
  const attempts: JsonRepairAttempt[] = [];

  const primary = await runRepairAttempt(
    brokenText, routing.primary, grounding, trace, llmCaller, 1,
  );
  attempts.push(primary);
  if (primary.parsed) return { parsed: primary.parsed, attempts };

  if (routing.fallback) {
    const secondary = await runRepairAttempt(
      brokenText, routing.fallback, grounding, trace, llmCaller, 2,
    );
    attempts.push(secondary);
    if (secondary.parsed) return { parsed: secondary.parsed, attempts };
  }

  return { parsed: null, attempts };
}

async function runRepairAttempt(
  brokenText: string,
  modelRouting: JsonRepairModelRouting,
  grounding: JsonRepairGroundingContext,
  trace: JsonRepairTraceContext,
  llmCaller: LLMCaller,
  attemptNumber: 1 | 2,
): Promise<JsonRepairAttempt> {
  const startedAt = Date.now();
  const prompt = buildRepairPrompt(brokenText, grounding);

  try {
    const result = await llmCaller.call({
      provider: modelRouting.provider,
      model: modelRouting.model,
      prompt,
      responseFormat: 'json',
      temperature: modelRouting.temperature ?? 0,
      traceContext: {
        workflowRunId: trace.workflowRunId,
        phaseId: trace.phaseId,
        subPhaseId: trace.subPhaseId,
        agentRole: 'json_repair',
        label: `json_repair_attempt_${attemptNumber}`,
      },
    });

    if (
      result.parsed &&
      typeof result.parsed === 'object' &&
      !Array.isArray(result.parsed)
    ) {
      return {
        routing: modelRouting,
        parsed: result.parsed as Record<string, unknown>,
        durationMs: Date.now() - startedAt,
      };
    }

    if (typeof result.text === 'string' && result.text.trim().length > 0) {
      const reparsed = tryParseJson(result.text);
      if (reparsed.parsed) {
        return {
          routing: modelRouting,
          parsed: reparsed.parsed,
          durationMs: Date.now() - startedAt,
        };
      }
      return {
        routing: modelRouting,
        parsed: null,
        error: `Repair model returned text but it did not parse: ${reparsed.error ?? 'unknown'}`,
        durationMs: Date.now() - startedAt,
      };
    }

    return {
      routing: modelRouting,
      parsed: null,
      error: 'Repair model returned no parseable output',
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      routing: modelRouting,
      parsed: null,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startedAt,
    };
  }
}

/**
 * Build the repair prompt. Includes the broken JSON plus grounding
 * context (original prompt, system, thinking chain) so the repair
 * model can produce a semantically faithful fix, not just a
 * syntactically valid one.
 */
function buildRepairPrompt(
  brokenText: string,
  grounding: JsonRepairGroundingContext,
): string {
  const recovering = grounding.inputIsReasoningChannel === true;
  const sections: string[] = [];
  sections.push(
    recovering
      ? `You are a JSON recovery tool. The agent below emitted its final answer INSIDE its reasoning channel and left its response channel empty. Your sole job is to EXTRACT the agent's intended final JSON object from that reasoning and output it — syntactically valid AND semantically faithful to the values the agent ultimately settled on (use its FINAL stated values, not earlier drafts it revised).

Output ONLY the JSON object. No preamble, no commentary, no markdown fences, no explanations. Just the JSON.

If the reasoning does not actually contain a complete final answer (truncated mid-thought, or it never reached concrete values), output exactly:
{"_repair_error": "unrepairable", "reason": "<one short sentence>"}`
      : `You are a JSON repair tool. Your sole job is to output a corrected JSON object that is BOTH syntactically valid AND semantically faithful to what the original agent intended.

Output ONLY the repaired JSON object. No preamble, no commentary, no markdown fences, no explanations. Just the JSON.

If the input is fundamentally unrepairable (truncated mid-object, totally unstructured, or the original intent is irrecoverable), output exactly:
{"_repair_error": "unrepairable", "reason": "<one short sentence>"}`
  );

  if (grounding.originalAgentRole) {
    sections.push(`ORIGINAL AGENT ROLE: ${grounding.originalAgentRole}`);
  }

  if (grounding.expectedJsonSchema) {
    sections.push(
      `=== EXPECTED OUTPUT SCHEMA (the repaired JSON must match this shape) ===\n${grounding.expectedJsonSchema}\n=== END EXPECTED OUTPUT SCHEMA ===`,
    );
  }

  if (grounding.originalSystem) {
    sections.push(
      `=== ORIGINAL SYSTEM PROMPT ===\n${grounding.originalSystem}\n=== END ORIGINAL SYSTEM PROMPT ===`,
    );
  }

  sections.push(
    `=== ORIGINAL USER PROMPT ===\n${grounding.originalPrompt}\n=== END ORIGINAL USER PROMPT ===`,
  );

  if (grounding.originalThinking) {
    sections.push(
      `=== ORIGINAL AGENT REASONING (this is the agent's intended interpretation; preserve its semantics) ===\n${grounding.originalThinking}\n=== END ORIGINAL AGENT REASONING ===`,
    );
  }

  sections.push(
    recovering
      ? `=== AGENT REASONING CONTAINING THE ANSWER (the agent emitted its final answer here instead of the response channel; extract the final JSON object it settled on) ===\n${brokenText}\n=== END AGENT REASONING ===`
      : `=== BROKEN JSON OUTPUT (the agent produced this; it does not parse) ===\n${brokenText}\n=== END BROKEN JSON OUTPUT ===`,
    recovering ? `Now output the extracted JSON object only:` : `Now output the repaired JSON object only:`,
  );

  return sections.join('\n\n');
}
