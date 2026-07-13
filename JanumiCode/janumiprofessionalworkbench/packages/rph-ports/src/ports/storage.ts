// StorageAdapter port — the dialect-neutral persistence seam. The engine's application core talks to THIS
// interface, never to a concrete database. The better-sqlite3 implementation lives in rph-persistence; a
// Postgres/RLS implementation slots in behind the same interface later (platform MP). All the load-bearing
// persistence invariants (atomic events+outbox commit, optimistic concurrency, idempotency, append-only
// events) are expressed here so both adapters must honour them.
import type { DomainEvent } from '@janumipwb/rph-contracts';

export interface StoredObject {
	readonly objectType: string;
	readonly revision: number;
	readonly semanticVersion: number;
	/** The current authoritative object state (a plain JSON value). */
	readonly state: unknown;
}

export interface CommandReceiptRecord {
	readonly commandId: string;
	readonly idempotencyKey: string;
	readonly commandType: string;
	readonly targetAggregateId: string;
	readonly status: string;
	readonly producedEventIds: readonly string[];
	readonly resultHash?: string;
}

export interface OutboxRecord {
	readonly outboxId: string;
	readonly event: DomainEvent;
}

export interface CommitInput {
	readonly aggregateType: string;
	readonly aggregateId: string;
	readonly objectType: string;
	/** Expected current revision for optimistic concurrency; `undefined` = the aggregate must NOT yet exist. */
	readonly expectedRevision: number | undefined;
	readonly newRevision: number;
	readonly newSemanticVersion: number;
	readonly currentState: unknown;
	/** Events to append (contiguous aggregateRevision) AND enqueue in the outbox — atomically with the state write. */
	readonly events: readonly DomainEvent[];
	readonly receipt: CommandReceiptRecord;
}

export type CommitResult =
	| { readonly ok: true }
	| {
			readonly ok: false;
			readonly reason: 'REVISION_CONFLICT';
			readonly actualRevision: number | undefined;
	  };

export interface StorageAdapter {
	/** Idempotency lookup: the prior receipt for this idempotency key, if any. */
	getReceipt(idempotencyKey: string): CommandReceiptRecord | undefined;
	/** Current authoritative state of an object, if it exists. */
	loadObject(id: string): StoredObject | undefined;
	/**
	 * Atomically, in a single transaction: verify the optimistic-concurrency precondition, upsert the current
	 * state + version history, append the domain events, enqueue the outbox rows, and write the command
	 * receipt. Returns a REVISION_CONFLICT result (not a throw) when expectedRevision does not match.
	 */
	commit(input: CommitInput): CommitResult;
	/**
	 * Run `fn` inside a single storage transaction: commit on normal return, roll back on throw. Nestable — an
	 * inner `commit`'s own transaction becomes a savepoint — so a caller can wrap several command dispatches and
	 * have the WHOLE batch be atomic (all-or-nothing). Used by Engine.dispatchBatch.
	 */
	transaction<T>(fn: () => T): T;
	/** Events for one aggregate in aggregateRevision order (for replay). */
	readAggregateEvents(aggregateType: string, aggregateId: string): DomainEvent[];
	/** All events in global_sequence order (for projection rebuild). */
	readAllEvents(): DomainEvent[];
	/** Pending outbox records in global order. */
	readPendingOutbox(): OutboxRecord[];
	markOutboxPublished(outboxIds: readonly string[]): void;
	close(): void;
}
