import { describe, it, expect } from 'vitest';
import { validateParentBranchClassification } from '../../../../../../lib/review/harness/validators/deterministic/parentBranchClassificationCheck';
import { makeRuntime } from './_helpers';

describe('parent_branch_classification_check (deterministic)', () => {
  it('returns [] when no parent_branch_classification present', () => {
    expect(validateParentBranchClassification(makeRuntime({ outputContent: { children: [] } }))).toEqual([]);
  });

  it('returns [] for valid atomic_leaf with 1 tier-D child', () => {
    const findings = validateParentBranchClassification(
      makeRuntime({
        outputContent: {
          parent_branch_classification: 'atomic_leaf',
          children: [{ id: 'child-1', tier: 'D', description: 'leaf' }],
        },
      }),
    );
    expect(findings).toEqual([]);
  });

  it('flags HIGH for atomic_leaf with 0 children', () => {
    const findings = validateParentBranchClassification(
      makeRuntime({
        outputContent: {
          parent_branch_classification: 'atomic_leaf',
          children: [],
        },
      }),
    );
    expect(findings.some((f) => f.severity === 'HIGH' && f.type === 'atomic_missing_mirror_child')).toBe(true);
  });

  it('flags HIGH for atomic_leaf with 2 children', () => {
    const findings = validateParentBranchClassification(
      makeRuntime({
        outputContent: {
          parent_branch_classification: 'atomic_leaf',
          children: [{ tier: 'D' }, { tier: 'D' }],
        },
      }),
    );
    expect(findings.some((f) => f.severity === 'HIGH' && f.type === 'atomic_too_many_children')).toBe(true);
  });

  it('flags HIGH for atomic_leaf child not at tier D', () => {
    const findings = validateParentBranchClassification(
      makeRuntime({
        outputContent: {
          parent_branch_classification: 'atomic_leaf',
          children: [{ tier: 'C' }],
        },
      }),
    );
    expect(findings.some((f) => f.type === 'atomic_mirror_wrong_tier')).toBe(true);
  });

  it('returns [] for valid decomposable with 3 children', () => {
    expect(
      validateParentBranchClassification(
        makeRuntime({
          outputContent: {
            parent_branch_classification: 'decomposable',
            children: [{ tier: 'C' }, { tier: 'C' }, { tier: 'C' }],
          },
        }),
      ),
    ).toEqual([]);
  });

  it('flags HIGH for decomposable with 0 children', () => {
    const findings = validateParentBranchClassification(
      makeRuntime({
        outputContent: {
          parent_branch_classification: 'decomposable',
          children: [],
        },
      }),
    );
    expect(findings.some((f) => f.type === 'decomposable_no_children')).toBe(true);
  });

  it('flags HIGH for decomposable with 9 children', () => {
    const findings = validateParentBranchClassification(
      makeRuntime({
        outputContent: {
          parent_branch_classification: 'decomposable',
          children: Array.from({ length: 9 }, (_, i) => ({ tier: 'C', id: `c${i}` })),
        },
      }),
    );
    expect(findings.some((f) => f.type === 'decomposable_fanout_exceeded')).toBe(true);
  });

  it('flags HIGH for invalid_parent with children', () => {
    const findings = validateParentBranchClassification(
      makeRuntime({
        outputContent: {
          parent_branch_classification: 'invalid_parent',
          children: [{ tier: 'B' }],
        },
      }),
    );
    expect(findings.some((f) => f.type === 'invalid_parent_has_children')).toBe(true);
  });

  it('returns [] for valid invalid_parent with 0 children', () => {
    expect(
      validateParentBranchClassification(
        makeRuntime({
          outputContent: {
            parent_branch_classification: 'invalid_parent',
            children: [],
          },
        }),
      ),
    ).toEqual([]);
  });
});
