/**
 * Typed Error subclasses for RPC bridge failures, plus the parser that
 * turns the JSON payload written into the SAB by the sidecar/worker
 * back into the right Error class on the client side.
 *
 * Kept separate from `rpcClient.ts` so the parser logic is unit-testable
 * without instantiating a DatabaseRPCClient (which spawns a worker).
 */

import type { RpcResultTooLargePayload, RpcResultLimits } from '../../sidecar/dbServerLimits';

export class RpcResultTooLargeError extends Error {
  readonly code = 'RpcResultTooLarge' as const;
  readonly reason: 'rows_exceeded' | 'bytes_exceeded';
  readonly rowCount: number;
  readonly estimatedBytes: number;
  readonly limits: RpcResultLimits;
  readonly suggestedPageSize: number;
  readonly hint: string;

  constructor(payload: RpcResultTooLargePayload) {
    const summary = payload.reason === 'rows_exceeded'
      ? `rowCount=${payload.rowCount} > maxRows=${payload.limits.maxRows}`
      : `estimatedBytes=${payload.estimatedBytes} > maxBytes=${payload.limits.maxBytes}`;
    super(`RpcResultTooLarge (${payload.reason}): ${summary}. ${payload.hint}`);
    this.name = 'RpcResultTooLargeError';
    this.reason = payload.reason;
    this.rowCount = payload.rowCount;
    this.estimatedBytes = payload.estimatedBytes;
    this.limits = payload.limits;
    this.suggestedPageSize = payload.suggestedPageSize;
    this.hint = payload.hint;
  }
}

/**
 * Translate a CTRL_ERROR payload from the SAB bridge into a typed Error.
 *
 * The payload is the JSON-stringified shape the sidecar wrote to its
 * NDJSON `error` field — either a plain string for legacy paths, or a
 * structured object with a `code` discriminator. Unknown shapes fall
 * back to a plain Error so callers always see *something* actionable.
 */
export function parseRpcError(responseJson: string): Error {
  let parsed: unknown;
  try {
    parsed = JSON.parse(responseJson);
  } catch {
    // Pre-structured-error path: the worker may have written a raw
    // message string (e.g. "offset is out of bounds" from a SAB write
    // RangeError). Surface verbatim.
    return new Error(`RPC error: ${responseJson}`);
  }

  if (typeof parsed === 'string') {
    return new Error(`RPC error: ${parsed}`);
  }

  if (parsed && typeof parsed === 'object' && 'code' in parsed) {
    const obj = parsed as Record<string, unknown>;
    if (obj.code === 'RpcResultTooLarge') {
      return new RpcResultTooLargeError(obj as unknown as RpcResultTooLargePayload);
    }
  }

  // Unknown structured shape — stringify the whole thing into the
  // message so operators can read it.
  return new Error(`RPC error: ${JSON.stringify(parsed)}`);
}
