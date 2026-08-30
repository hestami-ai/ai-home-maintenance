// JAN-SLICE-SWP-03 — the shared journey arrangement the RPH-E2E-002..007 Slices branch from.
//
// ── WHY THIS EXISTS, AND WHY IT IS NOT `driveReferenceUndertaking` ────────────────────────────────────────────
// `RPH-E2E-001` is the normal path, and the reference drive IS that path — so the E2E-001 Slice reuses it whole.
// The other six rules are all DEPARTURES from it, and the reference drive structurally cannot produce a single
// one of them:
//
//   1. `earnAssurance` types its disposition parameter `'SATISFIED' | 'CONDITIONALLY_SATISFIED'`
//      (reference-undertaking.ts, the `earnAssurance` declaration). REJECTED is not expressible. That alone rules
//      out `RPH-E2E-002` and `RPH-E2E-005`.
//   2. Its `send` is FAIL-LOUD — any non-ACCEPTED result throws — so a scenario whose whole point is an expected
//      REFUSAL (`RPH-E2E-007`) cannot be driven through it.
//   3. It is monolithic, with no stop-at-step-N option (only `undertakingId` / `pwuTypeByKind` /
//      `assurancePolicyId`), so it cannot be INTERRUPTED — which is the entire antecedent of `RPH-E2E-006`.
//
// ⚠ SO THIS IS NOT A SECOND ENGINE, A STUB, OR A SIMULATION. `SL-7` forbids all three. Every act below is a real
// `DomainCommand` dispatched through the real bus into a real `SqliteStorageAdapter`, and every one is CHECKED.
// What this module does is stand up the *shared prefix* the six departures have in common — an intent, an
// architecture PWU, a governing policy, an assessment — so each Slice contains only the acts that make it
// different from the others. It arranges; it asserts nothing.
//
// ── AND WHY IT LIVES HERE RATHER THAN IN `src/slices/` ───────────────────────────────────────────────────────
// `tsconfig.build.json` excludes `src/**/__tests__/**`, so this never reaches `dist`. A helper in `src/slices/`
// proper would ship to consumers as production surface and enter the coverage denominator — the same class of
// mistake as `REG-F-293`, where the roadmap named Slices `*.slice.ts` and would have shipped every one of them.
//
// ⚠ AND IT MUST NOT SIT UNDER A `slices/` SEGMENT AT ALL. It first did — at `src/slices/__tests__/journey.ts` —
// and `verif/slice-ledger.ts`'s blind-spot sweep IMMEDIATELY caught it: limb D-2 flags every source file under a
// `slices/` directory, precisely so a Slice-shaped file cannot hide where the ledger's narrower recognition
// predicate does not look. The gate was right and the placement was wrong. Moving the file was the correct
// answer; widening the predicate to excuse it would have been the defect that gate exists to prevent.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import type { StorageAdapter } from '@janumipwb/rph-ports';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { ontology } from '@janumipwb/rph-product-realization-pwa';

import { createEngine, type AuthedEngineHandle } from './../index.js';

/** The one timestamp every Slice journey uses. Fixed, because a Slice that varies its clock varies its trace. */
export const JOURNEY_TS = '2026-08-30T00:00:00Z';

/**
 * The acting principal.
 *
 * ⚠ IT MUST BE THE ACTOR THE DECISIONS NAME. `REG-F-014` refuses a Decision whose declared `authority` is not the
 * authenticated principal, and every journey below proposes at least one. Borrowing the shared `TEST_CRED.human`
 * (`u1`) would collapse each arrangement at `ProposeDecision` — and a Slice whose headline assertion is a REFUSAL
 * would then still pass, having arranged nothing. That exact failure is recorded twice in this repository
 * (`baseline-open-blocking-observation.test.ts` and `baseline-stale-decision-version.test.ts` both say so in their
 * headers), which is why it is stated here once rather than rediscovered six times.
 */
export const JOURNEY_ACTOR = {
	actorId: 'owner-1',
	actorType: 'HUMAN' as const,
	displayName: 'Undertaking Owner'
};

const DIR = testDirectory([
	{ ...JOURNEY_ACTOR, executionInstanceId: 'exec-production', tenantId: 'tenant-test', organizationId: 'org-test' }
]);

