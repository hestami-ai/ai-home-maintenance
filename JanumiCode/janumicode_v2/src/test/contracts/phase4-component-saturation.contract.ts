/**
 * Contract for Phase 4.2a — component_saturation
 * (artifact kind: `component_decomposition_node`).
 *
 * Same pattern as task/test saturation. Atomic leaves are the Tier C/D
 * components Phase 6 generates tasks against.
 */

import type { ContractSuite } from './types';

export interface ComponentDecompositionNodeArtifact {
  kind: 'component_decomposition_node';
  node_id: string;
  parent_node_id?: string | null;
  status: string;
  tier?: string;
  depth?: number;
  pruning_reason?: string;
  component?: {
    id?: string;
    name?: string;
    responsibilities?: Array<{ id?: string; statement?: string }>;
  };
}

const VALID_STATUSES = new Set<string>(['atomic', 'decomposed', 'pruned', 'deferred', 'downgraded']);
const VALID_TIERS = new Set<string>(['A', 'B', 'C', 'D']);

export const phase4ComponentSaturationContract: ContractSuite<ComponentDecompositionNodeArtifact> = {
  boundaryId: '4.2a_component_saturation',
  phaseId: '4',
  subPhaseId: 'component_saturation',
  producerArtifactKind: 'component_decomposition_node',
  description:
    'Phase 4 component saturation — atomic leaves carry component.id + at least one responsibility.',
  clauses: [
    {
      id: 'C-4.2a.1',
      description: 'node_id is non-empty.',
      severity: 'blocking',
      check: (a) => (a.node_id ? true : { message: 'node_id missing' }),
    },
    {
      id: 'C-4.2a.2',
      description: 'status is recognized.',
      severity: 'blocking',
      check: (a) => VALID_STATUSES.has(a.status) ? true : { message: `invalid status: "${a.status}"` },
    },
    {
      id: 'C-4.2a.3',
      description: 'tier (when present) is A/B/C/D.',
      severity: 'blocking',
      check: (a) => {
        if (a.tier === undefined) return true;
        return VALID_TIERS.has(a.tier) ? true : { message: `invalid tier: "${a.tier}"` };
      },
    },
    {
      id: 'C-4.2a.4',
      description: 'On status=pruned, pruning_reason is recorded.',
      severity: 'blocking',
      check: (a) => {
        if (a.status !== 'pruned') return true;
        if (!a.pruning_reason) return { message: 'status=pruned but pruning_reason is missing' };
        return true;
      },
    },
    {
      id: 'C-4.2a.5',
      description: 'On status=atomic, component has id + at least one responsibility.',
      severity: 'blocking',
      check: (a) => {
        if (a.status !== 'atomic') return true;
        const c = a.component;
        if (!c?.id) return { message: 'atomic node has no component.id' };
        if (!Array.isArray(c.responsibilities) || c.responsibilities.length === 0) {
          return { message: 'atomic node has no responsibilities' };
        }
        return true;
      },
    },
  ],
};
