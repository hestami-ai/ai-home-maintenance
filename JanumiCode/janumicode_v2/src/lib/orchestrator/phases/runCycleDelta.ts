/**
 * Cycle-delta runners for Phase 6 / 7 / 8.
 *
 * When a phase's `execute(ctx)` detects that this invocation is a
 * cycle-restart (workflowRun.current_cycle_number > 0), it delegates to
 * one of these runners instead of executing the normal LLM-driven
 * synthesis pipeline. The runner:
 *
 *   1. Reads the latest packet_synthesis_failure record and builds the
 *      cycle-restart seed.
 *   2. Reads the existing artifact for this phase (task_skeleton /
 *      test_case_skeleton / evaluation_design + metrics).
 *   3. Synthesizes deterministic delta entries (via cycleDeltaSynthesizers).
 *   4. Writes a new artifact_produced record (the old one's row stays
 *      in the stream; writeRecord superseds is_current_version on prior
 *      versions of the same record kind via the supersession path).
 *   5. Returns a PhaseResult so the orchestrator advances forward.
 *
 * The runner is idempotent: re-running with no new orphans produces no
 * new artifacts (delta synthesizers skip already-covered ids).
 *
 * Pure side effect: writeRecord. No LLM calls.
 */

import { getLogger } from '../../logging';
import type { PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { GovernedStreamRecord } from '../../types/records';
import { buildCycleRestartSeed, isSeedEmpty } from './cycleSeed';
import {
  synthesizeDeltaTasks,
  synthesizeDeltaTestCases,
  synthesizeDeltaEvaluations,
  type PhaseSixTask,
  type PhaseSevenTestSuite,
  type PhaseEightCriterion,
} from './cycleDeltaSynthesizers';
import { buildRequirementLineage } from './packetSynthesis/idResolution';

/**
 * Collapse each functional criterion's `functional_requirement_id` to its
 * decomposition-tree root and dedupe by (root, evaluation_method). Mirrors
 * phase8.ts's canonicalizeFunctionalEvalTargets over the PhaseEightCriterion
 * shape (optional id fields) used on the cycle-delta path — which previously
 * skipped this normalization and persisted raw-leaf targets (US-012-02-D) the
 * P4 join could not bridge to a sibling-leaf packet (cal-41 US-012-01-*).
 * Structural walk via the requirement lineage — never a regex.
 */
function canonicalizeCycleDeltaFunctionalTargets(
  criteria: PhaseEightCriterion[],
  canonicalize: (id: string) => string,
): PhaseEightCriterion[] {
  const seen = new Set<string>();
  const out: PhaseEightCriterion[] = [];
  for (const c of criteria) {
    if (!c.functional_requirement_id) {
      out.push(c);
      continue;
    }
    const target = canonicalize(c.functional_requirement_id);
    const key = `${target}::${c.evaluation_method}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...c, functional_requirement_id: target });
  }
  return out;
}

// ── Helpers ────────────────────────────────────────────────────────

function loadLatestArtifact<T>(
  ctx: PhaseContext,
  subPhaseId: string,
  kind: string,
): { record: GovernedStreamRecord; content: T } | null {
  const all = ctx.engine.writer.getRecordsByType(ctx.workflowRun.id, 'artifact_produced');
  for (let i = all.length - 1; i >= 0; i--) {
    const r = all[i];
    if (r.sub_phase_id !== subPhaseId) continue;
    const c = r.content as unknown as { kind?: string };
    if (c?.kind === kind) return { record: r, content: c as unknown as T };
  }
  return null;
}

function fetchAllUserStories(ctx: PhaseContext): Array<{ id: string; role?: string; action?: string; outcome?: string }> {
  const fr = loadLatestArtifact<{ user_stories?: Array<{ id: string; role?: string; action?: string; outcome?: string }> }>(
    ctx, 'fr_bloom_skeleton', 'functional_requirements',
  );
  return fr?.content.user_stories ?? [];
}

function fetchAcsByCompositeId(ctx: PhaseContext): Map<string, { description?: string; measurable_condition?: string }> {
  const fr = loadLatestArtifact<{
    user_stories?: Array<{
      id: string;
      acceptance_criteria?: Array<{ id?: string; description?: string; measurable_condition?: string }>;
    }>;
  }>(ctx, 'fr_bloom_skeleton', 'functional_requirements');
  const out = new Map<string, { description?: string; measurable_condition?: string }>();
  for (const us of fr?.content.user_stories ?? []) {
    for (const ac of us.acceptance_criteria ?? []) {
      if (!ac.id) continue;
      out.set(`${us.id}/${ac.id}`, {
        description: ac.description,
        measurable_condition: ac.measurable_condition,
      });
    }
  }
  return out;
}

function fetchAcsByUsId(ctx: PhaseContext): Map<string, Array<{ id: string; measurable_condition?: string }>> {
  const fr = loadLatestArtifact<{
    user_stories?: Array<{
      id: string;
      acceptance_criteria?: Array<{ id?: string; measurable_condition?: string }>;
    }>;
  }>(ctx, 'fr_bloom_skeleton', 'functional_requirements');
  const out = new Map<string, Array<{ id: string; measurable_condition?: string }>>();
  for (const us of fr?.content.user_stories ?? []) {
    const list = (us.acceptance_criteria ?? [])
      .map((ac) => ({ id: ac.id ?? '', measurable_condition: ac.measurable_condition }))
      .filter((a) => a.id);
    out.set(us.id, list);
  }
  return out;
}

function buildSeed(ctx: PhaseContext) {
  const failureRecords = ctx.engine.writer.getRecordsByType(ctx.workflowRun.id, 'packet_synthesis_failure');
  const packetRecords = ctx.engine.writer.getRecordsByType(ctx.workflowRun.id, 'implementation_packet');
  const userStories = fetchAllUserStories(ctx);
  return buildCycleRestartSeed(failureRecords, packetRecords, userStories);
}

function defaultComponentId(ctx: PhaseContext): string {
  const comp = loadLatestArtifact<{ components?: Array<{ id?: string }> }>(
    ctx, 'component_skeleton', 'component_model',
  );
  return comp?.content.components?.[0]?.id ?? 'comp-001';
}

// ── Phase 6 delta runner ───────────────────────────────────────────

export function runPhase6CycleDelta(ctx: PhaseContext): PhaseResult {
  const { workflowRun, engine } = ctx;
  engine.stateMachine.setSubPhase(workflowRun.id, 'task_skeleton');
  const logger = getLogger();
  const seed = buildSeed(ctx);
  if (isSeedEmpty(seed)) {
    logger.info('workflow', 'Phase 6 cycle-delta: empty seed; no-op', { workflow_run_id: workflowRun.id });
    return { success: true, artifactIds: [] };
  }

  const existing = loadLatestArtifact<{ kind: 'implementation_plan'; tasks: PhaseSixTask[]; total_tasks?: number; complexity_flagged_count?: number; refactoring_tasks_included?: boolean }>(
    ctx, 'task_skeleton', 'implementation_plan',
  );
  if (!existing) {
    logger.warn('workflow', 'Phase 6 cycle-delta: no existing implementation_plan found; skipping delta', {
      workflow_run_id: workflowRun.id,
    });
    return { success: true, artifactIds: [] };
  }

  const userStoriesById = new Map<string, { id: string; role?: string; action?: string; outcome?: string }>();
  for (const us of fetchAllUserStories(ctx)) userStoriesById.set(us.id, us);

  const deltaTasks = synthesizeDeltaTasks({
    existingTasks: existing.content.tasks ?? [],
    seed,
    userStoriesById,
    defaultComponentId: defaultComponentId(ctx),
  });
  if (deltaTasks.length === 0) {
    logger.info('workflow', 'Phase 6 cycle-delta: all orphan US already covered; no-op', { workflow_run_id: workflowRun.id });
    return { success: true, artifactIds: [] };
  }

  const merged = {
    kind: 'implementation_plan' as const,
    tasks: [...(existing.content.tasks ?? []), ...deltaTasks],
    total_tasks: (existing.content.total_tasks ?? existing.content.tasks?.length ?? 0) + deltaTasks.length,
    complexity_flagged_count: existing.content.complexity_flagged_count ?? 0,
    refactoring_tasks_included: existing.content.refactoring_tasks_included ?? false,
  };

  const newRec = engine.writer.writeRecord({
    record_type: 'artifact_produced',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '6',
    sub_phase_id: 'task_skeleton',
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [existing.record.id],
    content: merged as unknown as Record<string, unknown>,
  });
  engine.writer.supersedByRollback(existing.record.id, newRec.id);

  logger.info('workflow', 'Phase 6 cycle-delta: synthesized delta tasks', {
    workflow_run_id: workflowRun.id,
    delta_count: deltaTasks.length,
    new_total: merged.total_tasks,
  });
  return { success: true, artifactIds: [newRec.id] };
}

// ── Phase 7 delta runner ───────────────────────────────────────────

export function runPhase7CycleDelta(ctx: PhaseContext): PhaseResult {
  const { workflowRun, engine } = ctx;
  engine.stateMachine.setSubPhase(workflowRun.id, 'test_case_skeleton');
  const logger = getLogger();
  const seed = buildSeed(ctx);
  if (isSeedEmpty(seed)) {
    logger.info('workflow', 'Phase 7 cycle-delta: empty seed; no-op', { workflow_run_id: workflowRun.id });
    return { success: true, artifactIds: [] };
  }

  const existing = loadLatestArtifact<{ kind: 'test_plan'; test_suites: PhaseSevenTestSuite[]; total_test_cases?: number; coverage_by_type?: Record<string, number> }>(
    ctx, 'test_case_skeleton', 'test_plan',
  );
  if (!existing) {
    logger.warn('workflow', 'Phase 7 cycle-delta: no existing test_plan found; skipping delta', { workflow_run_id: workflowRun.id });
    return { success: true, artifactIds: [] };
  }

  const synth = synthesizeDeltaTestCases({
    existingSuites: existing.content.test_suites ?? [],
    seed,
    acsByCompositeId: fetchAcsByCompositeId(ctx),
    defaultComponentId: defaultComponentId(ctx),
  });
  if (!synth.newSuite) {
    logger.info('workflow', 'Phase 7 cycle-delta: all orphan ACs already covered; no-op', { workflow_run_id: workflowRun.id });
    return { success: true, artifactIds: [] };
  }

  // Merge — if a suite with the same suite_id already exists (re-running
  // a delta cycle), extend it; otherwise append.
  const suites = [...(existing.content.test_suites ?? [])];
  const existingDeltaSuite = suites.find((s) => s.suite_id === synth.newSuite!.suite_id);
  if (existingDeltaSuite) {
    existingDeltaSuite.test_cases.push(...synth.newSuite.test_cases);
  } else {
    suites.push(synth.newSuite);
  }
  const totalTestCases = suites.reduce((n, s) => n + (s.test_cases?.length ?? 0), 0);
  const merged = {
    kind: 'test_plan' as const,
    test_suites: suites,
    total_test_cases: totalTestCases,
    coverage_by_type: existing.content.coverage_by_type ?? {},
  };

  const newRec = engine.writer.writeRecord({
    record_type: 'artifact_produced',
    schema_version: '1.0',
    workflow_run_id: workflowRun.id,
    phase_id: '7',
    sub_phase_id: 'test_case_skeleton',
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: [existing.record.id],
    content: merged as unknown as Record<string, unknown>,
  });
  engine.writer.supersedByRollback(existing.record.id, newRec.id);

  logger.info('workflow', 'Phase 7 cycle-delta: synthesized delta test cases', {
    workflow_run_id: workflowRun.id,
    delta_count: synth.newSuite.test_cases.length,
    new_total: totalTestCases,
  });
  return { success: true, artifactIds: [newRec.id] };
}

// ── Phase 8 delta runner ───────────────────────────────────────────

export function runPhase8CycleDelta(ctx: PhaseContext): PhaseResult {
  const { workflowRun, engine } = ctx;
  engine.stateMachine.setSubPhase(workflowRun.id, 'evaluation_design');
  const logger = getLogger();
  const seed = buildSeed(ctx);
  if (isSeedEmpty(seed)) {
    logger.info('workflow', 'Phase 8 cycle-delta: empty seed; no-op', { workflow_run_id: workflowRun.id });
    return { success: true, artifactIds: [] };
  }

  const existingFn = loadLatestArtifact<{ kind: 'functional_evaluation_plan'; criteria: PhaseEightCriterion[] }>(
    ctx, 'evaluation_design', 'functional_evaluation_plan',
  );
  const existingQl = loadLatestArtifact<{ kind: 'quality_evaluation_plan'; criteria: PhaseEightCriterion[] }>(
    ctx, 'evaluation_metrics', 'quality_evaluation_plan',
  );

  const synth = synthesizeDeltaEvaluations({
    existingFunctional: existingFn?.content.criteria ?? [],
    existingQuality: existingQl?.content.criteria ?? [],
    seed,
    acsByUsId: fetchAcsByUsId(ctx),
  });
  if (synth.newFunctional.length === 0 && synth.newQuality.length === 0) {
    logger.info('workflow', 'Phase 8 cycle-delta: all orphan eval targets already covered; no-op', { workflow_run_id: workflowRun.id });
    return { success: true, artifactIds: [] };
  }

  const artifactIds: string[] = [];

  if (synth.newFunctional.length > 0) {
    // Producer-side normalization (mirrors phase8.ts:166): collapse every
    // functional eval target to its decomposition-tree root so a packet
    // carrying a DIFFERENT leaf of the same story is satisfied at root. The
    // cycle-delta path previously merged raw-leaf targets straight through,
    // persisting US-012-02-D-style ids the P4 join could not bridge to
    // sibling-leaf packets (cal-41 US-012-01-*). Idempotent on already-root ids.
    const canonicalize = buildRequirementLineage(
      engine.writer.getRecordsByType(workflowRun.id, 'requirement_decomposition_node'),
    ).canonicalize;
    const merged = {
      kind: 'functional_evaluation_plan' as const,
      criteria: canonicalizeCycleDeltaFunctionalTargets(
        [...(existingFn?.content.criteria ?? []), ...synth.newFunctional],
        canonicalize,
      ),
    };
    const rec = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '8',
      sub_phase_id: 'evaluation_design',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: existingFn ? [existingFn.record.id] : [],
      content: merged as unknown as Record<string, unknown>,
    });
    if (existingFn) engine.writer.supersedByRollback(existingFn.record.id, rec.id);
    artifactIds.push(rec.id);
  }

  if (synth.newQuality.length > 0) {
    const merged = {
      kind: 'quality_evaluation_plan' as const,
      criteria: [...(existingQl?.content.criteria ?? []), ...synth.newQuality],
    };
    const rec = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '8',
      sub_phase_id: 'evaluation_metrics',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: existingQl ? [existingQl.record.id] : [],
      content: merged as unknown as Record<string, unknown>,
    });
    if (existingQl) engine.writer.supersedByRollback(existingQl.record.id, rec.id);
    artifactIds.push(rec.id);
  }

  logger.info('workflow', 'Phase 8 cycle-delta: synthesized delta evaluations', {
    workflow_run_id: workflowRun.id,
    functional_count: synth.newFunctional.length,
    quality_count: synth.newQuality.length,
  });
  return { success: true, artifactIds };
}
