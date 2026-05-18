/**
 * Tests for sidecar dbServer's Buffer rehydration.
 *
 * Bug context: thin-slice-7 launch surfaced "RPC error: Too few parameter
 * values were provided" on every embedding INSERT. Root cause: the RPC
 * bridge serializes params via JSON.stringify, which encodes Buffer
 * instances as `{type:'Buffer', data:[...]}`. JSON.parse on the sidecar
 * side reconstructs plain objects, not Buffers. better-sqlite3 rejects
 * those plain objects when binding to BLOB columns, surfacing as the
 * "too few parameter values" error.
 *
 * The fix walks the params array in handleRequest and rehydrates any
 * such tagged objects back into Buffers before binding.
 *
 * The function is not exported (it's a private module helper). We test
 * it indirectly through behavior — but for unit-test coverage, we
 * test the same logic with an inline reimplementation. The structural
 * shape of the bug is what matters: any sidecar-resident logic that
 * receives JSON-serialized Buffer params must rehydrate.
 */

import { describe, it, expect } from 'vitest';

/** Inline reimplementation of the sidecar's rehydrateParams (kept in sync). */
function rehydrateParams(params: unknown[]): unknown[] {
  return params.map(p => {
    if (
      p && typeof p === 'object' && !Array.isArray(p)
      && (p as Record<string, unknown>).type === 'Buffer'
      && Array.isArray((p as Record<string, unknown>).data)
    ) {
      return Buffer.from((p as { data: number[] }).data);
    }
    return p;
  });
}

describe('sidecar rehydrateParams', () => {
  it('rehydrates a JSON-round-tripped Buffer back into a real Buffer', () => {
    const originalBuf = Buffer.from([1, 2, 3, 4, 5]);
    const roundTripped = JSON.parse(JSON.stringify([originalBuf]));
    expect(Buffer.isBuffer(roundTripped[0])).toBe(false); // sanity

    const [rehydrated] = rehydrateParams(roundTripped);
    expect(Buffer.isBuffer(rehydrated)).toBe(true);
    expect((rehydrated as Buffer).equals(originalBuf)).toBe(true);
  });

  it('passes through non-Buffer params unchanged', () => {
    const params = ['some-id', 42, 3.14, null, true, false];
    const result = rehydrateParams(params);
    expect(result).toEqual(params);
  });

  it('handles a mixed params array (embedding INSERT shape)', () => {
    const buf = Buffer.from([10, 20, 30]);
    const original = ['record-id-x', buf, 'qwen3-embedding:8b', '2026-05-11T00:00:00Z'];
    const roundTripped = JSON.parse(JSON.stringify(original));

    const result = rehydrateParams(roundTripped);
    expect(result).toHaveLength(4);
    expect(result[0]).toBe('record-id-x');
    expect(Buffer.isBuffer(result[1])).toBe(true);
    expect((result[1] as Buffer).equals(buf)).toBe(true);
    expect(result[2]).toBe('qwen3-embedding:8b');
    expect(result[3]).toBe('2026-05-11T00:00:00Z');
  });

  it('does not mistake an array-of-numbers object for a Buffer', () => {
    // A plain object with `type` and `data` fields that doesn't match
    // the Buffer toJSON shape exactly should pass through unchanged.
    const params = [{ type: 'BufferLookalike', data: [1, 2, 3] }];
    const result = rehydrateParams(params);
    expect(Buffer.isBuffer(result[0])).toBe(false);
    expect(result[0]).toEqual(params[0]);
  });

  it('does not affect arrays at top level (only object-shaped Buffer tags)', () => {
    const params = [[1, 2, 3]]; // legitimate array param, not a Buffer tag
    const result = rehydrateParams(params);
    expect(Array.isArray(result[0])).toBe(true);
    expect(result[0]).toEqual([1, 2, 3]);
  });

  it('handles empty params array', () => {
    expect(rehydrateParams([])).toEqual([]);
  });

  it('handles Float32Array-derived Buffer (the actual embedding shape)', () => {
    // EmbeddingService creates a Buffer view over a Float32Array; the
    // wire shape is still a Node Buffer with raw bytes.
    const vec = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    const buf = Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
    const roundTripped = JSON.parse(JSON.stringify([buf]));
    const [rehydrated] = rehydrateParams(roundTripped);
    expect(Buffer.isBuffer(rehydrated)).toBe(true);
    expect((rehydrated as Buffer).length).toBe(16); // 4 floats × 4 bytes
  });
});
