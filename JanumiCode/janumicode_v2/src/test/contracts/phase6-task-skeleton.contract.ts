/**
 * Contract for Phase 6.1 — task_skeleton (artifact kind: `implementation_plan`).
 *
 * Codifies design positions from
 *   docs/design/contract-harness-stage1b-design-positions.md, Gap #1.
 *
 * `task.traces_to` MUST contain ids (not statement prose). US ids are
 * optional at the task level; the canonical US ↔ task edge is provided
 * via component.traces_to (Gap #2 / C-4.2.4).
 */

import type { ContractSuite } from './types';
import type { ComponentModelArtifact } from './phase4-component-skeleton.contract';

// ── Producer artifact shape ─────────────────────────────────────

export interface ImplementationTaskCompletionCriterion {
  criterion_id: string;
  description: string;
  verification_method: string;
  artifact_ref?: string;
}

export interface ImplementationTask {
  id: string;
  name: string;
  description: string;
  task_type: 'standard' | 'refactoring';
  component_id: string;
  component_responsibility: string;
  backing_tool: string;
  estimated_complexity: 'low' | 'medium' | 'high';
  completion_criteria: ImplementationTaskCompletionCriterion[];
  write_directory_paths: string[];
  read_directory_paths: string[];
  dependency_task_ids: string[];
  traces_to: string[];
}

export interface ImplementationPlanArtifact {
  kind: 'implementation_plan';
  tasks: ImplementationTask[];
  total_tasks?: number;
}

// ── Contract suite ───────────────────────────────────────────────

const TASK_ID_PATTERN = /^task-/;
const COMP_ID_PATTERN = /^comp-/;
const VALID_TRACE_ID_PATTERNS = [
  /^US-\d+$/,          // user story (optional per Gap #1)
  /^NFR-\d+$/,         // nonfunctional requirement
  /^SR-\d+$/,          // system requirement
  /^res-/,             // responsibility id
  /^comp-/,            // component id
];

function looksLikeStatementProse(s: string): boolean {
  // Heuristic: ids are short, have no spaces, and follow a token pattern.
  // Prose has spaces and is long.
  return s.includes(' ') || s.length > 40;
}

