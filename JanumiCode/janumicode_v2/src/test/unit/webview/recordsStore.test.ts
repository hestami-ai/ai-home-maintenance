/**
 * RecordsStore — bounded-window + incremental-index behaviour (pagination fix).
 *
 * Guards the governed-stream memory fix: the store must stay ≤ cap, must never
 * split an agent_invocation from its children when head-dropping, must resolve
 * relationships via indexes identically to the old whole-array scans, and must
 * keep `add()` cheap enough that a full run doesn't blow a wall-time budget
 * (the pre-fix O(n²) path did).
 */
import { describe, it, expect } from 'vitest';
import { RecordsStore, type SerializedRecord } from '../../../webview/stores/records.svelte';

let seq = 0;
function at(): string {
  // Monotonic ISO timestamps; zero-padded so string compare == chronological.
  return `2026-07-06T00:00:00.${String(seq++).padStart(6, '0')}Z`;
}
function rec(id: string, o: Partial<SerializedRecord> = {}): SerializedRecord {
  return {
    id,
    record_type: 'agent_output',
    phase_id: '1',
    sub_phase_id: null,
    produced_by_agent_role: null,
    produced_at: o.produced_at ?? at(),
    authority_level: 1,
    quarantined: false,
    derived_from_record_ids: [],
    content: {},
    ...o,
  };
}

describe('RecordsStore — ordering & dedupe', () => {
  it('dedupes by id', () => {
    const s = new RecordsStore();
    s.add(rec('a'));
    s.add(rec('a'));
    expect(s.records.length).toBe(1);
  });

  it('pins a client_liaison_response directly after its anchor', () => {
    const s = new RecordsStore();
    const intent = rec('intent', { record_type: 'raw_intent_received' });
    const phase = rec('phase1-rec'); // lands chronologically before the response
    const response = rec('resp', {
      record_type: 'client_liaison_response',
      derived_from_record_ids: ['intent'],
    });
    // Arrival order matches production: anchor first, then unrelated phase
    // record, then the (later-timestamped) response.
    s.add(intent);
    s.add(phase);
    s.add(response);
    const ids = s.records.map((r) => r.id);
    // response is lifted to sit right after its anchor, not at the chronological tail.
    expect(ids).toEqual(['intent', 'resp', 'phase1-rec']);
  });
});

describe('RecordsStore — relationship indexes (parity with scans)', () => {
  it('getChildren / isChildOfInvocation / getReviewForOutput', () => {
    const s = new RecordsStore();
    const inv = rec('inv', { record_type: 'agent_invocation' });
    const out = rec('out', { record_type: 'agent_output', derived_from_record_ids: ['inv'] });
    const tool = rec('tool', { record_type: 'tool_call', derived_from_record_ids: ['inv'] });
    const review = rec('rev', {
      record_type: 'reasoning_review_record',
      derived_from_record_ids: ['out'],
    });
    s.add(inv); s.add(out); s.add(tool); s.add(review);

    expect(s.getChildren('inv').map((r) => r.id).sort()).toEqual(['out', 'tool']);
    expect(s.isChildOfInvocation(out)).toBe(true);
    expect(s.isChildOfInvocation(tool)).toBe(true);
    // review points at agent_output → nests via one hop up
    expect(s.isChildOfInvocation(review)).toBe(true);
    expect(s.isChildOfInvocation(inv)).toBe(false);
    expect(s.getReviewForOutput('out')?.id).toBe('rev');
    expect(s.getById('tool')?.id).toBe('tool');
  });

  it('isReferencedByDmrPipeline suppresses detail records + their invocation', () => {
    const s = new RecordsStore();
    const inv = rec('dinv', { record_type: 'agent_invocation' });
    const detail = rec('brief', { record_type: 'agent_output', derived_from_record_ids: ['dinv'] });
    const pipeline = rec('dmr', {
      record_type: 'dmr_pipeline',
      content: { retrieval_brief_record_id: 'brief', stages: [] },
    });
    s.add(inv); s.add(detail); s.add(pipeline);
    expect(s.isReferencedByDmrPipeline(detail)).toBe(true);
    expect(s.isReferencedByDmrPipeline(inv)).toBe(true); // owns a referenced child
  });
});

