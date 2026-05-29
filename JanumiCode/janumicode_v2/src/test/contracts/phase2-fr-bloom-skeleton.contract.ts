/**
 * Contract for Phase 2.1 — fr_bloom_skeleton (artifact kind: `functional_requirements`).
 *
 * Codifies design positions from
 *   docs/design/contract-harness-stage1b-design-positions.md, Gap #3.
 *
 * `US.traces_to` MUST cite UJ-, WF-, or ENT- ids only. NO comp-* refs
 * (components don't exist yet at Phase 2 — the US to component edge
 * lives in Phase 4 via Gap #2).
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export interface AcceptanceCriterion {
  id: string;
  description: string;
  measurable_condition?: string;
}

export interface UserStory {
  id: string;
  role: string;
  action: string;
  outcome: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  traces_to: string[];
  acceptance_criteria: AcceptanceCriterion[];
}

export interface FunctionalRequirementsArtifact {
  kind: 'functional_requirements';
  user_stories: UserStory[];
}

// ── Contract suite ───────────────────────────────────────────────

const US_ID_PATTERN = /^US-\d+$/;
const AC_ID_PATTERN = /^AC-/;
// Phase 2 runs before Phase 4 components exist, so US.traces_to must
// not forward-reference lowercase `comp-*` (the Phase 4 component
// namespace). It MAY cite upstream Phase 1 artifacts:
//   UJ-*  user journeys (1.3a)
//   WF-*  system workflows (1.3b)
//   ENT-* entities (1.4)
//   COMP-* compliance regimes (1.0d — uppercase, distinct from comp-*)
//   VOC-* vocabulary terms (1.0f)
//   OPEN-*/Q-* open questions
// The forbidden pattern is the lowercase Phase 4 component prefix only.
const VALID_TRACE_PATTERNS = [/^UJ-/, /^WF-/, /^ENT-/, /^COMP-/, /^VOC-/, /^OPEN-/, /^Q-/];
const FORBIDDEN_TRACE_PATTERNS = [/^comp-/];

export const phase2FrBloomSkeletonContract: ContractSuite<FunctionalRequirementsArtifact> = {
  boundaryId: '2.1_fr_bloom_skeleton',
  phaseId: '2',
  subPhaseId: 'fr_bloom_skeleton',
  producerArtifactKind: 'functional_requirements',
  description:
    'Phase 2 FR skeleton — user stories with role/action/outcome and UJ/WF/ENT-only traces (Gap #3).',
  clauses: [
    {
      id: 'C-2.1.1',
      description: 'functional_requirements.user_stories is a non-empty array.',
      severity: 'blocking',
      check: (artifact) => {
        if (!Array.isArray(artifact.user_stories) || artifact.user_stories.length === 0) {
          return { message: 'user_stories is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-2.1.2',
      description: 'Every user story has a non-empty US-* id, and ids are unique.',
      severity: 'blocking',
      check: (artifact) => {
        const counts = new Map<string, number>();
        const bad: string[] = [];
        for (const us of artifact.user_stories) {
          if (!us.id || !US_ID_PATTERN.test(us.id)) {
            bad.push(us.id || '(missing)');
            continue;
          }
          counts.set(us.id, (counts.get(us.id) ?? 0) + 1);
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
      id: 'C-2.1.3',
      description: 'Every user story has non-empty role, action, and outcome strings.',
      severity: 'blocking',
      check: (artifact) => {
        const bad: Array<{ id: string; missing: string[] }> = [];
        for (const us of artifact.user_stories) {
          const missing: string[] = [];
          if (!us.role) missing.push('role');
          if (!us.action) missing.push('action');
          if (!us.outcome) missing.push('outcome');
          if (missing.length) bad.push({ id: us.id, missing });
        }
        if (bad.length === 0) return true;
        return { message: `${bad.length} story(ies) missing role/action/outcome`, details: { bad } };
      },
    },
    {
      id: 'C-2.1.4',
      description: 'Every user story has at least one acceptance criterion with AC-* id and description.',
      severity: 'blocking',
      check: (artifact) => {
        const bad: string[] = [];
        for (const us of artifact.user_stories) {
          if (!Array.isArray(us.acceptance_criteria) || us.acceptance_criteria.length === 0) {
            bad.push(us.id);
            continue;
          }
          const malformed = us.acceptance_criteria.some(
            (ac) => !ac.id || !AC_ID_PATTERN.test(ac.id) || !ac.description,
          );
          if (malformed) bad.push(us.id);
        }
        if (bad.length === 0) return true;
        return { message: `${bad.length} story(ies) have missing/malformed ACs`, details: { storyIds: bad } };
      },
    },
    {
      id: 'C-2.1.5',
      description: 'Every US.traces_to entry cites an upstream Phase 1 namespace; no forward-ref to Phase 4 comp-* (Gap #3).',
      severity: 'blocking',
      check: (artifact) => {
        const forbidden: Array<{ storyId: string; entry: string }> = [];
        const unknown: Array<{ storyId: string; entry: string }> = [];
        for (const us of artifact.user_stories) {
          for (const t of us.traces_to ?? []) {
            if (FORBIDDEN_TRACE_PATTERNS.some((p) => p.test(t))) {
              forbidden.push({ storyId: us.id, entry: t });
              continue;
            }
            if (!VALID_TRACE_PATTERNS.some((p) => p.test(t))) {
              unknown.push({ storyId: us.id, entry: t });
            }
          }
        }
        if (forbidden.length === 0 && unknown.length === 0) return true;
        const parts: string[] = [];
        if (forbidden.length) parts.push(`${forbidden.length} lowercase comp-* traces (Phase 4 forward-ref forbidden)`);
        if (unknown.length) parts.push(`${unknown.length} unknown-namespace traces`);
        return {
          message: parts.join('; '),
          details: { forbidden: forbidden.slice(0, 5), unknown: unknown.slice(0, 5) },
        };
      },
    },
    {
      id: 'C-2.1.6',
      description: 'Every US.traces_to is non-empty.',
      severity: 'advisory',
      check: (artifact) => {
        const empty = artifact.user_stories.filter((us) => !us.traces_to || us.traces_to.length === 0).map((us) => us.id);
        if (empty.length === 0) return true;
        return { message: `${empty.length} story(ies) have no traces_to`, details: { storyIds: empty } };
      },
    },
    {
      id: 'C-2.1.7',
      description: 'AC ids are unique at workflow scope (after Phase 2 exit-normalizer mints composite ids).',
      severity: 'blocking',
      check: (artifact) => {
        // After the Phase 2 normalizer (`mintCompositeAcIds`), every AC
        // id should be globally unique because it encodes the parent
        // story: AC-US{nnn}-{mmm}. Downstream join contracts depend on
        // this — packetSynthesis matches `acceptance_criterion_ids[]`
        // by exact-string membership across the full canonical set.
        const seen = new Map<string, string[]>(); // ac_id → stories carrying it
        for (const us of artifact.user_stories) {
          for (const ac of us.acceptance_criteria ?? []) {
            const list = seen.get(ac.id) ?? [];
            list.push(us.id);
            seen.set(ac.id, list);
          }
        }
        const dups = [...seen.entries()].filter(([, stories]) => stories.length > 1);
        if (dups.length === 0) return true;
        return {
          message: `${dups.length} AC id(s) appear under multiple stories — namespace is not globally unique`,
          details: { duplicates: dups.map(([acId, stories]) => ({ acId, stories })) },
        };
      },
    },
  ],
};