export const phase6TaskSkeletonContract: ContractSuite<ImplementationPlanArtifact> = {
  boundaryId: '6.1_task_skeleton',
  phaseId: '6',
  subPhaseId: 'task_skeleton',
  producerArtifactKind: 'implementation_plan',
  description:
    'Phase 6 task skeleton — task.traces_to contains ids (not prose); task.component_id resolves (Gap #1).',
  clauses: [
    {
      id: 'C-6.1.1',
      description: 'implementation_plan.tasks is a non-empty array.',
      severity: 'blocking',
      check: (artifact) => {
        if (!Array.isArray(artifact.tasks) || artifact.tasks.length === 0) {
          return { message: 'tasks is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-6.1.2',
      description: 'Every task has a non-empty id matching the task-* convention.',
      severity: 'blocking',
      check: (artifact) => {
        const bad = artifact.tasks
          .filter((t) => !t.id || !TASK_ID_PATTERN.test(t.id))
          .map((t, i) => t.id || `(index ${i})`);
        if (bad.length === 0) return true;
        return { message: `${bad.length} task(s) have invalid id`, details: { ids: bad } };
      },
    },
    {
      id: 'C-6.1.3',
      description: 'Task ids are unique within the plan.',
      severity: 'blocking',
      check: (artifact) => {
        const counts = new Map<string, number>();
        for (const t of artifact.tasks) counts.set(t.id, (counts.get(t.id) ?? 0) + 1);
        const dups = [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
        if (dups.length === 0) return true;
        return { message: `duplicate task ids: ${dups.join(', ')}`, details: { dups } };
      },
    },
    {
      id: 'C-6.1.4',
      description: 'Every task.component_id is a non-empty string id token (no statement prose).',
      severity: 'blocking',
      check: (artifact) => {
        // The Phase 6 prompt explicitly says: "VERBATIM component id from
        // the Component Model — copy it byte-for-byte. Never prepend
        // `comp-`." So projects may use `comp-foo` or bare `foo`
        // depending on the component_model convention. The structural
        // resolvability check is C-6.1.5 (resolves against the actual
        // component_model). Here we only enforce: present, string,
        // not statement prose.
        const bad = artifact.tasks
          .filter((t) => !t.component_id || typeof t.component_id !== 'string'
            || t.component_id.includes(' ') || t.component_id.length > 100)
          .map((t) => t.id);
        if (bad.length === 0) return true;
        return { message: `${bad.length} task(s) have invalid component_id`, details: { taskIds: bad } };
      },
    },
    {
      id: 'C-6.1.5',
      description: 'Every task.component_id resolves to a component in the component_model.',
      severity: 'blocking',
      check: (artifact, context) => {
        const cmArtifacts = context.relatedArtifacts.get('component_model') ?? [];
        if (cmArtifacts.length === 0) return true; // isolation mode
        const knownComps = new Set<string>();
        for (const cm of cmArtifacts) {
          const cmA = cm as ComponentModelArtifact;
          for (const c of cmA.components ?? []) knownComps.add(c.id);
        }
        const unresolved = artifact.tasks
          .filter((t) => !knownComps.has(t.component_id))
          .map((t) => ({ taskId: t.id, componentId: t.component_id }));
        if (unresolved.length === 0) return true;
        return {
          message: `${unresolved.length} task(s) reference an unknown component_id`,
          details: { unresolved },
        };
      },
    },
    {
      id: 'C-6.1.6',
      description: 'Every task.traces_to entry is an id token (not statement prose).',
      severity: 'blocking',
      check: (artifact) => {
        const bad: Array<{ taskId: string; entry: string }> = [];
        for (const t of artifact.tasks) {
          for (const entry of t.traces_to ?? []) {
            if (looksLikeStatementProse(entry)) {
              bad.push({ taskId: t.id, entry });
            }
          }
        }
        if (bad.length === 0) return true;
        return {
          message: `${bad.length} traces_to entries look like prose, not ids`,
          details: { examples: bad.slice(0, 5) },
        };
      },
    },
    {
      id: 'C-6.1.7',
      description: 'Every task.traces_to id matches a known id namespace (US/NFR/SR/res-/comp-).',
      severity: 'advisory',
      check: (artifact) => {
        const bad: Array<{ taskId: string; entry: string }> = [];
        for (const t of artifact.tasks) {
          for (const entry of t.traces_to ?? []) {
            if (looksLikeStatementProse(entry)) continue; // C-6.1.6 catches this
            if (!VALID_TRACE_ID_PATTERNS.some((p) => p.test(entry))) {
              bad.push({ taskId: t.id, entry });
            }
          }
        }
        if (bad.length === 0) return true;
        return {
          message: `${bad.length} traces_to entries use an unrecognized id namespace`,
          details: { examples: bad.slice(0, 5) },
        };
      },
    },
    {
      id: 'C-6.1.8',
      description: 'Every task has at least one completion_criterion with criterion_id, description, verification_method.',
      severity: 'blocking',
      check: (artifact) => {
        const bad: string[] = [];
        for (const t of artifact.tasks) {
          if (!Array.isArray(t.completion_criteria) || t.completion_criteria.length === 0) {
            bad.push(t.id);
            continue;
          }
          const malformed = t.completion_criteria.some(
            (c) => !c.criterion_id || !c.description || !c.verification_method,
          );
          if (malformed) bad.push(t.id);
        }
        if (bad.length === 0) return true;
        return {
          message: `${bad.length} task(s) have missing or malformed completion_criteria`,
          details: { taskIds: bad },
        };
      },
    },
    {
      id: 'C-6.1.9',
      description: 'Every task.dependency_task_ids resolves within the plan.',
      severity: 'blocking',
      check: (artifact) => {
        const known = new Set(artifact.tasks.map((t) => t.id));
        const unresolved: Array<{ from: string; to: string }> = [];
        for (const t of artifact.tasks) {
          for (const dep of t.dependency_task_ids ?? []) {
            if (!known.has(dep)) unresolved.push({ from: t.id, to: dep });
          }
        }
        if (unresolved.length === 0) return true;
        return {
          message: `${unresolved.length} task dependencies do not resolve`,
          details: { unresolved },
        };
      },
    },
    {
      id: 'C-6.1.10',
      description: 'Every task has a non-empty write_directory_paths array.',
      severity: 'blocking',
      check: (artifact) => {
        const bad = artifact.tasks
          .filter((t) => !Array.isArray(t.write_directory_paths) || t.write_directory_paths.length === 0)
          .map((t) => t.id);
        if (bad.length === 0) return true;
        return {
          message: `${bad.length} task(s) have no write_directory_paths`,
          details: { taskIds: bad },
        };
      },
    },
  ],
};
