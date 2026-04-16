/**
 * Phase 0 — Workspace Initialization.
 * Based on JanumiCode Spec v2.3, §4 Phase 0.
 *
 * Sub-phases:
 *   0.1  — Workspace Classification (greenfield/brownfield)
 *   0.1b — External Reference Resolution (JanumiCode extension — resolves
 *          explicit file references in the raw intent so downstream phases
 *          have the actual content, not just a filename)
 *   0.2  — Artifact Ingestion (brownfield only) — scans workspace, writes
 *          external_file_ingested records, produces ingested_artifact_index
 *   0.2b — Brownfield Continuity Check (brownfield only) — produces
 *          prior_decision_summary via Deep Memory Research
 *   0.4  — Vocabulary Collision Check
 *
 * Phase Gate: workspace_classification valid, collision_risk_report
 * produced, human approved.
 */

import type { PhaseHandler, PhaseContext, PhaseResult } from '../orchestratorEngine';
import type { PhaseId } from '../../types/records';
import { getLogger } from '../../logging';
import {
  scanWorkspace, hasExistingArtifacts, readFileContent,
  type ScannedFile,
} from '../../workspace/workspaceScanner';
import { resolveAllReferences, type ResolvedReference } from '../../workspace/referenceResolver';

export class Phase0Handler implements PhaseHandler {
  readonly phaseId: PhaseId = '0';

  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const { workflowRun, engine } = ctx;
    const artifactIds: string[] = [];
    const workspacePath = engine.workspacePath;

    // ── Sub-Phase 0.1 — Workspace Classification ────────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '0.1');

    // Brownfield = any existing workspace content outside the .janumicode/
    // directory. This is filesystem-aware, not just DB-aware — the v1
    // behavior of checking prior workflow runs misclassified workspaces
    // that already had source code but no JanumiCode history.
    const hasFiles = hasExistingArtifacts(workspacePath);
    const workspaceType: 'greenfield' | 'brownfield' = hasFiles ? 'brownfield' : 'greenfield';

    const classificationContent = {
      kind: 'workspace_classification' as const,
      workspace_type: workspaceType,
      janumicode_version_sha: engine.janumiCodeVersionSha,
      existing_artifact_count: 0, // Populated in 0.2 for brownfield
      prior_workflow_run_count: 0,
    };

    const classificationValidation = engine.schemaValidator.validate(
      'workspace_classification', classificationContent,
    );
    if (!classificationValidation.valid) {
      return {
        success: false,
        error: `workspace_classification schema validation failed: ${classificationValidation.errors.map(e => e.message).join(', ')}`,
        artifactIds,
      };
    }

