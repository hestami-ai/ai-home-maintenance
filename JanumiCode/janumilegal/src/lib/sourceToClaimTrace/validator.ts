/**
 * Source-to-Claim Trace Validator agent.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 6 §6.4 and source
 * agent registry §Tier 9 / Validation: every material assertion in an
 * artifact intended for attorney review must carry a valid trace.
 *
 * Validation criteria:
 *   - Every assertion in the supplied set has at least one trace.
 *   - Each trace's verification label is one of the recognized labels.
 *   - Each trace's source is in the authorized source set (caller-supplied).
 *   - Attorney-confirmed traces have a non-empty action id.
 */

import { randomUUID } from 'node:crypto';
import { summarize, type GovernanceFinding, type GovernanceReport } from '../agents/governance/types.js';
import type { SourceToClaimTrace } from './types.js';
import type { VerificationLabel } from '../authority/types.js';

export const SOURCE_TO_CLAIM_TRACE_VALIDATOR_ID = 'source_to_claim_trace_validator.v1';

const VALID_LABELS: ReadonlySet<VerificationLabel> = new Set([
  'source_located',
  'quote_matched',
  'machine_assessed_support',
  'machine_assessed_treatment',
  'citator_status',
  'attorney_confirmation_required',
  'attorney_confirmed',
]);

export interface ValidatorInput {
  readonly artifactId: string;
  readonly assertionsRequiringTrace: readonly { assertionText: string }[];
  readonly traces: readonly SourceToClaimTrace[];
  readonly authorizedSourceIds: readonly string[];
}

export class SourceToClaimTraceValidator {
  validate(input: ValidatorInput): GovernanceReport {
    const findings: GovernanceFinding[] = [];
    const tracesByAssertion = new Map<string, SourceToClaimTrace[]>();
    for (const t of input.traces) {
      const arr = tracesByAssertion.get(t.assertionText) ?? [];
      arr.push(t);
      tracesByAssertion.set(t.assertionText, arr);
    }

    const authorized = new Set(input.authorizedSourceIds);

    for (const a of input.assertionsRequiringTrace) {
      const traces = tracesByAssertion.get(a.assertionText) ?? [];
      if (traces.length === 0) {
        findings.push({
          findingId: randomUUID(),
          agentId: SOURCE_TO_CLAIM_TRACE_VALIDATOR_ID,
          severity: 'block',
          category: 'untraced_assertion',
          message: `assertion has no trace: '${a.assertionText.slice(0, 80)}'`,
          subject: { kind: 'artifact', id: input.artifactId },
        });
      }
    }

    for (const t of input.traces) {
      if (!VALID_LABELS.has(t.verificationLabel)) {
        findings.push({
          findingId: randomUUID(),
          agentId: SOURCE_TO_CLAIM_TRACE_VALIDATOR_ID,
          severity: 'block',
          category: 'invalid_verification_label',
          message: `trace ${t.traceId} has invalid verification label '${t.verificationLabel}'`,
        });
      }
      if (!authorized.has(t.sourceId)) {
        findings.push({
          findingId: randomUUID(),
          agentId: SOURCE_TO_CLAIM_TRACE_VALIDATOR_ID,
          severity: 'block',
          category: 'unauthorized_source',
          message: `trace ${t.traceId} references source ${t.sourceId} not in authorized set`,
        });
      }
      if (t.verificationLabel === 'attorney_confirmed' && !t.attorneyConfirmedActionId) {
        findings.push({
          findingId: randomUUID(),
          agentId: SOURCE_TO_CLAIM_TRACE_VALIDATOR_ID,
          severity: 'block',
          category: 'attorney_confirmed_without_action',
          message: `trace ${t.traceId} marked attorney_confirmed but has no AttorneyAction id`,
        });
      }
    }

    return {
      reportId: randomUUID(),
      producedBy: SOURCE_TO_CLAIM_TRACE_VALIDATOR_ID,
      producedAt: new Date().toISOString(),
      findings,
      summary: summarize(findings),
    };
  }
}
