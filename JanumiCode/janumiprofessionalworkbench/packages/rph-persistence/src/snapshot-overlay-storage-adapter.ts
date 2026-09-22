import type { DomainEvent } from '@janumipwb/rph-contracts';
import type {
	CommandReceiptRecord,
	CommitInput,
	CommitResult,
	OutboxRecord,
	StorageAdapter,
	StoredObject
} from '@janumipwb/rph-ports';

/**
 * An isolated, point-in-time fork of a StorageAdapter.
 *
 * The canonical adapter is consulted only during construction to capture the base snapshot. Subsequent commits,
 * receipts, Events and outbox effects live only in this overlay, so an authoring agent can exercise the real
 * Command handlers against an exact candidate without changing canonical state. `transaction` snapshots the
 * overlay and therefore keeps the same all-or-nothing semantics as the canonical adapter.
 *
 * This is deliberately a persistence mechanism rather than an undo mechanism: discarding the overlay abandons an
 * uncommitted candidate. It never deletes or rewrites canonical Events.
 */
export class SnapshotOverlayStorageAdapter implements StorageAdapter {
	private readonly baseObjects = new Map<string, StoredObject>();
	private readonly baseEvents: DomainEvent[];
	/** The source's commit-ordered position at capture: the canonical point this fork reflects. */
	private readonly baseMark: number;
	private readonly stagedObjects = new Map<string, StoredObject>();
	private readonly receipts = new Map<string, CommandReceiptRecord>();
	private stagedEvents: DomainEvent[] = [];
	private outbox: OutboxRecord[] = [];
	private closed = false;

	constructor(private readonly source: StorageAdapter) {
		// ⭑ ONE READ TRANSACTION (`DD-1`). The events, the objects and the position used to be separate autocommit
		// reads, so a commit landing between them left this "point-in-time" fork holding an object NEWER than its
		// events. Inside one snapshot they are one point in time, whatever other writers do.
		const captured = source.readTransaction(() => {
			const events = clone(source.readAllEvents());
			const objects = new Map<string, StoredObject>();
			for (const id of new Set(events.map((event) => event.aggregateId))) {
				const object = source.loadObject(id);
				if (object) objects.set(id, clone(object));
			}
			return { events, objects, mark: source.highWaterMark() };
		});
		this.baseEvents = captured.events;
		for (const [id, object] of captured.objects) this.baseObjects.set(id, object);
		this.baseMark = captured.mark;
	}

	getReceipt(idempotencyKey: string): CommandReceiptRecord | undefined {
		this.assertOpen();
		const local = this.receipts.get(idempotencyKey);
		// Never fall through to the live source: a receipt written canonically after construction would leak into
		// this point-in-time candidate. The current port cannot enumerate receipts for a true base snapshot, so forked
		// authoring uses a fresh turn-scoped idempotency namespace and only its overlay receipts are consulted.
		return local ? clone(local) : undefined;
	}

	loadObject(id: string): StoredObject | undefined {
		this.assertOpen();
		const object = this.stagedObjects.get(id) ?? this.baseObjects.get(id);
		return object ? clone(object) : undefined;
	}

	commit(input: CommitInput): CommitResult {
		this.assertOpen();
		const existing =
			this.stagedObjects.get(input.aggregateId) ?? this.baseObjects.get(input.aggregateId);
		const actualRevision = existing?.revision;
		if (input.expectedRevision === undefined) {
			if (existing) return { ok: false, reason: 'REVISION_CONFLICT', actualRevision };
		} else if (actualRevision !== input.expectedRevision) {
			return { ok: false, reason: 'REVISION_CONFLICT', actualRevision };
		}

		this.stagedObjects.set(input.aggregateId, {
			objectType: input.objectType,
			revision: input.newRevision,
			semanticVersion: input.newSemanticVersion,
			state: clone(input.currentState)
		});
		const events = clone([...input.events]);
		this.stagedEvents.push(...events);
		this.outbox.push(
			...events.map((event) => ({ outboxId: `obx_${event.eventId}`, event: clone(event) }))
		);
		this.receipts.set(input.receipt.idempotencyKey, clone(input.receipt));
		return { ok: true };
	}

	transaction<T>(fn: () => T): T {
		this.assertOpen();
		const checkpoint = {
			objects: cloneMap(this.stagedObjects),
			receipts: cloneMap(this.receipts),
			events: clone(this.stagedEvents),
			outbox: clone(this.outbox)
		};
		try {
			return fn();
		} catch (error) {
			replaceMap(this.stagedObjects, checkpoint.objects);
			replaceMap(this.receipts, checkpoint.receipts);
			this.stagedEvents = checkpoint.events;
			this.outbox = checkpoint.outbox;
			throw error;
		}
	}

	/** A fork is one snapshot already; a read transaction over it needs nothing more. */
	readTransaction<T>(fn: () => T): T {
		this.assertOpen();
		return fn();
	}

	/** The canonical position this fork was taken at. Its own staged events have no canonical position. */
	highWaterMark(): number {
		this.assertOpen();
		return this.baseMark;
	}

	/**
	 * The events after `mark` as this fork knows them: its own staged events, when asked from its base position or
	 * later. ⛔ It cannot answer for a position BEFORE its base — it never saw canonical's positions — so it refuses
	 * rather than guess.
	 */
	eventsAfter(mark: number): DomainEvent[] {
		this.assertOpen();
		if (mark < this.baseMark)
			throw new Error(
				`A fork cannot answer for events before its base position (${String(mark)} < ${String(this.baseMark)}).`
			);
		return clone(this.stagedEvents);
	}

	readAggregateEvents(aggregateType: string, aggregateId: string): DomainEvent[] {
		return this.readAllEvents().filter(
			(event) => event.aggregateType === aggregateType && event.aggregateId === aggregateId
		);
	}

	readAllEvents(): DomainEvent[] {
		this.assertOpen();
		return clone([...this.baseEvents, ...this.stagedEvents]);
	}

	readPendingOutbox(): OutboxRecord[] {
		this.assertOpen();
		return clone(this.outbox);
	}

	markOutboxPublished(outboxIds: readonly string[]): void {
		this.assertOpen();
		const published = new Set(outboxIds);
		this.outbox = this.outbox.filter((record) => !published.has(record.outboxId));
	}

	close(): void {
		this.closed = true;
		this.stagedObjects.clear();
		this.receipts.clear();
		this.stagedEvents = [];
		this.outbox = [];
	}

	private assertOpen(): void {
		if (this.closed) throw new Error('SnapshotOverlayStorageAdapter is closed.');
	}
}

function clone<T>(value: T): T {
	return structuredClone(value);
}

function cloneMap<K, V>(source: Map<K, V>): Map<K, V> {
	return new Map([...source].map(([key, value]) => [key, clone(value)]));
}

function replaceMap<K, V>(target: Map<K, V>, source: Map<K, V>): void {
	target.clear();
	for (const [key, value] of source) target.set(key, value);
}
