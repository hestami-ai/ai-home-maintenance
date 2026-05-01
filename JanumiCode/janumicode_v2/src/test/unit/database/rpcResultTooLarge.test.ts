/**
 * Regression tests for the sidecar `.all()` result-size ceiling
 * (Fix 1 — `MAX_ROWS_PER_RPC` / `MAX_BYTES_PER_RPC`).
 *
 * The full RPC bridge (Worker + sidecar child process + SAB) is
 * exercised end-to-end by the harness suite in cal-runs. These unit
 * tests pin the two load-bearing pieces in isolation:
 *
 *   1. `enforceRpcResultLimits()` — the server-side guard that
 *      converts an over-budget result-set into a structured payload
 *      BEFORE it can reach the SAB write site (which would otherwise
 *      raise the cryptic "offset is out of bounds" RangeError).
 *
 *   2. `parseRpcError()` — the client-side parser that re-hydrates
 *      the structured payload into a typed `RpcResultTooLargeError`
 *      so callers can inspect `reason`, `rowCount`, `limits`, etc.
 *      without string-matching.
 *
 * Together they form the contract the worker/SAB transport relays
 * verbatim — verifying the ends keeps the middle honest.
 */

import { describe, it, expect } from 'vitest';
import {
  enforceRpcResultLimits,
  DEFAULT_SUGGESTED_PAGE_SIZE,
} from '../../../sidecar/dbServerLimits';
import { parseRpcError, RpcResultTooLargeError } from '../../../lib/database/rpcErrors';

describe('enforceRpcResultLimits — server-side ceiling', () => {
  it('returns null when row + byte counts both fit', () => {
    const rows = [{ a: 1 }, { a: 2 }, { a: 3 }];
    expect(
      enforceRpcResultLimits(rows, { maxRows: 100, maxBytes: 1024 }),
    ).toBeNull();
  });

  it('flags rows_exceeded with a structured payload', () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ i }));
    const err = enforceRpcResultLimits(rows, { maxRows: 10, maxBytes: 1024 });

    expect(err).not.toBeNull();
    expect(err).toMatchObject({
      code: 'RpcResultTooLarge',
      reason: 'rows_exceeded',
      rowCount: 50,
      limits: { maxRows: 10, maxBytes: 1024 },
      suggestedPageSize: DEFAULT_SUGGESTED_PAGE_SIZE,
    });
    expect(err?.hint).toMatch(/iterateGovernedStream|maxRows/);
  });

  it('flags bytes_exceeded with the measured size', () => {
    // ~30 rows of ~50 bytes ≈ 1500B serialized. Set bytes ceiling below
    // that so the row check passes but the byte check trips.
    const rows = Array.from({ length: 30 }, (_, i) => ({
      id: `row-${i}`,
      payload: 'xxxxxxxxxxxxxxxxxxxx',
    }));
    const err = enforceRpcResultLimits(rows, { maxRows: 1000, maxBytes: 100 });

    expect(err).not.toBeNull();
    expect(err?.code).toBe('RpcResultTooLarge');
    expect(err?.reason).toBe('bytes_exceeded');
    expect(err?.rowCount).toBe(30);
    expect(err?.estimatedBytes).toBeGreaterThan(100);
    expect(err?.limits).toEqual({ maxRows: 1000, maxBytes: 100 });
  });

  it('checks rows BEFORE bytes (cheaper guard fires first)', () => {
    // Both ceilings are tripped — row check should win since it's
    // measured without a stringify cost.
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      blob: 'x'.repeat(100),
    }));
    const err = enforceRpcResultLimits(rows, { maxRows: 10, maxBytes: 100 });
    expect(err?.reason).toBe('rows_exceeded');
    expect(err?.estimatedBytes).toBe(-1); // sentinel — bytes never measured
  });
});

describe('parseRpcError — client-side error rehydration', () => {
  it('rehydrates RpcResultTooLarge payload into typed RpcResultTooLargeError', () => {
    const payload = {
      code: 'RpcResultTooLarge',
      reason: 'rows_exceeded',
      rowCount: 50_000,
      estimatedBytes: -1,
      limits: { maxRows: 10_000, maxBytes: 16 * 1024 * 1024 },
      suggestedPageSize: 500,
      hint: 'Use LIMIT/OFFSET pagination via iterateGovernedStream() ...',
    };

    const err = parseRpcError(JSON.stringify(payload));

    expect(err).toBeInstanceOf(RpcResultTooLargeError);
    const tooLarge = err as RpcResultTooLargeError;
    expect(tooLarge.reason).toBe('rows_exceeded');
    expect(tooLarge.rowCount).toBe(50_000);
    expect(tooLarge.limits.maxRows).toBe(10_000);
    expect(tooLarge.suggestedPageSize).toBe(500);
    // The hint must appear in the message text so operators see it
    // even when they only `console.error(err.message)`.
    expect(tooLarge.message).toContain(tooLarge.hint);
  });

  it('falls back to plain Error for legacy string error payloads', () => {
    const err = parseRpcError(JSON.stringify('offset is out of bounds'));
    expect(err).not.toBeInstanceOf(RpcResultTooLargeError);
    expect(err.message).toMatch(/offset is out of bounds/);
  });

  it('falls back to plain Error for un-parseable payloads', () => {
    const err = parseRpcError('not-valid-json{');
    expect(err.message).toMatch(/not-valid-json/);
  });

  it('falls back to plain Error for unknown structured shapes', () => {
    const err = parseRpcError(JSON.stringify({ code: 'SomeOther', detail: 'x' }));
    expect(err).not.toBeInstanceOf(RpcResultTooLargeError);
    expect(err.message).toMatch(/SomeOther/);
  });
});
