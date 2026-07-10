/**
 * Characterization tests for two Phase6Handler private methods that had NO unit
 * coverage before the S3776 cognitive-complexity decomposition:
 *   - loadRefactoringTasks: maps refactoring_scope.refactoring_tasks[] → ImplementationTask[]
 *   - runTaskDecomposition: per-component task generation + deterministic fallback
 *
 * These pin the CURRENT observable behavior (return shapes, defaults, dedup,
 * fallback paths) so the block-extraction refactor stays behavior-preserving.
 * The methods are private; they are reached via `(handler as any).<method>` with
 * minimal plain-object fakes for the engine surface each method actually touches.
 */
import { describe, it, expect } from 'vitest';
import {
  Phase6Handler,
  collectDmr61Seeds,
  buildTaskGenTechSpecsSummary,
  pluckStringIds,
} from '../../../../lib/orchestrator/phases/phase6';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Phase6Handler.loadRefactoringTasks (characterization)', () => {
  function ctxWithScopes(scopes: any[]): any {
    return {
      workflowRun: { id: 'run-cur' },
      engine: {
        writer: {
          getRecordsByType: (_id: string, type: string) =>
            (type === 'refactoring_scope' ? scopes : []),
        },
      },
    };
  }

  it('returns [] when no refactoring_scope record exists', () => {
    const handler = new Phase6Handler();
    const out = (handler as any).loadRefactoringTasks(ctxWithScopes([]));
    expect(out).toEqual([]);
  });

  it('maps a fully-populated refactoring task, carrying idempotency fields through', () => {
    const handler = new Phase6Handler();
    const scope = {
      produced_at: '2026-01-02T00:00:00Z',
      content: {
        kind: 'refactoring_scope',
        cross_run_impact_report_id: 'rep-9',
        refactoring_tasks: [{
          id: 'REFACTOR-1',
          target_artifact_id: 'art-7',
          target_workflow_run_id: 'run-prev',
          changed_interface_id: 'IF-1',
          description: 'Migrate to the revised interface',
          verification_step: 'run the migration test',
          modification_type: 'breaking',
          expected_pre_state_hash: 'hash-abc',
          write_directory_paths: ['src/x'],
          dependency_task_ids: ['REFACTOR-0'],
          refactoring_instructions: 'do the migration',
        }],
      },
    };
    const out = (handler as any).loadRefactoringTasks(ctxWithScopes([scope]));
    expect(out).toHaveLength(1);
    const t = out[0];
    expect(t.id).toBe('REFACTOR-1');
    expect(t.task_type).toBe('refactoring');
    expect(t.component_id).toBe('cross_run_refactoring');
    expect(t.component_responsibility).toBe('Cross-run refactoring of prior-run artifact art-7');
    expect(t.description).toBe('Migrate to the revised interface');
    expect(t.estimated_complexity).toBe('medium');
    expect(t.completion_criteria).toEqual([{
      criterion_id: 'REFACTOR-1-VERIFY',
      description: 'run the migration test',
      verification_method: 'test_execution',
    }]);
    expect(t.write_directory_paths).toEqual(['src/x']);
    expect(t.dependency_task_ids).toEqual(['REFACTOR-0']);
    expect(t.target_artifact_id).toBe('art-7');
    expect(t.target_workflow_run_id).toBe('run-prev');
    expect(t.changed_interface_id).toBe('IF-1');
    expect(t.expected_pre_state_hash).toBe('hash-abc');
    expect(t.verification_step).toBe('run the migration test');
    expect(t.modification_type).toBe('breaking');
    expect(t.cross_run_impact_report_id).toBe('rep-9');
    expect(t.refactoring_instructions).toBe('do the migration');
  });

  it('applies defaults for a minimal task (only id) and drops id-less entries', () => {
    const handler = new Phase6Handler();
    const scope = {
      produced_at: '2026-01-01T00:00:00Z',
      content: {
        kind: 'refactoring_scope',
        refactoring_tasks: [
          { id: 'REFACTOR-2' },
          { description: 'no id — dropped' },
          { modification_type: 'nonsense' }, // id-less → dropped
        ],
      },
    };
    const out = (handler as any).loadRefactoringTasks(ctxWithScopes([scope]));
    expect(out).toHaveLength(1);
    const t = out[0];
    expect(t.id).toBe('REFACTOR-2');
    expect(t.target_artifact_id).toBe('');
    expect(t.component_responsibility).toBe('Cross-run refactoring of prior-run artifact (unknown)');
    expect(t.description).toBe('Refactoring task REFACTOR-2');
    expect(t.completion_criteria[0].description)
      .toBe('Confirm prior-run artifact conforms to the revised interface.');
    expect(t.write_directory_paths).toEqual([]);
    expect(t.dependency_task_ids).toEqual([]);
    expect(t.expected_pre_state_hash).toBe('');
    expect(t.modification_type).toBeUndefined();
    expect(t.cross_run_impact_report_id).toBeUndefined();
    expect(t.refactoring_instructions).toBeUndefined();
  });

  it('drops an invalid modification_type to undefined', () => {
    const handler = new Phase6Handler();
    const scope = {
      produced_at: '2026-01-01T00:00:00Z',
      content: { kind: 'refactoring_scope', refactoring_tasks: [{ id: 'R', modification_type: 'sideways' }] },
    };
    const out = (handler as any).loadRefactoringTasks(ctxWithScopes([scope]));
    expect(out[0].modification_type).toBeUndefined();
  });

  it('newest scope wins when multiple refactoring_scope records exist', () => {
    const handler = new Phase6Handler();
    const older = {
      produced_at: '2026-01-01T00:00:00Z',
      content: { kind: 'refactoring_scope', refactoring_tasks: [{ id: 'OLD-1' }] },
    };
    const newer = {
      produced_at: '2026-01-05T00:00:00Z',
      content: { kind: 'refactoring_scope', refactoring_tasks: [{ id: 'NEW-1' }] },
    };
    const out = (handler as any).loadRefactoringTasks(ctxWithScopes([older, newer]));
    expect(out.map((t: any) => t.id)).toEqual(['NEW-1']);
  });
});

