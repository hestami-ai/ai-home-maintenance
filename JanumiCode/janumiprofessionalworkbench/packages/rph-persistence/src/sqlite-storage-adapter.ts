import type { DomainEvent } from '@janumipwb/rph-contracts';
import type {
	CommandReceiptRecord,
	CommitInput,
	CommitResult,
	OutboxRecord,
	StorageAdapter,
	StoredObject
} from '@janumipwb/rph-ports';
import { SCHEMA_SQL } from './schema.js';
import { createSqliteDriver, type SqlDriver } from './sql-driver.js';

interface ReceiptRow {
	command_id: string;
	idempotency_key: string;
	command_type: string;
	target_aggregate_id: string;
	status: string;
	produced_event_ids: string;
	result_hash: string | null;
}
interface ObjectRow {
	object_type: string;
	revision: number;
	semantic_version: number;
	state: string;
}
interface EventPayloadRow {
	payload: string;
}
interface OutboxRow {
	outbox_id: string;
	payload: string;
}

/**
 * The better-sqlite3-shaped StorageAdapter, backed by a SqlDriver (bun:sqlite in dev/test). Every write goes
 * through `commit`, which runs the whole thing in one transaction — the single-authority guarantee is that
 * the application command bus is the only caller. Timestamps come through the injected `now` port so the
 * store stays deterministic under test.
 */
export class SqliteStorageAdapter implements StorageAdapter {
	private readonly db: SqlDriver;
	private readonly now: () => string;

	constructor(opts: { driver?: SqlDriver; filename?: string; now?: () => string } = {}) {
		this.db = opts.driver ?? createSqliteDriver(opts.filename);
		this.now = opts.now ?? (() => new Date().toISOString());
		this.db.exec(SCHEMA_SQL);
	}

	/** Run `fn` in one transaction (nestable via savepoints), so a batch of commits is all-or-nothing. */
	transaction<T>(fn: () => T): T {
		return this.db.transaction(fn);
	}

	getReceipt(idempotencyKey: string): CommandReceiptRecord | undefined {
		const row = this.db
			.prepare('SELECT * FROM command_receipts WHERE idempotency_key = ?')
			.get(idempotencyKey) as ReceiptRow | undefined;
		if (!row) return undefined;
		return {
			commandId: row.command_id,
			idempotencyKey: row.idempotency_key,
			commandType: row.command_type,
			targetAggregateId: row.target_aggregate_id,
			status: row.status,
			producedEventIds: JSON.parse(row.produced_event_ids) as string[],
			...(row.result_hash ? { resultHash: row.result_hash } : {})
		};
	}

	loadObject(id: string): StoredObject | undefined {
		const row = this.db
			.prepare(
				'SELECT object_type, revision, semantic_version, state FROM professional_work_objects WHERE id = ?'
			)
			.get(id) as ObjectRow | undefined;
		if (!row) return undefined;
		return {
			objectType: row.object_type,
			revision: row.revision,
			semanticVersion: row.semantic_version,
			state: JSON.parse(row.state)
		};
	}

