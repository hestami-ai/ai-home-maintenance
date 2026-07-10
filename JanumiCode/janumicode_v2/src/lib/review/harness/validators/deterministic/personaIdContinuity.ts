/**
 * Deterministic validator: persona_id_continuity
 *
 * Per validator_catalog.md §3 (Bloom-class): every persona ID referenced
 * elsewhere in the output must be defined in the personas[] array.
 * Internal-consistency check (Commit 3 stub for the upstream-comparison
 * variant — full upstream comparison via params.upstreamFindings is a
 * later commit's job; for now we verify within-output integrity).
 *
 * This validator emits ADVISORY findings only; targetField/targetIdentifier
 * are not populated because findings do not correspond to mutable array
 * elements — they flag references to undefined persona ids that appear
 * scattered throughout the artifact, not a single mutable array element.
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

const PERSONA_ID_REGEX = /\bP-[A-Z0-9_]+\b/g;

function collectPersonaIds(personas: unknown): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(personas)) return ids;
  for (const p of personas) {
    if (p && typeof p === 'object') {
      const id = (p as Record<string, unknown>).id;
      if (typeof id === 'string') ids.add(id);
    }
  }
  return ids;
}

function collectStringReferences(value: string, refs: Set<string>): void {
  const matches = value.match(PERSONA_ID_REGEX);
  if (matches) for (const m of matches) refs.add(m);
}

function collectReferences(value: unknown, refs: Set<string>, skipPersonas = false): void {
  if (value == null) return;
  if (typeof value === 'string') {
    collectStringReferences(value, refs);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectReferences(v, refs);
    return;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (skipPersonas && k === 'personas') continue;
      collectReferences(v, refs);
    }
  }
}

export function validatePersonaIdContinuity(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const out = params.outputContent;
  if (!out) return [];

  const defined = collectPersonaIds(out.personas);
  const refs = new Set<string>();
  // Walk all fields except `personas` (where definitions live).
  collectReferences(out, refs, true);

  const findings: ValidatorFinding[] = [];
  for (const ref of refs) {
    if (!defined.has(ref)) {
      findings.push({
        validatorId: 'persona_id_continuity',
        severity: 'HIGH',
        type: 'undefined_persona_reference',
        summary: `Persona '${ref}' referenced but not defined`,
        location: `$..${ref}`,
        detail: `Persona ID '${ref}' is referenced in the output but no entry with id='${ref}' exists in personas[].`,
        recommendation: `Add '${ref}' to personas[] or correct the reference.`,
      });
    }
  }
  return findings;
}
