/**
 * Reasoning Reviewer (v2)
 *
 * Advisory critique of agent thinking + final output. Wired as a hook into
 * `LLMCaller`: every successful agent_output (except those produced by the
 * review role itself) triggers a synchronous review LLM call; the resulting
 * `reasoning_review_record` lands in governed_stream linked to the parent
 * agent_output via `derived_from_record_ids`.
 *
 * Design points (per cal-24 design discussion):
 *   - Synchronous: blocks the workflow so findings surface BEFORE the next
 *     phase scrolls them out of the user's attention.
 *   - Advisory only: never throws / never gates phase progression.
 *   - Tool-call sequences and tool results are NOT included in the review
 *     prompt (per v1 lessons — they bloat the prompt and rarely surface
 *     reasoning flaws the reviewer can act on).
 *   - Self-review prevention: the hook short-circuits when the originating
 *     call's `agentRole === 'reasoning_review'`.
 *   - Empty-output skip: when the reviewed call produced no text AND no
 *     thinking content, there's nothing to review (scaffold / error path).
 *   - Soft-fail: review LLM errors after retries surface as a
 *     `reasoning_review_record` with `status: 'failed'` rather than
 *     propagating up to the workflow.
 *
 * The reviewer LLM is configured via `llm_routing.reasoning_review`. Today
 * that points at gemma4:26b-a4b-it-q4_K_M; the existing parseJsonWithRecovery
 * pipeline handles its known JSON pathologies.
 */

import type { GovernedStreamWriter } from '../orchestrator/governedStreamWriter';
import type { LLMCaller, LLMCallResult, LLMTraceContext } from '../llm/llmCaller';
import type { TemplateLoader } from '../orchestrator/templateLoader';
import type {
  ReasoningReviewConcern,
  ReasoningReviewRecordContent,
  ReasoningReviewSeverity,
} from '../types/records';

/**
 * Cache the system-prompt body resolved from the template loader. The
 * template content is static (no per-call variables), so we resolve once
 * and reuse — saving a Map lookup + frontmatter strip on every reviewed
 * call. Reset to null when the loader cache is rebuilt (rare; only at
 * engine startup), via clearReviewerSystemPromptCache().
 */
let cachedSystemPrompt: string | null = null;

/**
 * Hard-coded fallback used when the template file is missing — keeps the
 * advisory hook running rather than soft-failing every review when an
 * operator forgets to ship the template. The active template should
 * always win; this is just a belt-and-suspenders safety net.
 */
const FALLBACK_SYSTEM_PROMPT =
  'You are a REASONING REVIEWER. Examine the agent\'s thinking and final output for ' +
  'substantive logical flaws, unsupported assumptions, and reasoning risks. ' +
  'Output JSON: {"hasConcerns": bool, "concerns": [{"severity": "HIGH|MEDIUM|LOW", ' +
  '"summary": "...", "detail": "...", "location": "...", "recommendation": "..."}], ' +
  '"overallAssessment": "..."}. If sound, return hasConcerns=false with empty concerns array.';

/**
 * Resolve the reviewer system prompt from the template loader. Single
 * canonical template at `prompts/cross_cutting/reasoning_review.system.md`
 * (`agent_role: reasoning_review`, `sub_phase: cross_cutting`). Falls
 * back to a minimal hard-coded prompt if the template isn't loaded.
 */
function resolveReviewerSystemPrompt(templateLoader: TemplateLoader | null): string {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  if (!templateLoader) return FALLBACK_SYSTEM_PROMPT;
  const tmpl = templateLoader.findTemplate('reasoning_review', 'reasoning_review');
  if (!tmpl) return FALLBACK_SYSTEM_PROMPT;
  // The template body has no {{variables}} — render with empty context to
  // get the body verbatim and strip any trailing whitespace.
  const rendered = templateLoader.render(tmpl, {});
  cachedSystemPrompt = rendered.rendered.trim();
  return cachedSystemPrompt;
}

/**
 * Reset the cached system prompt. Call when the TemplateLoader reloads
 * (e.g., during a hot-reload scenario in a future dev mode). Production
 * runs load templates once at startup; the cache survives the run.
 */
export function clearReviewerSystemPromptCache(): void {
  cachedSystemPrompt = null;
}

export interface ReviewerRouting {
  provider: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
}

export interface ReviewerHookParams {
  agentOutputId: string;
  traceContext: LLMTraceContext;
  prompt: string;
  result: LLMCallResult;
}

const SEVERITY_ORDER: Record<ReasoningReviewSeverity, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/**
 * Returns the persisted record content + the new record's id so the
 * caller can apply its own gating policy (e.g. Phase 9 quarantines on
 * any HIGH-severity concern). Always writes a record (success /
 * parse_error / failed / skipped); the review itself is advisory.
 */
export interface ReasoningReviewOutcome {
  recordId: string;
  content: ReasoningReviewRecordContent;
}

