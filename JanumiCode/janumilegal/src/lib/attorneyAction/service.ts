/**
 * AttorneyAction service.
 *
 * Records attorney actions in the platform DB. Each action binds to:
 *   - the attorney's identity + admissions snapshot at time of action;
 *   - the artifact's exact bytes (versionHash);
 *   - a Governed Stream event id (the matter-track event that records the action).
 *
 * The service does NOT determine release status — that's the Release Gate
 * Evaluator's job (Wave 7 §7.2). The service only records the act.
 */

import { randomUUID } from 'node:crypto';
import type { Scope } from '../database/types.js';
import type { AttorneyActionDal } from '../database/attorneyActionDal.js';
import type { AttorneyAdmissionsDal } from '../database/attorneyAdmissionsDal.js';
import type { MatterTrackWriter } from '../governedStream/matterTrackWriter.js';
import type { PrivilegeFrameSnapshotRef } from '../privilege/frame.js';
import type {
  AttorneyAction,
  AttorneyActionType,
  AttorneyRole,
  SignatureMode,
} from './types.js';

export class AttorneyActionError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'AttorneyActionError';
  }
}

export interface RecordActionArgs {
  readonly scope: Scope;
  readonly activeMatterContext: Scope | null;
  readonly artifactId: string;
  readonly artifactVersionHash: string;
  readonly attorneyId: string;
  readonly attorneyRole: AttorneyRole;
  readonly action: AttorneyActionType;
  readonly signatureMode?: SignatureMode;
  /** Required jurisdiction for filing actions (forum jurisdiction). */
  readonly forumJurisdiction?: string;
  readonly privilegeFrameRef: PrivilegeFrameSnapshotRef;
  /** Wave 12: required when action is acknowledged_finding | override_finding. */
  readonly acknowledgedFindings?: readonly string[];
  /** Wave 12: required when action='override_finding'. */
  readonly overrideRationale?: string;
}

export class AttorneyActionService {
  constructor(
    private readonly actionDal: AttorneyActionDal,
    private readonly admissionsDal: AttorneyAdmissionsDal,
    private readonly matterWriter: MatterTrackWriter,
  ) {}

  /**
   * Record an attorney action. Filing actions require active admission in
   * the forum jurisdiction; the service refuses to record otherwise.
   */
  record(args: RecordActionArgs): AttorneyAction {
    const admissions = this.admissionsDal.listForAttorney(args.scope.firmId, args.attorneyId);
    const activeAdmissions = admissions.filter((a) => a.status === 'active');
    const barNumbers = activeAdmissions.map((a) => ({ jurisdiction: a.jurisdiction, barNumber: a.barNumber }));

    let jurisdictionRequirementsMet = true;
    if (args.action === 'signed_for_filing' || args.action === 'approved_for_filing') {
      if (!args.forumJurisdiction) {
        throw new AttorneyActionError(`forumJurisdiction required for ${args.action}`, 'FORUM_REQUIRED');
      }
      const admitted = this.admissionsDal.isAdmitted(args.scope.firmId, args.attorneyId, args.forumJurisdiction);
      jurisdictionRequirementsMet = admitted;
      if (!admitted) {
        throw new AttorneyActionError(
          `attorney ${args.attorneyId} is not admitted in forum jurisdiction ${args.forumJurisdiction}; refusing ${args.action}`,
          'NOT_ADMITTED_IN_FORUM',
        );
      }
    }

    // signing actions imply specific role requirements
    if (args.action === 'signed_for_filing' && args.attorneyRole !== 'signing_attorney') {
      throw new AttorneyActionError(
        `signed_for_filing requires attorneyRole='signing_attorney' (got '${args.attorneyRole}')`,
        'WRONG_ROLE_FOR_SIGNING',
      );
    }

    // Wave 12: finding-reconciliation invariants
    if (args.action === 'acknowledged_finding' || args.action === 'override_finding') {
      if (!args.acknowledgedFindings || args.acknowledgedFindings.length === 0) {
        throw new AttorneyActionError(
          `${args.action} requires non-empty acknowledgedFindings`,
          'NO_FINDINGS_ACKNOWLEDGED',
        );
      }
      if (args.action === 'override_finding' && (!args.overrideRationale || args.overrideRationale.trim().length === 0)) {
        throw new AttorneyActionError(
          `override_finding requires non-empty overrideRationale`,
          'OVERRIDE_RATIONALE_REQUIRED',
        );
      }
    }

    const actionId = randomUUID();
    const timestamp = new Date().toISOString();

    // Emit a matter-track event recording the action (work_product_mental — encodes
    // attorney decision-making).
    const eventResult = this.matterWriter.write({
      scope: args.scope,
      activeMatterContext: args.activeMatterContext,
      userId: args.attorneyId,
      eventType: 'attorney_action_recorded',
      payload: {
        actionId,
        artifactId: args.artifactId,
        artifactVersionHash: args.artifactVersionHash,
        attorneyId: args.attorneyId,
        attorneyRole: args.attorneyRole,
        action: args.action,
        signatureMode: args.signatureMode ?? null,
        forumJurisdiction: args.forumJurisdiction ?? null,
        jurisdictionRequirementsMet,
        acknowledgedFindings: args.acknowledgedFindings ?? null,
        overrideRationale: args.overrideRationale ?? null,
      },
      clvScope: ['clv.core.approval.v1', 'clv.core.signature.v1', 'clv.core.work_product.v1'],
      declaredClassification: 'work_product_mental',
      privilegeFrameRef: args.privilegeFrameRef,
    });

    const record: AttorneyAction = {
      actionId,
      firmId: args.scope.firmId,
      clientId: args.scope.clientId,
      matterId: args.scope.matterId,
      artifactId: args.artifactId,
      artifactVersionHash: args.artifactVersionHash,
      attorneyId: args.attorneyId,
      attorneyRole: args.attorneyRole,
      action: args.action,
      signatureMode: args.signatureMode,
      jurisdictionRequirementsMet,
      barNumbersAtAction: barNumbers,
      timestamp,
      governedStreamEventId: eventResult.eventId,
      acknowledgedFindings: args.acknowledgedFindings,
      overrideRationale: args.overrideRationale,
    };

    this.actionDal.insert(record);
    return record;
  }
}
