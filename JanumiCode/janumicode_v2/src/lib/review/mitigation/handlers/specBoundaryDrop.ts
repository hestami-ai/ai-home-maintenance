/**
 * Drop handler for `spec_boundary_respect_bloom` HIGH findings.
 *
 * The validator catches bloom items that contradict spec exclusions or
 * technical constraints. The mitigation: drop the offending item from
 * the artifact's target array, leaving the rest of the bloom intact.
 *
 * The validator's output contract (post-Track-E update) requires HIGH
 * findings to carry `target_field` and `target_identifier`. This handler
 * uses them to deterministically locate and remove the element:
 *
 *   1. Look up `artifact[target_field]` — must be an array
 *   2. Find the element whose `id` or `name` matches `target_identifier`
 *   3. Splice it out of the array
 *
 * Returns null when:
 *   - The artifact has no array at `target_field`
 *   - No element matches `target_identifier`
 *   - (caller has already verified severity===HIGH and target fields present)
 */

import type { ValidatorFinding } from '../../harness/validatorRegistry';
import type { MitigationAction } from '../mitigationEngine';

export function specBoundaryDropHandler(
  finding: ValidatorFinding,
  artifact: Record<string, unknown>,
): MitigationAction | null {
  const targetField = finding.targetField!;
  const targetId = finding.targetIdentifier!;

  const arr = artifact[targetField];
  if (!Array.isArray(arr)) return null;

  const idx = findElementIndex(arr, targetId);
  if (idx < 0) return null;

  const removed = arr[idx];
  arr.splice(idx, 1);

  return {
    actionType: 'drop',
    validatorId: finding.validatorId,
    findingType: finding.type,
    targetField,
    targetIdentifier: targetId,
    rationale: finding.summary || finding.detail || `spec_boundary_respect_bloom HIGH (${finding.type})`,
    beforeValue: removed,
    afterValue: null,
  };
}

/**
 * Locate an element in `arr` whose `id` or `name` field equals `targetId`.
 * Match is exact string equality on either field. The validator's output
 * contract requires `target_identifier` to be unambiguous, so a single
 * pass picking the first match is correct.
 */
function findElementIndex(arr: unknown[], targetId: string): number {
  for (let i = 0; i < arr.length; i++) {
    const el = arr[i];
    if (!el || typeof el !== 'object') continue;
    const rec = el as Record<string, unknown>;
    if (typeof rec.id === 'string' && rec.id === targetId) return i;
    if (typeof rec.name === 'string' && rec.name === targetId) return i;
  }
  return -1;
}
