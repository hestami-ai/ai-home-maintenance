/**
 * Contract for Phase 0.2 — vocabulary_collision_check
 * (artifact kind: `collision_risk_report`).
 *
 * Detects vocabulary collisions in the workspace against the canonical
 * project vocabulary. HIGH-risk collisions must block downstream phases.
 */

import type { ContractSuite } from './types';

export interface VocabularyCollision {
  term: string;
  severity?: 'HIGH' | 'MEDIUM' | 'LOW' | (string & {});
  description?: string;
  proposed_resolution?: string;
}

export interface CollisionRiskReportArtifact {
  kind: 'collision_risk_report';
  collisions?: VocabularyCollision[];
  has_high_risk?: boolean;
}

export const phase0VocabularyCollisionCheckContract: ContractSuite<CollisionRiskReportArtifact> = {
  boundaryId: '0.2_vocabulary_collision_check',
  phaseId: '0',
  subPhaseId: 'vocabulary_collision_check',
  producerArtifactKind: 'collision_risk_report',
  description:
    'Phase 0 vocabulary collision — collisions array present; HIGH risk flag matches actual contents.',
  clauses: [
    {
      id: 'C-0.2.1',
      description: 'collisions is an array (may be empty).',
      severity: 'blocking',
      check: (a) => {
        if (a.collisions !== undefined && !Array.isArray(a.collisions)) {
          return { message: 'collisions is not an array' };
        }
        return true;
      },
    },
    {
      id: 'C-0.2.2',
      description: 'Every collision has a non-empty term.',
      severity: 'blocking',
      check: (a) => {
        const bad = (a.collisions ?? []).filter((c) => !c.term || c.term.trim().length === 0);
        if (bad.length === 0) return true;
        return { message: `${bad.length} collision(s) have empty term` };
      },
    },
    {
      id: 'C-0.2.3',
      description: 'has_high_risk flag (when set) reconciles with collisions of severity=HIGH.',
      severity: 'blocking',
      check: (a) => {
        if (a.has_high_risk === undefined) return true;
        const actualHigh = (a.collisions ?? []).some((c) => c.severity === 'HIGH');
        if (a.has_high_risk !== actualHigh) {
          return { message: `has_high_risk=${a.has_high_risk} but actual HIGH collisions present=${actualHigh}` };
        }
        return true;
      },
    },
  ],
};
