/**
 * Contract for Phase 7.1a — test_case_saturation
 * (artifact kind: `test_case_decomposition_node`).
 *
 * Same skeleton + saturation pattern as Phase 6.1a but for test cases.
 * Atomic leaves carry concrete test case shape consumed by Phase 9.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export interface TestCaseDecompositionNodeArtifact {
  kind: 'test_case_decomposition_node';
  node_id: string;
  parent_node_id?: string | null;
  status: string;
  tier?: string;
  depth?: number;
  pruning_reason?: string;
  test_case?: {
    test_case_id?: string;
    type?: string;
    acceptance_criterion_ids?: string[];
    expected_outcome?: string;
  };
}

// ── Contract suite ───────────────────────────────────────────────

const VALID_STATUSES = new Set<string>(['atomic', 'decomposed', 'pruned', 'deferred', 'downgraded']);
const VALID_TIERS = new Set<string>(['A', 'B', 'C', 'D']);

export const phase7TestCaseSaturationContract: ContractSuite<TestCaseDecompositionNodeArtifact> = {
  boundaryId: '7.1a_test_case_saturation',
  phaseId: '7',
  subPhaseId: 'test_case_saturation',
  producerArtifactKind: 'test_case_decomposition_node',
  description:
    'Phase 7 test case saturation — every node has valid status/tier; atomic leaves carry test_case shape.',
  clauses: [
    {
      id: 'C-7.1a.1',
      description: 'node_id is non-empty.',
      severity: 'blocking',
      check: (artifact) => {
        if (!artifact.node_id || artifact.node_id.trim().length === 0) {
          return { message: 'node_id is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-7.1a.2',
      description: 'status is recognized.',
      severity: 'blocking',
      check: (artifact) => {
        if (!VALID_STATUSES.has(artifact.status)) {
          return { message: `invalid status: "${artifact.status}"`, details: { valid: [...VALID_STATUSES] } };
        }
        return true;
      },
    },
    {
      id: 'C-7.1a.3',
      description: 'tier (when present) is A/B/C/D.',
      severity: 'blocking',
      check: (artifact) => {
        if (artifact.tier === undefined) return true;
        if (!VALID_TIERS.has(artifact.tier)) return { message: `invalid tier: "${artifact.tier}"` };
        return true;
      },
    },
    {
      id: 'C-7.1a.4',
      description: 'On status=pruned, pruning_reason is recorded.',
      severity: 'blocking',
      check: (artifact) => {
        if (artifact.status !== 'pruned') return true;
        if (!artifact.pruning_reason) return { message: 'status=pruned but pruning_reason is missing' };
        return true;
      },
    },
    {
      id: 'C-7.1a.5',
      description: 'On status=atomic, test_case has test_case_id, expected_outcome, and non-empty AC refs.',
      severity: 'blocking',
      check: (artifact) => {
        if (artifact.status !== 'atomic') return true;
        const tc = artifact.test_case;
        if (!tc?.test_case_id) return { message: 'atomic node has no test_case.test_case_id' };
        if (!tc.expected_outcome || tc.expected_outcome.trim().length === 0) {
          return { message: 'atomic node has empty expected_outcome' };
        }
        if (!Array.isArray(tc.acceptance_criterion_ids) || tc.acceptance_criterion_ids.length === 0) {
          return { message: 'atomic node has empty acceptance_criterion_ids' };
        }
        return true;
      },
    },
  ],
};
