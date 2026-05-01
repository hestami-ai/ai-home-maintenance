/**
 * Sidecar `.all()` result-size ceiling enforcement.
 *
 * Extracted into a standalone module so unit tests can drive
 * `enforceRpcResultLimits()` directly without spawning a sidecar
 * child process. The sidecar at `dbServer.ts` calls this helper
 * after each `.all()` and returns the resulting structured error
 * (if any) over the existing NDJSON protocol.
 *
 * The companion client at `lib/database/rpcClient.ts` parses the
 * structured payload back into a typed `RpcResultTooLargeError`.
 */

export const DEFAULT_MAX_ROWS_PER_RPC = 10_000;
export const DEFAULT_MAX_BYTES_PER_RPC = 16 * 1024 * 1024; // 16MB
export const DEFAULT_SUGGESTED_PAGE_SIZE = 500;

export interface RpcResultLimits {
  maxRows: number;
  maxBytes: number;
}

export interface RpcResultTooLargePayload {
  code: 'RpcResultTooLarge';
  reason: 'rows_exceeded' | 'bytes_exceeded';
  rowCount: number;
  estimatedBytes: number;
  limits: RpcResultLimits;
  suggestedPageSize: number;
  hint: string;
}

const HINT =
  'Use LIMIT/OFFSET pagination via iterateGovernedStream() (see ' +
  'src/lib/database/iterateGovernedStream.ts) or set per-call ' +
  'override `{ maxRows, maxBytes }` to acknowledge the risk explicitly.';

/**
 * Returns a structured error payload when `rows` would breach either
 * the row count or estimated-bytes ceiling. Returns `null` when the
 * result fits — caller proceeds normally.
 *
 * Bytes are estimated via `JSON.stringify(rows).length`. This is the
 * exact serialization the NDJSON-over-stdio + SAB bridge will perform
 * downstream, so the estimate is tight (within UTF-8 multi-byte
 * fudge, which only inflates the real byte count).
 */
export function enforceRpcResultLimits(
  rows: unknown[],
  limits: RpcResultLimits,
): RpcResultTooLargePayload | null {
  if (rows.length > limits.maxRows) {
    return {
      code: 'RpcResultTooLarge',
      reason: 'rows_exceeded',
      rowCount: rows.length,
      estimatedBytes: -1, // not measured; row count alone tripped
      limits,
      suggestedPageSize: DEFAULT_SUGGESTED_PAGE_SIZE,
      hint: HINT,
    };
  }
  // Only stringify when row count is within the row ceiling. For huge
  // result-sets the row check fires first, so we never pay the
  // serialization cost twice.
  const estimatedBytes = JSON.stringify(rows).length;
  if (estimatedBytes > limits.maxBytes) {
    return {
      code: 'RpcResultTooLarge',
      reason: 'bytes_exceeded',
      rowCount: rows.length,
      estimatedBytes,
      limits,
      suggestedPageSize: DEFAULT_SUGGESTED_PAGE_SIZE,
      hint: HINT,
    };
  }
  return null;
}
