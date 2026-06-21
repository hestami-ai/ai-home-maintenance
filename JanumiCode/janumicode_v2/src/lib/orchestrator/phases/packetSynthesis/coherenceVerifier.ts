/**
 * Coherence verifier for implementation packets.
 *
 * Pure function: takes the packet set + the upstream index, returns
 * per-packet coherence results and a cross-packet result. The packet
 * synthesizer wrapper applies these results back onto each packet's
 * `coherence` field before persisting.
 *
 * See docs/design/implementation-packet-synthesis.md §4 for the
 * full assertion catalogue. Codes used in the report:
 *
 *   Per-packet blocking:
 *     P1_NO_USER_STORY                  — packet has zero user stories
 *     P2_USER_STORY_NO_AC               — a US has no ACs (defensive)
 *     P3_AC_NO_TEST                     — an AC has no test case
 *     P4_USER_STORY_NO_EVAL             — a US has no eval criterion
 *     P5_NFR_NO_EVAL                    — an NFR has no eval criterion
 *     P6_COMPONENT_CONTRACT_MISSING     — no resolvable component contract
 *     P7_INVENTED_ID_REFERENCE          — id referenced but not upstream
 *
 *   Per-packet advisory:
 *     A1_TASK_OUTSIDE_COMPONENT_BOUNDARY
 *     A2_DUPLICATE_TEST_CASE
 *     A3_UNMEASURABLE_EVAL_CRITERION
 *
 *   Cross-packet blocking:
 *     C1_TASK_IN_MULTIPLE_PACKETS
 *     C2_ATOMIC_TASK_HAS_NO_PACKET
 *     C3_DEPENDENCY_DAG_CYCLE
 *     C4_DEPENDENCY_REFERENCES_UNKNOWN_PACKET
 */

import type {
  ImplementationPacketContent,
  PacketCoherenceResult,
} from '../../../types/records';
import type { UpstreamIndex } from './upstreamIndex';

export interface VerifierInput {
  packets: ImplementationPacketContent[];
  upstreamIndex: UpstreamIndex;
  /**
   * Set of every atomic Phase 6.1a task id. Used to detect C2 — an
   * atomic task with no corresponding packet.
   */
  atomicTaskIds: Set<string>;
  /**
   * Leaf→root canonicalizer (from the requirement lineage). Lets P4 accept a
   * root-grained eval as satisfying a leaf user story: Phase-8 evals target the
   * canonical root (`US-001`) while packets carry the leaf slices (`US-001-01-1`)
   * the task implements. Defaults to identity when not supplied.
   */
  canonicalize?: (id: string) => string;
}

export interface VerifierResult {
  /** packet_id → coherence result. Caller applies these back onto packets. */
  byPacketId: Map<string, PacketCoherenceResult>;
  /** Cross-packet failures keyed by code → list of human-readable detail. */
  crossPacket: Map<string, string[]>;
  /** Aggregate counts for telemetry. */
  totals: {
    packetsTotal: number;
    packetsFailed: number;
    blockingFailures: number;
    advisoryFindings: number;
    aiProposedRootCount: number;
  };
}

// ── Per-packet assertions ──────────────────────────────────────────

function collectReferencedIds(packet: ImplementationPacketContent): string[] {
  const ids: string[] = [];
  for (const us of packet.user_stories) {
    ids.push(us.id);
    for (const ac of us.acceptance_criteria) ids.push(ac.id);
  }
  for (const n of packet.nfrs) ids.push(n.id);
  if (packet.component.id) ids.push(packet.component.id);
  for (const d of packet.component.dependencies) {
    if (d.component_id) ids.push(d.component_id);
  }
  for (const dm of packet.data_models) ids.push(dm.id);
  for (const api of packet.api_definitions) ids.push(api.id);
  for (const tc of packet.test_cases) ids.push(tc.test_case_id);
  for (const ec of packet.evaluation_criteria) ids.push(ec.target_id);
  for (const ac of packet.active_constraints) ids.push(ac.id);
  for (const c of packet.compliance_items) ids.push(c.id);
  return ids;
}

