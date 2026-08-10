// REG-F-105, RULED (REG-D-041) — mandatoriness is a fact of the APPROVED PLAN, never a claim in the skip request.
//
// ── THE DEFECT THIS CLOSES ────────────────────────────────────────────────────────────────────────────────────
// RPH-DOC-002 §21.1: *"A skipped mandatory step requires an authorized plan revision or waiver."* Canon STA-8
// carries it with the WHY: *"a silently skipped mandatory step is laundered de-scoping."* And NOTHING recorded
// which steps were mandatory — `ExecutionStep` declared twelve fields and none of them was optionality — so
// `canSkipStep` read `p.mandatory ?? true` OUT OF THE SKIPPER'S OWN REQUEST PAYLOAD.
//
// The fail-closed default was right and powerless: right on ABSENCE, powerless against ASSERTION. **The party the
// rule constrains supplied the fact that decided whether the rule applied to them** — which Guide §8.4 L844
// forbids in terms: *"the producer cannot exempt its own output, and ambiguity resolves to material."*
//
// ── WHY `strength`, AND WHY ON THE STEP ───────────────────────────────────────────────────────────────────────
// The ratified rule's own REMEDY settles the carrier. §21.1 does not say "requires a waiver"; it says "requires an
// authorized PLAN REVISION or waiver". A remedy of *revise the plan* is coherent only if the mandatoriness is a
// fact OF THE PLAN. (Derived-from-obligations would be remedied by revising the obligation; caller-asserted would
// need no remedy at all.) The enum is REUSED from `Obligation.strength` (DOC-002 §10.1) rather than minted, and it
// is deliberately NOT a boolean: Guide §16 item 12 / REG-Q-012 say *"Never implement waiver as a Boolean"*, and
// this repository already learned it once — `assessment-criterion-contract.test.ts` records an invented
// `mandatory: boolean` that had collapsed a five-level `severityIfNotMet`.
//
// ── WHAT THIS FILE PROVES, AND THE ONE THING IT MUST NOT DO ───────────────────────────────────────────────────
// Four cases over ONE plan with NO authorization anywhere. The MANDATORY and ADVISORY steps are built by the same
// factory and differ in `strength` ALONE — if they differed in anything else, "ACCEPTED" could be some other
// permission and the discrimination would be unproved. That is the control, and it is why `mkStep` takes the
// strength as its only variable.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-08-10T00:00:00Z';
const actor: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69H4100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H4110';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69H4120';

/** The four steps, named for what they declare. `legacy` declares nothing — a plan authored before the field. */
const MANDATORY = `${PLAN}-s-mandatory`;
const CONDITIONAL = `${PLAN}-s-conditional`;
const ADVISORY = `${PLAN}-s-advisory`;
const LEGACY = `${PLAN}-s-legacy`;

