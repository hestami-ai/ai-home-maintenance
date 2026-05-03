/**
 * Deterministic validator: nfr_structural_completeness
 *
 * Per validator_catalog §5.2 + sample 11 (NFR-only). Each entry in
 * nonFunctionalRequirements[] (or nfrs[]) must have non-empty id,
 * category, description, and seed_threshold (object or string).
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

const REQUIRED_FIELDS = ['id', 'category', 'description'] as const;

export function validateNfrStructuralCompleteness(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const out = params.outputContent;
  if (!out) return [];
  const nfrs = out.requirements;
  if (!Array.isArray(nfrs)) return [];

  const findings: ValidatorFinding[] = [];
  nfrs.forEach((nfr, idx) => {
    if (!nfr || typeof nfr !== 'object') {
      findings.push({
        validatorId: 'nfr_structural_completeness',
        severity: 'HIGH',
        type: 'malformed_nfr',
        summary: `requirements[${idx}] is not an object`,
        location: `$.requirements[${idx}]`,
        detail: 'Each NFR must be an object with id/category/description/seed_threshold.',
        recommendation: 'Replace with a structured NFR object.',
      });
      return;
    }
    const n = nfr as Record<string, unknown>;
    const idLabel = typeof n.id === 'string' ? n.id : `index ${idx}`;

    for (const field of REQUIRED_FIELDS) {
      const value = n[field];
      if (value === undefined || value === null) {
        findings.push({
          validatorId: 'nfr_structural_completeness',
          severity: 'HIGH',
          type: 'missing_field',
          summary: `NFR ${idLabel} missing field '${field}'`,
          location: `$.requirements[${idx}].${field}`,
          detail: `NFR '${idLabel}' has no '${field}' field.`,
          recommendation: `Populate '${field}' for NFR ${idLabel}.`,
        });
      } else if (typeof value === 'string' && value.trim() === '') {
        findings.push({
          validatorId: 'nfr_structural_completeness',
          severity: 'HIGH',
          type: 'empty_field',
          summary: `NFR ${idLabel} has empty '${field}'`,
          location: `$.requirements[${idx}].${field}`,
          detail: `NFR '${idLabel}' has whitespace-only '${field}' value.`,
          recommendation: `Provide a substantive '${field}' value.`,
        });
      }
    }

    const seed = n.seed_threshold;
    if (seed === undefined || seed === null) {
      findings.push({
        validatorId: 'nfr_structural_completeness',
        severity: 'HIGH',
        type: 'missing_seed_threshold',
        summary: `NFR ${idLabel} missing seed_threshold`,
        location: `$.requirements[${idx}].seed_threshold`,
        detail: `NFR '${idLabel}' must declare a seed_threshold (object or string) at skeleton.`,
        recommendation: 'Populate seed_threshold; mark as TBD only with explicit open-question.',
      });
    } else if (typeof seed === 'string' && seed.trim() === '') {
      findings.push({
        validatorId: 'nfr_structural_completeness',
        severity: 'MEDIUM',
        type: 'empty_seed_threshold',
        summary: `NFR ${idLabel} has empty seed_threshold`,
        location: `$.requirements[${idx}].seed_threshold`,
        detail: `NFR '${idLabel}' seed_threshold is whitespace-only.`,
        recommendation: 'Provide a concrete seed_threshold.',
      });
    }
  });
  return findings;
}
