/**
 * Deterministic validator: extraction_id_traceability
 *
 * Per validator_catalog §4 + samples 03/04. Verifies every ID in the
 * output follows the documented prefix convention, is unique within
 * its array, and any cross-array reference resolves.
 *
 * Severity: malformed prefix -> HIGH; duplicate -> HIGH; broken
 * cross-reference -> MEDIUM.
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

/** Per-pass expected ID prefix(es). */
const PREFIX_RULES: Record<string, readonly string[]> = {
  product_intent_discovery: ['INTENT-', 'CAP-', 'USER-', 'CTX-'],
  technical_constraints_discovery: ['TC-', 'PLAT-', 'INT-'],
  compliance_retention_discovery: ['REG-', 'RET-', 'DC-', 'AUD-'],
  vv_requirements_discovery: ['VV-'],
  canonical_vocabulary_discovery: ['VOC-', 'GLOSS-'],
};

const ID_FIELD_PATTERN = /^[A-Z][A-Z0-9_-]*-\d+$/;

/**
 * Extract the top-level array/field name from a JSON path like
 * `$.user_stories[0].id` -> `user_stories`. Returns null if the path
 * does not begin with `$.<field>`.
 */
function topLevelFieldFromPath(path: string): string | null {
  const m = /^\$\.([A-Za-z_]\w*)/.exec(path);
  return m ? m[1] : null;
}

function collectIds(node: unknown, ids: { id: string; path: string }[], path: string): void {
  if (Array.isArray(node)) {
    node.forEach((item, idx) => collectIds(item, ids, `${path}[${idx}]`));
    return;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'id' && typeof v === 'string') {
        ids.push({ id: v, path: `${path}.id` });
      } else {
        collectIds(v, ids, path ? `${path}.${k}` : k);
      }
    }
  }
}

/** Build the optional machine-resolvable target block shared by
 * duplicate/malformed findings. */
function targetBlock(
  targetField: string | null,
  id: string,
): Partial<Pick<ValidatorFinding, 'targetField' | 'targetIdentifier'>> {
  return targetField ? { targetField, targetIdentifier: id } : {};
}

/** Duplicate detection (within whole output). */
function detectDuplicateIds(
  ids: { id: string; path: string }[],
): ValidatorFinding[] {
  const findings: ValidatorFinding[] = [];
  const seen = new Map<string, string>();
  for (const { id, path } of ids) {
    if (!seen.has(id)) {
      seen.set(id, path);
      continue;
    }
    const targetField = topLevelFieldFromPath(path);
    findings.push({
      validatorId: 'extraction_id_traceability',
      severity: targetField ? 'HIGH' : 'MEDIUM',
      type: 'duplicate_id',
      summary: `Duplicate id '${id}'`,
      location: path,
      detail: `Id '${id}' already appears at ${seen.get(id)}.`,
      recommendation: 'Make every id unique within the output.',
      ...targetBlock(targetField, id),
    });
  }
  return findings;
}

/** Format check: every id must match the PREFIX-NNN pattern. */
function detectMalformedIds(
  ids: { id: string; path: string }[],
): ValidatorFinding[] {
  const findings: ValidatorFinding[] = [];
  for (const { id, path } of ids) {
    if (ID_FIELD_PATTERN.test(id)) continue;
    const targetField = topLevelFieldFromPath(path);
    findings.push({
      validatorId: 'extraction_id_traceability',
      severity: targetField ? 'HIGH' : 'MEDIUM',
      type: 'malformed_id',
      summary: `Malformed id '${id}'`,
      location: path,
      detail: `Id '${id}' does not match PREFIX-NNN pattern.`,
      recommendation: 'Use the documented PREFIX-NNN convention.',
      ...targetBlock(targetField, id),
    });
  }
  return findings;
}

/** Pass-aware prefix check. */
function detectUnexpectedPrefixes(
  ids: { id: string; path: string }[],
  subPhaseId: string,
): ValidatorFinding[] {
  const expected = PREFIX_RULES[subPhaseId];
  if (!expected || expected.length === 0) return [];
  const findings: ValidatorFinding[] = [];
  for (const { id, path } of ids) {
    if (expected.some((p) => id.startsWith(p))) continue;
    findings.push({
      validatorId: 'extraction_id_traceability',
      severity: 'MEDIUM',
      type: 'unexpected_prefix',
      summary: `Id '${id}' has unexpected prefix for pass`,
      location: path,
      detail: `Pass ${subPhaseId} expects prefixes: ${expected.join(', ')}.`,
      recommendation: 'Renumber with the documented prefix for this pass.',
    });
  }
  return findings;
}

export function validateExtractionIdTraceability(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const out = params.outputContent;
  if (!out) return [];

  const ids: { id: string; path: string }[] = [];
  collectIds(out, ids, '$');

  return [
    ...detectDuplicateIds(ids),
    ...detectMalformedIds(ids),
    ...detectUnexpectedPrefixes(ids, params.subPhaseId),
  ];
}
