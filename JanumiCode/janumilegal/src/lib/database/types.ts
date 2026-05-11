/**
 * Shared types for the database layer.
 */

export interface Scope {
  readonly firmId: string;
  readonly clientId: string;
  readonly matterId: string;
}

/** Used for queries that target firm-level or client-level resources. */
export interface PartialScope {
  readonly firmId: string;
  readonly clientId?: string;
  readonly matterId?: string;
}

export interface RpcRequest {
  readonly id: string;
  readonly method: 'exec' | 'all' | 'get' | 'run' | 'open' | 'close';
  readonly sql?: string;
  readonly params?: unknown[];
  readonly dbPath?: string;
}

export interface RpcResponse {
  readonly id: string;
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: string;
}
