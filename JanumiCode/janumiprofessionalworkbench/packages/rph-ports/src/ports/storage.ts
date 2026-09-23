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
	/**
	 * `contentHash(command.payload)` — the hash of the payload that CLAIMED this key (schema v2, REG-F-012).
	 *
	 * DOC-003 PER-5's third clause is "reuse of a key with a different PAYLOAD fails", and this is the only field
	 * that can decide it. `resultHash` cannot: it is `contentHash(nextState)` — the RESULTING OBJECT — so deriving
	 * the answer from it would mean executing the command first, which is exactly what idempotency exists to avoid.
	 *
	 * ABSENT MEANS NOT RECORDED, NEVER "DIFFERENT". Rows written before schema v2 carry NULL here; a comparison
	 * against an absent hash is SKIPPED, not failed. Manufacturing a refusal out of an absence is the mistake this
	 * register has recorded more than once.
	 */
	readonly payloadHash?: string;
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

/**
 * The store's write lock could not be acquired within its busy timeout. NOTHING WAS READ OR WRITTEN: the operation
 * never started. Distinct from a revision conflict (the store was reachable and something changed) and from any
 * other fault, so a caller can say "try again" without guessing (`JAN-CRITREAD` `DD-1`, `REG-D-070`).
 */
export class StoreBusyError extends Error {
	readonly code = 'RPH_STORE_BUSY';
	constructor(message = 'The store is busy: another writer holds its write lock.') {
		super(message);
		this.name = 'StoreBusyError';
	}
}

/**
 * ⭑ THE CONTRACT EVERY ADAPTER MUST MEET (`DESIGN-what-a-draft-depends-on.md` §5.3). A write transaction is
 * SERIALIZABLE against every other writer — the lock is taken before its first read — and the store issues a
 * COMMIT-ORDERED position (`highWaterMark`), so that "the events committed after position P" is a question with one
 * answer. ⚠ `SERIALIZABLE` alone does not supply the second: under an MVCC store a sequence taken before commit can
 * be seen out of order, so an adapter must issue the position at commit, under the lock.
 */
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
	 *
	 * The OUTERMOST call takes the write lock BEFORE `fn` runs, so nothing `fn` reads can be invalidated by another
	 * writer's commit. If the lock is not acquired within the store's busy timeout it throws `StoreBusyError` and
	 * `fn` is never entered.
	 */
	transaction<T>(fn: () => T): T;
	/**
	 * Run `fn` against ONE consistent snapshot of the store without taking the write lock: every read inside sees
	 * the same committed state, whatever other writers commit meanwhile. Used to capture a fork.
	 */
	readTransaction<T>(fn: () => T): T;
	/** The store's commit-ordered position: the position of the last committed event, 0 when the store is empty. */
	highWaterMark(): number;
	/** The events committed after `mark`, in commit order. */
	eventsAfter(mark: number): DomainEvent[];
	/** Events for one aggregate in aggregateRevision order (for replay). */
	readAggregateEvents(aggregateType: string, aggregateId: string): DomainEvent[];
	/** All events in global_sequence order (for projection rebuild). */
	readAllEvents(): DomainEvent[];
	/** Pending outbox records in global order. */
	readPendingOutbox(): OutboxRecord[];
	markOutboxPublished(outboxIds: readonly string[]): void;
	/**
	 * ⭐ DOES WHAT THIS STORE HOLDS OUTLIVE THE PROCESS? (`JAN-CRITREAD` J1-1b; `REG-D-071` Q5 (b), `REG-D-072` D5.)
	 *
	 * DERIVED from the connection the adapter actually opened — never declared by the class, which is the defect a
	 * class-level `DURABLE` would have: a store constructed with no filename is in memory whatever its class says.
	 * `UNKNOWN` is lawful, and every reader treats it as DURABLE: the one reader today is the `Engine`'s refusal to
	 * admit test-stipulated answers over a durable store, and that refusal must fail closed.
	 */
	readonly durability: StoreDurability;
	close(): void;
}

/** See `StorageAdapter.durability`. Only `NOT_DURABLE` is a positive statement that nothing outlives the process. */
export type StoreDurability = 'DURABLE' | 'NOT_DURABLE' | 'UNKNOWN';
