/**
 * Phase 10 — Commit and Deployment Initiation.
 * Based on JanumiCode Spec v2.3, §4 Phase 10.
 *
 * Sub-phases:
 *   10.1 — Pre-Commit Consistency Check (scaffold)
 *   10.2 — Commit Preparation (scaffold — no real git)
 *   10.3 — Workflow Run Closure
 *
 * This is a scaffold implementation. Real commit operations will be
 * implemented when git tooling integration is built.
 */

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { PhaseId } from '../../types/records';
import { getLogger } from '../../logging';
import { emit as aoddEmit } from '../../aodd';
import { detectDivergentDuplicates, type DivergentDuplicateFinding } from '../workspaceSnapshot';
import { detectLayoutViolations, type ProjectLayoutContract } from './layoutContract';
import { runTscNoEmit } from './tscValidator';

export class Phase10Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '10';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];

    // ── 10.1 — Pre-Commit Consistency Check ───────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'pre_commit_consistency_check');

    // Cross-run refactoring verification (spec §4 Phase 10.1 gate criterion,
    // §15.5 cross_run_impact_triggered): if Phase 0.5 ran, every Refactoring
    // Task in the refactoring_scope MUST have a cross_run_modification record
    // from Phase 9.1. A missing one is a blocking failure.
    const crossRunCheck = this.verifyCrossRunModifications(ctx);
    const blockingFailures: Array<Record<string, unknown>> = [];
    if (crossRunCheck && crossRunCheck.missing.length > 0) {
      blockingFailures.push({
        kind: 'missing_cross_run_modification',
        missing_refactoring_task_ids: crossRunCheck.missing,
        detail: `${crossRunCheck.missing.length} Refactoring Task(s) have no cross_run_modification record from Phase 9.1.`,
      });
      getLogger().warn('workflow', 'Phase 10.1: missing cross_run_modification records', {
        workflow_run_id: workflowRun.id, missing: crossRunCheck.missing,
      });
    }

    // Lever 2c — divergent-duplicate detection. Enumerate the generated
    // workspace and flag files that share a basename but have divergent
    // content across paths (the fragmentation symptom: two implementations
    // of the same module). With the 2a scaffold + 2b import-don't-reinvent
    // in place this should be empty; a non-empty result is real drift. Each
    // finding records technical debt; severity (block vs warn) is configurable.
    const divergence = this.checkDivergentDuplicates(ctx);
    const internalFindings: Array<Record<string, unknown>> = divergence.findings.map(f => ({
      kind: 'divergent_duplicate',
      basename: f.basename,
      paths: f.files.map(x => x.path),
    }));
    if (divergence.findings.length > 0 && divergence.severity === 'block') {
      blockingFailures.push({
        kind: 'divergent_duplicate_modules',
        count: divergence.findings.length,
        basenames: divergence.findings.map(f => f.basename),
        detail: `${divergence.findings.length} module name(s) have divergent duplicate implementations across the workspace. Consolidate to a single canonical copy.`,
      });
    }

    // Project Layout Contract conformance + import-resolution (advisory by
    // default). Surfaces stray top-level dirs / shared trees, foreign-language
    // files, committed build output, and broken imports (`tsc --noEmit`).
    const structural = this.checkStructuralConformance(ctx);
    internalFindings.push(...structural.findings);
    if (structural.layoutSeverity === 'block' && structural.layoutViolations > 0) {
      blockingFailures.push({ kind: 'layout_violations', count: structural.layoutViolations, detail: 'Project layout contract violations present.' });
    }
    if (structural.tscSeverity === 'block' && structural.tscErrors > 0) {
      blockingFailures.push({ kind: 'tsc_errors', count: structural.tscErrors, detail: `${structural.tscErrors} TypeScript error(s) in the generated workspace.` });
    }
    const overallPass = blockingFailures.length === 0;

    const consistencyRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '10',
      sub_phase_id: 'pre_commit_consistency_check',
      produced_by_agent_role: 'consistency_checker',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: {
        kind: 'consistency_report',
        overall_pass: overallPass,
        traceability_results: [],
        semantic_findings: [],
        internal_findings: internalFindings,
        blocking_failures: blockingFailures,
        warnings: divergence.severity === 'warn'
          ? internalFindings.map(f => ({ kind: 'divergent_duplicate', ...f }))
          : [],
        cross_run_modification_check: crossRunCheck ?? undefined,
        divergent_duplicate_count: divergence.findings.length,
        layout_violation_count: structural.layoutViolations,
        tsc_error_count: structural.tscErrors,
      },
    });
    artifactIds.push(consistencyRecord.id);
    engine.ingestionPipeline.ingest(consistencyRecord);

    // ── 10.2 — Commit Preparation ─────────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'commit_preparation');

    const commitRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '10',
      sub_phase_id: 'commit_preparation',
      produced_by_agent_role: 'executor_agent',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [consistencyRecord.id],
      content: {
        kind: 'commit_record',
        commit_sha: '',
        branch: 'main',
        commit_message: `JanumiCode Workflow Run ${workflowRun.id}`,
        artifact_ids_committed: artifactIds,
        status: 'prepared',
        scaffold: true,
      },
    });
    artifactIds.push(commitRecord.id);
    engine.ingestionPipeline.ingest(commitRecord);

    // ── 10.3 — Workflow Run Closure ───────────────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, 'workflow_run_closure');

    // Use narrow queries here — a long calibration run produces thousands
    // of artifact_produced rows totalling tens of MB. Pulling the full
    // bodies through the sidecar RPC SAB (32MB cap) overflows it and
    // surfaces as "RPC error: offset is out of bounds" right at workflow
    // closure (observed end of cal-23). We only need cardinalities + the
    // single intent_statement record here.
    const artifactsCount = engine.writer.countRecordsByType(workflowRun.id, 'artifact_produced');
    const decisionTracesCount = engine.writer.countRecordsByType(workflowRun.id, 'decision_trace');

    const intentRecord = engine.writer.getArtifactByKind(workflowRun.id, 'intent_statement');
    const intentContent = intentRecord?.content as Record<string, unknown> | undefined;
    const intentSummary = intentContent
      ? `${(intentContent.product_concept as Record<string, unknown>)?.name ?? 'Unknown'}: ${(intentContent.product_concept as Record<string, unknown>)?.description ?? ''}`.slice(0, 300)
      : 'Workflow run completed';

    const summaryRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '10',
      sub_phase_id: 'workflow_run_closure',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [commitRecord.id],
      content: {
        kind: 'workflow_run_summary',
        run_id: workflowRun.id,
        intent_statement_summary: intentSummary,
        key_decisions: decisionTracesCount,
        artifacts_produced: artifactsCount,
        janumicode_version_sha: engine.janumiCodeVersionSha,
        completion_timestamp: new Date().toISOString(),
      },
    });
    artifactIds.push(summaryRecord.id);
    engine.ingestionPipeline.ingest(summaryRecord);

    // Mirror for final approval
    const closureMirror = engine.mirrorGenerator.generate({
      artifactId: summaryRecord.id,
      artifactType: 'workflow_run_summary',
      content: { artifacts_produced: artifactsCount, key_decisions: decisionTracesCount },
    });

    const mirrorRecord = engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '10',
      sub_phase_id: 'workflow_run_closure',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [summaryRecord.id],
      content: {
        kind: 'workflow_closure_mirror',
        mirror_id: closureMirror.mirrorId,
        fields: closureMirror.fields,
      },
    });
    artifactIds.push(mirrorRecord.id);
    engine.eventBus.emit('mirror:presented', { mirrorId: closureMirror.mirrorId, artifactType: 'workflow_run_summary' });
    aoddEmit('mirror.presented', { mirror_id: closureMirror.mirrorId, artifact_type: 'workflow_run_summary' });

    try {
      const resolution = await engine.pauseForDecision(workflowRun.id, mirrorRecord.id, 'mirror');
      if (resolution.type === 'mirror_rejection') {
        return { success: false, error: 'User rejected workflow closure', artifactIds };
      }
    } catch (err) {
      getLogger().warn('workflow', 'Phase 10 approval failed', { error: String(err) });
      return { success: false, error: 'Workflow closure failed', artifactIds };
    }

    // Mark workflow run as complete
    engine.stateMachine.completeWorkflowRun(workflowRun.id);
    engine.eventBus.emit('workflow:completed', { workflowRunId: workflowRun.id });

    // Phase Gate (final)
    const gateRecord = engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '10',
      sub_phase_id: 'workflow_run_closure',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [consistencyRecord.id, commitRecord.id, summaryRecord.id],
      content: {
        kind: 'phase_gate',
        phase_id: '10',
        consistency_pass: overallPass,
        commit_status: 'prepared',
        workflow_status: 'completed',
        scaffold: true,
      },
    });
    artifactIds.push(gateRecord.id);

    return { success: true, artifactIds };
  }

  /**
   * Phase 10.1 cross-run gate criterion. Returns null when Phase 0.5 did not
   * run (nothing to verify); otherwise the expected Refactoring Task ids (from
   * the refactoring_scope), the ids that produced a cross_run_modification, and
   * the missing set. A non-empty `missing` is a blocking failure.
   */
  private verifyCrossRunModifications(ctx: PhaseContext): {
    expected: string[]; modified: string[]; missing: string[];
  } | null {
    const { engine, workflowRun } = ctx;
    if (!workflowRun.cross_run_impact_triggered) return null;

    const scopes = engine.writer.getRecordsByType(workflowRun.id, 'refactoring_scope');
    const expected = new Set<string>();
    for (const scope of scopes) {
      const tasks = (scope.content as Record<string, unknown>).refactoring_tasks;
      if (Array.isArray(tasks)) {
        for (const t of tasks as Array<Record<string, unknown>>) {
          if (typeof t.id === 'string') expected.add(t.id);
        }
      }
    }

    const modified = new Set<string>();
    for (const rec of engine.writer.getRecordsByType(workflowRun.id, 'cross_run_modification')) {
      const tid = (rec.content as Record<string, unknown>).refactoring_task_id;
      if (typeof tid === 'string') modified.add(tid);
    }

    const missing = [...expected].filter(id => !modified.has(id));
    return { expected: [...expected], modified: [...modified], missing };
  }

  /**
   * Lever 2c — scan the generated workspace for divergent duplicate modules
   * (same basename, different content across paths) and record technical
   * debt for each. The scaffold's protected paths (shared dir) are excluded
   * since the scaffold owns single canonical copies there. Returns the
   * findings and the configured gate severity.
   */
  private checkDivergentDuplicates(ctx: PhaseContext): {
    findings: DivergentDuplicateFinding[];
    severity: 'block' | 'warn';
  } {
    const { engine, workflowRun } = ctx;
    const cfg = engine.configManager.get() as unknown as {
      consistency?: { divergence_severity?: 'block' | 'warn' };
    };
    const severity = cfg.consistency?.divergence_severity ?? 'block';

    const manifest = engine.writer.getArtifactByKind(workflowRun.id, 'scaffold_manifest');
    const protectedPaths = ((manifest?.content as Record<string, unknown>)?.protected_paths as string[] | undefined) ?? [];

    let findings: DivergentDuplicateFinding[] = [];
    try {
      findings = detectDivergentDuplicates(engine.workspacePath, protectedPaths);
    } catch (err) {
      getLogger().warn('workflow', 'Phase 10.1: divergent-duplicate scan failed', {
        workflow_run_id: workflowRun.id, error: err instanceof Error ? err.message : String(err),
      });
      return { findings: [], severity };
    }

    if (findings.length > 0) {
      getLogger().warn('workflow', 'Phase 10.1: divergent duplicate modules detected', {
        workflow_run_id: workflowRun.id, count: findings.length,
        basenames: findings.map(f => f.basename), severity,
      });
      for (const f of findings) {
        const debt = engine.writer.writeRecord({
          record_type: 'technical_debt_record',
          schema_version: '1.0',
          workflow_run_id: workflowRun.id,
          phase_id: '10',
          sub_phase_id: 'pre_commit_consistency_check',
          produced_by_agent_role: 'consistency_checker',
          janumicode_version_sha: engine.janumiCodeVersionSha,
          content: {
            kind: 'divergent_duplicate',
            basename: f.basename,
            paths: f.files.map(x => x.path),
            detail: `Module "${f.basename}" has divergent implementations at: ${f.files.map(x => x.path).join(', ')}. Consolidate to a single canonical module (prefer the shared scaffold).`,
            severity,
          },
        });
        engine.ingestionPipeline.ingest(debt);
      }
    }
    return { findings, severity };
  }

  /**
   * Project Layout Contract conformance + import-resolution check. Read-only,
   * advisory by default. Records layout violations + tsc errors as internal
   * findings and technical-debt records; returns counts + severities for the
   * gate. Skips quietly when no scaffold manifest / contract is present.
   */
  private checkStructuralConformance(ctx: PhaseContext): {
    findings: Array<Record<string, unknown>>;
    layoutViolations: number;
    tscErrors: number;
    layoutSeverity: 'advisory' | 'block';
    tscSeverity: 'advisory' | 'block';
  } {
    const { engine, workflowRun } = ctx;
    const cfg = engine.configManager.get() as unknown as {
      consistency?: { layout_violation_severity?: 'advisory' | 'block'; tsc_validation_severity?: 'advisory' | 'block' };
    };
    const layoutSeverity = cfg.consistency?.layout_violation_severity ?? 'advisory';
    const tscSeverity = cfg.consistency?.tsc_validation_severity ?? 'advisory';
    const findings: Array<Record<string, unknown>> = [];

    const manifest = engine.writer.getArtifactByKind(workflowRun.id, 'scaffold_manifest');
    const contract = (manifest?.content as Record<string, unknown>)?.project_layout_contract as ProjectLayoutContract | undefined;

    let layoutViolations = 0;
    if (contract) {
      try {
        const report = detectLayoutViolations(engine.workspacePath, contract);
        if (!report.passed) {
          layoutViolations = report.stray_top_level_dirs.length + report.stray_shared_trees.length
            + report.foreign_language_files.length + (report.build_output_has_source ? 1 : 0);
          findings.push({
            kind: 'layout_violation',
            stray_top_level_dirs: report.stray_top_level_dirs,
            stray_shared_trees: report.stray_shared_trees,
            foreign_language_files: report.foreign_language_files,
            build_output_has_source: report.build_output_has_source,
            severity: layoutSeverity,
          });
          this.emitTechnicalDebt(ctx, 'layout_violation', `Project layout violations: ${layoutViolations} (stray dirs / shared trees / foreign files / dist source).`, layoutSeverity);
          getLogger().warn('workflow', 'Phase 10.1: project layout violations detected', {
            workflow_run_id: workflowRun.id, count: layoutViolations, severity: layoutSeverity,
          });
        }
      } catch { /* read-only scan failure — non-fatal */ }
    }

    let tscErrors = 0;
    const isTs = (manifest?.content as Record<string, unknown> | undefined) &&
      ((manifest!.content as { profile?: { language?: string } }).profile?.language === 'typescript');
    if (isTs) {
      const tsc = runTscNoEmit(engine.workspacePath);
      if (tsc.ran && !tsc.passed) {
        tscErrors = tsc.errorCount;
        findings.push({ kind: 'tsc_errors', error_count: tscErrors, excerpt: tsc.errorExcerpt.slice(0, 800), severity: tscSeverity });
        this.emitTechnicalDebt(ctx, 'tsc_errors', `${tscErrors} TypeScript error(s) (broken imports / types) in the generated workspace.`, tscSeverity);
        getLogger().warn('workflow', 'Phase 10.1: tsc --noEmit reported errors', {
          workflow_run_id: workflowRun.id, error_count: tscErrors, severity: tscSeverity,
        });
      }
    }

    return { findings, layoutViolations, tscErrors, layoutSeverity, tscSeverity };
  }

  private emitTechnicalDebt(ctx: PhaseContext, kind: string, detail: string, severity: string): void {
    const { engine, workflowRun } = ctx;
    const debt = engine.writer.writeRecord({
      record_type: 'technical_debt_record',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '10',
      sub_phase_id: 'pre_commit_consistency_check',
      produced_by_agent_role: 'consistency_checker',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { kind, detail, severity },
    });
    engine.ingestionPipeline.ingest(debt);
  }
}
