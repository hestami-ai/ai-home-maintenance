// JAN-PFA S3.3 — BeginRecomposition admits EVERY in-arrow the contract declares, not just the ones a test happens
// to drive.
//
// WHY THIS FILE EXISTS. `beginRecomposition` declares `precondition: fromStates('READY', 'CONFLICTED',
// 'INSUFFICIENT')`, and its own comment states the promise those three members carry: *"RecompositionContract.status
// has THREE in-arrows to EVALUATING — READY (first pass) and CONFLICTED/INSUFFICIENT ('re-evaluation after
// remediation'). No separate re-evaluation command exists ... so BeginRecomposition IS the re-evaluation driver"*.
// Before this file the suite drove only TWO of the three: `dwp03-precondition-coverage.test.ts` covers READY (:465)
// and CONFLICTED (:475), and nothing anywhere issued BeginRecomposition from INSUFFICIENT. That was measured, not
// assumed — narrowing the site to `fromStates('READY', 'CONFLICTED')` left the entire suite green, so the
// INSUFFICIENT arm of a three-member promise was unguarded while looking covered.
//
// A test that pins ONE member of a set proves nothing about the others, so this file does not hand-list the members
// at all. It DERIVES them from the contract's own binding table (`BINDINGS`, the command -> event -> transition
// table in `@janumipwb/rph-contracts`) and asserts over everything it finds, naming the offending member in the
// failure message. A fourth in-arrow added to the contract later joins this sweep automatically; if it is added
// without a way to reach it, `driveTo` refuses to skip it and the test says so.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { BINDINGS } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-23T00:00:00Z';
const INT = 'int_01ARZ3NDEKTSV4RRFFQ69G5X30';
const PARENT = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5X31';
const CHILD_A = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5X3A';
const CHILD_B = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5X3B';
const RCP = 'rcp_01ARZ3NDEKTSV4RRFFQ69G5X33';
const CLAIM = 'clm_01ARZ3NDEKTSV4RRFFQ69G5X34';

function harness() {
	const store = new SqliteStorageAdapter({ now: () => TS });
	let seq = 0;
	const engine = new Engine({
		authenticate: testAuthenticator(),
		store,
		now: () => TS,
		newEventId: () => `e${++seq}`
	}).as(TEST_CRED.human);
	const d = (commandType: string, id: string, type: string, payload: unknown) => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'inarrow',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	};
	const statusOf = (id: string) =>
		((store.loadObject(id)?.state as { status?: string } | undefined)?.status ?? '') as string;
	const eventsOfType = (t: string) => store.readAllEvents().filter((e) => e.eventType === t);
	return { store, d, statusOf, eventsOfType };
}

// ─────────────────────────── the set, DERIVED from the contract rather than retyped ───────────────────────────

/** The BeginRecomposition -> EVALUATING rows of the contract's binding table. */
const BEGIN_ARROWS = BINDINGS.filter(
	(b) =>
		b.commandType === 'BeginRecomposition' &&
		b.machine === 'RecompositionContract.status' &&
		b.to === 'EVALUATING'
);

/** `from` is written as a disjunction ("READY | CONFLICTED | INSUFFICIENT"); split it into the member set. */
const SOURCE_STATES: readonly string[] = BEGIN_ARROWS.flatMap((b) =>
	(b.from ?? '')
		.split('|')
		.map((s) => s.trim())
		.filter((s) => s !== '')
);

// ────────────────────────────────────── reaching each source state ──────────────────────────────────────

function seed(h: ReturnType<typeof harness>) {
	expect(
		h.d('CaptureIntent', INT, 'INTENT', {
			intentId: INT,
			originatingExpression: 'x',
			ontologyId: 'o',
			ontologyVersion: '1'
		}).status
	).toBe('ACCEPTED');
	for (const id of [PARENT, CHILD_A, CHILD_B]) {
		expect(
			h.d('ProposePwu', id, 'PROFESSIONAL_WORK_UNIT', {
				pwuId: id,
				pwuKind: 'ARCHITECTURE',
				title: id,
				description: 'd',
				intentId: INT,
				boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'HIGH',
					uncertainty: 'MEDIUM',
					irreversibility: 'MEDIUM',
					securitySensitivity: 'HIGH',
					regulatoryExposure: 'LOW'
				}
			}).status,
			`arrangement: ProposePwu ${id}`
		).toBe('ACCEPTED');
	}
}

function propose(h: ReturnType<typeof harness>, children: string[]) {
	expect(
		h.d('ProposeRecomposition', RCP, 'RECOMPOSITION_CONTRACT', {
			parentWorkUnitId: PARENT,
			requiredChildWorkUnitIds: children,
			parentCompletionClaimId: CLAIM,
			conflictResolutionRules: []
		}).status,
		'arrangement: ProposeRecomposition'
	).toBe('ACCEPTED');
}

function begin(h: ReturnType<typeof harness>) {
	expect(
		h.d('BeginRecomposition', RCP, 'RECOMPOSITION_CONTRACT', { recompositionContractId: RCP })
			.status,
		'arrangement: BeginRecomposition'
	).toBe('ACCEPTED');
}