describe('REG-F-105 — a step is skippable because the PLAN says so, not because the skipper says so', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	function dispatch(commandType: string, payload: unknown, id: string, aggType: string) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'f105',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}
	const ok = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		return r;
	};
	const stepStateOf = (stepId: string) =>
		(store.loadObject(PLAN)!.state as { steps: Array<{ id: string; stepState: string }> }).steps.find(
			(s) => s.id === stepId
		)?.stepState;

	/**
	 * ONE factory, ONE variable. `strength: undefined` is spread away, producing the pre-2026-08-10 shape — so the
	 * legacy case is the REAL absent-field shape and not a hand-written imitation of it.
	 */
	const mkStep = (id: string, strength?: string) => ({
		id,
		executionPlanId: PLAN,
		stepType: 'TRANSFORMATION',
		purpose: 'work',
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState: 'QUEUED',
		...(strength === undefined ? {} : { strength })
	});

	/** No `waiverOrRevisionId`, ever. Every case in this file is an UNAUTHORIZED skip. */
	const skip = (stepId: string) =>
		dispatch('SkipExecutionStep', { stepId }, PLAN, 'EXECUTION_PLAN');

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		}).as(TEST_CRED.human);
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
				title: 'Arch',
				description: 'd',
				intentId: INTENT,
				boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [],
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
		ok(
			dispatch(
				'ProposeExecutionPlan',
				{
					executionPlanId: PLAN,
					workUnitId: PWU,
					steps: [
						mkStep(MANDATORY, 'MANDATORY'),
						mkStep(CONDITIONAL, 'CONDITIONAL'),
						mkStep(ADVISORY, 'ADVISORY'),
						mkStep(LEGACY)
					],
					transitions: [],
					retryPolicy: {},
					tacticalChangePolicy: {},
					escalationPolicy: {},
					terminationPolicy: {}
				},
				PLAN,
				'EXECUTION_PLAN'
			),
			'ProposeExecutionPlan'
		);
		ok(dispatch('ApproveExecutionPlan', {}, PLAN, 'EXECUTION_PLAN'), 'approve');
		ok(
			dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }, PLAN, 'EXECUTION_PLAN'),
			'activate'
		);
	});

	/** A refusal that still moved the step is no refusal. Every negative case asserts both halves. */
	function expectRefused(stepId: string): void {
		const r = skip(stepId);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message, 'the refusal must name §21.1').toContain('§21.1');
		expect(stepStateOf(stepId), 'a refused skip must leave the step where it was').toBe('QUEUED');
	}

	it('REFUSES an unauthorized skip of a step the plan declares MANDATORY', () => {
		expectRefused(MANDATORY);
	});

	it('REFUSES an unauthorized skip of a CONDITIONAL step — ambiguity resolves to material', () => {
		// No ratified applicability predicate exists (the Guide defers the structured predicate to M7/M9/M11), so
		// there is nothing to evaluate the condition against. Guide §8.4 L844 fixes the posture: "ambiguity
		// resolves to material". A CONDITIONAL step is therefore gated exactly as a MANDATORY one until the
		// predicate is ratified — the day it lands, THIS is the test that must be revisited deliberately.
		expectRefused(CONDITIONAL);
	});

	it('REFUSES an unauthorized skip of a LEGACY step that declares no strength at all', () => {
		// The seeded reference undertaking and every plan authored before 2026-08-10 are this shape. Absent =>
		// MANDATORY keeps them exactly as fail-closed as `mandatory ?? true` did, with the difference that the
		// default can now be displaced only by the PLAN and not by the request.
		expectRefused(LEGACY);
	});

	it('ACCEPTS an unauthorized skip of a step the plan declares ADVISORY — the control that makes the other three mean something', () => {
		// Same factory, same plan, same caller, same command shape, no authorization: the ONLY difference from the
		// MANDATORY case is the declared strength. Without this the three refusals above would be equally
		// consistent with a gate that refuses every skip.
		ok(skip(ADVISORY), 'skip the ADVISORY step');
		expect(stepStateOf(ADVISORY)).toBe('SKIPPED');
	});

	it('the skipper can no longer make the claim at all — `mandatory` is refused by the schema', () => {
		// THE POINT OF THE RULING, and the one assertion that would still fail if `strength` were read but the old
		// payload field were left in place as a fallback. `SkipExecutionStepPayloadSchema` is a strictObject, so a
		// caller still asserting its own exemption is a LOUD failure rather than a silently ignored field.
		const r = dispatch(
			'SkipExecutionStep',
			{ stepId: MANDATORY, mandatory: false },
			PLAN,
			'EXECUTION_PLAN'
		);
		// VALIDATION_FAILED, not REJECTED: the refusal comes from the payload SCHEMA, before any handler runs. That
		// distinction is the guarantee — a semantic refusal could be narrowed by a later handler edit, whereas an
		// unknown key on a strictObject cannot be admitted without changing the contract itself.
		expect(r.status).toBe('VALIDATION_FAILED');
		expect(stepStateOf(MANDATORY), 'the step must not have moved').toBe('QUEUED');
	});

	it('CONTROL — an authorized skip of the MANDATORY step still succeeds, so the gate is not simply closed', () => {
		// The other half of the discrimination: §21.1 permits the skip WITH an authorized plan revision. If this
		// reddened, `strength` would have turned a governed act into an impossible one.
		const DEC = 'dec_01ARZ3NDEKTSV4RRFFQ69H4130';
		ok(
			dispatch(
				'ProposeDecision',
				{
					decisionType: 'REPLAN',
					subjectObjectIds: [PLAN],
					selectedOption: 'retire the step under an authorized plan revision',
					rationale: 'the approach changed',
					authority: actor,
					executionSkipAuthorization: {
						executionPlanId: PLAN,
						executionStepIds: [MANDATORY],
						rationale: 'this step alone is retired'
					}
				},
				DEC,
				'DECISION'
			),
			'ProposeDecision'
		);
		ok(
			dispatch(
				'ApproveDecision',
				{
					selectedOption: 'retire the step under an authorized plan revision',
					rationale: 'approved',
					consideredEvidenceIds: [],
					consideredObservationIds: [],
					subjectSemanticVersions: { [PLAN]: 1 }
				},
				DEC,
				'DECISION'
			),
			'ApproveDecision'
		);
		ok(
			dispatch(
				'SkipExecutionStep',
				{ stepId: MANDATORY, waiverOrRevisionId: DEC },
				PLAN,
				'EXECUTION_PLAN'
			),
			'authorized skip'
		);
		expect(stepStateOf(MANDATORY)).toBe('SKIPPED');
	});
});
