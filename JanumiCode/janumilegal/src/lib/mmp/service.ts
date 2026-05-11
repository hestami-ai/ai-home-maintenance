/**
 * MMP service.
 *
 * Per docs/janumilegal_product_description_evolution.md §13:
 *   - MMP runs at matter open, lens activation, handoff boundaries, and on demand.
 *   - MMP submissions are recorded as work_product_mental.
 *   - MMP decisions become inputs to subsequent states, not optional prompts.
 *
 * The service writes the MMP session to the matter track at issuance time
 * and writes the submission as a separate work_product_mental event when
 * the attorney submits.
 */

import { randomUUID } from 'node:crypto';
import type { Scope } from '../database/types.js';
import type { MatterTrackWriter } from '../governedStream/matterTrackWriter.js';
import type { PrivilegeFrameSnapshotRef } from '../privilege/frame.js';
import type { MMPCard, MMPSession, MMPSubmission } from './types.js';

export class MMPService {
  constructor(private readonly writer: MatterTrackWriter) {}

  /**
   * Issue a new MMP session (cards) into the matter track.
   * Issuance itself is work_product_mental — the cards encode attorney-
   * facing reasoning that the system has surfaced.
   */
  issueSession(args: {
    scope: Scope;
    activeMatterContext: Scope | null;
    cards: readonly MMPCard[];
    privilegeFrameRef: PrivilegeFrameSnapshotRef;
    lensId?: string;
    lensVersion?: string;
    stateId?: string;
    userId?: string;
  }): MMPSession {
    const mmpId = randomUUID();
    const producedAt = new Date().toISOString();
    const session: MMPSession = { mmpId, cards: args.cards, producedAt };

    this.writer.write({
      scope: args.scope,
      activeMatterContext: args.activeMatterContext,
      userId: args.userId,
      lensId: args.lensId,
      lensVersion: args.lensVersion,
      stateId: args.stateId,
      eventType: 'mmp_session_issued',
      payload: { mmpId, cards: args.cards as unknown as Record<string, unknown>[], producedAt },
      clvScope: ['clv.core.work_product.v1'],
      declaredClassification: 'work_product_mental',
      privilegeFrameRef: args.privilegeFrameRef,
    });

    return session;
  }

  /**
   * Submit MMP decisions. Each submission is its own work_product_mental
   * event in the matter track. The submission is bound to the issued mmpId.
   */
  submit(args: {
    scope: Scope;
    activeMatterContext: Scope | null;
    mmpId: string;
    submission: MMPSubmission;
    privilegeFrameRef: PrivilegeFrameSnapshotRef;
    lensId?: string;
    lensVersion?: string;
    stateId?: string;
  }): { eventId: string } {
    const result = this.writer.write({
      scope: args.scope,
      activeMatterContext: args.activeMatterContext,
      userId: args.submission.submittedBy,
      lensId: args.lensId,
      lensVersion: args.lensVersion,
      stateId: args.stateId,
      eventType: 'mmp_card_submitted',
      payload: {
        mmpId: args.mmpId,
        submission: args.submission as unknown as Record<string, unknown>,
      },
      clvScope: ['clv.core.work_product.v1'],
      declaredClassification: 'work_product_mental',
      privilegeFrameRef: args.privilegeFrameRef,
    });
    return { eventId: result.eventId };
  }
}
