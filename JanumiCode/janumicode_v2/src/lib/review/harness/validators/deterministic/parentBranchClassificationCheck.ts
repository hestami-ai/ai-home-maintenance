/**
 * Deterministic validator: parent_branch_classification_check
 *
 * Per validator_catalog.md §5.4.1: verify the LLM's
 * `parent_branch_classification` value is consistent with structural rules:
 *   (a) atomic_leaf / atomic_value: must emit exactly 1 mirror child at tier D.
 *   (b) decomposable: must emit 1–8 children.
 *   (c) invalid_parent: no children emitted.
 *
 * Applies to all saturation surfaces:
 *   - fr_saturation / nfr_saturation: classification = atomic_leaf | decomposable | invalid_parent
 *   - component_saturation: atomic_component | decomposable | invalid_parent
 *   - data_model_saturation: atomic_value | decomposable | invalid_parent
 *
 * Severity: HIGH on contract violation.
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

const ATOMIC_CLASSES = new Set(['atomic_leaf', 'atomic_value', 'atomic_component']);
const DECOMPOSABLE = 'decomposable';
const INVALID_PARENT = 'invalid_parent';

export function validateParentBranchClassification(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const { outputContent } = params;
  if (!outputContent) return [];

  const classification = outputContent.parent_branch_classification as string | undefined;
  if (!classification) return [];

  const children: unknown[] =
    (outputContent.children as unknown[]) ??
    (outputContent.decomposed_children as unknown[]) ??
    [];
  const childCount = children.length;

  const findings: ValidatorFinding[] = [];

  if (ATOMIC_CLASSES.has(classification)) {
    // Rule: atomic → exactly 1 mirror child at tier D
    if (childCount === 0) {
      findings.push({
        validatorId: 'parent_branch_classification_check',
        severity: 'HIGH',
        type: 'atomic_missing_mirror_child',
        summary: `Classification '${classification}' requires exactly 1 mirror child but 0 children emitted`,
        location: '$.children',
        detail: `When parent_branch_classification='${classification}', the agent must emit exactly one mirror child (tier D). Found ${childCount} children.`,
        recommendation: 'Emit one mirror child at tier D that replicates the parent content without further decomposition.',
      });
    } else if (childCount > 1) {
      findings.push({
        validatorId: 'parent_branch_classification_check',
        severity: 'HIGH',
        type: 'atomic_too_many_children',
        summary: `Classification '${classification}' requires exactly 1 mirror child but ${childCount} children emitted`,
        location: '$.children',
        detail: `When parent_branch_classification='${classification}', exactly 1 child is expected. Found ${childCount}.`,
        recommendation: 'Reduce to one mirror child or reclassify as decomposable.',
      });
    } else {
      // 1 child — verify it is tier D
      const child = children[0] as Record<string, unknown> | null;
      if (child && typeof child === 'object') {
        const childTier = child.tier;
        if (childTier !== 'D') {
          findings.push({
            validatorId: 'parent_branch_classification_check',
            severity: 'HIGH',
            type: 'atomic_mirror_wrong_tier',
            summary: `Mirror child of '${classification}' parent must be tier D but got tier '${childTier}'`,
            location: '$.children[0].tier',
            detail: `Atomic leaf/value mirror child must have tier='D'. Got '${childTier}'.`,
            recommendation: "Set the mirror child's tier to 'D'.",
          });
        }
      }
    }
  } else if (classification === DECOMPOSABLE) {
    if (childCount < 1) {
      findings.push({
        validatorId: 'parent_branch_classification_check',
        severity: 'HIGH',
        type: 'decomposable_no_children',
        summary: `Classification 'decomposable' requires 1–8 children but 0 emitted`,
        location: '$.children',
        detail: 'A decomposable parent must emit at least 1 child to justify the classification.',
        recommendation: 'Emit children or reclassify as atomic_leaf / invalid_parent.',
      });
    } else if (childCount > 8) {
      findings.push({
        validatorId: 'parent_branch_classification_check',
        severity: 'HIGH',
        type: 'decomposable_fanout_exceeded',
        summary: `Classification 'decomposable' allows max 8 children but ${childCount} emitted`,
        location: '$.children',
        detail: `Fan-out of ${childCount} exceeds the 1–8 rule for decomposable parents.`,
        recommendation: 'Collapse children into sub-groups or reclassify as multiple decomposable parents.',
      });
    }
  } else if (classification === INVALID_PARENT) {
    if (childCount > 0) {
      findings.push({
        validatorId: 'parent_branch_classification_check',
        severity: 'HIGH',
        type: 'invalid_parent_has_children',
        summary: `Classification 'invalid_parent' must emit 0 children but ${childCount} emitted`,
        location: '$.children',
        detail: `invalid_parent means the node should not have been decomposed at all. Emitting ${childCount} children contradicts this classification.`,
        recommendation: "Remove children or reclassify. An invalid_parent should emit [] children and explain in decomposition_rationale.",
      });
    }
  }

  return findings;
}
