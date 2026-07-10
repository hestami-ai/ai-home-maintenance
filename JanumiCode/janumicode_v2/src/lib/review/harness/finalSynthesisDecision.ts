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

/** Plural suffix helper: `''` for exactly one, `'s'` otherwise. */
function pluralSuffix(n: number): string {
  return n === 1 ? '' : 's';
}

interface SeverityTally {
  high: number;
  medium: number;
  low: number;
  contractDesign: ReviewHarnessContractDesignFinding[];
}

/**
 * Split findings into operational severity counts (HIGH/MEDIUM/LOW) and the
 * informational-only contract-design collation. Contract-design findings do
 * NOT contribute to the severity tally (§6.5 locked).
 */
function tallyFindings(findings: readonly ValidatorFinding[]): SeverityTally {
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

  return { high, medium, low, contractDesign };
}

/** Base decision before unavailable escalation, per the locked severity floor. */
function computeBaseDecision(
  high: number,
  medium: number,
  low: number,
): ReviewHarnessDecision {
  if (high >= 2) return 'QUARANTINE';
  if (high === 1) return 'REVISE';
  if (medium >= 1) return 'REVISE';
  if (low >= 1) return 'ACCEPT_WITH_NOTES';
  return 'ACCEPT';
}

/** Rationale fragments describing the operational severity counts. */
function buildSeverityRationale(
  high: number,
  medium: number,
  low: number,
): string[] {
  const parts: string[] = [];
  if (high > 0) parts.push(`${high} HIGH finding${pluralSuffix(high)}`);
  if (medium > 0) parts.push(`${medium} MEDIUM finding${pluralSuffix(medium)}`);
  if (low > 0) parts.push(`${low} LOW finding${pluralSuffix(low)}`);
  if (parts.length === 0) parts.push('no operational findings');
  return parts;
}

interface EscalationOutcome {
  decision: ReviewHarnessDecision;
  rationaleParts: string[];
}

/**
 * Apply validator_unavailable escalation to the base decision, returning the
 * final decision plus the rationale fragments that describe the transition.
 */
function applyUnavailableEscalation(
  base: ReviewHarnessDecision,
  high: number,
  validatorUnavailableCount: number,
): EscalationOutcome {
  if (validatorUnavailableCount === 0) {
    return { decision: base, rationaleParts: [`-> ${base}`] };
  }

  const parts: string[] = [
    `${validatorUnavailableCount} validator_unavailable failure${pluralSuffix(
      validatorUnavailableCount,
    )}`,
  ];

  // HIGH + unavailable → ESCALATE (degraded coverage on serious finding).
  if (high >= 1) {
    parts.push('-> ESCALATE (HIGH + degraded coverage)');
    return { decision: 'ESCALATE', rationaleParts: parts };
  }

  // Escalate by one tier.
  const decision = escalateOneTier(base);
  if (decision !== base) {
    parts.push(`-> ${base} escalated to ${decision}`);
  }
  return { decision, rationaleParts: parts };
}

/**
 * Compute the advisory decision per the locked policy. Pure function.
 */
export function computeFinalSynthesisDecision(
  findings: readonly ValidatorFinding[],
  failures: readonly DecisionInputFailure[],
): FinalSynthesisDecisionResult {
  const { high, medium, low, contractDesign } = tallyFindings(findings);
  const validatorUnavailableCount = countFailures(failures);
  const base = computeBaseDecision(high, medium, low);

  const rationaleParts = buildSeverityRationale(high, medium, low);
  const escalation = applyUnavailableEscalation(
    base,
    high,
    validatorUnavailableCount,
  );
  rationaleParts.push(...escalation.rationaleParts);

  if (contractDesign.length > 0) {
    rationaleParts.push(
      `${contractDesign.length} contract-design finding${pluralSuffix(
        contractDesign.length,
      )} (informational)`,
    );
  }

  return {
    decision: escalation.decision,
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
