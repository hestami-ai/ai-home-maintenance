/**
 * Conflicts-only data-access surface.
 *
 * Per docs/janumilegal_multi_matter_isolation_addendum.md §7.3:
 *   "Conflicts-only data-access surface: returns only party identifiers,
 *    party roles, and matter status — NEVER matter-track content. Restricted
 *    to the conflicts agent and the firm conflicts-officer role. Writes its
 *    own audit trail to the operational track."
 *
 * This module reads only metadata: party rosters, matter status, and a
 * curated lateral-conflict / screened-personnel record set. It does not
 * touch matter-track Governed Stream.
 */

import type { ConflictsDal } from '../database/conflictsDal.js';
import type { OpStreamDal } from '../database/opStreamDal.js';
import type { PartyDescriptor } from './types.js';

export interface PartyRecord extends PartyDescriptor {
  readonly firmId: string;
  readonly clientId: string;
  readonly matterId: string;
}

export interface MatterStatusRecord {
  readonly firmId: string;
  readonly clientId: string;
  readonly matterId: string;
  readonly matterName: string;
  readonly status: 'open' | 'closed';
  readonly openedAt: string;
  readonly closedAt?: string;
}

export class ConflictsSurfaceAccessError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'ConflictsSurfaceAccessError';
  }
}

const ALLOWED_CALLERS = new Set(['conflicts_agent', 'conflicts_officer']);

export class ConflictsSurface {
  constructor(
    private readonly dal: ConflictsDal,
    private readonly opStream: OpStreamDal,
  ) {}

  /** Allowed caller check. The op-track records every conflicts read with the caller id. */
  private assertCaller(callerRole: string): void {
    if (!ALLOWED_CALLERS.has(callerRole)) {
      throw new ConflictsSurfaceAccessError(
        `caller role '${callerRole}' not authorized for conflicts surface`,
        'CALLER_NOT_AUTHORIZED',
      );
    }
  }

  /** Return party rosters across all firm matters. Metadata only — no content. */
  partiesAcrossFirm(args: { firmId: string; callerRole: string; auditPurpose: string }): readonly PartyRecord[] {
    this.assertCaller(args.callerRole);
    this.opStream.write({
      eventType: 'lens_activation_started', // TODO Wave 8: add 'conflicts_surface_read' event type
      firmId: args.firmId,
      payload: { surface: 'parties_across_firm', purpose: args.auditPurpose, callerRole: args.callerRole },
    });
    // Wave 6: parties are not yet a separate table. We surface from a stub
    // helper. Wave 8 introduces a proper parties table; for now we read from
    // a runtime-supplied store via setPartiesForTesting() to keep the
    // surface verifiable without depending on infrastructure not built yet.
    return Array.from(this.partiesStore.values()).filter((p) => p.firmId === args.firmId);
  }

  matterStatusAcrossFirm(args: { firmId: string; callerRole: string; auditPurpose: string }): readonly MatterStatusRecord[] {
    this.assertCaller(args.callerRole);
    this.opStream.write({
      eventType: 'lens_activation_started',
      firmId: args.firmId,
      payload: { surface: 'matter_status_across_firm', purpose: args.auditPurpose, callerRole: args.callerRole },
    });
    const rows = this.dal.matterMetadataAcrossFirm(args.firmId);
    return rows.map((r) => ({
      firmId: r.firmId,
      clientId: r.clientId,
      matterId: r.matterId,
      matterName: r.matterName,
      status: r.status,
      openedAt: r.openedAt,
      closedAt: r.closedAt ?? undefined,
    }));
  }

  /** Test-side party seeding (Wave 6 stand-in for a real parties table). */
  private partiesStore = new Map<string, PartyRecord>();
  setPartiesForTesting(parties: readonly PartyRecord[]): void {
    this.partiesStore.clear();
    for (const p of parties) {
      this.partiesStore.set(`${p.firmId}|${p.matterId}|${p.partyId}`, p);
    }
  }
}
