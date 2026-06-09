/**
 * Unit tests for the coherence verifier.
 */
import { describe, it, expect } from 'vitest';
import { verifyCoherence } from '../../../../lib/orchestrator/phases/packetSynthesis/coherenceVerifier';
import type { ImplementationPacketContent } from '../../../../lib/types/records';
import type { UpstreamIndex } from '../../../../lib/orchestrator/phases/packetSynthesis/upstreamIndex';

function packet(overrides: Partial<ImplementationPacketContent> = {}): ImplementationPacketContent {
  return {
    kind: 'implementation_packet',
    schemaVersion: '1.0',
    packet_id: 'pkt-1',
    task: {
      id: 'task-001', node_id: 'node-001', name: 't', description: 'd',
      task_type: 'standard', backing_tool: 'claude_code_cli', estimated_complexity: 'low',
      completion_criteria: [], write_directory_paths: ['src/server/foo'],
      read_directory_paths: [], dependency_task_ids: [],
    },
    user_stories: [{
      id: 'US-001', role: 'r', action: 'a', outcome: 'o', priority: 'critical',
      acceptance_criteria: [{ id: 'AC-001', description: 'ac1', measurable_condition: 'HTTP 201' }],
    }],
    nfrs: [],
    component: {
      id: 'comp-001', name: 'foo', domain_id: null,
      responsibilities: [{ id: 'resp-1', description: 'do foo' }],
      dependencies: [], active_constraints: [],
    },
    data_models: [],
    api_definitions: [],
    test_cases: [{
      test_case_id: 'TC-001', type: 'functional',
      acceptance_criterion_ids: ['AC-001'], preconditions: [], expected_outcome: 'HTTP 201',
    }],
    evaluation_criteria: [{
      kind: 'functional', target_id: 'US-001',
      evaluation_method: 'API test', success_condition: 'HTTP 201 returned',
    }],
    active_constraints: [],
    compliance_items: [],
    depends_on_packets: [],
    coherence: { passed: true, blocking_failures: [], advisory_findings: [], annotations: { ai_proposed_root_count: 0, ai_proposed_root_ids: [] } },
    release_id: null,
    release_ordinal: null,
    ...overrides,
  };
}

function idxWithAll(ids: string[], aiProposed: string[] = []): UpstreamIndex {
  return {
    allUpstreamIds: new Set(ids),
    aiProposedIds: new Set(aiProposed),
    userSpecifiedIds: new Set(),
    artifactsById: new Map(),
  };
}

// ── Happy path ─────────────────────────────────────────────────────

describe('verifyCoherence — happy path', () => {
  it('passes a fully coherent packet', () => {
    const p = packet();
    const r = verifyCoherence({
      packets: [p],
      upstreamIndex: idxWithAll(['US-001', 'AC-001', 'comp-001', 'resp-1', 'TC-001']),
      atomicTaskIds: new Set(['task-001']),
    });
    const result = r.byPacketId.get(p.packet_id)!;
    expect(result.passed).toBe(true);
    expect(result.blocking_failures).toHaveLength(0);
    expect(r.crossPacket.size).toBe(0);
  });
});

// ── P1..P7 per-packet assertions ──────────────────────────────────

