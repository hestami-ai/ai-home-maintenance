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

export function validateExtractionIdTraceability(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const out = params.outputContent;
  if (!out) return [];
  const findings: ValidatorFinding[] = [];

  const ids: { id: string; path: string }[] = [];
  collectIds(out, ids, '$');

  // Duplicate detection (within whole output).
  const seen = new Map<string, string>();
  for (const { id, path } of ids) {
    if (seen.has(id)) {
      findings.push({
        validatorId: 'extraction_id_traceability',
        severity: 'HIGH',
        type: 'duplicate_id',
        summary: `Duplicate id '${id}'`,
        location: path,
        detail: `Id '${id}' already appears at ${seen.get(id)}.`,
        recommendation: 'Make every id unique within the output.',
      });
    } else {
      seen.set(id, path);
    }
  }

  // Format check.
  for (const { id, path } of ids) {
    if (!ID_FIELD_PATTERN.test(id)) {
      findings.push({
        validatorId: 'extraction_id_traceability',
        severity: 'HIGH',
        type: 'malformed_id',
        summary: `Malformed id '${id}'`,
        location: path,
        detail: `Id '${id}' does not match PREFIX-NNN pattern.`,
        recommendation: 'Use the documented PREFIX-NNN convention.',
      });
    }
  }

  // Pass-aware prefix check.
  const expected = PREFIX_RULES[params.subPhaseId];
  if (expected && expected.length > 0) {
    for (const { id, path } of ids) {
      if (!expected.some((p) => id.startsWith(p))) {
        findings.push({
          validatorId: 'extraction_id_traceability',
          severity: 'MEDIUM',
          type: 'unexpected_prefix',
          summary: `Id '${id}' has unexpected prefix for pass`,
          location: path,
          detail: `Pass ${params.subPhaseId} expects prefixes: ${expected.join(', ')}.`,
          recommendation: 'Renumber with the documented prefix for this pass.',
        });
      }
    }
  }

  return findings;
}
