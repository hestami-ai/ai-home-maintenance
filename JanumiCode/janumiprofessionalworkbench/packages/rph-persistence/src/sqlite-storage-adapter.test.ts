import type { CommitInput } from '@janumipwb/rph-ports';
import type { DomainEvent } from '@janumipwb/rph-contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { SqliteStorageAdapter } from './sqlite-storage-adapter.js';

const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };
const AT = 'INTENT';
const AID = 'int_01ARZ3NDEKTSV4RRFFQ69G5FAV';

function makeEvent(rev: number, over: Partial<DomainEvent> = {}): DomainEvent {
	return {
		eventId: `evt_${rev}_${AID}`,
		eventType: 'IntentCaptured',
		eventSchemaVersion: 1,
		aggregateType: AT,
		aggregateId: AID,
		aggregateRevision: rev,
		occurredAt: '2026-07-11T00:00:00Z',
		recordedAt: '2026-07-11T00:00:00Z',
		actor,
		correlationId: 'corr-1',
		payload: { note: `rev ${rev}` },
		...over
	};
}

function commitInput(over: Partial<CommitInput> = {}): CommitInput {
	const rev = over.newRevision ?? 0;
	return {
		aggregateType: AT,
		aggregateId: AID,
		objectType: 'INTENT',
		expectedRevision: undefined,
		newRevision: rev,
		newSemanticVersion: 1,
		currentState: { id: AID, intentStatus: 'RAW' },
		events: [makeEvent(rev)],
		receipt: {
			commandId: `cmd_${rev}`,
			idempotencyKey: `idem_${rev}`,
			commandType: 'CaptureIntent',
			targetAggregateId: AID,
			status: 'ACCEPTED',
			producedEventIds: [`evt_${rev}_${AID}`]
		},
		...over
	};
}

describe('SqliteStorageAdapter', () => {
	let store: SqliteStorageAdapter;
	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => '2026-07-11T00:00:00Z' });
	});

	it('RPH-PER: commits a new aggregate, event, outbox row, and receipt atomically', () => {
		const r = store.commit(commitInput());
		expect(r.ok).toBe(true);
		expect(store.loadObject(AID)?.revision).toBe(0);
		expect(store.loadObject(AID)?.state).toEqual({ id: AID, intentStatus: 'RAW' });
		expect(store.readAggregateEvents(AT, AID)).toHaveLength(1);
		expect(store.readPendingOutbox()).toHaveLength(1);
		expect(store.getReceipt('idem_0')?.commandId).toBe('cmd_0');
	});

	it('RPH-PER-002: rejects a new-aggregate commit when the aggregate already exists (REVISION_CONFLICT)', () => {
		store.commit(commitInput());
		const r = store.commit(
			commitInput({
				receipt: { ...commitInput().receipt, idempotencyKey: 'idem_x', commandId: 'cmd_x' }
			})
		);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.reason).toBe('REVISION_CONFLICT');
	});

	it('RPH-PER-001: rejects an update whose expectedRevision does not match', () => {
		store.commit(commitInput());
		const r = store.commit(
			commitInput({ expectedRevision: 5, newRevision: 1, events: [makeEvent(1)] })
		);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.reason).toBe('REVISION_CONFLICT');
		expect(store.loadObject(AID)?.revision).toBe(0); // unchanged
	});

	it('RPH-PER: applies a legal update with matching expectedRevision (contiguous revisions)', () => {
		store.commit(commitInput());
		const r = store.commit(
			commitInput({
				expectedRevision: 0,
				newRevision: 1,
				currentState: { id: AID, intentStatus: 'FORMALIZED' },
				events: [makeEvent(1, { eventType: 'IntentFormalized' })],
				receipt: { ...commitInput().receipt, idempotencyKey: 'idem_1', commandId: 'cmd_1' }
			})
		);
		expect(r.ok).toBe(true);
		expect(store.loadObject(AID)?.revision).toBe(1);
		const events = store.readAggregateEvents(AT, AID);
		expect(events.map((e) => e.aggregateRevision)).toEqual([0, 1]);
	});

	it('RPH-PER: event + outbox + state commit atomically — a duplicate event_id rolls the whole commit back', () => {
		store.commit(commitInput());
		// second commit reuses the first event's id -> UNIQUE(event_id) violation -> throw -> rollback
		expect(() =>
			store.commit(
				commitInput({
					expectedRevision: 0,
					newRevision: 1,
					currentState: { id: AID, intentStatus: 'FORMALIZED' },
					events: [makeEvent(0)], // duplicate eventId evt_0_...
					receipt: { ...commitInput().receipt, idempotencyKey: 'idem_dup', commandId: 'cmd_dup' }
				})
			)
		).toThrow();
		expect(store.loadObject(AID)?.revision).toBe(0); // rolled back
		expect(store.readAggregateEvents(AT, AID)).toHaveLength(1);
		expect(store.getReceipt('idem_dup')).toBeUndefined();
	});

	it('RPH-PER: outbox drains — markOutboxPublished removes rows from the pending set', () => {
		store.commit(commitInput());
		const pending = store.readPendingOutbox();
		expect(pending).toHaveLength(1);
		store.markOutboxPublished(pending.map((p) => p.outboxId));
		expect(store.readPendingOutbox()).toHaveLength(0);
	});

	it('RPH-PER: readAllEvents returns events in global order', () => {
		store.commit(commitInput());
		store.commit(
			commitInput({
				expectedRevision: 0,
				newRevision: 1,
				events: [makeEvent(1)],
				receipt: { ...commitInput().receipt, idempotencyKey: 'idem_1', commandId: 'cmd_1' }
			})
		);
		expect(store.readAllEvents().map((e) => e.aggregateRevision)).toEqual([0, 1]);
	});
});
