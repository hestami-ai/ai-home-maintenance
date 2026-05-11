/**
 * ReasoningReviewService — wires the harness to the matter-track writer
 * and op-track DAL (Wave 11).
 *
 * Per docs/design/wave11_reasoning_review_harness.md §7 §8.
 *
 * Two event types written per harness run:
 *   - reasoning_review_harness     (one per state, summary)
 *   - reasoning_review_finding     (one per finding)
 *
 * Findings are classified at write time:
 *   - deterministic   → work_product_factual (encrypted under matter content key)
 *   - LLM             → work_product_mental  (encrypted under matter mental key)
 *
 * Op-track sees a metadata-only event: severity counts, decision, validators
 * run, validators unavailable, reviewer model id. NEVER finding text.
 */

import type { MatterTrackWriter } from '../governedStream/matterTrackWriter.js';
import type { OpStreamDal } from '../database/opStreamDal.js';
import type { ReasoningReviewHarness } from './harness.js';
import type { HarnessRunSummary, ValidatorRuntimeParams } from './types.js';

export class ReasoningReviewService {
  constructor(
    private readonly harness: ReasoningReviewHarness,
    private readonly writer: MatterTrackWriter,
    private readonly opStream: OpStreamDal,
  ) {}

  async reviewAndPersist(p: ValidatorRuntimeParams): Promise<HarnessRunSummary> {
    const summary = await this.harness.review(p);

    // Per-finding matter-track events
    for (const f of summary.findings) {
      this.writer.write({
        scope: { firmId: p.envelope.firmId, clientId: p.envelope.clientId, matterId: p.envelope.matterId },
        activeMatterContext: { firmId: p.envelope.firmId, clientId: p.envelope.clientId, matterId: p.envelope.matterId },
        lensId: p.envelope.lensId,
        lensVersion: p.envelope.lensVersion,
        stateId: p.stateId,
        agentId: p.agentId,
        correlationId: summary.harnessRunId,
        eventType: 'reasoning_review_finding',
        payload: {
          findingId: f.findingId,
          validatorId: f.validatorId,
          severity: f.severity,
          type: f.type,
          message: f.message,
          unavailable: f.unavailable === true,
          evidence: f.evidence ?? null,
        },
        clvScope: f.clvScope,
        declaredClassification: f.classification,
        privilegeFrameRef: p.envelope.privilegeFrame,
      });
    }

    // Harness summary matter-track event (factual — counts only, no per-finding text)
    this.writer.write({
      scope: { firmId: p.envelope.firmId, clientId: p.envelope.clientId, matterId: p.envelope.matterId },
      activeMatterContext: { firmId: p.envelope.firmId, clientId: p.envelope.clientId, matterId: p.envelope.matterId },
      lensId: p.envelope.lensId,
      lensVersion: p.envelope.lensVersion,
      stateId: p.stateId,
      agentId: p.agentId,
      correlationId: summary.harnessRunId,
      eventType: 'reasoning_review_harness',
      payload: {
        harnessRunId: summary.harnessRunId,
        decision: summary.decision,
        severityCounts: summary.severityCounts,
        validatorsRun: summary.validatorsRun,
        validatorsUnavailable: summary.validatorsUnavailable,
        reviewerProvider: summary.reviewerProvider ?? null,
        reviewerModel: summary.reviewerModel ?? null,
        findingCount: summary.findings.length,
      },
      clvScope: ['clv.core.work_product.v1'],
      declaredClassification: 'work_product_factual',
      privilegeFrameRef: p.envelope.privilegeFrame,
    });

    // Op-track: metadata only, no finding text
    this.opStream.write({
      eventType: 'reasoning_review_completed',
      firmId: p.envelope.firmId,
      payload: {
        harnessRunId: summary.harnessRunId,
        stateId: p.stateId,
        agentId: p.agentId,
        decision: summary.decision,
        severityCounts: summary.severityCounts,
        validatorsRun: summary.validatorsRun.length,
        validatorsUnavailable: summary.validatorsUnavailable.length,
        reviewerProvider: summary.reviewerProvider ?? null,
        reviewerModel: summary.reviewerModel ?? null,
      },
    });

    return summary;
  }
}
