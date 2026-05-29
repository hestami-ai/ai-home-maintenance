/**
 * Per-record-type structural summarizers for the `record.added` AODD
 * event payload.
 *
 * The trace's record.added envelope only carries `{ record_id,
 * record_type }` by default. That tells an agent which records were
 * written, but not what shape — for an implementation_packet, it can't
 * see at a glance whether `nfrs` is populated or empty. Run 108's
 * packet_synthesis bug surfaced exactly this gap: AODD said "54
 * implementation_packet records were written" but not "every one has
 * empty user_stories/nfrs/test_cases" — the agent had to read source
 * to find the bug.
 *
 * Summarizers here keep that gap closed. Each summarizer is a pure
 * function of `content` that returns a small structural fingerprint.
 * The result lands in `record.added.payload.summary` so trace
 * consumers can answer shape questions without touching the DB.
 *
 * Adding a new summarizer:
 *   1. Define it as a pure function on the content object.
 *   2. Register it in the SUMMARIZERS map below.
 *   3. Keep the output small — counts, ids, sample messages. Not full
 *      payloads (use `maybeSpillText` for those at other emit sites).
 */

import type { RecordType } from '../types/records';

type Content = Record<string, unknown>;
type Summarizer = (content: Content) => Record<string, unknown>;

// ── Helpers ────────────────────────────────────────────────────────

