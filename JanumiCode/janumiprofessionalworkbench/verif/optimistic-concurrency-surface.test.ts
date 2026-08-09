// PER-4 / SPEC-001 §11.4.22 item 2 — A COMMAND DECLARES THE REVISION ITS PAGE WAS RENDERED FROM.
//
// THE RULE. JPWB-DOC-003 §9 PER-4 (canon): "Optimistic concurrency; never last-write-wins. Updates to existing
// aggregates declare the revision they believe current. On conflict, the command is rejected; the caller reloads
// current state and re-forms intent; the system never silently overwrites and never silently retries with stale
// business assumptions." Its NON-EXAMPLE exempts "pure creations". JPWB-SPEC-001 §11.4.22 item 2 (ratified,
// REG-D-023) binds the surface specifically, and its trigger — "a Projection whose `freshness` is not `FRESH`" —
// is in scope by default, because §2.5.2 defines `freshness` with default `UNKNOWN`, which is not `FRESH`.
//
// WHAT WAS WRONG. `StoredObject` carries `revision` and every read helper discarded it one layer up — `ObjectRow`
// was `{id, state}` and `getObject` returns `.state`. The revision was dropped STRUCTURALLY, below every loader,
// so no route could declare one. Meanwhile `loadOrReject` has always honoured `expectedRevision` when present.
// The engine offered the protection and the surface declined it by omission.
//
// ⚠ WHAT THIS FILE MUST NOT DO, AND WHY IT IS BUILT THE WAY IT IS. REG-F-050 records an earlier attempt at this
// increment that would have had the ENGINE supply the expectation — making the check `x !== x`, a gate that
// cannot fail. The same trap exists one layer out: a surface that FETCHES the revision immediately before
// dispatching would pass a naive test and protect nothing. So every test below takes its expectation from a read
// performed BEFORE the intervening write, exactly as a rendered page would.

import { createEngine, getObjectRevision } from '@janumipwb/rph-engine';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { beforeEach, describe, expect, it } from 'vitest';

const TS = '2026-08-07T00:00:00Z';

