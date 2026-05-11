/**
 * Source-to-Claim (Source-to-Assertion) Trace types.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 6 §6.4 and
 * docs/clv/canonical_vocabulary_v1.md §4 (clv.core.trace.v1):
 *
 *   "A trace is the structured link from an assertion (or claim, conclusion,
 *    citation) back to the source(s) that support it, including supporting
 *    span, fact or authority type, the state that generated the trace,
 *    verification status, and attorney confirmation status."
 */

import type { VerificationLabel } from '../authority/types.js';

export type AssertionKind = 'fact' | 'authority' | 'characterization' | 'recommendation' | 'citation';

export interface SourceToClaimTrace {
  readonly traceId: string;
  readonly artifactId?: string;
  readonly assertionText: string;
  readonly assertionKind: AssertionKind;
  readonly sourceId: string;
  readonly supportingSpan?: string;
  readonly stateId?: string;
  readonly verificationLabel: VerificationLabel;
  readonly attorneyConfirmedActionId?: string;
}
