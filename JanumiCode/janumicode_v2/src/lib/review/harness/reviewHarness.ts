/**
 * Reasoning-Review Harness — dispatch infrastructure (Track D Commit 2).
 *
 * Foundation only: validator bodies are still stubs (Commits 3–7 land
 * deterministic functions and LLM prompt templates). This module owns
 * the dispatch loop, record-writing skeleton, and loop-guard.
 *
 * Behavior summary:
 *   1. Loop-guard: skip entirely for harness-internal agentRoles.
 *   2. Write the parent `reasoning_review_harness_record` with
 *      status='running' so the webview sees the parent card immediately.
 *   3. Sequentially invoke each dispatched validator (single-GPU host —
 *      no parallelism per locked harness_design §3).
 *   4. For each validator, write one `reasoning_review_finding_record`
 *      per finding. When the validator can't run (deterministic stub
 *      with no body, LLM with missing template, or thrown exception),
 *      record a `validator_unavailable` failure entry on the outcome —
 *      do not throw.
 *   5. Write a NEW `reasoning_review_harness_record` with the final
 *      counts and call `supersedByRollback` so the running record is
 *      marked as no-longer-current. Decision recommendation is left
 *      undefined here — Commit 8's `final_synthesis` validator fills it.
 *
 * Wired into LLMCaller via setReviewHarnessHook (Track D Commit 10).
 * The prior single-pass `runReasoningReview` reviewer has been retired.
 */

import { randomUUID } from 'node:crypto';

import type { GovernedStreamWriter } from '../../orchestrator/governedStreamWriter';
import type { LLMCaller, LLMCallResult, LLMTraceContext } from '../../llm/llmCaller';
import type { TemplateLoader } from '../../orchestrator/templateLoader';
import type {
  ReasoningReviewFindingRecordContent,
  ReasoningReviewHarnessRecordContent,
  ReviewHarnessFindingsCountBySeverity,
} from '../../types/records';

import { computeFinalSynthesisDecision } from './finalSynthesisDecision';
import { normalizeAgentOutputCasing } from './normalizeAgentOutputCasing';
import {
  selectValidators,
  type ValidatorEntry,
  type ValidatorFinding,
  type ValidatorRuntimeParams,
} from './validatorRegistry';
import { emit as aoddEmit } from '../../aodd';

/**
 * Agent roles that must NEVER trigger a harness run, to prevent the
 * harness from reviewing its own validator calls (or json_repair's
 * recovery calls). Match the synonym list maintained alongside the
 * existing `runReasoningReview` self-review guard.
 */
const HARNESS_INTERNAL_ROLES: ReadonlySet<string> = new Set([
  'harness',
  'json_repair',
  'reasoning_review',
]);

export interface ReviewHarnessParams {
  agentInvocationId: string;
  agentOutputId: string;
  traceContext: LLMTraceContext;
  prompt: string;
  result: LLMCallResult;
}

/**
 * Provider/model routing for harness LLM validator calls (Track D Commit 10).
 * Sourced from `llm_routing.reasoning_review` by the orchestrator hook and
 * threaded into every LLM validator's `LLMInvokeContext`. When omitted,
 * validators fall back to stub strings that surface as
 * `validator_unavailable` (legacy behavior preserved for existing tests).
 */
export interface HarnessLLMRouting {
  provider: string;
  model: string;
  temperature?: number;
}

export interface ReviewHarnessOutcome {
  /** Id of the FINAL harness record (status='completed' or 'failed'). */
  harnessRecordId: string | null;
  /** All findings collated across every dispatched validator. */
  findings: ValidatorFinding[];
  /** Validator ids selected by `selectValidators` for this output. */
  validatorsDispatched: string[];
  /** Per-validator failures (no exception escapes runReviewHarness). */
  validatorFailures: { validatorId: string; error: string }[];
  /** True when the loop-guard skipped the run entirely. */
  skipped: boolean;
  /** Reason for skip; null when not skipped. */
  skipReason: string | null;
}