describe('Phase6Handler.runTaskDecomposition (characterization)', () => {
  function baseOptions(overrides: any = {}): any {
    return {
      projectTypeDescription: 'CLI tool',
      techSpecsSummary: 'TECH SPECS',
      crossCuttingSummary: 'CROSS CUTTING',
      dmr: { activeConstraintsText: 'CONSTRAINTS', detailFilePath: 'detail.md', detailFileContent: 'DETAIL' },
      // Empty leaf-AC set ⇒ reconciliation loop is a no-op (no uncovered ACs),
      // so exactly one LLM call fires per leaf component.
      leafAcceptanceCriteria: [],
      canonicalize: (id: string) => id,
      techSpecsSummaryById: {},
      ...overrides,
    };
  }

  function fakeCtx(opts: { template: any; callResult?: any; onCall?: () => void }): any {
    return {
      workflowRun: { id: 'run-1' },
      engine: {
        janumiCodeVersionSha: 'dev',
        templateLoader: {
          findTemplate: () => opts.template,
          render: () => ({ rendered: 'PROMPT', missing_variables: [] as string[] }),
        },
        callForRole: async () => {
          opts.onCall?.();
          return opts.callResult ?? { parsed: { tasks: [] } };
        },
      },
    };
  }

  const oneComponent = [{ id: 'comp-a', name: 'A', responsibilities: [{ description: 'do a' }] }];

  it('returns the deterministic fallback plan when no template resolves', async () => {
    const handler = new Phase6Handler();
    const ctx = fakeCtx({ template: undefined });
    const plan = await (handler as any).runTaskDecomposition(ctx, oneComponent, baseOptions());
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].id).toBe('TASK-001');
  });

  it('returns the fallback plan when no component yields any task', async () => {
    const handler = new Phase6Handler();
    const ctx = fakeCtx({ template: {}, callResult: { parsed: { tasks: [] } } });
    const plan = await (handler as any).runTaskDecomposition(ctx, oneComponent, baseOptions());
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].id).toBe('TASK-001');
  });

  it('collects per-component LLM tasks into the plan (one call per leaf component)', async () => {
    const handler = new Phase6Handler();
    let calls = 0;
    const ctx = fakeCtx({
      template: {},
      onCall: () => { calls++; },
      callResult: { parsed: { tasks: [{ id: 'T1', component_id: 'comp-a', description: 'd', completion_criteria: [] }] } },
    });
    const plan = await (handler as any).runTaskDecomposition(ctx, oneComponent, baseOptions());
    expect(calls).toBe(1);
    expect(plan.tasks.map((t: any) => t.id)).toEqual(['T1']);
  });

  it('dedups tasks with the same id across components', async () => {
    const handler = new Phase6Handler();
    const twoComponents = [
      { id: 'comp-a', name: 'A', responsibilities: [] },
      { id: 'comp-b', name: 'B', responsibilities: [] },
    ];
    let calls = 0;
    const ctx = fakeCtx({
      template: {},
      onCall: () => { calls++; },
      callResult: { parsed: { tasks: [{ id: 'DUP', component_id: 'x', description: 'd', completion_criteria: [] }] } },
    });
    const plan = await (handler as any).runTaskDecomposition(ctx, twoComponents, baseOptions());
    expect(calls).toBe(2); // one call per component
    expect(plan.tasks.map((t: any) => t.id)).toEqual(['DUP']); // dedup across chunks
  });

  it('skips id-less components (empty component list ⇒ fallback)', async () => {
    const handler = new Phase6Handler();
    const ctx = fakeCtx({ template: {} });
    const plan = await (handler as any).runTaskDecomposition(ctx, [{ name: 'no-id' }], baseOptions());
    expect(plan.tasks[0].id).toBe('TASK-001');
  });
});

