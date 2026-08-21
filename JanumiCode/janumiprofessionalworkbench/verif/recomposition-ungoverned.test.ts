// REG-F-085 — the two PWU recomposition arrows are GOVERNED. ✅ CLOSED 2026-08-21 (REG-D-044 S-1b).
//
// ⚠ THIS FILE WAS A CHARACTERIZATION PIN AND IS NOW ITS OWN INVERSE, DELIBERATELY KEPT RATHER THAN DELETED.
// Every assertion below used to read `ACCEPTED` and to record something this repository considered WRONG: both
// arrows were performable by anyone with `reasonCode: 'CONTROLLER'` and `supportingObjectIds: []`. The pin
// existed *"so that fixing it FORCES the register entry to be revisited rather than left stale"* — so it is
// inverted IN PLACE, and the arrangement is kept byte-for-byte. A deleted pin proves nothing about the fix; an
// inverted one proves the exact behaviour it used to admit is now refused.
//
// WHAT CHANGED, AND WHY IT COULD NOT CHANGE SOONER. `RECOMPOSING -> RECOMPOSED` is guarded on *"Recomposition
// contract satisfied"*, and until S-1a NOTHING could drive `RecompositionContract.status` to `SATISFIED` — C-0b
// carried that arrow as ARROW_UNREACHABLE, so an honest `CompletePwuRecomposition` could never have fired.
// REG-D-044 ruled the acceptance act is the ratified `decide` verb, UNWIRED rather than absent; S-1a wired it;
// S-1b's two commands now own both arrows and enforce both ratified guards literally.
//
// **C-0b HAD THIS RIGHT THE WHOLE TIME** — both guards sat in the ledger as UNENFORCED, not ARROW_UNREACHABLE. I
// nearly filed a finding contradicted by my own control. The last assertion here still ties the two records
// together, now in the other direction: moving the code without moving the ledger row (or the reverse) reddens.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { Engine } from '@janumipwb/rph-application';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const TS = '2026-08-09T00:00:00Z';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69H9200';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H9210';

