/**
 * Reviewer-Agreement Service (Wave 12).
 *
 * Per docs/design/wave12_review_ux_and_reviewer_agreement.md §4.
 *
 * Captures attorney annotations on reasoning-review findings and computes
 * aggregate metrics (precision, recall, severity calibration) per
 * validator over an annotation window.
 *
 * Annotations are written through the matter-track writer at classification
 * `work_product_mental` — they encode attorney mental impressions.
 *
 * Aggregates are computed in-memory from the supplied annotation set; the
 * service is pure given its inputs (no DB reads). The webview / dashboard
 * passes a hydrated annotation list to `computeMetrics()`.
 */

import { randomUUID } from 'node:crypto';
import type { MatterTrackWriter } from '../governedStream/matterTrackWriter.js';
import type { Scope } from '../database/types.js';
import type { PrivilegeFrameSnapshotRef } from '../privilege/frame.js';
import type {
  FindingAnnotation,
  AggregateMetrics,
  ValidatorMetricSnapshot,
  AnnotationType,
} from './types.js';
import type { Severity } from '../reasoningReview/types.js';

export class ReviewerAgreementError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'ReviewerAgreementError';
  }
}

export interface RecordAnnotationArgs {
  readonly scope: Scope;
  readonly findingId: string;
  readonly validatorId: string;
  readonly stateId: string;
  readonly annotationType: AnnotationType;
  readonly rationale?: string;
  readonly annotatorAttorneyId: string;
  readonly annotatorBarNumber: string;
  readonly privilegeFrameRef: PrivilegeFrameSnapshotRef;
  readonly missedIssue?: boolean;
  readonly expectedValidatorId?: string;
  readonly expectedSeverity?: Severity;
}

export class ReviewerAgreementService {
  constructor(private readonly writer: MatterTrackWriter) {}

  recordAnnotation(args: RecordAnnotationArgs): FindingAnnotation {
    if (args.missedIssue && !args.expectedValidatorId) {
      throw new ReviewerAgreementError(
        'missed-issue annotation requires expectedValidatorId',
        'MISSED_ISSUE_NEEDS_EXPECTED_VALIDATOR',
      );
    }
    if ((args.annotationType === 'disagree_finding_incorrect' || args.annotationType.startsWith('disagree_severity'))
        && (!args.rationale || args.rationale.trim().length === 0)) {
      throw new ReviewerAgreementError(
        'disagreement annotations require a non-empty rationale',
        'DISAGREEMENT_RATIONALE_REQUIRED',
      );
    }
    const annotationId = randomUUID();
    const timestamp = new Date().toISOString();

    this.writer.write({
      scope: args.scope,
      activeMatterContext: args.scope,
      userId: args.annotatorAttorneyId,
      stateId: args.stateId,
      eventType: 'reasoning_review_annotation',
      payload: {
        annotationId,
        findingId: args.findingId,
        validatorId: args.validatorId,
        annotationType: args.annotationType,
        rationale: args.rationale ?? null,
        annotatorAttorneyId: args.annotatorAttorneyId,
        annotatorBarNumber: args.annotatorBarNumber,
        missedIssue: args.missedIssue === true,
        expectedValidatorId: args.expectedValidatorId ?? null,
        expectedSeverity: args.expectedSeverity ?? null,
      },
      clvScope: ['clv.core.work_product.v1'],
      declaredClassification: 'work_product_mental',
      privilegeFrameRef: args.privilegeFrameRef,
    });

    return {
      annotationId,
      findingId: args.findingId,
      validatorId: args.validatorId,
      stateId: args.stateId,
      annotationType: args.annotationType,
      rationale: args.rationale,
      annotatorAttorneyId: args.annotatorAttorneyId,
      annotatorBarNumber: args.annotatorBarNumber,
      timestamp,
      missedIssue: args.missedIssue,
      expectedValidatorId: args.expectedValidatorId,
      expectedSeverity: args.expectedSeverity,
    };
  }

  /**
   * Compute aggregate metrics from a hydrated annotation set.
   * Pure — no DB access.
   */
  computeMetrics(annotations: readonly FindingAnnotation[]): AggregateMetrics {
    const byValidator = new Map<string, FindingAnnotation[]>();
    for (const a of annotations) {
      const key = a.missedIssue ? (a.expectedValidatorId ?? 'unknown') : a.validatorId;
      const arr = byValidator.get(key);
      if (arr) arr.push(a);
      else byValidator.set(key, [a]);
    }
    const perValidator: ValidatorMetricSnapshot[] = [];
    for (const [validatorId, arr] of byValidator) {
      const agreeCount = arr.filter((a) => a.annotationType === 'agree_finding_correct').length;
      const disagreeCount = arr.filter((a) => a.annotationType === 'disagree_finding_incorrect').length;
      const missedCount = arr.filter((a) => a.annotationType === 'attorney_flagged_missed_issue').length;
      const flaggedCount = agreeCount + disagreeCount; // attorney saw harness flag
      const precisionDenom = flaggedCount;
      const precision = precisionDenom > 0 ? agreeCount / precisionDenom : 0;
      const recallDenom = agreeCount + missedCount; // attorney-flagged either way
      const recall = recallDenom > 0 ? agreeCount / recallDenom : 0;
      perValidator.push({
        validatorId,
        precision,
        recall,
        agreeCount,
        disagreeCount,
        missedCount,
        severityAdjustments: {
          toHigh: arr.filter((a) => a.annotationType === 'disagree_severity_should_be_high').length,
          toMedium: arr.filter((a) => a.annotationType === 'disagree_severity_should_be_medium').length,
          toLow: arr.filter((a) => a.annotationType === 'disagree_severity_should_be_low').length,
        },
        windowSize: arr.length,
      });
    }
    return { perValidator, computedAt: new Date().toISOString() };
  }
}
