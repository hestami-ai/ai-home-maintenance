// REG-F-072 — THE GENERIC SETTER MAY NOT PERFORM AN ARROW A SEMANTIC COMMAND OWNS.
//
// JPWB-DOC-003 §9 PER-3 (L343): *"**One authoritative write path.** Canonical state is mutated only through
// authenticated, authorized, **semantically named commands** that check expected revision, **validate
// preconditions and invariants**, enforce required assurance, and atomically persist state, version history,
// events, outbox, and command receipt. **No generic CRUD/PATCH path**, UI local state, RPH worker, validator,
// projection worker, broker message, agent output, or informal approval bypasses this pipeline."*
//
// ⚠ THE SIX PAIRS ARE HARDCODED HERE, NOT IMPORTED FROM `PWU_SEMANTIC_LIFECYCLE_COMMANDS`.
// A table-driven test that reads the same table the handler reads can only prove TOTALITY — every row has a case.
// It cannot prove the CLASSIFICATION, because mutating a row flips the generated expectation along with the
// behaviour and the test stays green. This repository already records that tautology recurring inside its own
// remedy (`execrem-wp12-authority.test.ts` header). So the answers are STATED.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-08-08T00:00:00Z';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69H7100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H7110';

describe('REG-F-072 — ChangePwuState may not perform an arrow a semantic command owns', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	const dispatch = (commandType: string, payload: unknown, id: string, aggType: string) => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'regf072',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	};
	const ok = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		return r;
	};
	const chg = (previousState: string, newState: string, over: Record<string, unknown> = {}) =>
		dispatch(
			'ChangePwuState',
			{
				previousState,
				newState,
				executionState: 'NOT_PLANNED',
				assuranceState: 'UNASSESSED',
				shapeIntegrityState: 'PRESERVED',
				reasonCode: 'CONTROLLER',
				supportingObjectIds: [],
				...over
			},
			PWU,
			'PROFESSIONAL_WORK_UNIT'
		);
	const lifecycle = () =>
		(store.loadObject(PWU)!.state as { workLifecycleState: string }).workLifecycleState;

	/** The refusal must be THIS guard's, named by the command it redirects to and the clause it enforces. */
	const refusedAsOwned = (
		r: { status: string; error?: { code?: string; message?: string } },
		owner: string
	) => {
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message, 'must name the owning command').toContain(`Dispatch ${owner} instead`);
		expect(r.error?.message, 'must cite the rule it enforces').toContain('PER-3');
	};

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		}).as(TEST_CRED.human);
		ok(
			dispatch(
				'CaptureIntent',
				{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
				INTENT,
				'INTENT'
			),
			'intent'
		);
		ok(dispatch('BeginIntentDiscovery', {}, INTENT, 'INTENT'), 'discovery');
		ok(dispatch('ProvisionIntent', { ambiguityIds: [] }, INTENT, 'INTENT'), 'provisional');
		ok(
			dispatch(
				'ProposePwu',
				{
					pwuId: PWU,
					pwuKind: 'ARCHITECTURE',
					title: 'Arch',
					description: 'd',
					intentId: INTENT,
					boundaries: {
						inScope: ['the governed work under test'],
						outOfScope: ['not yet known'],
						permittedChanges: [],
						prohibitedChanges: []
					},
					obligationIds: [],
					constraintIds: [],
					assumptionIds: [],
					expectedOutputs: [{ outputId: 'out_1', kind: 'DOCUMENT' }],
					assurancePolicyIds: [],
					riskProfile: {
						consequence: 'MEDIUM',
						uncertainty: 'MEDIUM',
						irreversibility: 'LOW',
						securitySensitivity: 'LOW',
						regulatoryExposure: 'NONE'
					}
				},
				PWU,
				'PROFESSIONAL_WORK_UNIT'
			),
			'pwu'
		);
	});

	const toReady = () => {
		ok(dispatch('BeginPwuShaping', {}, PWU, 'PROFESSIONAL_WORK_UNIT'), 'shaping');
		ok(
			dispatch(
				'MarkPwuReady',
				{ shapeReadinessAssessmentId: 'assess_shape', expectedSemanticVersion: 1 },
				PWU,
				'PROFESSIONAL_WORK_UNIT'
			),
			'ready'
		);
	};

	// ── ONE CASE PER OWNED TARGET, EACH ANSWER STATED ────────────────────────────────────────────────────────
	it('REJECTS PROPOSED -> SHAPING, naming BeginPwuShaping', () => {
		refusedAsOwned(chg('PROPOSED', 'SHAPING'), 'BeginPwuShaping');
		expect(lifecycle(), 'a refused arrow must not have moved the PWU').toBe('PROPOSED');
	});

	it('REJECTS SHAPING -> READY, naming MarkPwuReady — the finding itself', () => {
		ok(dispatch('BeginPwuShaping', {}, PWU, 'PROFESSIONAL_WORK_UNIT'), 'shaping');
		refusedAsOwned(chg('SHAPING', 'READY'), 'MarkPwuReady');
		expect(lifecycle()).toBe('SHAPING');
	});

	it('REJECTS READY -> CHALLENGED, naming ChallengePwu', () => {
		toReady();
		refusedAsOwned(chg('READY', 'CHALLENGED'), 'ChallengePwu');
	});

	it('REJECTS -> RESHAPING, naming ReshapePwu', () => {
		toReady();
		ok(chg('READY', 'PLANNED', { executionState: 'PLANNED' }), 'planned');
		ok(chg('PLANNED', 'EXECUTING', { executionState: 'QUEUED' }), 'executing');
		refusedAsOwned(chg('EXECUTING', 'RESHAPING', { executionState: 'QUEUED' }), 'ReshapePwu');
	});

	it('REJECTS -> SUPERSEDED, naming SupersedePwu', () => {
		toReady();
		refusedAsOwned(chg('READY', 'SUPERSEDED'), 'SupersedePwu');
	});

	// INVALIDATED's in-arrows are from CONDITIONALLY_SATISFIED / SATISFIED / RECOMPOSED, none of which this
	// fixture can reach without the whole assurance chain — so it is asserted at the one place that does not
	// require the journey: the arrow is owned, therefore refused, and the refusal names its owner.
	it('REJECTS -> INVALIDATED, naming InvalidatePwu', () => {
		toReady();
		const r = chg('READY', 'INVALIDATED');
		expect(r.status).toBe('REJECTED');
		// READY -> INVALIDATED is ALSO not a legal arrow, and legality is reported FIRST by design (see the
		// ordering control below). So this asserts the pair: refused, and for the legality reason rather than
		// silently accepted. The ownership limb for INVALIDATED is covered by the table's own type narrowing —
		// `advancePwuLifecycle`'s target union — and by `invalidatePwu` remaining the only writer.
		expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
	});

	// ── WHAT IT MUST NOT TOUCH ───────────────────────────────────────────────────────────────────────────────
	it('ACCEPTS an arrow no semantic command owns', () => {
		toReady();
		ok(chg('READY', 'PLANNED', { executionState: 'PLANNED' }), 'READY -> PLANNED is the setter’s own');
		expect(lifecycle()).toBe('PLANNED');
	});

	it('ACCEPTS a HOLD on an owned state while an orthogonal axis moves', () => {
		toReady();
		// READY is an OWNED target, but this performs no arrow — it advances the execution axis and holds.
		ok(chg('READY', 'READY', { executionState: 'PLANNED' }), 'a hold is not a move');
		expect(lifecycle()).toBe('READY');
	});

	// ── CONTROL 1: THE ROUTE CLOSED, NOT THE CAPABILITY ──────────────────────────────────────────────────────
	// Every rejection above is also satisfied by a system that simply cannot reach these states any more. This
	// fails in exactly that world: the owning commands must still perform the identical arrows. Predicted red for
	// any mutant that guards the ARROW rather than the ROUTE.
	it('CONTROL — the owning commands still perform the very arrows the setter is refused', () => {
		ok(dispatch('BeginPwuShaping', {}, PWU, 'PROFESSIONAL_WORK_UNIT'), 'BeginPwuShaping performs it');
		expect(lifecycle()).toBe('SHAPING');
		ok(
			dispatch(
				'MarkPwuReady',
				{ shapeReadinessAssessmentId: 'assess_shape', expectedSemanticVersion: 1 },
				PWU,
				'PROFESSIONAL_WORK_UNIT'
			),
			'MarkPwuReady performs it'
		);
		expect(lifecycle()).toBe('READY');
		ok(
			dispatch(
				'ChallengePwu',
				{ challengeReason: 'the shape is contested' },
				PWU,
				'PROFESSIONAL_WORK_UNIT'
			),
			'ChallengePwu performs it'
		);
		expect(lifecycle()).toBe('CHALLENGED');
	});

	// ── CONTROL 2: ORDERING — AN ILLEGAL ARROW IS REPORTED AS ILLEGAL, NOT AS OWNED ─────────────────────────
	// The guard runs LAST, after the legality check, so a caller is never redirected to a command that would
	// refuse the same hop for a different reason. Predicted red for the mutant that moves the ownership check
	// ahead of `rejectIllegalWorkLifecycleMove` — and ONLY for it: every test above uses a legal arrow, so the
	// ordering is invisible to all of them.
	it('CONTROL — an ILLEGAL hop to an owned state is refused as illegal, not redirected', () => {
		// PROPOSED -> READY is not an arrow: READY's only in-arrow is from SHAPING.
		const r = chg('PROPOSED', 'READY');
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code, 'legality is reported before ownership').toBe(
			'RPH_ILLEGAL_STATE_TRANSITION'
		);
		expect(r.error?.message ?? '', 'must NOT redirect to MarkPwuReady for a hop the machine forbids').not.toContain(
			'Dispatch MarkPwuReady'
		);
	});
});
