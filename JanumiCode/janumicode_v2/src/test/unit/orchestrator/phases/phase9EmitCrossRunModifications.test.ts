/**
 * Characterization tests for Phase 9.1b's cross_run_modification emitter
 * (Phase9Handler.emitCrossRunModifications — spec §8.8 / §10.1).
 *
 * These pin the emitter's CURRENT observable behavior prior to an
 * internal decomposition refactor (S3776 cognitive-complexity reduction):
 *
 *   - Only tasks with task_type === 'refactoring' AND a string id are
 *     considered; non-refactoring tasks are ignored.
 *   - A refactoring task produces a record iff it either SUCCEEDED
 *     (scheduleResult.successfulLeafIds) or was SKIPPED as idempotent
 *     (a refactoring_skipped_idempotent record). Neither → no record.
 *   - Per-task metadata (modification_type, target_workflow_run_id,
 *     target_artifact_id, changed_interface_id) is read from the newest
 *     refactoring_scope's refactoring_tasks[], keyed by id.
 *   - modification_type is normalized: only 'additive' | 'breaking' |
 *     'non_breaking' survive; anything else → null.
 *   - applied_status is 'skipped_idempotent' for skipped tasks, else
 *     'applied'.
 *   - cross_run_impact_report_id comes from the scope; absent → null.
 *   - Returns the list of written record ids.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestEngine, type TestEngine } from '../../../helpers/createTestEngine';
import { Phase9Handler } from '../../../../lib/orchestrator/phases/phase9';
import type { OrchestratorEngine } from '../../../../lib/orchestrator/orchestratorEngine';

const RUN = 'cur-run';

type EmitFn = (
  ctx: { workflowRun: unknown; engine: OrchestratorEngine },
  effectiveTasks: { tasks: Array<Record<string, unknown>> },
  scheduleResult: { successfulLeafIds: string[] },
) => string[];

function emit(
  engine: OrchestratorEngine,
  effectiveTasks: { tasks: Array<Record<string, unknown>> },
  scheduleResult: { successfulLeafIds: string[] },
): string[] {
  const workflowRun = engine.stateMachine.getWorkflowRun(RUN)!;
  const handler = new Phase9Handler();
  const fn = (handler as unknown as { emitCrossRunModifications: EmitFn }).emitCrossRunModifications;
  return fn.call(handler, { workflowRun, engine }, effectiveTasks, scheduleResult);
}

function crossRunModifications(engine: OrchestratorEngine): Array<Record<string, unknown>> {
  return engine.writer
    .getRecordsByType(RUN, 'cross_run_modification')
    .map(r => r.content as Record<string, unknown>);
}

describe('Phase9Handler.emitCrossRunModifications (characterization)', () => {
  let te: TestEngine;
  let engine: OrchestratorEngine;

  beforeEach(async () => {
    te = await createTestEngine({ autoApprove: true });
    engine = te.engine;
    engine.stateMachine.createWorkflowRun({ id: RUN, workspace_id: 'ws', janumicode_version_sha: 'sha' });
  });
  afterEach(() => te.cleanup());

  it('returns [] and writes nothing when there are no refactoring tasks', () => {
    const out = emit(
      engine,
      { tasks: [{ id: 'FEAT-1', task_type: 'feature' }, { id: 'FEAT-2', task_type: 'feature' }] },
      { successfulLeafIds: ['FEAT-1', 'FEAT-2'] },
    );
    expect(out).toEqual([]);
    expect(crossRunModifications(engine)).toHaveLength(0);
  });

  it('ignores refactoring tasks whose id is not a string', () => {
    const out = emit(
      engine,
      { tasks: [{ id: 42, task_type: 'refactoring' }] },
      { successfulLeafIds: [] },
    );
    expect(out).toEqual([]);
    expect(crossRunModifications(engine)).toHaveLength(0);
  });

  it('emits records only for completed (succeeded or skipped-idempotent) refactoring tasks, with normalized fields', () => {
    // Newest scope supplies per-task metadata + the impact report id.
    engine.writer.writeRecord({
      record_type: 'refactoring_scope',
      schema_version: '1.0',
      workflow_run_id: RUN,
      janumicode_version_sha: 'sha',
      content: {
        kind: 'refactoring_scope',
        cross_run_impact_report_id: 'rep-1',
        refactoring_tasks: [
          {
            id: 'REFACTOR-1',
            modification_type: 'breaking',
            target_workflow_run_id: 'prior-run',
            target_artifact_id: 'art-1',
            changed_interface_id: 'IC-9',
          },
          {
            id: 'REFACTOR-2',
            modification_type: 'weird', // not in the allowed set → null
          },
        ],
      },
    });
    // REFACTOR-2 was skipped as already-applied (idempotent).
    engine.writer.writeRecord({
      record_type: 'refactoring_skipped_idempotent',
      schema_version: '1.0',
      workflow_run_id: RUN,
      janumicode_version_sha: 'sha',
      content: { kind: 'refactoring_skipped_idempotent', task_id: 'REFACTOR-2' },
    });

    const out = emit(
      engine,
      {
        tasks: [
          { id: 'REFACTOR-1', task_type: 'refactoring' }, // succeeded
          { id: 'REFACTOR-2', task_type: 'refactoring' }, // skipped-idempotent
          { id: 'REFACTOR-3', task_type: 'refactoring' }, // neither → no record
          { id: 'FEAT-1', task_type: 'feature' },         // ignored (not refactoring)
        ],
      },
      { successfulLeafIds: ['REFACTOR-1'] },
    );

    // Two records: REFACTOR-1 (applied) + REFACTOR-2 (skipped_idempotent).
    expect(out).toHaveLength(2);
    const records = crossRunModifications(engine);
    expect(records).toHaveLength(2);

    const byTask = new Map(records.map(r => [r.refactoring_task_id, r]));
    const r1 = byTask.get('REFACTOR-1')!;
    expect(r1).toMatchObject({
      kind: 'cross_run_modification',
      current_workflow_run_id: RUN,
      prior_workflow_run_id: 'prior-run',
      modified_artifact_id: 'art-1',
      changed_interface_id: 'IC-9',
      modification_type: 'breaking',
      refactoring_task_id: 'REFACTOR-1',
      verification_passed: true,
      applied_status: 'applied',
      cross_run_impact_report_id: 'rep-1',
    });

    const r2 = byTask.get('REFACTOR-2')!;
    expect(r2).toMatchObject({
      kind: 'cross_run_modification',
      current_workflow_run_id: RUN,
      prior_workflow_run_id: null,   // no meta → null
      modified_artifact_id: null,
      changed_interface_id: null,
      modification_type: null,       // 'weird' normalized away
      refactoring_task_id: 'REFACTOR-2',
      verification_passed: true,
      applied_status: 'skipped_idempotent',
      cross_run_impact_report_id: 'rep-1',
    });

    // REFACTOR-3 (neither succeeded nor skipped) produced nothing.
    expect(byTask.has('REFACTOR-3')).toBe(false);
  });

  it('leaves per-task fields null when no refactoring_scope exists', () => {
    const out = emit(
      engine,
      { tasks: [{ id: 'REFACTOR-1', task_type: 'refactoring' }] },
      { successfulLeafIds: ['REFACTOR-1'] },
    );
    expect(out).toHaveLength(1);
    const [rec] = crossRunModifications(engine);
    expect(rec).toMatchObject({
      prior_workflow_run_id: null,
      modified_artifact_id: null,
      changed_interface_id: null,
      modification_type: null,
      applied_status: 'applied',
      cross_run_impact_report_id: null, // no scope → '' → null
    });
  });
});
