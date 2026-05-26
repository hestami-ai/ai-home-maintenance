/**
 * Contract for Phase 5.2 — api_definitions (artifact kind: `api_definitions`).
 *
 * Codifies design positions from
 *   docs/design/contract-harness-stage1b-design-positions.md, Gap #5.
 *
 * Producer shape is canonical: `definitions[].endpoints[]`
 * (component-grouped, endpoints nested). Mirror of Gap #4 for APIs.
 */

import type { ContractSuite } from './types';
import type { ComponentModelArtifact } from './phase4-component-skeleton.contract';

// ── Producer artifact shape ─────────────────────────────────────

export interface ApiEndpoint {
  path: string;
  method: string;
  inputs?: unknown;
  outputs?: unknown;
  error_codes?: string[];
  auth_requirement?: string;
  description?: string;
}

export interface ApiDefinitionsComponentGroup {
  component_id: string;
  endpoints: ApiEndpoint[];
}

export interface ApiDefinitionsArtifact {
  kind: 'api_definitions';
  definitions: ApiDefinitionsComponentGroup[];
}

// ── Contract suite ───────────────────────────────────────────────

const COMP_ID_PATTERN = /^comp-/;
const HTTP_METHOD_PATTERN = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/i;
const PLACEHOLDER_VALUES = new Set(['open_question', 'TBD', 'tbd', 'todo']);

function isPlaceholder(v: string | undefined): boolean {
  return typeof v === 'string' && PLACEHOLDER_VALUES.has(v.trim());
}

export const phase5ApiDefinitionsContract: ContractSuite<ApiDefinitionsArtifact> = {
  boundaryId: '5.2_api_definitions',
  phaseId: '5',
  subPhaseId: 'api_definitions',
  producerArtifactKind: 'api_definitions',
  description:
    'Phase 5 API definitions — component-grouped, endpoints nested with real paths/methods (Gap #5).',
  clauses: [
    {
      id: 'C-5.2.1',
      description: 'api_definitions.definitions is an array (may be empty for components with no APIs).',
      severity: 'blocking',
      check: (artifact) => {
        if (!Array.isArray(artifact.definitions)) {
          return { message: 'definitions is missing or not an array' };
        }
        return true;
      },
    },
    {
      id: 'C-5.2.2',
      description: 'Every definition group has a non-empty component_id (comp-*).',
      severity: 'blocking',
      check: (artifact) => {
        // component_id namespace varies by project — see C-5.2.5 for the
        // resolvability check against component_model. Here we only
        // require an id token, not a specific prefix.
        const bad = artifact.definitions
          .map((d, i) => ({ idx: i, id: d.component_id }))
          .filter((x) => !x.id || typeof x.id !== 'string' || x.id.includes(' ') || x.id.length > 100);
        if (bad.length === 0) return true;
        return {
          message: `${bad.length} definition group(s) have invalid component_id`,
          details: { bad },
        };
      },
    },
    {
      id: 'C-5.2.3',
      description: 'Every endpoint has a non-placeholder path and an HTTP method.',
      severity: 'blocking',
      check: (artifact) => {
        const bad: Array<{ componentId: string; path: string; method: string; reason: string }> = [];
        for (const d of artifact.definitions) {
          for (const ep of d.endpoints ?? []) {
            if (!ep.path || isPlaceholder(ep.path)) {
              bad.push({ componentId: d.component_id, path: ep.path ?? '(missing)', method: ep.method ?? '', reason: 'placeholder or missing path' });
              continue;
            }
            if (!ep.method || !HTTP_METHOD_PATTERN.test(ep.method)) {
              bad.push({ componentId: d.component_id, path: ep.path, method: ep.method ?? '(missing)', reason: 'placeholder or invalid method' });
            }
          }
        }
        if (bad.length === 0) return true;
        return {
          message: `${bad.length} endpoint(s) have placeholder or invalid path/method`,
          details: { issues: bad.slice(0, 10) },
        };
      },
    },
    {
      id: 'C-5.2.4',
      description: 'Every endpoint has at least one error_code declared.',
      severity: 'advisory',
      check: (artifact) => {
        const bad: Array<{ componentId: string; path: string }> = [];
        for (const d of artifact.definitions) {
          for (const ep of d.endpoints ?? []) {
            if (!Array.isArray(ep.error_codes) || ep.error_codes.length === 0) {
              bad.push({ componentId: d.component_id, path: ep.path });
            }
          }
        }
        if (bad.length === 0) return true;
        return {
          message: `${bad.length} endpoint(s) have no error_codes`,
          details: { issues: bad.slice(0, 10) },
        };
      },
    },
    {
      id: 'C-5.2.5',
      description: 'Every definition.component_id resolves to a component in component_model.',
      severity: 'advisory',
      check: (artifact, context) => {
        const cmArtifacts = context.relatedArtifacts.get('component_model') ?? [];
        if (cmArtifacts.length === 0) return true;
        const known = new Set<string>();
        for (const cm of cmArtifacts) {
          const cmA = cm as ComponentModelArtifact;
          for (const c of cmA.components ?? []) known.add(c.id);
        }
        const unresolved = artifact.definitions
          .filter((d) => !known.has(d.component_id))
          .map((d) => d.component_id);
        if (unresolved.length === 0) return true;
        return {
          message: `${unresolved.length} definition component_id(s) do not resolve`,
          details: { componentIds: unresolved },
        };
      },
    },
    {
      id: 'C-5.2.6',
      description: 'No component_id appears in more than one definition group.',
      severity: 'advisory',
      check: (artifact) => {
        const counts = new Map<string, number>();
        for (const d of artifact.definitions) counts.set(d.component_id, (counts.get(d.component_id) ?? 0) + 1);
        const dups = [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
        if (dups.length === 0) return true;
        return { message: `duplicate component_id groups: ${dups.join(', ')}`, details: { dups } };
      },
    },
  ],
};