/** The policy the Slice journeys are judged under. */
export const JOURNEY_POLICY = 'pol_01ARZ3NDEKTSV4RRFFQ69G5S00';

/**
 * ⚠ `RESHAPE_PWU` IS IN `permittedControlActions` DELIBERATELY, AND THE REFERENCE POLICY DOES NOT HAVE IT.
 * `REFERENCE_ASSURANCE_POLICY` permits only `['CONTINUE', 'GATHER_CONTEXT', 'REQUEST_HUMAN_DECISION']`, so a
 * journey judged under it could not carry the *"controller recommends reshape or replan"* half of `RPH-E2E-002`
 * even as a recommendation. The ratified `pol_architecture_coverage` permits `RESHAPE_PWU`, and this policy
 * mirrors that permission rather than borrowing the catalog policy wholesale — seeding the catalog drags in the
 * PWA, its PWU types and its floor, none of which these journeys assert anything about.
 */
const PERMITTED_CONTROL_ACTIONS = ['CONTINUE', 'GATHER_CONTEXT', 'RESHAPE_PWU', 'REQUEST_HUMAN_DECISION'];

export interface JourneyObservation {
	readonly findingCode: string;
	readonly severity: string;
	readonly statement: string;
}

export interface JourneyOptions {
	/** Supply a file-backed adapter to drive a real restart (`RPH-E2E-006`). Defaults to in-memory. */
	readonly store?: StorageAdapter;
	/**
	 * ⚠ `NONE` IS NOT THE DEFAULT AND MUST NOT BECOME ONE. `DIFFERENT_AGENT` mirrors the ratified
	 * `pol_architecture_coverage`. The independence check runs BEFORE every outcome gate in
	 * `completeAssuranceAssessment`, so it fires on a REJECTED disposition too — an assessment whose producer
	 * equals its evaluator lands in INDEPENDENCE_VIOLATION, *not* REJECTED, and a Slice asserting "assurance is
	 * REJECTED" would then be red for a reason unrelated to what it measures.
	 */
	readonly independenceRequirement?: string;
}

export interface Journey {
	readonly engine: AuthedEngineHandle;
	readonly store: StorageAdapter;
	/** Dispatch and REQUIRE acceptance. Throws with the refusal in the message. */
	readonly send: (commandType: string, aggregateType: string, aggregateId: string, payload: unknown) => void;
	/** Dispatch and RETURN the result unchecked — for the acts a Slice expects to be refused. */
	readonly attempt: (
		commandType: string,
		aggregateType: string,
		aggregateId: string,
		payload: unknown
	) => ReturnType<AuthedEngineHandle['dispatch']>;
	readonly state: (objectId: string) => Record<string, unknown> | undefined;
}

/**
 * Stand up an engine and the acting session. Nothing professional has happened yet.
 *
 * ⚠ `send` IS FAIL-LOUD AND `attempt` IS NOT, AND THE DISTINCTION IS THE POINT. Four of the six Slices assert a
 * REFUSAL. If the only available verb threw on refusal, those Slices would have to arrange their refusal outside
 * the journey; if the only verb swallowed refusals, an arrangement step could silently fail and leave the Slice
 * asserting a true thing about a world it never built. That is not hypothetical — `floor-waiver-scope.test.ts`
 * shipped with EVERY `RequestAssuranceAssessment` refused and both its tests passing, because the refusal it
 * asserted and the refusal it accidentally caused shared an error code.
 */
export function beginJourney(opts: JourneyOptions = {}): Journey {
	const store = opts.store ?? new SqliteStorageAdapter({ now: () => JOURNEY_TS });
	let n = 0;
	const engine = createEngine({
		authenticate: DIR.authenticate,
		ontology,
		store,
		now: () => JOURNEY_TS,
		newEventId: () => `evt_${++n}`
	}).as(DIR.credentialFor(JOURNEY_ACTOR.actorId));

	let c = 0;
	const command = (
		commandType: string,
		targetAggregateType: string,
		targetAggregateId: string,
		payload: unknown
	): DomainCommand => {
		c += 1;
		return {
			commandId: `sl-cmd-${c}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType,
			targetAggregateId,
			issuedAt: JOURNEY_TS,
			correlationId: 'slice-journey',
			idempotencyKey: `sl-idem-${c}`,
			payload
		};
	};

	const attempt: Journey['attempt'] = (t, at, ai, p) => engine.dispatch(command(t, at, ai, p));

	const send: Journey['send'] = (t, at, ai, p) => {
		const result = attempt(t, at, ai, p);
		if (result.status !== 'ACCEPTED' && result.status !== 'DUPLICATE') {
			throw new Error(
				`slice journey failed at #${c} ${t} (${ai}): ${result.status} ${JSON.stringify(result.error)}`
			);
		}
	};

	return {
		engine,
		store,
		send,
		attempt,
		state: (id) => engine.loadObject(id)?.state as Record<string, unknown> | undefined
	};
}

