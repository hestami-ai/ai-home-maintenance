/**
 * LLM+deterministic validator: surfaced_assumption_novelty
 *
 * Per validator_catalog.md §5.4.1:
 *   - Deterministic side: verify each surfaced_assumption is NOT already
 *     present by id in `existing_assumptions`.
 *   - LLM side: verify the assumption's text is genuinely novel (not a
 *     paraphrase) and that `category` matches the content.
 *
 * DESIGN NOTE: The catalog lists this as "deterministic + LLM" with both
 * sides dispatched under the same canonical id. This implementation combines
 * both phases: the deterministic id-dedup check runs first (synchronously),
 * then the LLM semantic novelty check is made via the LLM caller. This avoids
 * having two registry entries with the same id (which would fail registry
 * validation).
 *
 * Severity: MEDIUM on duplicate id; LOW on category drift.
 */

import type {
  ValidatorRuntimeParams,
  ValidatorFinding,
} from '../../validatorRegistry';
import type { LLMCaller } from '../../../../llm/llmCaller';
import type { TemplateLoader } from '../../../../orchestrator/templateLoader';
import type { LLMInvokeContext } from './llmValidatorRunner';
import { runLLMValidator } from './llmValidatorRunner';

/**
 * Deterministic dedup: find surfaced_assumptions whose id matches an existing
 * assumption id (from existing_assumptions or parent context).
 */
function runDeterministicDedup(
  outputContent: Record<string, unknown> | null,
): ValidatorFinding[] {
  if (!outputContent) return [];
  const findings: ValidatorFinding[] = [];

  const surfaced: unknown[] =
    (outputContent.surfaced_assumptions as unknown[]) ??
    (outputContent.assumptions as unknown[]) ??
    [];
  if (!Array.isArray(surfaced) || surfaced.length === 0) return [];

  const existing: unknown[] =
    (outputContent.existing_assumptions as unknown[]) ??
    [];
  const existingIds = new Set<string>();
  for (const ea of existing) {
    if (!ea || typeof ea !== 'object') continue;
    const e = ea as Record<string, unknown>;
    const id = typeof e.id === 'string' ? e.id : typeof e.assumption_id === 'string' ? e.assumption_id : '';
    if (id) existingIds.add(id);
  }

  for (let i = 0; i < surfaced.length; i++) {
    const sa = surfaced[i];
    if (!sa || typeof sa !== 'object') continue;
    const s = sa as Record<string, unknown>;
    const id = typeof s.id === 'string' ? s.id : typeof s.assumption_id === 'string' ? s.assumption_id : '';
    if (id && existingIds.has(id)) {
      findings.push({
        validatorId: 'surfaced_assumption_novelty',
        severity: 'MEDIUM',
        type: 'duplicate_assumption_id',
        summary: `surfaced_assumptions[${i}] id '${id}' already exists in existing_assumptions`,
        location: `$.surfaced_assumptions[${i}].id`,
        detail: `Assumption id '${id}' is already in the existing_assumptions list. Surfacing a duplicate id wastes a citation slot and may cause downstream dedup failures.`,
        recommendation: `Remove or renumber assumption '${id}' — it is already in the existing set.`,
      });
    }
  }

  return findings;
}

export async function invokeSurfacedAssumptionNovelty(
  params: ValidatorRuntimeParams,
  llmCaller: LLMCaller,
  templateLoader: TemplateLoader,
  context: LLMInvokeContext,
): Promise<ValidatorFinding[]> {
  // Phase 1: Deterministic dedup
  const deterministicFindings = runDeterministicDedup(params.outputContent);

  // Phase 2: LLM semantic novelty + category-drift check
  const llmFindings = await runLLMValidator(
    params,
    llmCaller,
    templateLoader,
    {
      validatorId: 'surfaced_assumption_novelty',
      workflowRunId: context.workflowRunId,
      phaseId: context.phaseId,
      subPhaseId: context.subPhaseId,
      recordLLMUsage: context.recordLLMUsage,
      provider: context.harnessProvider,
      model: context.harnessModel,
      temperature: context.harnessTemperature,
    },
    context.pushFailure,
  );

  return [...deterministicFindings, ...llmFindings];
}
