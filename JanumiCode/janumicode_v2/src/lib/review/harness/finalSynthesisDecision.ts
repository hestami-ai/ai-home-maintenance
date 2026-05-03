/**
 * Final-synthesis deterministic decision policy (Track D Commit 8).
 *
 * Per harness_design.md §6 and deferred_to_track_d.md §6.3 (locked):
 *
 *   - HIGH-wins-automatically: any single HIGH from any validator raises
 *     the decision floor.
 *       0 HIGH, 0 MEDIUM, 0 LOW            -> ACCEPT
 *       0 HIGH, 0 MEDIUM, ≥1 LOW           -> ACCEPT_WITH_NOTES
 *       0 HIGH, ≥1 MEDIUM                  -> REVISE
 *       1 HIGH                             -> REVISE
 *       ≥2 HIGH                            -> QUARANTINE
 *
 *   - validator_unavailable failures (the harness records these in
 *     `validatorFailures`) escalate the decision by exactly one tier:
 *       ACCEPT              -> REVISE
 *       ACCEPT_WITH_NOTES   -> REVISE
 *       REVISE              -> QUARANTINE
 *       QUARANTINE          -> QUARANTINE (no change at top tier)
 *
 *   - HIGH + validator_unavailable -> ESCALATE (degraded coverage on a
 *     serious finding requires human attention).
 *
 *   - contractDesignFindings are INFORMATIONAL ONLY and never influence
 *     the decision (§6.5 locked).
 *
 * The computer is a pure function over (findings, failures). The
 * `final_synthesis` LLM prompt becomes a narrative summariser; the
 * deterministic decision is computed in code so it cannot drift from
 * the locked policy.
 */

import type {
  ReviewHarnessDecision,
  ReviewHarnessContractDesignFinding,
} from '../../types/records';

import type { ValidatorFinding } from './validatorRegistry';

export interface DecisionInputFailure {
  validatorId: string;
  error: string;
}

export interface FinalSynthesisDecisionResult {
  decision: ReviewHarnessDecision;
  rationale: string;
  contractDesignFindings: ReviewHarnessContractDesignFinding[];
  highCount: number;
  mediumCount: number;
  lowCount: number;
  validatorUnavailableCount: number;
}

/** Marker substring used in failure messages for the "unavailable" class. */
const UNAVAILABLE_MARKER = 'validator_unavailable';

/**
 * Validator-finding type tokens that mark a finding as a contract-design
 * defect (collated synthesis-time, informational-only). Matches both
 * exact string `contract_design_defect` and any finding type beginning
 * with `contract_design_` (forward-compat with subtype strings like
 * `contract_design_field_missing`).
 */
function isContractDesignFinding(f: ValidatorFinding): boolean {
  return (
    f.type === 'contract_design_defect' ||
    f.type.startsWith('contract_design_')
  );
}

function countFailures(failures: readonly DecisionInputFailure[]): number {
  let n = 0;
  for (const f of failures) if (f.error.includes(UNAVAILABLE_MARKER)) n += 1;
  return n;
}

/**
 * Compute the advisory decision per the locked policy. Pure function.
 */
export function computeFinalSynthesisDecision(
  findings: readonly ValidatorFinding[],
  failures: readonly DecisionInputFailure[],
): FinalSynthesisDecisionResult {
  let high = 0;
  let medium = 0;
  let low = 0;
  const contractDesign: ReviewHarnessContractDesignFinding[] = [];

  for (const f of findings) {
    if (isContractDesignFinding(f)) {
      contractDesign.push({
        validator_id: f.validatorId,
        severity: f.severity,
        summary: f.summary,
        location: f.location,
        detail: f.detail,
        recommendation: f.recommendation,
      });
      // INFORMATIONAL ONLY — do not contribute to severity tally.
      continue;
    }
    if (f.severity === 'HIGH') high += 1;
    else if (f.severity === 'MEDIUM') medium += 1;
    else if (f.severity === 'LOW') low += 1;
  }

  const validatorUnavailableCount = countFailures(failures);

  // Base decision before unavailable escalation.
  let base: ReviewHarnessDecision;
  if (high >= 2) {
    base = 'QUARANTINE';
  } else if (high === 1) {
    base = 'REVISE';
  } else if (medium >= 1) {
    base = 'REVISE';
  } else if (low >= 1) {
    base = 'ACCEPT_WITH_NOTES';
  } else {
    base = 'ACCEPT';
  }

  let decision: ReviewHarnessDecision = base;
  const rationaleParts: string[] = [];

  if (high > 0) rationaleParts.push(`${high} HIGH finding${high === 1 ? '' : 's'}`);
  if (medium > 0) rationaleParts.push(`${medium} MEDIUM finding${medium === 1 ? '' : 's'}`);
  if (low > 0) rationaleParts.push(`${low} LOW finding${low === 1 ? '' : 's'}`);
  if (rationaleParts.length === 0) rationaleParts.push('no operational findings');

  if (validatorUnavailableCount > 0) {
    rationaleParts.push(
      `${validatorUnavailableCount} validator_unavailable failure${
        validatorUnavailableCount === 1 ? '' : 's'
      }`,
    );

    // HIGH + unavailable → ESCALATE (degraded coverage on serious finding).
    if (high >= 1) {
      decision = 'ESCALATE';
      rationaleParts.push('-> ESCALATE (HIGH + degraded coverage)');
    } else {
      // Escalate by one tier.
      decision = escalateOneTier(base);
      if (decision !== base) {
        rationaleParts.push(`-> ${base} escalated to ${decision}`);
      }
    }
  } else {
    rationaleParts.push(`-> ${decision}`);
  }

  if (contractDesign.length > 0) {
    rationaleParts.push(
      `${contractDesign.length} contract-design finding${
        contractDesign.length === 1 ? '' : 's'
      } (informational)`,
    );
  }

  return {
    decision,
    rationale: rationaleParts.join('; '),
    contractDesignFindings: contractDesign,
    highCount: high,
    mediumCount: medium,
    lowCount: low,
    validatorUnavailableCount,
  };
}

function escalateOneTier(d: ReviewHarnessDecision): ReviewHarnessDecision {
  switch (d) {
    case 'ACCEPT':
      return 'REVISE';
    case 'ACCEPT_WITH_NOTES':
      return 'REVISE';
    case 'REVISE':
      return 'QUARANTINE';
    case 'QUARANTINE':
      return 'QUARANTINE';
    case 'ESCALATE':
      return 'ESCALATE';
  }
}