function verifyPacket(
  packet: ImplementationPacketContent,
  upstreamIndex: UpstreamIndex,
  packetIds: Set<string>,
  canonicalize: (id: string) => string,
): PacketCoherenceResult {
  const blocking: string[] = [];
  const advisory: string[] = [];

  // P1 — Has at least one user story.
  if (packet.user_stories.length === 0) {
    blocking.push(`P1_NO_USER_STORY: packet ${packet.packet_id} (task ${packet.task.id}) has no user stories`);
  }

  // P2 — Every user story has at least one AC.
  for (const us of packet.user_stories) {
    if (us.acceptance_criteria.length === 0) {
      blocking.push(`P2_USER_STORY_NO_AC: ${us.id} has no acceptance criteria`);
    }
  }

  // P3 — Every AC has at least one test case.
  const testRefs = new Set<string>();
  for (const tc of packet.test_cases) {
    for (const r of tc.acceptance_criterion_ids) testRefs.add(r);
  }
  for (const us of packet.user_stories) {
    for (const ac of us.acceptance_criteria) {
      const direct = testRefs.has(ac.id);
      const composite = Array.from(testRefs).some((r) => r === `${us.id}-${ac.id}` || r.startsWith(`${us.id}-`));
      if (!direct && !composite) {
        blocking.push(`P3_AC_NO_TEST: ${us.id}/${ac.id} has no test case`);
      }
    }
  }

  // P4 — Every user story has at least one functional evaluation criterion.
  // A leaf story (US-001-01-1) is satisfied by an eval targeting its canonical
  // root (US-001): Phase-8 evals are root-grained, packets carry leaf slices.
  const evalTargets = new Set(packet.evaluation_criteria.map((e) => e.target_id));
  for (const us of packet.user_stories) {
    if (!evalTargets.has(us.id) && !evalTargets.has(canonicalize(us.id))) {
      blocking.push(`P4_USER_STORY_NO_EVAL: ${us.id} has no evaluation criterion`);
    }
  }

  // P5 — Every NFR has at least one quality evaluation criterion.
  for (const n of packet.nfrs) {
    if (!evalTargets.has(n.id)) {
      blocking.push(`P5_NFR_NO_EVAL: ${n.id} has no evaluation criterion`);
    }
  }

  // P6 — Component contract present (id + ≥1 responsibility).
  if (!packet.component.id || packet.component.responsibilities.length === 0) {
    blocking.push(`P6_COMPONENT_CONTRACT_MISSING: packet ${packet.packet_id} has no resolvable component contract`);
  }

  // P7 — No invented id references.
  for (const ref of collectReferencedIds(packet)) {
    if (!ref) continue;
    const resolved = upstreamIndex.allUpstreamIds.has(ref);
    // (Per-ref resolution events used to fan out into lifecycle.ndjson
    // for granular forensics on fabricated dm-*/api-* ids. With the
    // legacy lifecycle stream retired, unresolved refs are still
    // surfaced via the blocking-failure list below; the packet record's
    // coherence verdict captures the rollup.)
    if (resolved) continue;
    // ACs use a per-user-story namespace (AC-001 may appear under multiple
    // user stories); a literal AC-id may not appear in the upstream index
    // as a standalone id but is still grounded if it appears nested under
    // a known US. The indexer DOES collect nested AC ids (see EXTRACTION_RULES
    // fr_bloom_skeleton.nested), so direct match is the expected path.
    // Packet ids (depends_on_packets) are validated separately in C4.
    blocking.push(`P7_INVENTED_ID_REFERENCE: '${ref}' not found upstream`);
  }
  // C4-side P7 check: depends_on_packets must reference real packet_ids.
  for (const depPacketId of packet.depends_on_packets) {
    if (!packetIds.has(depPacketId)) {
      blocking.push(`P7_INVENTED_ID_REFERENCE: depends_on_packets references unknown packet ${depPacketId}`);
    }
  }

  // A1 — Task write-paths inside component boundary (advisory).
  if (packet.component.id && packet.task.write_directory_paths.length > 0) {
    const compSlug = packet.component.id.replace(/^(comp|component|cmp)[-_]/, '').toLowerCase();
    const insideBoundary = packet.task.write_directory_paths.some((p) =>
      p.toLowerCase().includes(compSlug),
    );
    if (!insideBoundary && compSlug.length > 0) {
      advisory.push(`A1_TASK_OUTSIDE_COMPONENT_BOUNDARY: task ${packet.task.id} write_directory_paths do not mention component '${packet.component.id}' slug`);
    }
  }

  // P8 — Each test_execution completion criterion should be covered by a test
  // case (advisory). The criterion is the executor's authoritative deliverable;
  // packetBuilder binds covering tests via the criterion's verified ACs (or the
  // task's AC set). An uncovered criterion means the deliverable has no
  // pre-written test — the executor must author one. Advisory, not blocking:
  // routing to Phase 7 cannot synthesize a CC-targeted test (CC live outside
  // Phase 7's AC namespace); honest gap surfaced for the executor + telemetry.
  for (const cc of packet.task.completion_criteria) {
    if (cc.verification_method !== 'test_execution') continue;
    if (!cc.covered_by_test_ids || cc.covered_by_test_ids.length === 0) {
      advisory.push(`P8_CC_NO_TEST: completion criterion ${cc.criterion_id} (task ${packet.task.id}) has no covering test case — executor must author one`);
    }
  }

  // A2 — No two test cases share identical AC refs + expected_outcome.
  const seenTests = new Map<string, string>();
  for (const tc of packet.test_cases) {
    // expected_outcome is normalised to a string by the packet builder, but
    // never assume — a stray array/undefined here would crash the whole phase.
    const outcome = typeof tc.expected_outcome === 'string'
      ? tc.expected_outcome.trim()
      : Array.isArray(tc.expected_outcome)
        ? (tc.expected_outcome as unknown[]).filter((x) => typeof x === 'string').join('; ')
        : String(tc.expected_outcome ?? '');
    const key = `${[...tc.acceptance_criterion_ids].sort().join(',')}::${outcome}`;
    if (seenTests.has(key)) {
      advisory.push(`A2_DUPLICATE_TEST_CASE: ${tc.test_case_id} duplicates ${seenTests.get(key)}`);
    } else {
      seenTests.set(key, tc.test_case_id);
    }
  }

  // A3 — Eval criterion measurability (heuristic: success_condition mentions
  // an HTTP status, a number, a comparison operator, a percentile, or a time unit).
  const measurablePattern = /HTTP|\b[12345]\d{2}\b|\b\d+(\.\d+)?\s*(ms|s|min|hr|%|MB|GB)\b|<=|>=|≤|≥|<|>|equal/i;
  for (const ec of packet.evaluation_criteria) {
    // A property-backed criterion IS measurable by construction: a generator
    // samples the input domain and asserts the invariant for every case.
    if (ec.property_spec && ec.property_spec.invariant.length > 0) continue;
    if (!measurablePattern.test(ec.success_condition)) {
      advisory.push(`A3_UNMEASURABLE_EVAL_CRITERION: target ${ec.target_id} success_condition lacks measurable predicate`);
    }
  }

  // Annotations — ai_proposed_root_count over every referenced id.
  const aiRefs: string[] = [];
  for (const ref of collectReferencedIds(packet)) {
    if (upstreamIndex.aiProposedIds.has(ref)) aiRefs.push(ref);
  }

  return {
    passed: blocking.length === 0,
    blocking_failures: blocking,
    advisory_findings: advisory,
    annotations: {
      ai_proposed_root_count: aiRefs.length,
      ai_proposed_root_ids: aiRefs.slice(0, 20),
    },
  };
}

