/**
 * Deterministic validator: adr_status_discipline_validator
 *
 * Per validator_catalog.md §6 (Phase 4.3 adr_capture, sample 20):
 * Enforce ADR status default of 'proposed' unless explicit acceptance rationale
 * is captured in `accepted_rationale[]` or equivalent field.
 *
 * Evidence: sample 20 — all ADRs emitted with status='accepted' without
 * grounding the acceptance criterion in source.
 *
 * Severity:
 *   - LOW: all ADRs accepted without any rationale body.
 *   - MEDIUM: individual ADR accepted without rationale body.
 *
 * DESIGN NOTE: The catalog specifies LOW-MEDIUM per the combined table. The
 * implementation uses MEDIUM per individual violation and LOW when the entire
 * ADR set uses 'accepted' with no rationale (aggregate pattern). This matches
 * the catalog's "all ADRs accepted without rationale → LOW; individual ADR
 * accepted without rationale → MEDIUM" description.
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

const ACCEPTED_STATUS = new Set(['accepted', 'approved', 'confirmed']);

function hasRationale(adr: Record<string, unknown>): boolean {
  const fields = ['accepted_rationale', 'rationale', 'acceptance_rationale', 'justification'];
  for (const field of fields) {
    const val = adr[field];
    if (typeof val === 'string' && val.trim().length > 10) return true;
    if (Array.isArray(val) && val.length > 0) return true;
  }
  return false;
}

export function validateAdrStatusDiscipline(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const { outputContent } = params;
  if (!outputContent) return [];

  const adrs: unknown[] =
    (outputContent.adrs as unknown[]) ??
    (outputContent.architectural_decisions as unknown[]) ??
    (outputContent.decisions as unknown[]) ??
    [];

  if (!Array.isArray(adrs) || adrs.length === 0) return [];

  const findings: ValidatorFinding[] = [];
  let acceptedWithoutRationale = 0;

  adrs.forEach((adr, idx) => {
    if (!adr || typeof adr !== 'object') return;
    const a = adr as Record<string, unknown>;

    const status = typeof a.status === 'string' ? a.status.toLowerCase() : 'proposed';
    if (!ACCEPTED_STATUS.has(status)) return; // 'proposed' is fine

    if (!hasRationale(a)) {
      acceptedWithoutRationale++;
      const title =
        typeof a.title === 'string' ? a.title
        : typeof a.id === 'string' ? a.id
        : `ADR[${idx}]`;

      findings.push({
        validatorId: 'adr_status_discipline_validator',
        severity: 'MEDIUM',
        type: 'accepted_without_rationale',
        summary: `ADR '${title}' has status='${status}' but no acceptance rationale`,
        location: `$.adrs[${idx}].status`,
        detail: `ADR '${title}' is marked '${status}' but no acceptance rationale field is populated. ADRs should default to 'proposed' unless an explicit acceptance review has occurred.`,
        recommendation: `Set status='proposed' unless the decision has been formally accepted. If accepted, populate accepted_rationale with the acceptance grounds.`,
      });
    }
  });

  // Aggregate pattern: all ADRs accepted without rationale → downgrade to LOW
  if (acceptedWithoutRationale > 0 && acceptedWithoutRationale === adrs.length) {
    // Replace all MEDIUM findings with LOW
    return findings.map((f) => ({ ...f, severity: 'LOW' as const }));
  }

  return findings;
}
