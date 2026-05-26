/**
 * Contract for Phase 5.1 — data_model_skeleton (artifact kind: `data_models`).
 *
 * Codifies design positions from
 *   docs/design/contract-harness-stage1b-design-positions.md, Gap #4.
 *
 * Producer shape is canonical: `models[].entities[].fields[]`
 * (component-grouped, entities nested). Consumer code (packetBuilder)
 * is fixed to walk the nesting; producer is not flattened.
 */

import type { ContractSuite } from './types';
import type { ComponentModelArtifact } from './phase4-component-skeleton.contract';

// ── Producer artifact shape (nested per design position) ────────

export interface DataModelField {
  name: string;
  type: string;
  constraints?: string[];
}

export interface DataModelEntity {
  name: string;
  fields: DataModelField[];
  relationships?: Array<unknown>;
}

export interface DataModelComponentGroup {
  component_id: string;
  entities: DataModelEntity[];
}

export interface DataModelsArtifact {
  kind: 'data_models';
  models: DataModelComponentGroup[];
}

// ── Contract suite ───────────────────────────────────────────────

const COMP_ID_PATTERN = /^comp-/;

export const phase5DataModelsContract: ContractSuite<DataModelsArtifact> = {
  boundaryId: '5.1_data_model_skeleton',
  phaseId: '5',
  subPhaseId: 'data_model_skeleton',
  producerArtifactKind: 'data_models',
  description:
    'Phase 5 data models — component-grouped, entities nested (Gap #4 canonical shape).',
  clauses: [
    {
      id: 'C-5.1.1',
      description: 'data_models.models is a non-empty array.',
      severity: 'blocking',
      check: (artifact) => {
        if (!Array.isArray(artifact.models) || artifact.models.length === 0) {
          return { message: 'models is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-5.1.2',
      description: 'Every model group has a non-empty component_id (id token, not prose).',
      severity: 'blocking',
      check: (artifact) => {
        // The component_id namespace varies by project (comp-foo vs bare
        // foo) — Phase 4 emits whatever the prompt + model produce. The
        // structural resolvability check is C-5.1.5 (resolves against
        // component_model). Here we only enforce: present, string token.
        const bad = artifact.models
          .map((m, i) => ({ idx: i, id: m.component_id }))
          .filter((x) => !x.id || typeof x.id !== 'string' || x.id.includes(' ') || x.id.length > 100);
        if (bad.length === 0) return true;
        return {
          message: `${bad.length} model group(s) have invalid component_id`,
          details: { bad },
        };
      },
    },
    {
      id: 'C-5.1.3',
      description: 'Every model.entities is a non-empty array.',
      severity: 'blocking',
      check: (artifact) => {
        const empty = artifact.models
          .filter((m) => !Array.isArray(m.entities) || m.entities.length === 0)
          .map((m) => m.component_id);
        if (empty.length === 0) return true;
        return {
          message: `${empty.length} model group(s) have no entities`,
          details: { componentIds: empty },
        };
      },
    },
    {
      id: 'C-5.1.4',
      description: 'Every entity has a name and a non-empty fields array; every field has name + type.',
      severity: 'blocking',
      check: (artifact) => {
        const bad: Array<{ componentId: string; entity: string; reason: string }> = [];
        for (const m of artifact.models) {
          for (const e of m.entities ?? []) {
            if (!e.name) {
              bad.push({ componentId: m.component_id, entity: '(missing name)', reason: 'no name' });
              continue;
            }
            if (!Array.isArray(e.fields) || e.fields.length === 0) {
              bad.push({ componentId: m.component_id, entity: e.name, reason: 'no fields' });
              continue;
            }
            const malformed = e.fields.find((f) => !f.name || !f.type);
            if (malformed) {
              bad.push({
                componentId: m.component_id,
                entity: e.name,
                reason: `malformed field: ${malformed.name ?? '(no name)'}`,
              });
            }
          }
        }
        if (bad.length === 0) return true;
        return {
          message: `${bad.length} entity-level issue(s)`,
          details: { issues: bad.slice(0, 10) },
        };
      },
    },
    {
      id: 'C-5.1.5',
      description: 'Every model.component_id resolves to a component in component_model.',
      severity: 'advisory',
      check: (artifact, context) => {
        const cmArtifacts = context.relatedArtifacts.get('component_model') ?? [];
        if (cmArtifacts.length === 0) return true;
        const known = new Set<string>();
        for (const cm of cmArtifacts) {
          const cmA = cm as ComponentModelArtifact;
          for (const c of cmA.components ?? []) known.add(c.id);
        }
        const unresolved = artifact.models
          .filter((m) => !known.has(m.component_id))
          .map((m) => m.component_id);
        if (unresolved.length === 0) return true;
        return {
          message: `${unresolved.length} model component_id(s) do not resolve`,
          details: { componentIds: unresolved },
        };
      },
    },
    {
      id: 'C-5.1.6',
      description: 'No model group has more than one entry per component_id (groups are unique).',
      severity: 'advisory',
      check: (artifact) => {
        const counts = new Map<string, number>();
        for (const m of artifact.models) counts.set(m.component_id, (counts.get(m.component_id) ?? 0) + 1);
        const dups = [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
        if (dups.length === 0) return true;
        return { message: `duplicate component_id groups: ${dups.join(', ')}`, details: { dups } };
      },
    },
  ],
};
