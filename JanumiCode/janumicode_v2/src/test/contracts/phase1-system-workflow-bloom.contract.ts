/**
 * Contract for Phase 1.3b — system_workflow_bloom (artifact kind: `system_workflow_bloom`).
 *
 * Workflows back user journeys (workflow.backs_journeys → UJ-*) and
 * are referenced by US.traces_to via WF-* ids. Every WF id used
 * elsewhere must resolve in this bloom.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export interface WorkflowStep {
  stepNumber: number;
  actor?: string;
  action?: string;
  expectedOutcome?: string;
}

export interface WorkflowTrigger {
  kind?: string;
  journey_id?: string;
  step_number?: number;
}

export interface Workflow {
  id: string;
  name?: string;
  description?: string;
  businessDomainId?: string;
  steps?: WorkflowStep[];
  triggers?: WorkflowTrigger[];
  backs_journeys?: string[];
  actors?: string[];
  source?: string;
}

export interface SystemWorkflowBloomArtifact {
  kind: 'system_workflow_bloom';
  workflows: Workflow[];
}

// ── Contract suite ───────────────────────────────────────────────

const WF_ID_PATTERN = /^WF-/;
const UJ_ID_PATTERN = /^UJ-/;
const DOM_ID_PATTERN = /^DOM-/;

/**
 * Phase 1.3b assigns WF-* ids. Downstream consumers that cite them
 * include Phase 2.1 FRs (US.traces_to WF-*) and Phase 1.9 release_plan
 * (contains.workflows).
 */
const WF_DOWNSTREAM_CONSUMER_KINDS: ReadonlySet<string> = new Set([
  'functional_requirements',
  'release_plan',
]);

function collectExternalWfRefs(context: { relatedArtifacts: ReadonlyMap<string, ReadonlyArray<unknown>> }): Set<string> {
  const out = new Set<string>();
  for (const [kind, arr] of context.relatedArtifacts) {
    if (!WF_DOWNSTREAM_CONSUMER_KINDS.has(kind)) continue;
    for (const a of arr) {
      const blob = JSON.stringify(a);
      for (const m of blob.matchAll(/WF-[A-Z0-9_-]+/g)) out.add(m[0]);
    }
  }
  return out;
}

export const phase1SystemWorkflowBloomContract: ContractSuite<SystemWorkflowBloomArtifact> = {
  boundaryId: '1.3b_system_workflow_bloom',
  phaseId: '1',
  subPhaseId: 'system_workflow_bloom',
  producerArtifactKind: 'system_workflow_bloom',
  description:
    'Phase 1 system workflows — every WF id referenced elsewhere resolves; backs_journeys cite UJ-*.',
  clauses: [
    {
      id: 'C-1.3b.1',
      description: 'system_workflow_bloom.workflows is an array (non-empty when WF refs exist elsewhere).',
      severity: 'blocking',
      check: (artifact, context) => {
        if (!Array.isArray(artifact.workflows)) return { message: 'workflows is missing or not an array' };
        const external = collectExternalWfRefs(context);
        if (artifact.workflows.length === 0 && external.size > 0) {
          return {
            message: `bloom is empty but ${external.size} WF id(s) are referenced elsewhere`,
            details: { sample: [...external].slice(0, 10) },
          };
        }
        return true;
      },
    },
    {
      id: 'C-1.3b.2',
      description: 'Every workflow has a non-empty WF-* id, unique within the bloom.',
      severity: 'blocking',
      check: (artifact) => {
        const counts = new Map<string, number>();
        const bad: string[] = [];
        for (const w of artifact.workflows ?? []) {
          if (!w.id || !WF_ID_PATTERN.test(w.id)) { bad.push(w.id || '(missing)'); continue; }
          counts.set(w.id, (counts.get(w.id) ?? 0) + 1);
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
      id: 'C-1.3b.3',
      description: 'Every WF id referenced elsewhere resolves in the bloom.',
      severity: 'blocking',
      check: (artifact, context) => {
        const external = collectExternalWfRefs(context);
        if (external.size === 0) return true;
        const known = new Set((artifact.workflows ?? []).map((w) => w.id));
        const unresolved = [...external].filter((id) => !known.has(id));
        if (unresolved.length === 0) return true;
        return {
          message: `${unresolved.length} WF ref(s) elsewhere do not resolve`,
          details: { unresolved: unresolved.slice(0, 10) },
        };
      },
    },
    {
      id: 'C-1.3b.4',
      description: 'Every workflow.backs_journeys entry cites a UJ-* id.',
      severity: 'advisory',
      check: (artifact) => {
        const bad: Array<{ wfId: string; ref: string }> = [];
        for (const w of artifact.workflows ?? []) {
          for (const j of w.backs_journeys ?? []) {
            if (!UJ_ID_PATTERN.test(j)) bad.push({ wfId: w.id, ref: j });
          }
        }
        if (bad.length === 0) return true;
        return { message: `${bad.length} backs_journeys ref(s) are not UJ-*`, details: { bad } };
      },
    },
    {
      id: 'C-1.3b.5',
      description: 'workflow.businessDomainId (when present) matches DOM-*.',
      severity: 'advisory',
      check: (artifact) => {
        const bad: Array<{ wfId: string; bd: string }> = [];
        for (const w of artifact.workflows ?? []) {
          if (w.businessDomainId && !DOM_ID_PATTERN.test(w.businessDomainId)) {
            bad.push({ wfId: w.id, bd: w.businessDomainId });
          }
        }
        if (bad.length === 0) return true;
        return { message: `${bad.length} workflow(s) have non-DOM businessDomainId`, details: { bad } };
      },
    },
  ],
};
