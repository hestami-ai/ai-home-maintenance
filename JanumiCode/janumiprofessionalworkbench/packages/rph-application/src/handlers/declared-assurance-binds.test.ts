// A PWU's OWN DECLARED assurance policies BIND — RPH-PWU-007 (work lifecycle) and RPH-ASR-012 (assurance axis).
//
// ── THE DEFECT THIS FILE CLOSES, AS THE REGISTER RECORDED IT ─────────────────────────────────────────────────
// `rejectUnbackedDisposition` is an EXISTENTIAL over the assessments the CALLER cites: it asks whether ONE cited
// ASSURANCE_ASSESSMENT carries the asserted disposition over this subject. It never enumerates the policies the
// PWU itself declares, so a controller selected its own evidence — a PWU whose own `assurancePolicyIds` named a
// policy assessed REJECTED reached `assuranceState = SATISFIED` (and, through the UNDER_ASSURANCE -> SATISFIED
// cross-axis guard, `workLifecycleState = SATISFIED`) by citing a SECOND assessment under an UNRELATED policy.
// Both rows were filed `UNENFORCED_DISCLOSED` with OBSERVED_ADMISSION guards; this is the wiring of that gap.
//
// ── WHY THE ADMITTING TESTS ARE THE HARDER HALF, AND ARE HERE ───────────────────────────────────────────────
// A guard that refused EVERY positive disposition would satisfy every refusal test below. The `ADMITS` tests are
// therefore not decoration: each one drives a PWU whose declared policies ARE satisfied all the way to SATISFIED
// and asserts the committed axes. They are the tests a fail-closed mutant must redden, and the ledger entry
// `MU-PWU007-unsupportedSatisfaction-admits-control` exists to prove they do: it turns the strictness
// comparison's `<=` into `<` and reddens NINE tests, every one of them an admission, while the two REFUSES tests
// stay green.
//
// ⚠ WHAT THIS FILE DOES **NOT** CLAIM, stated here so a green is not read wider than it is. The guard folds the
// declared policies that HAVE a concluded verdict. A declared policy with NO assessment at all (§28.2's
// "required assessment missing" rung) is still ADMITTED — see `declared-assurance.ts` for why that limb is a
// separate rule with a separate blast radius — and the last test in this file OBSERVES that residual rather than
// leaving a reader to infer it is closed.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-09-14T00:00:00Z';
const actor: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'Controller' };
const DIR = testDirectory([{ ...actor, tenantId: 'tenant-test', organizationId: 'org-test' }]);

const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5N00';

interface Outcome {
	readonly status: string;
	readonly code?: string;
	readonly message?: string;
}

