/**
 * Deterministic delta-mode synthesizers for Phase 6 / 7 / 8 re-entry.
 *
 * When the cycle_controller routes a workflow back to Phase 6/7/8, the
 * arriving phase must SYNTHESIZE the missing artifacts the seed
 * identifies — without re-running the heavy LLM proposer pipeline.
 *
 * In this push the synthesis is deterministic: one synthetic task per
 * orphan user story, one synthetic test per orphan AC, one synthetic
 * eval criterion per orphan US/NFR. Each carries enough structure to
 * pass the coherence verifier (correct ids, correct trace fields,
 * non-empty description). Subsequent passes can REPLACE this with
 * LLM-driven refinement; the closed-loop self-healing works today.
 *
 * Pure functions: take existing artifacts + seed, return EXTENDED
 * artifacts. No DB writes — the phase handler persists the result.
 */

import type { CycleRestartSeed } from './cycleSeed';
import { canonicalComponentDir } from './layoutContract';

// ── Phase 6 delta — synthesize tasks for orphan user stories ──────

export interface PhaseSixTask {
  id: string;
  name: string;
  description: string;
  task_type: string;
  component_id: string;
  component_responsibility: string;
  backing_tool: string;
  estimated_complexity: 'low' | 'medium' | 'high';
  completion_criteria: Array<{
    criterion_id: string;
    description: string;
    verification_method: string;
    artifact_ref?: string;
  }>;
  write_directory_paths: string[];
  read_directory_paths: string[];
  dependency_task_ids: string[];
  traces_to: string[];
}

export interface PhaseSixSynthInput {
  existingTasks: PhaseSixTask[];
  seed: CycleRestartSeed;
  userStoriesById: Map<string, { id: string; role?: string; action?: string; outcome?: string }>;
  /** Default component id to attach delta tasks to when no upstream
   * component is implied. Phase 6 picks the first component_skeleton
   * component as the fallback. */
  defaultComponentId: string;
}

/**
 * Slugify a US action for use in a synthetic task id.
 */
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'task';
}

export function synthesizeDeltaTasks(input: PhaseSixSynthInput): PhaseSixTask[] {
  if (input.seed.orphanUserStoryIds.size === 0) return [];

  const existingTraces = new Set<string>();
  for (const t of input.existingTasks) {
    for (const r of t.traces_to ?? []) existingTraces.add(r);
  }

  const newTasks: PhaseSixTask[] = [];
  for (const usId of input.seed.orphanUserStoryIds) {
    // Idempotency: skip if some existing task already traces to this US.
    if (existingTraces.has(usId)) continue;
    const us = input.userStoriesById.get(usId);
    const action = us?.action ?? 'fulfill user story';
    const slug = slugify(`${usId}-${action}`);
    newTasks.push({
      id: `task-delta-${slug}`,
      name: `Implement ${usId} — ${action}`,
      description:
        us
          ? `Implement the behavior described by ${usId}: as a ${us.role ?? 'user'}, I want to ${action}, so that ${us.outcome ?? 'the outcome is achieved'}.`
          : `Implement the behavior described by ${usId}.`,
      task_type: 'standard',
      component_id: input.defaultComponentId,
      component_responsibility: `Realise user story ${usId}`,
      backing_tool: 'claude_code_cli',
      estimated_complexity: 'medium',
      completion_criteria: [{
        criterion_id: `CC-${slug}`,
        description: `All acceptance criteria of ${usId} hold true`,
        verification_method: 'test_execution',
      }],
      write_directory_paths: [canonicalComponentDir(input.defaultComponentId, 'src')],
      read_directory_paths: [],
      dependency_task_ids: [],
      traces_to: [usId],
    });
  }
  return newTasks;
}

// ── Phase 7 delta — synthesize test cases for orphan ACs ───────────

export interface PhaseSevenTestCase {
  test_case_id: string;
  type: string;
  acceptance_criterion_ids: string[];
  preconditions: string[];
  expected_outcome: string;
}

export interface PhaseSevenTestSuite {
  suite_id: string;
  component_id: string;
  test_type: string;
  test_cases: PhaseSevenTestCase[];
}

export interface PhaseSevenSynthInput {
  existingSuites: PhaseSevenTestSuite[];
  seed: CycleRestartSeed;
  /** AC lookup so the synthesized test's `expected_outcome` can mirror the AC's measurable_condition where present. */
  acsByCompositeId: Map<string, { description?: string; measurable_condition?: string }>;
  /** Default component id for the synthetic suite. */
  defaultComponentId: string;
}