/** Shared base fields stamped onto every harness/finding record. */
interface BaseHarnessRecordOptions {
  schema_version: string;
  workflow_run_id: string;
  phase_id: string | null;
  sub_phase_id: string | null;
  produced_by_agent_role: 'harness';
  janumicode_version_sha: string;
}

/**
 * Run the harness for one reviewed agent_output. Always returns; never
 * throws. Validator failures are captured in `validatorFailures` so the
 * caller can inspect coverage gaps.
 */
export async function runReviewHarness(
  params: ReviewHarnessParams,
  llmCaller: LLMCaller,
  writer: GovernedStreamWriter,
  versionSha: string,
  templateLoader: TemplateLoader,
  harnessRouting?: HarnessLLMRouting,
): Promise<ReviewHarnessOutcome> {
  const { agentInvocationId, agentOutputId, traceContext, prompt, result } = params;

  // ── 1. Loop-guard ──────────────────────────────────────────────
  const role = traceContext.agentRole ?? null;
  if (role && HARNESS_INTERNAL_ROLES.has(role)) {
    return {
      harnessRecordId: null,
      findings: [],
      validatorsDispatched: [],
      validatorFailures: [],
      skipped: true,
      skipReason: `loop_guard:${role}`,
    };
  }

  // ── 2. Compute output payload + dispatch list ──────────────────
  // Defense-in-depth: tolerate camelCase agent emissions for known snake_case fields.
  const rawContent = extractOutputContent(result);
  const outputContent = rawContent === null
    ? null
    : normalizeAgentOutputCasing(rawContent) as Record<string, unknown>;
  const outputThinking = result.thinking ?? null;
  const harnessId = randomUUID();

  // Effective role for dispatch resolution. Unsampled roles fall
  // through to the placeholder bundle in selectValidators.
  const effectiveRole = role ?? 'unknown';
  const subPhaseId = traceContext.subPhaseId ?? '';

  const dispatched = selectValidators({
    agentRole: effectiveRole,
    subPhaseId,
    outputContent,
    outputThinking,
  });
  const dispatchedIds = dispatched.map((v) => v.id);

  const startedAt = Date.now();

  // ── 3. Write the parent harness record (status='running') ──────
  const baseRecordOptions = {
    schema_version: '1.0',
    workflow_run_id: traceContext.workflowRunId,
    phase_id: traceContext.phaseId ?? null,
    sub_phase_id: traceContext.subPhaseId ?? null,
    produced_by_agent_role: 'harness' as const,
    janumicode_version_sha: versionSha,
  };

  const initialContent: ReasoningReviewHarnessRecordContent = {
    kind: 'reasoning_review_harness',
    harness_id: harnessId,
    status: 'running',
    reviewed_agent_invocation_id: agentInvocationId,
    reviewed_agent_output_id: agentOutputId,
    reviewed_agent_role: role,
    reviewed_phase_id: traceContext.phaseId ?? null,
    reviewed_sub_phase_id: traceContext.subPhaseId ?? null,
    dispatched_validator_ids: dispatchedIds,
    findings_count_by_severity: { HIGH: 0, MEDIUM: 0, LOW: 0 },
    validator_failure_count: 0,
    decision_recommendation: null,
    duration_ms: 0,
  };

  const initialHarnessRecord = writer.writeRecord({
    ...baseRecordOptions,
    record_type: 'reasoning_review_harness_record',
    derived_from_record_ids: [agentInvocationId, agentOutputId],
    content: initialContent as unknown as Record<string, unknown>,
  });

  // ── 4. Sequentially dispatch each validator ────────────────────
  //
  // PRE-VALIDATOR HOOK: json_output_discipline_check
  // ─────────────────────────────────────────────────────────────
  // This validator runs BEFORE the LLM validator chain (catalog §1).
  // If it fires HIGH findings (markdown fence / leading prose), the harness
  // sets shortCircuitLLM=true and skips all subsequent LLM validators.
  // Deterministic validators still run — they are cheap and may surface
  // additional structural issues even on broken JSON.
  //
  // Wiring: json_output_discipline_check must be the first entry in any
  // dispatch bundle where it appears. The pre-check extracts it from the
  // dispatched list, runs it, and re-integrates findings into allFindings.
  // The main dispatch loop then skips LLM validators when shortCircuitLLM=true.

  const allFindings: ValidatorFinding[] = [];
  const failures: { validatorId: string; error: string }[] = [];
  // Per-validator token capture (Commit 9). Keyed by validatorId; the
  // last-recorded usage wins (validators currently issue exactly one
  // LLM call). Deterministic validators never appear in this map.
  const tokensByValidator = new Map<
    string,
    { inputTokens: number | null; outputTokens: number | null }
  >();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const recordLLMUsage = (validatorId: string, usage: {
    inputTokens: number | null; outputTokens: number | null;
  }): void => {
    tokensByValidator.set(validatorId, usage);
    if (typeof usage.inputTokens === 'number') totalInputTokens += usage.inputTokens;
    if (typeof usage.outputTokens === 'number') totalOutputTokens += usage.outputTokens;
  };

  // Pre-load prior artifacts for cross-record validators (e.g.
  // spec_boundary_respect_bloom needs product_intent_discovery decisions
  // and technical_constraints_discovery constraints). Single DB read per
  // harness invocation; validators that don't need it ignore the field.
  const priorArtifactsByKind = loadPriorArtifactsByKind(
    writer,
    traceContext.workflowRunId,
  );

  // Pre-validator: run json_output_discipline_check if dispatched.
  // Short-circuit LLM validators on HIGH findings.
  const preResult = await runPreValidatorChain({
    dispatched,
    effectiveRole,
    subPhaseId,
    agentOutputId,
    result,
    prompt,
    outputContent,
    outputThinking,
    priorArtifactsByKind,
    llmCaller,
    templateLoader,
    traceContext,
    failures,
    recordLLMUsage,
    harnessRouting,
    writer,
    baseRecordOptions,
    harnessId,
    harnessRecordId: initialHarnessRecord.id,
  });
  allFindings.push(...preResult.findings);
  const shortCircuitLLM = preResult.shortCircuitLLM;

  for (const entry of dispatched) {
    // Skip the pre-validator in the main loop (already ran above).
    if (entry.id === 'json_output_discipline_check') continue;
    // Short-circuit: skip LLM validators when pre-validator fired HIGH.
    if (shortCircuitLLM && entry.kind === 'llm') continue;
    const runtimeParams: ValidatorRuntimeParams = {
      agentRole: effectiveRole,
      subPhaseId,
      agentOutputId,
      outputText: result.text ?? '',
      outputContent,
      outputThinking,
      originalPrompt: prompt,
      originalSystem: null,
      upstreamFindings: [...allFindings],
      priorArtifactsByKind,
    };

    const validatorStart = Date.now();
    const findings = await runOneValidator(
      entry,
      runtimeParams,
      llmCaller,
      templateLoader,
      {
        upstreamTrace: traceContext,
        failures,
        recordLLMUsage,
        harnessRouting,
      },
    );
    const validatorDuration = Date.now() - validatorStart;
    aoddEmit('validator.run', {
      validator_name: entry.id,
      target_record_id: agentOutputId,
      duration_ms: validatorDuration,
    });

    const tokens = tokensByValidator.get(entry.id) ?? null;
    for (const finding of findings) {
      allFindings.push(finding);
      writeFindingRecord({
        writer,
        baseRecordOptions,
        harnessId,
        harnessRecordId: initialHarnessRecord.id,
        finding,
        durationMs: validatorDuration,
        inputTokens: tokens?.inputTokens ?? null,
        outputTokens: tokens?.outputTokens ?? null,
      });
    }
  }

  // ── 5. Write the final harness record + supersede the running one ──
  // Strip the final_synthesis decision finding from the corpus the
  // policy computes over — its severity is itself derived from the
  // policy and would double-count. Contract-design findings are
  // collated by the policy itself (informational-only).
  const policyInputs = allFindings.filter(
    (f) => f.validatorId !== 'final_synthesis',
  );

  // Short-circuit decision: when json_output_discipline_check fired HIGH,
  // all LLM validators were skipped (shortCircuitLLM=true). In that case
  // we emit a fixed REVISE decision with a clear rationale instead of
  // running the normal policy computation, so the caller knows exactly
  // why the chain was aborted. (Catalog spec: option (a) from §1.)
  //
  // The normal policy would compute REVISE anyway for a single HIGH
  // finding, but the rationale would be generic ("1 HIGH finding; ->
  // REVISE"). The fixed rationale is more actionable.
  let decisionResult = computeFinalSynthesisDecision(policyInputs, failures);
  if (shortCircuitLLM) {
    decisionResult = {
      ...decisionResult,
      decision: 'REVISE',
      rationale:
        'Pre-validator json_output_discipline_check fired HIGH severity; ' +
        'LLM validator chain short-circuited. ' +
        'JSON output discipline must be addressed before semantic review can run.',
      contractDesignFindings: [],
    };
  }

  const counts = countBySeverity(allFindings);
  // Pull out the LLM narrative from the final_synthesis finding (when
  // produced). The decision text in the harness record is the
  // deterministic rationale; the narrative is supplemental.
  const synthesisFinding = allFindings.find(
    (f) => f.validatorId === 'final_synthesis',
  );
  const narrative = synthesisFinding?.detail
    ? extractNarrativeFromDetail(synthesisFinding.detail, decisionResult.rationale)
    : null;

  const finalContent: ReasoningReviewHarnessRecordContent = {
    ...initialContent,
    status: 'completed',
    findings_count_by_severity: counts,
    validator_failure_count: failures.length,
    decision_recommendation: decisionResult.decision,
    decision_rationale: decisionResult.rationale,
    contractDesignFindings: decisionResult.contractDesignFindings,
    narrative_summary: narrative,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    duration_ms: Date.now() - startedAt,
  };

  const finalHarnessRecord = writer.writeRecord({
    ...baseRecordOptions,
    record_type: 'reasoning_review_harness_record',
    derived_from_record_ids: [agentInvocationId, agentOutputId, initialHarnessRecord.id],
    content: finalContent as unknown as Record<string, unknown>,
  });

  // Mark the 'running' parent as superseded by the final record so
  // queries for current-version harness records get the completed one.
  writer.supersedByRollback(initialHarnessRecord.id, finalHarnessRecord.id);

  return {
    harnessRecordId: finalHarnessRecord.id,
    findings: allFindings,
    validatorsDispatched: dispatchedIds,
    validatorFailures: failures,
    skipped: false,
    skipReason: null,
  };
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Pre-load prior `artifact_produced` records, bucketed by their content
 * `kind`, for cross-record validators. Single DB read per harness
 * invocation; non-fatal on error (returns an empty map). Behavior mirrors
 * the inline block it replaced exactly (skips content-less/kind-less recs).
 */
function loadPriorArtifactsByKind(
  writer: GovernedStreamWriter,
  workflowRunId: string,
): Map<string, Record<string, unknown>[]> {
  const priorArtifactsByKind: Map<string, Record<string, unknown>[]> = new Map();
  try {
    const artifactRecords = writer.getRecordsByType(workflowRunId, 'artifact_produced');
    for (const rec of artifactRecords) {
      const content = rec.content as Record<string, unknown> | null;
      if (!content) continue;
      const kind = typeof content.kind === 'string' ? content.kind : null;
      if (!kind) continue;
      const bucket = priorArtifactsByKind.get(kind) ?? [];
      bucket.push(content);
      priorArtifactsByKind.set(kind, bucket);
    }
  } catch {
    // Non-fatal: validators tolerate empty/undefined priorArtifactsByKind.
  }
  return priorArtifactsByKind;
}

interface PreValidatorChainArgs {
  dispatched: ValidatorEntry[];
  effectiveRole: string;
  subPhaseId: string;
  agentOutputId: string;
  result: LLMCallResult;
  prompt: string;
  outputContent: Record<string, unknown> | null;
  outputThinking: string | null;
  priorArtifactsByKind: Map<string, Record<string, unknown>[]>;
  llmCaller: LLMCaller;
  templateLoader: TemplateLoader;
  traceContext: LLMTraceContext;
  failures: { validatorId: string; error: string }[];
  recordLLMUsage: (
    validatorId: string,
    usage: { inputTokens: number | null; outputTokens: number | null },
  ) => void;
  harnessRouting: HarnessLLMRouting | undefined;
  writer: GovernedStreamWriter;
  baseRecordOptions: BaseHarnessRecordOptions;
  harnessId: string;
  harnessRecordId: string;
}

/**
 * Run the pre-validator (`json_output_discipline_check`) when it appears
 * in the dispatch bundle, writing one finding record per finding. Returns
 * the findings (for the caller to prepend to the corpus) and whether the
 * LLM validator chain should short-circuit (any HIGH finding). When the
 * pre-validator is not dispatched, returns no findings and no short-circuit.
 */
async function runPreValidatorChain(
  args: PreValidatorChainArgs,
): Promise<{ findings: ValidatorFinding[]; shortCircuitLLM: boolean }> {
  const preValidatorEntry = args.dispatched.find(
    (v) => v.id === 'json_output_discipline_check',
  );
  if (!preValidatorEntry) {
    return { findings: [], shortCircuitLLM: false };
  }

  const preParams: ValidatorRuntimeParams = {
    agentRole: args.effectiveRole,
    subPhaseId: args.subPhaseId,
    agentOutputId: args.agentOutputId,
    outputText: args.result.text ?? '',
    outputContent: args.outputContent,
    outputThinking: args.outputThinking,
    originalPrompt: args.prompt,
    originalSystem: null,
    upstreamFindings: [],
    priorArtifactsByKind: args.priorArtifactsByKind,
  };
  const preFindings = await runOneValidator(
    preValidatorEntry,
    preParams,
    args.llmCaller,
    args.templateLoader,
    {
      upstreamTrace: args.traceContext,
      failures: args.failures,
      recordLLMUsage: args.recordLLMUsage,
      harnessRouting: args.harnessRouting,
    },
  );
  for (const finding of preFindings) {
    writeFindingRecord({
      writer: args.writer,
      baseRecordOptions: args.baseRecordOptions,
      harnessId: args.harnessId,
      harnessRecordId: args.harnessRecordId,
      finding,
      durationMs: 0,
      inputTokens: null,
      outputTokens: null,
    });
  }
  const shortCircuitLLM = preFindings.some((f) => f.severity === 'HIGH');
  return { findings: preFindings, shortCircuitLLM };
}

/**
 * Run a single validator. Captures every failure mode and returns
 * findings (or [] when unavailable). Pushes a `validator_unavailable`
 * failure into `failures` when applicable. Never throws.
 */
interface RunOneValidatorContext {
  upstreamTrace: LLMTraceContext;
  failures: { validatorId: string; error: string }[];
  recordLLMUsage: (
    validatorId: string,
    usage: { inputTokens: number | null; outputTokens: number | null },
  ) => void;
  harnessRouting: HarnessLLMRouting | undefined;
}

async function runOneValidator(
  entry: ValidatorEntry,
  runtime: ValidatorRuntimeParams,
  llmCaller: LLMCaller,
  templateLoader: TemplateLoader,
  ctx: RunOneValidatorContext,
): Promise<ValidatorFinding[]> {
  const { upstreamTrace, failures, recordLLMUsage, harnessRouting } = ctx;
  if (entry.kind === 'deterministic') {
    if (typeof entry.validate !== 'function') {
      // Foundation stub — Commit 3 lands the body. Mark unavailable so
      // coverage gaps are auditable.
      failures.push({
        validatorId: entry.id,
        error: 'validator_unavailable: deterministic body not yet implemented (Commit 3+ pending)',
      });
      return [];
    }
    try {
      return entry.validate(runtime);
    } catch (err) {
      failures.push({
        validatorId: entry.id,
        error: `deterministic_threw: ${err instanceof Error ? err.message : String(err)}`,
      });
      return [];
    }
  }

  // LLM validator. Commits 3+ wire `invoke` per-validator. When
  // missing (defensive: family-class / role-specific bodies still
  // pending in Commits 5–7), record validator_unavailable.
  if (typeof entry.invoke !== 'function') {
    failures.push({
      validatorId: entry.id,
      error: `validator_unavailable: LLM invoke not yet implemented (${entry.promptTemplatePath})`,
    });
    return [];
  }

  try {
    return await entry.invoke(runtime, llmCaller, templateLoader, {
      workflowRunId: upstreamTrace.workflowRunId,
      phaseId: upstreamTrace.phaseId ?? null,
      subPhaseId: upstreamTrace.subPhaseId ?? null,
      pushFailure: (validatorId, error) => {
        failures.push({ validatorId, error });
      },
      recordLLMUsage,
      harnessProvider: harnessRouting?.provider,
      harnessModel: harnessRouting?.model,
      harnessTemperature: harnessRouting?.temperature,
    });
  } catch (err) {
    failures.push({
      validatorId: entry.id,
      error: `validator_threw: ${err instanceof Error ? err.message : String(err)}`,
    });
    return [];
  }
}

/**
 * The final_synthesis validator stamps `<deterministic rationale>\n\n<narrative>`
 * into the finding's `detail` field (when an LLM narrative was obtained).
 * Strip the deterministic rationale prefix to recover the narrative alone.
 */
function extractNarrativeFromDetail(detail: string, rationale: string): string | null {
  if (!detail) return null;
  if (detail.startsWith(rationale)) {
    const rest = detail.slice(rationale.length).replace(/^\s*\n+/, '');
    return rest.length > 0 ? rest : null;
  }
  return detail;
}

function countBySeverity(findings: ValidatorFinding[]): ReviewHarnessFindingsCountBySeverity {
  const counts: ReviewHarnessFindingsCountBySeverity = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of findings) counts[f.severity] += 1;
  return counts;
}

