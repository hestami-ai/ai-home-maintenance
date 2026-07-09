/**
 * Cycle-restart seed extraction.
 *
 * Reads the latest `packet_synthesis_failure` record and decodes the
 * orphan ids that each delta-mode phase should fill:
 *   - orphanUserStoryIds: US-* without any tracing task (Phase 6 delta)
 *   - orphanAcceptanceCriteria: { usId, acId } pairs without any test
 *                                (Phase 7 delta)
 *   - orphanEvaluationTargets:  US-* / NFR-* without any eval criterion
 *                                (Phase 8 delta)
 *
 * The failure record's `failures_by_packet` is a map of packet_id →
 * failure-code strings of the form `CODE: detail message`. The detail
 * messages follow patterns established by the coherence verifier (see
 * coherenceVerifier.ts §4). This module parses them.
 *
 * Pure function: takes governed_stream records, returns the seed. No
 * side effects. Idempotent.
 */

import type {
  GovernedStreamRecord,
  PacketSynthesisFailureContent,
} from '../../types/records';

export interface CycleRestartSeed {
  /** US-* ids whose packets need additional tasks (P1 / C2 failures). */
  orphanUserStoryIds: Set<string>;
  /** Orphan AC entries (each carries the US it belongs to so the synthesizer can scope tests correctly). */
  orphanAcceptanceCriteria: Array<{ usId: string; acId: string }>;
  /** US-* / NFR-* ids needing an evaluation criterion (P4 / P5 failures). */
  orphanEvaluationTargets: Set<string>;
}

const EMPTY_SEED: CycleRestartSeed = {
  orphanUserStoryIds: new Set(),
  orphanAcceptanceCriteria: [],
  orphanEvaluationTargets: new Set(),
};

/**
 * Get the latest packet_synthesis_failure content for a run, or null
 * when none exist (fresh run / first cycle / coherent pipeline).
 */
function getLatestFailure(records: GovernedStreamRecord[]): PacketSynthesisFailureContent | null {
  // Records are returned in `produced_at ASC` order by getRecordsByType,
  // so the last entry is the most recent.
  for (let i = records.length - 1; i >= 0; i--) {
    const c = records[i].content as unknown as PacketSynthesisFailureContent | undefined;
    if (c?.kind === 'packet_synthesis_failure') return c;
  }
  return null;
}

/** Parse P3 detail: `P3_AC_NO_TEST: US-001/AC-001 has no test case`. */
function parseP3AcRef(detail: string): { usId: string; acId: string } | null {
  // Strip leading "P3_AC_NO_TEST: " then expect "US-XXX/AC-YYY ..."
  const m = /P3_AC_NO_TEST:\s*([a-z][\w-]*)\/([a-z][\w-]*)/i.exec(detail);
  if (!m) return null;
  return { usId: m[1], acId: m[2] };
}

/** Parse P4: `P4_USER_STORY_NO_EVAL: US-001 has no evaluation criterion`. */
function parseP4Target(detail: string): string | null {
  const m = /P4_USER_STORY_NO_EVAL:\s*([a-z][\w-]*)/i.exec(detail);
  return m ? m[1] : null;
}

/** Parse P5: `P5_NFR_NO_EVAL: NFR-001 has no evaluation criterion`. */
function parseP5Target(detail: string): string | null {
  const m = /P5_NFR_NO_EVAL:\s*([a-z][\w-]*)/i.exec(detail);
  return m ? m[1] : null;
}

/**
 * Walk a packet's failure list, accumulating the seed entries. The
 * packet itself is identified by packetId only for log context here —
 * the seed is keyed by the upstream artifact ids the failures reference,
 * because that's what the delta-mode synthesizers need to fill in.
 */