    const classificationRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '0',
      sub_phase_id: '0.1',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: classificationContent,
    });
    artifactIds.push(classificationRecord.id);
    engine.ingestionPipeline.ingest(classificationRecord);

    // ── Sub-Phase 0.1b — External Reference Resolution ──────────
    // Resolve explicit file references from the raw intent so Phase 1 can
    // bloom from actual content, not a filename. Runs in both greenfield
    // and brownfield — if the human says "Review specs/foo.md", we read
    // specs/foo.md regardless of whether the rest of the workspace is empty.
    engine.stateMachine.setSubPhase(workflowRun.id, '0.1b');

    const resolvedRefs = await this.runReferenceResolution(ctx, workspacePath);
    for (const id of resolvedRefs.ingestedRecordIds) artifactIds.push(id);

    // ── Sub-Phase 0.2 — Artifact Ingestion (brownfield only) ────
    let ingestedIndex: { recordIds: string[]; totalFiles: number } = { recordIds: [], totalFiles: 0 };
    if (workspaceType === 'brownfield') {
      engine.stateMachine.setSubPhase(workflowRun.id, '0.2');
      ingestedIndex = await this.runArtifactIngestion(ctx, workspacePath, resolvedRefs.resolvedPaths);
      for (const id of ingestedIndex.recordIds) artifactIds.push(id);

      // ── Sub-Phase 0.2b — Brownfield Continuity Check ──────────
      engine.stateMachine.setSubPhase(workflowRun.id, '0.2b');
      const continuityId = await this.runBrownfieldContinuityCheck(ctx);
      if (continuityId) artifactIds.push(continuityId);
    }

    // ── Sub-Phase 0.4 — Vocabulary Collision Check ──────────────
    engine.stateMachine.setSubPhase(workflowRun.id, '0.4');

    const collisionContent = {
      kind: 'collision_risk_report' as const,
      aliases: [],
      collision_risks: [],
      overall_status: 'clean' as const,
    };

    const collisionValidation = engine.schemaValidator.validate(
      'collision_risk_report', collisionContent,
    );
    if (!collisionValidation.valid) {
      return { success: false, error: `collision_risk_report schema validation failed`, artifactIds };
    }

    const collisionRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '0',
      sub_phase_id: '0.4',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: collisionContent,
    });
    artifactIds.push(collisionRecord.id);
    engine.ingestionPipeline.ingest(collisionRecord);

    return { success: true, artifactIds };
  }

  /**
   * Sub-Phase 0.1b — Resolve explicit file references in the raw intent.
   * Writes one `external_file_ingested` artifact per successfully-resolved
   * reference. Missing/unreadable references are recorded as warnings but
   * do not block the pipeline — the human will see them surface at the
   * Phase 1.0 Intent Quality Check.
   */
  private async runReferenceResolution(
    ctx: PhaseContext,
    workspacePath: string,
  ): Promise<{ ingestedRecordIds: string[]; resolvedPaths: Set<string> }> {
    const { workflowRun, engine } = ctx;
    const rawIntents = engine.writer.getRecordsByType(workflowRun.id, 'raw_intent_received');
    if (rawIntents.length === 0) {
      return { ingestedRecordIds: [], resolvedPaths: new Set() };
    }

    const rawText = typeof rawIntents[0].content.text === 'string'
      ? rawIntents[0].content.text
      : JSON.stringify(rawIntents[0].content);

    const resolved = resolveAllReferences(rawText, workspacePath);
    if (resolved.length === 0) {
      return { ingestedRecordIds: [], resolvedPaths: new Set() };
    }

    const ingestedRecordIds: string[] = [];
    const resolvedPaths = new Set<string>();

    for (const ref of resolved) {
      const record = this.writeResolvedReference(ctx, ref);
      if (record) {
        ingestedRecordIds.push(record);
        if (ref.relativePath) resolvedPaths.add(ref.relativePath);
      }
    }

    getLogger().info('phase0', 'Resolved external references from raw intent', {
      total: resolved.length,
      resolved: resolved.filter(r => r.status === 'resolved').length,
      missing: resolved.filter(r => r.status === 'not_found').length,
    });

    return { ingestedRecordIds, resolvedPaths };
  }

  private writeResolvedReference(
    ctx: PhaseContext,
    ref: ResolvedReference,
  ): string | null {
    const { workflowRun, engine } = ctx;

    // Only write records for successfully-resolved files. Missing references
    // are surfaced later via Phase 1.0 Quality Check — writing a record for
    // every unresolved mention would be noisy.
    if (ref.status !== 'resolved' || !ref.absolutePath || !ref.relativePath) {
      if (ref.status === 'not_found') {
        getLogger().warn('phase0', 'Referenced file not found', {
          reference: ref.reference.referenceText,
          note: ref.note,
        });
      }
      return null;
    }

    const content = {
      kind: 'external_file_ingested' as const,
      path: ref.absolutePath,
      relative_path: ref.relativePath,
      size_bytes: ref.sizeBytes ?? 0,
      content: ref.content ?? '',
      truncated: ref.truncated,
      content_limit_bytes: 256 * 1024,
      file_type: ref.type ?? 'other',
      language: ref.language,
      ingested_via: 'explicit_reference' as const,
      reference_text: ref.reference.referenceText,
    };

    const validation = engine.schemaValidator.validate('external_file_ingested', content);
    if (!validation.valid) {
      getLogger().warn('phase0', 'external_file_ingested validation failed', {
        path: ref.relativePath,
        errors: validation.errors,
      });
      return null;
    }

    const rec = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '0',
      sub_phase_id: '0.1b',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content,
    });
    engine.ingestionPipeline.ingest(rec);
    return rec.id;
  }

  /**
   * Sub-Phase 0.2 — Scan the workspace and ingest artifacts as governed
   * stream records so DMR can retrieve them in later phases.
   *
   * Respects the exclusion set from reference resolution so we don't
   * double-ingest files that were already captured via explicit reference.
   */
  private async runArtifactIngestion(
    ctx: PhaseContext,
    workspacePath: string,
    alreadyIngested: Set<string>,
  ): Promise<{ recordIds: string[]; totalFiles: number }> {
    const { workflowRun, engine } = ctx;

    // Prefer spec/doc/config/source in that order; cap total ingestion so
    // we don't blow up on large workspaces.
    const scan = scanWorkspace(workspacePath, {
      maxFiles: 500,
      maxFileSizeBytes: 1 * 1024 * 1024, // 1MB cap per file during ingestion
    });

    const priorityOrder: Record<string, number> = {
      spec: 0, doc: 1, config: 2, source: 3, data: 4, other: 5,
    };
    const files = scan.files
      .filter(f => !alreadyIngested.has(f.relativePath))
      .sort((a, b) => (priorityOrder[a.type] ?? 9) - (priorityOrder[b.type] ?? 9))
      .slice(0, 200); // Hard cap — DMR uses sampling + retrieval for the rest

    const ingestedRecordIds: string[] = [];
    for (const file of files) {
      const recordId = this.writeScannedFile(ctx, file);
      if (recordId) ingestedRecordIds.push(recordId);
    }

    const indexContent = {
      kind: 'ingested_artifact_index' as const,
      workspace_root: workspacePath,
      total_files: scan.totalFiles,
      files_by_type: scan.filesByType,
      ingested_record_ids: ingestedRecordIds,
      skipped_files: scan.skipped.slice(0, 50),
    };

    const indexValidation = engine.schemaValidator.validate(
      'ingested_artifact_index', indexContent,
    );
    if (!indexValidation.valid) {
      getLogger().warn('phase0', 'ingested_artifact_index validation failed', {
        errors: indexValidation.errors,
      });
      return { recordIds: ingestedRecordIds, totalFiles: scan.totalFiles };
    }

    const indexRecord = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '0',
      sub_phase_id: '0.2',
      produced_by_agent_role: 'deep_memory_research',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      derived_from_record_ids: ingestedRecordIds,
      content: indexContent,
    });
    engine.ingestionPipeline.ingest(indexRecord);

    return {
      recordIds: [...ingestedRecordIds, indexRecord.id],
      totalFiles: scan.totalFiles,
    };
  }

  private writeScannedFile(ctx: PhaseContext, file: ScannedFile): string | null {
    const { workflowRun, engine } = ctx;
    if (!file.isText) return null;

    const read = readFileContent(file, 256 * 1024);
    if (!read) return null;

    const content = {
      kind: 'external_file_ingested' as const,
      path: file.absolutePath,
      relative_path: file.relativePath,
      size_bytes: file.sizeBytes,
      content: read.content,
      truncated: read.truncated,
      content_limit_bytes: 256 * 1024,
      file_type: file.type,
      language: file.language,
      ingested_via: 'workspace_scan' as const,
    };

    const validation = engine.schemaValidator.validate('external_file_ingested', content);
    if (!validation.valid) return null;

    const rec = engine.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: workflowRun.id,
      phase_id: '0',
      sub_phase_id: '0.2',
      produced_by_agent_role: 'deep_memory_research',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content,
    });
    engine.ingestionPipeline.ingest(rec);
    return rec.id;
  }

  /**
   * Sub-Phase 0.2b — Invoke DMR to produce a prior_decision_summary from
   * all prior workflow runs. Runs only in brownfield. Skipped silently if
   * there are no prior runs in the workspace.
   */
  private async runBrownfieldContinuityCheck(ctx: PhaseContext): Promise<string | null> {
    const { workflowRun, engine } = ctx;

    // Check if there are any prior workflow runs to summarize
    interface RunRow { id: string }
    const priorRuns = engine.db.prepare(
      `SELECT id FROM workflow_runs WHERE id != ? ORDER BY initiated_at DESC LIMIT 50`,
    ).all(workflowRun.id) as RunRow[];

    if (priorRuns.length === 0) {
      // Nothing to summarize — write an empty summary for schema completeness
      const content = {
        kind: 'prior_decision_summary' as const,
        total_prior_runs: 0,
        active_constraints: [],
        decision_traces: [],
        superseded_items: [],
        coverage_confidence: 1.0,
      };
      const rec = engine.writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: workflowRun.id,
        phase_id: '0',
        sub_phase_id: '0.2b',
        produced_by_agent_role: 'deep_memory_research',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        content,
      });
      engine.ingestionPipeline.ingest(rec);
      return rec.id;
    }

    // Invoke DMR with all_runs scope to build the continuity summary
    try {
      const packet = await engine.deepMemoryResearch.research({
        requestingAgentRole: 'orchestrator',
        scopeTier: 'all_runs',
        query: 'All active constraints, governing decisions, and supersessions across prior workflow runs',
        knownRelevantRecordIds: [],
        workflowRunId: workflowRun.id,
        phaseId: '0',
        subPhaseId: '0.2b',
      });

      const content = {
        kind: 'prior_decision_summary' as const,
        total_prior_runs: priorRuns.length,
        active_constraints: packet.activeConstraints,
        decision_traces: [],
        superseded_items: packet.supersessionChains.map(sc => ({
          subject: sc.subject,
          current_record_id: sc.chain.find(e => e.position === 'current_governing')?.recordId ?? '',
          superseded_record_ids: sc.chain.filter(e => e.position === 'superseded').map(e => e.recordId),
        })),
        coverage_confidence: packet.coverageAssessment.confidence,
      };

      const validation = engine.schemaValidator.validate('prior_decision_summary', content);
      if (!validation.valid) {
        getLogger().warn('phase0', 'prior_decision_summary validation failed', {
          errors: validation.errors,
        });
        return null;
      }

      const rec = engine.writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: workflowRun.id,
        phase_id: '0',
        sub_phase_id: '0.2b',
        produced_by_agent_role: 'deep_memory_research',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        content,
      });
      engine.ingestionPipeline.ingest(rec);
      return rec.id;
    } catch (err) {
      getLogger().warn('phase0', 'Brownfield continuity check failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}

