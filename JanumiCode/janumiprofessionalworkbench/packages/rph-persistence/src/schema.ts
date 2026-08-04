// The SQLite schema — DOC-009's event-sourced-with-current-state hybrid, re-realized on embedded SQLite.
// Postgres-specific constructs are re-expressed: jsonb -> TEXT (validated at the write boundary in the
// application layer), bigserial global_sequence -> INTEGER PRIMARY KEY AUTOINCREMENT, timestamptz -> ISO-8601
// UTC TEXT. Single-writer SQLite makes the whole command pipeline atomic in one transaction, so events +
// outbox commit together with no broker. DB-role/trigger-based dual-authority prevention (Postgres) becomes
// an application-level guarantee (command-bus is the only writer). See docs §5 + the architecture synthesis.

// W2-INC-1 (WP-2-001): the schema version stamped into the DB's `PRAGMA user_version`. This is the migration
// baseline: a fresh (or pre-versioning, user_version=0) DB is stamped at open; an engine that opens a store
// whose version is NEWER than it supports fails closed rather than silently reading a schema it does not
// understand. Bump this (and register a forward migration) whenever SCHEMA_SQL changes shape.
//
// v2 (REG-F-012, 2026-08-04) — `command_receipts.payload_hash`. THE FIRST REAL MIGRATION: v1 was the baseline
// stamp, and until now "register a forward migration" had never been exercised, so the arm that runs one did
// not exist. It does now, and the ladder below is what makes bumping this constant safe for a DURABLE store
// (`apps/rph-demo` opens one by filename) rather than a change that makes the engine refuse to open it.
export const SCHEMA_VERSION = 2;

/**
 * Forward migrations, keyed by the version they migrate FROM. `MIGRATIONS[n]` takes a store at version `n` to
 * version `n + 1`; the ladder runs them in order and stamps `user_version` once at the end.
 *
 * TWO RULES, both load-bearing:
 *
 *  1. **A migration runs AFTER `SCHEMA_SQL`.** Every statement there is `CREATE … IF NOT EXISTS`, so on an
 *     existing store it is a no-op for tables that already exist and it CREATES tables added in a later version.
 *     A migration therefore only ever needs to ALTER an EXISTING table — never to create one, and never to guard
 *     against having already run, because the version gate decides that.
 *  2. **A migration is forward-only and additive.** SQLite's `ALTER TABLE … ADD COLUMN` is O(1) and cannot fail
 *     on existing rows (the new column is NULL for all of them), which is why `payload_hash` is nullable and why
 *     the reader treats NULL as "not recorded" rather than as a value.
 */
export const MIGRATIONS: Readonly<Record<number, string>> = {
	// v1 → v2: bind an idempotency key to the payload that claimed it (DOC-003 PER-5 clause 3). Existing receipts
	// get NULL, which the bus reads as "this row predates the binding" and skips — it does NOT read it as "the
	// payload differed", which would turn every pre-upgrade replay into a refusal.
	1: 'ALTER TABLE command_receipts ADD COLUMN payload_hash TEXT;'
};

/**
 * The ordered SQL to take a store from `from` to `to`. PURE — no database, no I/O — so the ladder's decision is
 * testable on its own, including the arm that refuses. That arm is otherwise unreachable today (every version
 * below `SCHEMA_VERSION` has a registered migration), and an unreachable guard is one nothing proves.
 *
 * Throws when a step is missing rather than skipping it: a gap in the ladder means the engine does not know how
 * to read the store in front of it, and proceeding would be a silent misread of an unknown schema — the exact
 * thing `user_version` exists to prevent.
 */
export function planMigration(
	from: number,
	to: number,
	migrations: Readonly<Record<number, string>> = MIGRATIONS
): string[] {
	const steps: string[] = [];
	for (let v = from; v < to; v += 1) {
		const step = migrations[v];
		if (step === undefined) {
			throw new Error(
				`RPH persistence: no forward migration registered from schema version ${v} to ${v + 1} ` +
					`(migrating ${from} → ${to}). Refusing to open — an engine must not read a store whose shape ` +
					`it cannot account for.`
			);
		}
		steps.push(step);
	}
	return steps;
}

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS professional_work_objects (
	id TEXT PRIMARY KEY,
	object_type TEXT NOT NULL,
	aggregate_type TEXT NOT NULL,
	revision INTEGER NOT NULL,
	semantic_version INTEGER NOT NULL,
	state TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS professional_work_object_versions (
	id TEXT NOT NULL,
	revision INTEGER NOT NULL,
	semantic_version INTEGER NOT NULL,
	state TEXT NOT NULL,
	recorded_at TEXT NOT NULL,
	PRIMARY KEY (id, revision)
);

CREATE TABLE IF NOT EXISTS domain_events (
	global_sequence INTEGER PRIMARY KEY AUTOINCREMENT,
	event_id TEXT NOT NULL UNIQUE,
	event_type TEXT NOT NULL,
	aggregate_type TEXT NOT NULL,
	aggregate_id TEXT NOT NULL,
	aggregate_revision INTEGER NOT NULL,
	correlation_id TEXT NOT NULL,
	causation_id TEXT,
	command_id TEXT,
	occurred_at TEXT NOT NULL,
	recorded_at TEXT NOT NULL,
	payload TEXT NOT NULL,
	UNIQUE (aggregate_type, aggregate_id, aggregate_revision)
);
CREATE INDEX IF NOT EXISTS idx_events_aggregate
	ON domain_events (aggregate_type, aggregate_id, aggregate_revision);

CREATE TABLE IF NOT EXISTS outbox_messages (
	outbox_id TEXT PRIMARY KEY,
	event_id TEXT NOT NULL,
	global_sequence INTEGER NOT NULL,
	status TEXT NOT NULL DEFAULT 'PENDING',
	payload TEXT NOT NULL,
	created_at TEXT NOT NULL,
	published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_messages (status, global_sequence);

CREATE TABLE IF NOT EXISTS command_receipts (
	idempotency_key TEXT PRIMARY KEY,
	command_id TEXT NOT NULL,
	command_type TEXT NOT NULL,
	target_aggregate_id TEXT NOT NULL,
	status TEXT NOT NULL,
	produced_event_ids TEXT NOT NULL,
	result_hash TEXT,
	created_at TEXT NOT NULL,
	-- v2: contentHash(command.payload) — the payload that CLAIMED this key. NULL on rows written before v2, and
	-- the reader treats that NULL as "not recorded", never as "different". See MIGRATIONS above.
	payload_hash TEXT
);
`;
