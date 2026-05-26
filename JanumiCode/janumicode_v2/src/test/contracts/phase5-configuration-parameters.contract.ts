/**
 * Contract for Phase 5.4 — configuration_parameters
 * (artifact kind: `configuration_parameters`).
 *
 * Config parameters surface in Phase 9 packets as runtime knobs the
 * executor must respect. Component-keyed.
 */

import type { ContractSuite } from './types';
import type { ComponentModelArtifact } from './phase4-component-skeleton.contract';

// ── Producer artifact shape ─────────────────────────────────────

export interface ConfigParameter {
  name: string;
  type?: string;
  default?: unknown;
  description?: string;
  required?: boolean;
  secret?: boolean;
}

export interface ConfigParameterComponentGroup {
  component_id: string;
  parameters?: ConfigParameter[];
}

export interface ConfigurationParametersArtifact {
  kind: 'configuration_parameters';
  parameters?: ConfigParameterComponentGroup[];
  components?: ConfigParameterComponentGroup[];
}

// ── Contract suite ───────────────────────────────────────────────

const COMP_ID_PATTERN = /^comp-/;

function getGroups(a: ConfigurationParametersArtifact): ConfigParameterComponentGroup[] {
  return a.parameters ?? a.components ?? [];
}

export const phase5ConfigParametersContract: ContractSuite<ConfigurationParametersArtifact> = {
  boundaryId: '5.4_configuration_parameters',
  phaseId: '5',
  subPhaseId: 'configuration_parameters',
  producerArtifactKind: 'configuration_parameters',
  description:
    'Phase 5 config parameters — component-keyed, each parameter has name + type + description.',
  clauses: [
    {
      id: 'C-5.4.1',
      description: 'configuration_parameters has an array (may be empty if no components carry config).',
      severity: 'blocking',
      check: (artifact) => {
        const groups = getGroups(artifact);
        if (!Array.isArray(groups)) return { message: 'parameters/components is not an array' };
        return true;
      },
    },
    {
      id: 'C-5.4.2',
      description: 'Every group has a non-empty component_id (id token, not prose).',
      severity: 'blocking',
      check: (artifact) => {
        // Project component_id convention varies — see C-5.4.5 for the
        // resolvability check against component_model.
        const bad = getGroups(artifact)
          .map((g, i) => ({ idx: i, id: g.component_id }))
          .filter((x) => !x.id || typeof x.id !== 'string' || x.id.includes(' ') || x.id.length > 100);
        if (bad.length === 0) return true;
        return { message: `${bad.length} group(s) have invalid component_id`, details: { bad } };
      },
    },
    {
      id: 'C-5.4.3',
      description: 'Every parameter has a non-empty name and a type.',
      severity: 'blocking',
      check: (artifact) => {
        const bad: Array<{ componentId: string; param: string; reason: string }> = [];
        for (const g of getGroups(artifact)) {
          for (const p of g.parameters ?? []) {
            if (!p.name) {
              bad.push({ componentId: g.component_id, param: '(missing)', reason: 'no name' });
              continue;
            }
            if (!p.type) bad.push({ componentId: g.component_id, param: p.name, reason: 'no type' });
          }
        }
        if (bad.length === 0) return true;
        return { message: `${bad.length} parameter(s) have shape issues`, details: { bad: bad.slice(0, 10) } };
      },
    },
    {
      id: 'C-5.4.4',
      description: 'Parameter names are unique within their component group.',
      severity: 'advisory',
      check: (artifact) => {
        const bad: Array<{ componentId: string; dups: string[] }> = [];
        for (const g of getGroups(artifact)) {
          const counts = new Map<string, number>();
          for (const p of g.parameters ?? []) counts.set(p.name, (counts.get(p.name) ?? 0) + 1);
          const dups = [...counts.entries()].filter(([, n]) => n > 1).map(([n]) => n);
          if (dups.length) bad.push({ componentId: g.component_id, dups });
        }
        if (bad.length === 0) return true;
        return { message: `${bad.length} group(s) have duplicate parameter names`, details: { bad } };
      },
    },
    {
      id: 'C-5.4.5',
      description: 'Every group.component_id resolves to a component in component_model.',
      severity: 'advisory',
      check: (artifact, context) => {
        const cms = context.relatedArtifacts.get('component_model') ?? [];
        if (cms.length === 0) return true;
        const known = new Set<string>();
        for (const cm of cms) {
          const cmA = cm as ComponentModelArtifact;
          for (const c of cmA.components ?? []) known.add(c.id);
        }
        const unresolved = getGroups(artifact).filter((g) => !known.has(g.component_id)).map((g) => g.component_id);
        if (unresolved.length === 0) return true;
        return { message: `${unresolved.length} group component_id(s) do not resolve`, details: { componentIds: unresolved } };
      },
    },
  ],
};