// ── execute() block-helper characterization (S3776 decomposition) ──────────
//
// execute() itself has no end-to-end unit coverage (it drives the full Phase-6
// pipeline: prior-phase context, DMR packet, per-component + reconciliation LLM
// calls, saturation loop, human pause — infeasible to fixture). These pin the
// observable behavior of the helpers extracted OUT of execute() during the
// cognitive-complexity decomposition, using the same fake-engine pattern above.

describe('phase6 task-generation input helpers (pure, characterization)', () => {
  it('pluckStringIds keeps non-empty string ids and drops the rest, preserving order', () => {
    expect(pluckStringIds([{ id: 'a' }, { id: '' }, { id: 5 }, { name: 'x' }, { id: 'b' }]))
      .toEqual(['a', 'b']);
    expect(pluckStringIds([])).toEqual([]);
  });

  it('collectDmr61Seeds emits one recordId per present prior artifact in fixed order', () => {
    const prior: any = {
      componentModel: { recordId: 'cm' },
      dataModels: { recordId: 'dm' },
      apiDefinitions: undefined,
      functionalRequirements: { recordId: 'fr' },
      systemRequirements: { recordId: 'sr' },
      interfaceContracts: undefined,
      errorHandlingStrategies: { recordId: 'eh' },
      configurationParameters: undefined,
    };
    expect(collectDmr61Seeds(prior)).toEqual(['cm', 'dm', 'fr', 'sr', 'eh']);
    expect(collectDmr61Seeds({} as any)).toEqual([]);
  });

  it('buildTaskGenTechSpecsSummary applies DM/API defaults and drops empty summaries', () => {
    const prior: any = {
      systemRequirements: { summary: 'SR' },
      interfaceContracts: undefined,
      dataModels: undefined,
      apiDefinitions: undefined,
      errorHandlingStrategies: { summary: 'EH' },
      configurationParameters: undefined,
    };
    // SR kept; IC '' dropped; DM→'No data models'; API→'No API definitions'; EH kept; CFG '' dropped.
    expect(buildTaskGenTechSpecsSummary(prior))
      .toBe('SR\n\nNo data models\n\nNo API definitions\n\nEH');
  });
});

