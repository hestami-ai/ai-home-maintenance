// JAN-EXECREM WP-12c — F-30: §21.1's "authorized plan revision or waiver" is RESOLVED, not assumed.
//
// THE DEFECT. `canSkipStep` is the ratified kernel and it is correct. The CALLER supplied
// `hasAuthorizedWaiverOrRevision: !!p.waiverOrRevisionId` — so a governed act was satisfied by ANY NON-EMPTY
// STRING. `'dec_waiver_1'`, naming no object anywhere, retired a mandatory step; and the SHIPPED TEST that existed
// to prove the authorization worked passed exactly that literal, which made it the proof that it did not.
//
// The fail-closed lens that reviewed this code checked the OTHER input (`mandatory ?? true`) carefully and never
// asked what the second one resolved to. That is the recurring shape: a truthiness test standing in for a governed
// fact, indistinguishable at the call site from the real thing.
//
// SCOPE NOTE (the design's CONFLICT-11). `approveDecision` refuses `decisionType === 'WAIVER'` outright — a waiver
// reaches EFFECTIVE only via `GrantWaiver`, which mandates assurance-plane fields. REPLAN is therefore the kind an
// execution-plane caller can actually drive to EFFECTIVE, and it is what these tests use. WAIVER remains accepted
// by the resolver because §21.1 names it; refusing it would be the resolver inventing a narrowing the rule does
// not state.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69H3100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H3110';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69H3120';
const OTHER_PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69H3130';
const DEC = 'dec_01ARZ3NDEKTSV4RRFFQ69H3140';
const sid = (i: number) => `${PLAN}-s${i}`;