/**
 * Create and ACTIVATE the governing policy.
 *
 * A policy that is merely cited does not govern: `requestAssuranceAssessment` fails closed on a policy the store
 * has never seen, and an assessment citing a dangling id is a governance fact pointing at nothing — the defect
 * `REFERENCE_ASSURANCE_POLICY`'s own header records.
 */
export function seedJourneyPolicy(j: Journey, opts: JourneyOptions = {}): string {
	j.send('CreateAssurancePolicy', 'ASSURANCE_POLICY', JOURNEY_POLICY, {
		policyId: JOURNEY_POLICY,
		version: '1.0.0',
		name: 'Slice Journey Architecture Review',
		purpose: 'Determine whether an architecture serves the approved intent it was decomposed to satisfy',
		rationale:
			'The Slice journeys of RPH-E2E-002..007 all turn on an assurance verdict that is not a plain SATISFIED, so they need a policy that can reach every disposition and permit a corrective control action.',
		applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
		evaluatedClaimTypes: ['FITNESS'],
		criteria: [
			{
				id: 'SJ-01',
				name: 'Tenant isolation is enforceable',
				description:
					'The architecture states a tenant isolation mechanism that can be enforced and evidenced, rather than asserted.',
				criterionType: 'QUALITATIVE',
				evaluationMethod: 'HUMAN_JUDGMENT',
				requiredEvidenceIds: [],
				severityIfNotMet: 'BLOCKING',
				mayBeNotApplicable: false
			}
		],
		evaluatorRole: 'REVIEWER',
		independenceRequirement: opts.independenceRequirement ?? 'DIFFERENT_AGENT',
		findingDefinitions: [
			{
				code: 'MISSING_SECURITY_BOUNDARY',
				name: 'No enforceable security boundary',
				description:
					'The architecture does not establish an enforceable boundary between tenants, so the isolation claim cannot be sustained on the admitted evidence.',
				defaultSeverity: 'BLOCKING',
				affectedClaimTypes: ['FITNESS'],
				defaultControlActions: ['RESHAPE_PWU', 'REQUEST_HUMAN_DECISION']
			}
		],
		permittedControlActions: PERMITTED_CONTROL_ACTIONS
	});
	j.send('ActivateAssurancePolicy', 'ASSURANCE_POLICY', JOURNEY_POLICY, { policyId: JOURNEY_POLICY });
	return JOURNEY_POLICY;
}

