/**
 * Deterministic validator: status_consistency_iqc
 *
 * Per validator_catalog.md §6 + sample 01 §4.2. IQC-only. Encodes the
 * `overall_status` rules from the IQC system prompt as deterministic code:
 *
 * - `overall_status=blocking` requires at least one concern with severity
 *    'blocking'.
 * - `overall_status=pass` forbids any concern with severity 'blocking'.
 * - `hasConcerns` (when present) must agree with `concerns.length > 0`.
 *
 * The original defect that motivated this entire effort: hasConcerns=true
 * but concerns=[] (or vice-versa).
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

export function validateStatusConsistencyIqc(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  if (params.subPhaseId !== 'intent_quality_check') return [];
  const out = params.outputContent;
  if (!out) return [];

  const findings: ValidatorFinding[] = [];
  const concerns = Array.isArray(out.concerns) ? out.concerns : null;
  const hasConcerns = out.hasConcerns;
  const overallStatus = typeof out.overall_status === 'string' ? out.overall_status : null;

  // hasConcerns ↔ concerns.length > 0 invariant (when both present).
  if (typeof hasConcerns === 'boolean' && concerns) {
    const expected = concerns.length > 0;
    if (hasConcerns !== expected) {
      findings.push({
        validatorId: 'status_consistency_iqc',
        severity: 'HIGH',
        type: 'has_concerns_mismatch',
        summary: `hasConcerns=${hasConcerns} disagrees with concerns.length=${concerns.length}`,
        location: '$.hasConcerns',
        detail:
          'Boolean-gate invariant violated: hasConcerns must equal (concerns.length > 0).',
        recommendation: 'Recompute hasConcerns from concerns.length, or correct the concerns array.',
      });
    }
  }

  // overall_status ↔ concerns severity rules.
  if (overallStatus && concerns) {
    findings.push(...checkStatusSeverityRules(overallStatus, concerns));
  }

  return findings;
}

/**
 * overall_status ↔ concerns severity consistency rules. Extracted so the
 * top-level validator stays under the cognitive-complexity threshold; the
 * caller guards `overallStatus && concerns` before invoking.
 */
function checkStatusSeverityRules(
  overallStatus: string,
  concerns: unknown[],
): ValidatorFinding[] {
  const findings: ValidatorFinding[] = [];
  const blockingConcerns = concerns.filter(
    (c) =>
      c &&
      typeof c === 'object' &&
      (c as Record<string, unknown>).severity === 'blocking',
  );

  if (overallStatus === 'blocking' && blockingConcerns.length === 0) {
    findings.push({
      validatorId: 'status_consistency_iqc',
      severity: 'HIGH',
      type: 'status_concerns_disagreement',
      summary: 'overall_status=blocking but no blocking concerns',
      location: '$.overall_status',
      detail:
        'overall_status=blocking requires at least one concern with severity=blocking.',
      recommendation:
        'Either downgrade overall_status (pass / requires_input) or add the blocking concern.',
    });
  }
  if (overallStatus === 'pass' && blockingConcerns.length > 0) {
    findings.push({
      validatorId: 'status_consistency_iqc',
      severity: 'HIGH',
      type: 'status_concerns_disagreement',
      summary: `overall_status=pass with ${blockingConcerns.length} blocking concern(s)`,
      location: '$.overall_status',
      detail:
        'overall_status=pass forbids any concern with severity=blocking.',
      recommendation: 'Upgrade overall_status to blocking, or downgrade the concerns.',
    });
  }
  return findings;
}
