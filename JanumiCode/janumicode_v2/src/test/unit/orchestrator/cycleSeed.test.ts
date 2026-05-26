/**
 * Unit tests for cycle-restart seed extraction.
 */
import { describe, it, expect } from 'vitest';
import { buildCycleRestartSeed, isSeedEmpty } from '../../../lib/orchestrator/phases/cycleSeed';
import type { GovernedStreamRecord } from '../../../lib/types/records';

function failureRecord(failuresByPacket: Record<string, string[]>): GovernedStreamRecord {
  const total = Object.values(failuresByPacket).reduce((n, arr) => n + arr.length, 0);
  return {
    id: 'rec-fail',
    record_type: 'packet_synthesis_failure',
    schema_version: '1.0',
    workflow_run_id: 'wf',
    phase_id: '9',
    sub_phase_id: 'packet_synthesis',
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: 'test',
    produced_at: new Date().toISOString(),
    is_current_version: 1,
    derived_from_record_ids: [],
    content: {
      kind: 'packet_synthesis_failure',
      schemaVersion: '1.0',
      failures_by_packet: failuresByPacket,
      cross_packet_failures: {},
      total_packets: Object.keys(failuresByPacket).length,
      failed_packets: Object.keys(failuresByPacket).length,
      total_blocking_failures: total,
      total_advisory_findings: 0,
      total_ai_proposed_root_count: 0,
    },
  } as unknown as GovernedStreamRecord;
}

function packetRecord(packetId: string, userStoryIds: string[]): GovernedStreamRecord {
  return {
    id: `rec-pkt-${packetId}`,
    record_type: 'implementation_packet',
    schema_version: '1.0',
    workflow_run_id: 'wf',
    phase_id: '9',
    sub_phase_id: 'packet_synthesis',
    produced_by_agent_role: 'orchestrator',
    janumicode_version_sha: 'test',
    produced_at: new Date().toISOString(),
    is_current_version: 1,
    derived_from_record_ids: [],
    content: {
      kind: 'implementation_packet',
      packet_id: packetId,
      user_stories: userStoryIds.map((id) => ({ id })),
    },
  } as unknown as GovernedStreamRecord;
}

describe('buildCycleRestartSeed', () => {
  it('returns empty seed when no failures recorded', () => {
    const seed = buildCycleRestartSeed([], [], []);
    expect(isSeedEmpty(seed)).toBe(true);
  });

  it('returns empty seed when failure record has zero blocking failures', () => {
    const empty: GovernedStreamRecord = {
      id: 'rec', record_type: 'packet_synthesis_failure', schema_version: '1.0',
      workflow_run_id: 'wf', phase_id: '9', sub_phase_id: 'packet_synthesis',
      produced_by_agent_role: 'orchestrator', janumicode_version_sha: 'test',
      produced_at: new Date().toISOString(), is_current_version: 1, derived_from_record_ids: [],
      content: {
        kind: 'packet_synthesis_failure', schemaVersion: '1.0',
        failures_by_packet: {}, cross_packet_failures: {},
        total_packets: 0, failed_packets: 0,
        total_blocking_failures: 0, total_advisory_findings: 0, total_ai_proposed_root_count: 0,
      },
    } as unknown as GovernedStreamRecord;
    const seed = buildCycleRestartSeed([empty], [], []);
    expect(isSeedEmpty(seed)).toBe(true);
  });

  it('extracts orphan ACs from P3 failures', () => {
    const failure = failureRecord({
      'pkt-A': [
        'P3_AC_NO_TEST: US-001/AC-001 has no test case',
        'P3_AC_NO_TEST: US-002/AC-003 has no test case',
      ],
    });
    const seed = buildCycleRestartSeed([failure], [], []);
    expect(seed.orphanAcceptanceCriteria).toHaveLength(2);
    expect(seed.orphanAcceptanceCriteria).toContainEqual({ usId: 'US-001', acId: 'AC-001' });
    expect(seed.orphanAcceptanceCriteria).toContainEqual({ usId: 'US-002', acId: 'AC-003' });
  });

  it('extracts orphan eval targets from P4 + P5 failures', () => {
    const failure = failureRecord({
      'pkt-A': [
        'P4_USER_STORY_NO_EVAL: US-001 has no evaluation criterion',
        'P5_NFR_NO_EVAL: NFR-001 has no evaluation criterion',
      ],
    });
    const seed = buildCycleRestartSeed([failure], [], []);
    expect(seed.orphanEvaluationTargets.has('US-001')).toBe(true);
    expect(seed.orphanEvaluationTargets.has('NFR-001')).toBe(true);
  });

  it('resolves orphan-story placeholders to user stories not in any packet', () => {
    const failure = failureRecord({
      'pkt-A': ['P1_NO_USER_STORY: packet pkt-A has no user stories'],
    });
    const packets = [packetRecord('pkt-A', [])];   // packet exists but has zero user stories
    const allUs = [{ id: 'US-001' }, { id: 'US-002' }, { id: 'US-003' }];
    const seed = buildCycleRestartSeed([failure], packets, allUs);
    expect(seed.orphanUserStoryIds.has('US-001')).toBe(true);
    expect(seed.orphanUserStoryIds.has('US-002')).toBe(true);
    expect(seed.orphanUserStoryIds.has('US-003')).toBe(true);
  });

  it('skips already-covered user stories during orphan resolution', () => {
    const failure = failureRecord({
      'pkt-A': ['P1_NO_USER_STORY: packet pkt-A has no user stories'],
    });
    // Another packet covers US-001 — only US-002 and US-003 are orphan.
    const packets = [packetRecord('pkt-A', []), packetRecord('pkt-B', ['US-001'])];
    const allUs = [{ id: 'US-001' }, { id: 'US-002' }, { id: 'US-003' }];
    const seed = buildCycleRestartSeed([failure], packets, allUs);
    expect(seed.orphanUserStoryIds.has('US-001')).toBe(false);
    expect(seed.orphanUserStoryIds.has('US-002')).toBe(true);
    expect(seed.orphanUserStoryIds.has('US-003')).toBe(true);
  });

  it('uses the most recent failure record when multiple exist', () => {
    const oldFailure = failureRecord({ 'pkt-old': ['P3_AC_NO_TEST: US-OLD/AC-1 has no test case'] });
    const newFailure = failureRecord({ 'pkt-new': ['P3_AC_NO_TEST: US-NEW/AC-1 has no test case'] });
    const seed = buildCycleRestartSeed([oldFailure, newFailure], [], []);
    expect(seed.orphanAcceptanceCriteria).toContainEqual({ usId: 'US-NEW', acId: 'AC-1' });
    expect(seed.orphanAcceptanceCriteria).not.toContainEqual({ usId: 'US-OLD', acId: 'AC-1' });
  });
});
