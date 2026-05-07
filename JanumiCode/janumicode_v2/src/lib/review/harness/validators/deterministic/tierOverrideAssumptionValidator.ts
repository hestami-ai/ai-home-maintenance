/**
 * Deterministic validator: tier_override_assumption_validator
 *
 * Per validator_catalog.md §5.4.1 (Phase 5.1a data_model_saturation, sample 26b):
 * Verify that when a child overrides the parent's tier hint (`agrees_with_hint: false`),
 * at least one `surfaced_assumptions[]` entry documents the override rationale.
 *
 * Evidence: sample 26b — PropertyIdentity correctly set `agrees_with_hint: false`
 * (overriding Tier-C to Tier-D) but emitted no surfaced assumption documenting
 * the override reasoning.
 *
 * Severity: LOW (missing override rationale).
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

export function validateTierOverrideAssumption(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const { outputContent } = params;
  if (!outputContent) return [];

  const children: unknown[] =
    (outputContent.children as unknown[]) ??
    (outputContent.decomposed_children as unknown[]) ??
    [];

  const findings: ValidatorFinding[] = [];

  children.forEach((child, idx) => {
    if (!child || typeof child !== 'object') return;
    const c = child as Record<string, unknown>;

    if (c.agrees_with_hint !== false) return; // Only flag overrides

    const surfacedAssumptions = c.surfaced_assumptions;
    const hasOverrideRationale =
      Array.isArray(surfacedAssumptions) && surfacedAssumptions.length > 0;

    if (!hasOverrideRationale) {
      const name =
        typeof c.name === 'string' ? c.name
        : typeof c.id === 'string' ? c.id
        : `child[${idx}]`;
      const overrideTier = typeof c.tier === 'string' ? c.tier : '?';

      findings.push({
        validatorId: 'tier_override_assumption_validator',
        severity: 'LOW',
        type: 'missing_override_rationale',
        summary: `Child '${name}' overrides tier hint (tier='${overrideTier}') with no surfaced assumption`,
        location: `$.children[${idx}].surfaced_assumptions`,
        detail: `Child '${name}' has agrees_with_hint=false (tier override to '${overrideTier}') but surfaced_assumptions[] is empty or absent. The override reasoning is not documented.`,
        recommendation: `Add a surfaced_assumptions entry explaining why the tier hint was overridden to '${overrideTier}'.`,
      });
    }
  });

  return findings;
}
