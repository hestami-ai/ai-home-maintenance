/**
 * Deterministic validator: entity_kind_consistency_validator
 *
 * Per validator_catalog.md §5.4.1 (Phase 5.1a data_model_saturation, sample 26a):
 * Verify that the child entity carrying the aggregate's primary key is not
 * classified as `kind: "value_type"`. The entity holding the aggregate PK
 * must be classified as root entity or aggregate root, not a value object.
 *
 * Evidence: sample 26a — PropertyIdentity classified as `value_type` despite
 * carrying aggregate PK `property_id`, affecting downstream ownership semantics.
 *
 * Detection: look for children with `is_identity: true` OR whose name/id
 * contains "Identity", "Root", "PK", "Key" pattern AND are classified as
 * `kind: "value_type"`.
 *
 * Severity: LOW-MEDIUM (PK holder classified as value_type → LOW-MEDIUM per catalog).
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

const IDENTITY_NAME_RE = /identity|root|aggregate.?root|primary.?key/i;

export function validateEntityKindConsistency(
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

    const kind = typeof c.kind === 'string' ? c.kind : '';
    if (kind !== 'value_type') return;

    const isIdentity = c.is_identity === true;
    const name =
      typeof c.name === 'string' ? c.name
      : typeof c.entity_name === 'string' ? c.entity_name
      : typeof c.id === 'string' ? c.id
      : '';

    const nameMatchesIdentity = IDENTITY_NAME_RE.test(name);

    if (isIdentity || nameMatchesIdentity) {
      findings.push({
        validatorId: 'entity_kind_consistency_validator',
        severity: 'MEDIUM',
        type: 'pk_holder_classified_as_value_type',
        summary: `Entity '${name}' carries aggregate PK but is classified as kind='value_type'`,
        location: `$.children[${idx}].kind`,
        detail: `Entity '${name}' appears to be an identity/PK carrier (is_identity=${String(isIdentity)}, name="${name}") but is classified as 'value_type'. Value types do not own PKs; this affects downstream ownership semantics.`,
        recommendation: `Reclassify '${name}' to 'aggregate_root' or 'root_entity' to correctly represent PK ownership.`,
      });
    }
  });

  return findings;
}
