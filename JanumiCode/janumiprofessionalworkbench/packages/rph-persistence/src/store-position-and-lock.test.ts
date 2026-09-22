// ── THE STORE: A REAL POSITION, A CONSISTENT FORK, AND THE WRITE LOCK TAKEN UP FRONT (`JAN-CRITREAD` `DD-1`) ──────────
//
// ⭐ THE RED THAT STARTED THIS, OBSERVED ON THE PRE-DD-1 BUILD BEFORE ANY CODE CHANGED: two connections to one SQLite
// file; B opens a transaction and reads; A commits; B writes. Under the deferred `BEGIN`, B's snapshot is stale and
// SQLite refuses its write — `{"aOutcome":"A committed","bOutcome":"B threw SQLITE_BUSY_SNAPSHOT: database is
// locked"}`. A raw SqliteError escaped the store and B's whole transaction was lost. Two connections in one thread
// have exactly the lock semantics two processes have (SQLite locks per connection), so this is the multi-process
// case (`AX-10`) with a deterministic interleaving.
//
// The draft-dependency rule (`REG-D-070`) rests on these three store properties: its check and its replay must not
// be invalidated mid-transaction; the fork a draft is built on must be ONE point in time; and "the events committed
// after the fork" must be a question the store can answer by position.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DomainEvent } from '@janumipwb/rph-contracts';
import { StoreBusyError, type CommitInput, type StorageAdapter } from '@janumipwb/rph-ports';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSqliteDriver } from './sql-driver.js';
import { SnapshotOverlayStorageAdapter } from './snapshot-overlay-storage-adapter.js';
import { SqliteStorageAdapter } from './sqlite-storage-adapter.js';

const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };
const id = (k: string) => `int_01ARZ3NDEKTSV4RRFFQ69G5${k.padStart(3, '0')}`;
let seq = 0;

function event(aggregateId: string, revision: number): DomainEvent {
	seq += 1;
	return {
		eventId: `evt_dd1_${seq}`,
		eventType: revision === 0 ? 'IntentCaptured' : 'IntentDiscoveryBegun',
		eventSchemaVersion: 1,
		aggregateType: 'INTENT',
		aggregateId,
		aggregateRevision: revision,
		occurredAt: '2026-09-22T00:00:00Z',
		recordedAt: '2026-09-22T00:00:00Z',
		actor,
		correlationId: 'dd1',
		payload: {}
	};
}

/** A commit that births `aggregateId` (revision 0) or advances it to `revision`. */
function write(aggregateId: string, revision = 0): CommitInput {
	const e = event(aggregateId, revision);
	return {
		aggregateType: 'INTENT',
		aggregateId,
		objectType: 'INTENT',
		expectedRevision: revision === 0 ? undefined : revision - 1,
		newRevision: revision,
		newSemanticVersion: 1,
		currentState: { id: aggregateId, intentStatus: revision === 0 ? 'RAW' : 'DISCOVERING' },
		events: [e],
		receipt: {
			commandId: `cmd_${e.eventId}`,
			idempotencyKey: `idem_${e.eventId}`,
			commandType: revision === 0 ? 'CaptureIntent' : 'BeginIntentDiscovery',
			targetAggregateId: aggregateId,
			status: 'ACCEPTED',
			producedEventIds: [e.eventId]
		}
	};
}

let dir: string;
const opened: SqliteStorageAdapter[] = [];
/** A connection to the test's one store file. A short busy timeout makes "busy" observable in milliseconds. */
function open(busyTimeoutMs = 5000): SqliteStorageAdapter {
	const s = new SqliteStorageAdapter({
		driver: createSqliteDriver(join(dir, 'store.db'), { busyTimeoutMs })
	});
	opened.push(s);
	return s;
}

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'rph-dd1-'));
});
afterEach(() => {
	for (const s of opened.splice(0)) s.close();
	rmSync(dir, { recursive: true, force: true });
});