export interface PhaseSevenSynthResult {
  /** Newly-synthesized suite (or extension of the existing delta suite). */
  newSuite: PhaseSevenTestSuite | null;
}

export function synthesizeDeltaTestCases(input: PhaseSevenSynthInput): PhaseSevenSynthResult {
  if (input.seed.orphanAcceptanceCriteria.length === 0) return { newSuite: null };

  // Idempotency: aggregate AC ids already covered by some test case.
  const coveredAcIds = new Set<string>();
  for (const suite of input.existingSuites) {
    for (const tc of suite.test_cases ?? []) {
      for (const r of tc.acceptance_criterion_ids ?? []) coveredAcIds.add(r);
    }
  }

  const newCases: PhaseSevenTestCase[] = [];
  let idx = 1;
  for (const { usId, acId } of input.seed.orphanAcceptanceCriteria) {
    // Match either bare AC id or composite (us-ac) — verifier uses both.
    if (coveredAcIds.has(acId) || coveredAcIds.has(`${usId}-${acId}`)) continue;
    const composite = `${usId}/${acId}`;
    const ac = input.acsByCompositeId.get(composite);
    const expected = ac?.measurable_condition ?? ac?.description ?? `${acId} holds true`;
    newCases.push({
      test_case_id: `TC-delta-${idx++}`,
      type: 'functional',
      acceptance_criterion_ids: [acId],
      preconditions: ['System is deployed and reachable'],
      expected_outcome: expected,
    });
  }
  if (newCases.length === 0) return { newSuite: null };

  return {
    newSuite: {
      suite_id: 'suite-delta',
      component_id: input.defaultComponentId,
      test_type: 'integration',
      test_cases: newCases,
    },
  };
}

// ── Phase 8 delta — synthesize eval criteria for orphan US/NFR ──────

export interface PhaseEightCriterion {
  /**
   * The natural field — Phase 8 functional plan uses
   * `functional_requirement_id`; quality plan uses
   * `nonfunctional_requirement_id`. The synthesizer emits both pools
   * (functional + quality) based on whether the target id looks like
   * a US-* (functional) or NFR-* (quality).
   */
  functional_requirement_id?: string;
  nonfunctional_requirement_id?: string;
  evaluation_method: string;
  success_condition: string;
}

export interface PhaseEightSynthInput {
  existingFunctional: PhaseEightCriterion[];
  existingQuality: PhaseEightCriterion[];
  seed: CycleRestartSeed;
  /** Lookup so synthesized criteria reference the actual measurable thresholds where present. */
  acsByUsId: Map<string, Array<{ id: string; measurable_condition?: string }>>;
}

export interface PhaseEightSynthResult {
  newFunctional: PhaseEightCriterion[];
  newQuality: PhaseEightCriterion[];
}

export function synthesizeDeltaEvaluations(input: PhaseEightSynthInput): PhaseEightSynthResult {
  if (input.seed.orphanEvaluationTargets.size === 0) {
    return { newFunctional: [], newQuality: [] };
  }

  // Idempotency: aggregate target_ids already covered.
  const covered = new Set<string>();
  for (const c of input.existingFunctional) {
    if (c.functional_requirement_id) covered.add(c.functional_requirement_id);
  }
  for (const c of input.existingQuality) {
    if (c.nonfunctional_requirement_id) covered.add(c.nonfunctional_requirement_id);
    if (c.functional_requirement_id) covered.add(c.functional_requirement_id);
  }

  const newFunctional: PhaseEightCriterion[] = [];
  const newQuality: PhaseEightCriterion[] = [];

  for (const targetId of input.seed.orphanEvaluationTargets) {
    if (covered.has(targetId)) continue;
    const isFunctional = /^US[-_]/.test(targetId) || !/^NFR[-_]/.test(targetId);
    const acs = input.acsByUsId.get(targetId) ?? [];
    const successCondition = acs.length > 0
      ? `Implementation satisfies all ${acs.length} acceptance criteria of ${targetId} (${acs.map((a) => a.id).join(', ')})`
      : `Implementation satisfies the behavior described by ${targetId} as verified by its tests passing`;
    const method = isFunctional
      ? 'Run tests bound to this user story and verify they pass'
      : 'Run quality probes and verify thresholds are met';
    if (isFunctional) {
      newFunctional.push({
        functional_requirement_id: targetId,
        evaluation_method: method,
        success_condition: successCondition,
      });
    } else {
      newQuality.push({
        nonfunctional_requirement_id: targetId,
        evaluation_method: method,
        success_condition: successCondition,
      });
    }
  }

  return { newFunctional, newQuality };
}
