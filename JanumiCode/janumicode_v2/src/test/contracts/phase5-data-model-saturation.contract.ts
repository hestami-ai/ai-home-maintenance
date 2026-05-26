/**
 * Contract for Phase 5.1a — data_model_saturation
 * (artifact kind: `data_model_decomposition_node`).
 *
 * Atomic leaves describe concrete entities with fields and types.
 */

import type { ContractSuite } from './types';

export interface DataModelDecompositionNodeArtifact {
  kind: 'data_model_decomposition_node';
  node_id: string;
  parent_node_id?: string | null;
  status: string;
  tier?: string;
  depth?: number;
  pruning_reason?: string;
  entity?: {
    id?: string;
    name?: string;
    component_id?: string;
    fields?: Array<{ name?: string; type?: string }>;
  };
}

const VALID_STATUSES = new Set<string>(['atomic', 'decomposed', 'pruned', 'deferred', 'downgraded']);
const VALID_TIERS = new Set<string>(['A', 'B', 'C', 'D']);

export const phase5DataModelSaturationContract: ContractSuite<DataModelDecompositionNodeArtifact> = {
  boundaryId: '5.1a_data_model_saturation',
  phaseId: '5',
  subPhaseId: 'data_model_saturation',
  producerArtifactKind: 'data_model_decomposition_node',
  description:
    'Phase 5 data model saturation — atomic leaves carry entity + fields with names + types.',
  clauses: [
    {
      id: 'C-5.1a.1',
      description: 'node_id is non-empty.',
      severity: 'blocking',
      check: (a) => (a.node_id ? true : { message: 'node_id missing' }),
    },
    {
      id: 'C-5.1a.2',
      description: 'status is recognized.',
      severity: 'blocking',
      check: (a) => VALID_STATUSES.has(a.status) ? true : { message: `invalid status: "${a.status}"` },
    },
    {
      id: 'C-5.1a.3',
      description: 'tier (when present) is A/B/C/D.',
      severity: 'blocking',
      check: (a) => {
        if (a.tier === undefined) return true;
        return VALID_TIERS.has(a.tier) ? true : { message: `invalid tier: "${a.tier}"` };
      },
    },
    {
      id: 'C-5.1a.4',
      description: 'On status=pruned, pruning_reason is recorded.',
      severity: 'blocking',
      check: (a) => {
        if (a.status !== 'pruned') return true;
        if (!a.pruning_reason) return { message: 'status=pruned but pruning_reason is missing' };
        return true;
      },
    },
    {
      id: 'C-5.1a.5',
      description: 'On status=atomic, entity has name + at least one well-formed field.',
      severity: 'blocking',
      check: (a) => {
        if (a.status !== 'atomic') return true;
        const e = a.entity;
        if (!e?.name) return { message: 'atomic node has no entity.name' };
        if (!Array.isArray(e.fields) || e.fields.length === 0) return { message: 'atomic entity has no fields' };
        const malformed = e.fields.find((f) => !f.name || !f.type);
        if (malformed) return { message: `field missing name/type` };
        return true;
      },
    },
  ],
};
