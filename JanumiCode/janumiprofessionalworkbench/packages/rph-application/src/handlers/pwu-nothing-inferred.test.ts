// CON-000 AX-6 AT THE PWU WRITE PATH — what this handler cannot READ it refuses; what it was not TOLD it does
// not WRITE.
//
// THE PROPERTY, AND IT IS ONE PROPERTY RATHER THAN TWO. JPWB-CON-000 AX-6: *"Professional meaning is never
// inferred from null fields, missing values, attachment, proximity, ordering, storage location, or UI
// placement."* `pwu.ts` cites that axiom twice and states both of its consequences in its own words — the guard
// *"fails closed rather than assuming maturity it cannot read"*, and *"A HANDLER THAT CANNOT EMIT A CONFORMANT
// EVENT REFUSES THE COMMAND; IT DOES NOT INVENT A VALUE"* — and then leaves both consequences unpinned. The
// absent-premise paths and the absent-field paths are precisely where that file's never-executed branches
// cluster, which is what one would expect: a suite arranges the case it is thinking about, and nobody arranges
// the missing thing.
//
// WHY IT NEEDS ITS OWN FILE. Both halves fail SILENTLY and in the direction that looks safe.
//
//   * A DEFAULTED PREMISE READS AS A SATISFIED ONE. `intentStatus: intentState?.intentStatus ?? ''` becoming
//     `?? 'PROVISIONAL'` would let a root PWU enter READY behind an Intent this engine cannot find at all, and
//     every existing readiness test would stay green, because every one of them supplies a real Intent. The
//     empty string is not a placeholder here — it is the value that satisfies no branch of
//     INTENT_AT_LEAST_PROVISIONAL, and that is the whole mechanism.
//   * A FABRICATED FIELD READS AS A RECORDED ONE. `...(p.x ? { x: p.x } : {})` losing its conditional writes
//     `x: ''` into the governed stream — well formed by construction, which is the blindness `invalidatePwu`'s
//     own struck comment diagnoses in terms: *"the gate validates the emitted event, and `''` satisfies
//     `z.string()`. A fabricated value is well-formed by construction, so malformation checks are structurally
//     blind to it."* The event gate cannot catch this class; only an assertion on the emitted payload can.
//
// ⛔ WHAT THIS FILE DELIBERATELY DOES NOT CLOSE, stated so its coverage is not read as more than it is.
//
//   * IT SAYS NOTHING ABOUT WHETHER A CITED ID RESOLVES. `challengePwu`, `reshapePwu` and `escalatePwu` perform
//     NO resolution of their optional citations — read, not assumed — so the payload cases below pin PASSTHROUGH
//     FIDELITY and nothing whatever about referential integrity. A dangling `observationIds` entry would pass
//     every assertion here, and that gap is real.
//   * THE `objectType` CONJUNCTS in `rejectUnbackedDisposition` and `rejectUnbackedExecutionSuccess` are NOT
//     pinned here, and no test in this file executes them — on purpose. `assessmentState` and `workUnitId` each
//     occur on exactly ONE object type across `rph-contracts/src/objects.ts`, so no contract-conformant decoy can
//     pass the type check and then fail the field check: deleting either conjunct changes no outcome any test
//     could observe. A test that ran those lines would assert nothing, and a branch covered by an assertion that
//     cannot fail is not covered.
//   * THE MACHINE-REFUSAL ARMS of `advancePwuLifecycle` and `unblockPwu` are UNREACHABLE rather than untested,
//     and that was DERIVED rather than eyeballed: driving every declared arrow of `PWU_LIFECYCLE_COMMAND_SPECS`
//     and `PWU_RECOVERY_COMMAND_SPECS` through `canAdvanceWorkLifecycle` under axes chosen to fail all three
//     cross-axis guards refuses NONE of them. They are fail-closed backstops against a divergence between the
//     declarations and the machine that does not exist today.
import type { ActorReference, DomainCommand, DomainEvent } from '@janumipwb/rph-contracts';
import { ProfessionalWorkUnitSchema } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedPolicy } from './__tests__/floor-fixtures.js';
import { seedPwuWorkLifecycleState_FIXTURE } from './__tests__/pwu-fixtures.js';

const TS = '2026-09-12T00:00:00Z';
const PWU_TYPE = 'PROFESSIONAL_WORK_UNIT';
const actor: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };

const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69J0000';
const BARE_INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69J0001';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69J0010';
const PWU_B = 'pwu_01ARZ3NDEKTSV4RRFFQ69J0011';
/** Never proposed. The whole point of this id is that nothing is stored under it. */
const GHOST = 'pwu_01ARZ3NDEKTSV4RRFFQ69J0099';
const POLICY = 'pol_fitness_for_purpose';

