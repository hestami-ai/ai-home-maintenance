/**
 * Contract for Phase 2.1a — fr_saturation
 * (artifact kind: `requirement_decomposition_node` with root_kind='fr').
 *
 * FR decomposition tree. Atomic leaves are the executable user stories.
 */

import type { ContractSuite } from './types';

export interface RequirementDecompositionNodeArtifact {
  kind: 'requirement_decomposition_node';
  node_id: string;
  parent_node_id?: string | null;
  root_kind?: 'fr' | 'nfr' | string;
  status: string;
  tier?: string;
  depth?: number;
  pruning_reason?: string;
  user_story?: {
    id?: string;
    role?: string;
    action?: string;
    outcome?: string;
  };
}

const VALID_STATUSES = new Set<string>(['atomic', 'decomposed', 'pruned', 'deferred', 'downgraded']);
const VALID_TIERS = new Set<string>(['A', 'B', 'C', 'D']);

export const phase2FrSaturationContract: ContractSuite<RequirementDecompositionNodeArtifact> = {
  boundaryId: '2.1a_fr_saturation',
  phaseId: '2',
  subPhaseId: 'fr_saturation',
  producerArtifactKind: 'requirement_decomposition_node',
  description:
    'Phase 2 FR saturation — every node has valid status; atomic leaves carry user_story content.',
  clauses: [
    {
      id: 'C-2.1a.1',
      description: 'node_id is non-empty.',
      severity: 'blocking',
      check: (a) => (a.node_id ? true : { message: 'node_id missing' }),
    },
    {
      id: 'C-2.1a.2',
      description: 'status is one of the recognized values.',
      severity: 'blocking',
      check: (a) => VALID_STATUSES.has(a.status) ? true : { message: `invalid status: "${a.status}"`, details: { valid: [...VALID_STATUSES] } },
    },
    {
      id: 'C-2.1a.3',
      description: 'tier (when present) is A/B/C/D.',
      severity: 'blocking',
      check: (a) => {
        if (a.tier === undefined) return true;
        return VALID_TIERS.has(a.tier) ? true : { message: `invalid tier: "${a.tier}"` };
      },
    },
    {
      id: 'C-2.1a.4',
      description: 'On status=pruned, pruning_reason is recorded.',
      severity: 'blocking',
      check: (a) => {
        if (a.status !== 'pruned') return true;
        if (!a.pruning_reason) return { message: 'status=pruned but pruning_reason is missing' };
        return true;
      },
    },
    {
      id: 'C-2.1a.5',
      description: 'When root_kind=fr and status=atomic, user_story has id + role + action + outcome.',
      severity: 'blocking',
      check: (a) => {
        if (a.root_kind && a.root_kind !== 'fr') return true;
        if (a.status !== 'atomic') return true;
        const us = a.user_story;
        if (!us?.id || !us.role || !us.action || !us.outcome) {
          return { message: 'atomic FR leaf missing user_story.{id,role,action,outcome}' };
        }
        return true;
      },
    },
  ],
};
