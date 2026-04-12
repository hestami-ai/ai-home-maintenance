/**
 * Shared utilities for phase handlers.
 * Reduces boilerplate across Phase 2-10 implementations.
 */

import type { OrchestratorEngine, PhaseResult } from '../orchestratorEngine';
import type { GovernedStreamRecord } from '../../types/records';
import type { SerializedRecord } from '../../events/eventBus';
import { getLogger } from '../../logging';

/**
 * Write an artifact, validate it, ingest it, and emit an event.
 * Returns the record or null if schema validation fails.
 */
export function writeAndIngestArtifact(
  engine: OrchestratorEngine,
  opts: {
    artifactType: string;
    workflowRunId: string;
    phaseId: string;
    subPhaseId: string;
    agentRole: string;
    content: Record<string, unknown>;
    derivedFromIds?: string[];
  },
): GovernedStreamRecord | null {
  // Validate against schema if available
  if (engine.schemaValidator.hasSchema(opts.artifactType)) {
    const validation = engine.schemaValidator.validate(opts.artifactType, opts.content);
    if (!validation.valid) {
      getLogger().warn('validation', `Schema validation failed for artifact`, {
        artifact_type: opts.artifactType,
        errors: validation.errors,
      });
      // Don't block — write anyway but log the issue
    }
  }

  const record = engine.writer.writeRecord({
    record_type: 'artifact_produced',
    schema_version: '1.0',
    workflow_run_id: opts.workflowRunId,
    phase_id: opts.phaseId,
    sub_phase_id: opts.subPhaseId,
    produced_by_agent_role: opts.agentRole as GovernedStreamRecord['produced_by_agent_role'],
    janumicode_version_sha: engine.janumiCodeVersionSha,
    derived_from_record_ids: opts.derivedFromIds,
    content: opts.content,
  });

  engine.ingestionPipeline.ingest(record);
  engine.eventBus.emit('record:added', { record: serializeRecord(record) });

  return record;
}

/**
 * Emit a Mirror for an artifact and wait for human interaction.
 */
export function presentMirror(
  engine: OrchestratorEngine,
  artifactId: string,
  artifactType: string,
  content: Record<string, unknown>,
): void {
  const mirror = engine.mirrorGenerator.generate({
    artifactId,
    artifactType,
    content,
  });

  engine.eventBus.emit('mirror:presented', {
    mirrorId: mirror.mirrorId,
    artifactType,
  });
}

export function serializeRecord(record: GovernedStreamRecord): SerializedRecord {
  return {
    id: record.id,
    record_type: record.record_type,
    phase_id: record.phase_id,
    sub_phase_id: record.sub_phase_id,
    produced_by_agent_role: record.produced_by_agent_role,
    produced_at: record.produced_at,
    authority_level: record.authority_level,
    quarantined: record.quarantined,
    derived_from_record_ids: record.derived_from_record_ids ?? [],
    content: record.content,
  };
}

export function failResult(error: string): PhaseResult {
  return { success: false, error, artifactIds: [] };
}

/**
 * Load and render a prompt template from the TemplateLoader.
 * This is the single entry point for phase handlers to build prompts —
 * ensures production and probe tests use the same .md file.
 *
 * Returns the rendered prompt string, or null if the template is missing.
 */
export function renderTemplate(
  engine: OrchestratorEngine,
  templateKey: string,
  variables: Record<string, string>,
): string | null {
  const template = engine.templateLoader.getTemplate(templateKey);
  if (!template) {
    getLogger().warn('context', `Template not found: ${templateKey}`);
    return null;
  }

  const result = engine.templateLoader.render(template, {
    ...variables,
    janumicode_version_sha: engine.janumiCodeVersionSha,
  });

  if (result.missing_variables.length > 0) {
    getLogger().warn('context', `Template ${templateKey} missing variables`, {
      missing: result.missing_variables,
    });
  }

  return result.rendered;
}
