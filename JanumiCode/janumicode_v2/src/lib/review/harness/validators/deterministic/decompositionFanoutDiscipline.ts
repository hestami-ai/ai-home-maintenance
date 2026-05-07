/**
 * Deterministic validator: decomposition_fanout_discipline
 *
 * Per validator_catalog.md §5.4.1:
 *   (a) atomic_leaf / atomic_value emits exactly one mirror child at tier D.
 *   (b) decomposable emits 1–8 children.
 *   (c) No flat-mapping: children must not simply mirror the parent without
 *       introducing sub-area distinction (detected when every child has the
 *       same description as the parent or when a single child is the only
 *       "decomposable" result and its tier matches the parent's tier).
 *
 * NOTE: Rules (a) and (b) overlap with parent_branch_classification_check.
 * This validator focuses on the FANOUT numbers and flat-mapping anti-pattern,
 * while parent_branch_classification_check verifies the classification
 * consistency with the structural rules. Both fire independently.
 *
 * Severity: HIGH on rule violation.
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

const ATOMIC_CLASSES = new Set(['atomic_leaf', 'atomic_value', 'atomic_component']);

export function validateDecompositionFanoutDiscipline(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const { outputContent } = params;
  if (!outputContent) return [];

  const classification = outputContent.parent_branch_classification as string | undefined;
  if (!classification) return [];

  const parentDescription =
    typeof outputContent.description === 'string' ? outputContent.description : '';
  const parentTier =
    typeof outputContent.tier === 'string' ? outputContent.tier : null;

  const children: unknown[] =
    (outputContent.children as unknown[]) ??
    (outputContent.decomposed_children as unknown[]) ??
    [];
  const childCount = children.length;

  const findings: ValidatorFinding[] = [];

  // Rule (a): atomic → exactly 1 child
  if (ATOMIC_CLASSES.has(classification)) {
    if (childCount !== 1) {
      findings.push({
        validatorId: 'decomposition_fanout_discipline',
        severity: 'HIGH',
        type: 'atomic_fanout_violation',
        summary: `Atomic classification '${classification}' must produce exactly 1 mirror child; got ${childCount}`,
        location: '$.children',
        detail: `Fanout rule: atomic → 1 mirror child. Got ${childCount}.`,
        recommendation: 'Emit exactly one mirror child for atomic classifications.',
      });
    }
    return findings;
  }

  // Rule (b): decomposable → 1–8 children
  if (classification === 'decomposable') {
    if (childCount < 1 || childCount > 8) {
      findings.push({
        validatorId: 'decomposition_fanout_discipline',
        severity: 'HIGH',
        type: 'decomposable_fanout_out_of_range',
        summary: `Decomposable parent must produce 1–8 children; got ${childCount}`,
        location: '$.children',
        detail: `Fanout rule: decomposable → 1–8 children. Got ${childCount}.`,
        recommendation: childCount === 0
          ? 'Add children or reclassify as atomic_leaf / invalid_parent.'
          : 'Reduce children to 8 or fewer by grouping into sub-parents.',
      });
    }

    // Rule (c): flat-mapping anti-pattern
    if (childCount >= 1 && childCount <= 8) {
      const childDescriptions = children
        .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
        .map((c) => (typeof c.description === 'string' ? c.description.trim() : ''));

      // Flat-mapping: ALL children descriptions are identical to the parent
      const allMirrorParent =
        parentDescription.length > 0 &&
        childDescriptions.every((d) => d === parentDescription.trim());

      if (allMirrorParent) {
        findings.push({
          validatorId: 'decomposition_fanout_discipline',
          severity: 'HIGH',
          type: 'flat_mapping',
          summary: `All ${childCount} children mirror the parent description without sub-area distinction`,
          location: '$.children',
          detail: `Every child description matches the parent ("${parentDescription.slice(0, 80)}"). Flat-mapping does not decompose the component.`,
          recommendation: 'Each child must represent a distinct sub-area. Rethink the decomposition so children divide responsibilities.',
        });
      }

      // Flat-mapping: single child and same tier as parent
      if (childCount === 1 && parentTier) {
        const onlyChild = children[0] as Record<string, unknown>;
        const childTier = typeof onlyChild?.tier === 'string' ? onlyChild.tier : null;
        if (childTier === parentTier && childTier !== 'D') {
          findings.push({
            validatorId: 'decomposition_fanout_discipline',
            severity: 'HIGH',
            type: 'single_child_same_tier',
            summary: `Single decomposable child has same tier '${childTier}' as parent — likely flat-mapping`,
            location: '$.children[0].tier',
            detail: `A single-child decomposition where the child has the same tier as the parent is a flat mapping that does not advance the decomposition hierarchy.`,
            recommendation: 'Reclassify parent as atomic_leaf or add meaningful sub-area children at a lower tier.',
          });
        }
      }
    }
  }

  return findings;
}
