/**
 * Decision Trace Generator — aggregates all decision_trace records for a phase
 * into a decision_trace_summary.
 * Based on JanumiCode Spec v2.3, §15.3.
 *
 * Deterministic — no LLM call required.
 */

import type { Database } from '../database/init';
import type { GovernedStreamRecord, DecisionType } from '../types/records';

// ── Types ───────────────────────────────────────────────────────────

export interface DecisionTraceSummary {
  workflowRunId: string;
  phaseId: string;
  phaseName: string;
  decisions: DecisionEntry[];
  decisionCount: number;
  rollbackCount: number;
  priorDecisionOverrideCount: number;
  systemProposalApprovalCount: number;
  unstickingEscalationCount: number;
  domainAttestationConfirmed: boolean;
}

export interface DecisionEntry {
  decisionId: string;
  subPhaseId: string;
  decisionType: DecisionType;
  governedStreamRecordId: string;
  timestamp: string;
  contextPresented: string;
  humanSelection: string;
  rationaleCaptured: string;
}

// ── DecisionTraceGenerator ──────────────────────────────────────────

export class DecisionTraceGenerator {
  constructor(private readonly db: Database) {}

  /**
   * Generate a decision trace summary for a completed phase.
   * Purely deterministic — reads from the Governed Stream.
   */
  generate(workflowRunId: string, phaseId: string, phaseName: string): DecisionTraceSummary {
    const records = this.db.prepare(`
      SELECT * FROM governed_stream
      WHERE workflow_run_id = ?
        AND phase_id = ?
        AND record_type = 'decision_trace'
        AND is_current_version = 1
      ORDER BY produced_at ASC
    `).all(workflowRunId, phaseId) as Record<string, unknown>[];

    const decisions: DecisionEntry[] = [];
    let rollbackCount = 0;
    let priorDecisionOverrideCount = 0;
    let systemProposalApprovalCount = 0;
    let unstickingEscalationCount = 0;
    let domainAttestationConfirmed = false;

    for (const row of records) {
      const content = JSON.parse(row.content as string) as Record<string, unknown>;
      const decisionType = content.decision_type as DecisionType;

      decisions.push({
        decisionId: row.id as string,
        subPhaseId: (row.sub_phase_id as string) ?? '',
        decisionType,
        governedStreamRecordId: row.id as string,
        timestamp: row.produced_at as string,
        contextPresented: (content.context_presented as string) ?? '',
        humanSelection: (content.human_selection as string) ?? '',
        rationaleCaptured: (content.rationale_captured as string) ?? '',
      });

      // Count by type
      switch (decisionType) {
        case 'rollback_authorization':
          rollbackCount++;
          break;
        case 'prior_decision_override':
          priorDecisionOverrideCount++;
          break;
        case 'system_proposal_approval':
          systemProposalApprovalCount++;
          break;
        case 'unsticking_escalation_resolution':
          unstickingEscalationCount++;
          break;
        case 'domain_attestation':
          domainAttestationConfirmed = true;
          break;
      }
    }

    return {
      workflowRunId,
      phaseId,
      phaseName,
      decisions,
      decisionCount: decisions.length,
      rollbackCount,
      priorDecisionOverrideCount,
      systemProposalApprovalCount,
      unstickingEscalationCount,
      domainAttestationConfirmed,
    };
  }
}
