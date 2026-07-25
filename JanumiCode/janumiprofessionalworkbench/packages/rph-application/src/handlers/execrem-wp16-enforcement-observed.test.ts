// JAN-EXECREM WP-16 / SM-6 gate (c) — every rule the ENFORCEMENT REGISTER declares ENFORCED is OBSERVED refusing,
// end to end, through `Engine.dispatch`.
//
// THIS IS THE TEST THE REGISTER EXISTS TO FORCE. DS-001 §4 item 2: the coverage manifest certified RPH-PWU-010
// COVERED because a test called `canResumeExecutionOnPwu` and checked its return value. The predicate was correct;
// nothing in the running engine asked it. A pure-function assertion cannot distinguish "this rule is enforced"
// from "this function computes what the rule says", and the whole family of defects this programme fixes lives in
// that gap.
//
// So an ENFORCED claim is settled here and nowhere else, and it must survive three ways of being wrong:
//
//   ADMITTED    the command was accepted — the rule is not enforced at all.
//   WRONG_CODE  something refused, but a different check did.
//   MASKED      the right CODE from the wrong GUARD. `RPH_ILLEGAL_STATE_TRANSITION` is produced by the machine, by
//               four prechecks and by every source set in the system, so a probe asserting only the code proves
//               that SOMETHING refused. That is the vacuous negative, and it is why every row carries a distinct
//               >=20-character marker string that only its own refusal produces.
//
// EVERY PROBE CARRIES A CONTROL. A refusal proves nothing if the same command would have been refused anyway: the
// control is the SAME command accepted before the arranging act, so the arrangement is demonstrably what flipped
// it. Without that half, a handler that refused everything would pass this entire file.
//
// The probe map is TOTAL over `enforcedRuleIds()` by TYPE — adding an ENFORCED row without a probe is a compile
// error, which is the property that makes the register an instrument rather than a document.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import {
	classifyRefusal,
	ENFORCEMENT_REGISTER,
	enforcedRuleIds,
	type RegisteredRuleId
} from '@janumipwb/rph-domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedPwuWorkLifecycleState_FIXTURE } from './__tests__/pwu-fixtures.js';

const TS = '2026-07-12T00:00:00Z';
const actor: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69H6100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H6110';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69H6120';
const PLAN2 = 'plan_01ARZ3NDEKTSV4RRFFQ69H6130';
const sid = (i: number) => `${PLAN}-s${i}`;

const SAYS_NOTHING = {
	reason: 'NO_DOWNSTREAM_CONSUMABLE_RESULT' as const,
	detail: 'A coordination step; it authors no artifact.'
};

/** What a dispatch returned, reduced to the three fields `classifyRefusal` reads. */
interface Outcome {
	readonly status: string;
	readonly code?: string;
	readonly message?: string;
}

/** One rule's proof: the same command ACCEPTED before the arranging act, then REFUSED after it. */
interface Probe {
	/** What the arranging act is, and why it is the thing that should flip the answer. */
	readonly arrangement: string;
	readonly run: () => { readonly control: Outcome; readonly observed: Outcome };
}

