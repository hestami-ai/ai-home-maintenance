// REG-F-085 — the two PWU recomposition arrows are performable by ANYONE, with NOTHING cited. Pinned as a DEFECT.
//
// ⚠ READ THE LABEL BEFORE THE ASSERTIONS. Every `ACCEPTED` below records something this repository considers
// WRONG. This file is a characterization pin, not an approval: it exists so the ungoverned behaviour cannot be
// fixed silently, and so that fixing it FORCES the register entry to be revisited rather than left stale.
//
// WHY IT EXISTS AT ALL. Scoping W-4.6 I wrote into the register that neither arrow was performable — reasoning
// from the ratified machine, where `RECOMPOSING -> RECOMPOSED` is guarded on *"Recomposition contract satisfied"*
// and the only arrow into contract `SATISFIED` is one C-0b already calls ARROW_UNREACHABLE. Then I drove the
// engine. Both hops are ACCEPTED with `reasonCode: 'CONTROLLER'` and `supportingObjectIds: []`. The guard is
// ratified and enforced by nothing; `RECOMPOSING`/`RECOMPOSED` are absent from `PWU_SEMANTIC_LIFECYCLE_COMMANDS`,
// so the generic setter is never refused, and no substance check in `changePwuState` branches on either state.
//
// **C-0b HAD THIS RIGHT THE WHOLE TIME** — both guards sit in the ledger as UNENFORCED, not ARROW_UNREACHABLE. I
// nearly filed a finding contradicted by my own control. The last assertion here ties the two records together so
// that enforcing the guard without moving the ledger row (or the reverse) reddens.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { Engine } from '@janumipwb/rph-application';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const TS = '2026-08-09T00:00:00Z';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69H9200';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H9210';

describe('REG-F-085 — PWU recomposition arrows are ungoverned (pinned defect)', () => {
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

	it('PINNED DEFECT — SATISFIED -> RECOMPOSING is ACCEPTED with no contract and no parent named', async () => {
		const { store, setter } = arrange();
		const { seedPwuWorkLifecycleState_FIXTURE } = await import(
			'../packages/rph-application/src/handlers/__tests__/pwu-fixtures.js'
		);
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'SATISFIED');
		// The ratified guard is "Parent exists and recomposition is required". Nothing loads a parent, and nothing
		// establishes that recomposition is required. Both facts are simply absent from the write path.
		const r = setter('SATISFIED', 'RECOMPOSING');
		expect(r.status, 'if this is now REJECTED the defect is FIXED — update REG-F-085').toBe(
			'ACCEPTED'
		);
	});

	it('PINNED DEFECT — RECOMPOSING -> RECOMPOSED is ACCEPTED though no contract can reach SATISFIED', async () => {
		const { store, setter } = arrange();
		const { seedPwuWorkLifecycleState_FIXTURE } = await import(
			'../packages/rph-application/src/handlers/__tests__/pwu-fixtures.js'
		);
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'RECOMPOSING');
		// ⚠ THE SHARPEST FORM OF IT. The guard is "Recomposition contract satisfied"; `RecompositionContract.status
		// SATISFIED` is reachable by NO command in the codebase (C-0b: ARROW_UNREACHABLE, and `completeRecomposition`
		// says so in its own comment). So the arrow's precondition is not merely unchecked — it is currently
		// IMPOSSIBLE TO SATISFY — and the arrow fires anyway, on an empty citation list.
		const r = setter('RECOMPOSING', 'RECOMPOSED');
		expect(r.status, 'if this is now REJECTED the defect is FIXED — update REG-F-085').toBe(
			'ACCEPTED'
		);
		expect((store.loadObject(PWU)!.state as Record<string, string>).workLifecycleState).toBe(
			'RECOMPOSED'
		);
	});

	// ── THE TWO RECORDS MUST AGREE ────────────────────────────────────────────────────────────────────────────
	// Runtime says ungoverned; the ledger must say UNENFORCED. Reddens if either moves without the other — which
	// is how a ledger row and the code it describes drift apart, the failure REG-F-081 caught in C-0b's anchors.
	it('CONTROL — C-0b agrees: both recomposition guards are recorded UNENFORCED', () => {
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
				`${guard}: runtime shows the arrow firing on an empty citation, so the ledger must read UNENFORCED`
			).toBe('UNENFORCED');
		}
	});
});
