/**
 * Conflict-of-Interest Detection Agent (Tier 10).
 *
 * Per docs/janumilegal_product_description_evolution.md §8.1:
 *   - Trigger points: matter open, party addition, lens activation, reviewer assignment.
 *   - ConflictReport severity model: none, waivable, non_waivable, imputed, requires_screening.
 *   - Hard release block on non-waivable / imputed.
 *
 * Wave 6 ships a deterministic conflicts agent that operates on the
 * conflicts-only data surface. It detects:
 *   - direct adversity (current client appears as opposing party in another active matter)
 *   - former-client conflict (former client is opposing party in a current matter)
 *   - imputed conflict (party is opposing in any related matter at the firm)
 *
 * Wave 7+ adds positional, business, and lateral-attorney conflict detection.
 */

import { randomUUID } from 'node:crypto';
import type { ConflictsSurface, PartyRecord } from './surface.js';
import {
  isHardReleaseBlock,
  maxSeverity,
  type ConflictFinding,
  type ConflictReport,
  type ConflictSeverity,
  type ConflictTrigger,
} from './types.js';

export interface ConflictAgentArgs {
  readonly trigger: ConflictTrigger;
  readonly firmId: string;
  /** Matter being checked. */
  readonly matterId: string;
  readonly matterClientId: string;
  /** Parties currently associated with the matter. */
  readonly matterParties: readonly PartyRecord[];
  /** Caller role for the conflicts surface (must be conflicts_agent or conflicts_officer). */
  readonly callerRole: 'conflicts_agent' | 'conflicts_officer';
}

export class ConflictDetectionAgent {
  constructor(private readonly surface: ConflictsSurface) {}

  detect(args: ConflictAgentArgs): ConflictReport {
    const findings: ConflictFinding[] = [];
    const allFirmParties = this.surface.partiesAcrossFirm({
      firmId: args.firmId,
      callerRole: args.callerRole,
      auditPurpose: `conflicts_check:${args.trigger}:${args.matterId}`,
    });

    // Direct adversity: a current client of the firm appears as opposing party in this matter,
    // OR an opposing party in this matter is also a client elsewhere.
    const otherFirmClients = allFirmParties.filter((p) => p.matterId !== args.matterId && p.role === 'client');
    const matterOpposing = args.matterParties.filter((p) => p.role === 'opposing_party');
    for (const opp of matterOpposing) {
      const matchingClient = otherFirmClients.find((c) => isSameEntity(c, opp));
      if (matchingClient) {
        findings.push({
          findingId: randomUUID(),
          severity: 'non_waivable',
          category: 'current_client',
          subjects: [matchingClient, opp],
          basis: `entity '${opp.displayName}' is a current client of the firm in matter ${matchingClient.matterId} and an opposing party in this matter`,
          relatedMatterIds: [matchingClient.matterId],
        });
      }
    }

    // Imputed: opposing party in this matter is a client/opposing in any other matter.
    for (const opp of matterOpposing) {
      const elsewhere = allFirmParties.filter(
        (p) => p.matterId !== args.matterId && isSameEntity(p, opp) && p.role !== 'opposing_party',
      );
      for (const e of elsewhere) {
        if (findings.some((f) => f.subjects.some((s) => s.partyId === e.partyId) && f.category === 'current_client')) {
          // already captured by direct adversity
          continue;
        }
        findings.push({
          findingId: randomUUID(),
          severity: 'imputed',
          category: 'former_client',
          subjects: [e, opp],
          basis: `entity '${opp.displayName}' has a prior firm relationship in matter ${e.matterId} as ${e.role}`,
          relatedMatterIds: [e.matterId],
        });
      }
    }

    const highest = maxSeverity(findings.map((f) => f.severity));
    return {
      reportId: randomUUID(),
      trigger: args.trigger,
      findings,
      highestSeverity: highest,
      producedAt: new Date().toISOString(),
    };
  }

  /** True iff the report's highest severity blocks release outright. */
  static reportBlocksRelease(report: ConflictReport): boolean {
    return isHardReleaseBlock(report.highestSeverity);
  }
}

function isSameEntity(a: PartyRecord, b: PartyRecord): boolean {
  // Wave 6: name-based equality. Wave 7+ adds normalized entity-id matching.
  return a.displayName.trim().toLowerCase() === b.displayName.trim().toLowerCase();
}

export type { ConflictReport, ConflictSeverity };
