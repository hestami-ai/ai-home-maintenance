/**
 * Wave R — wave-completion gate.
 *
 * Generates the gate mirror at the end of each wave and turns the
 * human (or auto-approve) decision into a `wave_gate_decision` record
 * that the scheduler keys advancement on.
 */

import type { OrchestratorEngine } from './orchestratorEngine';
import type {
  ExecutionWaveCompletedContent,
  ExecutionWaveKind,
  WaveGateDecisionContent,
  WaveGateDecisionKind,
} from '../types/records';
import { getLogger } from '../logging';
import type { WaveDiffSummary } from './workspaceSnapshot';
import { revertWaveSnapshot } from './workspaceSnapshot';
import { emit as aoddEmit } from '../aodd';

export interface WaveGateInput {
  workflowRunId: string;
  janumiCodeVersionSha: string;
  waveNumber: number;
  waveKind: ExecutionWaveKind;
  releaseId: string | null;
  releaseOrdinal: number | null;
  releaseName?: string;
  completedSummary: ExecutionWaveCompletedContent;
  diffSummary: WaveDiffSummary;
  /** Auto-approve flag from config; calibration sets true for unattended runs. */
  autoApprove: boolean;
}

export interface WaveGateOutcome {
  decision: WaveGateDecisionKind;
  reason?: string;
  rolledBack: boolean;
  decisionRecordId: string;
}

export class WaveGate {
  constructor(private readonly engine: OrchestratorEngine) {}

  async runGate(input: WaveGateInput): Promise<WaveGateOutcome> {
    const summary = input.completedSummary;
    const fields = this.buildMirrorFields(input);
    const mirror = this.engine.mirrorGenerator.generate({
      artifactId: input.workflowRunId,
      artifactType: 'execution_wave',
      content: fields,
    });

    const mirrorRecord = this.engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: input.workflowRunId,
      phase_id: '9',
      sub_phase_id: '9.5',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: input.janumiCodeVersionSha,
      derived_from_record_ids: [],
      content: {
        kind: 'execution_wave_gate_mirror',
        mirror_id: mirror.mirrorId,
        wave_number: input.waveNumber,
        wave_kind: input.waveKind,
        release_id: input.releaseId,
        release_ordinal: input.releaseOrdinal,
        release_name: input.releaseName,
        leaf_count: summary.leaf_count,
        successful_count: summary.successful_count,
        quarantined_count: summary.quarantined_count,
        files_written_count: summary.files_written_count ?? input.diffSummary.created,
        files_modified_count: summary.files_modified_count ?? input.diffSummary.modified,
        files_deleted_count: summary.files_deleted_count ?? input.diffSummary.deleted,
        test_summary: summary.test_summary,
        reasoning_review_summary: summary.reasoning_review_summary,
        fields: mirror.fields,
      },
    });
    this.engine.eventBus.emit('mirror:presented', {
      mirrorId: mirror.mirrorId,
      artifactType: 'execution_wave',
    });
    aoddEmit('mirror.presented', {
      mirror_id: mirror.mirrorId,
      artifact_type: 'execution_wave',
    });

    let decisionKind: WaveGateDecisionKind;
    let reason: string | undefined;
    let rolledBack = false;

    if (input.autoApprove) {
      decisionKind = 'auto_approved';
      reason = 'auto_approve_wave_gates=true';
      getLogger().info('workflow', 'Wave R: gate auto-approved', {
        wave_number: input.waveNumber, wave_kind: input.waveKind,
      });
    } else {
      try {
        const resolution = await this.engine.pauseForDecision(
          input.workflowRunId, mirrorRecord.id, 'mirror',
        );
        if (resolution.type === 'mirror_rejection') {
          decisionKind = 'rejected';
          reason = (resolution.payload?.reason as string | undefined) ?? 'rejected';
          getLogger().warn('workflow', 'Wave R: gate rejected — reverting wave snapshot', {
            wave_number: input.waveNumber, reason,
          });
          const revert = revertWaveSnapshot(input.diffSummary);
          rolledBack = true;
          getLogger().info('workflow', 'Wave R: snapshot reverted', {
            wave_number: input.waveNumber, reverted: revert.reverted, failed: revert.failed.length,
          });
        } else {
          const investigated = (resolution.payload?.investigated as boolean | undefined) ?? false;
          decisionKind = investigated ? 'investigated_then_approved' : 'approved';
          reason = (resolution.payload?.reason as string | undefined);
        }
      } catch (err) {
        getLogger().warn('workflow', 'Wave R: pauseForDecision failed; treating as approved', {
          error: err instanceof Error ? err.message : String(err),
        });
        decisionKind = 'approved';
        reason = 'pauseForDecision_error';
      }
    }

    const decisionContent: WaveGateDecisionContent = {
      kind: 'wave_gate_decision',
      wave_number: input.waveNumber,
      release_id: input.releaseId,
      release_ordinal: input.releaseOrdinal,
      wave_kind: input.waveKind,
      decision: decisionKind,
      reason,
      rolled_back: rolledBack,
      decided_at: new Date().toISOString(),
      decided_by: input.autoApprove ? 'auto' : 'human',
    };
    const decisionRecord = this.engine.writer.writeRecord({
      record_type: 'wave_gate_decision',
      schema_version: '1.0',
      workflow_run_id: input.workflowRunId,
      phase_id: '9',
      sub_phase_id: '9.5',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: input.janumiCodeVersionSha,
      derived_from_record_ids: [mirrorRecord.id],
      content: decisionContent as unknown as Record<string, unknown>,
    });

    return {
      decision: decisionKind,
      reason,
      rolledBack,
      decisionRecordId: decisionRecord.id,
    };
  }

  private buildMirrorFields(input: WaveGateInput): Record<string, unknown> {
    const s = input.completedSummary;
    const d = input.diffSummary;
    let releaseLabel: string;
    if (input.releaseName) {
      const ordinalSuffix = input.releaseOrdinal != null ? ` (ordinal ${input.releaseOrdinal})` : '';
      releaseLabel = `${input.releaseName}${ordinalSuffix}`;
    } else if (input.waveKind === 'deferred_batch') {
      releaseLabel = 'Deferred-batch retry';
    } else if (input.waveKind === 'single') {
      releaseLabel = 'Single-wave run (no release plan)';
    } else {
      releaseLabel = `Wave ${input.waveNumber}`;
    }
    return {
      wave_number: input.waveNumber,
      wave_kind: input.waveKind,
      release: releaseLabel,
      leaf_count: s.leaf_count,
      successful_count: s.successful_count,
      quarantined_count: s.quarantined_count,
      files: {
        created: d.created,
        modified: d.modified,
        deleted: d.deleted,
      },
      test_summary: s.test_summary,
      reasoning_review_summary: s.reasoning_review_summary,
    };
  }
}
