/**
 * Deterministic / Probabilistic Check Labeler.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 6 §6.2:
 *   "Deterministic/Probabilistic Check Labeler: never collapses any of
 *    mechanical / machine-assessed support / machine-assessed treatment /
 *    citator status / attorney-confirmed."
 *
 * The labeler returns a single display label for UI / artifact rendering.
 * It is a STRICT priority ranking with NO collapse — the function output is
 * the highest applicable label, but consumers must be able to query the full
 * VerificationRecord to see all sub-results.
 */

import type {
  AuthorityRef,
  CitatorStatus,
  MachineAssessedSupport,
  MachineAssessedTreatment,
  MechanicalCheckResult,
  VerificationLabel,
  VerificationRecord,
} from './types.js';

export class CheckLabeler {
  /**
   * Compute the display label by priority:
   *
   *   attorney_confirmed             (highest — only via AttorneyAction)
   *   citator_status                 (real citator data)
   *   machine_assessed_support       (LLM/agent support assessment)
   *   machine_assessed_treatment     (LLM/agent treatment assessment)
   *   quote_matched                  (mechanical pinpoint match)
   *   source_located                 (mechanical retrieval)
   *   attorney_confirmation_required (default for any non-mechanical claim)
   *
   * Note: when both machine-assessed-support and citator-status are present,
   * citator wins as the display label, but BOTH are recorded on the record.
   */
  label(args: {
    authority: AuthorityRef;
    mechanical?: MechanicalCheckResult;
    machineAssessedSupport?: MachineAssessedSupport;
    machineAssessedTreatment?: MachineAssessedTreatment;
    citatorStatus?: CitatorStatus;
    attorneyConfirmed?: { byAttorneyId: string; at: string; actionId: string };
  }): VerificationRecord {
    let display: VerificationLabel = 'attorney_confirmation_required';

    if (args.mechanical?.sourceLocated) display = 'source_located';
    if (args.mechanical?.quoteMatched) display = 'quote_matched';
    if (args.machineAssessedTreatment) display = 'machine_assessed_treatment';
    if (args.machineAssessedSupport) display = 'machine_assessed_support';
    if (args.citatorStatus) display = 'citator_status';
    if (args.attorneyConfirmed) display = 'attorney_confirmed';

    // attorneyConfirmationRequired is true unless the attorney has confirmed.
    const attorneyConfirmationRequired = !args.attorneyConfirmed;

    return {
      authorityId: args.authority.authorityId,
      mechanical: args.mechanical,
      machineAssessedSupport: args.machineAssessedSupport,
      machineAssessedTreatment: args.machineAssessedTreatment,
      citatorStatus: args.citatorStatus,
      attorneyConfirmed: args.attorneyConfirmed,
      displayLabel: display,
      attorneyConfirmationRequired,
    };
  }
}
