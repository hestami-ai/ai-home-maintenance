/**
 * Contract for Phase 6.1a — task_saturation
 * (artifact kind: `task_decomposition_node`).
 *
 * Saturation produces a decomposition tree of tasks; atomic leaves
 * (status='atomic') are what Phase 9 packet synthesis bundles. Each
 * node carries a tier (A/B/C/D), a pass_number, and a status.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export type DecompositionNodeStatus =
  | 'atomic' | 'decomposed' | 'pruned' | 'deferred' | 'downgraded';

export type DecompositionTierValue = 'A' | 'B' | 'C' | 'D';

export interface TaskDecompositionNodeArtifact {
  kind: 'task_decomposition_node';
  node_id: string;
  parent_node_id?: string | null;
  status: DecompositionNodeStatus | (string & {});
  tier?: DecompositionTierValue | (string & {});
  depth?: number;
  pass_number?: number;
  pruning_reason?: string;
  task?: {
    id?: string;
    name?: string;
    description?: string;
    component_id?: string;
  };
}

// ── Contract suite ───────────────────────────────────────────────

const VALID_STATUSES = new Set<string>(['atomic', 'decomposed', 'pruned', 'deferred', 'downgraded']);
const VALID_TIERS = new Set<string>(['A', 'B', 'C', 'D']);

export const phase6TaskSaturationContract: ContractSuite<TaskDecompositionNodeArtifact> = {
  boundaryId: '6.1a_task_saturation',
  phaseId: '6',
  subPhaseId: 'task_saturation',
  producerArtifactKind: 'task_decomposition_node',
  description:
    'Phase 6 task saturation — every node has valid status/tier; atomic leaves carry task content.',
  clauses: [
    {
      id: 'C-6.1a.1',
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
      id: 'C-6.1a.2',
      description: 'status is one of the recognized values.',
      severity: 'blocking',
      check: (artifact) => {
        if (!VALID_STATUSES.has(artifact.status)) {
          return { message: `invalid status: "${artifact.status}"`, details: { valid: [...VALID_STATUSES] } };
        }
        return true;
      },
    },
    {
      id: 'C-6.1a.3',
      description: 'tier (when present) is A/B/C/D.',
      severity: 'blocking',
      check: (artifact) => {
        if (artifact.tier === undefined) return true;
        if (!VALID_TIERS.has(artifact.tier)) {
          return { message: `invalid tier: "${artifact.tier}"` };
        }
        return true;
      },
    },
    {
      id: 'C-6.1a.4',
      description: 'On status=pruned, pruning_reason is recorded.',
      severity: 'blocking',
      check: (artifact) => {
        if (artifact.status !== 'pruned') return true;
        if (!artifact.pruning_reason || artifact.pruning_reason.trim().length === 0) {
          return { message: 'status=pruned but pruning_reason is missing' };
        }
        return true;
      },
    },
    {
      id: 'C-6.1a.5',
      description: 'On status=atomic, task content is populated (id + description).',
      severity: 'blocking',
      check: (artifact) => {
        if (artifact.status !== 'atomic') return true;
        if (!artifact.task?.id || !artifact.task?.description) {
          return { message: 'status=atomic but task.id or task.description is missing' };
        }
        return true;
      },
    },
    {
      id: 'C-6.1a.6',
      description: 'depth (when present) is non-negative integer.',
      severity: 'advisory',
      check: (artifact) => {
        if (artifact.depth === undefined) return true;
        if (typeof artifact.depth !== 'number' || artifact.depth < 0 || !Number.isInteger(artifact.depth)) {
          return { message: `invalid depth: ${artifact.depth}` };
        }
        return true;
      },
    },
  ],
};
