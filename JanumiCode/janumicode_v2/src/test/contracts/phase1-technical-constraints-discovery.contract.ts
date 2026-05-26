/**
 * Contract for Phase 1.0c — technical_constraints_discovery
 * (artifact kind: `technical_constraints_discovery`).
 *
 * TECH-* constraints are surfaced verbatim in Phase 6 task contexts
 * and Phase 9 packet active_constraints. Every TECH-* id used
 * downstream must resolve here.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export interface TechnicalConstraint {
  id: string;
  category?: string;
  text?: string;
  technology?: string;
  rationale?: string;
}

export interface TechnicalConstraintsArtifact {
  kind: 'technical_constraints_discovery';
  technical_extracted_items?: TechnicalConstraint[];
  technical_constraints?: TechnicalConstraint[];
  items?: TechnicalConstraint[];
}

// ── Contract suite ───────────────────────────────────────────────

const TECH_ID_PATTERN = /^TECH-/;

function getItems(a: TechnicalConstraintsArtifact): TechnicalConstraint[] {
  return a.technical_extracted_items ?? a.technical_constraints ?? a.items ?? [];
}

/**
 * Phase 1.0c assigns TECH-* ids. Downstream consumers that legitimately
 * cite them: implementation_plan task.active_constraints, component_model
 * component.active_constraints, release_plan cross_cutting.technical_constraints,
 * and implementation_packet records.
 */
const TECH_DOWNSTREAM_CONSUMER_KINDS: ReadonlySet<string> = new Set([
  'implementation_plan',
  'component_model',
  'release_plan',
  'implementation_packet',
]);

function collectExternalTechRefs(context: { relatedArtifacts: ReadonlyMap<string, ReadonlyArray<unknown>> }): Set<string> {
  const out = new Set<string>();
  for (const [kind, arr] of context.relatedArtifacts) {
    if (!TECH_DOWNSTREAM_CONSUMER_KINDS.has(kind)) continue;
    for (const a of arr) {
      const blob = JSON.stringify(a);
      for (const m of blob.matchAll(/TECH-[A-Z0-9_-]+/g)) out.add(m[0]);
    }
  }
  return out;
}

export const phase1TechnicalConstraintsContract: ContractSuite<TechnicalConstraintsArtifact> = {
  boundaryId: '1.0c_technical_constraints_discovery',
  phaseId: '1',
  subPhaseId: 'technical_constraints_discovery',
  producerArtifactKind: 'technical_constraints_discovery',
  description:
    'Phase 1 TECH-* constraints — every TECH id used downstream resolves; each has text + category.',
  clauses: [
    {
      id: 'C-1.0c.1',
      description: 'technical_constraints array is present (may be empty when no TECH refs exist downstream).',
      severity: 'blocking',
      check: (artifact, context) => {
        const items = getItems(artifact);
        const external = collectExternalTechRefs(context);
        if (items.length === 0 && external.size > 0) {
          return {
            message: `no TECH constraints emitted but ${external.size} TECH ref(s) cited downstream`,
            details: { sample: [...external].slice(0, 10) },
          };
        }
        return true;
      },
    },
    {
      id: 'C-1.0c.2',
      description: 'Every constraint has a non-empty TECH-* id, unique within the artifact.',
      severity: 'blocking',
      check: (artifact) => {
        const items = getItems(artifact);
        const counts = new Map<string, number>();
        const bad: string[] = [];
        for (const c of items) {
          if (!c.id || !TECH_ID_PATTERN.test(c.id)) { bad.push(c.id || '(missing)'); continue; }
          counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
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
      id: 'C-1.0c.3',
      description: 'Every constraint has non-empty text and category.',
      severity: 'blocking',
      check: (artifact) => {
        const items = getItems(artifact);
        const bad: Array<{ id: string; missing: string[] }> = [];
        for (const c of items) {
          const missing: string[] = [];
          if (!c.text || c.text.trim().length === 0) missing.push('text');
          if (!c.category) missing.push('category');
          if (missing.length) bad.push({ id: c.id, missing });
        }
        if (bad.length === 0) return true;
        return { message: `${bad.length} constraint(s) missing text/category`, details: { bad } };
      },
    },
    {
      id: 'C-1.0c.4',
      description: 'Every TECH-* id cited downstream resolves in this artifact.',
      severity: 'blocking',
      check: (artifact, context) => {
        const external = collectExternalTechRefs(context);
        if (external.size === 0) return true;
        const known = new Set(getItems(artifact).map((c) => c.id));
        const unresolved = [...external].filter((id) => !known.has(id));
        if (unresolved.length === 0) return true;
        return {
          message: `${unresolved.length} TECH ref(s) downstream do not resolve`,
          details: { unresolved: unresolved.slice(0, 10) },
        };
      },
    },
  ],
};
