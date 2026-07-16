// Drives the Intent lifecycle machine LIVE through the command pipeline (not a replayed event log):
// CaptureIntent -> BeginIntentDiscovery -> ProvisionIntent -> FormalizeIntent -> ApproveIntent -> ReviseIntent
// -> ApproveIntent. Plus the negative guards: an illegal transition (FormalizeIntent from RAW) and the INT-004
// invariant (approving an intent with no desired outcome). This is the first proof of the registry + kit path.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const actor = { actorId: 'user-1', actorType: 'HUMAN' as const, displayName: 'Alice' };

describe('Intent lifecycle handlers (live command drive)', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	const INTENT_ID = 'int_01ARZ3NDEKTSV4RRFFQ69G5FAV';

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => '2026-07-12T00:00:00Z' });
		seq = 0;
		engine = new Engine({
			store,
			now: () => '2026-07-12T00:00:00Z',
			newEventId: () => `evt_${++seq}`
		});
	});

	function cmd(
		commandType: string,
		payload: unknown,
		over: Partial<DomainCommand> = {}
	): DomainCommand {
		const n = ++seq;
		return {
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: 'INTENT',
			targetAggregateId: INTENT_ID,
			issuedAt: '2026-07-12T00:00:00Z',
			issuedBy: actor,
			correlationId: 'corr-1',
			idempotencyKey: `idem-${n}`,
			payload,
			...over
		};
	}

	function status(id = INTENT_ID): string {
		const obj = store.loadObject(id);
		return (obj?.state as { intentStatus: string }).intentStatus;
	}

	function capture(id = INTENT_ID): DomainCommand {
		return cmd(
			'CaptureIntent',
			{
				intentId: id,
				originatingExpression: 'Build a multi-tenant field service management SaaS',
				ontologyId: 'product-realization-pwa',
				ontologyVersion: '1.3.0'
			},
			{ targetAggregateId: id }
		);
	}

	function formalize(desiredOutcomes: unknown[]): DomainCommand {
		return cmd('FormalizeIntent', {
			formalizedObjective: 'Enable trades businesses to manage work from request through invoice',
			desiredOutcomes,
			successConditions: [{ statement: 'A job can be dispatched to a technician' }],
			nonGoals: ['payroll'],
			ambiguityIds: [],
			constraintIds: [],
			stakeholderIds: []
		});
	}

	it('drives the full lifecycle RAW -> UNDER_DISCOVERY -> PROVISIONAL -> FORMALIZED -> APPROVED -> REVISED -> APPROVED', () => {
		expect(engine.dispatch(capture()).status).toBe('ACCEPTED');
		expect(status()).toBe('RAW');

		expect(engine.dispatch(cmd('BeginIntentDiscovery', {})).status).toBe('ACCEPTED');
		expect(status()).toBe('UNDER_DISCOVERY');

		expect(engine.dispatch(cmd('ProvisionIntent', { ambiguityIds: [] })).status).toBe('ACCEPTED');
		expect(status()).toBe('PROVISIONAL');

		expect(engine.dispatch(formalize([{ description: 'field techs work offline' }])).status).toBe(
			'ACCEPTED'
		);
		expect(status()).toBe('FORMALIZED');

		const approve = engine.dispatch(
			cmd('ApproveIntent', {
				decisionId: 'dec_x',
				approvedSemanticVersion: 1,
				approvalScope: 'full'
			})
		);
		expect(approve.status).toBe('ACCEPTED');
		expect(status()).toBe('APPROVED');
		expect(
			(store.loadObject(INTENT_ID)?.state as { semanticVersion: number }).semanticVersion
		).toBe(1);

		expect(engine.dispatch(cmd('ReviseIntent', { changeRationale: 'add scheduling' })).status).toBe(
			'ACCEPTED'
		);
		expect(status()).toBe('REVISED');
		// Revising is a material change: the semantic version increments.
		expect(
			(store.loadObject(INTENT_ID)?.state as { semanticVersion: number }).semanticVersion
		).toBe(2);

		expect(
			engine.dispatch(
				cmd('ApproveIntent', {
					decisionId: 'dec_y',
					approvedSemanticVersion: 2,
					approvalScope: 'full'
				})
			).status
		).toBe('ACCEPTED');
		expect(status()).toBe('APPROVED');
	});

	it('rejects an update whose expectedRevision does not match the current revision (RPH-CON-003 optimistic concurrency)', () => {
		expect(engine.dispatch(capture()).status).toBe('ACCEPTED'); // INTENT created at revision 0
		// A client that read a STALE revision (2) tries to advance; the aggregate is actually at revision 0. The
		// Command envelope carries `expectedRevision` (DOC-007 §8) precisely so the engine can reject this instead
		// of applying the update to a version the client never saw. It was ignored — silent last-write-wins.
		const stale = engine.dispatch(cmd('BeginIntentDiscovery', {}, { expectedRevision: 2 }));
		expect(stale.status).toBe('CONFLICT');
		expect(stale.error?.code).toBe('RPH_REVISION_CONFLICT');
		expect(status()).toBe('RAW'); // did NOT advance
		// The SAME update with the CORRECT expected revision proceeds — the guard discriminates, it doesn't just block.
		const ok = engine.dispatch(cmd('BeginIntentDiscovery', {}, { expectedRevision: 0 }));
		expect(ok.status).toBe('ACCEPTED');
		expect(status()).toBe('UNDER_DISCOVERY');
	});

	it('rejects an illegal transition (FormalizeIntent from RAW) with RPH_ILLEGAL_STATE_TRANSITION', () => {
		expect(engine.dispatch(capture()).status).toBe('ACCEPTED');
		const r = engine.dispatch(formalize([{ description: 'x' }]));
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(status()).toBe('RAW'); // unchanged
	});

	it('rejects approving an intent with no desired outcome (INT-004) with RPH_INVARIANT_VIOLATION', () => {
		engine.dispatch(capture());
		engine.dispatch(cmd('BeginIntentDiscovery', {}));
		engine.dispatch(cmd('ProvisionIntent', { ambiguityIds: [] }));
		engine.dispatch(formalize([])); // formalized but with an empty desiredOutcomes set
		expect(status()).toBe('FORMALIZED');
		const r = engine.dispatch(
			cmd('ApproveIntent', {
				decisionId: 'dec_z',
				approvedSemanticVersion: 1,
				approvalScope: 'full'
			})
		);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(status()).toBe('FORMALIZED'); // unchanged
	});

	it('rejects an unknown command type with RPH_VALIDATION_SCHEMA_FAILED', () => {
		engine.dispatch(capture());
		const r = engine.dispatch(cmd('NotARealCommand', {}));
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SCHEMA_FAILED');
	});
});