describe('REG-F-085 — PWU recomposition arrows are governed (pin inverted, CLOSED)', () => {
	function arrange() {
		const store = new SqliteStorageAdapter({ now: () => TS });
		let n = 0;
		const engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `e${++n}`
		}).as(TEST_CRED.human);
		const dispatch = (commandType: string, payload: unknown, id: string, aggType: string) =>
			engine.dispatch({
				commandId: `c${++n}`,
				commandType,
				commandSchemaVersion: 1,
				targetAggregateType: aggType,
				targetAggregateId: id,
				issuedAt: TS,
				correlationId: 'f085',
				idempotencyKey: `k${n}`,
				payload
			} as DomainCommand);
		dispatch(
			'CaptureIntent',
			{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
			INTENT,
			'INTENT'
		);
		dispatch(
			'ProposePwu',
			{
				pwuId: PWU,
				pwuKind: 'ARCHITECTURE',
				title: 'T',
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
				expectedOutputs: [{ outputId: 'o1', kind: 'DOCUMENT' }],
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
		);
		const setter = (previousState: string, newState: string) =>
			dispatch(
				'ChangePwuState',
				{
					previousState,
					newState,
					executionState: 'NOT_PLANNED',
					assuranceState: 'UNASSESSED',
					shapeIntegrityState: 'PRESERVED',
					reasonCode: 'CONTROLLER',
					supportingObjectIds: []
				},
				PWU,
				'PROFESSIONAL_WORK_UNIT'
			);
		return { store, setter };
	}

	it('SATISFIED -> RECOMPOSING is REFUSED with no contract and no parent named', async () => {
		const { store, setter } = arrange();
		const { seedPwuWorkLifecycleState_FIXTURE } = await import(
			'../packages/rph-application/src/handlers/__tests__/pwu-fixtures.js'
		);
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'SATISFIED');
		// The ratified guard is "Parent exists and recomposition is required". This dispatch names no contract and
		// no parent — exactly the citation-free call that used to be ACCEPTED. `BeginPwuRecomposition` now owns the
		// arrow, so the generic setter is refused before any guard is even consulted.
		const r = setter('SATISFIED', 'RECOMPOSING');
		expect(r.status, 'if this is ACCEPTED again the defect has REGRESSED — REG-F-085 must reopen').toBe(
			'REJECTED'
		);
		expect(r.error?.message, 'the refusal must name the command that now owns the arrow').toContain(
			'BeginPwuRecomposition'
		);
		expect(
			(store.loadObject(PWU)!.state as Record<string, string>).workLifecycleState,
			'a refused command must not move the object'
		).toBe('SATISFIED');
	});

	it('RECOMPOSING -> RECOMPOSED is REFUSED — and the contract state it names is now reachable', async () => {
		const { store, setter } = arrange();
		const { seedPwuWorkLifecycleState_FIXTURE } = await import(
			'../packages/rph-application/src/handlers/__tests__/pwu-fixtures.js'
		);
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'RECOMPOSING');
		// ⚠ THIS WAS THE SHARPEST FORM OF THE DEFECT, AND BOTH HALVES OF IT ARE GONE. The guard is "Recomposition
		// contract satisfied". `RecompositionContract.status SATISFIED` used to be reachable by NO command — so the
		// precondition was not merely unchecked, it was IMPOSSIBLE TO SATISFY — and the arrow fired anyway on an
		// empty citation list. S-1a made the state reachable (AcceptRecomposition) and S-1b made the arrow require
		// it. The setter no longer performs this hop at all.
		const r = setter('RECOMPOSING', 'RECOMPOSED');
		expect(r.status, 'if this is ACCEPTED again the defect has REGRESSED — REG-F-085 must reopen').toBe(
			'REJECTED'
		);
		expect(r.error?.message, 'the refusal must name the command that now owns the arrow').toContain(
			'CompletePwuRecomposition'
		);
		expect(
			(store.loadObject(PWU)!.state as Record<string, string>).workLifecycleState,
			'the PWU must NOT have moved — this assertion read RECOMPOSED while the defect was live'
		).toBe('RECOMPOSING');
	});

	// ── THE TWO RECORDS MUST AGREE ────────────────────────────────────────────────────────────────────────────
	// Runtime says governed; the ledger must say ENFORCED. Reddens if either moves without the other — which is
	// how a ledger row and the code it describes drift apart, the failure REG-F-081 caught in C-0b's anchors.
	//
	// ⚠ THE CONJUNCTION IS THE POINT AND IT IS WHY THIS CONTROL SURVIVES THE INVERSION. C-0b's own gate does NOT
	// force these two rows: `guard-enforcement-ledger.test.ts` states verbatim that "`UNENFORCED` needs no such
	// check: it understates, and over-admission is not a defect". So the ledger would have stayed green reading
	// UNENFORCED over enforced code. THIS assertion is the only thing that forces the ledger to follow the code.
	//
	// ⚠ AND IT LOCATES ROWS BY `indexOf`, WHICH BIT S-1a: a new row's evidence prose quoted ANOTHER row's guard
	// string, so `indexOf` landed inside the wrong row and read its disposition. Neither evidence block may
	// contain the other guard's literal text, and `disposition:` must stay inside the 400-char window below.
	it('CONTROL — C-0b agrees: both recomposition guards are recorded ENFORCED', () => {
		const ledger = readFileSync(new URL('./guard-enforcement-ledger.data.ts', import.meta.url), 'utf8');
		for (const guard of [
			'Parent exists and recomposition is required',
			'Recomposition contract satisfied'
		]) {
			const at = ledger.indexOf(guard);
			expect(at, `${guard} is not in the C-0b ledger at all`).toBeGreaterThan(-1);
			const disposition = /disposition:\s*"(\w+)"/.exec(ledger.slice(at, at + 400))?.[1];
			expect(
				disposition,
				`${guard}: runtime refuses the arrow on an empty citation, so the ledger must read ENFORCED`
			).toBe('ENFORCED');
		}
	});
});
