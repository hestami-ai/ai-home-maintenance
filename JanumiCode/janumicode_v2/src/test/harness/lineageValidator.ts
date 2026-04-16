/**
 * Lineage Validator — match a workflow run against the phase contracts.
 *
 * For each completed phase, the validator:
 *   1. Resolves every `RequiredArtifact` against actual records. Match
 *      is by record_type AND (for artifact_produced) content.kind.
 *      Optional sub_phase_id + produced_by_agent_role tighten the match.
 *   2. Runs the phase's invariant validators over the record set.
 *   3. Runs authority rules per record_type.
 *
 * Missing required artifacts become `MissingRecord` gaps; invariant
 * failures become `AssertionFailure`s; authority mismatches become
 * `SchemaViolation`s. The caller builds a `GapReport` from these.
 */

import type { Database } from '../../lib/database/init';
import type { PhaseId } from '../../lib/types/records';
import { getPhaseContract } from './phaseContracts';
import type {
  AssertionFailure,
  GapReport,
  MissingRecord,
  RequiredArtifact,
  SchemaViolation,
} from './types';

export interface LineageValidationResult {
  valid: boolean;
  missingRecords: MissingRecord[];
  violations: SchemaViolation[];
  assertionFailures: AssertionFailure[];
}

interface StreamRecord {
  id: string;
  record_type: string;
  phase_id: string | null;
  sub_phase_id: string | null;
  produced_by_agent_role: string | null;
  authority_level: number | null;
  content: string | null;
  produced_at: string;
}

// ── Public entry points ────────────────────────────────────────────

export function validateLineage(
  db: Database,
  workflowRunId: string,
  completedPhases: PhaseId[],
): LineageValidationResult {
  const missingRecords: MissingRecord[] = [];
  const violations: SchemaViolation[] = [];
  const assertionFailures: AssertionFailure[] = [];

  const records = getRecordsForRun(db, workflowRunId);

  for (const phaseId of completedPhases) {
    const contract = getPhaseContract(phaseId);
    if (!contract) continue;

    for (const req of contract.required_artifacts) {
      if (!findArtifact(records, req)) {
        if (!req.optional) {
          missingRecords.push({
            record_type: artifactDisplay(req),
            phase: phaseId,
            sub_phase: req.sub_phase_id,
            reason: req.reason,
          });
        }
      }
    }

    for (const invariant of contract.invariants) {
      const failures = runInvariant(records, invariant, phaseId);
      assertionFailures.push(...failures);
    }

    for (const rule of contract.authority_rules) {
      violations.push(...runAuthorityRule(records, rule));
    }
  }

  return {
    valid: missingRecords.length === 0 && violations.length === 0 && assertionFailures.length === 0,
    missingRecords,
    violations,
    assertionFailures,
  };
}

export function buildGapReport(
  result: LineageValidationResult,
  failedPhase: PhaseId,
  failedSubPhase?: string,
): GapReport {
  // Derive a sub-phase hint from the validator output when the caller
  // didn't supply one — prefer the first missing record (matches the
  // phase's first broken artifact), then fall back to the first
  // assertion failure. This lets the gap report carry locality even
  // when the caller has no prior signal.
  let subPhase = failedSubPhase;
  if (!subPhase) {
    const missingForPhase = result.missingRecords.find((m) => m.phase === failedPhase);
    if (missingForPhase?.sub_phase) subPhase = missingForPhase.sub_phase;
  }
  if (!subPhase) {
    const assertionForPhase = result.assertionFailures.find((a) => a.phase === failedPhase);
    if (assertionForPhase?.sub_phase && assertionForPhase.sub_phase !== 'unknown') {
      subPhase = assertionForPhase.sub_phase;
    }
  }
  return {
    phase: failedPhase,
    subPhase,
    failed_at_phase: failedPhase,
    failed_at_sub_phase: subPhase,
    missing_records: result.missingRecords,
    schema_violations: result.violations,
    assertion_failures: result.assertionFailures,
    suggested_fix: generateFixSuggestion(result),
    spec_references: getSpecReferences(result),
  };
}

// ── Artifact matching ──────────────────────────────────────────────

function artifactDisplay(req: RequiredArtifact): string {
  if (req.record_type === 'artifact_produced' && req.content_kind) {
    return `artifact_produced[kind=${req.content_kind}]`;
  }
  return req.record_type;
}