/**
 * Run the reasoning review for a single agent_output. Synchronous: awaits
 * the review LLM call before returning. Always writes a record (success,
 * parse_error, failed, or skipped) so the user sees that review was
 * attempted for every reviewable call. Returns the persisted record so
 * callers can apply gating policy (e.g. Phase 9 quarantine on HIGH).
 */
export async function runReasoningReview(
  params: ReviewerHookParams,
  reviewerRouting: ReviewerRouting,
  llmCaller: LLMCaller,
  writer: GovernedStreamWriter,
  versionSha: string,
  templateLoader: TemplateLoader | null,
): Promise<ReasoningReviewOutcome> {
  const { agentOutputId, traceContext, prompt, result } = params;

  const baseRecord = {
    record_type: 'reasoning_review_record' as const,
    schema_version: '1.0',
    workflow_run_id: traceContext.workflowRunId,
    phase_id: traceContext.phaseId ?? null,
    sub_phase_id: traceContext.subPhaseId ?? null,
    produced_by_agent_role: 'reasoning_review' as const,
    janumicode_version_sha: versionSha,
    derived_from_record_ids: [agentOutputId],
  };

  const baseContent = {
    kind: 'reasoning_review' as const,
    reviewed_agent_output_id: agentOutputId,
    reviewed_agent_role: traceContext.agentRole ?? null,
    reviewed_phase_id: traceContext.phaseId ?? null,
    reviewed_sub_phase_id: traceContext.subPhaseId ?? null,
    reviewer_provider: reviewerRouting.provider,
    reviewer_model: reviewerRouting.model,
  };

  const startedAt = Date.now();
  const reviewPrompt = buildReviewPrompt({
    prompt,
    thinking: result.thinking ?? '',
    response: result.text ?? '',
    role: traceContext.agentRole ?? null,
    phase: traceContext.phaseId ?? null,
    subPhase: traceContext.subPhaseId ?? null,
  });

  let reviewResult: LLMCallResult | null = null;
  let lastError: Error | null = null;
  try {
    reviewResult = await llmCaller.call({
      provider: reviewerRouting.provider,
      model: reviewerRouting.model,
      baseUrl: reviewerRouting.baseUrl,
      prompt: reviewPrompt,
      system: resolveReviewerSystemPrompt(templateLoader),
      responseFormat: 'json',
      temperature: reviewerRouting.temperature ?? 0,
      traceContext: {
        workflowRunId: traceContext.workflowRunId,
        phaseId: traceContext.phaseId ?? null,
        subPhaseId: traceContext.subPhaseId ?? null,
        // CRITICAL: stamp this call as 'reasoning_review' so the hook
        // recognises it and short-circuits — otherwise we recurse
        // forever (review of review of review …).
        agentRole: 'reasoning_review',
        label: `Reasoning Review of ${traceContext.agentRole ?? 'agent'} (${traceContext.subPhaseId ?? '?'})`,
      },
    });
  } catch (err) {
    lastError = err instanceof Error ? err : new Error(String(err));
  }

  const durationMs = Date.now() - startedAt;
  const retryAttempts = reviewResult?.retryAttempts ?? 0;

  if (!reviewResult) {
    const failedContent: ReasoningReviewRecordContent = {
      ...baseContent,
      status: 'failed',
      has_concerns: false,
      concerns: [],
      overall_assessment: 'Review LLM call failed after retries — see error_message.',
      duration_ms: durationMs,
      retry_attempts: retryAttempts,
      error_message: lastError?.message ?? 'Unknown reviewer error',
    };
    const rec = writer.writeRecord({ ...baseRecord, content: failedContent as unknown as Record<string, unknown> });
    return { recordId: rec.id, content: failedContent };
  }

  const parsed = parseReviewResponse(reviewResult.parsed, reviewResult.text);
  if (!parsed) {
    const parseErrContent: ReasoningReviewRecordContent = {
      ...baseContent,
      status: 'parse_error',
      has_concerns: false,
      concerns: [],
      overall_assessment: 'Reviewer LLM returned text but JSON could not be recovered.',
      duration_ms: durationMs,
      retry_attempts: retryAttempts,
      error_message: 'Failed to parse reviewer response as ReasoningReview JSON',
    };
    const rec = writer.writeRecord({ ...baseRecord, content: parseErrContent as unknown as Record<string, unknown> });
    return { recordId: rec.id, content: parseErrContent };
  }

  const successContent: ReasoningReviewRecordContent = {
    ...baseContent,
    status: 'success',
    has_concerns: parsed.hasConcerns,
    concerns: parsed.concerns,
    overall_assessment: parsed.overallAssessment,
    duration_ms: durationMs,
    retry_attempts: retryAttempts,
    error_message: null,
  };
  const rec = writer.writeRecord({ ...baseRecord, content: successContent as unknown as Record<string, unknown> });
  return { recordId: rec.id, content: successContent };
}

