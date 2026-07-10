/**
 * Contract for Phase 2.2a — nfr_saturation
 * (artifact kind: `requirement_decomposition_node` with root_kind='nfr').
 *
 * Sibling of phase2FrSaturation; ensures atomic NFR leaves carry
 * threshold + measurement so downstream eval design can use them.
 */

import type { ContractSuite } from './types';

export interface NfrRequirementDecompositionNodeArtifact {
  kind: 'requirement_decomposition_node';
  node_id: string;
  parent_node_id?: string | null;
  root_kind?: 'fr' | 'nfr' | (string & {});
  status: string;
  tier?: string;
  depth?: number;
  pruning_reason?: string;
  nfr?: {
    id?: string;
    category?: string;
    description?: string;
    threshold?: string;
    measurement_method?: string;
  };
}

const VALID_STATUSES = new Set<string>(['atomic', 'decomposed', 'pruned', 'deferred', 'downgraded']);
const VALID_TIERS = new Set<string>(['A', 'B', 'C', 'D']);

export const phase2NfrSaturationContract: ContractSuite<NfrRequirementDecompositionNodeArtifact> = {
  boundaryId: '2.2a_nfr_saturation',
  phaseId: '2',
  subPhaseId: 'nfr_saturation',
  producerArtifactKind: 'requirement_decomposition_node',
  description:
    'Phase 2 NFR saturation — atomic NFR leaves carry id + threshold + measurement_method.',
  clauses: [
    {
      id: 'C-2.2a.1',
      description: 'node_id is non-empty.',
      severity: 'blocking',
      check: (a) => (a.node_id ? true : { message: 'node_id missing' }),
    },
    {
      id: 'C-2.2a.2',
      description: 'status is recognized.',
      severity: 'blocking',
      check: (a) => VALID_STATUSES.has(a.status) ? true : { message: `invalid status: "${a.status}"` },
    },
    {
      id: 'C-2.2a.3',
      description: 'tier (when present) is A/B/C/D.',
      severity: 'blocking',
      check: (a) => {
        if (a.tier === undefined) return true;
        return VALID_TIERS.has(a.tier) ? true : { message: `invalid tier: "${a.tier}"` };
      },
    },
    {
      id: 'C-2.2a.4',
      description: 'On status=pruned, pruning_reason is recorded.',
      severity: 'blocking',
      check: (a) => {
        if (a.status !== 'pruned') return true;
        if (!a.pruning_reason) return { message: 'status=pruned but pruning_reason is missing' };
        return true;
      },
    },
    {
      id: 'C-2.2a.5',
      description: 'When root_kind=nfr and status=atomic, nfr has id + threshold + measurement_method.',
      severity: 'blocking',
      check: (a) => {
        if (a.root_kind !== 'nfr') return true;
        if (a.status !== 'atomic') return true;
        const n = a.nfr;
        const missing: string[] = [];
        if (!n?.id) missing.push('id');
        if (!n?.threshold) missing.push('threshold');
        if (!n?.measurement_method) missing.push('measurement_method');
        if (missing.length === 0) return true;
        return { message: `atomic NFR leaf missing nfr.{${missing.join(',')}}` };
      },
    },
  ],
};