function accumulatePacketFailures(
  failures: string[],
  seed: CycleRestartSeed,
  packet: ImplementationPacketLike | null,
): void {
  for (const f of failures) {
    if (f.startsWith('P1_NO_USER_STORY') || f.startsWith('C2_ATOMIC_TASK_HAS_NO_PACKET')) {
      // The orphan ids for these failures are the user stories the task
      // SHOULD have traced to. We can't recover those from the failure
      // string alone — the packet body has the task and component_id,
      // and the synthesizer needs to figure out which US to attach.
      // The caller passes the packet so we can mark a synthetic "no
      // user story" pin and the Phase 6 delta-synth resolves it by
      // looking at unimplemented user stories at synthesis time.
      if (packet) seed.orphanUserStoryIds.add(`__packet_needs_us:${packet.packet_id}`);
      continue;
    }
    const p3 = parseP3AcRef(f);
    if (p3) {
      seed.orphanAcceptanceCriteria.push(p3);
      continue;
    }
    const p4 = parseP4Target(f);
    if (p4) {
      seed.orphanEvaluationTargets.add(p4);
      continue;
    }
    const p5 = parseP5Target(f);
    if (p5) {
      seed.orphanEvaluationTargets.add(p5);
    }
    // P2 / P6 / P7 / A* / Cn failures are not directly fillable by
    // a phase delta. They're left for the operator to triage (or for
    // future delta types). The cycle controller's routing already
    // chooses the most-actionable phase based on these codes.
  }
}

/** Minimal type — we only need packet_id from the implementation_packet content. */
interface ImplementationPacketLike {
  kind: 'implementation_packet';
  packet_id: string;
  user_stories: Array<{ id: string }>;
}

/**
 * Build the cycle-restart seed by reading:
 *   - the latest packet_synthesis_failure record (failure codes)
 *   - the implementation_packet records (so we can correlate packet
 *     ids back to the user stories they SHOULD reference)
 *
 * Returns an empty seed (no failures) when nothing is wrong upstream.
 */
export function buildCycleRestartSeed(
  failureRecords: GovernedStreamRecord[],
  packetRecords: GovernedStreamRecord[],
  allUserStories: Array<{ id: string }>,
): CycleRestartSeed {
  const failure = getLatestFailure(failureRecords);
  if (!failure || failure.total_blocking_failures === 0) return EMPTY_SEED;

  const seed: CycleRestartSeed = {
    orphanUserStoryIds: new Set(),
    orphanAcceptanceCriteria: [],
    orphanEvaluationTargets: new Set(),
  };

  // Build a quick packet_id → packet map so the per-packet failures can
  // be correlated back to packet contents.
  const packetsById = new Map<string, ImplementationPacketLike>();
  for (const r of packetRecords) {
    const c = r.content as unknown as ImplementationPacketLike;
    if (c?.kind === 'implementation_packet' && c.packet_id) {
      packetsById.set(c.packet_id, c);
    }
  }

  for (const [packetId, failures] of Object.entries(failure.failures_by_packet ?? {})) {
    accumulatePacketFailures(failures, seed, packetsById.get(packetId) ?? null);
  }

  // Resolve `__packet_needs_us:<packetId>` placeholders to actual user
  // story ids by finding stories not yet referenced by any packet. The
  // simplest heuristic: any US whose id doesn't appear in
  // ANY packet's user_stories is orphan and qualifies.
  if (Array.from(seed.orphanUserStoryIds).some((s) => s.startsWith('__packet_needs_us:'))) {
    const usReferenced = new Set<string>();
    for (const [, packet] of packetsById) {
      for (const us of packet.user_stories ?? []) usReferenced.add(us.id);
    }
    seed.orphanUserStoryIds.clear();
    for (const us of allUserStories) {
      if (!usReferenced.has(us.id)) seed.orphanUserStoryIds.add(us.id);
    }
  }

  return seed;
}

export function isSeedEmpty(seed: CycleRestartSeed): boolean {
  return seed.orphanUserStoryIds.size === 0
      && seed.orphanAcceptanceCriteria.length === 0
      && seed.orphanEvaluationTargets.size === 0;
}