describe('PER-4 — a surface command declares the revision it was rendered from', () => {
	let store: SqliteStorageAdapter;
	// The SESSION, not the handle: `createEngine(...)` yields an EngineHandle, and only what `.as()` returns
	// can dispatch (D-1, REG-D-028). Typed as `ReturnType<typeof createEngine>` this file called a method the
	// type does not have — invisible until `verif/` came under `check-types` (REG-F-097).
	let engine: ReturnType<ReturnType<typeof createEngine>['as']>;
	let seq = 0;

	// THE SUBJECT IS A CLAIM, and the choice is deliberate rather than convenient. The seeded PWU Types cannot
	// be edited at all — their PWA is PUBLISHED and `EditPwuType` refuses with RPH_INVARIANT_VIOLATION, which is
	// a real precondition doing its job. A Claim is freely advanceable through its own machine, so the ONLY
	// thing that can refuse the third dispatch below is the revision check — which is what makes this an
	// arrangement that can distinguish, rather than one that happens to be refused.
	const CLAIM = 'clm_01ARZ3NDEKTSV4RRFFQ69K2001';
	const SUBJECT = 'pwu_01ARZ3NDEKTSV4RRFFQ69K2002';

	const cmd = (
		commandType: string,
		targetAggregateType: string,
		targetAggregateId: string,
		payload: unknown,
		expectedRevision?: number
	): DomainCommand => ({
		commandId: `ui-${++seq}`,
		commandType,
		commandSchemaVersion: 1,
		targetAggregateType,
		targetAggregateId,
		issuedAt: TS,
		correlationId: 'ui',
		idempotencyKey: `ui-idem-${seq}`,
		...(expectedRevision === undefined ? {} : { expectedRevision }),
		payload
	});

	const advance = (targetStatus: string, expectedRevision?: number) =>
		engine.dispatch(
			cmd('RecordClaimAssessment', 'CLAIM', CLAIM, { targetStatus, rationale: 'r' }, expectedRevision)
		);

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = createEngine({ authenticate: testAuthenticator(), ontology, store, now: () => TS, newEventId: () => `evt_${++seq}` }).as(TEST_CRED.human);
		expect(
			engine.dispatch(
				cmd('AssertClaim', 'CLAIM', CLAIM, {
					statement: 'the boundary holds',
					claimType: 'COMPLETENESS',
					subjectObjectIds: [SUBJECT]
				})
			).status,
			'arrangement: the claim must exist'
		).toBe('ACCEPTED');
	});

	// ── THE CHECK SPEC-001 §11.4.22 NAMES, asserted on its OUTCOME rather than on the FX identifier, per §10.8
	// ("the assertion — not the identifier — is what conforms"): a command from a page derived at r, against a
	// subject now at r+1, must CONFLICT.
	//
	// PREDICTED RED: drop `expectedRevision` from the envelope and this reddens while the control stays green —
	// which is precisely the behaviour that ships today at all 28 surface dispatch sites.
	it('a command carrying a STALE rendered revision is refused with RPH_REVISION_CONFLICT', () => {
		// (1) the page renders. THIS read is the only source of the expectation, and it happens FIRST.
		const renderedAt = getObjectRevision(engine, CLAIM);
		expect(renderedAt, 'the read boundary must expose a revision at all').toBeTypeOf('number');

		// (2) somebody else writes; the rendered page is now stale.
		expect(advance('UNDER_ASSESSMENT').status).toBe('ACCEPTED');
		expect(getObjectRevision(engine, CLAIM)).toBeGreaterThan(renderedAt as number);

		// (3) the professional submits the form that stale page produced. CONTESTED is a LEGAL move from
		//     UNDER_ASSESSMENT, so nothing but the revision can refuse it.
		const r = advance('CONTESTED', renderedAt);
		expect(r.status, 'the surface must not silently overwrite (PER-4)').toBe('CONFLICT');
		expect(r.error?.code).toBe('RPH_REVISION_CONFLICT');
	});

	// THE CONTROL. Without it, a check that refused EVERY dispatch carrying a revision would pass the test
	// above — REG-F-015's anatomy, where every assertion is true about an arrangement that never happened.
	it('CONTROL — a command carrying a CURRENT rendered revision is accepted', () => {
		const renderedAt = getObjectRevision(engine, CLAIM);
		const r = advance('UNDER_ASSESSMENT', renderedAt);
		expect(r.status, 'declaring the true revision must not itself be an obstacle').toBe('ACCEPTED');
	});

	// ⚠ THE TAUTOLOGY CONTROL, and the reason this file has the shape it does. A value read immediately before
	// dispatch is ALWAYS current, so it can never conflict — satisfying the letter of PER-4 and none of its
	// purpose. This pins the distinction: the same stale-page scenario, but with the expectation RE-FETCHED at
	// submit time, is ACCEPTED. WHEN the read happens is the whole of the protection, and a future refactor
	// that moves the read later would disarm it silently. REG-F-050 is the same error one layer in.
	it('a re-fetched expectation cannot conflict — WHEN the read happens is the protection', () => {
		const renderedAt = getObjectRevision(engine, CLAIM);
		expect(advance('UNDER_ASSESSMENT').status).toBe('ACCEPTED');

		const refetched = getObjectRevision(engine, CLAIM);
		expect(refetched, 'the intervening write moved it').not.toBe(renderedAt);

		const r = advance('CONTESTED', refetched);
		expect(
			r.status,
			'ACCEPTED — and that is the point: re-fetching at dispatch reproduces REG-F-050 one layer out'
		).toBe('ACCEPTED');
	});

	// PURE CREATIONS ARE EXEMPT BY THE RATIFIED NON-EXAMPLE — "Command types explicitly exempted by contract
	// (pure creations) need no expected revision." Pinned so a future "require it everywhere" cannot mistake a
	// create for an update. (The `beforeEach` AssertClaim above is itself such a creation and is accepted.)
	it('a creation needs no expected revision (PER-4 NON-EXAMPLE)', () => {
		const other = 'clm_01ARZ3NDEKTSV4RRFFQ69K2009';
		const created = engine.dispatch(
			cmd('AssertClaim', 'CLAIM', other, {
				statement: 'another claim',
				claimType: 'CORRECTNESS',
				subjectObjectIds: [SUBJECT]
			})
		);
		expect(created.status, 'a create declares no revision and is not thereby refused').toBe('ACCEPTED');
	});
});
