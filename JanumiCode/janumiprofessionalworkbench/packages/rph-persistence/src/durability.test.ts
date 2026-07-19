// W2-INC-1 (WP-2-001 / WP-2-002): durability + the schema-version migration baseline.
//
// The persistence adapter already commits atomically with optimistic concurrency, but two things were never
// proven at the store boundary: (a) that a FILE-BACKED store round-trips — persist, close, reopen, and read
// back byte-identical canonical state (the master W2 exit criterion "the reference fixture persists and replays
// to the same canonical state"); and (b) that a store carries a schema version so an engine fails closed rather
// than silently reading a store written by a newer schema. These tests close both.
import type { CommitInput } from '@janumipwb/rph-ports';
import type { DomainEvent } from '@janumipwb/rph-contracts';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SqliteStorageAdapter } from './sqlite-storage-adapter.js';
import { SCHEMA_VERSION } from './schema.js';
import { createSqliteDriver } from './sql-driver.js';

const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };
const TS = '2026-07-19T00:00:00Z';
let fileSeq = 0;

function tempDbPath(): string {
	return join(tmpdir(), `rph-w2-durability-${process.pid}-${++fileSeq}.db`);
}

function cleanup(path: string): void {
	for (const suffix of ['', '-wal', '-shm']) {
		const p = `${path}${suffix}`;
		if (existsSync(p)) rmSync(p);
	}
}

function commitInput(id: string, objectType: string, state: Record<string, unknown>): CommitInput {
	const event: DomainEvent = {
		eventId: `evt_${id}`,
		eventType: 'IntentCaptured',
		eventSchemaVersion: 1,
		aggregateType: objectType,
		aggregateId: id,
		aggregateRevision: 0,
		occurredAt: TS,
		recordedAt: TS,
		actor,
		correlationId: 'corr-1',
		payload: { note: id }
	};
	return {
		aggregateType: objectType,
		aggregateId: id,
		objectType,
		expectedRevision: undefined,
		newRevision: 0,
		newSemanticVersion: 1,
		currentState: state,
		events: [event],
		receipt: {
			commandId: `cmd_${id}`,
			idempotencyKey: `idem_${id}`,
			commandType: 'CaptureIntent',
			targetAggregateId: id,
			status: 'ACCEPTED',
			producedEventIds: [event.eventId]
		}
	};
}

describe('W2-INC-1 durable persistence round-trip', () => {
	const created: string[] = [];
	afterEach(() => {
		for (const p of created.splice(0)) cleanup(p);
	});

	it('persists to a file and reopens to byte-identical canonical state', () => {
		const path = tempDbPath();
		created.push(path);
		const objects: Array<[string, string, Record<string, unknown>]> = [
			['int_A', 'INTENT', { id: 'int_A', intentStatus: 'RAW', note: 'origin' }],
			['pwu_B', 'PROFESSIONAL_WORK_UNIT', { id: 'pwu_B', workLifecycleState: 'PROPOSED', n: 42 }]
		];

		const first = new SqliteStorageAdapter({ filename: path, now: () => TS });
		for (const [id, type, state] of objects) {
			expect(first.commit(commitInput(id, type, state)).ok).toBe(true);
		}
		const before = objects.map(([id]) => first.loadObject(id));
		first.close();

		// A brand-new adapter over the SAME file — nothing in memory carries over.
		const reopened = new SqliteStorageAdapter({ filename: path, now: () => TS });
		try {
			for (let i = 0; i < objects.length; i++) {
				expect(reopened.loadObject(objects[i]![0])).toEqual(before[i]);
			}
			// The event log survived too (auditability / replayability).
			expect(reopened.readAllEvents().length).toBe(objects.length);
		} finally {
			reopened.close();
		}
	});
});

describe('W2-INC-1 schema-version migration baseline', () => {
	it('stamps a fresh store at the current schema version', () => {
		const driver = createSqliteDriver(); // :memory:
		new SqliteStorageAdapter({ driver });
		const row = driver.prepare('PRAGMA user_version').get() as { user_version: number };
		expect(row.user_version).toBe(SCHEMA_VERSION);
		driver.close();
	});

	it('fails closed when the store was written by a NEWER schema version', () => {
		const driver = createSqliteDriver();
		driver.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
		expect(() => new SqliteStorageAdapter({ driver })).toThrow(/newer than/);
		driver.close();
	});

	it('reopening a stamped store does not error (idempotent stamp)', () => {
		const path = tempDbPath();
		try {
			new SqliteStorageAdapter({ filename: path, now: () => TS }).close();
			// second open sees user_version === SCHEMA_VERSION and just proceeds
			expect(() => new SqliteStorageAdapter({ filename: path, now: () => TS }).close()).not.toThrow();
		} finally {
			cleanup(path);
		}
	});
});
