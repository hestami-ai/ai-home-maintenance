import type { DomainEvent } from '@janumipwb/rph-contracts';
import type {
	CommandReceiptRecord,
	CommitInput,
	CommitResult,
	OutboxRecord,
	StorageAdapter,
	StoredObject
} from '@janumipwb/rph-ports';
import { planMigration, SCHEMA_SQL, SCHEMA_VERSION } from './schema.js';
import { createSqliteDriver, type SqlDriver } from './sql-driver.js';

interface ReceiptRow {
	command_id: string;
	idempotency_key: string;
	command_type: string;
	target_aggregate_id: string;
	status: string;
	produced_event_ids: string;
	result_hash: string | null;
	/** v2. NULL on rows written before the migration — "not recorded", never "different" (REG-F-012). */
	payload_hash: string | null;
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
		// ORDER MATTERS, and it is the one thing a migration ladder can get subtly wrong. `SCHEMA_SQL` is all
		// `CREATE … IF NOT EXISTS`, so running it ERASES the difference between a brand-new file and a store that
		// predates versioning — both then have every table, and both report `user_version = 0`. The distinction is
		// captured HERE, before that happens, and it decides whether the ladder runs at all.
		const preExisting = this.hasExistingSchema();
		this.db.exec(SCHEMA_SQL);
		this.enforceSchemaVersion(preExisting);
	}

	/** Did this database already carry the RPH schema before `SCHEMA_SQL` ran? (See the constructor.) */
	private hasExistingSchema(): boolean {
		const row = this.db
			.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='command_receipts'")
			.get() as { name?: string } | undefined;
		return row?.name === 'command_receipts';
	}

	/**
	 * W2-INC-1 (WP-2-001) migration baseline, given the forward ladder in `schema.ts` (REG-F-012, v2). Read the
	 * DB's `PRAGMA user_version`:
	 *   - equal to `SCHEMA_VERSION` → open normally;
	 *   - GREATER than `SCHEMA_VERSION` → fail closed: an older engine SHALL NOT read/write a store written by a
	 *     newer one (silent misread of an unknown schema is exactly what the version guard exists to prevent);
	 *   - 0 with NO pre-existing schema → a fresh store that `SCHEMA_SQL` just created at the current shape:
	 *     nothing to migrate, stamp it;
	 *   - 0 WITH a pre-existing schema → a store that predates versioning, and therefore has the v1 shape:
	 *     migrate it from 1 like any other old store. Stamping it without migrating — which is what the
	 *     pre-ladder code did, correctly, while `SCHEMA_VERSION` was 1 — would now mark a v1 store as v2 and
	 *     leave the engine reading a column that is not there;
	 *   - otherwise below `SCHEMA_VERSION` → run the registered forward migrations, then stamp. A GAP in the
	 *     ladder throws (see `planMigration`) rather than skipping a step.
	 *
	 * The whole ladder + stamp runs in ONE transaction, so a store is never left half-migrated: either it comes
	 * up at `SCHEMA_VERSION` with every column, or it is untouched and the next open retries.
	 */
	private enforceSchemaVersion(preExisting: boolean): void {
		const row = this.db.prepare('PRAGMA user_version').get() as { user_version?: number } | undefined;
		const current = row?.user_version ?? 0;
		if (current === SCHEMA_VERSION) return;
		if (current > SCHEMA_VERSION) {
			throw new Error(
				`RPH persistence: database schema version ${current} is newer than this build's ${SCHEMA_VERSION}. ` +
					'Refusing to open — an engine must not read a store written by a newer schema. Align the engine ' +
					'build with the store.'
			);
		}
		// A pre-versioning store (user_version 0 with tables already present) IS a v1 store; a genuinely fresh one
		// was just created at the current shape and needs no step.
		const from = current === 0 ? (preExisting ? 1 : SCHEMA_VERSION) : current;
		const steps = planMigration(from, SCHEMA_VERSION);
		this.db.transaction(() => {
			for (const step of steps) this.db.exec(step);
			this.db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
		});
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
			...(row.result_hash ? { resultHash: row.result_hash } : {}),
			...(row.payload_hash ? { payloadHash: row.payload_hash } : {})
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
					'INSERT INTO command_receipts(idempotency_key,command_id,command_type,target_aggregate_id,status,produced_event_ids,result_hash,created_at,payload_hash) VALUES(?,?,?,?,?,?,?,?,?)'
				)
				.run(
					input.receipt.idempotencyKey,
					input.receipt.commandId,
					input.receipt.commandType,
					input.receipt.targetAggregateId,
					input.receipt.status,
					JSON.stringify(input.receipt.producedEventIds),
					input.receipt.resultHash ?? null,
					now,
					input.receipt.payloadHash ?? null
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
