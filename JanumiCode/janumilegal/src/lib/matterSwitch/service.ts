/**
 * Matter switch service.
 *
 * Per docs/janumilegal_multi_matter_isolation_addendum.md §8.2:
 *   "Switching the active matter is a deliberate, observable event:
 *    triggered only by an explicit click in the matter switcher;
 *    confirmation step if there are unsaved actions or pending MMP cards;
 *    a full UI re-paint with the new matter's color, header, and dashboards;
 *    no half-switched states; recorded to both matters' operational-track
 *    streams as a context-out / context-in event."
 *
 * The service refuses switches to matters the user is screened out of and
 * refuses switches to matters that don't exist. Every switch produces an
 * op-track event recording the from/to scope hashes.
 */

import { randomUUID, createHash } from 'node:crypto';
import type { ActiveMatterContext } from '../scope/activeMatterContext.js';
import type { FirmDal } from '../database/scopedDal.js';
import type { OpStreamDal } from '../database/opStreamDal.js';
import type { Scope } from '../database/types.js';

export class MatterSwitchError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'MatterSwitchError';
  }
}

export interface SwitchArgs {
  readonly userId: string;
  readonly target: Scope;
  /** When true and the active matter has pending work, the switch is refused
   *  unless `confirmedDespitePending` is true. */
  readonly hasPendingWork?: boolean;
  readonly confirmedDespitePending?: boolean;
}

export interface SwitchResult {
  readonly switchId: string;
  readonly fromMatter: Scope | null;
  readonly toMatter: Scope;
  readonly switchedAt: string;
}

export class MatterSwitchService {
  constructor(
    private readonly active: ActiveMatterContext,
    private readonly firmDal: FirmDal,
    private readonly opStream: OpStreamDal,
  ) {}

  switchTo(args: SwitchArgs): SwitchResult {
    // Verify the matter exists and the user has access (not screened out).
    const accessible = this.firmDal.listAccessibleMatters(args.target.firmId, args.userId);
    const found = accessible.find(
      (s) => s.clientId === args.target.clientId && s.matterId === args.target.matterId,
    );
    if (!found) {
      // Refuse — do NOT distinguish "doesn't exist" from "screened out" in the
      // user-visible message; both surface as not-accessible (multi-matter §8.5).
      throw new MatterSwitchError(
        `target matter not accessible to user ${args.userId}`,
        'MATTER_NOT_ACCESSIBLE',
      );
    }

    if (args.hasPendingWork && !args.confirmedDespitePending) {
      throw new MatterSwitchError(
        `pending work in active matter; confirmation required before switch`,
        'PENDING_WORK_UNCONFIRMED',
      );
    }

    const event = this.active.switchTo(args.target);

    const switchId = randomUUID();
    // Op-track context-out event (no client identifying content)
    if (event.fromMatter) {
      this.opStream.write({
        eventType: 'matter_context_switched',
        firmId: event.fromMatter.firmId,
        payload: {
          direction: 'context_out',
          switchId,
          userId: args.userId,
          fromScopeHash: hashScope(event.fromMatter),
          toScopeHash: hashScope(args.target),
        },
      });
    }
    // Op-track context-in event
    this.opStream.write({
      eventType: 'matter_context_switched',
      firmId: args.target.firmId,
      payload: {
        direction: 'context_in',
        switchId,
        userId: args.userId,
        fromScopeHash: event.fromMatter ? hashScope(event.fromMatter) : null,
        toScopeHash: hashScope(args.target),
      },
    });

    return {
      switchId,
      fromMatter: event.fromMatter,
      toMatter: args.target,
      switchedAt: event.switchedAt,
    };
  }
}

function hashScope(s: Scope): string {
  return createHash('sha256').update(`${s.firmId}|${s.clientId}|${s.matterId}`).digest('hex').slice(0, 16);
}
