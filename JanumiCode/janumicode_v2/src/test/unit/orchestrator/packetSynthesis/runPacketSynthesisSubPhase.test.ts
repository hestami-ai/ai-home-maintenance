/**
 * Characterization tests for runPacketSynthesisSubPhase.
 *
 * Why these exist
 * ───────────────
 * The sub-phase orchestrator walks the governed stream, builds packets via the
 * pure builder + coherence verifier, and persists three kinds of records
 * (implementation_packet, completion_criteria_coverage_report, and — only when
 * a blocking coherence failure occurs — packet_synthesis_failure) plus a
 * workflow_runs telemetry UPDATE. Before this file the function had NO unit
 * coverage; these tests pin the observable persistence/return contract so the
 * S3776 decomposition (extracting computeCompletionCriteriaCoverage /
 * persistCoherenceOutcome / updateWorkflowTelemetry) is provably
 * behavior-preserving.
 *
 * A lightweight fake engine (same pattern as phase9Recon's gatherTechnicalConstraints
 * test) records every writeRecord / db.prepare().run() / setSubPhase call. A single
 * minimal atomic task drives buildPackets to emit exactly one packet — no user
 * stories / tests / evals are seeded, so the packet carries an empty completion
 * criteria set (coverage → 100%) and whatever coherence verdict the verifier
 * assigns.
 */
import { describe, it, expect } from 'vitest';
import {
  runPacketSynthesisSubPhase,
  type PacketSynthesisContext,
} from '../../../../lib/orchestrator/phases/packetSynthesis';
import type { GovernedStreamRecord } from '../../../../lib/types/records';

// A minimal atomic Phase-6.1a task leaf — enough for buildPackets to emit one
// packet. Everything else the collectors read is absent from the stream.
const atomicTaskRecord = {
  id: 'rec-task-1',
  record_type: 'task_decomposition_node',
  sub_phase_id: 'task_skeleton',
  produced_at: '2026-01-01T00:00:00.000Z',
  is_current_version: 1,
  content: {
    kind: 'task_decomposition_node',
    node_id: 'TN-1',
    status: 'atomic',
    task: {
      id: 'T-1',
      name: 'Minimal atomic task',
      description: 'A single atomic leaf with no upstream context.',
    },
  },
} as unknown as GovernedStreamRecord;

interface WriteRecordCall {
  record_type: string;
  content: Record<string, unknown>;
}

function makeFakeEngine(taskRecords: GovernedStreamRecord[] = [atomicTaskRecord]) {
  const writes: WriteRecordCall[] = [];
  const preparedSql: string[] = [];
  const telemetryRuns: unknown[][] = [];
  const subPhaseCalls: Array<[string, string]> = [];
  const engine = {
    janumiCodeVersionSha: 'test-sha',
    stateMachine: {
      setSubPhase: (id: string, sp: string) => { subPhaseCalls.push([id, sp]); },
    },
    writer: {
      getRecordsByType: (_runId: string, rt: string): GovernedStreamRecord[] =>
        (rt === 'task_decomposition_node' ? taskRecords : []),
      writeRecord: (rec: Record<string, unknown>) => {
        writes.push(rec as unknown as WriteRecordCall);
      },
    },
    db: {
      prepare: (sql: string) => {
        preparedSql.push(sql);
        return { run: (...args: unknown[]) => { telemetryRuns.push(args); } };
      },
    },
  } as unknown as PacketSynthesisContext['engine'];
  return { engine, writes, preparedSql, telemetryRuns, subPhaseCalls };
}

describe('runPacketSynthesisSubPhase — characterization (fake engine)', () => {
  it('emits one packet, persists packet + coverage-report records, and updates telemetry', () => {
    const { engine, writes, preparedSql, telemetryRuns, subPhaseCalls } = makeFakeEngine();
    const workflowRun = { id: 'run-1' } as unknown as PacketSynthesisContext['workflowRun'];

    const result = runPacketSynthesisSubPhase({ workflowRun, engine });

    // sub-phase entered
    expect(subPhaseCalls).toContainEqual(['run-1', 'packet_synthesis']);

    // one packet built and returned
    expect(result.packets).toHaveLength(1);
    expect(typeof result.totalBlockingFailures).toBe('number');
    expect(typeof result.failedPackets).toBe('number');

    // exactly one implementation_packet record persisted
    expect(writes.filter((w) => w.record_type === 'implementation_packet')).toHaveLength(1);

    // completion-criteria coverage report persisted; a minimal task has no
    // test_execution criteria → total 0 → 100%.
    const coverage = writes.find(
      (w) => (w.content as { kind?: string }).kind === 'completion_criteria_coverage_report',
    );
    expect(coverage).toBeDefined();
    expect(coverage!.content.total_test_execution_criteria).toBe(0);
    expect(coverage!.content.coverage_percentage).toBe(100);

    // telemetry UPDATE issued once with packet_count = 1 and the run id in WHERE.
    expect(preparedSql.some((s) => s.includes('UPDATE workflow_runs'))).toBe(true);
    expect(telemetryRuns).toHaveLength(1);
    expect(telemetryRuns[0][0]).toBe(1); // packet_count = packetsTotal
    expect(telemetryRuns[0][3]).toBe('run-1'); // WHERE id = ?
  });

  it('returns the empty result and writes nothing when there are no atomic tasks', () => {
    const { engine, writes, telemetryRuns, subPhaseCalls } = makeFakeEngine([]);
    const workflowRun = { id: 'run-empty' } as unknown as PacketSynthesisContext['workflowRun'];

    const result = runPacketSynthesisSubPhase({ workflowRun, engine });

    // sub-phase is still entered before the early return
    expect(subPhaseCalls).toContainEqual(['run-empty', 'packet_synthesis']);
    expect(result).toEqual({
      packets: [],
      totalBlockingFailures: 0,
      totalAdvisoryFindings: 0,
      totalAiProposedRoots: 0,
      failedPackets: 0,
    });
    // no packets → no records persisted and no telemetry UPDATE
    expect(writes).toHaveLength(0);
    expect(telemetryRuns).toHaveLength(0);
  });
});
