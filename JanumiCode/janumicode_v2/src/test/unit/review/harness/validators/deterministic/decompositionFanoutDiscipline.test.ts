import { describe, it, expect } from 'vitest';
import { validateDecompositionFanoutDiscipline } from '../../../../../../lib/review/harness/validators/deterministic/decompositionFanoutDiscipline';
import { makeRuntime } from './_helpers';

describe('decomposition_fanout_discipline (deterministic)', () => {
  it('returns [] when no classification', () => {
    expect(validateDecompositionFanoutDiscipline(makeRuntime({ outputContent: { children: [] } }))).toEqual([]);
  });

  it('returns [] for valid atomic_leaf with 1 child', () => {
    expect(
      validateDecompositionFanoutDiscipline(
        makeRuntime({
          outputContent: {
            parent_branch_classification: 'atomic_leaf',
            children: [{ id: 'c1', tier: 'D' }],
          },
        }),
      ),
    ).toEqual([]);
  });

  it('flags HIGH for atomic_leaf with 0 children', () => {
    const findings = validateDecompositionFanoutDiscipline(
      makeRuntime({
        outputContent: {
          parent_branch_classification: 'atomic_leaf',
          children: [],
        },
      }),
    );
    expect(findings.some((f) => f.type === 'atomic_fanout_violation')).toBe(true);
  });

  it('flags HIGH for decomposable with 9 children', () => {
    const findings = validateDecompositionFanoutDiscipline(
      makeRuntime({
        outputContent: {
          parent_branch_classification: 'decomposable',
          children: Array.from({ length: 9 }, (_, i) => ({ id: `c${i}`, tier: 'C' })),
        },
      }),
    );
    expect(findings.some((f) => f.type === 'decomposable_fanout_out_of_range')).toBe(true);
  });

  it('flags HIGH for flat-mapping (all children mirror parent description)', () => {
    const sharedDesc = 'handles user authentication and session management';
    const findings = validateDecompositionFanoutDiscipline(
      makeRuntime({
        outputContent: {
          parent_branch_classification: 'decomposable',
          description: sharedDesc,
          children: [
            { id: 'c1', tier: 'C', description: sharedDesc },
            { id: 'c2', tier: 'C', description: sharedDesc },
          ],
        },
      }),
    );
    expect(findings.some((f) => f.type === 'flat_mapping')).toBe(true);
  });

  it('flags HIGH for single child with same tier as parent (not D)', () => {
    const findings = validateDecompositionFanoutDiscipline(
      makeRuntime({
        outputContent: {
          parent_branch_classification: 'decomposable',
          tier: 'B',
          description: 'auth component',
          children: [{ id: 'c1', tier: 'B', description: 'different description' }],
        },
      }),
    );
    expect(findings.some((f) => f.type === 'single_child_same_tier')).toBe(true);
  });
});
