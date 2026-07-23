// Drives the PWU lifecycle machine LIVE. Proves: ProposePwu requires an intent (PWU-002); the authored path
// PROPOSED -> SHAPING -> READY; the controller's ChangePwuState advancing a derived state (READY -> PLANNED)
// AND rejecting an illegal lifecycle jump (PROPOSED -> SATISFIED — the canAdvanceWorkLifecycle guard is wired),
// a stale previousState, and an illegal sub-axis jump (executionState NOT_PLANNED -> RUNNING skipping QUEUED).
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedPolicy } from './__tests__/floor-fixtures.js';

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
		seedPolicy(engine, 'pol_fitness_for_purpose'); // assessments below cite pol_fitness_for_purpose — now it must exist
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

	/** Run a real assessment over `subject` and complete it SATISFIED; returns its id, ready to cite. Since
	 *  Increment 26 a disposition may not be asserted, so any test that needs an assured PWU has to produce one. */
	function satisfiedAssessmentFor(subject: string, assessmentId: string): string {
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
					subjectObjectIds: [subject],
					subjectSemanticVersions: { [subject]: 1 },
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
						subjectObjectIds: [subject],
						subjectSemanticVersions: { [subject]: 1 },
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
		return assessmentId;
	}

	/** Run a real execution plan for `subject` and complete its step; returns the plan id, ready to cite. Since
	 *  Increment 28 `executionState: SUCCEEDED` may not be asserted, so any test that needs executed work has to
	 *  actually execute it.
	 *
	 *  The step is HUMAN_INTERACTION, and that is a substantive choice rather than a convenience: the de minimis
	 *  floor gate in completeExecutionStep derives `aiProduced` FROM THE STEP, and a MODEL_INVOCATION would
	 *  (correctly) require a satisfied Reasoning Review over its output before it could succeed. This fixture's
	 *  actor is a human, so claiming a model invocation here would be a lie told to dodge a real guard. The
	 *  AI-produced path with its floor is exercised for real in rph-engine's reference undertaking. */
	function succeededPlanFor(subject: string, planId: string): string {
		const stepId = 'stp_01ARZ3NDEKTSV4RRFFQ69G5V00';
		const plan = (t: string, payload: unknown): DomainCommand =>
			cmd(t, payload, { targetAggregateId: planId, targetAggregateType: 'EXECUTION_PLAN' });
		const ok = (r: { status: string; error?: { message?: string } }, what: string): void => {
			expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		};
		ok(
			engine.dispatch(
				plan('ProposeExecutionPlan', {
					executionPlanId: planId,
					workUnitId: subject,
					steps: [
						{
							id: stepId,
							executionPlanId: planId,
							stepType: 'HUMAN_INTERACTION',
							purpose: 'Produce the expected output',
							inputBindings: [],
							outputBindings: [],
							preconditions: [],
							postconditions: [],
							stepState: 'QUEUED'
						}
					],
					transitions: [],
					retryPolicy: {},
					tacticalChangePolicy: {},
					escalationPolicy: {},
					terminationPolicy: {}
				})
			),
			'ProposeExecutionPlan'
		);
		ok(engine.dispatch(plan('ApproveExecutionPlan', {})), 'ApproveExecutionPlan');
		ok(
			engine.dispatch(plan('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] })),
			'ActivateExecutionPlan'
		);
		ok(engine.dispatch(plan('StartExecutionStep', { stepId })), 'StartExecutionStep');
		// The step's output must be a RECORDED object, not an id: completeExecutionStep rejects a step that
		// "names result(s) that are not recorded objects ... an unrecorded output cannot be assured". An invented
		// artifact id was the first thing tried here, and the guard caught it — the same dangling-reference
		// defect this effort has been cataloguing elsewhere is already enforced at this boundary.
		const evidenceId = 'evd_01ARZ3NDEKTSV4RRFFQ69G5V20';
		ok(
			engine.dispatch(
				cmd(
					'ProposeEvidence',
					{
						evidenceId,
						evidenceType: 'ARTIFACT',
						contentReference: { kind: 'INLINE', note: 'the produced output' },
						producedBy: actor,
						supportsClaimIds: [],
						contradictsClaimIds: [],
						scope: 'test',
						limitations: [],
						capturedAt: TS
					},
					{ targetAggregateId: evidenceId, targetAggregateType: 'EVIDENCE' }
				)
			),
			'ProposeEvidence'
		);
		ok(
			engine.dispatch(
				plan('CompleteExecutionStep', {
					executionStepId: stepId,
					executionAttemptId: 'ata_01ARZ3NDEKTSV4RRFFQ69G5V10',
					resultStatus: 'SUCCEEDED',
					outputArtifactIds: [],
					proposedEvidenceIds: [evidenceId],
					detectedAssumptionIds: [],
					structuredResult: {},
					executionProvenance: {}
				})
			),
			'CompleteExecutionStep'
		);
		return planId;
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

	it('MarkPwuReady rejects a STALE expectedSemanticVersion — the dead staleness guard now fires (contract-drift correctness)', () => {
		seedIntent();
		expect(engine.dispatch(cmd('ProposePwu', proposePayload())).status).toBe('ACCEPTED');
		expect(engine.dispatch(cmd('BeginPwuShaping', {})).status).toBe('ACCEPTED');
		// The PWU is at semantic version 1; a caller attesting readiness of version 2 reviewed a shape that does not
		// exist. Before the fix this was silently ACCEPTED (the field was validated then ignored).
		const r = engine.dispatch(
			cmd('MarkPwuReady', { shapeReadinessAssessmentId: 'assess_x', expectedSemanticVersion: 2 })
		);
		expect(r.status).toBe('CONFLICT');
		expect(r.error?.code).toBe('RPH_REVISION_CONFLICT');
		expect(lifecycle()).toBe('SHAPING'); // unchanged — the stale attestation did not advance the PWU
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
		const planId = succeededPlanFor(PWU_ID, 'exp_01ARZ3NDEKTSV4RRFFQ69G5V30');
		step({ previousState: 'READY', newState: 'PLANNED', executionState: 'PLANNED' });
		step({ previousState: 'PLANNED', newState: 'EXECUTING', executionState: 'QUEUED' });
		step({ previousState: 'EXECUTING', newState: 'EXECUTING', executionState: 'RUNNING' });
		step({
			previousState: 'EXECUTING',
			newState: 'EVIDENCE_PENDING',
			executionState: 'SUCCEEDED',
			assuranceState: 'EVIDENCE_REQUIRED',
			supportingObjectIds: [planId]
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
		const assessmentId = satisfiedAssessmentFor(PWU_ID, 'asm_01ARZ3NDEKTSV4RRFFQ69G5X00');

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

	// DOC-002 §8.1: "SATISFIED/RECOMPOSED | Promote baseline | BASELINED | Authorized promotion decision".
	// The demo seed drove its Architecture PWU to BASELINED with no Baseline object at all, while a test named
	// "freezes the Architecture PWU into an authoritative baseline" stayed green — the same asserted-fact defect
	// as the assurance axis, one axis over, and contra ratified RPH-BAS-004.
	it('BASELINED may not be asserted: a genuinely SATISFIED PWU still cannot freeze itself', () => {
		// The PWU must first reach SATISFIED **for real** — with an assessment behind it, since Increment 26 —
		// because SATISFIED -> BASELINED is the only arrow into BASELINED. A test that tried it from READY would
		// be answered by the LEGALITY check and would never reach this guard, proving nothing (the same trap the
		// disposition tests above had to avoid).
		seedIntent();
		engine.dispatch(cmd('ProposePwu', proposePayload()));
		engine.dispatch(cmd('BeginPwuShaping', {}));
		engine.dispatch(
			cmd('MarkPwuReady', { shapeReadinessAssessmentId: 'assess_x', expectedSemanticVersion: 1 })
		);
		const assessmentId = satisfiedAssessmentFor(PWU_ID, 'asm_01ARZ3NDEKTSV4RRFFQ69G5W00');
		const step = (over: Record<string, unknown>): void => {
			const r = engine.dispatch(change(over));
			expect(r.status, `setup failed: ${r.error?.message}`).toBe('ACCEPTED');
		};
		const planId = succeededPlanFor(PWU_ID, 'exp_01ARZ3NDEKTSV4RRFFQ69G5V40');
		step({ previousState: 'READY', newState: 'PLANNED', executionState: 'PLANNED' });
		step({ previousState: 'PLANNED', newState: 'EXECUTING', executionState: 'QUEUED' });
		step({ previousState: 'EXECUTING', newState: 'EXECUTING', executionState: 'RUNNING' });
		step({
			previousState: 'EXECUTING',
			newState: 'EVIDENCE_PENDING',
			executionState: 'SUCCEEDED',
			assuranceState: 'EVIDENCE_REQUIRED',
			supportingObjectIds: [planId]
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
		step({
			previousState: 'UNDER_ASSURANCE',
			newState: 'SATISFIED',
			executionState: 'SUCCEEDED',
			assuranceState: 'SATISFIED',
			supportingObjectIds: [assessmentId]
		});
		expect(lifecycle()).toBe('SATISFIED');

		// Fully assured, evidence admitted, verdict cited — and STILL not entitled to call itself authoritative.
		// Baselining is a governance act (§8.1: "Authorized promotion decision"), not a reward for being assured.
		const r = engine.dispatch(
			change({
				previousState: 'SATISFIED',
				newState: 'BASELINED',
				executionState: 'SUCCEEDED',
				assuranceState: 'SATISFIED',
				supportingObjectIds: [assessmentId]
			})
		);
		expect(r.status, 'assurance is not authority; a PWU may not baseline itself').toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_EVIDENCE_MISSING');
		expect(r.error?.message).toContain('no promoted baseline');
		expect(lifecycle(), 'the PWU must not have moved').toBe('SATISFIED');
	});

	// The isolating case for the third guard. The two tests above now cite a real plan, so they pass with the
	// guard deleted — mutation proved they prove nothing about it. This one asserts SUCCEEDED with nothing behind
	// it, and RUNNING -> SUCCEEDED IS a legal arrow on PWU.executionState, so only the guard stands in the way.
	it('execution success may not be asserted: SUCCEEDED with no succeeded step is refused', () => {
		seedIntent();
		engine.dispatch(cmd('ProposePwu', proposePayload()));
		engine.dispatch(cmd('BeginPwuShaping', {}));
		engine.dispatch(
			cmd('MarkPwuReady', { shapeReadinessAssessmentId: 'assess_x', expectedSemanticVersion: 1 })
		);
		const step = (over: Record<string, unknown>): void => {
			const r = engine.dispatch(change(over));
			expect(r.status, `setup failed: ${r.error?.message}`).toBe('ACCEPTED');
		};
		// Scheduling facts the controller legitimately owns — no plan needed, and none demanded.
		step({ previousState: 'READY', newState: 'PLANNED', executionState: 'PLANNED' });
		step({ previousState: 'PLANNED', newState: 'EXECUTING', executionState: 'QUEUED' });
		step({ previousState: 'EXECUTING', newState: 'EXECUTING', executionState: 'RUNNING' });

		// The claim that the work SUCCEEDED — the premise RPH-PWU-006's Given opens with. No plan, no step, no
		// output, nothing to point at.
		const r = engine.dispatch(
			change({
				previousState: 'EXECUTING',
				newState: 'EXECUTING',
				executionState: 'SUCCEEDED'
			})
		);
		expect(r.status, 'the controller may not declare work successful').toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_EVIDENCE_MISSING');
		expect(r.error?.message).toContain('no succeeded execution step');
		const axes = store.loadObject(PWU_ID)?.state as { executionState: string };
		expect(axes.executionState, 'the axis must not have moved').toBe('RUNNING');
	});

	it("execution success may not be BORROWED: another PWU's succeeded plan does not back this one", () => {
		seedIntent();
		engine.dispatch(cmd('ProposePwu', proposePayload()));
		engine.dispatch(cmd('BeginPwuShaping', {}));
		engine.dispatch(
			cmd('MarkPwuReady', { shapeReadinessAssessmentId: 'assess_x', expectedSemanticVersion: 1 })
		);
		// A genuinely succeeded plan — for somebody else's work unit. The other PWU has to be real:
		// ProposeExecutionPlan already refuses to plan work that does not exist.
		const other = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5T00';
		expect(
			engine.dispatch(
				cmd(
					'ProposePwu',
					{ ...proposePayload(), pwuId: other, title: 'Someone Else' },
					{ targetAggregateId: other }
				)
			).status
		).toBe('ACCEPTED');
		const planId = succeededPlanFor(other, 'exp_01ARZ3NDEKTSV4RRFFQ69G5T10');
		const step = (over: Record<string, unknown>): void => {
			expect(engine.dispatch(change(over)).status).toBe('ACCEPTED');
		};
		step({ previousState: 'READY', newState: 'PLANNED', executionState: 'PLANNED' });
		step({ previousState: 'PLANNED', newState: 'EXECUTING', executionState: 'QUEUED' });
		step({ previousState: 'EXECUTING', newState: 'EXECUTING', executionState: 'RUNNING' });
		const r = engine.dispatch(
			change({
				previousState: 'EXECUTING',
				newState: 'EXECUTING',
				executionState: 'SUCCEEDED',
				supportingObjectIds: [planId]
			})
		);
		expect(r.status, "another PWU's work is not this PWU's work").toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_EVIDENCE_MISSING');
	});

	// Increment 29. All five authored PWU lifecycle events DECLARE `workLifecycleState` in their payload schema
	// and every one emitted `command.payload` instead — so PwuShapingStarted, whose command payload is `{}`,
	// recorded literally nothing about the transition it exists to record. They pass the (d2) event gate because
	// it enforces RATIFIED payloads only and these are UNRATIFIED-AUTHORED: correct scope, and this is its cost.
	//
	// This test is here because RPH-PER-006 does NOT catch it — verified by mutation: revert the fix and
	// replay-equivalence still passes, because that property compares the CURRENT state and later events
	// overwrite the axis. So the two are not connected, and it would have been easy to imply they were. An
	// intermediate state that the log fails to record is invisible to a current-state property, and visible only
	// to a test that looks at the event itself.
	it('the authored lifecycle events carry the state they declare (the log must not need a reducer to guess)', () => {
		seedIntent();
		engine.dispatch(cmd('ProposePwu', proposePayload()));
		engine.dispatch(cmd('BeginPwuShaping', {}));
		const started = store
			.readAggregateEvents('PROFESSIONAL_WORK_UNIT', PWU_ID)
			.find((e) => e.eventType === 'PwuShapingStarted');
		expect(started, 'BeginPwuShaping emitted no PwuShapingStarted').toBeDefined();
		expect(
			(started!.payload as { workLifecycleState?: string }).workLifecycleState,
			'PwuShapingStarted declares workLifecycleState; an event that declares a field and ships nothing is a hole in the governed stream'
		).toBe('SHAPING');
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

	// JAN-CMDPRE DWP-02 (DS-001 D10) — the vacuity precondition. ChangePwuState drives every arrow on four machines
	// PLUS every hold, so no state SET can express "must move something"; the rule is a PREDICATE. Read the axes
	// live so the fixture cannot drift out from under the assertions.
	function readyAxes(): {
		workLifecycleState: string;
		executionState: string;
		assuranceState: string;
		shapeIntegrityState: string;
	} {
		seedIntent();
		engine.dispatch(cmd('ProposePwu', proposePayload()));
		engine.dispatch(cmd('BeginPwuShaping', {}));
		engine.dispatch(
			cmd('MarkPwuReady', { shapeReadinessAssessmentId: 'a', expectedSemanticVersion: 1 })
		);
		const s = store.loadObject(PWU_ID)?.state as {
			workLifecycleState: string;
			executionState: string;
			assuranceState: string;
			shapeIntegrityState: string;
		};
		return {
			workLifecycleState: s.workLifecycleState,
			executionState: s.executionState,
			assuranceState: s.assuranceState,
			shapeIntegrityState: s.shapeIntegrityState
		};
	}

	it('ChangePwuState REFUSES an all-four-axes-equal re-issue and appends no event (DWP-02 vacuity)', () => {
		const a = readyAxes();
		const changed = () => store.readAllEvents().filter((e) => e.eventType === 'PwuStateChanged');
		const before = changed().length;
		const rev = store.loadObject(PWU_ID)?.revision;

		const r = engine.dispatch(
			change({
				previousState: a.workLifecycleState,
				newState: a.workLifecycleState,
				executionState: a.executionState,
				assuranceState: a.assuranceState,
				shapeIntegrityState: a.shapeIntegrityState
			})
		);

		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(r.error?.message).toContain('all four axes');
		// The message names every axis compared (roadmap requirement), not just "no change".
		expect(r.error?.message).toContain('workLifecycle=');
		expect(r.error?.message).toContain('shapeIntegrity=');
		expect(changed()).toHaveLength(before); // no contradicting second event
		expect(store.loadObject(PWU_ID)?.revision).toBe(rev); // no silent revision bump
	});

	it('ChangePwuState ACCEPTS a hold that advances a SINGLE orthogonal axis (the dominant seed case)', () => {
		const a = readyAxes();
		expect(a.assuranceState).toBe('UNASSESSED'); // guard the fixture: the move below must be a real change
		// Hold workLifecycle/execution/shapeIntegrity; move ONLY assuranceState along its own legal arrow.
		const r = engine.dispatch(
			change({
				previousState: a.workLifecycleState,
				newState: a.workLifecycleState,
				executionState: a.executionState,
				assuranceState: 'EVIDENCE_REQUIRED',
				shapeIntegrityState: a.shapeIntegrityState
			})
		);
		expect(r.status, r.error?.message).toBe('ACCEPTED');
		expect((store.loadObject(PWU_ID)?.state as Record<string, string>).assuranceState).toBe(
			'EVIDENCE_REQUIRED'
		);
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