/** Capture and approve an intent, then propose an architecture PWU under it. Returns nothing; ids are the caller's. */
export function seedIntentAndArchitecture(
	j: Journey,
	ids: { readonly intentId: string; readonly pwuId: string },
	over: { readonly assurancePolicyIds?: readonly string[] } = {}
): void {
	j.send('CaptureIntent', 'INTENT', ids.intentId, {
		intentId: ids.intentId,
		originatingExpression: 'ship a multi-tenant field service platform with enforceable tenant isolation',
		ontologyId: 'o',
		ontologyVersion: '1'
	});
	// ⚠ THE INTENT MUST REACH AT LEAST PROVISIONAL BEFORE ANY PWU UNDER IT CAN BE MARKED READY. The shape
	// readiness contract (DOC-002 §9, enforced by `markPwuReady`) refuses a root PWU whose intent is still RAW.
	// Driven, not assumed: omitting these three acts refuses `MarkPwuReady` with that reason in the message.
	j.send('BeginIntentDiscovery', 'INTENT', ids.intentId, {});
	j.send('ProvisionIntent', 'INTENT', ids.intentId, { ambiguityIds: [] });
	j.send('FormalizeIntent', 'INTENT', ids.intentId, {
		formalizedObjective: 'A multi-tenant field service management SaaS with enforceable tenant isolation',
		desiredOutcomes: [{ description: 'Dispatch a job to a technician' }],
		successConditions: [{ statement: 'A customer request becomes an invoiced job' }],
		nonGoals: ['payroll'],
		ambiguityIds: [],
		constraintIds: [],
		stakeholderIds: []
	});
	j.send('ApproveIntent', 'INTENT', ids.intentId, {
		decisionId: 'dec_slice_intent',
		approvedSemanticVersion: 1,
		approvalScope: 'full'
	});
	j.send('ProposePwu', 'PROFESSIONAL_WORK_UNIT', ids.pwuId, {
		pwuId: ids.pwuId,
		pwuKind: 'ARCHITECTURE_DEFINITION',
		title: 'Architecture Definition',
		description: 'The architecture for the multi-tenant field service platform',
		intentId: ids.intentId,
		// ⚠ NON-EMPTY, AND THE SHAPE READINESS CONTRACT IS WHY. DOC-002 §9.1 requires an in-scope statement, an
		// out-of-scope statement (or an explicit "not yet known"), and an expected output. Empty arrays are
		// accepted by the SCHEMA and refused by the CONTRACT, one act later at `MarkPwuReady`.
		boundaries: {
			inScope: ['tenant isolation boundary', 'data partitioning model'],
			outOfScope: ['billing integration'],
			permittedChanges: [],
			prohibitedChanges: []
		},
		obligationIds: [],
		constraintIds: [],
		assumptionIds: [],
		expectedOutputs: [{ outputId: 'out_slice_architecture', kind: 'DOCUMENT' }],
		assurancePolicyIds: over.assurancePolicyIds ?? [JOURNEY_POLICY],
		riskProfile: {
			consequence: 'HIGH',
			uncertainty: 'MEDIUM',
			irreversibility: 'MEDIUM',
			securitySensitivity: 'HIGH',
			regulatoryExposure: 'LOW'
		}
	});
}

/**
 * The validator's verdict payload.
 *
 * ⚠ `recommendedControlActions` IS POPULATED HERE AND THAT IS LOAD-BEARING FOR `RPH-E2E-002`. The ratified rule
 * ends *"and the controller recommends reshape or replan"*. This field is where a VALIDATOR states such a
 * recommendation; whether anything downstream can read it is a separate question the Slice asserts rather than
 * assumes. `floorValidatorResult` in `rph-application` hard-codes it to `[]`, which is why this is a distinct
 * builder rather than an import — and `rph-application`'s `__tests__` are not exported from that package anyway.
 */
export function verdict(args: {
	readonly assessmentId: string;
	readonly subjectId: string;
	readonly subjectSemanticVersion: number;
	readonly disposition: string;
	readonly observations?: readonly JourneyObservation[];
	readonly recommendedControlActions?: readonly unknown[];
	readonly validatorId?: string;
	readonly policyId?: string;
}): Record<string, unknown> {
	const policyId = args.policyId ?? JOURNEY_POLICY;
	return {
		validatorId: args.validatorId ?? 'deterministic.slice-journey',
		validatorVersion: '1',
		policyId,
		policyVersion: '1.0.0',
		assessmentId: args.assessmentId,
		subjectObjectIds: [args.subjectId],
		subjectSemanticVersions: { [args.subjectId]: args.subjectSemanticVersion },
		claimResults: [],
		evidenceConsideredIds: [],
		evidenceRejected: [],
		observations: (args.observations ?? []).map((o) => ({
			findingCode: o.findingCode,
			severity: o.severity,
			statement: o.statement,
			subjectObjectIds: [args.subjectId]
		})),
		dispositionRecommendation: args.disposition,
		recommendedControlActions: args.recommendedControlActions ?? [],
		residualUncertainty: [],
		limitations: [],
		executionProvenance: {}
	};
}

