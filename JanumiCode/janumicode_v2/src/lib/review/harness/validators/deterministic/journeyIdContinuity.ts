/**
 * Deterministic validator: journey_id_continuity
 *
 * Per validator_catalog.md §3 (Bloom-class). Internal-consistency variant:
 * every UJ-* reference in the output must resolve to an entry in
 * userJourneys[]. Per sample 06.
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

const JOURNEY_ID_REGEX = /\bUJ-[A-Z0-9_]+\b/g;

function collectIds(arr: unknown): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(arr)) return ids;
  for (const item of arr) {
    if (item && typeof item === 'object') {
      const id = (item as Record<string, unknown>).id;
      if (typeof id === 'string') ids.add(id);
    }
  }
  return ids;
}

function collectStringRefs(value: string, refs: Set<string>): void {
  const m = value.match(JOURNEY_ID_REGEX);
  if (m) for (const id of m) refs.add(id);
}

function walk(value: unknown, refs: Set<string>, skip: string | null = null): void {
  if (value == null) return;
  if (typeof value === 'string') {
    collectStringRefs(value, refs);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) walk(v, refs);
    return;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (skip && k === skip) continue;
      walk(v, refs);
    }
  }
}

export function validateJourneyIdContinuity(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const out = params.outputContent;
  if (!out) return [];
  // Accept snake_case (canonical) with camelCase fallback for backward compat.
  const journeysKey = 'user_journeys' in out ? 'user_journeys' : 'userJourneys';
  const defined = collectIds(out[journeysKey]);
  const refs = new Set<string>();
  walk(out, refs, journeysKey);

  const findings: ValidatorFinding[] = [];
  for (const ref of refs) {
    if (!defined.has(ref)) {
      findings.push({
        validatorId: 'journey_id_continuity',
        severity: 'HIGH',
        type: 'undefined_journey_reference',
        summary: `Journey '${ref}' referenced but not defined`,
        location: `$..${ref}`,
        detail: `Journey ID '${ref}' is referenced but does not exist in userJourneys[].`,
        recommendation: `Add a userJourneys[] entry with id='${ref}' or correct the reference.`,
      });
    }
  }
  return findings;
}