describe('Phase6Handler.applyTaskPrune (characterization)', () => {
  function fakeCtx() {
    const written: any[] = [];
    const superseded: Array<[string, string]> = [];
    const ingested: any[] = [];
    let seq = 0;
    const ctx: any = {
      workflowRun: { id: 'run-1' },
      engine: {
        janumiCodeVersionSha: 'dev',
        writer: {
          writeRecord: (o: any) => { seq++; const rec = { id: `pruned-${seq}`, ...o }; written.push(rec); return rec; },
          supersedByRollback: (a: string, b: string) => { superseded.push([a, b]); },
        },
        ingestionPipeline: { ingest: (r: any) => { ingested.push(r); } },
      },
    };
    return { ctx, written, superseded, ingested };
  }
  const planContent = () => ({ tasks: [
    { id: 'T1', task_type: 'standard', complexity_flag: 'x' },
    { id: 'T2', task_type: 'standard' },
    { id: 'R1', task_type: 'refactoring' },
  ] });

  it('returns the same planRecord and writes nothing when the gatekeeper was skipped', () => {
    const handler = new Phase6Handler();
    const { ctx, written } = fakeCtx();
    const planRecord = { id: 'orig' } as any;
    const pc = planContent();
    const artifactIds: string[] = [];
    const out = (handler as any).applyTaskPrune(ctx, {
      taskPrune: { skipped: true, kept_ids: [], dropped: [{ id: 'T2', reason: 'x' }] },
      planContent: pc, planRecord, isRefactoringTaskId: new Set(['R1']), artifactIds,
    });
    expect(out).toBe(planRecord);
    expect(written).toHaveLength(0);
    expect(pc.tasks.map((t: any) => t.id)).toEqual(['T1', 'T2', 'R1']);
    expect(artifactIds).toEqual([]);
  });

  it('returns the same planRecord and writes nothing when nothing was dropped', () => {
    const handler = new Phase6Handler();
    const { ctx, written } = fakeCtx();
    const planRecord = { id: 'orig' } as any;
    const out = (handler as any).applyTaskPrune(ctx, {
      taskPrune: { skipped: false, kept_ids: ['T1', 'T2'], dropped: [] },
      planContent: planContent(), planRecord, isRefactoringTaskId: new Set(['R1']), artifactIds: [],
    });
    expect(out).toBe(planRecord);
    expect(written).toHaveLength(0);
  });

  it('writes a pruned plan that supersedes the original, always retains refactoring tasks, and mutates planContent', () => {
    const handler = new Phase6Handler();
    const { ctx, written, superseded, ingested } = fakeCtx();
    const planRecord = { id: 'orig' } as any;
    const pc = planContent();
    const artifactIds: string[] = [];
    const out = (handler as any).applyTaskPrune(ctx, {
      taskPrune: { skipped: false, kept_ids: ['T1'], dropped: [{ id: 'T2', reason: 'stale' }] },
      planContent: pc, planRecord, isRefactoringTaskId: new Set(['R1']), artifactIds,
    });
    // Kept: T1 (in kept_ids) + R1 (refactoring always retained); T2 dropped.
    expect(pc.tasks.map((t: any) => t.id)).toEqual(['T1', 'R1']);
    expect(out.id).toBe(written[0].id);
    expect(out.content.kind).toBe('implementation_plan');
    expect(out.content.total_tasks).toBe(2);
    expect(out.content.complexity_flagged_count).toBe(1); // only T1 carries complexity_flag
    expect(out.content.refactoring_tasks_included).toBe(true);
    expect(out.derived_from_record_ids).toEqual(['orig']);
    expect(superseded).toEqual([['orig', out.id]]);
    expect(ingested.map((r: any) => r.id)).toEqual([out.id]);
    expect(artifactIds).toEqual([out.id]);
  });
});