describe('JAN-EXECREM WP-12c / F-30 — a bare id is not an authorization', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	function dispatch(commandType: string, payload: unknown, id: string, aggType: string, issuedAt = TS) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt,
			issuedBy: actor,
			correlationId: 'wp12c',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}
	const ok = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		return r;
	};
	const stepStateOf = (i: number) =>
		(store.loadObject(PLAN)!.state as { steps: Array<{ id: string; stepState: string }> }).steps.find(
			(s) => s.id === sid(i)
		)?.stepState;

	const mkStep = (i: number) => ({
		id: sid(i),
		executionPlanId: PLAN,
		stepType: 'TRANSFORMATION',
		purpose: `work ${i}`,
		inputBindings: [],
		outputBindings: [],
		preconditions: [],
		postconditions: [],
		stepState: 'QUEUED'
	});

	/** Skip step 1, asserting it MANDATORY so the §21.1 authorization is the only thing that can admit it. */
	const skip = (authorizationId?: string, issuedAt = TS) =>
		dispatch(
			'SkipExecutionStep',
			{
				stepId: sid(1),
				mandatory: true,
				...(authorizationId === undefined ? {} : { waiverOrRevisionId: authorizationId })
			},
			PLAN,
			'EXECUTION_PLAN',
			issuedAt
		);

	/** Mint a decision and (optionally) drive it to EFFECTIVE. */
	function mintDecision(
		over: Record<string, unknown> = {},
		options: { readonly approve?: boolean; readonly id?: string } = {}
	): string {
		const { approve = true, id = DEC } = options;
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
						executionStepIds: [sid(1)],
						rationale: 'this step alone is retired'
					},
					...over
				},
				id,
				'DECISION'
			),
			'ProposeDecision'
		);
		if (approve)
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
					id,
					'DECISION'
				),
				'ApproveDecision'
			);
		return id;
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
		ok(
			dispatch(
				'ProposeExecutionPlan',
				{
					executionPlanId: PLAN,
					workUnitId: PWU,
					steps: [mkStep(1), mkStep(2)],
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

	/** Every refusal must leave the step untouched — a refused skip that still moved the step is no refusal. */
	function expectRefused(r: ReturnType<typeof skip>, fragment: string): void {
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(r.error?.message, `expected the refusal to name: ${fragment}`).toContain(fragment);
		expect(stepStateOf(1), 'the step must not have moved').toBe('QUEUED');
	}

	// ── The six ordered checks, one case each ───────────────────────────────────────────────────────────────────

	it('THE KILL TEST: a nonexistent id is refused — this exact input SKIPPED the step before WP-12c', () => {
		expectRefused(skip('dec_waiver_1'), 'names no recorded object');
	});

	it('WRONG TYPE: naming a real object that is not a DECISION is a CATEGORY error, and says so', () => {
		// Ordered before scope deliberately (the JAN-CMDPRE discipline): a mis-aimed id is told it named the wrong
		// KIND of thing before it is told anything about scope.
		expectRefused(skip(PWU), 'not a DECISION');
	});

	it('WRONG KIND: an APPROVAL authorizes something else entirely', () => {
		mintDecision({ decisionType: 'APPROVAL' });
		expectRefused(skip(DEC), 'is a APPROVAL');
	});

	it('NOT EFFECTIVE: a decision somebody drafted is not a decision anybody made', () => {
		mintDecision({}, { approve: false });
		expectRefused(skip(DEC), 'is PROPOSED, not EFFECTIVE');
	});

	it('NO EXECUTION SCOPE: an assurance-plane decision does not reach the execution plane (INV-5)', () => {
		// The boundary the separate field exists to keep. A decision with no `executionSkipAuthorization` — which
		// is every floor waiver in the system — authorizes NO skip.
		mintDecision({ executionSkipAuthorization: undefined });
		expectRefused(skip(DEC), 'carries no executionSkipAuthorization');
	});

	it('ANOTHER PLAN: an authorization scoped to a different plan does not bleed to this one', () => {
		mintDecision({
			subjectObjectIds: [OTHER_PLAN],
			executionSkipAuthorization: {
				executionPlanId: OTHER_PLAN,
				executionStepIds: [sid(1)],
				rationale: 'scoped elsewhere'
			}
		});
		expectRefused(skip(DEC), 'does not name plan');
	});

	it('MISMATCHED SCOPE: the decision names this plan, but its authorization detail names another', () => {
		// ISOLATION, and the reason it exists: the case above sets BOTH `subjectObjectIds` and the detail's
		// `executionPlanId` to the other plan, so the SUBJECT guard fires first and MASKS the detail guard —
		// which mutation testing duly showed, by leaving the detail guard alive with every test green. The two
		// are different facts (what the decision is ABOUT vs what its execution scope COVERS) and each needs its
		// own case.
		mintDecision({
			subjectObjectIds: [PLAN],
			executionSkipAuthorization: {
				executionPlanId: OTHER_PLAN,
				executionStepIds: [sid(1)],
				rationale: 'detail points elsewhere'
			}
		});
		expectRefused(skip(DEC), 'authorizes skips on plan');
	});

	it('ANOTHER STEP: an authorization does not bleed to a step it did not name (RPH-GOV-005)', () => {
		// Without the explicit step list, ONE decision would retire EVERY mandatory step in the plan — precisely
		// the unscoped waiver REG-Q-012 forbids.
		mintDecision({
			executionSkipAuthorization: {
				executionPlanId: PLAN,
				executionStepIds: [sid(2)],
				rationale: 'only the second step'
			}
		});
		expectRefused(skip(DEC), 'does not include');
	});

	it('EXPIRED: expiry is judged against the COMMAND issuedAt, never a wall clock', () => {
		mintDecision({
			executionSkipAuthorization: {
				executionPlanId: PLAN,
				executionStepIds: [sid(1)],
				expiresAt: '2026-07-11T00:00:00Z',
				rationale: 'time-boxed'
			}
		});
		expectRefused(skip(DEC), 'expired at');
	});

	it('NOT-YET-EXPIRED: the same authorization admits the skip while it is still live', () => {
		// The complement of the case above. Without it, a mutant that treated EVERY dated authorization as expired
		// would pass — the refusal-only half of a rule proves nothing about the rule.
		mintDecision({
			executionSkipAuthorization: {
				executionPlanId: PLAN,
				executionStepIds: [sid(1)],
				expiresAt: '2027-01-01T00:00:00Z',
				rationale: 'time-boxed'
			}
		});
		ok(skip(DEC), 'skip under a live authorization');
		expect(stepStateOf(1)).toBe('SKIPPED');
	});

	// ── The positive path, and the two shapes that must stay untouched ──────────────────────────────────────────

	it('VALID: an EFFECTIVE REPLAN naming this plan and this step admits the skip', () => {
		mintDecision();
		ok(skip(DEC), 'skip');
		expect(stepStateOf(1)).toBe('SKIPPED');
	});

	it('the authorization rides the DecisionProposed event — replay can see WHICH steps it covered', () => {
		mintDecision();
		const proposed = store.readAllEvents().filter((e) => e.eventType === 'DecisionProposed');
		expect(proposed).toHaveLength(1);
		expect(
			(proposed[0]!.payload as { executionSkipAuthorization?: { executionStepIds?: string[] } })
				.executionSkipAuthorization?.executionStepIds
		).toEqual([sid(1)]);
	});

	it('UNCHANGED: a MANDATORY step with NO id at all is still refused by canSkipStep, with ITS code', () => {
		// The two refusals are distinct and must stay so: "you offered no authorization" is an INVARIANT violation
		// (§21.1's own rule), while "the authorization you offered is not one" is a VALIDATION failure.
		const r = skip();
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(stepStateOf(1)).toBe('QUEUED');
	});

	it('UNCHANGED: an explicitly OPTIONAL step still skips freely, with no authorization', () => {
		// The over-refusal guard. §21.1 governs MANDATORY skips; a mutant that resolved unconditionally would
		// break every optional skip in the system, including the reference seed's.
		const r = dispatch(
			'SkipExecutionStep',
			{ stepId: sid(1), mandatory: false },
			PLAN,
			'EXECUTION_PLAN'
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(stepStateOf(1)).toBe('SKIPPED');
	});

	it('an OPTIONAL step that supplies a GARBAGE id is still refused — the id is checked whenever present', () => {
		// Otherwise `mandatory: false` would be a way to launder an unresolvable authorization into the record.
		const r = dispatch(
			'SkipExecutionStep',
			{ stepId: sid(1), mandatory: false, waiverOrRevisionId: 'nonsense' },
			PLAN,
			'EXECUTION_PLAN'
		);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(stepStateOf(1)).toBe('QUEUED');
	});
});
