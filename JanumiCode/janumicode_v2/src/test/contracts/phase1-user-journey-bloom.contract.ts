/**
 * Contract for Phase 1.3a — user_journey_bloom (artifact kind: `user_journey_bloom`).
 *
 * Codifies Gap #7: the bloom MUST be non-empty whenever any other
 * artifact references a UJ-* id. ts-17 showed the empty-array case
 * where UJ ids were referenced throughout but the bloom itself had
 * zero items — a Phase 1 defect this contract surfaces immediately.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export interface UserJourney {
  id: string;
  title?: string;
  scenario?: string;
  persona_id?: string;
  business_domain_ids?: string[];
  steps?: Array<unknown>;
  source?: string;
}

export interface UserJourneyBloomArtifact {
  kind: 'user_journey_bloom';
  user_journeys: UserJourney[];
  unreached_personas?: string[];
  unreached_domains?: string[];
}

// ── Contract suite ───────────────────────────────────────────────

const UJ_ID_PATTERN = /^UJ-/;

/**
 * Phase 1.3a is the canonical UJ-id assignment point. Earlier Phase 1
 * artifacts (intent_discovery, business_domains_bloom, product
 * description handoff) may contain draft UJ ids the bloom later
 * supersedes — those are proposals, not unresolved downstream refs.
 *
 * For "every UJ id referenced elsewhere resolves" we only count refs
 * from artifacts that semantically DEPEND on the bloom (Phase 1.3b
 * workflows back journeys; Phase 2 FRs cite UJ in traces_to; release
 * plan contains[].journeys).
 */
const UJ_DOWNSTREAM_CONSUMER_KINDS: ReadonlySet<string> = new Set([
  'system_workflow_bloom',     // Phase 1.3b: workflow.backs_journeys
  'functional_requirements',   // Phase 2.1: US.traces_to UJ-*
  'release_plan',              // Phase 1.9: contains.journeys
]);

function collectExternalUjRefs(context: { relatedArtifacts: ReadonlyMap<string, ReadonlyArray<unknown>> }): Set<string> {
  const out = new Set<string>();
  for (const [kind, arr] of context.relatedArtifacts) {
    if (!UJ_DOWNSTREAM_CONSUMER_KINDS.has(kind)) continue;
    for (const a of arr) {
      const blob = JSON.stringify(a);
      const matches = blob.matchAll(/UJ-[A-Z0-9_-]+/g);
      for (const m of matches) out.add(m[0]);
    }
  }
  return out;
}

export const phase1UserJourneyBloomContract: ContractSuite<UserJourneyBloomArtifact> = {
  boundaryId: '1.3a_user_journey_bloom',
  phaseId: '1',
  subPhaseId: 'user_journey_bloom',
  producerArtifactKind: 'user_journey_bloom',
  description:
    'Phase 1 user journey bloom — non-empty whenever any UJ id is referenced elsewhere (Gap #7).',
  clauses: [
    {
      id: 'C-1.3a.1',
      description: 'user_journeys is an array; non-empty when UJ refs exist elsewhere.',
      severity: 'blocking',
      check: (artifact, context) => {
        if (!Array.isArray(artifact.user_journeys)) {
          return { message: 'user_journeys is missing or not an array' };
        }
        const external = collectExternalUjRefs(context);
        if (artifact.user_journeys.length === 0 && external.size > 0) {
          return {
            message: `bloom is empty but ${external.size} UJ id(s) are referenced elsewhere — Gap #7 violation`,
            details: { sample: [...external].slice(0, 10) },
          };
        }
        return true;
      },
    },
    {
      id: 'C-1.3a.2',
      description: 'Every journey has a non-empty UJ-* id, unique within the bloom.',
      severity: 'blocking',
      check: (artifact) => {
        const counts = new Map<string, number>();
        const bad: string[] = [];
        for (const j of artifact.user_journeys ?? []) {
          if (!j.id || !UJ_ID_PATTERN.test(j.id)) { bad.push(j.id || '(missing)'); continue; }
          counts.set(j.id, (counts.get(j.id) ?? 0) + 1);
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
      id: 'C-1.3a.3',
      description: 'Every UJ id referenced elsewhere in the run resolves in the bloom.',
      severity: 'blocking',
      check: (artifact, context) => {
        const external = collectExternalUjRefs(context);
        if (external.size === 0) return true;
        const known = new Set((artifact.user_journeys ?? []).map((j) => j.id));
        const unresolved = [...external].filter((id) => !known.has(id));
        if (unresolved.length === 0) return true;
        return {
          message: `${unresolved.length} UJ ref(s) elsewhere do not resolve in the bloom`,
          details: { unresolved: unresolved.slice(0, 10) },
        };
      },
    },
    {
      id: 'C-1.3a.4',
      description: 'Every journey has a title and a scenario.',
      severity: 'advisory',
      check: (artifact) => {
        const bad = (artifact.user_journeys ?? [])
          .filter((j) => !j.title || !j.scenario)
          .map((j) => j.id);
        if (bad.length === 0) return true;
        return { message: `${bad.length} journey(s) missing title/scenario`, details: { ids: bad } };
      },
    },
  ],
};