/**
 * Request, begin and COMPLETE one assessment over `pwuId` with the given disposition.
 *
 * ⚠ THE `READY -> ASSESSING` ARROW IS NOT OPTIONAL (`REG-F-021` increment 3). `RequestAssuranceAssessment` lands
 * the assessment in READY, so `BeginAssuranceAssessment` must run before it can be completed. Omitting it does not
 * fail loudly at the request — it fails at completion, one step away from where the omission is.
 */
export function assess(
	j: Journey,
	args: {
		readonly assessmentId: string;
		readonly pwuId: string;
		readonly disposition: string;
		readonly subjectSemanticVersion?: number;
		readonly observations?: readonly JourneyObservation[];
		readonly recommendedControlActions?: readonly unknown[];
		readonly validatorId?: string;
		readonly policyId?: string;
	}
): void {
	const policyId = args.policyId ?? JOURNEY_POLICY;
	const version = args.subjectSemanticVersion ?? 1;
	j.send('RequestAssuranceAssessment', 'ASSURANCE_ASSESSMENT', args.assessmentId, {
		assessmentId: args.assessmentId,
		assurancePolicyId: policyId,
		policyVersion: '1.0.0',
		subjectObjectIds: [args.pwuId],
		subjectSemanticVersions: { [args.pwuId]: version },
		claimIds: []
	});
	j.send('BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', args.assessmentId, {});
	j.send('CompleteAssuranceAssessment', 'ASSURANCE_ASSESSMENT', args.assessmentId, {
		validatorResult: verdict({
			assessmentId: args.assessmentId,
			subjectId: args.pwuId,
			subjectSemanticVersion: version,
			disposition: args.disposition,
			observations: args.observations,
			recommendedControlActions: args.recommendedControlActions,
			validatorId: args.validatorId,
			policyId
		})
	});
}

/**
 * Move a PWU's axes. `ChangePwuState` is a MULTI-AXIS setter: every axis is stated on every hop, and an axis that
 * is not moving is restated at its current value rather than omitted.
 */
export function changeState(
	j: Journey,
	pwuId: string,
	axes: {
		readonly previousState: string;
		readonly newState: string;
		readonly executionState: string;
		readonly assuranceState: string;
		readonly shapeIntegrityState?: string;
		readonly supportingObjectIds?: readonly string[];
	}
): void {
	j.send('ChangePwuState', 'PROFESSIONAL_WORK_UNIT', pwuId, {
		previousState: axes.previousState,
		newState: axes.newState,
		executionState: axes.executionState,
		assuranceState: axes.assuranceState,
		shapeIntegrityState: axes.shapeIntegrityState ?? 'PRESERVED',
		reasonCode: 'CONTROLLER',
		supportingObjectIds: axes.supportingObjectIds ?? []
	});
}

/**
 * Plan, activate and RUN one execution step to SUCCEEDED, taking the PWU with it.
 *
 * ⚠ THE STEP IS `TRANSFORMATION`, NOT `MODEL_INVOCATION`, AND THAT IS A DELIBERATE NARROWING. `§8.4` makes
 * Reasoning Review mandatory *"when the transformation is produced by or materially shaped by an AI/agent"*, and
 * `completeExecutionStep` derives `aiProduced` FROM THE STEP TYPE rather than taking the caller's word — so a
 * `MODEL_INVOCATION` step obliges the whole de minimis floor (schema-invariant, identity-provenance,
 * reasoning-review). The reference drive satisfies that floor and is the right place for it to be exercised.
 * These Slices assert nothing about the floor, so claiming AI authorship here would oblige a floor whose
 * satisfaction would be arrangement noise — and an unsatisfied one would redden every Slice for a reason
 * unrelated to what it measures.
 *
 * ⚠ AND `executionState: 'SUCCEEDED'` IS EARNED, NOT ASSIGNED. `rejectUnbackedExecutionSuccess` requires the hop
 * to cite an EXECUTION_PLAN whose `workUnitId` is this PWU and which holds a step that actually reached
 * SUCCEEDED. The plan id is therefore passed as a supporting object; a hop that merely asserted the axis would be
 * refused, which is the guard doing its job.
 */