/**
 * Decide whether a given agent_output is reviewable. The hook should call
 * this before invoking runReasoningReview. When this returns a skip-reason,
 * a `status: 'skipped'` record is still written so the operator sees that
 * a review WAS considered — silent skips would hide coverage gaps.
 */
export function shouldSkipReview(
  traceContext: LLMTraceContext | undefined,
  result: LLMCallResult,
): { skip: true; reason: string } | { skip: false } {
  if (!traceContext) {
    return { skip: true, reason: 'no_trace_context' };
  }
  // Self-review guard. Any call stamped with this role is the reviewer
  // itself — reviewing the reviewer would recurse infinitely.
  if (traceContext.agentRole === 'reasoning_review') {
    return { skip: true, reason: 'self_review' };
  }
  // Nothing to review: the call returned no text and no thinking. This
  // happens for scaffold paths and provider errors handed to the writer
  // as `result: null` (writeOutputRecords handles those before the hook,
  // but defensive belt-and-suspenders).
  const hasText = (result.text ?? '').trim().length > 0;
  const hasThinking = (result.thinking ?? '').trim().length > 0;
  if (!hasText && !hasThinking) {
    return { skip: true, reason: 'no_thinking_or_text' };
  }
  return { skip: false };
}

/**
 * Write a `reasoning_review_record` with `status: 'skipped'` so coverage
 * is auditable. Caller knows the skip-reason from `shouldSkipReview`.
 */
export function writeSkipRecord(
  agentOutputId: string,
  traceContext: LLMTraceContext,
  reason: string,
  writer: GovernedStreamWriter,
  versionSha: string,
): void {
  writer.writeRecord({
    record_type: 'reasoning_review_record',
    schema_version: '1.0',
    workflow_run_id: traceContext.workflowRunId,
    phase_id: traceContext.phaseId ?? null,
    sub_phase_id: traceContext.subPhaseId ?? null,
    produced_by_agent_role: 'reasoning_review' as const,
    janumicode_version_sha: versionSha,
    derived_from_record_ids: [agentOutputId],
    content: {
      kind: 'reasoning_review',
      status: 'skipped',
      reviewed_agent_output_id: agentOutputId,
      reviewed_agent_role: traceContext.agentRole ?? null,
      reviewed_phase_id: traceContext.phaseId ?? null,
      reviewed_sub_phase_id: traceContext.subPhaseId ?? null,
      reviewer_provider: null,
      reviewer_model: null,
      has_concerns: false,
      concerns: [],
      overall_assessment: `Skipped: ${reason}`,
      duration_ms: 0,
      retry_attempts: 0,
      error_message: null,
      skip_reason: reason,
    } satisfies ReasoningReviewRecordContent,
  });
}

// ── Helpers ─────────────────────────────────────────────────────

function buildReviewPrompt(params: {
  prompt: string;
  thinking: string;
  response: string;
  role: string | null;
  phase: string | null;
  subPhase: string | null;
}): string {
  const sections: string[] = [];
  sections.push(
    `# Context\nRole: ${params.role ?? 'unknown'}, Phase: ${params.phase ?? 'unknown'}/${params.subPhase ?? 'unknown'}`,
  );
  sections.push(`# Original Prompt\n\n${params.prompt}`);
  if (params.thinking.trim()) {
    sections.push(`# Agent Thinking / Reasoning Chain\n\n${params.thinking}`);
  }
  if (params.response.trim()) {
    sections.push(`# Agent Final Response\n\n${params.response}`);
  }
  return sections.join('\n\n---\n\n');
}

function parseReviewResponse(
  parsed: Record<string, unknown> | null,
  rawText: string,
): { hasConcerns: boolean; concerns: ReasoningReviewConcern[]; overallAssessment: string } | null {
  // Trust the parsed payload from LLMCaller (which already runs the
  // jsonRecovery pipeline). Fall back to a brace-extraction parse if the
  // recovery didn't yield a parsed object — gemma's pathologies sometimes
  // need one more pass with looser brace finding.
  let obj = parsed;
  if (!obj && rawText) {
    obj = looseExtract(rawText);
  }
  if (!obj) return null;

  const hasConcerns = obj.hasConcerns === true;
  const rawConcerns = Array.isArray(obj.concerns) ? obj.concerns : [];
  const overallAssessment = typeof obj.overallAssessment === 'string'
    ? obj.overallAssessment
    : 'No assessment provided';

  const concerns: ReasoningReviewConcern[] = rawConcerns
    .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
    .map((c) => ({
      severity: ['HIGH', 'MEDIUM', 'LOW'].includes(c.severity as string)
        ? (c.severity as ReasoningReviewSeverity)
        : 'MEDIUM',
      summary: String(c.summary ?? ''),
      detail: String(c.detail ?? ''),
      location: String(c.location ?? ''),
      recommendation: String(c.recommendation ?? ''),
    }))
    // HIGH first, then MEDIUM, then LOW.
    .sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);

  return {
    hasConcerns: concerns.length > 0,
    concerns,
    overallAssessment,
  };
}

function looseExtract(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