describe('Phase6Handler.resolveRootTasks (characterization)', () => {
  it('RESUME: rehydrates depth-0 roots from existing nodes without writing', () => {
    const handler = new Phase6Handler();
    const written: any[] = [];
    const existing = [
      { id: 'node-rec-1', content: { depth: 0, node_id: 'n1', task: { id: 'T1' } } },
      { id: 'node-rec-2', content: { depth: 1, node_id: 'n2', task: { id: 'child' } } },
      { id: 'node-rec-3', content: { depth: 0, node_id: 'n3', task: { id: 'T2' } } },
    ];
    const ctx: any = {
      workflowRun: { id: 'run-1' },
      engine: {
        janumiCodeVersionSha: 'dev',
        writer: {
          getRecordsByType: (_id: string, type: string) => (type === 'task_decomposition_node' ? existing : []),
          writeRecord: (o: any) => { written.push(o); return { id: 'x' }; },
        },
      },
    };
    const out = (handler as any).resolveRootTasks(ctx, {
      planTasks: [{ id: 'T1' }], injectedRefactoringTasks: [], isRefactoringTaskId: new Set(),
      technicalConstraints: [], leafAcIdSet: new Set(), componentIdOracle: new Set(),
      planRecordId: 'plan-1', artifactIds: [],
    });
    expect(written).toHaveLength(0); // resume never seeds
    expect(out.rootTasks.map((t: any) => t.id)).toEqual(['T1', 'T2']);
    expect(out.rootNodeRecordIds).toEqual(['node-rec-1', 'node-rec-3']);
    expect(out.rootLogicalIds).toEqual(['n1', 'n3']);
  });

  it('SEED: writes atomic leaves for refactoring tasks then pending roots for standard tasks', () => {
    const handler = new Phase6Handler();
    let seq = 0;
    const written: any[] = [];
    const ctx: any = {
      workflowRun: { id: 'run-1' },
      engine: {
        janumiCodeVersionSha: 'dev',
        writer: {
          getRecordsByType: () => [], // no depth-0 nodes ⇒ seed path
          writeRecord: (o: any) => { seq++; const rec = { id: `w-${seq}`, ...o }; written.push(rec); return rec; },
        },
      },
    };
    const artifactIds: string[] = [];
    const std = { id: 'T1', task_type: 'standard', component_id: 'comp-a', description: 'd', completion_criteria: [] };
    const ref = {
      id: 'R1', task_type: 'refactoring', component_id: 'cross_run_refactoring',
      component_responsibility: 'r', description: 'ref', estimated_complexity: 'medium',
      completion_criteria: [], write_directory_paths: [], dependency_task_ids: [],
    };
    const out = (handler as any).resolveRootTasks(ctx, {
      planTasks: [std, ref], injectedRefactoringTasks: [ref], isRefactoringTaskId: new Set(['R1']),
      technicalConstraints: [{ id: 'TECH-1' }], leafAcIdSet: new Set(), componentIdOracle: new Set(['comp-a']),
      planRecordId: 'plan-1', artifactIds,
    });
    const atomic = written.filter((w) => w.content.status === 'atomic');
    const pending = written.filter((w) => w.content.status === 'pending');
    expect(atomic).toHaveLength(1);
    expect(atomic[0].content.display_key).toBe('R1');
    expect(atomic[0].content.task.task_type).toBe('refactoring');
    expect(atomic[0].derived_from_record_ids).toEqual(['plan-1']);
    expect(pending).toHaveLength(1);
    expect(pending[0].content.display_key).toBe('T1');
    expect(pending[0].content.task.id).toBe('T1');
    expect(pending[0].derived_from_record_ids).toEqual(['plan-1']);
    // rootTasks excludes refactoring; refactoring leaves are written before roots.
    expect(out.rootTasks.map((t: any) => t.id)).toEqual(['T1']);
    expect(out.rootNodeRecordIds).toHaveLength(1);
    expect(out.rootLogicalIds).toHaveLength(1);
    expect(artifactIds).toEqual([atomic[0].id, pending[0].id]);
  });
});