export function executeWork(
	j: Journey,
	args: {
		readonly pwuId: string;
		readonly planId: string;
		readonly stepId: string;
		readonly attemptId: string;
		readonly claimId: string;
		readonly evidenceId: string;
	}
): void {
	// The claim the work is meant to make true, asserted BEFORE the work runs. The evidence produced below
	// supports it, so the assessment that follows has something real to consider.
	j.send('AssertClaim', 'CLAIM', args.claimId, {
		statement: 'The architecture enforces tenant isolation',
		claimType: 'FITNESS',
		subjectObjectIds: [args.pwuId]
	});
	// PROPOSED -> SHAPING -> READY. `MarkPwuReady` declares only SHAPING as a source state, and the bus refuses an
	// UNDECLARED ARROW distinctly from an illegal one (REG-F-114): the machine may permit PROPOSED -> READY, but
	// this command does not claim to be the act that performs it.
	j.send('BeginPwuShaping', 'PROFESSIONAL_WORK_UNIT', args.pwuId, {});
	j.send('MarkPwuReady', 'PROFESSIONAL_WORK_UNIT', args.pwuId, {
		shapeReadinessAssessmentId: 'assess_shape',
		expectedSemanticVersion: 1
	});
	j.send('ProposeExecutionPlan', 'EXECUTION_PLAN', args.planId, {
		executionPlanId: args.planId,
		workUnitId: args.pwuId,
		steps: [
			{
				id: args.stepId,
				executionPlanId: args.planId,
				stepType: 'TRANSFORMATION',
				purpose: 'Produce the architecture definition',
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
	j.send('ApproveExecutionPlan', 'EXECUTION_PLAN', args.planId, {});
	j.send('ActivateExecutionPlan', 'EXECUTION_PLAN', args.planId, { authorizedRuntimeBindingIds: [] });
	changeState(j, args.pwuId, {
		previousState: 'READY',
		newState: 'PLANNED',
		executionState: 'PLANNED',
		assuranceState: 'UNASSESSED',
		supportingObjectIds: [args.planId]
	});
	changeState(j, args.pwuId, {
		previousState: 'PLANNED',
		newState: 'EXECUTING',
		executionState: 'QUEUED',
		assuranceState: 'UNASSESSED',
		supportingObjectIds: [args.planId]
	});
	j.send('StartExecutionStep', 'EXECUTION_PLAN', args.planId, { stepId: args.stepId });
	changeState(j, args.pwuId, {
		previousState: 'EXECUTING',
		newState: 'EXECUTING',
		executionState: 'RUNNING',
		assuranceState: 'UNASSESSED',
		supportingObjectIds: [args.planId]
	});
	// ⚠ THE STEP MUST PRODUCE SOMETHING. `completeExecutionStep` refuses with RPH_STEP_RESULT_MISSING unless the
	// completion carries recorded output or an EXPLICIT no-output result. `noOutputResult` was available and is
	// NOT used: its two success-compatible reasons are NO_DOWNSTREAM_CONSUMABLE_RESULT and SIDE_EFFECT_ONLY, and
	// an architecture definition is neither. Declaring one to get past the gate would be a false statement about
	// the work, which is the fabrication `SL-7` forbids — so the step produces real evidence instead.
	j.send('ProposeEvidence', 'EVIDENCE', args.evidenceId, {
		evidenceId: args.evidenceId,
		evidenceType: 'ARTIFACT',
		contentReference: { kind: 'INLINE', note: `Architecture definition produced by step ${args.stepId}` },
		producedBy: JOURNEY_ACTOR,
		supportsClaimIds: [args.claimId],
		contradictsClaimIds: [],
		scope: 'Architecture Definition',
		limitations: [],
		capturedAt: JOURNEY_TS
	});
	j.send('CompleteExecutionStep', 'EXECUTION_PLAN', args.planId, {
		executionStepId: args.stepId,
		executionAttemptId: args.attemptId,
		resultStatus: 'SUCCEEDED',
		outputArtifactIds: [],
		proposedEvidenceIds: [args.evidenceId],
		detectedAssumptionIds: [],
		structuredResult: {},
		executionProvenance: { evaluator: JOURNEY_ACTOR }
	});
	changeState(j, args.pwuId, {
		previousState: 'EXECUTING',
		newState: 'EXECUTING',
		executionState: 'SUCCEEDED',
		assuranceState: 'UNASSESSED',
		supportingObjectIds: [args.planId]
	});
}