describe('verifyCoherence — per-packet assertions', () => {
  it('P1: no user story → fail', () => {
    const p = packet({ user_stories: [] });
    const r = verifyCoherence({
      packets: [p], upstreamIndex: idxWithAll(['comp-001', 'resp-1']), atomicTaskIds: new Set(['task-001']),
    });
    const failures = r.byPacketId.get(p.packet_id)!.blocking_failures;
    expect(failures.some((f) => f.startsWith('P1_NO_USER_STORY'))).toBe(true);
  });

  it('P2: user story with no AC → fail', () => {
    const p = packet({
      user_stories: [{
        id: 'US-001', role: 'r', action: 'a', outcome: 'o', priority: 'p', acceptance_criteria: [],
      }],
    });
    const r = verifyCoherence({
      packets: [p], upstreamIndex: idxWithAll(['US-001', 'comp-001', 'resp-1', 'TC-001']),
      atomicTaskIds: new Set(['task-001']),
    });
    const failures = r.byPacketId.get(p.packet_id)!.blocking_failures;
    expect(failures.some((f) => f.startsWith('P2_USER_STORY_NO_AC'))).toBe(true);
  });

  it('P3: AC with no test case → fail', () => {
    const p = packet({ test_cases: [] });
    const r = verifyCoherence({
      packets: [p], upstreamIndex: idxWithAll(['US-001', 'AC-001', 'comp-001', 'resp-1']),
      atomicTaskIds: new Set(['task-001']),
    });
    const failures = r.byPacketId.get(p.packet_id)!.blocking_failures;
    expect(failures.some((f) => f.startsWith('P3_AC_NO_TEST'))).toBe(true);
  });

  it('P4: user story with no evaluation criterion → fail', () => {
    const p = packet({ evaluation_criteria: [] });
    const r = verifyCoherence({
      packets: [p], upstreamIndex: idxWithAll(['US-001', 'AC-001', 'comp-001', 'resp-1', 'TC-001']),
      atomicTaskIds: new Set(['task-001']),
    });
    const failures = r.byPacketId.get(p.packet_id)!.blocking_failures;
    expect(failures.some((f) => f.startsWith('P4_USER_STORY_NO_EVAL'))).toBe(true);
  });

  it('P5: NFR with no evaluation criterion → fail', () => {
    const p = packet({
      nfrs: [{ id: 'NFR-1', category: 'perf', description: 'd' }],
    });
    const r = verifyCoherence({
      packets: [p],
      upstreamIndex: idxWithAll(['US-001', 'AC-001', 'comp-001', 'resp-1', 'TC-001', 'NFR-1']),
      atomicTaskIds: new Set(['task-001']),
    });
    const failures = r.byPacketId.get(p.packet_id)!.blocking_failures;
    expect(failures.some((f) => f.startsWith('P5_NFR_NO_EVAL'))).toBe(true);
  });

  it('P6: missing component contract → fail', () => {
    const p = packet({
      component: {
        id: '', name: '', domain_id: null,
        responsibilities: [], dependencies: [], active_constraints: [],
      },
    });
    const r = verifyCoherence({
      packets: [p], upstreamIndex: idxWithAll(['US-001', 'AC-001', 'TC-001']),
      atomicTaskIds: new Set(['task-001']),
    });
    const failures = r.byPacketId.get(p.packet_id)!.blocking_failures;
    expect(failures.some((f) => f.startsWith('P6_COMPONENT_CONTRACT_MISSING'))).toBe(true);
  });

  it('P7: invented id reference → fail', () => {
    const p = packet();
    const r = verifyCoherence({
      packets: [p],
      // missing US-001 from index → invented reference
      upstreamIndex: idxWithAll(['AC-001', 'comp-001', 'resp-1', 'TC-001']),
      atomicTaskIds: new Set(['task-001']),
    });
    const failures = r.byPacketId.get(p.packet_id)!.blocking_failures;
    expect(failures.some((f) => f.startsWith('P7_INVENTED_ID_REFERENCE'))).toBe(true);
  });

  it('P7 (depends_on): packet refs unknown packet id → fail', () => {
    const p = packet({ depends_on_packets: ['pkt-unknown'] });
    const r = verifyCoherence({
      packets: [p],
      upstreamIndex: idxWithAll(['US-001', 'AC-001', 'comp-001', 'resp-1', 'TC-001']),
      atomicTaskIds: new Set(['task-001']),
    });
    const failures = r.byPacketId.get(p.packet_id)!.blocking_failures;
    expect(failures.some((f) => /P7_INVENTED_ID_REFERENCE.*pkt-unknown/.test(f))).toBe(true);
  });
});

// ── Advisory findings ─────────────────────────────────────────────