function arrLen(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

function pickStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

// ── Summarizers ────────────────────────────────────────────────────

const implementationPacketSummary: Summarizer = (content) => {
  const task = content.task as Content | undefined;
  const component = content.component as Content | undefined;
  return {
    packet_id: pickStr(content.packet_id),
    task_id: pickStr(task?.id),
    component_id: pickStr(component?.id),
    field_counts: {
      user_stories: arrLen(content.user_stories),
      nfrs: arrLen(content.nfrs),
      data_models: arrLen(content.data_models),
      api_definitions: arrLen(content.api_definitions),
      test_cases: arrLen(content.test_cases),
      evaluation_criteria: arrLen(content.evaluation_criteria),
      compliance_items: arrLen(content.compliance_items),
      active_constraints: arrLen(content.active_constraints),
    },
    coherence_passed: typeof (content.coherence as Content | undefined)?.passed === 'boolean'
      ? (content.coherence as { passed: boolean }).passed
      : undefined,
  };
};

function aggregatePacketFailureCodes(
  failuresByPacket: Record<string, string[]>,
  crossPacket: Record<string, string[]>,
): Record<string, number> {
  const codeCounts: Record<string, number> = {};
  for (const codes of Object.values(failuresByPacket)) {
    for (const f of codes ?? []) {
      const code = f.split(':')[0] ?? 'UNKNOWN';
      codeCounts[code] = (codeCounts[code] ?? 0) + 1;
    }
  }
  for (const [code, details] of Object.entries(crossPacket)) {
    codeCounts[code] = (codeCounts[code] ?? 0) + (details?.length ?? 0);
  }
  return codeCounts;
}

function sampleFailureMessages(
  failuresByPacket: Record<string, string[]>,
  limit: number,
): string[] {
  const out: string[] = [];
  for (const codes of Object.values(failuresByPacket)) {
    for (const f of codes ?? []) {
      out.push(f);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

function pickNum(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}

const packetSynthesisFailureSummary: Summarizer = (content) => {
  // Real PacketSynthesisFailureContent shape (records.ts:1413):
  //   { failures_by_packet: Record<packet_id, code[]>,
  //     cross_packet_failures: Record<code, details[]>,
  //     total_packets, failed_packets, total_blocking_failures,
  //     total_advisory_findings, total_ai_proposed_root_count }
  // Previous shape assumed `blocking_failures: string[]` flat — wrong;
  // surfaced empty counts on ts-109 even though log.warn said 92
  // blocking failures.
  const failuresByPacket = (content.failures_by_packet ?? {}) as Record<
    string,
    string[]
  >;
  const crossPacket = (content.cross_packet_failures ?? {}) as Record<
    string,
    string[]
  >;
  const codeCounts = aggregatePacketFailureCodes(failuresByPacket, crossPacket);
  return {
    total_packets: pickNum(content.total_packets),
    failed_packets: pickNum(content.failed_packets),
    blocking_failure_count: pickNum(content.total_blocking_failures),
    advisory_finding_count: pickNum(content.total_advisory_findings),
    ai_proposed_root_count: pickNum(content.total_ai_proposed_root_count),
    top_failure_codes: Object.entries(codeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({ code, count })),
    sample_blocking_messages: sampleFailureMessages(failuresByPacket, 5),
  };
};

const requirementDecompositionNodeSummary: Summarizer = (content) => {
  // Real shape (records.ts:844): { node_id, parent_node_id, display_key,
  // root_fr_id, depth, status, root_kind, tier,
  // user_story: { id, acceptance_criteria: [{id, ...}], ... } }
  // AC ids on the user_story are the join keys Phase 7 references; their
  // distribution surfaces collisions like ts-109's AC-001 hard-code.
  const userStory = content.user_story as Record<string, unknown> | undefined;
  const acs = Array.isArray(userStory?.acceptance_criteria)
    ? (userStory.acceptance_criteria as Array<Record<string, unknown>>)
    : [];
  const acIds = acs.map((a) => pickStr(a.id)).filter((s): s is string => Boolean(s));
  return {
    node_id: pickStr(content.node_id),
    parent_node_id: pickStr(content.parent_node_id),
    display_key: pickStr(content.display_key),
    root_kind: pickStr(content.root_kind),
    root_fr_id: pickStr(content.root_fr_id),
    depth: typeof content.depth === 'number' ? content.depth : undefined,
    status: pickStr(content.status),
    tier: pickStr(content.tier),
    user_story_id: pickStr(userStory?.id),
    ac_ids_count: acIds.length,
    ac_ids_sample: acIds.slice(0, 5),
  };
};

const taskDecompositionNodeSummary: Summarizer = (content) => {
  // Real shape (records.ts:1179): { node_id, parent_node_id, status,
  // root_task_id, depth, task: { id, component_id, traces_to[],
  // dependency_task_ids[], active_constraints[], completion_criteria[] } }
  // The traces_to[] join surfaces ts-109's defect 4 root cause: tasks
  // whose traces_to has only components (no user-story / NFR ids) can
  // never reach packet_synthesis.user_stories via the standard join.
  const task = content.task as Record<string, unknown> | undefined;
  const tracesTo = Array.isArray(task?.traces_to)
    ? (task.traces_to as string[]).filter((s) => typeof s === 'string')
    : [];
  // Classify the trace targets by id-prefix so the agent sees the
  // composition at a glance ("traces_to has 3 components, 0 user
  // stories, 0 NFRs").
  const tracesByKind: Record<string, number> = {
    components: 0,
    user_stories: 0,
    nfrs: 0,
    acs: 0,
    other: 0,
  };
  for (const ref of tracesTo) {
    if (ref.startsWith('comp-') || ref.startsWith('component-')) tracesByKind.components++;
    else if (ref.startsWith('US-') || ref.startsWith('us-')) tracesByKind.user_stories++;
    else if (ref.startsWith('NFR-') || ref.startsWith('nfr-')) tracesByKind.nfrs++;
    else if (ref.startsWith('AC-') || ref.startsWith('ac-')) tracesByKind.acs++;
    else tracesByKind.other++;
  }
  const deps = Array.isArray(task?.dependency_task_ids)
    ? (task.dependency_task_ids as string[]).length
    : 0;
  const constraints = Array.isArray(task?.active_constraints)
    ? (task.active_constraints as string[]).length
    : 0;
  return {
    node_id: pickStr(content.node_id),
    parent_node_id: pickStr(content.parent_node_id),
    display_key: pickStr(content.display_key),
    root_task_id: pickStr(content.root_task_id),
    depth: typeof content.depth === 'number' ? content.depth : undefined,
    status: pickStr(content.status),
    tier: pickStr(content.tier),
    task_id: pickStr(task?.id),
    component_id: pickStr(task?.component_id),
    traces_to_count: tracesTo.length,
    traces_to_by_kind: tracesByKind,
    dependency_count: deps,
    active_constraints_count: constraints,
  };
};

const agentInvocationSummary: Summarizer = (content) => ({
  status: pickStr(content.status),
  model: pickStr(content.model),
  provider: pickStr(content.provider),
  agent_role: pickStr(content.agent_role),
});

const agentOutputSummary: Summarizer = (content) => {
  const text = typeof content.text === 'string' ? content.text : '';
  return {
    status: pickStr(content.status),
    text_chars: text.length,
    has_error: Boolean(content.error_message),
    input_tokens: typeof content.input_tokens === 'number' ? content.input_tokens : undefined,
    output_tokens: typeof content.output_tokens === 'number' ? content.output_tokens : undefined,
    duration_ms: typeof content.duration_ms === 'number' ? content.duration_ms : undefined,
  };
};

const artifactProducedSummary: Summarizer = (content) => ({
  kind: pickStr(content.kind),
});

const reasoningReviewFindingSummary: Summarizer = (content) => ({
  validator_id: pickStr(content.validator_id),
  severity: pickStr(content.severity),
  finding_type: pickStr(content.finding_type),
  target_identifier: pickStr(content.target_identifier),
});

// ── Registry ───────────────────────────────────────────────────────

const SUMMARIZERS: Partial<Record<RecordType, Summarizer>> = {
  implementation_packet: implementationPacketSummary,
  packet_synthesis_failure: packetSynthesisFailureSummary,
  requirement_decomposition_node: requirementDecompositionNodeSummary,
  task_decomposition_node: taskDecompositionNodeSummary,
  agent_invocation: agentInvocationSummary,
  agent_output: agentOutputSummary,
  artifact_produced: artifactProducedSummary,
  reasoning_review_finding_record: reasoningReviewFindingSummary,
};

/**
 * Compute a structural summary for a record's content. Returns
 * `undefined` when no summarizer is registered for the record_type
 * (the caller omits the `summary` field from the AODD payload in that
 * case). Wrapped in a try/catch defensively so a malformed content
 * object can't break the emit path.
 */
export function summarizeRecordContent(
  recordType: RecordType,
  content: Content,
): Record<string, unknown> | undefined {
  const fn = SUMMARIZERS[recordType];
  if (!fn) return undefined;
  try {
    return fn(content);
  } catch {
    return undefined;
  }
}
