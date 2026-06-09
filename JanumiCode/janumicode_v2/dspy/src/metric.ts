/**
 * Deterministic metric for the `fr_saturation` pilot.
 *
 * The score equals the deterministic subset of the production review bundle for
 * (requirements_agent, fr_saturation) — see validatorRegistry.ts DISPATCH_BUNDLES.
 * Each validator is a pure function over ValidatorRuntimeParams, so we reconstruct
 * those params from a recorded (or DSPy-generated) prompt+output and run them headless.
 *
 * Score model: 1.0 = clean. Each finding adds a severity-weighted penalty; the score
 * is 1 - penalty/CAP, floored at 0. An unparseable output (the json-discipline hard
 * gate) scores 0.
 */

import type {
  ValidatorRuntimeParams,
  ValidatorFinding,
} from '../../src/lib/review/harness/validatorRegistry';
import { validateJsonOutputDiscipline } from '../../src/lib/review/harness/validators/deterministic/jsonOutputDisciplineCheck';
import { validateContractSchema } from '../../src/lib/review/harness/validators/deterministic/contractSchemaValidator';
import { validateParentBranchClassification } from '../../src/lib/review/harness/validators/deterministic/parentBranchClassificationCheck';
import { validateDecompositionFanoutDiscipline } from '../../src/lib/review/harness/validators/deterministic/decompositionFanoutDiscipline';
import { validateTracesToIdValidity } from '../../src/lib/review/harness/validators/deterministic/tracesToIdValidity';
import { tryParseJson } from '../../src/lib/llm/jsonRecovery';
import type { ScoreResult, ValidatorRollup } from './types';

type ValidateFn = (params: ValidatorRuntimeParams) => ValidatorFinding[];

/** The deterministic fr_saturation bundle, in dispatch order. */
const FR_SATURATION_DETERMINISTIC: Array<{ id: string; fn: ValidateFn }> = [
  { id: 'json_output_discipline_check', fn: validateJsonOutputDiscipline },
  { id: 'contract_schema_validator', fn: validateContractSchema },
  { id: 'parent_branch_classification_check', fn: validateParentBranchClassification },
  { id: 'decomposition_fanout_discipline', fn: validateDecompositionFanoutDiscipline },
  { id: 'traces_to_id_validity', fn: validateTracesToIdValidity },
];

export const SEVERITY_WEIGHT: Record<ValidatorFinding['severity'], number> = {
  HIGH: 1.0,
  MEDIUM: 0.4,
  LOW: 0.1,
};

/** Penalty at/above which the score saturates to 0. Tunable. */
export const PENALTY_CAP = 4.0;

export interface ScoreInput {
  agentRole: string;
  subPhaseId: string;
  prompt: string;
  system: string | null;
  outputText: string;
}

export interface ScoreOptions {
  /**
   * Include the deterministic citation-grounding proxy. Default true. Set false
   * when the real LLM `assumption_citation_validator` runs (judge-in-the-loop)
   * so citation grounding is not double-counted.
   */
  includeCitationProxy?: boolean;
}

/**
 * Parse the candidate output the same way production would: strict JSON first,
 * then the deterministic structural-recovery pass (jsonRecovery.tryParseJson).
 */
function parseOutput(text: string): Record<string, unknown> | null {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return null;
  try {
    const direct = JSON.parse(trimmed);
    return direct && typeof direct === 'object' ? (direct as Record<string, unknown>) : null;
  } catch {
    /* fall through to recovery */
  }
  const recov = tryParseJson(trimmed);
  return recov.parsed && typeof recov.parsed === 'object'
    ? (recov.parsed as Record<string, unknown>)
    : null;
}

export function scoreCandidate(input: ScoreInput, options: ScoreOptions = {}): ScoreResult {
  const includeCitationProxy = options.includeCitationProxy ?? true;
  const outputContent = parseOutput(input.outputText);
  const parseOk = outputContent !== null;

  const params: ValidatorRuntimeParams = {
    agentRole: input.agentRole,
    subPhaseId: input.subPhaseId,
    agentOutputId: 'candidate',
    outputText: input.outputText ?? '',
    outputContent,
    outputThinking: null,
    originalPrompt: input.prompt ?? '',
    originalSystem: input.system ?? null,
  };

  const byValidator: ValidatorRollup[] = [];
  let penalty = 0;
  let totalFindings = 0;

  // Synthetic deterministic proxy for the LLM `assumption_citation_validator`.
  // The judge flagged uncited surfaced_assumptions as a grounding defect; that
  // core is deterministically checkable, so we run it in-loop (zero LLM cost)
  // and leave the full judge for final eval. An assumption must cite a source
  // unless it is itself the open question (category 'open_question').
  const proxyFindings: ValidatorFinding[] = [];
  if (outputContent) {
    const assumptions = Array.isArray(outputContent.surfaced_assumptions)
      ? (outputContent.surfaced_assumptions as Array<Record<string, unknown>>)
      : [];
    assumptions.forEach((a, i) => {
      const category = String(a?.category ?? '');
      const citations = a?.citations;
      const hasCitation = Array.isArray(citations) && citations.length > 0;
      if (category !== 'open_question' && !hasCitation) {
        proxyFindings.push({
          validatorId: 'citation_grounding_proxy',
          severity: 'MEDIUM',
          type: 'uncited_assumption',
          summary: `surfaced_assumptions[${i}] (category '${category || 'unset'}') has no citations`,
          location: `$.surfaced_assumptions[${i}].citations`,
          detail: 'A surfaced assumption must cite the handoff/source id it derives from unless it is an open_question.',
          recommendation: 'Add a citation to a handoff id, or recategorize as open_question.',
        });
      }
    });
  }

  const steps: Array<{ id: string; fn: ValidateFn }> = [
    ...FR_SATURATION_DETERMINISTIC,
    ...(includeCitationProxy ? [{ id: 'citation_grounding_proxy', fn: () => proxyFindings }] : []),
  ];

  for (const { id, fn } of steps) {
    let findings: ValidatorFinding[] = [];
    try {
      findings = fn(params) ?? [];
    } catch (err) {
      // A validator that throws on a malformed candidate is itself a signal —
      // count it as one HIGH finding rather than crashing the whole score.
      findings = [{
        validatorId: id,
        severity: 'HIGH',
        type: 'validator_threw',
        summary: `validator threw: ${err instanceof Error ? err.message : String(err)}`,
        location: '',
        detail: '',
        recommendation: '',
      }];
    }
    const rollup: ValidatorRollup = { validatorId: id, high: 0, medium: 0, low: 0, summaries: [] };
    for (const f of findings) {
      penalty += SEVERITY_WEIGHT[f.severity] ?? 0;
      totalFindings++;
      if (f.severity === 'HIGH') rollup.high++;
      else if (f.severity === 'MEDIUM') rollup.medium++;
      else rollup.low++;
      if (rollup.summaries.length < 5) rollup.summaries.push(`[${f.severity}] ${f.summary}`);
    }
    byValidator.push(rollup);
  }

  // Hard gate: an unparseable output cannot be a valid decomposition.
  const score = parseOk ? Math.max(0, 1 - penalty / PENALTY_CAP) : 0;

  return { score, parseOk, penalty, byValidator, totalFindings };
}