describe('the write lock is taken before a transaction reads', () => {
	it('a transaction that read first is never invalidated: the other writer is told the store is busy, and waits its turn', () => {
		const b = open();
		const a = open(50);
		let aOutcome: unknown = 'not attempted';
		b.transaction(() => {
			b.loadObject(id('X')); // B's first read
			try {
				a.commit(write(id('A')));
				aOutcome = 'committed';
			} catch (error) {
				aOutcome = error;
			}
			expect(b.commit(write(id('B'))).ok, 'B commits on the state it read').toBe(true);
		});
		expect(
			aOutcome,
			'A was refused while B held the lock — not allowed to invalidate B'
		).toBeInstanceOf(StoreBusyError);
		expect((aOutcome as StoreBusyError).code).toBe('RPH_STORE_BUSY');
		expect(a.commit(write(id('A'))).ok, 'A commits once B has released').toBe(true);
		expect(
			open()
				.readAllEvents()
				.map((e) => e.aggregateId)
		).toEqual([id('B'), id('A')]);
	});

	it('the same holds when the reading transaction is nested inside another — the outermost call took the lock', () => {
		const b = open();
		const a = open(50);
		let aOutcome: unknown = 'not attempted';
		b.transaction(() => {
			b.transaction(() => {
				b.loadObject(id('X'));
				try {
					a.commit(write(id('A')));
					aOutcome = 'committed';
				} catch (error) {
					aOutcome = error;
				}
				expect(b.commit(write(id('B'))).ok).toBe(true);
			});
		});
		expect(aOutcome).toBeInstanceOf(StoreBusyError);
	});

	it('a BUSY raised AFTER the lock was taken is not reported as "the store is busy" — it keeps its own identity', () => {
		// Only a lock never acquired means "nothing was read or written, try again". A busy error that surfaces
		// INSIDE the transaction — here, another connection's raw write refused because B holds the lock — happened
		// after B's work began, so calling it StoreBusyError would tell the caller a false "nothing happened".
		const b = open();
		const raw = createSqliteDriver(join(dir, 'store.db'), { busyTimeoutMs: 50 });
		let thrown: unknown;
		try {
			b.transaction(() => {
				b.loadObject(id('X'));
				raw.exec('CREATE TABLE IF NOT EXISTS dd1_probe (x INTEGER)');
			});
		} catch (error) {
			thrown = error;
		} finally {
			raw.close();
		}
		expect((thrown as { code?: string }).code, 'the raw fault, as it happened').toBe('SQLITE_BUSY');
		expect(thrown).not.toBeInstanceOf(StoreBusyError);
	});
});

describe('a read transaction is one snapshot', () => {
	it('reads inside it do not see another connection commit meanwhile', () => {
		const reader = open();
		const writer = open();
		writer.commit(write(id('1')));
		const seen = reader.readTransaction(() => {
			const before = reader.highWaterMark();
			writer.commit(write(id('2')));
			return [before, reader.highWaterMark(), reader.readAllEvents().length];
		});
		expect(seen).toEqual([1, 1, 1]);
		expect(reader.highWaterMark(), 'outside it, the reader sees the new commit').toBe(2);
	});
});

describe('the store answers "what was committed after position P"', () => {
	it('the position is the commit sequence, and eventsAfter returns exactly what came after it', () => {
		const s = open();
		expect(s.highWaterMark(), 'an empty store is at 0').toBe(0);
		s.commit(write(id('1')));
		const mark = s.highWaterMark();
		s.commit(write(id('2')));
		s.commit(write(id('3')));
		expect(s.eventsAfter(mark).map((e) => e.aggregateId)).toEqual([id('2'), id('3')]);
		expect(s.eventsAfter(s.highWaterMark())).toEqual([]);
		expect(s.eventsAfter(0).map((e) => e.aggregateId)).toEqual([id('1'), id('2'), id('3')]);
	});
});

describe('a fork is one point in time, and knows which', () => {
	it('records the position it was taken at, and keeps it when the store moves on', () => {
		const s = open();
		s.commit(write(id('1')));
		s.commit(write(id('2')));
		const fork = new SnapshotOverlayStorageAdapter(s);
		expect(fork.highWaterMark()).toBe(2);
		s.commit(write(id('3')));
		expect(fork.highWaterMark(), 'the fork does not move').toBe(2);
		expect(fork.readAllEvents()).toHaveLength(2);
		expect(fork.commit(write(id('4'))).ok).toBe(true);
		expect(
			fork.eventsAfter(2).map((e) => e.aggregateId),
			'after its base: its own staged events'
		).toEqual([id('4')]);
		expect(() => fork.eventsAfter(1), 'it cannot answer for positions it never saw').toThrow(
			/before its base position/
		);
	});

	it('its events and its objects are the same moment even when a commit lands between reading them', () => {
		const source = open();
		const other = open();
		source.commit(write(id('1')));
		// A source that lets another connection advance the aggregate the moment its events have been read — the
		// window the pre-DD-1 overlay left open between its separate autocommit reads.
		let raced = false;
		const racing: StorageAdapter = new Proxy(source, {
			get(target, prop) {
				if (prop === 'readAllEvents')
					return () => {
						const events = target.readAllEvents();
						if (!raced) {
							raced = true;
							other.commit(write(id('1'), 1));
						}
						return events;
					};
				const value = Reflect.get(target, prop, target) as unknown;
				return typeof value === 'function'
					? (value as (...a: unknown[]) => unknown).bind(target)
					: value;
			}
		});
		const fork = new SnapshotOverlayStorageAdapter(racing);
		expect(raced, 'arrangement: the race happened').toBe(true);
		expect(
			fork.readAllEvents().map((e) => e.aggregateRevision),
			'the fork saw revision 0 only'
		).toEqual([0]);
		expect(
			fork.loadObject(id('1'))?.revision,
			'so its object must be revision 0 too — not the racing 1'
		).toBe(0);
		expect(source.loadObject(id('1'))?.revision, 'while canonical moved on').toBe(1);
	});
});
