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

	const proposePwu = (pwuId: string, declared: readonly string[]): void => {
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
		disposition: string
	): void => {
		ok(
			dispatch(
				'RequestAssuranceAssessment',
				{
					assessmentId,
					assurancePolicyId: policyId,
					policyVersion: '1.0.0',
					subjectObjectIds: [subject],
					subjectSemanticVersions: { [subject]: 1 },
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
						subjectSemanticVersions: { [subject]: 1 },
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

	// ── THE DISCLOSED RESIDUAL, OBSERVED RATHER THAN ASSERTED ───────────────────────────────────────────────

	it('ADMITS SATISFIED while a declared policy has NO assessment at all — §28.2 rung 3 is NOT closed here', () => {
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
		// `polSilent` is declared and NEVER assessed. This ACCEPTANCE is the residual this file discloses; the
		// day it is closed, this test reddens and must be re-dispositioned rather than deleted.
		ok(
			setAssurance(pwu, 'SATISFIED', [asm]),
			'an unassessed declared policy does not block satisfaction'
		);
		expect(stateOf(pwu).assuranceState).toBe('SATISFIED');
	});
});