describe('RecordsStore — bounded window (head-drop)', () => {
  it('caps the window and never splits an invocation from its child', () => {
    const cap = 20;
    const s = new RecordsStore(cap);
    // 200 invocation+output pairs (400 records) at increasing timestamps.
    for (let i = 0; i < 200; i++) {
      const inv = rec(`inv-${i}`, { record_type: 'agent_invocation' });
      s.add(inv);
      s.add(rec(`out-${i}`, { record_type: 'agent_output', derived_from_record_ids: [`inv-${i}`] }));
    }
    expect(s.records.length).toBeLessThanOrEqual(cap);
    expect(s.hasOlder).toBe(true);
    expect(s.totalCount).toBe(400); // monotonic — head-drop doesn't decrement

    // Every invocation still in the window must have its output in the window
    // (group-aware drop must not split a pair).
    for (const r of s.records) {
      if (r.record_type !== 'agent_invocation') continue;
      const idx = r.id.split('-')[1];
      expect(s.getById(`out-${idx}`)).toBeDefined();
    }
    // The newest pair survives.
    expect(s.getById('inv-199')).toBeDefined();
    expect(s.getById('out-199')).toBeDefined();
    // The oldest pair was dropped.
    expect(s.getById('inv-0')).toBeUndefined();
  });

  it('does not head-drop while not stuck to bottom, then re-bounds on trimToCap', () => {
    const cap = 10;
    const s = new RecordsStore(cap);
    s.setStickToBottom(false);
    for (let i = 0; i < 50; i++) s.add(rec(`r-${i}`));
    expect(s.records.length).toBe(50); // allowed to exceed cap while reading history
    s.setStickToBottom(true);
    s.trimToCap();
    expect(s.records.length).toBeLessThanOrEqual(cap);
    expect(s.hasOlder).toBe(true);
  });
});

describe('RecordsStore — snapshot & prependOlder', () => {
  it('setSnapshot caps to the latest window and records totalCount/hasOlder', () => {
    const s = new RecordsStore(10);
    const snap = Array.from({ length: 30 }, (_, i) => rec(`s-${i}`, { produced_at: at() }));
    s.setSnapshot(snap, 1000);
    expect(s.records.length).toBe(10);
    expect(s.totalCount).toBe(1000);
    expect(s.hasOlder).toBe(true);
    // latest 10 kept
    expect(s.oldest?.id).toBe('s-20');
  });

  it('prependOlder adds history at the head and dedupes', () => {
    const s = new RecordsStore(1000);
    const recent = Array.from({ length: 5 }, (_, i) => rec(`b-${i}`, { produced_at: `2026-07-06T00:01:0${i}.0Z` }));
    s.setSnapshot(recent, 10);
    const older = Array.from({ length: 5 }, (_, i) => rec(`a-${i}`, { produced_at: `2026-07-06T00:00:0${i}.0Z` }));
    s.prependOlder([...older, recent[0]], false); // includes a duplicate
    expect(s.records.map((r) => r.id)).toEqual(['a-0', 'a-1', 'a-2', 'a-3', 'a-4', 'b-0', 'b-1', 'b-2', 'b-3', 'b-4']);
    expect(s.hasOlder).toBe(false);
  });
});

describe('RecordsStore — performance guard', () => {
  it('adds 12k records well under budget and stays capped', () => {
    const s = new RecordsStore();
    const t0 = performance.now();
    for (let i = 0; i < 12000; i++) {
      const inv = rec(`p-inv-${i}`, { record_type: 'agent_invocation' });
      s.add(inv);
      s.add(rec(`p-out-${i}`, { record_type: 'agent_output', derived_from_record_ids: [`p-inv-${i}`] }));
    }
    const elapsed = performance.now() - t0;
    // The pre-fix O(n²) store blows this by ~100×; the bounded store is linear.
    expect(elapsed).toBeLessThan(2000);
    expect(s.records.length).toBeLessThanOrEqual(400);
    expect(s.totalCount).toBe(24000);
  });
});
