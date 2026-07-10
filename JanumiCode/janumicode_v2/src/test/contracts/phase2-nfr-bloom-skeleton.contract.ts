/**
 * Contract for Phase 2.2 — nfr_bloom_skeleton (artifact kind: `non_functional_requirements`).
 *
 * Backwards-derived from Phase 9's packetBuilder.findNfrsForTask and
 * Phase 8.2's quality_evaluation_plan which targets NFR-* ids.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export type NfrCategory =
  | 'performance' | 'security' | 'reliability' | 'usability'
  | 'maintainability' | 'observability' | 'compliance' | 'scalability'
  | 'portability';

export interface NonFunctionalRequirement {
  id: string;
  category: NfrCategory | (string & {});
  description: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  /**
   * Per Phase 2.2 schema: `seed_threshold` is the single field that
   * carries the measurable threshold (e.g. "p95 latency <= 100ms").
   * The full threshold + measurement split happens later via
   * `nfr_bloom_skeleton/nonfunctional_requirements_threshold_enrichment`.
   */
  seed_threshold?: string;
  traces_to?: string[];
  applies_to_requirements?: string[];
}

export interface NonFunctionalRequirementsArtifact {
  kind: 'non_functional_requirements';
  requirements: NonFunctionalRequirement[];
}

// ── Contract suite ───────────────────────────────────────────────

const NFR_ID_PATTERN = /^NFR-/;
// NFRs may trace to V&V requirements, quality attributes, or
// compliance regimes (COMP-* caps from Phase 1.0d). Components don't
// exist yet at Phase 2, so lowercase comp-* is intentionally not in
// this list — same chicken-and-egg as Gap #3 for US.traces_to.
const NFR_VALID_TRACE_PATTERN = /^(VV-|QA-|COMP-)/;

export const phase2NfrBloomSkeletonContract: ContractSuite<NonFunctionalRequirementsArtifact> = {
  boundaryId: '2.2_nfr_bloom_skeleton',
  phaseId: '2',
  subPhaseId: 'nfr_bloom_skeleton',
  producerArtifactKind: 'non_functional_requirements',
  description: 'Phase 2 NFR skeleton — each NFR has id/category/description/threshold/measurement.',
  clauses: [
    {
      id: 'C-2.2.1',
      description: 'non_functional_requirements.requirements is a non-empty array.',
      severity: 'blocking',
      check: (artifact) => {
        if (!Array.isArray(artifact.requirements) || artifact.requirements.length === 0) {
          return { message: 'requirements is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-2.2.2',
      description: 'Every NFR has a non-empty NFR-* id, unique within the artifact.',
      severity: 'blocking',
      check: (artifact) => {
        const counts = new Map<string, number>();
        const bad: string[] = [];
        for (const n of artifact.requirements) {
          if (!n.id || !NFR_ID_PATTERN.test(n.id)) { bad.push(n.id || '(missing)'); continue; }
          counts.set(n.id, (counts.get(n.id) ?? 0) + 1);
        }
        const dups = [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
        if (bad.length === 0 && dups.length === 0) return true;
        const parts: string[] = [];
        if (bad.length) parts.push(`${bad.length} malformed id(s)`);
        if (dups.length) parts.push(`duplicates: ${dups.join(', ')}`);
        return { message: parts.join('; '), details: { bad, dups } };
      },
    },
    {
      id: 'C-2.2.3',
      description: 'Every NFR has non-empty category and description.',
      severity: 'blocking',
      check: (artifact) => {
        const bad: Array<{ id: string; missing: string[] }> = [];
        for (const n of artifact.requirements) {
          const missing: string[] = [];
          if (!n.category) missing.push('category');
          if (!n.description || n.description.trim().length === 0) missing.push('description');
          if (missing.length) bad.push({ id: n.id, missing });
        }
        if (bad.length === 0) return true;
        return { message: `${bad.length} NFR(s) missing category/description`, details: { bad } };
      },
    },
    {
      id: 'C-2.2.4',
      description: 'Every NFR has a non-empty seed_threshold (measurable target per Phase 2.2 schema).',
      severity: 'blocking',
      check: (artifact) => {
        const bad = artifact.requirements
          .filter((n) => !n.seed_threshold || n.seed_threshold.trim().length === 0)
          .map((n) => n.id);
        if (bad.length === 0) return true;
        return {
          message: `${bad.length} NFR(s) missing seed_threshold`,
          details: { ids: bad },
        };
      },
    },
    {
      id: 'C-2.2.5',
      description: 'NFR.traces_to entries (when present) use VV-/QA-/COMP- (compliance regime) id namespaces.',
      severity: 'advisory',
      check: (artifact) => {
        const odd: Array<{ id: string; entry: string }> = [];
        for (const n of artifact.requirements) {
          for (const t of n.traces_to ?? []) {
            if (!NFR_VALID_TRACE_PATTERN.test(t)) {
              odd.push({ id: n.id, entry: t });
            }
          }
        }
        if (odd.length === 0) return true;
        return {
          message: `${odd.length} NFR.traces_to entries use unrecognized namespaces`,
          details: { examples: odd.slice(0, 5) },
        };
      },
    },
  ],
};