describe('CON-000 AX-6 at the PWU write path — an unreadable premise is refused, an unsupplied field is not written', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	const dispatch = (
		commandType: string,
		payload: unknown,
		id: string = PWU,
		aggType: string = PWU_TYPE
	) => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'ax6',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	};

	const ok = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		return r;
	};

	const stateOf = (id: string = PWU) =>
		store.loadObject(id)?.state as Record<string, unknown> | undefined;
	const axis = (name: string, id: string = PWU) => stateOf(id)?.[name];

	const eventsOf = (id: string = PWU): DomainEvent[] => store.readAggregateEvents(PWU_TYPE, id);
	const payloadOfLast = (eventType: string, id: string = PWU): Record<string, unknown> => {
		const found = eventsOf(id).filter((e) => e.eventType === eventType);
		expect(
			found.length,
			`no ${eventType} was emitted — the arrangement did not happen`
		).toBeGreaterThan(0);
		return found.at(-1)!.payload as Record<string, unknown>;
	};

	/** Capture -> discovery -> PROVISIONAL, so a ROOT PWU may legitimately be marked READY (DOC-002 §6.3 L472). */
	const provisionedIntent = (intentId: string, ontologyId: string, ontologyVersion: string) => {
		ok(
			dispatch(
				'CaptureIntent',
				{ intentId, originatingExpression: 'Build the thing', ontologyId, ontologyVersion },
				intentId,
				'INTENT'
			),
			'CaptureIntent'
		);
		ok(dispatch('BeginIntentDiscovery', {}, intentId, 'INTENT'), 'BeginIntentDiscovery');
		ok(dispatch('ProvisionIntent', { ambiguityIds: [] }, intentId, 'INTENT'), 'ProvisionIntent');
	};

	/** A PWU shaped well enough to clear the whole §9.1 readiness contract, so the only limb that can fail is
	 *  the one a given test deliberately breaks. */
	const proposePwu = (pwuId: string, intentId: string) =>
		dispatch(
			'ProposePwu',
			{
				pwuId,
				pwuKind: 'ARCHITECTURE',
				title: 'Architecture Definition',
				description: 'Define a coherent technical structure',
				intentId,
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
			},
			pwuId
		);

	const change = (over: Record<string, unknown>, id: string = PWU) =>
		dispatch(
			'ChangePwuState',
			{
				previousState: 'READY',
				newState: 'READY',
				executionState: 'NOT_PLANNED',
				assuranceState: 'UNASSESSED',
				shapeIntegrityState: 'UNKNOWN',
				reasonCode: 'CONTROLLER',
				supportingObjectIds: [],
				...over
			},
			id
		);

	/**
	 * Patch ONE field of the stored PWU, re-parsed against the ratified contract before it is written.
	 *
	 * ⚠ THE RE-PARSE IS NOT CEREMONY — it is `pwu-fixtures.ts`'s own rule ("a fixture able to write a shape the
	 * contract forbids is how `floor-fixtures.ts`'s own defect arose"), and it is what makes the one use of this
	 * helper honest: `ProfessionalWorkUnit.intentId` is `z.string()`, so a PWU whose intent reference points at
	 * nothing is a shape the CONTRACT PERMITS and the command surface will not mint. That is exactly the state
	 * `readinessFactsOf`'s docblock says it is defending against.
	 */
	const patchPwu = (patch: Record<string, unknown>) => {
		const stored = store.loadObject(PWU);
		expect(stored, 'patchPwu: propose the PWU first').toBeTruthy();
		const nextState = ProfessionalWorkUnitSchema.parse({
			...ProfessionalWorkUnitSchema.parse(stored!.state),
			...patch
		});
		seq += 1;
		const r = store.commit({
			aggregateType: PWU_TYPE,
			aggregateId: PWU,
			objectType: PWU_TYPE,
			expectedRevision: stored!.revision,
			newRevision: stored!.revision + 1,
			newSemanticVersion: stored!.semanticVersion,
			currentState: nextState,
			events: [],
			receipt: {
				commandId: `fixture-patchPwu-${seq}`,
				idempotencyKey: `fixture-patchPwu-${seq}`,
				commandType: 'FixturePatchPwu',
				targetAggregateId: PWU,
				status: 'ACCEPTED',
				producedEventIds: []
			}
		});
		expect(r.ok, 'patchPwu: fixture commit refused').toBe(true);
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
	});

	// ────────────────────────────────────────────────────────────────────────────────────────────────────────
	// A. AN AGGREGATE THAT DOES NOT EXIST
	// ────────────────────────────────────────────────────────────────────────────────────────────────────────

	/**
	 * Seven handlers load before they act, and NONE of the seven refusals had ever been observed.
	 *
	 * ⚠ SEVEN SITES, NOT ONE ASSERTION SEVEN TIMES. Each `if (!loaded.ok) return loaded.result` is its own line
	 * in its own handler; deleting any single one leaves the other six intact and reddens exactly one row here.
	 * What each deletion produces differs — `baselinePwu` would fall through to `baselineBacksPwu` and refuse
	 * with RPH_EVIDENCE_MISSING, `abandonPwu` would hand `undefined` to the abandon resolver — but they share
	 * the property that matters: the caller stops being told the plain truth, which is that the work does not
	 * exist. Asserting the MESSAGE rather than the code is what distinguishes this from any other semantic
	 * refusal, and those are numerous on these same paths.
	 */
	it('refuses every PWU command issued against an aggregate that does not exist, and says so in those words', () => {
		const cases: Array<[string, unknown]> = [
			['BeginPwuShaping', {}],
			['MarkPwuReady', { shapeReadinessAssessmentId: 'asr_x', expectedSemanticVersion: 1 }],
			['UnblockPwu', { recoveryReason: 'the blocker cleared' }],
			['BaselinePwu', { baselineId: 'bas_01ARZ3NDEKTSV4RRFFQ69J0020' }],
			['AbandonPwu', { abandonmentDecisionId: 'dec_01ARZ3NDEKTSV4RRFFQ69J0021' }],
			[
				'RejectPwu',
				{ rejectionDecisionId: 'dec_01ARZ3NDEKTSV4RRFFQ69J0022', blockingObservationIds: [] }
			],
			[
				'ChangePwuState',
				{
					previousState: 'PROPOSED',
					newState: 'SHAPING',
					executionState: 'NOT_PLANNED',
					assuranceState: 'UNASSESSED',
					shapeIntegrityState: 'UNKNOWN',
					reasonCode: 'CONTROLLER',
					supportingObjectIds: []
				}
			]
		];
		for (const [commandType, payload] of cases) {
			const r = dispatch(commandType, payload, GHOST);
			expect(r.status, `${commandType} against a ghost aggregate`).toBe('REJECTED');
			expect(r.error?.code, `${commandType} refusal code`).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
			expect(r.error?.message, `${commandType} must say the aggregate does not exist`).toBe(
				`Aggregate ${GHOST} does not exist`
			);
		}
		expect(store.loadObject(GHOST), 'and no refusal may have brought the ghost into being').toBe(
			undefined
		);
	});

	// ────────────────────────────────────────────────────────────────────────────────────────────────────────
	// B. A CITATION THAT NAMES NOTHING, AND A RECORD THAT CONTRADICTS THE DECLARATION
	// ────────────────────────────────────────────────────────────────────────────────────────────────────────

	/**
	 * `recompositionContractForPwu` reads `obj?.objectType` before it reads `obj.state`, and until now the
	 * first half had never run: every existing case cites a contract that EXISTS and names the wrong parent.
	 *
	 * THE MUTANT: drop the `objectType` line and `obj.state` is read off `undefined`. The dispatch stops being
	 * a governed refusal and becomes a TypeError, so the exact-message assertion below reddens. That is the
	 * whole content of the branch — not "the id is wrong" but "the id names NOTHING, and that is answered with
	 * a sentence rather than a crash".
	 */
	it('refuses BeginPwuRecomposition whose cited contract names nothing at all, naming the parent it required', () => {
		provisionedIntent(INTENT, 'product-realization-pwa', '1.3.0');
		ok(proposePwu(PWU, INTENT), 'ProposePwu');
		const r = dispatch('BeginPwuRecomposition', {
			recompositionContractId: 'rcp_01ARZ3NDEKTSV4RRFFQ69J0030'
		});
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_EVIDENCE_MISSING');
		expect(r.error?.message, 'the refusal names the citation and what it had to be').toContain(
			'rcp_01ARZ3NDEKTSV4RRFFQ69J0030 is not a RECOMPOSITION_CONTRACT whose'
		);
		expect(r.error?.message, 'and names THIS PWU as the parent the contract had to hold').toContain(
			`parentWorkUnitId is ${PWU}`
		);
		expect(axis('workLifecycleState'), 'a refused recomposition may not have started one').toBe(
			'PROPOSED'
		);
	});

	/**
	 * UnblockPwu reads the origin from `PwuBlocked.blockedFrom` and refuses to recover to a state it does not
	 * declare — and it reports that as a DISAGREEMENT rather than as an illegal transition.
	 *
	 * ⚠ THE ARRANGEMENT IS SEEDED AND THAT IS THE CASE, NOT A SHORTCUT. `BlockPwu` declares SHAPING | PLANNED |
	 * EXECUTING, so every block this command surface can mint records an origin the recovery command also
	 * declares — the limb is unreachable through the bus BY CONSTRUCTION. The state it defends is a record
	 * written by something that did not share this declaration, which is exactly what the refusal says: *"The
	 * recorded origin and the declared arrow set disagree, and that disagreement is the finding."* Same split
	 * `pwu-recomposition.test.ts` makes for the empty-composition limb, for the same reason.
	 *
	 * The synthetic event deliberately carries NO `commandId`: `verif/emitted-event-guard.ts` uses exactly that
	 * field to tell handler output from fixture events, so this one is correctly invisible to the event ledger.
	 *
	 * THE MUTANT: delete the `candidates.includes(origin)` check and the handler recovers BLOCKED -> READY, an
	 * arrow the machine has never had — refused two lines later with RPH_ILLEGAL_STATE_TRANSITION and "Cannot
	 * recover". Code and message both move, so this reddens on either assertion.
	 */
	it('refuses to unblock when the recorded blockedFrom is a state UnblockPwu does not declare, and calls it a disagreement', () => {
		provisionedIntent(INTENT, 'product-realization-pwa', '1.3.0');
		ok(proposePwu(PWU, INTENT), 'ProposePwu');
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'BLOCKED');

		const stored = store.loadObject(PWU)!;
		const newRevision = stored.revision + 1;
		const r0 = store.commit({
			aggregateType: PWU_TYPE,
			aggregateId: PWU,
			objectType: PWU_TYPE,
			expectedRevision: stored.revision,
			newRevision,
			newSemanticVersion: stored.semanticVersion,
			currentState: stored.state as Record<string, unknown>,
			events: [
				{
					eventId: 'e-fixture-blocked',
					eventType: 'PwuBlocked',
					eventSchemaVersion: 1,
					aggregateType: PWU_TYPE,
					aggregateId: PWU,
					aggregateRevision: newRevision,
					occurredAt: TS,
					recordedAt: TS,
					actor,
					correlationId: 'ax6-fixture',
					payload: {
						blockReason: 'recorded by a writer that did not share this declaration',
						blockedFrom: 'READY',
						workLifecycleState: 'BLOCKED'
					}
				}
			],
			receipt: {
				commandId: 'fixture-recordBlockOrigin',
				idempotencyKey: 'fixture-recordBlockOrigin',
				commandType: 'FixtureRecordBlockOrigin',
				targetAggregateId: PWU,
				status: 'ACCEPTED',
				producedEventIds: ['e-fixture-blocked']
			}
		});
		expect(r0.ok, 'the fixture block record was refused').toBe(true);

		const r = dispatch('UnblockPwu', { recoveryReason: 'the blocker cleared' });
		expect(r.status).toBe('REJECTED');
		expect(
			r.error?.code,
			'a contradiction between record and declaration is an INVARIANT violation'
		).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message, 'the refusal quotes the origin it actually read').toContain(
			`records blockedFrom=READY`
		);
		expect(r.error?.message, 'and enumerates what the command does claim from BLOCKED').toContain(
			'it claims [SHAPING, PLANNED, EXECUTING]'
		);
		expect(r.error?.message, 'and names the disagreement as the finding').toContain(
			'The recorded origin and the declared arrow set disagree'
		);
		expect(axis('workLifecycleState'), 'and the PWU stays blocked').toBe('BLOCKED');
	});

	// ────────────────────────────────────────────────────────────────────────────────────────────────────────
	// C. A PREMISE THE HANDLER CANNOT READ IS NOT ASSUMED
	// ────────────────────────────────────────────────────────────────────────────────────────────────────────

	/**
	 * `readinessFactsOf`'s docblock makes a promise: *"A root PWU whose Intent row is missing entirely yields
	 * intentStatus '' — which satisfies no branch of INTENT_AT_LEAST_PROVISIONAL, so the guard fails closed
	 * rather than assuming maturity it cannot read."* Nothing tested it. Every readiness case in this
	 * repository supplies an Intent that exists, so `intentState?.intentStatus ?? ''` had only ever taken the
	 * left side.
	 *
	 * ⚠ THE ASSERTION IS THE WHOLE MESSAGE, DELIBERATELY. The PWU is shaped to clear all nine other §9.1 limbs,
	 * so an exact match proves the intent-maturity limb is the ONLY one unmet — which is what distinguishes
	 * "unreadable" from "absent". A `toContain` would have been satisfied by a PWU that was simply unshaped,
	 * and the reference `${PWU}` is the reference this PWU carries: it is present, it just resolves to nothing.
	 *
	 * THE MUTANT: `?? 'PROVISIONAL'` — the single most tempting "fix" for an empty status — and the command is
	 * ACCEPTED, advancing a root PWU to READY behind an Intent the engine cannot find.
	 */
	it('refuses MarkPwuReady when the root PWU intent reference resolves to nothing, reporting an EMPTY maturity', () => {
		provisionedIntent(INTENT, 'product-realization-pwa', '1.3.0');
		ok(proposePwu(PWU, INTENT), 'ProposePwu');
		ok(dispatch('BeginPwuShaping', {}), 'BeginPwuShaping');
		// A reference the contract permits and no command will mint: present, well formed, resolving to nothing.
		patchPwu({ intentId: 'int_01ARZ3NDEKTSV4RRFFQ69J0098' });

		const r = dispatch('MarkPwuReady', {
			shapeReadinessAssessmentId: 'asr_x',
			expectedSemanticVersion: 1
		});
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(
			r.error?.message,
			'the unreadable intent must be the ONLY unmet limb, and must report an empty status'
		).toBe(
			`MarkPwuReady: PWU ${PWU} does not satisfy the shape readiness contract (DOC-002 §9): ` +
				`root PWU intent must be at least PROVISIONAL, is  (DOC-002 §6.3 L472)`
		);
		expect(axis('workLifecycleState'), 'and the PWU does not reach READY').toBe('SHAPING');
	});

	/**
	 * ── THE HEADLINE PROPERTY ON THE PATH NOBODY GUARDS: A HOLD ──────────────────────────────────────────────
	 *
	 * P1 / INV-5 says workLifecycleState may be SATISFIED only while assuranceState is SATISFIED. Every existing
	 * test drives that guard on an ADVANCE, where `canAdvanceWorkLifecycle`'s cross-axis entry enforces it. The
	 * HOLD path has its own, separate check — `rejectIllegalWorkLifecycleMove`'s `satisfiesP1(nextAxes)` — and it
	 * had never executed. It is the arm that matters most: an advance into SATISFIED happens once, while a hold
	 * at SATISFIED is what every later controller tick performs, and a withdrawal of assurance underneath a
	 * satisfied PWU arrives as exactly that.
	 *
	 * ⚠ THE ASSURANCE IS EARNED, NOT ASSIGNED. `assuranceState: SATISFIED` is reached by requesting, beginning
	 * and completing a REAL assessment over this PWU and citing it, because `rejectUnbackedDisposition` refuses
	 * anything less. Only `workLifecycleState = SATISFIED` is seeded, via the vetted fixture — the route by which
	 * this PWU became satisfied is not part of the rule under test, and driving it would need a plan, a step and
	 * evidence, every one of which could fail for a reason that has nothing to do with P1.
	 *
	 * THE MUTANT: delete the `satisfiesP1` arm and the withdrawal is ACCEPTED — the PWU sits in SATISFIED with
	 * assuranceState INVALIDATED, which is the exact state INV-5 exists to forbid.
	 */
	it('refuses a HOLD at SATISFIED once assurance is withdrawn underneath it (P1/INV-5)', () => {
		seedPolicy(engine, POLICY);
		provisionedIntent(INTENT, 'product-realization-pwa', '1.3.0');
		ok(proposePwu(PWU, INTENT), 'ProposePwu');
		ok(dispatch('BeginPwuShaping', {}), 'BeginPwuShaping');
		ok(
			dispatch('MarkPwuReady', { shapeReadinessAssessmentId: 'asr_x', expectedSemanticVersion: 1 }),
			'MarkPwuReady'
		);
		for (const assuranceState of ['EVIDENCE_REQUIRED', 'READY_FOR_ASSESSMENT', 'ASSESSING']) {
			ok(change({ assuranceState }), `walk assurance to ${assuranceState}`);
		}
		const assessmentId = 'asm_01ARZ3NDEKTSV4RRFFQ69J0040';
		const assess = (t: string, payload: unknown) =>
			dispatch(t, payload, assessmentId, 'ASSURANCE_ASSESSMENT');
		ok(
			assess('RequestAssuranceAssessment', {
				assessmentId,
				assurancePolicyId: POLICY,
				policyVersion: '1.0.0',
				subjectObjectIds: [PWU],
				subjectSemanticVersions: { [PWU]: 1 },
				claimIds: []
			}),
			'RequestAssuranceAssessment'
		);
		ok(assess('BeginAssuranceAssessment', {}), 'BeginAssuranceAssessment');
		ok(
			assess('CompleteAssuranceAssessment', {
				validatorResult: {
					validatorId: 'test.reviewer',
					validatorVersion: '1',
					policyId: POLICY,
					policyVersion: '1.0.0',
					assessmentId,
					subjectObjectIds: [PWU],
					subjectSemanticVersions: { [PWU]: 1 },
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
			}),
			'CompleteAssuranceAssessment'
		);
		ok(
			change({ assuranceState: 'SATISFIED', supportingObjectIds: [assessmentId] }),
			'the disposition, backed by a real assessment'
		);
		expect(axis('assuranceState'), 'the arrangement must actually be assured').toBe('SATISFIED');
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'SATISFIED');

		const r = change({
			previousState: 'SATISFIED',
			newState: 'SATISFIED',
			assuranceState: 'INVALIDATED'
		});
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message, 'the refusal must name the hold, the axis and the invariant').toBe(
			`PWU ${PWU} would hold in SATISFIED without assuranceState=SATISFIED (P1/INV-5)`
		);
		expect(axis('assuranceState'), 'and the withdrawal must not have landed either').toBe(
			'SATISFIED'
		);
	});

	/**
	 * CONTROL FOR THE HOLD, WITH ITS OWN MUTANT. Without it, the refusal above is equally consistent with an
	 * engine that has stopped permitting holds at SATISFIED altogether — and "a hold that advances at least one
	 * orthogonal axis is legal" is a rule `changeNothingPrecondition` states in terms.
	 *
	 * THE MUTANT THIS ONE KILLS, AND THE SUBJECT DOES NOT: widen `rejectIllegalWorkLifecycleMove`'s hold arm to
	 * refuse every hold at SATISFIED rather than only the P1-violating ones. The subject above stays green under
	 * that change; this reddens.
	 */
	it('CONTROL — the same hold at SATISFIED is permitted while assurance REMAINS satisfied', () => {
		seedPolicy(engine, POLICY);
		provisionedIntent(INTENT, 'product-realization-pwa', '1.3.0');
		ok(proposePwu(PWU, INTENT), 'ProposePwu');
		ok(dispatch('BeginPwuShaping', {}), 'BeginPwuShaping');
		ok(
			dispatch('MarkPwuReady', { shapeReadinessAssessmentId: 'asr_x', expectedSemanticVersion: 1 }),
			'MarkPwuReady'
		);
		for (const assuranceState of ['EVIDENCE_REQUIRED', 'READY_FOR_ASSESSMENT', 'ASSESSING']) {
			ok(change({ assuranceState }), `walk assurance to ${assuranceState}`);
		}
		const assessmentId = 'asm_01ARZ3NDEKTSV4RRFFQ69J0041';
		const assess = (t: string, payload: unknown) =>
			dispatch(t, payload, assessmentId, 'ASSURANCE_ASSESSMENT');
		ok(
			assess('RequestAssuranceAssessment', {
				assessmentId,
				assurancePolicyId: POLICY,
				policyVersion: '1.0.0',
				subjectObjectIds: [PWU],
				subjectSemanticVersions: { [PWU]: 1 },
				claimIds: []
			}),
			'RequestAssuranceAssessment'
		);
		ok(assess('BeginAssuranceAssessment', {}), 'BeginAssuranceAssessment');
		ok(
			assess('CompleteAssuranceAssessment', {
				validatorResult: {
					validatorId: 'test.reviewer',
					validatorVersion: '1',
					policyId: POLICY,
					policyVersion: '1.0.0',
					assessmentId,
					subjectObjectIds: [PWU],
					subjectSemanticVersions: { [PWU]: 1 },
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
			}),
			'CompleteAssuranceAssessment'
		);
		ok(
			change({ assuranceState: 'SATISFIED', supportingObjectIds: [assessmentId] }),
			'the disposition'
		);
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'SATISFIED');

		ok(
			change({
				previousState: 'SATISFIED',
				newState: 'SATISFIED',
				assuranceState: 'SATISFIED',
				shapeIntegrityState: 'PRESERVED'
			}),
			'a hold at SATISFIED advancing only the orthogonal shape axis'
		);
		expect(
			axis('shapeIntegrityState'),
			'the permitted hold actually moved the orthogonal axis'
		).toBe('PRESERVED');
		expect(axis('workLifecycleState'), 'and held the lifecycle axis where it was').toBe(
			'SATISFIED'
		);
	});

	// ────────────────────────────────────────────────────────────────────────────────────────────────────────
	// D. WHAT WAS NOT SUPPLIED IS NOT WRITTEN
	// ────────────────────────────────────────────────────────────────────────────────────────────────────────

	/**
	 * A PWU inherits its Intent's ontology binding — and inherits NOTHING when the Intent declares none.
	 *
	 * `CaptureIntentPayload.ontologyId` is `z.string()`, so an Intent captured with no ontology is a shape the
	 * contract permits, and `...(intentState.ontologyId ? { ontologyId } : {})` is the line that decides what
	 * happens next. The key must be ABSENT, not empty: an `ontologyId: ''` on a governed object is the
	 * "reference to nothing" `invalidatePwu`'s own comment condemns, and it is indistinguishable from a real
	 * binding to every consumer that tests for presence.
	 *
	 * TWO INDEPENDENT MUTANTS, WHICH IS WHY BOTH DIRECTIONS ARE HERE. Dropping the conditional writes the empty
	 * keys and reddens the first pair; dropping the spread entirely never writes them at all and reddens the
	 * second pair. Neither assertion can stand in for the other.
	 */
	it('carries the Intent ontology binding onto the PWU, and carries NO key at all when the Intent declares none', () => {
		provisionedIntent(INTENT, 'product-realization-pwa', '1.3.0');
		provisionedIntent(BARE_INTENT, '', '');
		ok(proposePwu(PWU, INTENT), 'ProposePwu under an ontology-bearing intent');
		ok(proposePwu(PWU_B, BARE_INTENT), 'ProposePwu under an intent that declares none');

		const bound = stateOf(PWU)!;
		expect(bound.ontologyId, 'the binding the Intent actually declares').toBe(
			'product-realization-pwa'
		);
		expect(bound.ontologyVersion, 'including its version').toBe('1.3.0');

		const bare = stateOf(PWU_B)!;
		expect('ontologyId' in bare, 'an undeclared ontology must leave NO key, not an empty one').toBe(
			false
		);
		expect('ontologyVersion' in bare, 'and the same for its version').toBe(false);
	});

	/**
	 * `PwuMarkedReady.shapeReadinessAttestationId` is OPTIONAL, and `markPwuReady` maps it from a command field
	 * that is REQUIRED but permits the empty string. So the only way to reach the omission arm is to attest with
	 * an empty id — and the event must then record no attestation rather than an attestation of nothing.
	 *
	 * THE MUTANT: make the spread unconditional. The emitted event gains `shapeReadinessAttestationId: ''`,
	 * which every strict shape in the catalog accepts, which is exactly why no schema gate can catch it and this
	 * assertion has to.
	 */
	it('omits the readiness attestation key entirely when the attestation id is empty, rather than recording an empty one', () => {
		provisionedIntent(INTENT, 'product-realization-pwa', '1.3.0');
		ok(proposePwu(PWU, INTENT), 'ProposePwu');
		ok(dispatch('BeginPwuShaping', {}), 'BeginPwuShaping');
		ok(
			dispatch('MarkPwuReady', { shapeReadinessAssessmentId: '', expectedSemanticVersion: 1 }),
			'MarkPwuReady with no attestation'
		);
		const payload = payloadOfLast('PwuMarkedReady');
		expect(
			'shapeReadinessAttestationId' in payload,
			'an empty attestation is no attestation — the key must be absent'
		).toBe(false);
		expect(
			payload.workLifecycleState,
			'while the state the event exists to record IS written'
		).toBe('READY');
	});

	/**
	 * The mirror image: when the optional citation IS supplied, the governed event carries it.
	 *
	 * THREE COMMANDS, THREE SITES, THREE MUTANTS — `challengePwu`, `reshapePwu` and `escalatePwu` each build
	 * their payload with an independent conditional spread, and deleting any one of them reddens exactly one
	 * assertion below. They are collected in one case because they are one rule; they are asserted separately
	 * because they are three lines.
	 *
	 * ⚠ THIS PINS PASSTHROUGH, NOT RESOLUTION. None of the three handlers loads the objects it is handed — read,
	 * not assumed — so these ids are opaque strings to the code under test and nothing here claims they resolve.
	 */
	it('carries the optional citation it was given into the governed event — challenge, reshape and escalate', () => {
		provisionedIntent(INTENT, 'product-realization-pwa', '1.3.0');
		ok(proposePwu(PWU, INTENT), 'ProposePwu');

		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'READY');
		const observationIds = ['aob_01ARZ3NDEKTSV4RRFFQ69J0050', 'aob_01ARZ3NDEKTSV4RRFFQ69J0051'];
		ok(
			dispatch('ChallengePwu', { challengeReason: 'the boundary is wrong', observationIds }),
			'Challenge'
		);
		expect(
			payloadOfLast('PwuChallenged').observationIds,
			'PwuChallenged must carry the observations the challenge cited'
		).toEqual(observationIds);

		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'EXECUTING');
		const triggeringObjectId = 'asm_01ARZ3NDEKTSV4RRFFQ69J0052';
		ok(
			dispatch('ReshapePwu', { reason: 'a material assumption was falsified', triggeringObjectId }),
			'Reshape'
		);
		expect(
			payloadOfLast('PwuReshapingStarted').triggeringObjectId,
			'PwuReshapingStarted must carry what triggered it'
		).toBe(triggeringObjectId);

		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'EVIDENCE_PENDING');
		const unobtainableEvidenceIds = ['evd_01ARZ3NDEKTSV4RRFFQ69J0053'];
		ok(
			dispatch('EscalatePwu', {
				escalationReason: 'the evidence cannot be obtained',
				unobtainableEvidenceIds
			}),
			'Escalate'
		);
		expect(
			payloadOfLast('PwuEscalated').unobtainableEvidenceIds,
			'PwuEscalated must carry the evidence it declared unobtainable'
		).toEqual(unobtainableEvidenceIds);
	});

	// ────────────────────────────────────────────────────────────────────────────────────────────────────────
	// E. THE WAIVER GUARD IS KEYED ON THE TRANSITION, NOT ON THE STATE
	// ────────────────────────────────────────────────────────────────────────────────────────────────────────

	/**
	 * `rejectUnauthorizedWaiver` short-circuits when the PWU is ALREADY at WAIVED, and that short-circuit is the
	 * difference between a guard on the ACT of waiving and a guard on the CONDITION of being waived. Nothing had
	 * exercised it, so nothing distinguished the two readings.
	 *
	 * IT IS LOAD-BEARING IN THE PERMISSIVE DIRECTION, WHICH IS THE EASY ONE TO GET WRONG. A waiver is granted
	 * once; the controller then keeps moving the other three axes, restating the assurance axis unchanged every
	 * time because `ChangePwuState` carries all four. Without this arm, every one of those ticks would demand the
	 * waiver decision be cited again, and a PWU whose waiver was never re-cited would be frozen on all four axes.
	 *
	 * ⚠ THE WAIVER IS REAL. It is proposed as a WAIVER Decision and made effective through `GrantWaiver` — the
	 * engine refuses `ApproveDecision` for a waiver by name — so the arrangement is the guard's own accept path
	 * rather than a seeded state, and the subject below is the SECOND command.
	 *
	 * THE MUTANT: delete the `currentAssuranceState === 'WAIVED'` line. The second command cites nothing, the
	 * resolver finds no authorization, and the dispatch is refused with "no authorized waiver to back it".
	 */
	it('lets an already-WAIVED PWU advance another axis without re-citing the waiver decision', () => {
		provisionedIntent(INTENT, 'product-realization-pwa', '1.3.0');
		ok(proposePwu(PWU, INTENT), 'ProposePwu');
		const hold = (over: Record<string, unknown>) =>
			change({
				previousState: 'PROPOSED',
				newState: 'PROPOSED',
				assuranceState: 'UNASSESSED',
				...over
			});
		ok(hold({ assuranceState: 'EVIDENCE_REQUIRED' }), 'to EVIDENCE_REQUIRED');

		const decisionId = 'dec_01ARZ3NDEKTSV4RRFFQ69J0060';
		ok(
			dispatch(
				'ProposeDecision',
				{
					decisionType: 'WAIVER',
					subjectObjectIds: [PWU],
					selectedOption: 'go',
					rationale: 'the finding is accepted and preserved',
					authority: actor,
					consideredEvidenceIds: [],
					consideredObservationIds: []
				},
				decisionId,
				'DECISION'
			),
			'ProposeDecision(WAIVER)'
		);
		ok(
			dispatch(
				'GrantWaiver',
				{ waiverDecisionId: decisionId, duration: 'P30D' },
				decisionId,
				'DECISION'
			),
			'GrantWaiver'
		);
		ok(
			hold({ assuranceState: 'WAIVED', supportingObjectIds: [decisionId] }),
			'the waiver itself, citing the granted decision'
		);
		expect(axis('assuranceState'), 'the arrangement must actually be waived').toBe('WAIVED');

		// THE SUBJECT: the waiver is restated unchanged while a DIFFERENT axis advances, and nothing is cited.
		ok(
			hold({ assuranceState: 'WAIVED', shapeIntegrityState: 'PRESERVED', supportingObjectIds: [] }),
			'a later tick that restates the in-force waiver and advances the shape axis'
		);
		expect(axis('assuranceState'), 'the waiver is still in force').toBe('WAIVED');
		expect(axis('shapeIntegrityState'), 'and the orthogonal axis actually moved').toBe('PRESERVED');
	});
});
