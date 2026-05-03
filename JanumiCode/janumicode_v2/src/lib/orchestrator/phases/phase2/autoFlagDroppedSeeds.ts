/**
 * Phase 2.2 deterministic post-processor: auto-flag any input seeds the
 * agent silently dropped from both `nfrs[].traces_to` AND `unreached_seeds[]`.
 *
 * The architectural principle: enumeration discipline ("did every input X
 * appear somewhere in output?") is a deterministic concern, not an LLM
 * concern. The LLM's job is the creative work — designing NFRs, choosing
 * how to group seeds, writing thresholds. Whether *every* input seed got
 * placed is something code can check exactly. cal-26 surfaced an instance
 * where the agent dropped VV-LICENSE-MONITORING from its output entirely;
 * the downstream nfr_bloom_verifier correctly halted Phase 2.2c with a
 * blocking gap. This post-processor closes that loop by auto-flagging
 * dropped seeds via `unreached_seeds[]` with `system_inferred: true` so
 * the verifier sees them as absorbed-pending-review rather than missing.
 *
 * Phase 1 (this file): auto-flag only. The seed gets parked under a
 *   sentinel `absorbed_into` value that surfaces in audit but doesn't
 *   claim coverage by any specific NFR.
 * Phase 2 (future): re-prompt the agent with focused "you missed these,
 *   please assign to an existing NFR or absorb explicitly" — better
 *   resolution because the agent picks the home, not the system.
 */

import type { ExtractedItem, VVRequirement } from '../../../types/records';
import type {
  NfrSkeleton,
  UnreachedSeedDeclaration,
} from './verifyNfrCoverage';

/**
 * Sentinel value used as `absorbed_into` for auto-flagged seeds. Verifier
 * accepts any non-empty `absorbed_into`; this string surfaces clearly in
 * audits, decompViewer, and downstream scans for "system needed to
 * intervene because the agent dropped a seed".
 */
export const SYSTEM_INFERRED_ABSORBED_INTO = 'SYSTEM_INFERRED__AGENT_OMISSION';

export interface SystemInferredUnreachedSeed extends UnreachedSeedDeclaration {
  /** Marks seeds that the deterministic post-processor added because the
   *  agent dropped them. Fields beyond UnreachedSeedDeclaration are
   *  metadata; verifyNfrCoverage ignores them. */
  system_inferred: true;
  flagged_at: string;
  source_kind: 'vv' | 'compliance';
}

export interface AutoFlagInputs {
  vvRequirements: VVRequirement[];
  complianceItems: ExtractedItem[];
  nfrs: NfrSkeleton[];
  unreached: UnreachedSeedDeclaration[];
}

export interface AutoFlagResult {
  /** unreached merged with any system-inferred entries. Pass this to
   *  verifyNfrCoverage in place of the original `unreached`. */
  unreached: UnreachedSeedDeclaration[];
  /** Just the new entries the system added. Empty array means agent
   *  output was already complete. Useful for logging + telemetry. */
  autoFlagged: SystemInferredUnreachedSeed[];
}

/**
 * Compute and append system-inferred unreached_seeds for any VV / COMP
 * input id that the agent neither traced nor explicitly absorbed.
 *
 * Pure function — no side effects, no LLM calls. Caller is responsible
 * for logging the result and for persisting the augmented unreached
 * list onto the artifact_produced record.
 */
export function autoFlagDroppedSeeds(inputs: AutoFlagInputs): AutoFlagResult {
  const tracedVv = new Set<string>();
  const tracedComp = new Set<string>();
  for (const n of inputs.nfrs) {
    for (const t of n.traces_to ?? []) {
      if (t.startsWith('VV-')) tracedVv.add(t);
      else if (t.startsWith('COMP-')) tracedComp.add(t);
    }
  }
  const absorbed = new Set(inputs.unreached.map((u) => u.seed_id));

  const flaggedAt = new Date().toISOString();
  const autoFlagged: SystemInferredUnreachedSeed[] = [];

  for (const v of inputs.vvRequirements) {
    if (!tracedVv.has(v.id) && !absorbed.has(v.id)) {
      autoFlagged.push({
        seed_id: v.id,
        absorbed_into: SYSTEM_INFERRED_ABSORBED_INTO,
        reason: 'Agent omitted from nfrs[].traces_to and from unreached_seeds[]. Auto-flagged by deterministic post-processor; review and route to a specific NFR or accept as scope cut.',
        system_inferred: true,
        flagged_at: flaggedAt,
        source_kind: 'vv',
      });
    }
  }
  for (const c of inputs.complianceItems) {
    if (!tracedComp.has(c.id) && !absorbed.has(c.id)) {
      autoFlagged.push({
        seed_id: c.id,
        absorbed_into: SYSTEM_INFERRED_ABSORBED_INTO,
        reason: 'Agent omitted from nfrs[].traces_to and from unreached_seeds[]. Auto-flagged by deterministic post-processor; review and route to a specific NFR or accept as scope cut.',
        system_inferred: true,
        flagged_at: flaggedAt,
        source_kind: 'compliance',
      });
    }
  }

  return {
    unreached: [...inputs.unreached, ...autoFlagged],
    autoFlagged,
  };
}