describe('Phase6Handler.writeTaskAcCoverageReport (characterization)', () => {
  it('writes nothing when there are no leaf acceptance criteria', () => {
    const handler = new Phase6Handler();
    const written: any[] = [];
    const ctx: any = {
      workflowRun: { id: 'run-1' },
      engine: { janumiCodeVersionSha: 'dev', writer: { writeRecord: (o: any) => { written.push(o); return { id: 'x' }; } } },
    };
    const artifactIds: string[] = [];
    (handler as any).writeTaskAcCoverageReport(ctx, [{ traces_to: ['AC-1'] }], [], 'plan-1', artifactIds);
    expect(written).toHaveLength(0);
    expect(artifactIds).toEqual([]);
  });

  it('writes a coverage report (kind + counts) and pushes its id when leaf ACs exist', () => {
    const handler = new Phase6Handler();
    let seq = 0;
    const written: any[] = [];
    const ctx: any = {
      workflowRun: { id: 'run-1' },
      engine: { janumiCodeVersionSha: 'dev', writer: { writeRecord: (o: any) => { seq++; const rec = { id: `cov-${seq}`, ...o }; written.push(rec); return rec; } } },
    };
    const artifactIds: string[] = [];
    const leaves = [{ leafStoryId: 'US-1', storyText: '', acs: [{ id: 'AC-1', text: '' }, { id: 'AC-2', text: '' }] }];
    (handler as any).writeTaskAcCoverageReport(ctx, [{ traces_to: ['AC-1'] }], leaves, 'plan-1', artifactIds);
    expect(written).toHaveLength(1);
    expect(written[0].content.kind).toBe('task_ac_coverage_report');
    expect(written[0].content.total_leaf_acs).toBe(2);
    expect(written[0].content.covered).toBe(1); // AC-1 covered, AC-2 is an honest gap
    expect(written[0].derived_from_record_ids).toEqual(['plan-1']);
    expect(artifactIds).toEqual(['cov-1']);
  });
});

describe('Phase6Handler.presentPlanMirror (characterization)', () => {
  function fakeCtx(resolution: any, opts: { throws?: boolean } = {}) {
    const written: any[] = [];
    const events: Array<[string, any]> = [];
    const subphases: string[] = [];
    const ctx: any = {
      workflowRun: { id: 'run-1' },
      engine: {
        janumiCodeVersionSha: 'dev',
        stateMachine: { setSubPhase: (_id: string, s: string) => subphases.push(s) },
        mirrorGenerator: { generate: () => ({ mirrorId: 'm-1', fields: [{ a: 1 }] }) },
        writer: { writeRecord: (o: any) => { const rec = { id: 'mirror-rec', ...o }; written.push(rec); return rec; } },
        eventBus: { emit: (name: string, payload: any) => events.push([name, payload]) },
        pauseForDecision: async () => { if (opts.throws) throw new Error('boom'); return resolution; },
      },
    };
    return { ctx, written, events, subphases };
  }
  const planContent = { tasks: [{ id: 'T1', complexity_flag: 'x' }, { id: 'T2' }] } as any;

  it('returns null and records the mirror when the user approves', async () => {
    const handler = new Phase6Handler();
    const { ctx, written, events, subphases } = fakeCtx({ type: 'mirror_approval' });
    const artifactIds: string[] = [];
    const out = await (handler as any).presentPlanMirror(ctx, { id: 'plan-1' }, planContent, artifactIds);
    expect(out).toBeNull();
    expect(subphases).toEqual(['implementation_plan_synthesis']);
    expect(written).toHaveLength(1);
    expect(written[0].content.kind).toBe('implementation_plan_mirror');
    expect(written[0].content.total_tasks).toBe(2);
    expect(written[0].content.complexity_flagged_count).toBe(1);
    expect(artifactIds).toEqual(['mirror-rec']);
    expect(events[0][0]).toBe('mirror:presented');
  });

  it('returns a failure PhaseResult (and keeps the pushed mirror id) when the user rejects', async () => {
    const handler = new Phase6Handler();
    const { ctx } = fakeCtx({ type: 'mirror_rejection' });
    const artifactIds: string[] = [];
    const out = await (handler as any).presentPlanMirror(ctx, { id: 'plan-1' }, planContent, artifactIds);
    expect(out).toEqual({ success: false, error: 'User rejected implementation plan', artifactIds: ['mirror-rec'] });
    expect(artifactIds).toEqual(['mirror-rec']);
  });

  it('returns a failure PhaseResult when the review throws', async () => {
    const handler = new Phase6Handler();
    const { ctx } = fakeCtx({ type: 'mirror_approval' }, { throws: true });
    const artifactIds: string[] = [];
    const out = await (handler as any).presentPlanMirror(ctx, { id: 'plan-1' }, planContent, artifactIds);
    expect(out).toEqual({ success: false, error: 'Implementation plan review failed', artifactIds: ['mirror-rec'] });
  });
});