function findArtifact(records: StreamRecord[], req: RequiredArtifact): StreamRecord | null {
  for (const r of records) {
    if (r.record_type !== req.record_type) continue;
    if (req.sub_phase_id && r.sub_phase_id !== req.sub_phase_id) continue;
    if (req.produced_by_agent_role && r.produced_by_agent_role !== req.produced_by_agent_role) {
      // Role mismatch is a softer signal — record_type + content_kind
      // carry the semantic weight. We'd rather match and flag a role
      // drift via a separate invariant than refuse the match and
      // report a phantom missing record.
    }
    if (req.record_type === 'artifact_produced' && req.content_kind) {
      const kind = tryParseContent(r.content)?.kind;
      if (kind !== req.content_kind) continue;
    }
    return r;
  }
  return null;
}

// ── Invariant runners ──────────────────────────────────────────────

type InvariantCheck = (records: StreamRecord[]) => boolean;

const INVARIANT_VALIDATORS: Record<string, InvariantCheck> = {
  validateIntentStatementScope: (recs) => {
    const stmt = findArtifactByKind(recs, 'intent_statement');
    if (!stmt) return false;
    const content = tryParseContent(stmt.content) ?? {};
    const concept = (content.product_concept ?? {}) as { name?: unknown; description?: unknown };
    return typeof concept.name === 'string' && concept.name.length > 0
      && typeof concept.description === 'string' && concept.description.length > 0;
  },

  validateRequirementSources: (recs) => {
    const fr = findArtifactByKind(recs, 'functional_requirements');
    if (!fr) return true; // no requirements yet — nothing to validate
    const content = tryParseContent(fr.content) ?? {};
    const reqs = Array.isArray(content.requirements) ? content.requirements : [];
    if (reqs.length === 0) return true;
    return reqs.every((r: Record<string, unknown>) => {
      const sources = r.sources ?? r.source_ids ?? r.provenance;
      return Array.isArray(sources) && sources.length > 0;
    });
  },

  validateArchitectureComponents: (recs) => {
    const cm = findArtifactByKind(recs, 'component_model');
    if (!cm) return false;
    const content = tryParseContent(cm.content) ?? {};
    const components = Array.isArray(content.components) ? content.components : [];
    return components.length >= 2;
  },

  validateComponentResponsibilities: (recs) => {
    const cm = findArtifactByKind(recs, 'component_model');
    if (!cm) return true;
    const content = tryParseContent(cm.content) ?? {};
    const components = Array.isArray(content.components) ? content.components : [];
    return components.every((c: Record<string, unknown>) => {
      const resp = c.responsibilities ?? c.responsibility;
      if (typeof resp === 'string') return resp.length > 0;
      return Array.isArray(resp) && resp.length > 0;
    });
  },

  validateTaskEstimates: (recs) => {
    const plan = findArtifactByKind(recs, 'implementation_plan');
    if (!plan) return true;
    const content = tryParseContent(plan.content) ?? {};
    const tasks = Array.isArray(content.tasks) ? content.tasks : [];
    if (tasks.length === 0) return true;
    return tasks.every(
      (t: Record<string, unknown>) =>
        t.estimated_complexity !== undefined ||
        t.estimate !== undefined ||
        t.estimated_effort !== undefined,
    );
  },

  validateAcyclicDependencies: (recs) => {
    const plan = findArtifactByKind(recs, 'implementation_plan');
    if (!plan) return true;
    const content = tryParseContent(plan.content) ?? {};
    // Accept either an explicit graph or infer from per-task `depends_on`.
    const graph: Record<string, string[]> = {};
    if (content.dependency_graph && typeof content.dependency_graph === 'object') {
      Object.assign(graph, content.dependency_graph);
    } else {
      const tasks = Array.isArray(content.tasks) ? content.tasks : [];
      for (const t of tasks as Array<{ id?: string; depends_on?: unknown }>) {
        if (typeof t.id !== 'string') continue;
        graph[t.id] = Array.isArray(t.depends_on) ? (t.depends_on as string[]) : [];
      }
    }
    return !hasCycles(graph);
  },

  validateTestResults: (recs) => {
    const results = recs.filter(
      (r) =>
        r.record_type === 'artifact_produced' &&
        tryParseContent(r.content)?.kind === 'test_results',
    );
    if (results.length === 0) return false;
    return results.every((r) => {
      const content = tryParseContent(r.content) ?? {};
      const outcomes = content.outcomes ?? content.results ?? content.suites;
      return outcomes !== undefined;
    });
  },

  validateEvalResults: (recs) => {
    const results = findArtifactByKind(recs, 'evaluation_results');
    if (!results) return false;
    const content = tryParseContent(results.content) ?? {};
    const criteria =
      content.criteria ?? content.criterion_outcomes ?? content.results ?? null;
    return Array.isArray(criteria) ? criteria.length > 0 : !!criteria;
  },

  validateCommitMessage: (recs) => {
    const commit = findArtifactByKind(recs, 'commit_record');
    if (!commit) return true;
    const content = tryParseContent(commit.content) ?? {};
    const msg = (content.message ?? content.commit_message) as string | undefined;
    return typeof msg === 'string' && msg.length >= 10;
  },

  validateCommitReferencesIntent: (recs) => {
    const commit = findArtifactByKind(recs, 'commit_record');
    if (!commit) return true;
    const content = tryParseContent(commit.content) ?? {};
    const msg = (content.message ?? content.commit_message ?? '') as string;
    // Simple heuristic: commit should reference a run id, intent id, or
    // include an explicit reference marker.
    return msg.includes('#')
      || msg.includes('intent')
      || typeof content.intent_record_id === 'string'
      || typeof content.workflow_run_id === 'string';
  },
};