describe('verifyCoherence — advisory findings', () => {
  it('A1: task write-paths do not mention component slug → advisory', () => {
    const p = packet({
      task: {
        id: 'task-001', node_id: 'n', name: 'n', description: 'd',
        task_type: 'standard', backing_tool: 'cli', estimated_complexity: 'low',
        completion_criteria: [], write_directory_paths: ['src/somewhere/else'],
        read_directory_paths: [], dependency_task_ids: [],
      },
    });
    const r = verifyCoherence({
      packets: [p], upstreamIndex: idxWithAll(['US-001', 'AC-001', 'comp-001', 'resp-1', 'TC-001']),
      atomicTaskIds: new Set(['task-001']),
    });
    const adv = r.byPacketId.get(p.packet_id)!.advisory_findings;
    expect(adv.some((a) => a.startsWith('A1_TASK_OUTSIDE_COMPONENT_BOUNDARY'))).toBe(true);
  });

  it('A2: duplicate test case (same ACs + expected outcome) → advisory', () => {
    const p = packet({
      test_cases: [
        { test_case_id: 'TC-001', type: 'functional', acceptance_criterion_ids: ['AC-001'], preconditions: [], expected_outcome: 'returns 201' },
        { test_case_id: 'TC-002', type: 'functional', acceptance_criterion_ids: ['AC-001'], preconditions: [], expected_outcome: 'returns 201' },
      ],
    });
    const r = verifyCoherence({
      packets: [p], upstreamIndex: idxWithAll(['US-001', 'AC-001', 'comp-001', 'resp-1', 'TC-001', 'TC-002']),
      atomicTaskIds: new Set(['task-001']),
    });
    const adv = r.byPacketId.get(p.packet_id)!.advisory_findings;
    expect(adv.some((a) => a.startsWith('A2_DUPLICATE_TEST_CASE'))).toBe(true);
  });

  it('A3: eval criterion without measurable predicate → advisory', () => {
    const p = packet({
      evaluation_criteria: [{
        kind: 'functional', target_id: 'US-001',
        evaluation_method: 'review',
        success_condition: 'the system behaves well overall',
      }],
    });
    const r = verifyCoherence({
      packets: [p], upstreamIndex: idxWithAll(['US-001', 'AC-001', 'comp-001', 'resp-1', 'TC-001']),
      atomicTaskIds: new Set(['task-001']),
    });
    const adv = r.byPacketId.get(p.packet_id)!.advisory_findings;
    expect(adv.some((a) => a.startsWith('A3_UNMEASURABLE_EVAL_CRITERION'))).toBe(true);
  });

  it('P8_CC_NO_TEST: test_execution criterion with no covering test → advisory', () => {
    const p = packet({
      task: {
        id: 'task-001', node_id: 'node-001', name: 't', description: 'd',
        task_type: 'standard', estimated_complexity: 'low',
        completion_criteria: [
          { criterion_id: 'CC-1', description: 'delete rows', verification_method: 'test_execution', covered_by_test_ids: [] },
          { criterion_id: 'CC-2', description: 'return 200', verification_method: 'test_execution', covered_by_test_ids: ['TC-001'] },
          { criterion_id: 'CC-3', description: 'schema ok', verification_method: 'schema_check', covered_by_test_ids: [] },
        ],
        write_directory_paths: ['src/server/foo'], read_directory_paths: [], dependency_task_ids: [],
      } as ImplementationPacketContent['task'],
    });
    const r = verifyCoherence({
      packets: [p], upstreamIndex: idxWithAll(['US-001', 'AC-001', 'comp-001', 'resp-1', 'TC-001']),
      atomicTaskIds: new Set(['task-001']),
    });
    const adv = r.byPacketId.get(p.packet_id)!.advisory_findings;
    // Only CC-1 fires: CC-2 is covered, CC-3 is not test_execution.
    expect(adv.filter((a) => a.startsWith('P8_CC_NO_TEST')).length).toBe(1);
    expect(adv.some((a) => a.startsWith('P8_CC_NO_TEST') && a.includes('CC-1'))).toBe(true);
    // P8 is advisory, never blocking.
    expect(r.byPacketId.get(p.packet_id)!.blocking_failures.some((b) => b.includes('P8'))).toBe(false);
  });
});

// ── Annotations ───────────────────────────────────────────────────