/**
 * Drive a fresh recomposition contract into `state` through `engine.dispatch` only — no store writes, so the state
 * is one the machine actually produces rather than one a test asserted into existence.
 *
 * ⚠ IT REFUSES TO SKIP. An unrecognised member returns `undefined` and the caller fails naming it, so a member added
 * to the contract without a way to reach it cannot quietly drop out of the sweep.
 */
function driveTo(state: string): ReturnType<typeof harness> | undefined {
	const h = harness();
	seed(h);
	if (state === 'READY') {
		// The birth state: ProposeRecomposition mints the contract READY and nothing further is needed.
		propose(h, [CHILD_A]);
		return h;
	}
	if (state === 'CONFLICTED') {
		propose(h, [CHILD_A, CHILD_B]);
		begin(h);
		expect(
			h.d('CompleteRecomposition', RCP, 'RECOMPOSITION_CONTRACT', {
				parentCompletionClaimId: CLAIM,
				detectedConflicts: [
					{
						conflictType: 'TENANT_IDENTITY_MISMATCH',
						conflictingChildWorkUnitIds: [CHILD_A, CHILD_B],
						description: 'incompatible tenant identity models'
					}
				]
			}).status,
			'arrangement: CompleteRecomposition with a detected conflict'
		).toBe('ACCEPTED');
		return h;
	}
	if (state === 'INSUFFICIENT') {
		// A freshly proposed child is UNASSESSED, hence not an acceptable required child, so the whole-check fails
		// and the outcome is INSUFFICIENT rather than COMPOSABLE.
		propose(h, [CHILD_A]);
		begin(h);
		expect(
			h.d('CompleteRecomposition', RCP, 'RECOMPOSITION_CONTRACT', {
				parentCompletionClaimId: CLAIM
			}).status,
			'arrangement: CompleteRecomposition with an unacceptable required child'
		).toBe('ACCEPTED');
		return h;
	}
	return undefined;
}

describe('BeginRecomposition admits every in-arrow the contract declares (JAN-PFA S3.3)', () => {
	it('the contract declares exactly one BeginRecomposition -> EVALUATING arrow with a non-empty source set', () => {
		// The instrument before the measurement: if this derivation silently produced an EMPTY set, the sweep below
		// would pass vacuously and prove nothing at all.
		expect(
			BEGIN_ARROWS,
			'BINDINGS must declare the BeginRecomposition -> EVALUATING arrow'
		).toHaveLength(1);
		expect(SOURCE_STATES.length, 'the declared source set must not be empty').toBeGreaterThan(0);
	});

	it('EVERY declared source state is accepted — no member of the set is left unguarded', () => {
		const refused: string[] = [];
		const unreachable: string[] = [];

		for (const state of SOURCE_STATES) {
			const h = driveTo(state);
			if (!h) {
				unreachable.push(state);
				continue;
			}
			// The arrangement really did land in the state we are about to test the arrow FROM.
			expect(h.statusOf(RCP), `arrangement: contract should be ${state}`).toBe(state);
			const before = h.eventsOfType('RecompositionStarted').length;

			const r = h.d('BeginRecomposition', RCP, 'RECOMPOSITION_CONTRACT', {
				recompositionContractId: RCP
			});
			if (r.status !== 'ACCEPTED' || h.statusOf(RCP) !== 'EVALUATING') {
				refused.push(`${state} (${r.status}: ${r.error?.code ?? '-'})`);
				continue;
			}
			// An ACCEPTED status with no new event would be an advance that recorded nothing.
			expect(
				h.eventsOfType('RecompositionStarted').length,
				`BeginRecomposition from ${state} must emit a RecompositionStarted`
			).toBe(before + 1);
		}

		expect(
			unreachable,
			'the contract declares a BeginRecomposition source state this test cannot reach, so the sweep would ' +
				'silently skip it — teach `driveTo` how to reach it rather than dropping it: ' +
				unreachable.join(', ')
		).toEqual([]);
		expect(
			refused,
			'BeginRecomposition REFUSED a source state the contract declares as a legitimate in-arrow to ' +
				'EVALUATING. No separate re-evaluation command exists, so refusing one of these withdraws the ' +
				're-evaluation capability entirely for that state. Offending member(s): ' +
				refused.join(', ')
		).toEqual([]);
	});

	it('CONTROL — the guard still REFUSES a state the contract does NOT declare (EVALUATING, the true NOOP)', () => {
		// Without this, a precondition that admitted EVERYTHING would satisfy the sweep above. EVALUATING is the one
		// re-issue the site's own comment calls "the only NOOP, and it is refused"; it is deliberately absent from
		// the declared source set, which this control re-derives rather than assumes.
		expect(
			SOURCE_STATES,
			'the control is only meaningful while EVALUATING is OUTSIDE the declared source set'
		).not.toContain('EVALUATING');

		const h = driveTo('READY')!;
		begin(h);
		expect(h.statusOf(RCP)).toBe('EVALUATING');

		const again = h.d('BeginRecomposition', RCP, 'RECOMPOSITION_CONTRACT', {
			recompositionContractId: RCP
		});
		expect(again.status, 'a re-issue from EVALUATING is the true NOOP and must be refused').toBe(
			'REJECTED'
		);
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(
			h.eventsOfType('RecompositionStarted'),
			'the refused NOOP must not have appended a second RecompositionStarted'
		).toHaveLength(1);
	});
});