	commit(input: CommitInput): CommitResult {
		return this.db.transaction<CommitResult>(() => {
			const existing = this.db
				.prepare('SELECT revision FROM professional_work_objects WHERE id = ?')
				.get(input.aggregateId) as { revision: number } | undefined;
			const actualRevision = existing?.revision;

			// Optimistic concurrency: undefined expectedRevision means "must not yet exist".
			if (input.expectedRevision === undefined) {
				if (existing) return { ok: false, reason: 'REVISION_CONFLICT', actualRevision };
			} else if (actualRevision !== input.expectedRevision) {
				return { ok: false, reason: 'REVISION_CONFLICT', actualRevision };
			}

			const now = this.now();
			const stateJson = JSON.stringify(input.currentState);

			if (existing) {
				this.db
					.prepare(
						'UPDATE professional_work_objects SET revision=?, semantic_version=?, state=?, updated_at=?, object_type=?, aggregate_type=? WHERE id=? AND revision=?'
					)
					.run(
						input.newRevision,
						input.newSemanticVersion,
						stateJson,
						now,
						input.objectType,
						input.aggregateType,
						input.aggregateId,
						input.expectedRevision
					);
			} else {
				this.db
					.prepare(
						'INSERT INTO professional_work_objects(id, object_type, aggregate_type, revision, semantic_version, state, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?)'
					)
					.run(
						input.aggregateId,
						input.objectType,
						input.aggregateType,
						input.newRevision,
						input.newSemanticVersion,
						stateJson,
						now,
						now
					);
			}

			this.db
				.prepare(
					'INSERT INTO professional_work_object_versions(id, revision, semantic_version, state, recorded_at) VALUES(?,?,?,?,?)'
				)
				.run(input.aggregateId, input.newRevision, input.newSemanticVersion, stateJson, now);

			const insEvent = this.db.prepare(
				'INSERT INTO domain_events(event_id,event_type,aggregate_type,aggregate_id,aggregate_revision,correlation_id,causation_id,command_id,occurred_at,recorded_at,payload) VALUES(?,?,?,?,?,?,?,?,?,?,?)'
			);
			const insOutbox = this.db.prepare(
				'INSERT INTO outbox_messages(outbox_id,event_id,global_sequence,status,payload,created_at) VALUES(?,?,?,?,?,?)'
			);
			for (const e of input.events) {
				const info = insEvent.run(
					e.eventId,
					e.eventType,
					e.aggregateType,
					e.aggregateId,
					e.aggregateRevision,
					e.correlationId,
					e.causationId ?? null,
					e.commandId ?? null,
					e.occurredAt,
					e.recordedAt,
					JSON.stringify(e)
				);
				insOutbox.run(
					`obx_${e.eventId}`,
					e.eventId,
					Number(info.lastInsertRowid),
					'PENDING',
					JSON.stringify(e),
					now
				);
			}

			this.db
				.prepare(
					'INSERT INTO command_receipts(idempotency_key,command_id,command_type,target_aggregate_id,status,produced_event_ids,result_hash,created_at) VALUES(?,?,?,?,?,?,?,?)'
				)
				.run(
					input.receipt.idempotencyKey,
					input.receipt.commandId,
					input.receipt.commandType,
					input.receipt.targetAggregateId,
					input.receipt.status,
					JSON.stringify(input.receipt.producedEventIds),
					input.receipt.resultHash ?? null,
					now
				);

			return { ok: true };
		});
	}

	readAggregateEvents(aggregateType: string, aggregateId: string): DomainEvent[] {
		const rows = this.db
			.prepare(
				'SELECT payload FROM domain_events WHERE aggregate_type=? AND aggregate_id=? ORDER BY aggregate_revision ASC'
			)
			.all(aggregateType, aggregateId) as EventPayloadRow[];
		return rows.map((r) => JSON.parse(r.payload) as DomainEvent);
	}

	readAllEvents(): DomainEvent[] {
		const rows = this.db
			.prepare('SELECT payload FROM domain_events ORDER BY global_sequence ASC')
			.all() as EventPayloadRow[];
		return rows.map((r) => JSON.parse(r.payload) as DomainEvent);
	}

	readPendingOutbox(): OutboxRecord[] {
		const rows = this.db
			.prepare(
				"SELECT outbox_id, payload FROM outbox_messages WHERE status='PENDING' ORDER BY global_sequence ASC"
			)
			.all() as OutboxRow[];
		return rows.map((r) => ({
			outboxId: r.outbox_id,
			event: JSON.parse(r.payload) as DomainEvent
		}));
	}

	markOutboxPublished(outboxIds: readonly string[]): void {
		if (outboxIds.length === 0) return;
		const now = this.now();
		const stmt = this.db.prepare(
			"UPDATE outbox_messages SET status='PUBLISHED', published_at=? WHERE outbox_id=?"
		);
		this.db.transaction(() => {
			for (const id of outboxIds) stmt.run(now, id);
		});
	}

	close(): void {
		this.db.close();
	}
}
