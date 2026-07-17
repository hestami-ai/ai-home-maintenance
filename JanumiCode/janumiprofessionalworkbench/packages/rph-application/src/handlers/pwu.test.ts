// Drives the PWU lifecycle machine LIVE. Proves: ProposePwu requires an intent (PWU-002); the authored path
// PROPOSED -> SHAPING -> READY; the controller's ChangePwuState advancing a derived state (READY -> PLANNED)
// AND rejecting an illegal lifecycle jump (PROPOSED -> SATISFIED — the canAdvanceWorkLifecycle guard is wired),
// a stale previousState, and an illegal sub-axis jump (executionState NOT_PLANNED -> RUNNING skipping QUEUED).
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'user-1', actorType: 'HUMAN' as const, displayName: 'Alice' };
const INTENT_ID = 'int_01ARZ3NDEKTSV4RRFFQ69G5FAV';
const PWU_ID = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5FB0';

describe('PWU lifecycle handlers (live command drive)', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `evt_${++seq}` });
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
			targetAggregateType: 'PROFESSIONAL_WORK_UNIT',
			targetAggregateId: PWU_ID,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'corr-1',
			idempotencyKey: `idem-${n}`,
			payload,
			...over
		};
	}

	// Matures the Intent to PROVISIONAL along the ratified DOC-002 §6.2 path (RAW -> UNDER_DISCOVERY ->
	// PROVISIONAL). This is fixture PREMISE, not subject: DOC-002 §6.3 L472 — "A root PWU cannot enter
	// `READY` unless its intent is at least `PROVISIONAL`" — so a fixture that drove a root PWU to READY
	// behind a RAW intent was asserting something the ratified model forbids. The subjects below (the
	// authored PROPOSED -> SHAPING -> READY path, and the ChangePwuState guards) are unchanged.
	function seedIntent(): void {
		const intent = (commandType: string, payload: unknown): DomainCommand =>
			cmd(commandType, payload, {
				targetAggregateId: INTENT_ID,
				targetAggregateType: 'INTENT'
			});
		engine.dispatch(
			intent('CaptureIntent', {
				intentId: INTENT_ID,
				originatingExpression: 'Build a field service management SaaS',
				ontologyId: 'product-realization-pwa',
				ontologyVersion: '1.3.0'
			})
		);
		engine.dispatch(intent('BeginIntentDiscovery', {}));
		engine.dispatch(intent('ProvisionIntent', { ambiguityIds: [] }));
	}

	// A PWU shaped well enough to be marked READY: DOC-002 §9.1 requires an in-scope statement, an
	// out-of-scope statement (or an explicit "not yet known"), and an expected output. The empty
	// boundaries/outputs this fixture used to carry made it unready by the ratified §9 contract, so
	// marking it READY was a false premise rather than a property of the lifecycle under test.
	function proposePayload() {
		return {
			pwuId: PWU_ID,
			pwuKind: 'ARCHITECTURE',
			title: 'Architecture Definition',
			description: 'Define a coherent technical structure',
			intentId: INTENT_ID,
			boundaries: {
				inScope: ['service architecture and module boundaries'],
				outOfScope: ['vendor selection'],
				permittedChanges: [],
				prohibitedChanges: []
			},
			obligationIds: [],
			constraintIds: [],
			assumptionIds: [],
			expectedOutputs: [{ outputId: 'out_architecture_definition', kind: 'DOCUMENT' }],
			assurancePolicyIds: [],
			riskProfile: {
				consequence: 'MEDIUM',
				uncertainty: 'MEDIUM',
				irreversibility: 'LOW',
				securitySensitivity: 'LOW',
				regulatoryExposure: 'NONE'
			}
		};
	}

	function lifecycle(): string {
		return (store.loadObject(PWU_ID)?.state as { workLifecycleState: string }).workLifecycleState;
	}

	/** Walk the assurance axis UNASSESSED -> EVIDENCE_REQUIRED -> READY_FOR_ASSESSMENT -> ASSESSING while the
	 *  workLifecycle axis HOLDS at READY. Every hop is a legal arrow on PWU.assuranceState — which is precisely
	 *  why legality alone never protected anything. */
	function walkAssuranceToAssessing(): void {
		for (const assuranceState of ['EVIDENCE_REQUIRED', 'READY_FOR_ASSESSMENT', 'ASSESSING']) {
			const r = engine.dispatch(
				change({
					previousState: 'READY',
					newState: 'READY',
					executionState: 'NOT_PLANNED',
					assuranceState
				})
			);
			expect(r.status, `walk to ${assuranceState} failed: ${r.error?.message}`).toBe('ACCEPTED');
		}
	}

	function change(over: Record<string, unknown>): DomainCommand {
		return cmd('ChangePwuState', {
			previousState: 'READY',
			newState: 'PLANNED',
			executionState: 'PLANNED',
			assuranceState: 'UNASSESSED',
			shapeIntegrityState: 'UNKNOWN',
			reasonCode: 'CONTROLLER',
			supportingObjectIds: [],
			...over
		});
	}

	it('ProposePwu requires an existing intent (PWU-002)', () => {
		const r = engine.dispatch(cmd('ProposePwu', proposePayload()));
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
	});

	it('drives PROPOSED -> SHAPING -> READY and advances READY -> PLANNED via ChangePwuState', () => {
		seedIntent();
		expect(engine.dispatch(cmd('ProposePwu', proposePayload())).status).toBe('ACCEPTED');
		expect(lifecycle()).toBe('PROPOSED');
		expect(engine.dispatch(cmd('BeginPwuShaping', {})).status).toBe('ACCEPTED');
		expect(lifecycle()).toBe('SHAPING');
		expect(
			engine.dispatch(
				cmd('MarkPwuReady', { shapeReadinessAssessmentId: 'assess_x', expectedSemanticVersion: 1 })
			).status
		).toBe('ACCEPTED');
		expect(lifecycle()).toBe('READY');
		expect(engine.dispatch(change({})).status).toBe('ACCEPTED');
		expect(lifecycle()).toBe('PLANNED');
		const axes = store.loadObject(PWU_ID)?.state as { executionState: string };
		expect(axes.executionState).toBe('PLANNED');
	});

	// RETITLED 2026-07-17. This was 'ChangePwuState rejects an illegal lifecycle jump PROPOSED -> SATISFIED
	// (guard wired)'. The "(guard wired)" was an overclaim: PROPOSED -> SATISFIED is not an arrow on the machine
	// at all (DOC-002 §8.1 has no such row), so it is rejected by the LEGALITY check and would be rejected with
	// the cross-axis guard deleted entirely. Both failures return RPH_ILLEGAL_STATE_TRANSITION, so this test
	// cannot tell them apart — it proved legality and took credit for INV-5. The real thing is below.
	it('ChangePwuState rejects a lifecycle jump that is not an arrow on the machine (PROPOSED -> SATISFIED)', () => {
		seedIntent();
		engine.dispatch(cmd('ProposePwu', proposePayload()));
		const r = engine.dispatch(
			change({
				previousState: 'PROPOSED',
				newState: 'SATISFIED',
				executionState: 'NOT_PLANNED',
				assuranceState: 'UNASSESSED'
			})
		);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
	});

	// PROPERTY P1 — the headline property, end-to-end through the live pipeline. Added 2026-07-17: the cross-axis
	// guard was unit-tested in rph-domain (pwuGuards.test.ts) but NOTHING proved it was wired at the call site.
	// The one test that claimed to (above) exercised a different rejection path — verified by mutation: delete
	// the guard and rebuild, and ONLY this test goes red.
	//
	// NAMING (this codebase says "INV-5" ~10 files wide; it is not a ratified identifier — "INV-5" appears ZERO
	// times in the corpus, which carries no numbered invariant ids at all). The ratified name is the Executable
	// Invariant and Conformance Test Specification's "## Property P1 — Execution never implies assurance":
	//     "For any generated legal command sequence:  executionState = SUCCEEDED  must never alone cause:
	//      assuranceState = SATISFIED"
	//
	// Read P1 exactly: "must never ALONE cause", over "ANY generated legal command sequence". So this test does
	// not discharge P1 — one scripted path cannot discharge a property quantified over all sequences; that wants
	// a generator. What it does prove is the specific guard at the specific call site, which is the thing that
	// had no coverage.
	//
	// UNDER_ASSURANCE -> SATISFIED IS a legal arrow (DOC-002 §8.1: "UNDER_ASSURANCE | Satisfy | SATISFIED |
	// Assurance state is SATISFIED") and execution has SUCCEEDED, so only the cross-axis guard stands between
	// this command and a PWU that reads green unassured. That is what makes it the isolating case.
	it('Property P1 (call site): a LEGAL arrow to SATISFIED is refused when assurance has not satisfied, despite execution success', () => {
		seedIntent();
		engine.dispatch(cmd('ProposePwu', proposePayload()));
		engine.dispatch(cmd('BeginPwuShaping', {}));
		engine.dispatch(
			cmd('MarkPwuReady', { shapeReadinessAssessmentId: 'assess_x', expectedSemanticVersion: 1 })
		);
		// Walk the ratified §8.1 path to the edge of the decision: READY -> PLANNED -> EXECUTING ->
		// EVIDENCE_PENDING -> UNDER_ASSURANCE, with execution genuinely SUCCEEDED.
		const step = (over: Record<string, unknown>): void => {
			const r = engine.dispatch(change(over));
			expect(r.status, `setup step failed: ${r.error?.message}`).toBe('ACCEPTED');
		};
		step({ previousState: 'READY', newState: 'PLANNED', executionState: 'PLANNED' });
		step({ previousState: 'PLANNED', newState: 'EXECUTING', executionState: 'QUEUED' });
		step({ previousState: 'EXECUTING', newState: 'EXECUTING', executionState: 'RUNNING' });
		step({
			previousState: 'EXECUTING',
			newState: 'EVIDENCE_PENDING',
			executionState: 'SUCCEEDED',
			assuranceState: 'EVIDENCE_REQUIRED'
		});
		step({
			previousState: 'EVIDENCE_PENDING',
			newState: 'UNDER_ASSURANCE',
			executionState: 'SUCCEEDED',
			assuranceState: 'READY_FOR_ASSESSMENT'
		});
		step({
			previousState: 'UNDER_ASSURANCE',
			newState: 'UNDER_ASSURANCE',
			executionState: 'SUCCEEDED',
			assuranceState: 'ASSESSING'
		});

		// The attempt: claim SATISFIED while the assessment is still ASSESSING. Execution succeeded — the work is
		// "done". INV-5 says done is not assured.
		const r = engine.dispatch(
			change({
				previousState: 'UNDER_ASSURANCE',
				newState: 'SATISFIED',
				executionState: 'SUCCEEDED',
				assuranceState: 'ASSESSING'
			})
		);
		expect(r.status, 'execution success must never imply assurance').toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(r.error?.message).toContain('cross-axis guard');
		expect(lifecycle(), 'the PWU must not have moved').toBe('UNDER_ASSURANCE');

		// And the same arrow IS permitted once assurance actually satisfies — otherwise the test above could pass
		// because the arrow is simply unreachable, which would prove nothing.
		//
		// This half USED TO fabricate the verdict: it set assuranceState: 'SATISFIED' directly, with nothing
		// behind it. The rejectUnbackedDisposition guard (added the same day) caught it — a test written to
		// prove the system refuses fabricated verdicts, itself fabricating one. So satisfy it honestly: run a
		// real assessment over this PWU and cite it.
		const assessmentId = 'asm_01ARZ3NDEKTSV4RRFFQ69G5X00';
		const assess = (t: string, payload: unknown): DomainCommand =>
			cmd(t, payload, {
				targetAggregateId: assessmentId,
				targetAggregateType: 'ASSURANCE_ASSESSMENT'
			});
		expect(
			engine.dispatch(
				assess('RequestAssuranceAssessment', {
					assessmentId,
					assurancePolicyId: 'pol_fitness_for_purpose',
					policyVersion: '1.0.0',
					subjectObjectIds: [PWU_ID],
					subjectSemanticVersions: { [PWU_ID]: 1 },
					claimIds: []
				})
			).status
		).toBe('ACCEPTED');
		expect(
			engine.dispatch(
				assess('CompleteAssuranceAssessment', {
					validatorResult: {
						validatorId: 'test.reviewer',
						validatorVersion: '1',
						policyId: 'pol_fitness_for_purpose',
						policyVersion: '1.0.0',
						assessmentId,
						subjectObjectIds: [PWU_ID],
						subjectSemanticVersions: { [PWU_ID]: 1 },
						claimResults: [],
						evidenceConsideredIds: [],
						evidenceRejected: [],
						observations: [],
						dispositionRecommendation: 'SATISFIED',
						recommendedControlActions: [],
						residualUncertainty: [],
						limitations: [],
						executionProvenance: {}
					}
				})
			).status
		).toBe('ACCEPTED');

		const ok = engine.dispatch(
			change({
				previousState: 'UNDER_ASSURANCE',
				newState: 'SATISFIED',
				executionState: 'SUCCEEDED',
				assuranceState: 'SATISFIED',
				supportingObjectIds: [assessmentId]
			})
		);
		expect(ok.status, ok.error?.message).toBe('ACCEPTED');
		expect(lifecycle()).toBe('SATISFIED');
	});

	// The guard that makes Increment 25 structural rather than conventional. Before it, the seed told the truth
	// only because it chose to; a caller could assert any disposition and the engine would take its word.
	it('a disposition may not be ASSERTED: SATISFIED with no assessment behind it is refused', () => {
		seedIntent();
		engine.dispatch(cmd('ProposePwu', proposePayload()));
		engine.dispatch(cmd('BeginPwuShaping', {}));
		engine.dispatch(
			cmd('MarkPwuReady', { shapeReadinessAssessmentId: 'assess_x', expectedSemanticVersion: 1 })
		);
		// THE ACTUAL ATTACK, which is why a naive version of this test proves nothing: a DIRECT
		// UNASSESSED -> SATISFIED jump is refused by the LEGALITY check (no such arrow), so it never reaches the
		// guard. The hole was always "one legal hop at a time" — walk the assurance axis to ASSESSING, each hop
		// a real arrow on the machine, then claim the verdict. Legality was never the obstacle.
		walkAssuranceToAssessing();
		const r = engine.dispatch(
			change({
				previousState: 'READY',
				newState: 'READY',
				executionState: 'NOT_PLANNED',
				assuranceState: 'SATISFIED'
			})
		);
		expect(r.status, 'the controller may not assign itself a verdict').toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_EVIDENCE_MISSING');
		expect(r.error?.message).toContain('nothing to back it');
	});

	it('a disposition may not be BORROWED: an assessment of a DIFFERENT subject does not back this PWU', () => {
		seedIntent();
		engine.dispatch(cmd('ProposePwu', proposePayload()));
		engine.dispatch(cmd('BeginPwuShaping', {}));
		engine.dispatch(
			cmd('MarkPwuReady', { shapeReadinessAssessmentId: 'assess_x', expectedSemanticVersion: 1 })
		);
		// A real, genuinely SATISFIED assessment — of somebody else. Citing it must not launder this PWU green.
		const other = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5Z00';
		const assessmentId = 'asm_01ARZ3NDEKTSV4RRFFQ69G5Y00';
		const assess = (t: string, payload: unknown): DomainCommand =>
			cmd(t, payload, {
				targetAggregateId: assessmentId,
				targetAggregateType: 'ASSURANCE_ASSESSMENT'
			});
		engine.dispatch(
			assess('RequestAssuranceAssessment', {
				assessmentId,
				assurancePolicyId: 'pol_fitness_for_purpose',
				policyVersion: '1.0.0',
				subjectObjectIds: [other],
				subjectSemanticVersions: { [other]: 1 },
				claimIds: []
			})
		);
		engine.dispatch(
			assess('CompleteAssuranceAssessment', {
				validatorResult: {
					validatorId: 'test.reviewer',
					validatorVersion: '1',
					policyId: 'pol_fitness_for_purpose',
					policyVersion: '1.0.0',
					assessmentId,
					subjectObjectIds: [other],
					subjectSemanticVersions: { [other]: 1 },
					claimResults: [],
					evidenceConsideredIds: [],
					evidenceRejected: [],
					observations: [],
					dispositionRecommendation: 'SATISFIED',
					recommendedControlActions: [],
					residualUncertainty: [],
					limitations: [],
					executionProvenance: {}
				}
			})
		);
		walkAssuranceToAssessing();
		const r = engine.dispatch(
			change({
				previousState: 'READY',
				newState: 'READY',
				executionState: 'NOT_PLANNED',
				assuranceState: 'SATISFIED',
				supportingObjectIds: [assessmentId]
			})
		);
		expect(r.status, "another PWU's verdict is not this PWU's verdict (§37 affected objects)").toBe(
			'REJECTED'
		);
		expect(r.error?.code).toBe('RPH_EVIDENCE_MISSING');
	});

	it('ChangePwuState rejects a stale previousState', () => {
		seedIntent();
		engine.dispatch(cmd('ProposePwu', proposePayload()));
		// current is PROPOSED, but we claim READY
		const r = engine.dispatch(change({}));
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
	});

	it('ChangePwuState rejects an illegal sub-axis jump (executionState NOT_PLANNED -> RUNNING)', () => {
		seedIntent();
		engine.dispatch(cmd('ProposePwu', proposePayload()));
		engine.dispatch(cmd('BeginPwuShaping', {}));
		engine.dispatch(
			cmd('MarkPwuReady', { shapeReadinessAssessmentId: 'a', expectedSemanticVersion: 1 })
		);
		const r = engine.dispatch(change({ newState: 'EXECUTING', executionState: 'RUNNING' }));
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
	});

	it('SupersedePwu moves a non-baselined PWU -> SUPERSEDED', () => {
		seedIntent();
		engine.dispatch(cmd('ProposePwu', proposePayload()));
		expect(engine.dispatch(cmd('SupersedePwu', { supersedingWorkUnitId: 'pwu_new' })).status).toBe(
			'ACCEPTED'
		);
		expect(lifecycle()).toBe('SUPERSEDED');
	});
});