// ── Cross-packet assertions ────────────────────────────────────────

function detectCycles(packets: ImplementationPacketContent[]): string[] {
  // depends_on_packets is the edge set. DFS for cycles.
  const adj = new Map<string, string[]>();
  for (const p of packets) adj.set(p.packet_id, p.depends_on_packets);
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const p of packets) color.set(p.packet_id, WHITE);
  const cycles: string[] = [];

  function dfs(node: string, stack: string[]): void {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of adj.get(node) ?? []) {
      const c = color.get(next);
      if (c === GRAY) {
        // Found a back-edge; record the cycle.
        const cycleStart = stack.indexOf(next);
        const cycleNodes = stack.slice(cycleStart).concat([next]);
        cycles.push(cycleNodes.join(' → '));
      } else if (c === WHITE) {
        dfs(next, stack);
      }
    }
    stack.pop();
    color.set(node, BLACK);
  }

  for (const p of packets) {
    if (color.get(p.packet_id) === WHITE) dfs(p.packet_id, []);
  }
  return cycles;
}

function verifyCrossPacket(input: VerifierInput): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (code: string, detail: string): void => {
    if (!out.has(code)) out.set(code, []);
    out.get(code)!.push(detail);
  };

  // C1 — implement-once: no task in more than one packet.
  const taskCounts = new Map<string, number>();
  for (const p of input.packets) {
    taskCounts.set(p.task.id, (taskCounts.get(p.task.id) ?? 0) + 1);
  }
  for (const [taskId, n] of taskCounts) {
    if (n > 1) add('C1_TASK_IN_MULTIPLE_PACKETS', `task ${taskId} appears in ${n} packets`);
  }

  // C2 — every atomic task has a packet.
  const coveredTaskIds = new Set(input.packets.map((p) => p.task.id));
  for (const atomicId of input.atomicTaskIds) {
    if (!coveredTaskIds.has(atomicId)) {
      add('C2_ATOMIC_TASK_HAS_NO_PACKET', `atomic task ${atomicId} has no packet`);
    }
  }

  // C3 — depends_on_packets DAG is acyclic.
  const cycles = detectCycles(input.packets);
  for (const c of cycles) add('C3_DEPENDENCY_DAG_CYCLE', c);

  // C4 — every dependency packet id resolves.
  const packetIds = new Set(input.packets.map((p) => p.packet_id));
  for (const p of input.packets) {
    for (const dep of p.depends_on_packets) {
      if (!packetIds.has(dep)) {
        add('C4_DEPENDENCY_REFERENCES_UNKNOWN_PACKET', `packet ${p.packet_id} depends on unknown ${dep}`);
      }
    }
  }

  return out;
}

