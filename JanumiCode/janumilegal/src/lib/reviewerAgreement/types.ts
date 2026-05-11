/**
 * Reviewer-agreement types (Wave 12).
 *
 * Per docs/design/wave12_review_ux_and_reviewer_agreement.md §4.
 *
 * Annotations are attorney labels on harness findings (or on missed
 * issues attorneys flag separately). Metrics are aggregated counts
 * computed from annotations.
 */

import type { Severity } from '../reasoningReview/types.js';

export type AnnotationType =
  | 'agree_finding_correct'
  | 'disagree_finding_incorrect'
  | 'agree_severity'
  | 'disagree_severity_should_be_high'
  | 'disagree_severity_should_be_medium'
  | 'disagree_severity_should_be_low'
  | 'attorney_flagged_missed_issue';

export interface FindingAnnotation {
  readonly annotationId: string;
  readonly findingId: string;
  readonly validatorId: string;
  readonly stateId: string;
  readonly annotationType: AnnotationType;
  readonly rationale?: string;
  readonly annotatorAttorneyId: string;
  readonly annotatorBarNumber: string;
  readonly timestamp: string;
  /** True when annotation type is attorney_flagged_missed_issue and findingId is synthetic. */
  readonly missedIssue?: boolean;
  /** When annotating a missed issue, the validator we'd expect to have caught it. */
  readonly expectedValidatorId?: string;
  readonly expectedSeverity?: Severity;
}

export interface ValidatorMetricSnapshot {
  readonly validatorId: string;
  readonly precision: number;        // agreed / (agreed + disagreed)
  readonly recall: number;           // flagged / (flagged + missed)
  readonly agreeCount: number;
  readonly disagreeCount: number;
  readonly missedCount: number;
  /** Severity-calibration: counts of disagree_severity_should_be_* per direction. */
  readonly severityAdjustments: { readonly toHigh: number; readonly toMedium: number; readonly toLow: number };
  readonly windowSize: number;       // number of annotations considered
}

export interface AggregateMetrics {
  readonly perValidator: readonly ValidatorMetricSnapshot[];
  readonly computedAt: string;
}