describe('verifyCoherence — annotations', () => {
  it('counts ai_proposed_root references and lists them', () => {
    const p = packet();
    const r = verifyCoherence({
      packets: [p],
      upstreamIndex: idxWithAll(['US-001', 'AC-001', 'comp-001', 'resp-1', 'TC-001'], ['US-001', 'comp-001']),
      atomicTaskIds: new Set(['task-001']),
    });
    const ann = r.byPacketId.get(p.packet_id)!.annotations;
    expect(ann.ai_proposed_root_count).toBeGreaterThanOrEqual(2);
    expect(ann.ai_proposed_root_ids).toEqual(expect.arrayContaining(['US-001', 'comp-001']));
  });

  it('passes verifier when ai_proposed refs exist (annotation, not blocking)', () => {
    const p = packet();
    const r = verifyCoherence({
      packets: [p],
      upstreamIndex: idxWithAll(['US-001', 'AC-001', 'comp-001', 'resp-1', 'TC-001'], ['US-001']),
      atomicTaskIds: new Set(['task-001']),
    });
    expect(r.byPacketId.get(p.packet_id)!.passed).toBe(true);
  });
});

// ── C1..C4 cross-packet assertions ────────────────────────────────

describe('verifyCoherence — cross-packet assertions', () => {
  it('C1: same task in multiple packets → fail', () => {
    const a = packet({ packet_id: 'pkt-A' });
    const b = packet({ packet_id: 'pkt-B' });  // same task.id (default 'task-001')
    const r = verifyCoherence({
      packets: [a, b], upstreamIndex: idxWithAll(['US-001', 'AC-001', 'comp-001', 'resp-1', 'TC-001']),
      atomicTaskIds: new Set(['task-001']),
    });
    expect(r.crossPacket.has('C1_TASK_IN_MULTIPLE_PACKETS')).toBe(true);
  });

  it('C2: atomic task with no packet → fail', () => {
    const p = packet();
    const r = verifyCoherence({
      packets: [p],
      upstreamIndex: idxWithAll(['US-001', 'AC-001', 'comp-001', 'resp-1', 'TC-001']),
      atomicTaskIds: new Set(['task-001', 'task-002']),  // task-002 has no packet
    });
    expect(r.crossPacket.has('C2_ATOMIC_TASK_HAS_NO_PACKET')).toBe(true);
  });

  it('C3: dependency cycle → fail', () => {
    const a = packet({ packet_id: 'pkt-A', task: { ...packet().task, id: 'task-A' }, depends_on_packets: ['pkt-B'] });
    const b = packet({ packet_id: 'pkt-B', task: { ...packet().task, id: 'task-B' }, depends_on_packets: ['pkt-A'] });
    const r = verifyCoherence({
      packets: [a, b],
      upstreamIndex: idxWithAll(['US-001', 'AC-001', 'comp-001', 'resp-1', 'TC-001']),
      atomicTaskIds: new Set(['task-A', 'task-B']),
    });
    expect(r.crossPacket.has('C3_DEPENDENCY_DAG_CYCLE')).toBe(true);
  });

  it('C4: depends_on_packets references unknown packet → fail', () => {
    const p = packet({ depends_on_packets: ['pkt-ghost'] });
    const r = verifyCoherence({
      packets: [p],
      upstreamIndex: idxWithAll(['US-001', 'AC-001', 'comp-001', 'resp-1', 'TC-001']),
      atomicTaskIds: new Set(['task-001']),
    });
    expect(r.crossPacket.has('C4_DEPENDENCY_REFERENCES_UNKNOWN_PACKET')).toBe(true);
  });
});

// ── Totals ────────────────────────────────────────────────────────

describe('verifyCoherence — totals', () => {
  it('aggregates correctly across multiple packets', () => {
    const good = packet({ packet_id: 'pkt-G', task: { ...packet().task, id: 'task-G' } });
    const bad = packet({
      packet_id: 'pkt-B', task: { ...packet().task, id: 'task-B' },
      user_stories: [],   // P1 fail
    });
    const r = verifyCoherence({
      packets: [good, bad],
      upstreamIndex: idxWithAll(['US-001', 'AC-001', 'comp-001', 'resp-1', 'TC-001']),
      atomicTaskIds: new Set(['task-G', 'task-B']),
    });
    expect(r.totals.packetsTotal).toBe(2);
    expect(r.totals.packetsFailed).toBe(1);
    expect(r.totals.blockingFailures).toBeGreaterThanOrEqual(1);
  });
});

// ── expected_outcome robustness (slice-129 crash) ──────────────────
// The LLM (test_case_saturation) sometimes emits expected_outcome as an
// ARRAY of outcome strings. The A2 advisory did `tc.expected_outcome.trim()`
// and threw "trim is not a function", halting the whole packet_synthesis
// phase. The verifier must coerce defensively, never crash.