// ── Main entry ─────────────────────────────────────────────────────

export function verifyCoherence(input: VerifierInput): VerifierResult {
  const packetIds = new Set(input.packets.map((p) => p.packet_id));
  const canonicalize = input.canonicalize ?? ((id: string) => id);
  const byPacketId = new Map<string, PacketCoherenceResult>();
  let blockingTotal = 0;
  let advisoryTotal = 0;
  let aiProposedTotal = 0;
  let failedPackets = 0;

  for (const p of input.packets) {
    const result = verifyPacket(p, input.upstreamIndex, packetIds, canonicalize);
    byPacketId.set(p.packet_id, result);
    if (!result.passed) failedPackets++;
    blockingTotal += result.blocking_failures.length;
    advisoryTotal += result.advisory_findings.length;
    aiProposedTotal += result.annotations.ai_proposed_root_count;
  }

  const crossPacket = verifyCrossPacket(input);
  // Cross-packet failures are not attached to any specific packet's
  // `coherence.blocking_failures` — they live in `crossPacket` for the
  // synthesizer wrapper to surface separately. We still tally them into
  // the blocking total so the orchestrator sees an accurate "should I
  // gate?" signal.
  for (const [, details] of crossPacket) blockingTotal += details.length;

  return {
    byPacketId,
    crossPacket,
    totals: {
      packetsTotal: input.packets.length,
      packetsFailed: failedPackets,
      blockingFailures: blockingTotal,
      advisoryFindings: advisoryTotal,
      aiProposedRootCount: aiProposedTotal,
    },
  };
}

/**
 * Convenience: apply per-packet verifier results back onto the packets
 * in-place. The synthesizer wrapper calls this just before persisting
 * the packets to the governed stream.
 */
export function applyCoherenceResults(
  packets: ImplementationPacketContent[],
  byPacketId: Map<string, PacketCoherenceResult>,
): void {
  for (const p of packets) {
    const r = byPacketId.get(p.packet_id);
    if (r) p.coherence = r;
  }
}
