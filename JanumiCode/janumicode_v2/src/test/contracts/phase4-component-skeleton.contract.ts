/**
 * Contract for Phase 4.2 — component_skeleton (artifact kind: `component_model`).
 *
 * Codifies design positions from
 *   docs/design/contract-harness-stage1b-design-positions.md, Gap #2.
 *
 * The keystone contract: declares `component.traces_to: [US-…]` as required.
 * Phase 9's packetBuilder consumes this edge to populate the US set
 * for every infrastructure task without per-task LLM annotation.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape (per design position) ────────────────

export interface ComponentResponsibility {
  id: string;
  statement: string;
}

export interface ComponentDependency {
  target_component_id: string;
  dependency_type: string;
}

export interface ComponentModelComponent {
  id: string;
  name: string;
  domain_id?: string;
  responsibilities: ComponentResponsibility[];
  dependencies?: ComponentDependency[];
  /** Gap #2: US ids this component's responsibilities collectively serve. */
  traces_to: string[];
}

export interface ComponentModelArtifact {
  kind: 'component_model';
  summary?: string;
  components: ComponentModelComponent[];
}

// ── Contract suite ───────────────────────────────────────────────

const US_ID_PATTERN = /^US-\d+$/;
const RES_ID_PATTERN = /^res-/;
const COMP_ID_PATTERN = /^comp-/;

export const phase4ComponentSkeletonContract: ContractSuite<ComponentModelArtifact> = {
  boundaryId: '4.2_component_skeleton',
  phaseId: '4',
  subPhaseId: 'component_skeleton',
  producerArtifactKind: 'component_model',
  description:
    'Phase 4 component skeleton — every component declares US tracing (Gap #2 keystone).',
  clauses: [
    {
      id: 'C-4.2.1',
      description: 'component_model.components is a non-empty array.',
      severity: 'blocking',
      check: (artifact) => {
        if (!Array.isArray(artifact.components) || artifact.components.length === 0) {
          return { message: 'components is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-4.2.2',
      description: 'Every component has a non-empty id token (no prose, no spaces).',
      severity: 'blocking',
      check: (artifact) => {
        // Component id namespace varies by project — Phase 4 emits
        // whatever the LLM produces in accord with the project's
        // naming convention (some use `comp-foo`, others use bare
        // `foo`). Downstream (task / data_model / api_definitions)
        // contracts check resolvability against the model, not the
        // prefix. Here we only require an id token.
        const bad = artifact.components
          .filter((c) => !c.id || typeof c.id !== 'string' || c.id.includes(' ') || c.id.length > 100)
          .map((c, i) => c.id || `(index ${i})`);
        if (bad.length === 0) return true;
        return {
          message: `${bad.length} component(s) have invalid id`,
          details: { ids: bad },
        };
      },
    },
    {
      id: 'C-4.2.3',
      description: 'Every component has at least one responsibility with id + statement.',
      severity: 'blocking',
      check: (artifact) => {
        const bad: string[] = [];
        for (const c of artifact.components) {
          if (!Array.isArray(c.responsibilities) || c.responsibilities.length === 0) {
            bad.push(c.id);
            continue;
          }
          const malformed = c.responsibilities.some(
            (r) => !r.id || !RES_ID_PATTERN.test(r.id) || !r.statement,
          );
          if (malformed) bad.push(c.id);
        }
        if (bad.length === 0) return true;
        return {
          message: `${bad.length} component(s) have missing or malformed responsibilities`,
          details: { componentIds: bad },
        };
      },
    },
    {
      id: 'C-4.2.4',
      description:
        'Every component has a non-empty traces_to citing at least one US-* id (Gap #2).',
      severity: 'blocking',
      check: (artifact) => {
        const missing: string[] = [];
        const malformed: Array<{ component: string; invalid: string[] }> = [];
        for (const c of artifact.components) {
          if (!Array.isArray(c.traces_to) || c.traces_to.length === 0) {
            missing.push(c.id);
            continue;
          }
          const usRefs = c.traces_to.filter((t) => US_ID_PATTERN.test(t));
          if (usRefs.length === 0) {
            missing.push(c.id);
            continue;
          }
          const invalid = c.traces_to.filter(
            (t) => !US_ID_PATTERN.test(t) && !RES_ID_PATTERN.test(t),
          );
          if (invalid.length > 0) malformed.push({ component: c.id, invalid });
        }
        if (missing.length === 0 && malformed.length === 0) return true;
        const parts: string[] = [];
        if (missing.length) parts.push(`${missing.length} component(s) missing US-* refs in traces_to`);
        if (malformed.length) parts.push(`${malformed.length} component(s) have non-US/non-res ids in traces_to`);
        return { message: parts.join('; '), details: { missing, malformed } };
      },
    },
    {
      id: 'C-4.2.5',
      description: 'Every US id cited in any component.traces_to resolves in functional_requirements.',
      severity: 'advisory',
      check: (artifact, context) => {
        const frArtifacts = context.relatedArtifacts.get('functional_requirements') ?? [];
        if (frArtifacts.length === 0) {
          // No FR artifact in context (e.g. running against fixture in isolation).
          // Silently pass — C-4.2.4 already enforces the existence of US-* refs.
          return true;
        }
        const knownUs = new Set<string>();
        for (const fr of frArtifacts) {
          const stories = (fr as { user_stories?: Array<{ id?: string }> }).user_stories ?? [];
          for (const s of stories) if (s.id) knownUs.add(s.id);
        }
        const unresolved: Array<{ component: string; usId: string }> = [];
        for (const c of artifact.components) {
          for (const t of c.traces_to ?? []) {
            if (US_ID_PATTERN.test(t) && !knownUs.has(t)) {
              unresolved.push({ component: c.id, usId: t });
            }
          }
        }
        if (unresolved.length === 0) return true;
        return {
          message: `${unresolved.length} component-to-US ref(s) do not resolve`,
          details: { unresolved },
        };
      },
    },
    {
      id: 'C-4.2.6',
      description: 'Component ids are unique across the model.',
      severity: 'blocking',
      check: (artifact) => {
        const counts = new Map<string, number>();
        for (const c of artifact.components) counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
        const dups = [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
        if (dups.length === 0) return true;
        return { message: `duplicate component ids: ${dups.join(', ')}`, details: { dups } };
      },
    },
    {
      id: 'C-4.2.7',
      description: 'Every component.dependencies[].target_component_id resolves to another component in the model.',
      severity: 'blocking',
      check: (artifact) => {
        const known = new Set(artifact.components.map((c) => c.id));
        const unresolved: Array<{ from: string; to: string }> = [];
        for (const c of artifact.components) {
          for (const d of c.dependencies ?? []) {
            if (!known.has(d.target_component_id)) {
              unresolved.push({ from: c.id, to: d.target_component_id });
            }
          }
        }
        if (unresolved.length === 0) return true;
        return {
          message: `${unresolved.length} dependency target(s) do not resolve`,
          details: { unresolved },
        };
      },
    },
  ],
};