describe('a declared assurance policy BINDS (RPH-PWU-007 / RPH-ASR-012)', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	const dispatch = (commandType: string, payload: unknown, id: string, aggType: string): Outcome => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'declared-assurance',
			idempotencyKey: `k-${n}`,
			payload
		};
		const r = engine.dispatch(command);
		return { status: r.status, code: r.error?.code, message: r.error?.message };
	};

	const ok = (r: Outcome, what: string): Outcome => {
		expect(r.status, `${what}: ${r.code ?? ''} ${r.message ?? ''}`).toBe('ACCEPTED');
		return r;
	};

	const stateOf = (id: string): Record<string, unknown> =>
		(store.loadObject(id)?.state ?? {}) as Record<string, unknown>;

	// ── fixtures ─────────────────────────────────────────────────────────────────────────────────────────────

	const seedPolicy = (policyId: string): void => {
		ok(
			dispatch(
				'CreateAssurancePolicy',
				{
					policyId,
					version: '1.0.0',
					name: `Declared policy ${policyId}`,
					purpose: 'Assess the subject against its approved need.',
					rationale: 'Seeded for a live command-drive test of declared-policy binding.',
					applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
					evaluatedClaimTypes: ['FITNESS'],
					criteria: [
						{
							id: 'C1',
							name: 'Fit',
							description: 'The subject is fit for its approved need.',
							criterionType: 'QUALITATIVE',
							evaluationMethod: 'HUMAN_JUDGMENT',
							requiredEvidenceIds: [],
							severityIfNotMet: 'MATERIAL',
							mayBeNotApplicable: false
						}
					],
					evaluatorRole: 'REVIEWER',
					independenceRequirement: 'NONE',
					findingDefinitions: [
						{
							code: 'UNFIT',
							name: 'Unfit',
							description: 'Not fit for the approved need.',
							defaultSeverity: 'MATERIAL',
							affectedClaimTypes: ['FITNESS'],
							defaultControlActions: ['CONTINUE']
						}
					],
					permittedControlActions: ['CONTINUE']
				},
				policyId,
				'ASSURANCE_POLICY'
			),
			`create policy ${policyId}`
		);
		ok(
			dispatch('ActivateAssurancePolicy', { policyId }, policyId, 'ASSURANCE_POLICY'),
			`activate policy ${policyId}`
		);
	};

	const proposePwu = (
		pwuId: string,
		declared: readonly string[],
		// ⭑ THE TYPE, OPTIONAL — defaulted away so no existing arrangement changes meaning. The union's TYPE half
		// had never been driven at this seam; exactly one test passes it.
		pwuTypeId?: string
	): void => {
		ok(
			dispatch(
				'ProposePwu',
				{
					pwuId,
					pwuKind: 'ARCHITECTURE',
					title: pwuId,
					description: 'd',
					intentId: INTENT,
					boundaries: {
						inScope: ['the architecture note'],
						outOfScope: ['implementation'],
						permittedChanges: [],
						prohibitedChanges: []
					},
					obligationIds: [],
					constraintIds: [],
					assumptionIds: [],
					expectedOutputs: [
						{
							artifactType: 'DOCUMENT',
							description: 'the architecture note',
							verificationCriteria: ['reviewed']
						}
					],
					assurancePolicyIds: [...declared],
					...(pwuTypeId ? { pwuTypeId } : {}),
					riskProfile: {
						consequence: 'HIGH',
						uncertainty: 'MEDIUM',
						irreversibility: 'MEDIUM',
						securitySensitivity: 'HIGH',
						regulatoryExposure: 'LOW'
					}
				},
				pwuId,
				'PROFESSIONAL_WORK_UNIT'
			),
			`propose ${pwuId}`
		);
	};

	/** Request, begin and COMPLETE one assessment over `subject` under `policyId` with `disposition`. */
	const assess = (
		assessmentId: string,
		policyId: string,
		subject: string,
		disposition: string,
		// ⭐ `R19` — WHICH SUBJECT VERSION THIS ASSESSMENT BINDS. Defaulted to 1, which is what every arrangement
		// in this file used before the version limb existed, so no fixture changes meaning. The stale-version
		// test passes 7 and is the only caller that does.
		boundVersion = 1
	): void => {
		ok(
			dispatch(
				'RequestAssuranceAssessment',
				{
					assessmentId,
					assurancePolicyId: policyId,
					policyVersion: '1.0.0',
					subjectObjectIds: [subject],
					subjectSemanticVersions: { [subject]: boundVersion },
					claimIds: []
				},
				assessmentId,
				'ASSURANCE_ASSESSMENT'
			),
			`request ${assessmentId}`
		);
		ok(
			dispatch('BeginAssuranceAssessment', {}, assessmentId, 'ASSURANCE_ASSESSMENT'),
			`begin ${assessmentId}`
		);
		ok(
			dispatch(
				'CompleteAssuranceAssessment',
				{
					validatorResult: {
						validatorId: 'reviewer',
						validatorVersion: '1',
						policyId,
						policyVersion: '1.0.0',
						assessmentId,
						subjectObjectIds: [subject],
						subjectSemanticVersions: { [subject]: boundVersion },
						claimResults: [],
						evidenceConsideredIds: [],
						evidenceRejected: [],
						observations: [],
						dispositionRecommendation: disposition,
						recommendedControlActions: [],
						residualUncertainty: [],
						limitations: [],
						executionProvenance: {
							evaluator: { actorId: 'rev-1', actorType: 'HUMAN', displayName: 'Reviewer' }
						}
					}
				},
				assessmentId,
				'ASSURANCE_ASSESSMENT'
			),
			`complete ${assessmentId} ${disposition}`
		);
		expect(
			stateOf(assessmentId).assessmentState,
			`the arrangement is only real while ${assessmentId} truly reads ${disposition}`
		).toBe(disposition);
	};

	const pwuState = (
		pwuId: string,
		previousState: string,
		newState: string,
		over: Record<string, unknown>
	): Outcome =>
		dispatch(
			'ChangePwuState',
			{
				previousState,
				newState,
				executionState: 'NOT_PLANNED',
				assuranceState: 'UNASSESSED',
				shapeIntegrityState: 'PRESERVED',
				reasonCode: 'fixture',
				supportingObjectIds: [],
				...over
			},
			pwuId,
			'PROFESSIONAL_WORK_UNIT'
		);

	const driveToReady = (pwuId: string): void => {
		ok(dispatch('BeginPwuShaping', {}, pwuId, 'PROFESSIONAL_WORK_UNIT'), `${pwuId} -> SHAPING`);
		ok(
			dispatch(
				'MarkPwuReady',
				{ shapeReadinessAssessmentId: 'assess_shape', expectedSemanticVersion: 1 },
				pwuId,
				'PROFESSIONAL_WORK_UNIT'
			),
			`${pwuId} -> READY`
		);
	};

	/** Walk the assurance axis to ASSESSING — the only state SATISFIED has an in-arrow from. */
	const driveAssuranceToAssessing = (pwuId: string): void => {
		for (const s of ['EVIDENCE_REQUIRED', 'READY_FOR_ASSESSMENT', 'ASSESSING'])
			ok(
				pwuState(pwuId, 'READY', 'READY', { assuranceState: s, reasonCode: 'fx' }),
				`${pwuId} assurance -> ${s}`
			);
	};

	/** Assert a terminal assurance disposition on a PWU held at READY, citing `supporting` as its backing. */
	const setAssurance = (
		pwuId: string,
		assuranceState: string,
		supporting: readonly string[]
	): Outcome =>
		pwuState(pwuId, 'READY', 'READY', {
			assuranceState,
			supportingObjectIds: [...supporting],
			reasonCode: 'aggregate assurance'
		});

	/** A plan over `subject` driven to a genuinely SUCCEEDED step — `rejectUnbackedExecutionSuccess` demands it. */
	const succeededPlanFor = (subject: string, planId: string): void => {
		const stepId = `${planId}-s1`;
		const evId = planId.replace(/^pln/, 'evd');
		const plan = (t: string, payload: unknown) =>
			ok(dispatch(t, payload, planId, 'EXECUTION_PLAN'), t);
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
		});
		plan('ApproveExecutionPlan', {});
		plan('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] });
		plan('StartExecutionStep', { stepId });
		ok(
			dispatch(
				'ProposeEvidence',
				{
					evidenceId: evId,
					evidenceType: 'ARTIFACT',
					contentReference: { kind: 'INLINE', note: 'the produced output' },
					producedBy: { actorId: 'ci-1', actorType: 'SERVICE', displayName: 'CI' },
					supportsClaimIds: [],
					contradictsClaimIds: [],
					scope: 'the architecture note',
					limitations: [],
					capturedAt: TS
				},
				evId,
				'EVIDENCE'
			),
			'propose the step output'
		);
		plan('CompleteExecutionStep', {
			executionStepId: stepId,
			executionAttemptId: `${planId}-a1`,
			resultStatus: 'SUCCEEDED',
			outputArtifactIds: [],
			proposedEvidenceIds: [evId],
			detectedAssumptionIds: [],
			structuredResult: {},
			executionProvenance: {}
		});
	};

	/**
	 * THE RPH-PWU-007 ARRANGEMENT, to the last hop before the disputed one.
	 *
	 * The PWU declares `polDeclared`; an assessment under it lands on `declaredDisposition`; a SECOND assessment
	 * under an UNRELATED policy lands SATISFIED and is the one the controller will cite. Returns the ids so the
	 * caller issues the final ChangePwuState itself — that command is what the two tests differ on.
	 */
	const arrangeWorkLifecycle = (
		tag: string,
		declaredDisposition: string
	): {
		readonly pwu: string;
		readonly polDeclared: string;
		readonly asmDeclared: string;
		readonly asmCited: string;
	} => {
		const id = (p: string, n: string) => `${p}_01ARZ3NDEKTSV4RRFFQ69G5${tag}${n}`;
		const pwu = id('pwu', '01');
		const polDeclared = id('pol', '02');
		const polOther = id('pol', '03');
		const asmDeclared = id('asm', '04');
		const asmCited = id('asm', '05');
		const planId = id('pln', '06');

		seedPolicy(polDeclared);
		seedPolicy(polOther);
		proposePwu(pwu, [polDeclared]);
		assess(asmDeclared, polDeclared, pwu, declaredDisposition);
		assess(asmCited, polOther, pwu, 'SATISFIED');

		succeededPlanFor(pwu, planId);
		driveToReady(pwu);
		const hop = (over: Record<string, unknown>) =>
			ok(
				pwuState(pwu, String(over.previousState), String(over.newState), over),
				`hop ${String(over.newState)}`
			);
		hop({ previousState: 'READY', newState: 'PLANNED', executionState: 'PLANNED' });
		hop({ previousState: 'PLANNED', newState: 'EXECUTING', executionState: 'QUEUED' });
		hop({ previousState: 'EXECUTING', newState: 'EXECUTING', executionState: 'RUNNING' });
		hop({
			previousState: 'EXECUTING',
			newState: 'EVIDENCE_PENDING',
			executionState: 'SUCCEEDED',
			assuranceState: 'EVIDENCE_REQUIRED',
			supportingObjectIds: [planId]
		});
		hop({
			previousState: 'EVIDENCE_PENDING',
			newState: 'UNDER_ASSURANCE',
			executionState: 'SUCCEEDED',
			assuranceState: 'READY_FOR_ASSESSMENT'
		});
		hop({
			previousState: 'UNDER_ASSURANCE',
			newState: 'UNDER_ASSURANCE',
			executionState: 'SUCCEEDED',
			assuranceState: 'ASSESSING'
		});
		return { pwu, polDeclared, asmDeclared, asmCited };
	};

	/** The disputed command: SATISFIED on both axes, citing ONLY the unrelated satisfied assessment. */
	const claimSatisfied = (pwu: string, cited: readonly string[]): Outcome =>
		pwuState(pwu, 'UNDER_ASSURANCE', 'SATISFIED', {
			executionState: 'SUCCEEDED',
			assuranceState: 'SATISFIED',
			supportingObjectIds: [...cited],
			reasonCode: 'controller satisfies'
		});

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: DIR.authenticate,
			store,
			now: () => TS,
			newEventId: () => `evt_${++seq}`
		}).as(DIR.credentialFor(actor.actorId));
		ok(
			dispatch(
				'CaptureIntent',
				{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
				INTENT,
				'INTENT'
			),
			'capture intent'
		);
		ok(dispatch('BeginIntentDiscovery', {}, INTENT, 'INTENT'), 'intent -> UNDER_DISCOVERY');
		ok(dispatch('ProvisionIntent', { ambiguityIds: [] }, INTENT, 'INTENT'), 'intent -> PROVISIONAL');
	});

	// ── RPH-PWU-007 — the WORK LIFECYCLE axis ────────────────────────────────────────────────────────────────

	it('REFUSES workLifecycle SATISFIED while the PWU OWN declared policy reads REJECTED (RPH-PWU-007)', () => {
		const { pwu, asmDeclared, asmCited } = arrangeWorkLifecycle('A', 'REJECTED');
		const refused = claimSatisfied(pwu, [asmCited]);

		expect(
			refused.status,
			`expected a refusal, got ${refused.code ?? ''}: ${refused.message ?? ''}`
		).toBe('REJECTED');
		// THE CODE IS NOT THE PROOF — the whole point of the row is that a DIFFERENT guard at the same site
		// already refuses things. The marker is what says THIS limb refused.
		expect(refused.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(refused.message).toContain('a policy this PWU itself declares has not been satisfied');
		expect(refused.message, 'the refusal must name the offending policy and its verdict').toContain(
			'REJECTED'
		);
		expect(
			refused.message,
			'and the assessment that carries it, so the reader can go and look'
		).toContain(asmDeclared);

		// NOT MOVED. A refusal that still committed the axis would be worse than none.
		const s = stateOf(pwu);
		expect(s.workLifecycleState, 'the work axis must not have moved').toBe('UNDER_ASSURANCE');
		expect(s.assuranceState, 'the assurance axis must not have moved').toBe('ASSESSING');
	});

	it('ADMITS workLifecycle SATISFIED when the declared policy IS satisfied — the control', () => {
		const { pwu, asmCited } = arrangeWorkLifecycle('B', 'SATISFIED');
		// ⛔ THE ORDINARY CASE STILL WORKS, AND IT CITES ONLY THE UNRELATED ASSESSMENT — byte-identical to the
		// refused command above but for the DECLARED policy's verdict. A guard that refused every disposition,
		// or that demanded the declared assessment be CITED rather than SATISFIED, reddens here and nowhere else.
		ok(claimSatisfied(pwu, [asmCited]), 'the ordinary satisfaction still lands');

		const s = stateOf(pwu);
		expect(s.workLifecycleState, 'the PWU really reaches SATISFIED').toBe('SATISFIED');
		expect(s.assuranceState).toBe('SATISFIED');
	});

	// ── THE REORDERING THE WORK-AXIS LIMB EXISTS FOR ────────────────────────────────────────────────────────

	it('REFUSES workLifecycle SATISFIED when a declared policy was re-assessed REJECTED AFTER the assurance axis was already satisfied', () => {
		const { pwu, polDeclared, asmCited } = arrangeWorkLifecycle('G', 'SATISFIED');
		// STEP 1 — the assurance axis is satisfied LEGITIMATELY, while the work axis HOLDS at UNDER_ASSURANCE. Every
		// declared policy really is satisfied at this moment, so the guard has no complaint and the hop lands.
		ok(
			pwuState(pwu, 'UNDER_ASSURANCE', 'UNDER_ASSURANCE', {
				executionState: 'SUCCEEDED',
				assuranceState: 'SATISFIED',
				supportingObjectIds: [asmCited],
				reasonCode: 'assurance concludes'
			}),
			'the assurance axis reaches SATISFIED on its own'
		);

		// STEP 2 — the declared policy is re-assessed and now REJECTS.
		assess('asm_01ARZ3NDEKTSV4RRFFQ69G5G99', polDeclared, pwu, 'REJECTED');

		// ⛔ STEP 3 IS THE DODGE. The work axis moves to SATISFIED in a command where the ASSURANCE axis DOES NOT
		// CHANGE — so every "may not be asserted" guard above short-circuits on `p.assuranceState ===
		// currentAssuranceState`, and the UNDER_ASSURANCE -> SATISFIED cross-axis guard is satisfied because the
		// axis genuinely reads SATISFIED. Keying this rule on the assurance axis alone would leave the arrangement
		// RPH-PWU-007 is about reachable by reordering two commands.
		const refused = pwuState(pwu, 'UNDER_ASSURANCE', 'SATISFIED', {
			executionState: 'SUCCEEDED',
			assuranceState: 'SATISFIED',
			supportingObjectIds: [asmCited],
			reasonCode: 'controller satisfies'
		});
		expect(
			refused.status,
			`expected a refusal, got ${refused.code ?? ''}: ${refused.message ?? ''}`
		).toBe('REJECTED');
		expect(refused.message).toContain('composed disposition REJECTED');
		expect(stateOf(pwu).workLifecycleState, 'the work axis must not have moved').toBe(
			'UNDER_ASSURANCE'
		);
	});

	it('ADMITS the same workLifecycle SATISFIED hop while the declared policy still reads SATISFIED — the control', () => {
		const { pwu, asmCited } = arrangeWorkLifecycle('H', 'SATISFIED');
		ok(
			pwuState(pwu, 'UNDER_ASSURANCE', 'UNDER_ASSURANCE', {
				executionState: 'SUCCEEDED',
				assuranceState: 'SATISFIED',
				supportingObjectIds: [asmCited],
				reasonCode: 'assurance concludes'
			}),
			'the assurance axis reaches SATISFIED on its own'
		);
		// Byte-identical to the refused command above, with the re-assessment simply not performed.
		ok(
			pwuState(pwu, 'UNDER_ASSURANCE', 'SATISFIED', {
				executionState: 'SUCCEEDED',
				assuranceState: 'SATISFIED',
				supportingObjectIds: [asmCited],
				reasonCode: 'controller satisfies'
			}),
			'the work axis still arrives at SATISFIED'
		);
		expect(stateOf(pwu).workLifecycleState).toBe('SATISFIED');
	});

	// ── RPH-ASR-012 — the ASSURANCE axis, composed across the declared set ───────────────────────────────────

	const FIVE = ['01', '02', '03', '04', '05'] as const;
	const arrangeAggregate = (
		tag: string,
		dispositions: readonly string[]
	): { readonly pwu: string; readonly assessments: readonly string[] } => {
		const id = (p: string, n: string) => `${p}_01ARZ3NDEKTSV4RRFFQ69G5${tag}${n}`;
		const pwu = id('pwu', '00');
		const policies = FIVE.map((n) => id('pol', n));
		const assessments = FIVE.map((n) => id('asm', n));
		for (const p of policies) seedPolicy(p);
		proposePwu(pwu, policies);
		driveToReady(pwu);
		for (const [i, a] of assessments.entries()) assess(a, policies[i]!, pwu, dispositions[i]!);
		driveAssuranceToAssessing(pwu);
		return { pwu, assessments };
	};

	it('REFUSES an aggregate SATISFIED citing four satisfied assessments while a fifth required policy reads REJECTED (RPH-ASR-012)', () => {
		const { pwu, assessments } = arrangeAggregate('C', [
			'SATISFIED',
			'SATISFIED',
			'SATISFIED',
			'SATISFIED',
			'REJECTED'
		]);
		const refused = setAssurance(pwu, 'SATISFIED', assessments.slice(0, 4));

		expect(
			refused.status,
			`expected a refusal, got ${refused.code ?? ''}: ${refused.message ?? ''}`
		).toBe('REJECTED');
		expect(refused.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(refused.message).toContain('a policy this PWU itself declares has not been satisfied');
		// THE COMPOSED AGGREGATE IS NAMED, not merely the offending row: §28.1's rule is about the FOLD, and a
		// message that named only the bad policy would read as "one bad apple" rather than "the aggregate is
		// REJECTED", which is the rule.
		expect(refused.message).toContain('composed disposition REJECTED');
		expect(refused.message, 'the fifth assessment is the one that carries the verdict').toContain(
			assessments[4]!
		);
		expect(stateOf(pwu).assuranceState, 'the axis must not have moved').toBe('ASSESSING');
	});

	it('ADMITS an aggregate SATISFIED citing ONE assessment when all five declared policies are satisfied — the control', () => {
		const { pwu, assessments } = arrangeAggregate('D', [
			'SATISFIED',
			'SATISFIED',
			'SATISFIED',
			'SATISFIED',
			'SATISFIED'
		]);
		// ⛔ ONE citation, five declared policies. The new guard composes across the DECLARED set; it must not
		// have quietly become a rule that every declared policy be CITED.
		ok(setAssurance(pwu, 'SATISFIED', [assessments[0]!]), 'the ordinary aggregate still lands');
		expect(stateOf(pwu).assuranceState).toBe('SATISFIED');
	});

	it('ADMITS a CONDITIONALLY_SATISFIED aggregate when the strictest declared verdict is conditional', () => {
		const { pwu, assessments } = arrangeAggregate('E', [
			'SATISFIED',
			'SATISFIED',
			'SATISFIED',
			'SATISFIED',
			'CONDITIONALLY_SATISFIED'
		]);
		// The fold's rung 5. Asserting the STRICTEST unresolved disposition is exactly what §28.1 asks for, so
		// this must pass — while asserting SATISFIED over the same five must not.
		const over = setAssurance(pwu, 'SATISFIED', [assessments[0]!]);
		expect(over.status, 'SATISFIED over a conditional required policy is refused').toBe('REJECTED');
		expect(over.message).toContain('composed disposition CONDITIONALLY_SATISFIED');
		ok(
			setAssurance(pwu, 'CONDITIONALLY_SATISFIED', [assessments[4]!]),
			'the conditional aggregate itself lands'
		);
		expect(stateOf(pwu).assuranceState).toBe('CONDITIONALLY_SATISFIED');
	});

	it('REFUSES an aggregate CONDITIONALLY_SATISFIED while a declared policy reads REJECTED', () => {
		// ⛔ THIS TEST EXISTS BECAUSE A DECLARED MUTATION SURVIVED. `SATISFACTION_CLAIMS` has TWO members, and every
		// other test in this file exercises only the SATISFIED one: narrowing the set to `['SATISFIED']` left all
		// 45 checks GREEN, so the CONDITIONALLY_SATISFIED half of the antecedent was carried by nothing. A
		// conditional disposition is still a claim that the work may proceed — §28.2 gives it rung 5, ABOVE
		// REJECTED — so a controller must not reach it over a rejecting required policy either.
		// ⚠ THE FOURTH POLICY IS CONDITIONALLY_SATISFIED AND IT IS THE ONE CITED, DELIBERATELY. Citing a SATISFIED
		// assessment instead trips `rejectUnbackedDisposition` FIRST — it demands a cited assessment whose own
		// state IS the asserted disposition — and the probe would then be measuring that guard, not this one.
		// Driven: the first draft did exactly that and the MESSAGE assertion is what caught it.
		const { pwu, assessments } = arrangeAggregate('J', [
			'SATISFIED',
			'SATISFIED',
			'SATISFIED',
			'CONDITIONALLY_SATISFIED',
			'REJECTED'
		]);
		const refused = setAssurance(pwu, 'CONDITIONALLY_SATISFIED', [assessments[3]!]);
		expect(
			refused.status,
			`expected a refusal, got ${refused.code ?? ''}: ${refused.message ?? ''}`
		).toBe('REJECTED');
		expect(refused.message).toContain('composed disposition REJECTED');
		expect(refused.message).toContain('does not support CONDITIONALLY_SATISFIED');
		expect(stateOf(pwu).assuranceState, 'the axis must not have moved').toBe('ASSESSING');
	});

	// ── THE GUARD REFUSES SATISFACTION, NOT EVERY DISPOSITION ───────────────────────────────────────────────

	it('ADMITS assuranceState REJECTED while a declared policy reads REJECTED — the rule blocks satisfaction only', () => {
		const { pwu, assessments } = arrangeAggregate('F', [
			'SATISFIED',
			'SATISFIED',
			'SATISFIED',
			'SATISFIED',
			'REJECTED'
		]);
		// Canon: "Any rejected mandatory assessment blocks SATISFACTION." A guard that read the fold in both
		// directions would make a PWU whose policy rejected it unable to be recorded as rejected.
		ok(setAssurance(pwu, 'REJECTED', [assessments[4]!]), 'the negative disposition is unaffected');
		expect(stateOf(pwu).assuranceState).toBe('REJECTED');
	});

	// ── RE-ASSESSMENT SUPERSEDES — the ordering rule the shared index owns ──────────────────────────────────

	it('ADMITS SATISFIED once a REJECTED declared policy is RE-ASSESSED satisfied — remediation clears it', () => {
		const id = (p: string, n: string) => `${p}_01ARZ3NDEKTSV4RRFFQ69G5H${n}`;
		const pwu = id('pwu', '01');
		const pol = id('pol', '02');
		const polOther = id('pol', '05');
		const first = id('asm', '03');
		const second = id('asm', '04');
		const cited = id('asm', '06');
		seedPolicy(pol);
		seedPolicy(polOther);
		proposePwu(pwu, [pol]);
		driveToReady(pwu);
		assess(first, pol, pwu, 'REJECTED');
		// The citation is always the UNRELATED satisfied assessment, in both halves — so `rejectUnbackedDisposition`
		// is satisfied throughout and the only thing that moves between the two dispatches is the DECLARED policy's
		// own latest verdict. Citing the rejected one instead would trip the sibling guard first and this test
		// would be measuring that.
		assess(cited, polOther, pwu, 'SATISFIED');
		driveAssuranceToAssessing(pwu);

		// ⛔ WITHOUT THIS THE GUARD WOULD BE A TRAP, NOT A GATE. If the FIRST verdict under a policy were the one
		// that counted, a rejection could never be cleared and the only route out of a finding would be to
		// abandon the work. `latestAssessmentByPolicy` decides which record speaks for a policy, and this is the
		// test that says its answer is LATEST rather than FIRST.
		const refused = setAssurance(pwu, 'SATISFIED', [cited]);
		expect(refused.status, 'while the rejection stands, satisfaction is refused').toBe('REJECTED');
		expect(refused.message).toContain('composed disposition REJECTED');

		assess(second, pol, pwu, 'SATISFIED');
		ok(setAssurance(pwu, 'SATISFIED', [cited]), 'the remediated verdict supersedes the rejection');
		expect(stateOf(pwu).assuranceState).toBe('SATISFIED');
	});

	// ── ⭐⭐ THE DISCLOSED RESIDUAL, RE-DISPOSITIONED 2026-09-17 — `JAN-EXEC` PHASE 6 / `R19` ──────────────
	//
	// ⭑ THE TEST BELOW USED TO ASSERT THE ADMISSION, AND ITS OWN COMMENT SAID WHAT TO DO TODAY: *"the day it is
	// closed, this test reddens and must be RE-DISPOSITIONED rather than deleted."* It reddened; this is that
	// re-disposition. The arrangement is byte-identical — only the expected outcome moved — so a reader can see
	// that what changed is the RULE and not the case.
	//
	// ⛔ AND IT WAS TAKEN BECAUSE THE RESIDUAL TURNED OUT TO BE WIDER THAN ITS OWN NAME. §28.2 rung 3 covers
	// THREE silences, and the second of them ERASES AN EXISTING REJECTION — see the erasure test below, which was
	// DRIVEN as an admission against this file's own `RPH-PWU-007` fixture before any of this was written.

	it('⛔ REFUSES SATISFIED while a declared policy has NO assessment at all — §28.2 rung 3', () => {
		const id = (p: string, n: string) => `${p}_01ARZ3NDEKTSV4RRFFQ69G5G${n}`;
		const pwu = id('pwu', '01');
		const polAssessed = id('pol', '02');
		const polSilent = id('pol', '03');
		const asm = id('asm', '04');
		seedPolicy(polAssessed);
		seedPolicy(polSilent);
		proposePwu(pwu, [polAssessed, polSilent]);
		driveToReady(pwu);
		assess(asm, polAssessed, pwu, 'SATISFIED');
		driveAssuranceToAssessing(pwu);
		const refused = setAssurance(pwu, 'SATISFIED', [asm]);
		expect(refused.status, `expected a refusal: ${refused.message ?? ''}`).toBe('REJECTED');
		expect(refused.code).toBe('RPH_INVARIANT_VIOLATION');
		// ⛔ THE COMPOSED RUNG IS THE MARKER, NOT THE SHARED OPENING CLAUSE — the same discipline the two register
		// rows use to stay distinguishable. `UNASSESSED` is rung 3's NOTHING-AT-ALL arm; `EVIDENCE_REQUIRED` is its
		// something-underway arm, and the erasure test below pins that one.
		expect(refused.message).toContain('composed disposition UNASSESSED');
		expect(refused.message, 'the refusal must name the silent policy').toContain(polSilent);
		expect(refused.message, 'and say WHICH silence, because the three have different remedies').toContain(
			'has no assessment over this subject at all'
		);
		expect(
			refused.message,
			'⚠ and must NOT name the policy that DID speak — a refusal listing an innocent policy sends the operator to the wrong place'
		).not.toContain(polAssessed);
		expect(stateOf(pwu).assuranceState, 'the axis must not have moved').toBe('ASSESSING');
	});

	it('⭐⛔ REFUSES the ERASURE — one further RequestAssuranceAssessment must not delete a REJECTED verdict', () => {
		// ⭐⭐ THIS ARRANGEMENT WAS DRIVEN AS AN **ADMISSION** BEFORE THE FIX. Take the `RPH-PWU-007` refusal fixture
		// verbatim — the one the ENFORCED register row pins — and insert ONE command: a second assessment under the
		// SAME declared policy, requested and left unconcluded. Observed: request ACCEPTED, claim ACCEPTED,
		// workLifecycleState SATISFIED. The REJECTED verdict was still in the store; it had merely stopped being
		// `latest`, and `declaredPolicyVerdicts` skipped it with no fallback.
		//
		// ⛔ THE MARKER MUST BE RUNG 3 AND **NOT** THE REJECTION RUNG, which is the whole subtlety. The policy's
		// current word is an unconcluded assessment — so claiming a rejection blocked this would tell a reader a
		// verdict bit that this fold never saw. `EVIDENCE_REQUIRED` is rung 3's something-is-underway arm and it is
		// what distinguishes this from the never-assessed case above.
		const { pwu, polDeclared, asmCited } = arrangeWorkLifecycle('E', 'REJECTED');
		const fresh = 'asm_01ARZ3NDEKTSV4RRFFQ69G5E99';
		ok(
			dispatch(
				'RequestAssuranceAssessment',
				{
					assessmentId: fresh,
					assurancePolicyId: polDeclared,
					policyVersion: '1.0.0',
					subjectObjectIds: [pwu],
					subjectSemanticVersions: { [pwu]: 1 },
					claimIds: []
				},
				fresh,
				'ASSURANCE_ASSESSMENT'
			),
			'the second assessment is still ACCEPTED — requesting one is lawful and stays lawful'
		);
		const refused = claimSatisfied(pwu, [asmCited]);
		expect(refused.status, `expected a refusal: ${refused.message ?? ''}`).toBe('REJECTED');
		expect(refused.message).toContain('composed disposition EVIDENCE_REQUIRED');
		expect(refused.message).toContain('its most recent one is still in progress');
		expect(refused.message, 'the displacing assessment must be named').toContain(fresh);
		const s = stateOf(pwu);
		expect(s.workLifecycleState, 'the work axis must not have moved').toBe('UNDER_ASSURANCE');
	});

	it('⛔ REFUSES a verdict bound to a DIFFERENT semantic version of the subject', () => {
		// ⚠ `floorGateBlock` version-binds out of the SAME `SubjectAssessmentRecord` and this reader did not — an
		// asymmetry between two consumers of one index, which is what made this limb worth taking here rather than
		// leaving it entirely to `RPH-ASR-010` (whose subject is the ASSESSMENT side: completing one against a
		// version the subject is not at). Two sites, two rules.
		const id = (p: string, n: string) => `${p}_01ARZ3NDEKTSV4RRFFQ69G5H${n}`;
		const pwu = id('pwu', '01');
		const pol = id('pol', '02');
		const asm = id('asm', '03');
		seedPolicy(pol);
		proposePwu(pwu, [pol]);
		driveToReady(pwu);
		// SATISFIED, but bound to version 7 while the PWU is at 1. Everything else is the ordinary arrangement —
		// the CONTROL two tests up is byte-identical except for this number.
		assess(asm, pol, pwu, 'SATISFIED', 7);
		driveAssuranceToAssessing(pwu);
		const refused = setAssurance(pwu, 'SATISFIED', [asm]);
		expect(refused.status, `expected a refusal: ${refused.message ?? ''}`).toBe('REJECTED');
		expect(refused.message).toContain('CURRENT semantic version');
		expect(refused.message).toContain(pol);
	});

	it('⭐⛔ a NON-GOVERNING policy is not NAMED in a refusal it played no part in', () => {
		// ⛔ THIS TEST EXISTS BECAUSE ITS MUTANT SURVIVED. The control below proves a non-governing policy does not
		// BLOCK; nothing proved it is not LISTED. Removing the `applicable !== false` conjunct from `blocking`
		// left every assertion green, because in the control there is no refusal to inspect and in the refusal
		// tests every declared policy governs.
		//
		// ⚠ AND THE DEFECT IT ADMITS IS ONE THIS FILE'S OWN MESSAGE DOCBLOCK RECORDS COMMITTING ONCE: a refusal
		// that names the wrong rule *"told the reader a rejection had blocked them when none existed"*. Here it
		// would send an operator to reactivate a SUSPENDED policy that had no vote, while the policy that really
		// blocked sits beside it in the same list.
		const id = (p: string, n: string) => `${p}_01ARZ3NDEKTSV4RRFFQ69G5K${n}`;
		const pwu = id('pwu', '01');
		const polGoverning = id('pol', '02');
		const polSuspended = id('pol', '03');
		const asm = id('asm', '04');
		seedPolicy(polGoverning);
		seedPolicy(polSuspended);
		proposePwu(pwu, [polGoverning, polSuspended]);
		ok(
			dispatch('SuspendAssurancePolicy', { policyId: polSuspended }, polSuspended, 'ASSURANCE_POLICY'),
			'suspend one of the two'
		);
		driveToReady(pwu);
		// ⭑ BOTH ARE SILENT, and only the GOVERNING one may appear. `asm` is an unrelated satisfied assessment so
		// `rejectUnbackedDisposition` is satisfied and the refusal that arrives is THIS guard's.
		assess(asm, polGoverning, pwu, 'SATISFIED');
		driveAssuranceToAssessing(pwu);
		// Re-open the governing policy's verdict by displacing it, so the claim is refused with BOTH declared —
		// one governing and silent, one suspended and silent.
		const fresh = id('asm', '05');
		ok(
			dispatch(
				'RequestAssuranceAssessment',
				{
					assessmentId: fresh,
					assurancePolicyId: polGoverning,
					policyVersion: '1.0.0',
					subjectObjectIds: [pwu],
					subjectSemanticVersions: { [pwu]: 1 },
					claimIds: []
				},
				fresh,
				'ASSURANCE_ASSESSMENT'
			),
			'displace the governing policy’s verdict'
		);
		const refused = setAssurance(pwu, 'SATISFIED', [asm]);
		expect(refused.status, `expected a refusal: ${refused.message ?? ''}`).toBe('REJECTED');
		expect(refused.message, 'the policy that actually blocked must be named').toContain(polGoverning);
		expect(
			refused.message,
			'⛔ and the SUSPENDED one must NOT be — the fold excluded it, so naming it sends the operator to a policy with no vote'
		).not.toContain(polSuspended);
	});

	it('⭐ CONTROL — a declared policy that does NOT GOVERN is not demanded, so `R19` is asymmetric and not strict', () => {
		// ⛔ WITHOUT THIS THE RULE ABOVE IS INDISTINGUISHABLE FROM "every declared id must be assessed", which would
		// block a PWU permanently the moment a declared policy is SUSPENDED — no route forward, no remedy. `R19`
		// demands a verdict only from a policy that CURRENTLY GOVERNS, and this is that half.
		//
		// ⚠ THE ARRANGEMENT IS THE RED TEST'S, ONE FIELD DIFFERENT: the silent policy is SUSPENDED rather than
		// ACTIVE. Same two policies, same drive, same claim.
		const id = (p: string, n: string) => `${p}_01ARZ3NDEKTSV4RRFFQ69G5J${n}`;
		const pwu = id('pwu', '01');
		const polAssessed = id('pol', '02');
		const polSilent = id('pol', '03');
		const asm = id('asm', '04');
		seedPolicy(polAssessed);
		seedPolicy(polSilent);
		proposePwu(pwu, [polAssessed, polSilent]);
		ok(
			dispatch('SuspendAssurancePolicy', { policyId: polSilent }, polSilent, 'ASSURANCE_POLICY'),
			'suspend the silent policy'
		);
		driveToReady(pwu);
		assess(asm, polAssessed, pwu, 'SATISFIED');
		driveAssuranceToAssessing(pwu);
		ok(
			setAssurance(pwu, 'SATISFIED', [asm]),
			'a SUSPENDED declared policy is not demanded — it cannot be assessed, so demanding it is a refusal with no route forward'
		);
		expect(stateOf(pwu).assuranceState).toBe('SATISFIED');
	});

	// ── ⭐⭐ `R21` — THE SAME QUESTION, RE-ASKED AT PROMOTION ──────────────────────────────────────
	//
	// ⛔ `PromoteBaseline` BUILT ITS "required assessments" FROM `p.requiredAssessmentIds` — the CALLER'S OWN
	// LIST — so a promotion naming none passed that arm vacuously. Same defect, one gate over, surviving only as
	// a mutation note on a row marked ENFORCED.
	//
	// ⭑ AND THE ARRANGEMENT BELOW IS ONE THE ARRIVAL-TIME GUARD STRUCTURALLY CANNOT CATCH: the PWU reached
	// SATISFIED LAWFULLY, with its declared policy satisfied at the time. The erasure happens AFTERWARDS. Only a
	// gate that re-asks at promotion sees it.

	const promoteWith = (
		pwu: string,
		tag: string,
		// ⭑ OTHER ITEMS THE BASELINE FREEZES BESIDE THE PWU — so the “not a PWU” arm can be driven with a real
		// object rather than by asserting about a shape nothing built.
		alsoItems: readonly string[] = []
	): { readonly promote: () => Outcome; readonly decision: string } => {
		const id = (p: string, n: string) => `${p}_01ARZ3NDEKTSV4RRFFQ69G5${tag}${n}`;
		const decision = id('dec', '90');
		const baseline = id('bsl', '91');
		ok(
			dispatch(
				'ProposeDecision',
				{
					decisionType: 'PROMOTE_BASELINE',
					// ⛔ THE DECISION MUST NAME THE BASELINE (`REG-F-073`) — without it, any effective promotion
					// decision in the store would authorize any promotion.
					subjectObjectIds: [pwu, baseline],
					selectedOption: 'promote',
					rationale: 'ready',
					authority: { actorId: 'u1', actorType: 'HUMAN', displayName: 'Controller' }
				},
				decision,
				'DECISION'
			),
			'propose the promotion decision'
		);
		ok(
			dispatch(
				'ApproveDecision',
				{
					selectedOption: 'promote',
					rationale: 'ready',
					consideredEvidenceIds: [],
					consideredObservationIds: [],
					subjectSemanticVersions: { [pwu]: 1 }
				},
				decision,
				'DECISION'
			),
			'approve it'
		);
		ok(
			dispatch(
				'CreateBaseline',
				{ baselineType: 'ARCHITECTURE', itemObjectIds: [pwu, ...alsoItems], assuranceAssessmentIds: [] },
				baseline,
				'BASELINE'
			),
			'create the baseline'
		);
		ok(dispatch('SubmitBaselineForReview', {}, baseline, 'BASELINE'), 'submit');
		ok(dispatch('ApproveBaseline', {}, baseline, 'BASELINE'), 'approve');
		return {
			decision,
			promote: () =>
				dispatch(
					'PromoteBaseline',
					{
						promotionDecisionId: decision,
						expectedItemObjectVersions: [pwu, ...alsoItems].map((objectId) => ({
							objectId,
							semanticVersion: 1
						})),
						// ⛔ EMPTY, DELIBERATELY — AND THAT IS THE DEFECT IN ONE FIELD. This is the promoter's own list,
						// and before `R21` an empty one passed the required-assessment arm vacuously.
						requiredAssessmentIds: []
					},
					baseline,
					'BASELINE'
				)
		};
	};

	it('⭐ CONTROL — a baseline over a LAWFULLY satisfied item promotes, naming NO assessments', () => {
		// ⛔ WITHOUT THIS THE REFUSAL BELOW IS INDISTINGUISHABLE FROM "R21 blocks every promotion". The promoter
		// still names no assessments here; what makes this one lawful is the ITEM's own declared policy, which
		// spoke and said SATISFIED.
		const { pwu, asmCited } = arrangeWorkLifecycle('P', 'SATISFIED');
		ok(claimSatisfied(pwu, [asmCited]), 'the PWU reaches SATISFIED lawfully');
		expect(stateOf(pwu).assuranceState).toBe('SATISFIED');
		ok(promoteWith(pwu, 'P').promote(), 'and its baseline promotes');
	});

	it('⭐ the PwuTYPE half of the union binds too — a policy the TYPE requires is demanded of the instance', () => {
		// ⛔ MEASURED GAP, NOT A BELT-AND-BRACES TEST. `declaredAssurancePolicyIds` is the union of the PWU's own
		// `assurancePolicyIds` and its PwuType's `requiredAssurancePolicyIds`, and the union has been landed since
		// `JAN-PWU007` — but EVERY test of this guard, and BOTH enforcement-register probes, declare policies ON
		// THE PWU and never build a PwuType at all. The type half was held only by a mutant whose victim lives in
		// another package, so at this command seam it was never driven in either direction.
		//
		// ⭑ AND IT IS THE HALF A PWA AUTHOR ACTUALLY USES: a PWU TYPE is what an author declares policies on when
		// designing an architecture; the instance inherits them. That is the sponsor's own scenario.
		const id = (p: string, n: string) => `${p}_01ARZ3NDEKTSV4RRFFQ69G5T${n}`;
		const pwa = id('pwa', '01');
		const type = id('pwt', '02');
		const pwu = id('pwu', '03');
		const polOnType = id('pol', '04');
		seedPolicy(polOnType);
		ok(
			dispatch(
				'CreatePwa',
				{ pwaId: pwa, name: 'A', description: 'd', domain: 'test', version: '1.0.0' },
				pwa,
				'PROFESSIONAL_WORK_ARCHITECTURE'
			),
			'create the PWA the type belongs to'
		);
		ok(
			dispatch(
				'DefinePwuType',
				{
					pwuTypeId: type,
					pwaId: pwa,
					pwuKind: 'ARCHITECTURE',
					name: 'Architecture type',
					purpose: 'p',
					isRoot: true,
					// ⭐ DECLARED ON THE TYPE, AND NOWHERE ELSE. The instance below names no policy of its own.
					requiredAssurancePolicyIds: [polOnType]
				},
				type,
				'PWU_TYPE'
			),
			'define the type that requires the policy'
		);
		proposePwu(pwu, [], type);
		expect(stateOf(pwu).assurancePolicyIds, 'the instance declares NOTHING itself').toEqual([]);
		driveToReady(pwu);
		// ⛔ AN UNRELATED SATISFIED ASSESSMENT IS CITED, AND THAT IS NOT PADDING. Without it
		// `rejectUnbackedDisposition` refuses first — for citing nothing — and the refusal would prove nothing
		// about THIS guard. An arrangement that trips the wrong guard is not evidence about the one under test,
		// which this session learned by making exactly that mistake while probing the erasure.
		const polOther = id('pol', '05');
		const asmCited = id('asm', '06');
		seedPolicy(polOther);
		assess(asmCited, polOther, pwu, 'SATISFIED');
		driveAssuranceToAssessing(pwu);
		const refused = setAssurance(pwu, 'SATISFIED', [asmCited]);
		expect(refused.status).toBe('REJECTED');
		expect(refused.message, 'a policy required by the TYPE must be demanded of the INSTANCE').toContain(
			polOnType
		);
	});

	it('⭑ a baseline item that is NOT a PWU is passed over — it carries no declarations to ask about', () => {
		// ⚠ A BASELINE ITEM MAY BE ANY GOVERNED OBJECT. Only a PWU carries `assurancePolicyIds`; asking this of an
		// ARTIFACT would be asking a question its shape cannot answer, and the arms that own it are elsewhere.
		// THE MUTANT: drop the objectType test — every non-PWU item would then be read for a field it has not got.
		const { pwu, asmCited } = arrangeWorkLifecycle('R', 'SATISFIED');
		ok(claimSatisfied(pwu, [asmCited]), 'the PWU reaches SATISFIED lawfully');
		const art = 'art_01ARZ3NDEKTSV4RRFFQ69G5R80';
		ok(
			dispatch(
				'RecordArtifact',
				{
					artifactId: art,
					artifactType: 'work-product',
					mediaType: 'text/plain',
					storageProvider: 'test',
					storageKey: 'k',
					contentHash: 'sha256:0',
					byteSize: 1,
					producingPwuId: pwu,
					securityClassification: 'unclassified',
					retentionClass: 'retained-by-participation',
					status: 'recorded'
				},
				art,
				'ARTIFACT'
			),
			'record an artifact to put in the baseline beside the PWU'
		);
		ok(promoteWith(pwu, 'R', [art]).promote(), 'the artifact item is passed over and the promotion stands');
	});

	it('⭑ a PWU item declaring NO policies is passed over — this guard has no opinion about it', () => {
		// ⛔ A PWU MAY LEGALLY DECLARE ZERO POLICIES, and whether work may be satisfied with NO declared assurance
		// at all is a DIFFERENT rule with a different subject. `R19` narrows an existing guard; it does not invent
		// a requirement that every PWU declare something. THE MUTANT: drop the `declared.length === 0`
		// short-circuit — `aggregateAssuranceDisposition([])` answers UNASSESSED, and every zero-declaring PWU
		// becomes unpromotable.
		const id = (p: string, n: string) => `${p}_01ARZ3NDEKTSV4RRFFQ69G5S${n}`;
		const pwu = id('pwu', '01');
		proposePwu(pwu, []);
		expect(stateOf(pwu).assurancePolicyIds).toEqual([]);
		ok(promoteWith(pwu, 'S', []).promote(), 'a PWU declaring nothing does not block its baseline');
	});

	it('⭐⛔ REFUSES a promotion whose ITEM\'s declared assurance no longer stands — the caller names nothing', () => {
		// ⭑ THE ITEM REACHED SATISFIED LAWFULLY AND THEN ITS VERDICT WAS ERASED. The arrival-time guard already
		// ran and passed — correctly, at the time. `R21` is the re-ask, and this is the arrangement that shows
		// why re-asking is not redundant with asking once.
		const { pwu, polDeclared, asmCited } = arrangeWorkLifecycle('Q', 'SATISFIED');
		ok(claimSatisfied(pwu, [asmCited]), 'the PWU reaches SATISFIED lawfully');
		const promotion = promoteWith(pwu, 'Q');
		const fresh = 'asm_01ARZ3NDEKTSV4RRFFQ69G5Q99';
		ok(
			dispatch(
				'RequestAssuranceAssessment',
				{
					assessmentId: fresh,
					assurancePolicyId: polDeclared,
					policyVersion: '1.0.0',
					subjectObjectIds: [pwu],
					subjectSemanticVersions: { [pwu]: 1 },
					claimIds: []
				},
				fresh,
				'ASSURANCE_ASSESSMENT'
			),
			'a re-assessment is requested and left unconcluded — still a lawful act'
		);
		const refused = promotion.promote();
		expect(refused.status, `expected a refusal: ${refused.message ?? ''}`).toBe('REJECTED');
		expect(refused.message).toContain('UNSUPPORTED_ITEM_ASSURANCE');
		expect(refused.message, 'the refusal must name the ITEM, not only the baseline').toContain(pwu);
		expect(refused.message, 'and the policy whose word is missing').toContain(polDeclared);
		expect(refused.message).toContain('composed disposition EVIDENCE_REQUIRED');
	});
});
