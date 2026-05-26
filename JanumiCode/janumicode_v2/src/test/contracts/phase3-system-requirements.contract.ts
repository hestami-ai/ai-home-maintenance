/**
 * Contract for Phase 3.2 — system_requirements (artifact kind: `system_requirements`).
 *
 * Codifies design positions from
 *   docs/design/contract-harness-stage1b-design-positions.md, Gap #6.
 *
 * `SR.source_requirement_ids` MUST cite originating US-* and/or NFR-* ids.
 * Today it sometimes traces to NFR only — this contract enforces that
 * either or both source axes appear, never neither.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export interface SystemRequirement {
  id: string;
  statement: string;
  source_requirement_ids: string[];
  priority?: number;
}

export interface SystemRequirementsArtifact {
  kind: 'system_requirements';
  items: SystemRequirement[];
}

// ── Contract suite ───────────────────────────────────────────────

const SR_ID_PATTERN = /^SR-\d+$/;
const US_ID_PATTERN = /^US-\d+$/;
const NFR_ID_PATTERN = /^NFR-/;

export const phase3SystemRequirementsContract: ContractSuite<SystemRequirementsArtifact> = {
  boundaryId: '3.2_system_requirements',
  phaseId: '3',
  subPhaseId: 'system_requirements',
  producerArtifactKind: 'system_requirements',
  description:
    'Phase 3 SRs — each SR cites originating US and/or NFR ids in source_requirement_ids (Gap #6).',
  clauses: [
    {
      id: 'C-3.2.1',
      description: 'system_requirements.items is a non-empty array.',
      severity: 'blocking',
      check: (artifact) => {
        if (!Array.isArray(artifact.items) || artifact.items.length === 0) {
          return { message: 'items is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-3.2.2',
      description: 'Every SR has a non-empty SR-* id, and ids are unique.',
      severity: 'blocking',
      check: (artifact) => {
        const counts = new Map<string, number>();
        const bad: string[] = [];
        for (const sr of artifact.items) {
          if (!sr.id || !SR_ID_PATTERN.test(sr.id)) {
            bad.push(sr.id || '(missing)');
            continue;
          }
          counts.set(sr.id, (counts.get(sr.id) ?? 0) + 1);
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
      id: 'C-3.2.3',
      description: 'Every SR has a non-empty statement.',
      severity: 'blocking',
      check: (artifact) => {
        const bad = artifact.items.filter((sr) => !sr.statement || sr.statement.trim().length === 0).map((sr) => sr.id);
        if (bad.length === 0) return true;
        return { message: `${bad.length} SR(s) have empty statement`, details: { srIds: bad } };
      },
    },
    {
      id: 'C-3.2.4',
      description: 'Every SR has source_requirement_ids citing US-* and/or NFR-* (per Gap #6).',
      severity: 'blocking',
      check: (artifact) => {
        const bad: Array<{ srId: string; reason: string }> = [];
        for (const sr of artifact.items) {
          if (!Array.isArray(sr.source_requirement_ids) || sr.source_requirement_ids.length === 0) {
            bad.push({ srId: sr.id, reason: 'empty source_requirement_ids' });
            continue;
          }
          const valid = sr.source_requirement_ids.filter(
            (s) => US_ID_PATTERN.test(s) || NFR_ID_PATTERN.test(s),
          );
          if (valid.length === 0) {
            bad.push({ srId: sr.id, reason: 'no US-* or NFR-* refs' });
          }
        }
        if (bad.length === 0) return true;
        return { message: `${bad.length} SR(s) violate source-id requirement`, details: { issues: bad.slice(0, 10) } };
      },
    },
    {
      id: 'C-3.2.5',
      description: 'Every source_requirement_ids entry resolves to a known FR US or NFR (when those artifacts are in context).',
      severity: 'advisory',
      check: (artifact, context) => {
        const frArtifacts = context.relatedArtifacts.get('functional_requirements') ?? [];
        const nfrArtifacts = context.relatedArtifacts.get('non_functional_requirements') ?? [];
        if (frArtifacts.length === 0 && nfrArtifacts.length === 0) return true;
        const known = new Set<string>();
        for (const fr of frArtifacts) {
          const stories = (fr as { user_stories?: Array<{ id?: string }> }).user_stories ?? [];
          for (const s of stories) if (s.id) known.add(s.id);
        }
        for (const nfr of nfrArtifacts) {
          const reqs = (nfr as { requirements?: Array<{ id?: string }> }).requirements ?? [];
          for (const r of reqs) if (r.id) known.add(r.id);
        }
        const unresolved: Array<{ srId: string; sourceId: string }> = [];
        for (const sr of artifact.items) {
          for (const s of sr.source_requirement_ids ?? []) {
            if (!known.has(s)) unresolved.push({ srId: sr.id, sourceId: s });
          }
        }
        if (unresolved.length === 0) return true;
        return {
          message: `${unresolved.length} source-id ref(s) do not resolve`,
          details: { examples: unresolved.slice(0, 10) },
        };
      },
    },
  ],
};
