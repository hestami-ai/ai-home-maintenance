/**
 * Phase 0.5 — Cross-Run Impact Analysis (conditional).
 * Based on JanumiCode Spec v2.3, §4 Phase 0.5 (lines 471-520).
 *
 * Runs only when a `prior_decision_override` confirmed in Phase 1 changes a
 * Phase-Gate-Certified Interface Contract / API Definition / Data Model from a
 * PRIOR Workflow Run (the routing layer gates entry via
 * `engine.detectCrossRunImpactTrigger`). Its job is to bound the refactor
 * cascade across runs before Phase 2 proceeds.
 *
 * Sub-phases:
 *   0.5.1 — Impact Enumeration (Consistency Checker, deterministic)
 *   0.5.2 — Refactoring Decision (human; headless default = Proceed)
 *
 * Impact enumeration is RULE-BASED (no LLM): it diffs the old vs new
 * interface definition (`diffInterfaceDefinitions`) and queries prior-run
 * artifacts that derive from the changed interface. The output drives a
 * cascade-threshold check and the human's resolution path.
 */

import * as fs from 'node:fs';
import { createHash } from 'node:crypto';
import type { PhaseHandler, PhaseContext, PhaseResult, CrossRunImpactTrigger } from '../orchestratorEngine';
import type { PhaseId, GovernedStreamRecord } from '../../types/records';
import { getLogger } from '../../logging';
import { emit as aoddEmit } from '../../aodd';
import { serializeRecord } from './phaseUtils';
import { diffInterfaceMembers, type ModificationType, type InterfaceDiff } from './crossRunImpact';

// ── Refactoring-decision option ids (decision-bundle menu) ────────────
const OPT_PROCEED = 'proceed';
const OPT_REVISE = 'revise';
const OPT_ACCEPT_DIVERGENCE = 'accept_divergence';

// ── Cascade-menu option ids ──────────────────────────────────────────
const OPT_CASCADE_PROCEED = 'cascade_proceed';
const OPT_CASCADE_REDESIGN = 'cascade_redesign';
const OPT_CASCADE_ABANDON = 'cascade_abandon';

interface RefactoringTask {
  id: string;
  task_type: 'refactoring';
  target_artifact_id: string;
  target_workflow_run_id: string;
  changed_interface_id: string;
  description: string;
  backing_tool: string;
  dependency_task_ids: string[];
  expected_pre_state_hash: string;
  verification_step: string;
  modification_type: ModificationType;
  write_directory_paths: string[];
  derived_from_record_ids: string[];
  implementation_notes: string;
  /** Self-contained, executor-readable refactoring directive: the previous
   *  interface definition, the new one, the specific member diff, and the
   *  target file(s). Resolved here (Phase 0.5) because the CLI agent cannot
   *  dereference the record-id references itself. */
  refactoring_instructions: string;
}

/** Output of `enumerateImpact` — the deterministic 0.5.1 analysis. */
interface ImpactResult {
  affectedArtifactIds: string[];
  affectedFilePaths: string[];
  dependencyChain: string[];
  modificationType: ModificationType;
  /** Member-level diff (removed/added/retyped) for the changed interface. */
  diff: InterfaceDiff;
  /** Raw content of the previous (superseded) interface definition. */
  oldDef: Record<string, unknown> | null;
  /** Raw content of the new (superseding) definition, or null when the
   *  override carried only a statement. */
  newDef: Record<string, unknown> | null;
}

