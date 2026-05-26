/**
 * Contract for Phase 1.4 — entities_bloom (artifact kind: `entities_bloom`).
 *
 * Same non-empty + resolves-everywhere pattern as user_journey_bloom.
 * US.traces_to cites ENT-* ids; this contract enforces those resolve.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export interface Entity {
  id: string;
  name?: string;
  description?: string;
  businessDomainId?: string;
  keyAttributes?: string[];
  relationships?: Array<unknown>;
  source?: string;
}

export interface EntitiesBloomArtifact {
  kind: 'entities_bloom';
  entities: Entity[];
}

// ── Contract suite ───────────────────────────────────────────────

const ENT_ID_PATTERN = /^ENT-/;

/**
 * Phase 1.4 is the canonical ENT-id assignment point. Earlier draft
 * refs from intent_discovery / business_domains_bloom may be stale;
 * count only refs from downstream consumers that semantically depend
 * on the entities bloom.
 */
const ENT_DOWNSTREAM_CONSUMER_KINDS: ReadonlySet<string> = new Set([
  'functional_requirements',   // Phase 2.1: US.traces_to ENT-*
  'system_workflow_bloom',     // Phase 1.3b: may reference entities
  'data_models',               // Phase 5.1: entities materialize here
]);

function collectExternalEntRefs(context: { relatedArtifacts: ReadonlyMap<string, ReadonlyArray<unknown>> }): Set<string> {
  const out = new Set<string>();
  for (const [kind, arr] of context.relatedArtifacts) {
    if (!ENT_DOWNSTREAM_CONSUMER_KINDS.has(kind)) continue;
    for (const a of arr) {
      const blob = JSON.stringify(a);
      const matches = blob.matchAll(/ENT-[A-Z0-9_-]+/g);
      for (const m of matches) out.add(m[0]);
    }
  }
  return out;
}

export const phase1EntitiesBloomContract: ContractSuite<EntitiesBloomArtifact> = {
  boundaryId: '1.4_entities_bloom',
  phaseId: '1',
  subPhaseId: 'entities_bloom',
  producerArtifactKind: 'entities_bloom',
  description:
    'Phase 1 entities bloom — non-empty when ENT refs exist elsewhere; every external ENT ref resolves.',
  clauses: [
    {
      id: 'C-1.4.1',
      description: 'entities_bloom.entities is an array (non-empty when ENT refs exist elsewhere).',
      severity: 'blocking',
      check: (artifact, context) => {
        if (!Array.isArray(artifact.entities)) return { message: 'entities is missing or not an array' };
        const external = collectExternalEntRefs(context);
        if (artifact.entities.length === 0 && external.size > 0) {
          return {
            message: `bloom is empty but ${external.size} ENT id(s) are referenced elsewhere`,
            details: { sample: [...external].slice(0, 10) },
          };
        }
        return true;
      },
    },
    {
      id: 'C-1.4.2',
      description: 'Every entity has a non-empty ENT-* id, unique within the bloom.',
      severity: 'blocking',
      check: (artifact) => {
        const counts = new Map<string, number>();
        const bad: string[] = [];
        for (const e of artifact.entities ?? []) {
          if (!e.id || !ENT_ID_PATTERN.test(e.id)) { bad.push(e.id || '(missing)'); continue; }
          counts.set(e.id, (counts.get(e.id) ?? 0) + 1);
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
      id: 'C-1.4.3',
      description: 'Every ENT id referenced elsewhere resolves in the bloom.',
      severity: 'blocking',
      check: (artifact, context) => {
        const external = collectExternalEntRefs(context);
        if (external.size === 0) return true;
        const known = new Set(artifact.entities?.map((e) => e.id) ?? []);
        const unresolved = [...external].filter((id) => !known.has(id));
        if (unresolved.length === 0) return true;
        return {
          message: `${unresolved.length} ENT ref(s) elsewhere do not resolve in the bloom`,
          details: { unresolved: unresolved.slice(0, 10) },
        };
      },
    },
    {
      id: 'C-1.4.4',
      description: 'Every entity has a name and description.',
      severity: 'advisory',
      check: (artifact) => {
        const bad = (artifact.entities ?? [])
          .filter((e) => !e.name || !e.description)
          .map((e) => e.id);
        if (bad.length === 0) return true;
        return { message: `${bad.length} entity(ies) missing name/description`, details: { ids: bad } };
      },
    },
  ],
};
