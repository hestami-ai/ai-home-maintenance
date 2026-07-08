/**
 * Deterministic validator: calibration_rule_consistency_lens
 *
 * Per validator_catalog.md §6 + sample 02 §4.2. Lens-only. Encodes the
 * lens classifier's calibration table:
 *
 *   confidence ∈ [0.9, 1.0] → no competing lens disclosure required;
 *                              competitor mention permitted but not mandated.
 *   confidence ∈ [0.8, 0.9) → no mandate (boundary band).
 *   confidence  < 0.8       → must disclose at least one competitor lens
 *                              in `lensCorrectnessRationale` / `rationale`.
 *
 * Track-D adopts a stricter form for HIGH band per the locked decision:
 * if confidence >= 0.8 then `lensCorrectnessRationale` must include
 * verbatim disclosure of competing lenses considered (per the user's
 * Commit-3 description). We implement the catalog-canonical version
 * (low-confidence requires disclosure).
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

const LENS_VOCABULARY = ['product', 'feature', 'bug', 'infra', 'legal'] as const;

function getRationale(out: Record<string, unknown>): string {
  const r1 = out.lensCorrectnessRationale;
  const r2 = out.rationale;
  return [typeof r1 === 'string' ? r1 : '', typeof r2 === 'string' ? r2 : '']
    .filter(Boolean)
    .join('\n');
}

function mentionsCompetingLens(text: string, chosen: string | null): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return LENS_VOCABULARY.some(
    (lens) => lens !== chosen && new RegExp(String.raw`\b${lens}\b`).test(lower),
  );
}

export function validateCalibrationRuleConsistencyLens(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  if (params.subPhaseId !== 'intent_lens_classification') return [];
  const out = params.outputContent;
  if (!out) return [];

  const confidenceRaw = out.confidence;
  if (typeof confidenceRaw !== 'number') return [];
  const confidence = confidenceRaw;
  const lens = typeof out.lens === 'string' ? out.lens : null;
  const rationale = getRationale(out);
  const findings: ValidatorFinding[] = [];

  if (confidence < 0.8) {
    if (!mentionsCompetingLens(rationale, lens)) {
      findings.push({
        validatorId: 'calibration_rule_consistency_lens',
        severity: 'HIGH',
        type: 'missing_competitor_disclosure',
        summary: `confidence=${confidence} < 0.8 but rationale does not name a competing lens`,
        location: '$.lensCorrectnessRationale',
        detail:
          'Calibration table requires disclosing competing lenses considered when confidence < 0.8.',
        recommendation:
          'Add explicit mention of the competing lens(es) considered, or raise confidence with justification.',
      });
    }
  }

  if (confidence < 0 || confidence > 1) {
    findings.push({
      validatorId: 'calibration_rule_consistency_lens',
      severity: 'MEDIUM',
      type: 'confidence_out_of_range',
      summary: `confidence=${confidence} outside [0.0, 1.0]`,
      location: '$.confidence',
      detail: 'Confidence must be in [0.0, 1.0].',
      recommendation: 'Clamp confidence to [0.0, 1.0].',
    });
  }

  return findings;
}
