/**
 * Characterization tests for the Phase 9.0a orchestration wrapper
 * (runModuleOwnershipPlanningSubPhase). These pin the wrapper's CURRENT
 * observable behavior prior to an internal decomposition refactor (S3776
 * cognitive-complexity reduction):
 *
 *   - It reads the governed stream (artifact_produced + decomposition nodes),
 *     builds the effective task/component views, maps them into planner inputs,
 *     resolves the shared_dir, derives the ownership plan, and PERSISTS it as a
 *     `module_ownership_plan` artifact (record_type 'artifact_produced').
 *   - With NO records it still returns (and persists) an empty plan
 *     (shared_modules: [], ordering_edges: []) — never null on the happy path.
 *   - With a component_model (sync_call graph) + implementation_plan (read-path
 *     demand) and no data models, a cross-component repository resolves its
 *     owner to the dependency-sink hub, in that hub's own directory, and emits
 *     producer-before-consumer ordering edges.
 *
 * The pure derivation itself (buildModuleOwnershipPlan) is exhaustively covered
 * in moduleOwnershipPlanner.test.ts; this file pins the extract→map→persist
 * plumbing the wrapper adds on top.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestEngine, type TestEngine } from '../../../helpers/createTestEngine';
import { runModuleOwnershipPlanningSubPhase } from '../../../../lib/orchestrator/phases/moduleOwnershipPlanner';
import type { ModuleOwnershipPlan } from '../../../../lib/orchestrator/phases/moduleOwnershipPlanner';
import type { OrchestratorEngine } from '../../../../lib/orchestrator/orchestratorEngine';

const RUN = 'own-plan-run';

function writeArtifact(engine: OrchestratorEngine, content: Record<string, unknown>): void {
  engine.writer.writeRecord({
    record_type: 'artifact_produced',
    schema_version: '1.0',
    workflow_run_id: RUN,
    janumicode_version_sha: 'sha',
    content,
  });
}

function persistedPlans(engine: OrchestratorEngine): Array<Record<string, unknown>> {
  return engine.writer
    .getRecordsByType(RUN, 'artifact_produced')
    .map((r) => r.content as Record<string, unknown>)
    .filter((c) => c.kind === 'module_ownership_plan');
}

function run(engine: OrchestratorEngine): ModuleOwnershipPlan | null {
  const workflowRun = engine.stateMachine.getWorkflowRun(RUN)!;
  return runModuleOwnershipPlanningSubPhase({ workflowRun, engine });
}

describe('runModuleOwnershipPlanningSubPhase (characterization)', () => {
  let te: TestEngine;
  let engine: OrchestratorEngine;

  beforeEach(async () => {
    te = await createTestEngine({ autoApprove: true });
    engine = te.engine;
    engine.stateMachine.createWorkflowRun({ id: RUN, workspace_id: 'ws', janumicode_version_sha: 'sha' });
  });
  afterEach(() => te.cleanup());

  it('returns AND persists an empty plan when the governed stream has no inputs', () => {
    const plan = run(engine);
    expect(plan).not.toBeNull();
    expect(plan!.kind).toBe('module_ownership_plan');
    expect(plan!.schemaVersion).toBe('1.0');
    expect(plan!.shared_modules).toEqual([]);
    expect(plan!.ordering_edges).toEqual([]);

    // The plan is persisted as a module_ownership_plan artifact.
    const persisted = persistedPlans(engine);
    expect(persisted).toHaveLength(1);
    expect((persisted[0].shared_modules as unknown[])).toEqual([]);
    expect((persisted[0].ordering_edges as unknown[])).toEqual([]);
  });

  it('resolves a cross-component repository to the dependency-sink hub and emits ordering edges', () => {
    // component_model: comp-a and comp-b both sync_call the hub (comp-hub).
    writeArtifact(engine, {
      kind: 'component_model',
      components: [
        { id: 'comp-hub', dependencies: [] },
        { id: 'comp-a', dependencies: [{ target_component_id: 'comp-hub', dependency_type: 'sync_call' }] },
        { id: 'comp-b', dependencies: [{ target_component_id: 'comp-hub', dependency_type: 'sync_call' }] },
      ],
    });
    // implementation_plan: both comp-a and comp-b read the same repository →
    // it is a shared module demanded by ≥2 distinct components.
    writeArtifact(engine, {
      kind: 'implementation_plan',
      tasks: [
        { id: 't1', component_id: 'comp-a', read_directory_paths: ['src/repositories/thing_repository'] },
        { id: 't2', component_id: 'comp-b', read_directory_paths: ['src/repositories/thing_repository'] },
      ],
    });

    const plan = run(engine);
    expect(plan).not.toBeNull();

    const mod = plan!.shared_modules.find((m) => m.basename === 'thing_repository');
    expect(mod).toBeDefined();
    // No data models → owner resolves to the hub every consumer depends on.
    expect(mod!.owner_component_id).toBe('comp-hub');
    expect(mod!.owner_source).toBe('sync_call_sink');
    // Placed in the hub's own directory (comp- prefix stripped), node stack.
    expect(mod!.canonical_path).toBe('src/hub/thing_repository.ts');
    expect(mod!.import_specifier).toBe('@/hub/thing_repository');
    expect(mod!.consumer_component_ids).toEqual(['comp-a', 'comp-b']);

    // Producer-before-consumer: hub precedes each consumer.
    const afters = new Set(
      plan!.ordering_edges
        .filter((e) => e.before_component_id === 'comp-hub')
        .map((e) => e.after_component_id),
    );
    expect(afters.has('comp-a')).toBe(true);
    expect(afters.has('comp-b')).toBe(true);
    expect(afters.has('comp-hub')).toBe(false); // no self-edge

    // Persisted plan mirrors the returned plan.
    const persisted = persistedPlans(engine);
    expect(persisted).toHaveLength(1);
    expect((persisted[0].shared_modules as unknown[]).length).toBe(plan!.shared_modules.length);
    expect((persisted[0].ordering_edges as unknown[]).length).toBe(plan!.ordering_edges.length);
  });
});
