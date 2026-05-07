/**
 * Deterministic validator: relationship_directionality_validator
 *
 * Per validator_catalog.md §2 (Phase 5 discovery-class additions, sample 22):
 * For each `relationships` entry in the `data_models` output, verify that the
 * declared FK direction is consistent with the cardinality implied by the source
 * context (e.g., if source says "ViolationRecord references a PropertyRecord,"
 * then ViolationRecord must hold the FK, not PropertyRecord).
 *
 * Catch pattern: "X references Y" in source → X must be the FK holder in the
 * output relationship, not Y. The validator scans the original prompt for
 * "references", "belongs_to", "has_a", "contains" cardinality phrases and
 * cross-checks against the declared `from_entity` / `to_entity` / `cardinality`
 * in the output relationships array.
 *
 * DESIGN NOTE: Full semantic FK-direction validation requires domain knowledge
 * of the data model. This deterministic implementation catches the structurally
 * obvious reversal pattern — the source says "A references B" and the output
 * declares B as the FK holder. For subtler direction issues, a LLM validator
 * would be needed (deferred to Track D).
 *
 * Severity:
 *   - MEDIUM per structurally reversed FK (escalate to HIGH if ≥3 reversals,
 *     as multiple reversals likely break schema generation).
 *   - LOW for ambiguous direction that is not surfaced as an assumption.
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

// Regex to extract "X references Y" or "X belongs to Y" from source context.
const REF_PATTERN = /\b([A-Za-z][A-Za-z0-9_]*)\s+(?:references?|belongs(?:\s+to)?|has(?:\s+a)?|contains)\s+(?:a\s+|an\s+|the\s+)?([A-Za-z][A-Za-z0-9_]*)/gi;

interface AttestationEdge {
  holder: string;   // entity that HOLDS the FK (references the other)
  target: string;   // entity being referenced
}

function extractAttestations(prompt: string): AttestationEdge[] {
  const edges: AttestationEdge[] = [];
  REF_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = REF_PATTERN.exec(prompt)) !== null) {
    edges.push({ holder: m[1], target: m[2] });
  }
  return edges;
}

function normalise(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function validateRelationshipDirectionality(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const { outputContent, originalPrompt } = params;
  if (!outputContent || !originalPrompt) return [];

  const dataModels = outputContent.data_models;
  if (!Array.isArray(dataModels)) return [];

  const attestations = extractAttestations(originalPrompt);
  if (attestations.length === 0) return [];

  const findings: ValidatorFinding[] = [];
  let reversalCount = 0;

  for (const model of dataModels) {
    if (!model || typeof model !== 'object') continue;
    const rec = model as Record<string, unknown>;
    const relationships = rec.relationships;
    if (!Array.isArray(relationships)) continue;

    relationships.forEach((rel, relIdx) => {
      if (!rel || typeof rel !== 'object') return;
      const r = rel as Record<string, unknown>;
      const fromEntity = typeof r.from_entity === 'string' ? r.from_entity : '';
      const toEntity = typeof r.to_entity === 'string' ? r.to_entity : '';
      const relType = typeof r.type === 'string' ? r.type : '';

      if (!fromEntity || !toEntity) return;

      // Skip many-to-many — direction is typically non-directional.
      if (relType.toLowerCase().includes('many_to_many')) return;

      // Check whether source attests "toEntity references fromEntity"
      // (which would mean fromEntity should be the FK holder, but to is referencing from
      // means to has the FK — this is the expected direction).
      //
      // A reversal is: source says "A references B" (A holds FK → B)
      // but output declares from_entity=B, to_entity=A (which implies B holds the FK)
      for (const edge of attestations) {
        const holderN = normalise(edge.holder);
        const targetN = normalise(edge.target);
        const fromN = normalise(fromEntity);
        const toN = normalise(toEntity);

        // Source: holder references target → holder should be from_entity (FK holder)
        if (holderN === toN && targetN === fromN) {
          // Output has them reversed: from=target, to=holder
          reversalCount++;
          const severity = reversalCount >= 3 ? 'HIGH' : 'MEDIUM';
          findings.push({
            validatorId: 'relationship_directionality_validator',
            severity,
            type: 'reversed_fk_direction',
            summary: `FK direction reversed: source attests '${edge.holder}' references '${edge.target}' but output declares from=${fromEntity}→to=${toEntity}`,
            location: `$.data_models[*].relationships[${relIdx}]`,
            detail: `Source context says "${edge.holder} references ${edge.target}" (${edge.holder} holds the FK). Output has from_entity='${fromEntity}' pointing to '${toEntity}', which reverses the FK ownership.`,
            recommendation: `Swap from_entity and to_entity so that '${edge.holder}' is from_entity (FK holder) and '${edge.target}' is to_entity.`,
          });
        }
      }
    });
  }

  return findings;
}
