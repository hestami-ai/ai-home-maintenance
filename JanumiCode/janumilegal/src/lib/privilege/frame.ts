/**
 * Privilege Frame.
 *
 * Per docs/janumilegal_product_description_evolution.md §12 and
 * docs/design/governed_stream_privilege.md §10.
 *
 * A Privilege Frame is the multi-relational privilege state of a matter:
 * attorney-client pairs, joint representation, common-interest groups,
 * corporate-client doctrine, protective orders, sealed records, third-party
 * presence waivers. Frames are versioned; each matter-track event records
 * a snapshot reference so historical events can be re-interpreted under the
 * frame in force at the time.
 */

import { createHash, randomUUID } from 'node:crypto';

export interface AttorneyClientPair {
  readonly attorneyId: string;
  readonly clientId: string;
}

export interface JointRepresentation {
  readonly attorneyIds: readonly string[];
  readonly clientIds: readonly string[];
}

export interface CommonInterestPartner {
  readonly partyId: string;
  readonly basis: string;
}

export interface CorporateClient {
  readonly entityId: string;
  readonly privilegedRoles: readonly string[];
  readonly upjohnApplies: boolean;
}

export interface ProtectiveOrder {
  readonly orderId: string;
  readonly scope: string;
}

export interface SourceRef {
  readonly sourceId: string;
}

export interface ThirdPartyPresenceWaiver {
  readonly partyId: string;
  readonly effect: 'waived' | 'preserved';
}

export interface PrivilegeFrame {
  readonly matterId: string;
  readonly attorneyClientPairs: readonly AttorneyClientPair[];
  readonly jointRepresentation?: JointRepresentation;
  readonly commonInterestPartners?: readonly CommonInterestPartner[];
  readonly corporateClient?: CorporateClient;
  readonly protectiveOrders?: readonly ProtectiveOrder[];
  readonly sealedRecords?: readonly SourceRef[];
  readonly thirdPartyPresenceWaivers?: readonly ThirdPartyPresenceWaiver[];
}

export interface PrivilegeFrameSnapshotRef {
  readonly snapshotHash: string;
  readonly version: number;
}

export interface StoredFrameSnapshot extends PrivilegeFrameSnapshotRef {
  readonly snapshotId: string;
  readonly matterId: string;
  readonly frameJson: string;
  readonly producedAt: string;
}

/**
 * Compute a stable hash of a privilege frame. The hash is over a canonical
 * JSON encoding so logically equivalent frames produce the same hash.
 */
export function hashFrame(frame: PrivilegeFrame): string {
  const canonical = canonicalize(frame);
  return createHash('sha256').update(canonical).digest('hex');
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
}

export function newSnapshotId(): string {
  return randomUUID();
}
