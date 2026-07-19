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
export const SCHEMA_VERSION = 1;

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
	created_at TEXT NOT NULL
);
`;