describe('verifyCoherence — expected_outcome is not a string', () => {
  it('does not throw when a test case carries an array expected_outcome', () => {
    const p = packet({
      test_cases: [{
        test_case_id: 'TC-001', type: 'functional', acceptance_criterion_ids: ['AC-001'],
        preconditions: [],
        // Deliberately malformed shape the verifier must tolerate.
        expected_outcome: ['HTTP 201 returned', 'body has id'] as unknown as string,
      }],
    });
    expect(() => verifyCoherence({
      packets: [p],
      upstreamIndex: idxWithAll(['US-001', 'AC-001', 'comp-001', 'resp-1', 'TC-001']),
      atomicTaskIds: new Set(['task-001']),
    })).not.toThrow();
  });
});

describe('coerceOutcomeString', () => {
  it('joins array outcomes, trims strings, and empties nullish', async () => {
    const { coerceOutcomeString } = await import('../../../../lib/orchestrator/phases/packetSynthesis/packetBuilder');
    expect(coerceOutcomeString('  HTTP 201  ')).toBe('HTTP 201');
    expect(coerceOutcomeString(['a', 'b', 1 as unknown as string])).toBe('a; b');
    expect(coerceOutcomeString(undefined)).toBe('');
    expect(coerceOutcomeString(null)).toBe('');
  });
});

// ── P4 leaf-via-root eval bridge (task→leaf binding) ───────────────
// Packets carry LEAF stories (US-001-01-1) while Phase-8 evals target the
// canonical ROOT (US-001). P4 must accept the root eval as satisfying the leaf
// via the lineage canonicalizer; without it, every leaf story falsely fires
// P4_USER_STORY_NO_EVAL (slice-131: 384 of them).

describe('verifyCoherence — P4 leaf story satisfied by root-targeted eval', () => {
  // A packet whose user story is a decomposed LEAF, with a matching leaf test
  // (so P3 passes) and an eval that targets only the canonical ROOT.
  const leafPacket = () => packet({
    user_stories: [{
      id: 'US-001-01-1', role: 'r', action: 'a', outcome: 'o', priority: 'critical',
      acceptance_criteria: [{ id: 'AC-US-001-01-1-001', description: 'ac', measurable_condition: 'HTTP 201' }],
    }],
    test_cases: [{
      test_case_id: 'TC-001', type: 'functional',
      acceptance_criterion_ids: ['AC-US-001-01-1-001'], preconditions: [], expected_outcome: 'HTTP 201',
    }],
    evaluation_criteria: [{
      kind: 'functional', target_id: 'US-001', // ROOT, not the leaf
      evaluation_method: 'API test', success_condition: 'works',
    }],
  });
  const idx = () => idxWithAll(['US-001-01-1', 'AC-US-001-01-1-001', 'comp-001', 'resp-1', 'TC-001', 'US-001']);

  it('passes P4 when canonicalize maps the leaf to the eval-targeted root', () => {
    const r = verifyCoherence({
      packets: [leafPacket()], upstreamIndex: idx(), atomicTaskIds: new Set(['task-001']),
      canonicalize: (id) => (id === 'US-001-01-1' ? 'US-001' : id),
    });
    const res = r.byPacketId.get('pkt-1')!;
    expect(res.blocking_failures.filter((f) => f.startsWith('P4'))).toHaveLength(0);
    expect(res.blocking_failures.filter((f) => f.startsWith('P3'))).toHaveLength(0);
  });

  it('still fires P4 when neither the leaf nor its root is eval-targeted', () => {
    const p = leafPacket();
    p.evaluation_criteria = [{ kind: 'functional', target_id: 'US-999', evaluation_method: 'x', success_condition: 'y' }];
    const r = verifyCoherence({
      packets: [p], upstreamIndex: idx(), atomicTaskIds: new Set(['task-001']),
      canonicalize: (id) => (id === 'US-001-01-1' ? 'US-001' : id),
    });
    expect(r.byPacketId.get('pkt-1')!.blocking_failures.some((f) => f.startsWith('P4_USER_STORY_NO_EVAL'))).toBe(true);
  });
});
