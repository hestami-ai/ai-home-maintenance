/**
 * MitigationEngine — apply deterministic mutations to an artifact in
 * response to HIGH validator findings under `auto_mitigation_policy='auto'`.
 *
 * The engine is the closed-loop counterpart to the reasoning-review
 * harness: the harness detects violations, the engine acts on the subset
 * that have machine-resolvable targets (validator-emitted `targetField`
 * and `targetIdentifier`). Mutations are recorded as
 * `auto_mitigation_action` governed-stream records for audit and
 * potential rollback.
 *
 * v1 scope (see study/auto-mitigation-design.md):
 *   - Drop mutations only
 *   - Handler registered for `spec_boundary_respect_bloom`
 *   - Other validators' findings stay advisory
 *
 * Architectural notes:
 *   - The engine is separate from the harness. The harness returns
 *     findings; the engine acts on them. Audit trail stays clean.
 *   - Handlers are keyed by `validatorId`. A validator without a
 *     registered handler is a no-op (findings remain advisory).
 *   - The engine MUTATES the artifact in place. Callers that need the
 *     original should clone before invoking.
 *   - All mutations are recorded as audit records via the writer.
 */

import type { GovernedStreamWriter } from '../../orchestrator/governedStreamWriter';
import type { ValidatorFinding } from '../harness/validatorRegistry';
import type { AutoMitigationActionContent } from '../../types/records';
import { specBoundaryDropHandler } from './handlers/specBoundaryDrop';
import { getLogger } from '../../logging';

export type MitigationActionType = 'drop' | 'replace' | 'retry' | 'skip';

export interface MitigationAction {
  actionType: MitigationActionType;
  validatorId: string;
  findingType: string;
  targetField: string;
  targetIdentifier: string;
  rationale: string;
  beforeValue: unknown;
  afterValue: unknown;
}

/**
 * Handler signature: given the finding and the (mutable) artifact, return
 * the action describing what changed, or null if the handler chose not to
 * act (e.g., the target couldn't be resolved). The handler MUST mutate
 * the artifact in place — the returned action's `beforeValue` and
 * `afterValue` are for audit.
 */
export type MitigationHandler = (
  finding: ValidatorFinding,
  artifact: Record<string, unknown>,
) => MitigationAction | null;

const DEFAULT_HANDLERS: ReadonlyMap<string, MitigationHandler> = new Map([
  ['spec_boundary_respect_bloom', specBoundaryDropHandler],
]);

export interface MitigationEngineConfig {
  /** Override the default handler registry. Tests use this. */
  handlers?: ReadonlyMap<string, MitigationHandler>;
}

export interface MitigationContext {
  writer: GovernedStreamWriter;
  workflowRunId: string;
  phaseId: string | null;
  subPhaseId: string | null;
  janumiCodeVersionSha: string;
  /**
   * Record id of the artifact being mitigated. Used to link
   * auto_mitigation_action records back to their source artifact.
   */
  sourceArtifactRecordId: string;
  /**
   * Map of finding object → governed-stream record id. The harness
   * writes a `reasoning_review_finding_record` for each finding; we
   * cite that record id in the audit trail.
   */
  findingRecordIds: ReadonlyMap<ValidatorFinding, string>;
}

export interface MitigationResult {
  /** Actions actually applied (handler returned non-null + mutation persisted). */
  actionsApplied: MitigationAction[];
  /** Findings the engine inspected but did not act on (no handler / no target / skip). */
  findingsSkipped: number;
}

export class MitigationEngine {
  private readonly handlers: ReadonlyMap<string, MitigationHandler>;

  constructor(config: MitigationEngineConfig = {}) {
    this.handlers = config.handlers ?? DEFAULT_HANDLERS;
  }

  /**
   * Apply mitigations to `artifact` for the HIGH-severity findings in
   * `findings` that have registered handlers. Mutates `artifact` in
   * place. Writes one `auto_mitigation_action` governed-stream record
   * per applied mutation.
   *
   * Skips findings that:
   *   - Are not HIGH severity (v1 acts only on HIGH)
   *   - Have no registered handler for the validator
   *   - Lack `targetField` or `targetIdentifier`
   *   - The handler returned null (couldn't resolve target)
   */
  apply(
    findings: readonly ValidatorFinding[],
    artifact: Record<string, unknown>,
    context: MitigationContext,
  ): MitigationResult {
    const result: MitigationResult = {
      actionsApplied: [],
      findingsSkipped: 0,
    };

    for (const finding of findings) {
      if (finding.severity !== 'HIGH') {
        result.findingsSkipped++;
        continue;
      }
      const handler = this.handlers.get(finding.validatorId);
      if (!handler) {
        result.findingsSkipped++;
        continue;
      }
      if (!finding.targetField || !finding.targetIdentifier) {
        getLogger().debug('workflow', 'mitigation skipped — finding lacks structured target', {
          validator_id: finding.validatorId,
          finding_type: finding.type,
        });
        result.findingsSkipped++;
        continue;
      }

      let action: MitigationAction | null;
      try {
        action = handler(finding, artifact);
      } catch (err) {
        getLogger().warn('workflow', 'mitigation handler threw', {
          validator_id: finding.validatorId,
          error: err instanceof Error ? err.message : String(err),
        });
        result.findingsSkipped++;
        continue;
      }
      if (!action) {
        result.findingsSkipped++;
        continue;
      }

      this.writeAuditRecord(action, finding, context);
      result.actionsApplied.push(action);
    }

    return result;
  }

  private writeAuditRecord(
    action: MitigationAction,
    finding: ValidatorFinding,
    context: MitigationContext,
  ): void {
    const findingRecordId = context.findingRecordIds.get(finding) ?? '';
    const content: AutoMitigationActionContent = {
      kind: 'auto_mitigation_action',
      source_artifact_id: context.sourceArtifactRecordId,
      finding_record_id: findingRecordId,
      validator_id: action.validatorId,
      finding_type: action.findingType,
      action_type: action.actionType,
      target_field: action.targetField,
      target_identifier: action.targetIdentifier,
      rationale: action.rationale,
      before_value: action.beforeValue,
      after_value: action.afterValue,
    };
    try {
      context.writer.writeRecord({
        record_type: 'auto_mitigation_action',
        schema_version: '1.0',
        workflow_run_id: context.workflowRunId,
        phase_id: context.phaseId,
        sub_phase_id: context.subPhaseId,
        produced_by_agent_role: 'orchestrator',
        produced_by_record_id: findingRecordId || null,
        janumicode_version_sha: context.janumiCodeVersionSha,
        derived_from_record_ids: findingRecordId
          ? [context.sourceArtifactRecordId, findingRecordId]
          : [context.sourceArtifactRecordId],
        content: content as unknown as Record<string, unknown>,
      });
    } catch (err) {
      getLogger().warn('workflow', 'failed to write auto_mitigation_action record', {
        validator_id: action.validatorId,
        target_identifier: action.targetIdentifier,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
