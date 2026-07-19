// JAN-IRP capability C7 (RPH Coordination), first increment: ProposeHarness mints a durable
// RecursiveProfessionalHarness, and — because every object persists through the durable event-sourced store —
// the harness survives a store restart. This closes C7's headline proof obligation ("the RPH survives restart
// while waiting") for the harness OBJECT: any status the harness holds, including a durable WAITING state a
// later increment introduces, survives a close/reopen by the same mechanism proven here.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-19T00:00:00Z';
const human = { actorId: 'coord-1', actorType: 'HUMAN' as const, displayName: 'Coordinator' };
const authority = {
	authorityId: 'auth_coord',
	authorityType: 'ORGANIZATIONAL_ROLE' as const,
	scope: ['program'],
	validFrom: TS
};
const RPH_ID = 'rph_01ARZ3NDEKTSV4RRFFQ69G5H00';
const PWU_A = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5H0A';

function dispatch(engine: Engine, seq: { n: number }, id: string, type: string, payload: unknown) {
	const n = ++seq.n;
	const command: DomainCommand = {
		commandId: `c-${n}`,
		commandType: 'ProposeHarness',
		commandSchemaVersion: 1,
		targetAggregateType: type,
		targetAggregateId: id,
		issuedAt: TS,
		issuedBy: human,
		correlationId: 'corr',
		idempotencyKey: `k-${n}`,
		payload
	};
	return engine.dispatch(command);
}

const HARNESS = 'RECURSIVE_PROFESSIONAL_HARNESS';

describe('ProposeHarness mints a durable RecursiveProfessionalHarness (JAN-IRP C7)', () => {
	let path = '';
	afterEach(() => {
		for (const s of ['', '-wal', '-shm']) {
			const p = `${path}${s}`;
			if (p && existsSync(p)) rmSync(p);
		}
	});

	it('mints in FRAMING carrying objective/scope/authority/coordinated PWUs', () => {
		const store = new SqliteStorageAdapter({ now: () => TS });
		const seq = { n: 0 };
		const engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq.n}` });
		const r = dispatch(engine, seq, RPH_ID, HARNESS, {
			objective: 'Coordinate the product realization program',
			scopeStatement: 'intent through architecture baseline',
			authority,
			coordinatedPwuIds: [PWU_A]
		});
		expect(r.status).toBe('ACCEPTED');
		const obj = store.loadObject(RPH_ID)?.state as Record<string, unknown>;
		expect(obj.objectType).toBe(HARNESS);
		expect(obj.status).toBe('FRAMING');
		expect(obj.objective).toBe('Coordinate the product realization program');
		expect(obj.coordinatedPwuIds).toEqual([PWU_A]);
		expect(obj.childHarnessIds).toEqual([]);
		expect((obj.authority as { authorityId: string }).authorityId).toBe('auth_coord');
	});

	it('the durable harness survives a store restart (C7: RPH survives restart)', () => {
		path = join(tmpdir(), `rph-irp-c7-${process.pid}-${Date.now()}.db`);
		const seq = { n: 0 };
		const store1 = new SqliteStorageAdapter({ filename: path, now: () => TS });
		const engine1 = new Engine({ store: store1, now: () => TS, newEventId: () => `e${++seq.n}` });
		expect(
			dispatch(engine1, seq, RPH_ID, HARNESS, {
				objective: 'o',
				scopeStatement: 's',
				authority,
				coordinatedPwuIds: [PWU_A]
			}).status
		).toBe('ACCEPTED');
		const before = store1.loadObject(RPH_ID);
		store1.close(); // restart

		const store2 = new SqliteStorageAdapter({ filename: path, now: () => TS });
		try {
			expect(store2.loadObject(RPH_ID)).toEqual(before); // durable harness survives identical
			expect((store2.loadObject(RPH_ID)?.state as { status: string }).status).toBe('FRAMING');
		} finally {
			store2.close();
		}
	});
});