function extractOutputContent(
  result: LLMCallResult,
): Record<string, unknown> | null {
  if (result.parsed && typeof result.parsed === 'object') return result.parsed;
  return null;
}

function writeFindingRecord(args: {
  writer: GovernedStreamWriter;
  baseRecordOptions: BaseHarnessRecordOptions;
  harnessId: string;
  harnessRecordId: string;
  finding: ValidatorFinding;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
}): void {
  const content: ReasoningReviewFindingRecordContent = {
    kind: 'reasoning_review_finding',
    harness_id: args.harnessId,
    validator_id: args.finding.validatorId,
    severity: args.finding.severity,
    finding_type: args.finding.type,
    summary: args.finding.summary,
    location: args.finding.location,
    detail: args.finding.detail,
    recommendation: args.finding.recommendation,
    duration_ms: args.durationMs,
    input_tokens: args.inputTokens,
    output_tokens: args.outputTokens,
    target_field: args.finding.targetField,
    target_identifier: args.finding.targetIdentifier,
  };
  args.writer.writeRecord({
    ...args.baseRecordOptions,
    record_type: 'reasoning_review_finding_record',
    derived_from_record_ids: [args.harnessRecordId],
    content: content as unknown as Record<string, unknown>,
  });
  // AODD paired emit: validator.finding events let an agent see what a
  // validator surfaced without joining DB tables. Map the validator
  // framework's HIGH/MEDIUM/LOW to the AODD-canonical error/warning/info.
  let aoddSeverity: 'error' | 'warning' | 'info';
  if (args.finding.severity === 'HIGH') {
    aoddSeverity = 'error';
  } else if (args.finding.severity === 'MEDIUM') {
    aoddSeverity = 'warning';
  } else {
    aoddSeverity = 'info';
  }
  aoddEmit('validator.finding', {
    validator_name: args.finding.validatorId,
    target_record_id: args.finding.targetIdentifier ?? args.harnessRecordId,
    severity: aoddSeverity,
    message: args.finding.summary,
  });
}
