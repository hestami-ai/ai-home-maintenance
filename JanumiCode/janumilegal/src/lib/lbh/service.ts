/**
 * LBH service.
 *
 * Per docs/janumilegal_product_description_evolution.md §6.
 *
 * Produces and retrieves LBHs via the matter-track Governed Stream.
 * Cross-lens CLV scope check (consume()) is the binding gate that prevents
 * a receiving lens from acting on an LBH whose CLV terms it has not declared.
 */

import { randomUUID } from 'node:crypto';
import type { Scope } from '../database/types.js';
import type { MatterTrackWriter } from '../governedStream/matterTrackWriter.js';
import type { MatterTrackReader } from '../governedStream/matterTrackReader.js';
import type { LensPhaseManifest } from '../orchestrator/types.js';
import type { PrivilegeFrameSnapshotRef } from '../privilege/frame.js';
import type { LensBoundaryHandoff, LbhRef } from './types.js';

export class LbhScopeError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'LbhScopeError';
  }
}

export interface LbhProduceArgs {
  readonly scope: Scope;
  readonly activeMatterContext: Scope | null;
  readonly fromLensId: string;
  readonly fromLensVersion: string;
  readonly toLensId: string;
  readonly toLensVersion: string;
  readonly fromState: string;
  readonly toState: string;
  readonly governingObjective: string;
  readonly retainedFacts: LensBoundaryHandoff['retainedFacts'];
  readonly retainedIssues: LensBoundaryHandoff['retainedIssues'];
  readonly prunedIssuesWithReasons: LensBoundaryHandoff['prunedIssuesWithReasons'];
  readonly authorityStatus: LensBoundaryHandoff['authorityStatus'];
  readonly openQuestions: readonly string[];
  readonly assumptionsCarried: LensBoundaryHandoff['assumptionsCarried'];
  readonly releaseFrame: LensBoundaryHandoff['releaseFrame'];
  readonly clvContext: readonly string[];
  readonly curatorNotes: string;
  readonly privilegeFrameRef: PrivilegeFrameSnapshotRef;
}

export class LbhService {
  constructor(
    private readonly writer: MatterTrackWriter,
    private readonly reader: MatterTrackReader,
  ) {}

  /**
   * Produce a new LBH and write it to the matter track as work_product_mental.
   */
  produce(args: LbhProduceArgs): LbhRef {
    const lbhId = randomUUID();
    const producedAt = new Date().toISOString();
    const lbh: LensBoundaryHandoff = {
      lbhId,
      scope: args.scope,
      fromLensId: args.fromLensId,
      fromLensVersion: args.fromLensVersion,
      toLensId: args.toLensId,
      toLensVersion: args.toLensVersion,
      fromState: args.fromState,
      toState: args.toState,
      governingObjective: args.governingObjective,
      retainedFacts: args.retainedFacts,
      retainedIssues: args.retainedIssues,
      prunedIssuesWithReasons: args.prunedIssuesWithReasons,
      authorityStatus: args.authorityStatus,
      openQuestions: args.openQuestions,
      assumptionsCarried: args.assumptionsCarried,
      privilegeContext: { privilegeFrameRef: args.privilegeFrameRef.snapshotHash, version: args.privilegeFrameRef.version },
      releaseFrame: args.releaseFrame,
      clvContext: args.clvContext,
      curatorNotes: args.curatorNotes,
      producedAt,
    };

    this.writer.write({
      scope: args.scope,
      activeMatterContext: args.activeMatterContext,
      lensId: args.fromLensId,
      lensVersion: args.fromLensVersion,
      stateId: args.fromState,
      eventType: 'lbh_emitted',
      payload: lbh as unknown as Record<string, unknown>,
      clvScope: [...args.clvContext, 'clv.core.work_product.v1'],
      declaredClassification: 'work_product_mental',
      privilegeFrameRef: args.privilegeFrameRef,
    });

    return { lbhId, fromState: args.fromState, toState: args.toState, clvContext: args.clvContext, producedAt };
  }

  /**
   * Retrieve the most-recent LBH whose `toState` equals the supplied target state.
   * Returns undefined if none exists. Caller is responsible for treating
   * "no LBH at handoff boundary" as a closed-fail condition.
   */
  retrieveLatestForToState(targetState: string): LensBoundaryHandoff | undefined {
    const events = this.reader.read({ authorizedClassifications: ['work_product_mental'] });
    const matches = events.filter(
      (e) => e.eventType === 'lbh_emitted' && !e.redacted && (e.payload as { toState?: string })?.toState === targetState,
    );
    if (matches.length === 0) return undefined;
    matches.sort((a, b) => (a.writtenAt < b.writtenAt ? 1 : -1));
    return matches[0].payload as unknown as LensBoundaryHandoff;
  }

  /**
   * Cross-lens CLV scope check.
   *
   * Per evolution §6.3: when an LBH crosses lens boundaries, the receiving
   * lens must declare every CLV term the LBH emitted. Returns the validated
   * LBH or throws.
   */
  consume(lbh: LensBoundaryHandoff, receivingManifest: LensPhaseManifest): LensBoundaryHandoff {
    if (lbh.toLensId !== receivingManifest.lensId) {
      throw new LbhScopeError(
        `LBH targets lens ${lbh.toLensId} but receiving manifest is ${receivingManifest.lensId}`,
        'WRONG_LENS',
      );
    }
    const declared = new Set(receivingManifest.clvBindings);
    for (const term of lbh.clvContext) {
      if (!declared.has(term)) {
        throw new LbhScopeError(
          `receiving lens ${receivingManifest.lensId} does not declare CLV binding ${term} emitted by LBH`,
          'CLV_SCOPE_MISMATCH',
        );
      }
    }
    return lbh;
  }
}