export class Phase05Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '0.5';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const runId = workflowRun.id;
    const artifactIds: string[] = [];

    const trigger = engine.detectCrossRunImpactTrigger(runId);
    if (!trigger) {
      // Defensive: routing should only land here when triggered. If the
      // override is gone (e.g. revised away), do nothing and let the gate
      // advance 0.5 → 2 without inventing a report.
      getLogger().warn('workflow', 'Phase 0.5 entered without an active cross-run trigger — skipping enumeration', { runId });
      return { success: true, artifactIds };
    }

    // ── 0.5.1 — Impact Enumeration (deterministic) ────────────────
    engine.stateMachine.setSubPhase(runId, 'impact_enumeration');

    const impact = this.enumerateImpact(ctx, trigger);
    const impactRecord = engine.writer.writeRecord({
      record_type: 'cross_run_impact_report',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '0.5',
      sub_phase_id: 'impact_enumeration',
      produced_by_agent_role: 'consistency_checker',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [
        trigger.overrideTraceId,
        trigger.changedInterfaceId,
        ...(trigger.supersedingRecordId ? [trigger.supersedingRecordId] : []),
      ],
      content: {
        changed_interface_id: trigger.changedInterfaceId,
        interface_kind: trigger.interfaceKind,
        prior_workflow_run_id: trigger.priorWorkflowRunId,
        affected_artifact_ids: impact.affectedArtifactIds,
        affected_file_paths: impact.affectedFilePaths,
        estimated_refactoring_task_count: impact.affectedArtifactIds.length,
        estimated_file_count: impact.affectedFilePaths.length,
        dependency_chain: impact.dependencyChain,
        modification_type: impact.modificationType,
        // Member-level diff + definition snapshots, so the report is a
        // self-contained audit of WHAT changed (not just the classification).
        diff: {
          removed_members: impact.diff.removed,
          added_members: impact.diff.added,
          retyped_members: impact.diff.retyped,
          parseable: impact.diff.parseable,
        },
        old_definition: impact.oldDef,
        new_definition: impact.newDef,
      },
    });
    engine.ingestionPipeline.ingest(impactRecord);
    artifactIds.push(impactRecord.id);
    engine.eventBus.emit('record:added', { record: serializeRecord(impactRecord) });

    // ── Cascade Threshold Check (deterministic) ───────────────────
    const cfg = engine.configManager.get().cross_run_refactoring;
    const breach =
      impact.affectedArtifactIds.length > cfg.cascade_threshold_task_count ||
      impact.affectedFilePaths.length > cfg.cascade_threshold_file_count;

    if (breach) {
      const cascadeOutcome = await this.resolveCascadeThreshold(ctx, impactRecord.id, impact, cfg);
      artifactIds.push(...cascadeOutcome.artifactIds);
      if (cascadeOutcome.reviseTo) {
        return { success: true, artifactIds, reviseTo: cascadeOutcome.reviseTo };
      }
      if (cascadeOutcome.abandoned) {
        // Abandon the interface change → pursue additive approach. Record as
        // technical debt and gate without a refactoring_scope.
        const gateId = this.writeGate(ctx, [impactRecord.id, ...cascadeOutcome.artifactIds]);
        artifactIds.push(gateId);
        return { success: true, artifactIds };
      }
      // Proceed branch falls through to 0.5.2.
    }

    // ── 0.5.2 — Refactoring Decision ──────────────────────────────
    engine.stateMachine.setSubPhase(runId, 'refactoring_decision');

    const choice = await this.resolveRefactoringDecision(ctx, impactRecord.id, impact);

    if (choice === OPT_REVISE) {
      // (B) Revise the override → return to Phase 1.
      engine.writer.writeRecord({
        record_type: 'decision_trace',
        schema_version: '1.0',
        workflow_run_id: runId,
        phase_id: '0.5',
        sub_phase_id: 'refactoring_decision',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        derived_from_record_ids: [impactRecord.id],
        content: {
          decision_type: 'refactoring_decision',
          resolution: 'revise_override',
          target_record_id: trigger.changedInterfaceId,
        },
      });
      return { success: true, artifactIds, reviseTo: '1' };
    }

    if (choice === OPT_ACCEPT_DIVERGENCE) {
      // (C) Accept divergence → document as technical debt; no refactoring_scope.
      const debtRecord = engine.writer.writeRecord({
        record_type: 'technical_debt_record',
        schema_version: '1.0',
        workflow_run_id: runId,
        phase_id: '0.5',
        sub_phase_id: 'refactoring_decision',
        produced_by_agent_role: 'consistency_checker',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        derived_from_record_ids: [impactRecord.id],
        content: {
          kind: 'technical_debt_record',
          changed_interface_id: trigger.changedInterfaceId,
          prior_workflow_run_id: trigger.priorWorkflowRunId,
          modification_type: impact.modificationType,
          rationale: 'Human accepted cross-run divergence; prior-run implementation left unchanged.',
          affected_artifact_ids: impact.affectedArtifactIds,
        },
      });
      engine.ingestionPipeline.ingest(debtRecord);
      artifactIds.push(debtRecord.id);
      const gateId = this.writeGate(ctx, [impactRecord.id, debtRecord.id]);
      artifactIds.push(gateId);
      return { success: true, artifactIds };
    }

    // (A) Proceed → produce a refactoring_scope of Refactoring Tasks.
    const tasks = this.buildRefactoringTasks(ctx, trigger, impact, impactRecord.id);
    const scopeRecord = engine.writer.writeRecord({
      record_type: 'refactoring_scope',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '0.5',
      sub_phase_id: 'refactoring_decision',
      produced_by_agent_role: 'consistency_checker',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [impactRecord.id],
      content: {
        kind: 'refactoring_scope',
        cross_run_impact_report_id: impactRecord.id,
        changed_interface_id: trigger.changedInterfaceId,
        prior_workflow_run_id: trigger.priorWorkflowRunId,
        modification_type: impact.modificationType,
        refactoring_tasks: tasks,
      },
    });
    engine.ingestionPipeline.ingest(scopeRecord);
    artifactIds.push(scopeRecord.id);
    engine.eventBus.emit('record:added', { record: serializeRecord(scopeRecord) });

    const gateId = this.writeGate(ctx, [impactRecord.id, scopeRecord.id]);
    artifactIds.push(gateId);
    return { success: true, artifactIds };
  }

  // ── 0.5.1 deterministic enumeration ─────────────────────────────

  private enumerateImpact(
    ctx: PhaseContext,
    trigger: CrossRunImpactTrigger,
  ): ImpactResult {
    const { engine } = ctx;

    const oldDef = engine.writer.getRecord(trigger.changedInterfaceId)?.content ?? null;
    const newDef = trigger.supersedingRecordId
      ? (engine.writer.getRecord(trigger.supersedingRecordId)?.content ?? null)
      : null;
    const diff = diffInterfaceMembers(oldDef, newDef);

    // Prior-run artifacts that implement / derive from the changed interface.
    const affected = this.priorRunArtifactsDerivingFrom(ctx, trigger.priorWorkflowRunId, trigger.changedInterfaceId);
    const affectedArtifactIds = affected.map((r) => r.id);

    // Affected files = file-system writes in the prior run that derive from the
    // changed interface or any affected artifact. Often empty in fresh runs
    // whose prior run never reached Phase 9 execution.
    const affectedFilePaths = this.affectedFilePaths(
      ctx,
      trigger.priorWorkflowRunId,
      [trigger.changedInterfaceId, ...affectedArtifactIds],
    );

    return {
      affectedArtifactIds,
      affectedFilePaths,
      dependencyChain: affectedArtifactIds,
      modificationType: diff.modificationType,
      diff,
      oldDef,
      newDef,
    };
  }

  /** Prior-run, current-version records whose derived_from list includes `interfaceId`. */
  private priorRunArtifactsDerivingFrom(
    ctx: PhaseContext,
    priorRunId: string,
    interfaceId: string,
  ): GovernedStreamRecord[] {
    try {
      const rows = ctx.engine.db.prepare(`
        SELECT id FROM governed_stream
        WHERE workflow_run_id = ? AND is_current_version = 1
          AND record_type = 'artifact_produced'
          AND derived_from_record_ids LIKE ?
        ORDER BY produced_at ASC
      `).all(priorRunId, `%"${interfaceId}"%`) as Array<{ id: string }>;
      const out: GovernedStreamRecord[] = [];
      for (const r of rows) {
        const rec = ctx.engine.writer.getRecord(r.id);
        if (rec) out.push(rec);
      }
      return out;
    } catch (err) {
      getLogger().warn('workflow', 'priorRunArtifactsDerivingFrom query failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  /** Distinct file paths written by prior-run file_system_write_records deriving from any seed id. */
  private affectedFilePaths(ctx: PhaseContext, priorRunId: string, seedIds: string[]): string[] {
    const paths = new Set<string>();
    for (const seed of seedIds) {
      try {
        const rows = ctx.engine.db.prepare(`
          SELECT content FROM governed_stream
          WHERE workflow_run_id = ? AND is_current_version = 1
            AND record_type = 'file_system_write_record'
            AND derived_from_record_ids LIKE ?
        `).all(priorRunId, `%"${seed}"%`) as Array<{ content: string }>;
        for (const row of rows) {
          try {
            const fp = (JSON.parse(row.content) as Record<string, unknown>).file_path;
            if (typeof fp === 'string' && fp.length > 0) paths.add(fp);
          } catch { /* skip unparseable */ }
        }
      } catch { /* table/schema drift — skip */ }
    }
    return [...paths];
  }

  // ── Cascade threshold (deterministic + human menu) ──────────────

  private async resolveCascadeThreshold(
    ctx: PhaseContext,
    impactRecordId: string,
    impact: { affectedArtifactIds: string[]; affectedFilePaths: string[] },
    cfg: { cascade_threshold_task_count: number; cascade_threshold_file_count: number },
  ): Promise<{ artifactIds: string[]; reviseTo?: PhaseId; abandoned?: boolean }> {
    const { engine, workflowRun } = ctx;
    const runId = workflowRun.id;
    const artifactIds: string[] = [];

    const bundle = engine.writer.writeRecord({
      record_type: 'decision_bundle_presented',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '0.5',
      sub_phase_id: 'impact_enumeration',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [impactRecordId],
      content: {
        surface_id: 'cascade-threshold',
        title: 'Cascade threshold exceeded',
        summary: `The proposed interface change would require modifying ${impact.affectedArtifactIds.length} task(s) across ${impact.affectedFilePaths.length} file(s) — exceeding the cascade threshold (${cfg.cascade_threshold_task_count} tasks / ${cfg.cascade_threshold_file_count} files).`,
        menu: {
          options: [
            { id: OPT_CASCADE_PROCEED, label: 'Proceed — accept the full refactoring scope' },
            { id: OPT_CASCADE_REDESIGN, label: 'Redesign the interface change to reduce cascade impact' },
            { id: OPT_CASCADE_ABANDON, label: 'Abandon this interface change; pursue an additive approach' },
          ],
        },
      },
    });
    artifactIds.push(bundle.id);

    const resolution = await engine.pauseForDecision(runId, bundle.id, 'decision_bundle');
    const chosen = this.firstMenuOption(resolution) ?? OPT_CASCADE_PROCEED;

    const decision = engine.writer.writeRecord({
      record_type: 'cascade_threshold_decision',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '0.5',
      sub_phase_id: 'impact_enumeration',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [impactRecordId, bundle.id],
      content: {
        kind: 'cascade_threshold_decision',
        cross_run_impact_report_id: impactRecordId,
        resolution: chosen,
        task_count: impact.affectedArtifactIds.length,
        file_count: impact.affectedFilePaths.length,
      },
    });
    engine.ingestionPipeline.ingest(decision);
    artifactIds.push(decision.id);

    if (chosen === OPT_CASCADE_REDESIGN) return { artifactIds, reviseTo: '1' };
    if (chosen === OPT_CASCADE_ABANDON) return { artifactIds, abandoned: true };
    return { artifactIds };
  }

  // ── 0.5.2 refactoring decision (human menu) ─────────────────────

  private async resolveRefactoringDecision(
    ctx: PhaseContext,
    impactRecordId: string,
    impact: { modificationType: ModificationType; affectedArtifactIds: string[] },
  ): Promise<string> {
    const { engine, workflowRun } = ctx;
    const runId = workflowRun.id;

    const bundle = engine.writer.writeRecord({
      record_type: 'decision_bundle_presented',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '0.5',
      sub_phase_id: 'refactoring_decision',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: [impactRecordId],
      content: {
        surface_id: 'refactoring-decision',
        title: 'Cross-run refactoring decision',
        summary: `The override is a ${impact.modificationType} change affecting ${impact.affectedArtifactIds.length} prior-run artifact(s). Choose how to resolve.`,
        menu: {
          options: [
            { id: OPT_PROCEED, label: 'Proceed — add Refactoring Tasks to update affected prior-run artifacts' },
            { id: OPT_REVISE, label: 'Revise the override — return to Phase 1 to reconsider' },
            { id: OPT_ACCEPT_DIVERGENCE, label: 'Accept divergence — document as known technical debt' },
          ],
        },
      },
    });

    const resolution = await engine.pauseForDecision(runId, bundle.id, 'decision_bundle');
    // Headless / no-selection default = Proceed (matches the auto-approve
    // "accept the recommended path" convention).
    return this.firstMenuOption(resolution) ?? OPT_PROCEED;
  }

  private buildRefactoringTasks(
    ctx: PhaseContext,
    trigger: CrossRunImpactTrigger,
    impact: ImpactResult,
    impactReportId: string,
  ): RefactoringTask[] {
    const writeDirs = impact.affectedFilePaths;
    const tasks: RefactoringTask[] = [];
    // One Refactoring Task per affected prior-run artifact. When no artifact
    // was found (e.g. the prior run never produced downstream implementations
    // yet), emit a single task targeting the interface itself so the change
    // is still tracked end-to-end through Phase 6/9/10.
    const targets = impact.affectedArtifactIds.length > 0
      ? impact.affectedArtifactIds
      : [trigger.changedInterfaceId];

    targets.forEach((targetId, idx) => {
      tasks.push({
        id: `REFACTOR-${idx + 1}`,
        task_type: 'refactoring',
        target_artifact_id: targetId,
        target_workflow_run_id: trigger.priorWorkflowRunId,
        changed_interface_id: trigger.changedInterfaceId,
        description: `Update the prior-run implementation for the ${impact.modificationType} change to the ${trigger.interfaceKind} (see the Refactoring Instructions for the before/after and the affected members).`,
        backing_tool: 'claude_code_cli',
        dependency_task_ids: [],
        expected_pre_state_hash: this.hashFirstResolvableFile(impact.affectedFilePaths),
        verification_step: `Confirm the implementation conforms to the NEW ${trigger.interfaceKind} definition (members removed: ${impact.diff.removed.length}, retyped: ${impact.diff.retyped.length}, added: ${impact.diff.added.length}).`,
        modification_type: impact.modificationType,
        write_directory_paths: writeDirs,
        derived_from_record_ids: [impactReportId],
        implementation_notes: 'Generated by Phase 0.5.2 (Proceed). Idempotency enforced via expected_pre_state_hash at Phase 9.1.',
        refactoring_instructions: this.renderRefactoringInstructions(trigger, impact),
      });
    });
    return tasks;
  }

  /**
   * Render the self-contained refactoring directive the executor actually
   * needs: what the interface WAS, what specifically changed, what it must
   * become, and which file(s) to touch. Resolved here because the CLI agent
   * has no path back to the governed stream to dereference record ids.
   */
  private renderRefactoringInstructions(trigger: CrossRunImpactTrigger, impact: ImpactResult): string {
    const list = (xs: string[]) => (xs.length > 0 ? xs.join(', ') : '(none)');
    const files = impact.affectedFilePaths.length > 0
      ? impact.affectedFilePaths.map(p => `- ${p}`).join('\n')
      : '(no prior-run file path resolved — locate the code implementing the interface below and apply the change there)';
    const newDefBlock = impact.newDef
      ? '```json\n' + this.capJson(impact.newDef) + '\n```'
      : '(the human override provided no structured definition — see the statement above; treat the listed member changes as authoritative)';
    const oldDefBlock = impact.oldDef
      ? '```json\n' + this.capJson(impact.oldDef) + '\n```'
      : '(previous definition unavailable)';

    return [
      '## Cross-Run Refactoring Instruction',
      '',
      `A human changed a governing **${trigger.interfaceKind}** that a PRIOR Workflow Run had locked and shipped. Update the implementation so it conforms to the NEW definition. This is a **${impact.modificationType}** change.`,
      '',
      '### What specifically changed',
      `- Removed members: ${list(impact.diff.removed)}`,
      `- Retyped / changed members: ${list(impact.diff.retyped)}`,
      `- Added members: ${list(impact.diff.added)}`,
      '',
      '### Previous definition (what the prior run implemented)',
      oldDefBlock,
      '',
      '### New definition (the human\'s revised position — AUTHORITATIVE)',
      newDefBlock,
      '',
      '### Target file(s) to update',
      files,
      '',
      'Apply ONLY the change described above. Do not re-implement unrelated behaviour. Honor the idempotency protocol (pre-state hash) in the Refactoring Idempotency Constraint.',
    ].join('\n');
  }

  /** JSON-stringify a definition for inlining, capped so a huge artifact
   *  doesn't blow the executor's stdin budget. */
  private capJson(value: unknown, maxChars = 4000): string {
    let s: string;
    try { s = JSON.stringify(value, null, 2); } catch { return '(unserializable)'; }
    return s.length > maxChars ? `${s.slice(0, maxChars)}\n… [truncated ${s.length - maxChars} chars]` : s;
  }

  /** sha256 of the first affected file that exists on disk, else '' (spec: prior file may be absent in a fresh checkout). */
  private hashFirstResolvableFile(paths: string[]): string {
    for (const p of paths) {
      try {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          return createHash('sha256').update(fs.readFileSync(p)).digest('hex');
        }
      } catch { /* unreadable — try next */ }
    }
    return '';
  }

  // ── Shared helpers ──────────────────────────────────────────────

  /** Phase Gate (spec §4 Phase 0.5 gate criteria). Certified by the engine's
   *  generic simulate / DecisionRouter path; advance 0.5 → 2 happens there. */
  private writeGate(ctx: PhaseContext, derivedFrom: string[]): string {
    const { engine, workflowRun } = ctx;
    const gate = engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '0.5',
      sub_phase_id: 'refactoring_decision',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: derivedFrom,
      content: {
        kind: 'phase_gate',
        phase_id: '0.5',
        has_unresolved_warnings: false,
        has_unapproved_proposals: false,
        has_high_severity_flaws: false,
      },
    });
    engine.eventBus.emit('phase_gate:pending', { phaseId: '0.5' });
    aoddEmit('gate.pending', { gate_kind: 'phase_gate' });
    return gate.id;
  }

  /** Extract the first chosen menu option_id from a decision-bundle resolution. */
  private firstMenuOption(resolution: { payload?: Record<string, unknown> } | undefined): string | undefined {
    const sels = resolution?.payload?.menu_selections;
    if (Array.isArray(sels) && sels.length > 0) {
      const opt = (sels[0] as Record<string, unknown>)?.option_id;
      if (typeof opt === 'string' && opt.length > 0) return opt;
    }
    return undefined;
  }
}
