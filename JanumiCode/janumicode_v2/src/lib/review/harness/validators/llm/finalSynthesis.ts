/**
 * LLM validator: final_synthesis (Track D Commit 8).
 *
 * Decision policy is now DETERMINISTIC (computeFinalSynthesisDecision).
 * The LLM call is purely for the human-readable narrative summary.
 *
 * Behaviour:
 *   1. Compute the locked-policy decision over `params.upstreamFindings`
 *      using `computeFinalSynthesisDecision` — this is the authoritative
 *      decision. The LLM cannot drift from it.
 *   2. Optionally call the LLM (when the template is present) to obtain
 *      a brief narrative; the narrative is captured on the emitted
 *      finding's `detail` field. Failures of the narrative call do NOT
 *      change the decision — they are recorded as a non-fatal note.
 *   3. Emit a single ValidatorFinding with:
 *        type:     'final_synthesis_decision'
 *        severity: HIGH for ESCALATE/QUARANTINE, MEDIUM for REVISE,
 *                  LOW otherwise (so the harness's per-severity counts
 *                  reflect the synthesised verdict).
 *        summary:  `decision=<DECISION>`
 *        detail:   the deterministic rationale + (when available) the
 *                  LLM narrative.
 *        recommendation: empty (callers consume decision via the harness
 *                  record, not via this finding's recommendation field).
 *
 * The harness reads the finding back (or, equivalently, re-runs the
 * deterministic policy) and writes `decision_recommendation`,
 * `decision_rationale`, and `contractDesignFindings` onto the parent
 * harness record at completion.
 */

import type { LLMCaller } from '../../../../llm/llmCaller';
import type { TemplateLoader } from '../../../../orchestrator/templateLoader';
import {
  computeFinalSynthesisDecision,
  type FinalSynthesisDecisionResult,
} from '../../finalSynthesisDecision';
import type { ValidatorFinding, ValidatorRuntimeParams } from '../../validatorRegistry';
import type { LLMInvokeContext } from './llmValidatorRunner';

const VALIDATOR_ID = 'final_synthesis';

export async function invokeFinalSynthesis(
  params: ValidatorRuntimeParams,
  llmCaller: LLMCaller,
  templateLoader: TemplateLoader,
  context: LLMInvokeContext,
): Promise<ValidatorFinding[]> {
  // Deterministic decision over upstream findings — the locked policy.
  // No upstream `failures` are visible from inside the validator runtime
  // (those are tracked on the harness side). The harness will re-run the
  // computation including failures when it writes the harness record.
  const decisionResult = computeFinalSynthesisDecision(
    params.upstreamFindings ?? [],
    [],
  );

  // Optional LLM narrative — purely advisory, never changes the decision.
  let narrative: string | null = null;
  const template = templateLoader.findTemplate('harness', VALIDATOR_ID);
  if (template) {
    const upstreamSummary = (params.upstreamFindings ?? []).map((f) => ({
      validator: f.validatorId,
      severity: f.severity,
      type: f.type,
      summary: f.summary,
      location: f.location,
    }));
    const rendered = templateLoader.render(template, {
      AGENT_ROLE: params.agentRole,
      SUB_PHASE: params.subPhaseId,
      AGENT_FINAL_RESPONSE: params.outputText ?? '',
    });
    const userPrompt = [
      `# Reviewed agent: ${params.agentRole} / ${params.subPhaseId}`,
      `# Deterministic decision: ${decisionResult.decision}`,
      `# Decision rationale: ${decisionResult.rationale}`,
      `# Upstream validator findings (n=${upstreamSummary.length})\n${JSON.stringify(upstreamSummary, null, 2)}`,
      `# Agent final response\n${params.outputText ?? ''}`,
    ].join('\n\n---\n\n');

    const callProvider = context.harnessProvider ?? 'harness';
    const callModel = context.harnessModel ?? 'harness';
    const callTemperature = context.harnessTemperature ?? 0;
    try {
      const result = await llmCaller.call({
        provider: callProvider,
        model: callModel,
        system: rendered.rendered,
        prompt: userPrompt,
        responseFormat: 'json',
        temperature: callTemperature,
        traceContext: {
          workflowRunId: context.workflowRunId,
          phaseId: context.phaseId,
          subPhaseId: context.subPhaseId,
          agentRole: 'harness',
          label: `harness:${VALIDATOR_ID}`,
        },
      });
      const parsed = result.parsed;
      if (parsed) {
        if (typeof parsed.decision_rationale === 'string' && parsed.decision_rationale.trim().length > 0) {
          narrative = parsed.decision_rationale.trim();
        } else if (typeof parsed.overall_assessment === 'string') {
          narrative = parsed.overall_assessment.trim();
        }
      }
      // Token / duration capture for Commit 9 (best-effort).
      context.recordLLMUsage?.(VALIDATOR_ID, {
        inputTokens: result.inputTokens ?? null,
        outputTokens: result.outputTokens ?? null,
      });
    } catch (err) {
      // Narrative-only failure: log a non-fatal note but keep the
      // deterministic decision authoritative. Surfacing as a failure
      // would escalate the policy — we do NOT want that.
      narrative = `(narrative LLM call failed: ${
        err instanceof Error ? err.message : String(err)
      })`;
    }
  }
  // No template: silent, narrative remains null (decision still emitted).

  return [buildDecisionFinding(decisionResult, narrative)];
}

function buildDecisionFinding(
  decision: FinalSynthesisDecisionResult,
  narrative: string | null,
): ValidatorFinding {
  const detailParts = [decision.rationale];
  if (narrative) detailParts.push(narrative);
  return {
    validatorId: VALIDATOR_ID,
    severity: decisionToSeverity(decision.decision),
    type: 'final_synthesis_decision',
    summary: `decision=${decision.decision}`,
    location: '$',
    detail: detailParts.join('\n\n'),
    recommendation: '',
  };
}

function decisionToSeverity(decision: string): ValidatorFinding['severity'] {
  switch (decision) {
    case 'QUARANTINE':
    case 'ESCALATE':
      return 'HIGH';
    case 'REVISE':
      return 'MEDIUM';
    default:
      return 'LOW';
  }
}
