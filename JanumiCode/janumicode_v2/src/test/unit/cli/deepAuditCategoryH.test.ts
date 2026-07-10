/**
 * Characterization test for deep-audit category H (Phase 8.5 packet
 * integrity). Pins the CURRENT observable behavior of categoryH_packets so
 * the S3776 decomposition (extraction of packetCoherenceFinding /
 * packetEmptyUserStoriesFinding / packetEmptyNfrsFinding / packetRef) is
 * verified behavior-preserving.
 *
 * Behavior captured (from the original inline implementation):
 *   - only `implementation_packet` records are inspected
 *   - a packet whose `coherence.passed` is falsy → one BLOCK finding whose
 *     message lists the first 3 blocking_failures (join '; '), details
 *     carries the RAW blocking_failures (undefined preserved)
 *   - user_stories === [] → BLOCK; nfrs === [] → WARN
 *   - non-array user_stories / nfrs never trigger the empty-array findings
 *   - per packet the emission order is coherence, then user_stories, then nfrs
 *   - `ref` is `packet:${JSON.stringify(c.packet_id ?? '?')}`
 */

import { describe, it, expect } from 'vitest';
import { categoryH_packets, type DbArtifact } from '../../../cli/deep-audit';

function packet(content: Record<string, unknown>, over: Partial<DbArtifact> = {}): DbArtifact {
  return {
    record_id: 'rec-1',
    record_type: 'implementation_packet',
    phase_id: '8',
    sub_phase_id: '8.5',
    produced_at: '2026-01-01T00:00:00Z',
    kind: undefined,
    content,
    ...over,
  };
}

describe('categoryH_packets (characterization)', () => {
  it('ignores non-implementation_packet artifacts even when they look broken', () => {
    const res = categoryH_packets([
      packet({ coherence: { passed: false } }, { record_type: 'artifact_produced' }),
    ]);
    expect(res).toEqual([]);
  });

  it('produces no findings for a fully healthy packet', () => {
    const res = categoryH_packets([
      packet({
        packet_id: 'PKT-1',
        coherence: { passed: true, blocking_failures: [] },
        user_stories: [{ id: 'US-1' }],
        nfrs: [{ id: 'NFR-1' }],
      }),
    ]);
    expect(res).toEqual([]);
  });

  it('emits one BLOCK finding for failed coherence, slicing blocking_failures to 3', () => {
    const res = categoryH_packets([
      packet({
        packet_id: 'PKT-9',
        coherence: { passed: false, blocking_failures: ['a', 'b', 'c', 'd'] },
        user_stories: [{ id: 'US-1' }],
        nfrs: [{ id: 'NFR-1' }],
      }),
    ]);
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual({
      category: 'H',
      severity: 'BLOCK',
      phase_id: '8',
      sub_phase_id: '8.5',
      record_id: 'rec-1',
      ref: 'packet:"PKT-9"',
      message: 'Packet failed coherence: a; b; c',
      details: { blocking_failures: ['a', 'b', 'c', 'd'] },
    });
  });

  it('falls back to {} coherence and "?" packet_id when both are absent', () => {
    const res = categoryH_packets([
      packet({
        user_stories: [{ id: 'US-1' }],
        nfrs: [{ id: 'NFR-1' }],
      }),
    ]);
    expect(res).toHaveLength(1);
    expect(res[0].severity).toBe('BLOCK');
    expect(res[0].ref).toBe('packet:"?"');
    expect(res[0].message).toBe('Packet failed coherence: ');
    expect((res[0].details as { blocking_failures?: string[] }).blocking_failures).toBeUndefined();
  });

  it('flags empty user_stories (BLOCK) and empty nfrs (WARN) in that order', () => {
    const res = categoryH_packets([
      packet({
        packet_id: 'PKT-2',
        coherence: { passed: true },
        user_stories: [],
        nfrs: [],
      }),
    ]);
    expect(res.map((f) => [f.severity, f.ref, f.message])).toEqual([
      ['BLOCK', 'packet:"PKT-2"', 'Packet has user_stories=[] (no acceptance criteria reach executor)'],
      ['WARN', 'packet:"PKT-2"', 'Packet has nfrs=[] (no quality bars reach executor)'],
    ]);
  });

  it('emits coherence, then user_stories, then nfrs when all three fire', () => {
    const res = categoryH_packets([
      packet({
        packet_id: 'PKT-3',
        coherence: { passed: false, blocking_failures: ['boom'] },
        user_stories: [],
        nfrs: [],
      }),
    ]);
    expect(res.map((f) => f.severity)).toEqual(['BLOCK', 'BLOCK', 'WARN']);
    expect(res.map((f) => f.category)).toEqual(['H', 'H', 'H']);
    expect(res[0].message).toBe('Packet failed coherence: boom');
    expect(res[1].message).toBe('Packet has user_stories=[] (no acceptance criteria reach executor)');
    expect(res[2].message).toBe('Packet has nfrs=[] (no quality bars reach executor)');
  });

  it('does not flag non-array user_stories / nfrs as empty-array findings', () => {
    const res = categoryH_packets([
      packet({
        packet_id: 'PKT-4',
        coherence: { passed: true },
        user_stories: undefined,
        nfrs: 'oops',
      }),
    ]);
    expect(res).toEqual([]);
  });

  it('accumulates findings across multiple packet artifacts', () => {
    const res = categoryH_packets([
      packet(
        { packet_id: 'A', coherence: { passed: true }, user_stories: [], nfrs: [{}] },
        { record_id: 'r1' },
      ),
      packet(
        { packet_id: 'B', coherence: { passed: true }, user_stories: [{}], nfrs: [] },
        { record_id: 'r2' },
      ),
    ]);
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({ record_id: 'r1', severity: 'BLOCK', ref: 'packet:"A"' });
    expect(res[1]).toMatchObject({ record_id: 'r2', severity: 'WARN', ref: 'packet:"B"' });
  });
});