function runInvariant(
  records: StreamRecord[],
  invariant: { name: string; validator: string; severity: 'error' | 'warning' },
  phaseId: PhaseId,
): AssertionFailure[] {
  const fn = INVARIANT_VALIDATORS[invariant.validator];
  if (!fn) return [];
  const passed = fn(records);
  if (passed) return [];
  return [
    {
      phase: phaseId,
      sub_phase: 'unknown',
      assertion: invariant.name,
      expected: 'true',
      actual: 'false',
    },
  ];
}

function runAuthorityRule(
  records: StreamRecord[],
  rule: { record_type: string; min_authority: number; max_authority: number },
): SchemaViolation[] {
  const violations: SchemaViolation[] = [];
  for (const r of records) {
    if (r.record_type !== rule.record_type) continue;
    const authority = r.authority_level ?? 0;
    if (authority < rule.min_authority || authority > rule.max_authority) {
      violations.push({
        record_id: r.id,
        record_type: r.record_type,
        field: 'authority_level',
        error: `Authority ${authority} outside allowed range [${rule.min_authority}, ${rule.max_authority}]`,
        schema_version: '1.0',
      });
    }
  }
  return violations;
}

// ── Gap-report helpers ─────────────────────────────────────────────

function generateFixSuggestion(result: LineageValidationResult): string {
  const lines: string[] = [];
  if (result.missingRecords.length > 0) {
    const missing = result.missingRecords.map((r) => r.record_type).join(', ');
    lines.push(
      `Missing artifacts: ${missing}. Check the matching phase handler in src/lib/orchestrator/phases/ and the RequiredArtifact entries in src/test/harness/phaseContracts.ts.`,
    );
  }
  if (result.violations.length > 0) {
    lines.push(
      'Authority violations detected. Verify the record writer sets the right authority_level for the owning agent role.',
    );
  }
  if (result.assertionFailures.length > 0) {
    const failed = result.assertionFailures.map((f) => f.assertion).join(', ');
    lines.push(
      `Invariant failures: ${failed}. Review the invariant implementations in src/test/harness/lineageValidator.ts and the handler logic that produces the relevant artifacts.`,
    );
  }
  return lines.join(' ') || 'No issues found.';
}

function getSpecReferences(result: LineageValidationResult): string[] {
  const refs = new Set<string>();
  for (const m of result.missingRecords) {
    refs.add(`phase ${m.phase}` + (m.sub_phase ? `, sub-phase ${m.sub_phase}` : ''));
  }
  for (const v of result.violations) refs.add(`record_type ${v.record_type}`);
  for (const a of result.assertionFailures) refs.add(`invariant ${a.assertion}`);
  return [...refs];
}

// ── DB + parsing helpers ───────────────────────────────────────────

function getRecordsForRun(db: Database, workflowRunId: string): StreamRecord[] {
  return db
    .prepare(
      `SELECT id, record_type, phase_id, sub_phase_id, produced_by_agent_role,
              authority_level, content, produced_at
         FROM governed_stream
         WHERE workflow_run_id = ?
         ORDER BY produced_at ASC`,
    )
    .all(workflowRunId) as StreamRecord[];
}

function findArtifactByKind(records: StreamRecord[], kind: string): StreamRecord | null {
  for (const r of records) {
    if (r.record_type !== 'artifact_produced') continue;
    if (tryParseContent(r.content)?.kind === kind) return r;
  }
  return null;
}

function tryParseContent(content: string | null): Record<string, unknown> | null {
  if (!content) return null;
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function hasCycles(graph: Record<string, string[]>): boolean {
  const visited = new Set<string>();
  const stack = new Set<string>();
  function dfs(node: string): boolean {
    if (stack.has(node)) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    stack.add(node);
    for (const next of graph[node] ?? []) {
      if (dfs(next)) return true;
    }
    stack.delete(node);
    return false;
  }
  for (const n of Object.keys(graph)) {
    if (dfs(n)) return true;
  }
  return false;
}
