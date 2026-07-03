/**
 * Unit tests for the reusable chunkedCoverageBloom helper (the P6.1
 * chunk-and-reconcile pattern generalized). Pure — no LLM: the generation and
 * reconciliation callbacks are stubs. Proves the orchestrator owns 100%
 * coverage deterministically and never fabricates.
 */
import { describe, it, expect } from 'vitest';
import { chunkedCoverageBloom } from '../../../../lib/orchestrator/phases/chunkedCoverageBloom';

interface Item { id: string; covers: string[] }
const item = (id: string, covers: string[] = []): Item => ({ id, covers });

// One-batch chunker: the whole uncovered set as a single batch.
const singleBatch = (uncovered: Set<string>): Array<Set<string>> => [new Set(uncovered)];

describe('chunkedCoverageBloom', () => {
  it('(1) fans out once per chunk and dedups produced items by idOf', async () => {
    const seen: string[] = [];
    const r = await chunkedCoverageBloom<string, Item>({
      chunks: ['a', 'b', 'c'],
      generateForChunk: async (chunk) => { seen.push(chunk); return [item(`t-${chunk}`), item('dup')]; },
      idOf: (p) => p.id,
      targetCoverageSet: new Set(),
      coveredBy: (p) => p.covers,
      maxReconPasses: 0,
      logLabel: 'test',
    });
    expect(seen).toEqual(['a', 'b', 'c']); // one call per chunk, in order (sequential)
    // t-a, t-b, t-c + a single 'dup' (deduped across chunks)
    expect(r.produced.map((p) => p.id)).toEqual(['t-a', 'dup', 't-b', 't-c']);
  });

  it('(2) full coverage from generation ⇒ zero reconciliation passes fire', async () => {
    let reconCalls = 0;
    const r = await chunkedCoverageBloom<string, Item>({
      chunks: ['x'],
      generateForChunk: async () => [item('t1', ['A', 'B'])],
      idOf: (p) => p.id,
      targetCoverageSet: new Set(['A', 'B']),
      coveredBy: (p) => p.covers,
      chunkUncovered: singleBatch,
      reconcileBatch: async () => { reconCalls++; return []; },
      maxReconPasses: 2,
      logLabel: 'test',
    });
    expect(reconCalls).toBe(0);
    expect(r.coveragePct).toBe(100);
    expect(r.residual.size).toBe(0);
  });

  it('(3) subset covered ⇒ recon fires for the remainder, credits only batch-intersecting items, reaches 100%', async () => {
    // capture the batch OUTSIDE the callback: the helper try/catches reconcileBatch,
    // so an in-callback assertion failure would be swallowed.
    let seenBatch: string[] = [];
    const r = await chunkedCoverageBloom<string, Item>({
      chunks: ['x'],
      generateForChunk: async () => [item('gen', ['A', 'B'])], // A,B covered; C,D orphan
      idOf: (p) => p.id,
      targetCoverageSet: new Set(['A', 'B', 'C', 'D']),
      coveredBy: (p) => p.covers,
      chunkUncovered: singleBatch, // one batch = {C, D}
      reconcileBatch: async (batch) => {
        seenBatch = [...batch].sort();
        return [item('rC', ['C']), item('rZ', ['Z']), item('rD', ['D'])]; // rZ covers nothing in-batch
      },
      maxReconPasses: 2,
      logLabel: 'test',
    });
    expect(seenBatch).toEqual(['C', 'D']); // recon sees only the uncovered remainder
    const ids = r.produced.map((p) => p.id);
    expect(ids).toContain('rC');
    expect(ids).toContain('rD');
    expect(ids).not.toContain('rZ'); // crediting rejects the non-intersecting recon item
    expect(r.coveragePct).toBe(100);
    expect(r.residual.size).toBe(0);
  });

  it('(4a) stops early when a whole pass adds nothing', async () => {
    const passesSeen: number[] = [];
    const r = await chunkedCoverageBloom<string, Item>({
      chunks: ['x'],
      generateForChunk: async () => [item('gen', ['A'])], // B never covered
      idOf: (p) => p.id,
      targetCoverageSet: new Set(['A', 'B']),
      coveredBy: (p) => p.covers,
      chunkUncovered: singleBatch,
      reconcileBatch: async (_batch, info) => { passesSeen.push(info.pass); return []; }, // never covers B
      maxReconPasses: 3,
      logLabel: 'test',
    });
    expect(passesSeen).toEqual([1]); // pass 1 added nothing → no pass 2/3
    expect([...r.residual]).toEqual(['B']);
    expect(r.coveragePct).toBe(50);
  });

  it('(4b) maxReconPasses=0 ⇒ no reconciliation, residual = full uncovered', async () => {
    let reconCalls = 0;
    const r = await chunkedCoverageBloom<string, Item>({
      chunks: ['x'],
      generateForChunk: async () => [item('gen', ['A'])],
      idOf: (p) => p.id,
      targetCoverageSet: new Set(['A', 'B']),
      coveredBy: (p) => p.covers,
      chunkUncovered: singleBatch,
      reconcileBatch: async () => { reconCalls++; return []; },
      maxReconPasses: 0,
      logLabel: 'test',
    });
    expect(reconCalls).toBe(0);
    expect([...r.residual]).toEqual(['B']);
  });

  it('(5) residual after budget calls onResidual with the exact uncovered set, no fabrication', async () => {
    let residualArg: string[] | null = null;
    const r = await chunkedCoverageBloom<string, Item>({
      chunks: ['x'],
      generateForChunk: async () => [item('gen', ['A'])],
      idOf: (p) => p.id,
      targetCoverageSet: new Set(['A', 'B']),
      coveredBy: (p) => p.covers,
      chunkUncovered: singleBatch,
      reconcileBatch: async () => [], // cannot cover B
      maxReconPasses: 1,
      onResidual: (res) => { residualArg = [...res].sort(); },
      logLabel: 'test',
    });
    expect(residualArg).toEqual(['B']);
    expect([...r.residual]).toEqual(['B']);
    // no fabrication: only the single generation item survives
    expect(r.produced.map((p) => p.id)).toEqual(['gen']);
  });

  it('(6) empty targetCoverageSet ⇒ pure fan-out, no reconciliation, coveragePct=100 (the SD-2/ADR path)', async () => {
    let reconCalls = 0;
    const r = await chunkedCoverageBloom<string, Item>({
      chunks: ['d1', 'd2'],
      generateForChunk: async (c) => [item(`adr-${c}`)],
      idOf: (p) => p.id,
      targetCoverageSet: new Set(),
      coveredBy: (p) => p.covers,
      chunkUncovered: singleBatch,
      reconcileBatch: async () => { reconCalls++; return []; },
      maxReconPasses: 2,
      logLabel: 'test',
    });
    expect(reconCalls).toBe(0);
    expect(r.coveragePct).toBe(100);
    expect(r.residual.size).toBe(0);
    expect(r.produced.map((p) => p.id)).toEqual(['adr-d1', 'adr-d2']);
  });

  it('(7) a generateForChunk that throws does not sink the bloom', async () => {
    const r = await chunkedCoverageBloom<string, Item>({
      chunks: ['a', 'b', 'c'],
      generateForChunk: async (c) => { if (c === 'b') throw new Error('boom'); return [item(`t-${c}`)]; },
      idOf: (p) => p.id,
      targetCoverageSet: new Set(),
      coveredBy: (p) => p.covers,
      maxReconPasses: 0,
      logLabel: 'test',
    });
    expect(r.produced.map((p) => p.id)).toEqual(['t-a', 't-c']); // 'b' failed, others survive
  });

  it('(reconcile across passes) covers orphans over multiple passes until complete', async () => {
    // pass 1 covers C, pass 2 covers D → reaches 100% within budget
    let call = 0;
    const r = await chunkedCoverageBloom<string, Item>({
      chunks: ['x'],
      generateForChunk: async () => [item('gen', ['A', 'B'])],
      idOf: (p) => p.id,
      targetCoverageSet: new Set(['A', 'B', 'C', 'D']),
      coveredBy: (p) => p.covers,
      chunkUncovered: singleBatch,
      reconcileBatch: async (batch) => {
        call++;
        if (batch.has('C')) return [item(`r${call}`, ['C'])]; // pass 1: covers C only
        if (batch.has('D')) return [item(`r${call}`, ['D'])]; // pass 2: covers remaining D
        return [];
      },
      maxReconPasses: 3,
      logLabel: 'test',
    });
    expect(r.coveragePct).toBe(100);
    expect(r.residual.size).toBe(0);
    expect(call).toBe(2); // two passes, stopped as soon as covered
  });
});