describe('JAN-EXECREM WP-16 (c) — the enforcement register is OBSERVED, not asserted', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	function dispatch(
		commandType: string,
		payload: unknown,
		id = PLAN,
		aggType = 'EXECUTION_PLAN'
	): Outcome {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'wp16',
			idempotencyKey: `k-${n}`,
			payload
		};
		const r = engine.dispatch(command);
		return { status: r.status, code: r.error?.code, message: r.error?.message };
	}

	const ok = (r: Outcome, what: string): Outcome => {
		expect(r.status, `${what}: ${r.message}`).toBe('ACCEPTED');
		return r;
	};

	const mkStep = (i: number) => ({
		id: sid(i),
		executionPlanId: PLAN,
		stepType: 'HUMAN_INTERACTION',
		purpose: `work ${i}`,
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState: 'QUEUED'
	});

	const chg = (previousState: string, newState: string) =>
		dispatch(
			'ChangePwuState',
			{
				previousState,
				newState,
				executionState: 'NOT_PLANNED',
				assuranceState: 'UNASSESSED',
				shapeIntegrityState: 'PRESERVED',
				reasonCode: 'fixture',
				supportingObjectIds: []
			},
			PWU,
			'PROFESSIONAL_WORK_UNIT'
		);

	const start = (i: number) => dispatch('StartExecutionStep', { stepId: sid(i) });
	const fail = (i: number) =>
		dispatch('FailExecutionStep', { stepId: sid(i), failureReason: 'boom' });
	const retry = (i: number) => dispatch('RetryExecutionStep', { stepId: sid(i) });

	/** Complete step `i`. `explicit` false omits BOTH outputs and the no-output assertion — the RPH-EXE-006 case. */
	const complete = (i: number, explicit = true) =>
		dispatch('CompleteExecutionStep', {
			executionStepId: sid(i),
			executionAttemptId: `${sid(i)}-a1`,
			resultStatus: 'SUCCEEDED',
			outputArtifactIds: [],
			proposedEvidenceIds: [],
			detectedAssumptionIds: [],
			structuredResult: {},
			...(explicit ? { noOutputResult: SAYS_NOTHING } : {}),
			executionProvenance: { executedBy: actor, originType: 'HUMAN_DECISION' }
		});

	/** An ACTIVE 3-step linear plan on an OPEN (READY) PWU. Returns the activation outcome. */
	function activePlan(retryPolicy: Record<string, unknown> = {}): Outcome {
		ok(chg('PROPOSED', 'SHAPING'), 'shaping');
		ok(chg('SHAPING', 'READY'), 'ready');
		ok(
			dispatch('ProposeExecutionPlan', {
				executionPlanId: PLAN,
				workUnitId: PWU,
				steps: [mkStep(1), mkStep(2), mkStep(3)],
				transitions: [],
				retryPolicy,
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			}),
			'propose'
		);
		ok(dispatch('ApproveExecutionPlan', {}), 'approve');
		return ok(dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }), 'activate');
	}

	/** Propose + approve a successor plan on the SAME PWU, and return the activation attempt (not asserted). */
	function proposeSuccessor(): Outcome {
		ok(
			dispatch(
				'ProposeExecutionPlan',
				{
					executionPlanId: PLAN2,
					workUnitId: PWU,
					steps: [{ ...mkStep(1), id: `${PLAN2}-s1`, executionPlanId: PLAN2 }],
					transitions: [],
					retryPolicy: {},
					tacticalChangePolicy: {},
					escalationPolicy: {},
					terminationPolicy: {}
				},
				PLAN2
			),
			'successor propose'
		);
		return ok(dispatch('ApproveExecutionPlan', {}, PLAN2), 'successor approve');
	}

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
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
	});

	/**
	 * TOTAL over the ENFORCED rows, by type. A row added to the register with no probe here does not compile.
	 *
	 * Written as a `Record` over the id union rather than a list, for the same reason `STEP_COMMAND_SPECS` is: a
	 * list can be short by one and nothing notices. That is the omission this whole programme is about.
	 */
	const PROBES: Readonly<Record<RegisteredRuleId, Probe | null>> = {
		'RPH-EXE-001': {
			arrangement: 'a second plan on the same PWU, with the first still ACTIVE and not superseded',
			run: () => {
				const control = activePlan(); // the FIRST activation is accepted…
				proposeSuccessor();
				return {
					control,
					observed: dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }, PLAN2)
				};
			}
		},
		'RPH-EXE-002': {
			arrangement: 'the plan superseded out from under a step that has not started',
			run: () => {
				activePlan();
				const control = start(1); // Start is accepted while the plan is ACTIVE…
				ok(complete(1), 'complete s1');
				proposeSuccessor();
				ok(dispatch('SupersedeExecutionPlan', { supersedingExecutionPlanId: PLAN2 }), 'supersede');
				return { control, observed: start(2) };
			}
		},
		'RPH-EXE-003': {
			arrangement: 'a step whose runtimeBindingId names a binding still in REQUESTED',
			run: () => {
				// JAN-EXEBIND WP-B1 closed this row, and the register's totality gate is what FORCED this probe: the
				// map is a total Record over the id union, so flipping RPH-EXE-003 to ENFORCED does not compile until
				// an observation exists. That is the mechanism working, in the direction it was built for.
				//
				// The CONTROL is the same command on the same plan with the binding AUTHORIZED — so the arrangement
				// (the binding's status) is demonstrably what flips the answer, not the plan, the step or the PWU.
				const BIND = 'bind_01ARZ3NDEKTSV4RRFFQ69H6140';
				const requestBinding = () =>
					ok(
						dispatch(
							'RequestRuntimeBinding',
							{
								runtimeBindingId: BIND,
								executionStepId: sid(1),
								roleId: 'role-architect',
								requestedCapabilities: [{ capability: 'file-system' }]
							},
							BIND,
							'RUNTIME_BINDING'
						),
						'request binding'
					);

				requestBinding();
				ok(chg('PROPOSED', 'SHAPING'), 'shaping');
				ok(chg('SHAPING', 'READY'), 'ready');
				ok(
					dispatch('ProposeExecutionPlan', {
						executionPlanId: PLAN,
						workUnitId: PWU,
						steps: [
							{ ...mkStep(1), runtimeBindingId: BIND },
							{ ...mkStep(2), runtimeBindingId: BIND }
						],
						transitions: [],
						retryPolicy: {},
						tacticalChangePolicy: {},
						escalationPolicy: {},
						terminationPolicy: {}
					}),
					'propose'
				);
				ok(dispatch('ApproveExecutionPlan', {}), 'approve');
				ok(dispatch('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [BIND] }), 'activate');

				// AUTHORIZED -> the control accepts…
				ok(
					dispatch(
						'AuthorizeRuntimeBinding',
						{ grantedCapabilities: [{ capability: 'file-system' }] },
						BIND,
						'RUNTIME_BINDING'
					),
					'authorize'
				);
				const control = start(1);
				ok(complete(1), 'complete s1');

				// …and REVOKED, which `bindingPermitsExecution` refuses by the same limb as REQUESTED, refuses s2.
				ok(
					dispatch(
						'RevokeRuntimeCapability',
						{ reason: 'credential rotated mid-plan' },
						BIND,
						'RUNTIME_BINDING'
					),
					'revoke'
				);
				return { control, observed: start(2) };
			}
		},
		'RPH-EXE-004': null,
		'RPH-EXE-005': null,
		'RPH-EXE-006': {
			arrangement:
				'a completion carrying neither an output artifact NOR an explicit no-output assertion',
			run: () => {
				activePlan();
				ok(start(1), 'start s1');
				const control = complete(1, true); // the SAME command, with the assertion present…
				ok(start(2), 'start s2');
				return { control, observed: complete(2, false) };
			}
		},
		'RPH-EXE-007': null,
		'RPH-EXE-008': {
			arrangement: 'a retry issued after the plan retry policy cap is reached',
			run: () => {
				activePlan({ maxAttempts: 2 });
				ok(start(1), 'attempt 1');
				ok(fail(1), 'fail 1');
				const control = retry(1); // the first retry is within the cap…
				ok(start(1), 'attempt 2');
				ok(fail(1), 'fail 2');
				return { control, observed: retry(1) };
			}
		},
		'RPH-EXE-009': null,
		'RPH-PWU-009': {
			arrangement: 'the owning PWU moved to SUPERSEDED while its plan is still ACTIVE',
			run: () => {
				activePlan();
				const control = start(1); // Start is accepted while the PWU is open…
				ok(complete(1), 'complete s1');
				// SUPERSEDED via the seam for the same reason as BASELINED below: `SupersedePwu` requires a successor
				// PWU whose construction is a decomposition-plane arrangement with nothing to do with this rule.
				seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'SUPERSEDED');
				return { control, observed: start(2) };
			}
		},
		'RPH-PWU-010': {
			arrangement: 'the owning PWU BASELINED while its plan is still ACTIVE',
			run: () => {
				activePlan();
				const control = start(1);
				ok(complete(1), 'complete s1');
				// Seeded, and the split is stated in `pwu-fixtures.ts`: BASELINED has exactly two in-arrows (SATISFIED,
				// RECOMPOSED — `READY -> BASELINED` is explicitly ILLEGAL), so arranging it through the bus means
				// driving the entire assurance chain. That chain can fail for eight reasons unrelated to this rule,
				// and each would present as "RPH-PWU-010 is not enforced". The ARRANGEMENT is seeded; the REFUSAL is
				// driven, which is the half this gate is about.
				seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'BASELINED');
				return { control, observed: start(2) };
			}
		}
	};

	it('the probe map is TOTAL over the ENFORCED rows — every claim has an observation', () => {
		const unprobed = enforcedRuleIds().filter((id) => PROBES[id] === null);
		expect(unprobed, 'ENFORCED rule(s) with no probe').toEqual([]);
		// …and nothing probes a row that is NOT claimed enforced, which would be a green with nothing behind it.
		const overProbed = (Object.keys(PROBES) as RegisteredRuleId[]).filter(
			(id) => PROBES[id] !== null && ENFORCEMENT_REGISTER[id].kind !== 'ENFORCED'
		);
		expect(overProbed, 'probe(s) for rule(s) the register does not claim are enforced').toEqual([]);
	});

	it.each(enforcedRuleIds())(
		'%s is REFUSED by its declared site, with its declared code and marker',
		(id) => {
			const row = ENFORCEMENT_REGISTER[id];
			const probe = PROBES[id];
			expect(row.kind).toBe('ENFORCED');
			expect(probe, `${id} has no probe`).not.toBeNull();
			if (row.kind !== 'ENFORCED' || !probe) return;

			const { control, observed } = probe.run();

			// THE CONTROL. Same command, before the arranging act. Without this the whole file is satisfied by a handler
			// that refuses everything — which is over-refusal wearing the fix's clothes.
			expect(control.status, `${id}: the control must be ACCEPTED (${control.message})`).toBe(
				'ACCEPTED'
			);

			const verdict = classifyRefusal(observed, row);
			expect(
				verdict,
				`${id} (${probe.arrangement}) — declared ${row.refusalCode} / "${row.refusalMarker}", observed ` +
					`${observed.status} ${observed.code ?? ''}: ${observed.message ?? '(no message)'}`
			).toBe('KILLED');
		}
	);

	// The register's markers are asserted DISTINCT in rph-domain. This proves the distinctness is real at the
	// observation point rather than merely true of two strings: the two rules refused by the SAME production
	// function must produce messages that satisfy their own marker and NOT the other's.
	it('the two same-site PWU rows are not satisfiable by one arrangement', () => {
		const nine = ENFORCEMENT_REGISTER['RPH-PWU-009'];
		const ten = ENFORCEMENT_REGISTER['RPH-PWU-010'];
		if (nine.kind !== 'ENFORCED' || ten.kind !== 'ENFORCED')
			throw new Error('rows must be ENFORCED');

		const supersededMessage = PROBES['RPH-PWU-009']!.run().observed;
		expect(classifyRefusal(supersededMessage, nine)).toBe('KILLED');
		expect(
			classifyRefusal(supersededMessage, ten),
			'the SUPERSEDED arrangement must NOT also green the BASELINED row'
		).toBe('MASKED');
	});
});
