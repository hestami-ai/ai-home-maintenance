// REG-F-070 — ABANDONMENT IS A GOVERNANCE ACT, AND ANY CONTROLLER COULD PERFORM IT.
//
// ⚠ MOVED ONTO `AbandonPwu` BY JAN-PWUWP W-1 (REG-D-029). The guard these cases exercise used to be
// bolted onto the generic setter because the act had no command; PER-3 requires a semantically named
// one, and it now exists. Two consequences visible below: the decision id is a REQUIRED payload field,
// so "nothing cited" is refused by the CONTRACT rather than by the guard — strictly stronger — and a
// new control asserts the setter refuses the arrow and names the command, which is the conjunct that
// stops this increment re-opening the very finding this file exists for.
//
// JPWB-DOC-001 §5.2 (L168): *"**Governance is an authority function outside the six disciplines.** It alone
// authorizes waiver, risk acceptance, rejection or abandonment of governed work, and promotion. No discipline may
// absorb it."* All seventeen `-> ABANDONED` arrows declared the guard *"Authorized decision
// (Decision.decisionType=ABANDON)"*; nothing evaluated it; and `execrem-wp12-authority.test.ts` closed a PWU on
// `reasonCode: 'fixture'` three times, ACCEPTED.
//
// ⚠ ONE REJECT CASE PER CONJUNCT, and each asserts the REASON rather than only the refusal. A guard with seven
// checks and one test proves that SOMETHING refuses, not that the right thing does — and this repository has
// recorded a predicate whose conjunct compared a value with itself while its test stayed green.
//
// EVERY BUS-LEVEL REJECTION ALSO ASSERTS `§5.2` IN THE MESSAGE. The dispatch passes through the vacuity
// precondition, three sibling guards and `checkTransition` before reaching this one; without naming the clause, a
// refusal from any of those would satisfy a bare `status === 'REJECTED'` and the test would prove nothing about
// abandonment at all.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { getMachine } from '@janumipwb/rph-domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import {
	expectPwuReplayEquivalence,
	seedPwuWorkLifecycleState_FIXTURE
} from './__tests__/pwu-fixtures.js';
import { resolveAbandonAuthorization } from './abandon-authorization.js';
import type { HandlerContext } from './kit.js';

const TS = '2026-08-08T00:00:00Z';
const actor: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69H2200';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H2210';
const OTHER_PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H2220';
const UNBORN_PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H2230';

describe('REG-F-070 — abandoning governed work requires an authorized decision', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	const dispatch = (commandType: string, payload: unknown, id: string, aggType: string) => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'regf070',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	};
	const ok = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		return r;
	};

	const proposePwu = (id: string) =>
		dispatch(
			'ProposePwu',
			{
				pwuId: id,
				pwuKind: 'ARCHITECTURE',
				title: 'Arch',
				description: 'd',
				intentId: INTENT,
				// REG-F-072: a PWU must actually BE shaped to reach READY. These were empty, and the generic
				// setter let it through anyway — the exact bypass this file's own fixture was relying on.
				boundaries: {
					inScope: ['the governed work under test'],
					outOfScope: ['not yet known'],
					permittedChanges: [],
					prohibitedChanges: []
				},
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [{ outputId: `out_${id}`, kind: 'DOCUMENT' }],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'MEDIUM',
					uncertainty: 'MEDIUM',
					irreversibility: 'LOW',
					securitySensitivity: 'LOW',
					regulatoryExposure: 'NONE'
				}
			},
			id,
			'PROFESSIONAL_WORK_UNIT'
		);

	/**
	 * Move a PWU PROPOSED -> SHAPING -> READY, the state the `-> ABANDONED` arrow under test leaves from.
	 *
	 * ⚠ THROUGH THE COMMANDS THAT OWN THOSE ARROWS (REG-F-072). This used two `ChangePwuState` hops, and that is
	 * how a PWU with empty boundaries and no expected output reached READY — `markPwuReady` would have refused it
	 * on four limbs. The generic setter no longer performs an arrow a semantic command owns.
	 */
	const toReady = (id: string) => {
		ok(dispatch('BeginPwuShaping', {}, id, 'PROFESSIONAL_WORK_UNIT'), 'shaping');
		ok(
			dispatch(
				'MarkPwuReady',
				{ shapeReadinessAssessmentId: 'assess_shape', expectedSemanticVersion: 1 },
				id,
				'PROFESSIONAL_WORK_UNIT'
			),
			'ready'
		);
	};

	const chgOn = (id: string, previousState: string, newState: string, supportingObjectIds: string[] = []) =>
		dispatch(
			'ChangePwuState',
			{
				previousState,
				newState,
				executionState: 'NOT_PLANNED',
				assuranceState: 'UNASSESSED',
				shapeIntegrityState: 'PRESERVED',
				reasonCode: 'CONTROLLER',
				supportingObjectIds
			},
			id,
			'PROFESSIONAL_WORK_UNIT'
		);

	/** The act, through the command that owns it. `authorizationId` is what the caller NAMES; the handler
	 *  derives whether it authorizes (JAN-PWUWP R1 derive-on-read). */
	const abandon = (authorizationId: string, id = PWU) =>
		dispatch(
			'AbandonPwu',
			{ abandonmentDecisionId: authorizationId, reasonCode: 'CONTROLLER' },
			id,
			'PROFESSIONAL_WORK_UNIT'
		);

	/** Propose a decision of `decisionType` over `subjects`; approve it only when `approve`. */
	const decision = (
		decisionType: string,
		subjects: string[],
		approve: boolean,
		pins: Record<string, number> = {}
	): string => {
		const id = `dec_01ARZ3NDEKTSV4RRFFQ69H2${(300 + seq).toString().padStart(3, '0')}`;
		ok(
			dispatch(
				'ProposeDecision',
				{
					decisionType,
					subjectObjectIds: subjects,
					selectedOption: 'go',
					rationale: 'r',
					authority: actor,
					consideredEvidenceIds: [],
					consideredObservationIds: []
				},
				id,
				'DECISION'
			),
			`propose ${decisionType}`
		);
		if (approve) {
			ok(
				dispatch(
					'ApproveDecision',
					{
						selectedOption: 'go',
						rationale: 'r',
						consideredEvidenceIds: [],
						consideredObservationIds: [],
						subjectSemanticVersions: pins
					},
					id,
					'DECISION'
				),
				`approve ${decisionType}`
			);
		}
		return id;
	};

	/** Every refusal below must come from THIS guard, named by its canon clause. */
	const refusedByTheAbandonGuard = (
		r: { status: string; error?: { code?: string; message?: string } },
		because: string
	) => {
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message, 'the refusal must come from the abandonment guard').toContain(
			'JPWB-DOC-001 §5.2'
		);
		expect(r.error?.message, 'and from AbandonPwu, not from some earlier gate').toContain('AbandonPwu');
		expect(r.error?.message, because).toContain(because);
	};

	const pwuState = (id = PWU) =>
		(store.loadObject(id)!.state as { workLifecycleState: string }).workLifecycleState;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		}).as(TEST_CRED.human);
		ok(
			dispatch(
				'CaptureIntent',
				{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
				INTENT,
				'INTENT'
			),
			'intent'
		);
		// A root PWU may not reach READY under a RAW intent (DOC-002 §6.3 L472, the eighth readiness limb).
		ok(dispatch('BeginIntentDiscovery', {}, INTENT, 'INTENT'), 'intent discovery');
		ok(dispatch('ProvisionIntent', { ambiguityIds: [] }, INTENT, 'INTENT'), 'intent provisional');
		ok(proposePwu(PWU), 'pwu');
		toReady(PWU);
	});

	// ── THE ACCEPT CASE ───────────────────────────────────────────────────────────────────────────────────────
	it('ACCEPTS when an EFFECTIVE ABANDON decision names this PWU at its current semantic version', () => {
		const dec = decision('ABANDON', [PWU], true, { [PWU]: 1 });
		ok(abandon(dec), 'authorized abandonment');
		expect(
			(store.loadObject(PWU)!.state as { workLifecycleState: string }).workLifecycleState
		).toBe('ABANDONED');
		// REG-F-084: a fold entry is load-bearing only where a test EMITS the event. This is the one place in
		// the repository that emits `PwuAbandoned` — the reference undertaking never abandons — so without this line
		// `pwu-replay.ts` could drop the case and stay green, which is exactly what W-5's mutant proved.
		expectPwuReplayEquivalence(store, PWU);
	});

	// ── ONE REJECT PER CONJUNCT ───────────────────────────────────────────────────────────────────────────────
	it('REJECTS with no decision named — now refused by the CONTRACT, which is stronger than the guard', () => {
		// `abandonmentDecisionId` is a REQUIRED field of AbandonPwuPayload, so the empty case never reaches the
		// authority check: it is refused at the schema. That is the improvement W-1 buys — the hole this file was
		// written for (a governed unit of work closed on `reasonCode: 'fixture'` alone) is now unrepresentable.
		const r = dispatch('AbandonPwu', { reasonCode: 'CONTROLLER' }, PWU, 'PROFESSIONAL_WORK_UNIT');
		expect(r.status).toBe('VALIDATION_FAILED');
		expect(pwuState()).toBe('READY');
	});

	it('REJECTS a dangling id — the cheapest possible forgery', () => {
		refusedByTheAbandonGuard(abandon('dec_does_not_exist'), 'names no recorded object');
	});

	it('REJECTS an object that is not a DECISION — a category error, told as one', () => {
		refusedByTheAbandonGuard(abandon(INTENT), 'not a DECISION');
	});

	it('REJECTS an EFFECTIVE APPROVAL — a general approval does not authorize abandonment', () => {
		// THE DELIBERATE DIVERGENCE FROM `canPromoteBaseline`, which accepts PROMOTE_BASELINE *or* APPROVAL. No
		// canon licenses one decisionType standing in for another, CON-000 AX-2 defaults authority to denied, and
		// `resolveSkipAuthorization` already refuses the same substitution. Registered as REG-F-076.
		const dec = decision('APPROVAL', [PWU], true, { [PWU]: 1 });
		refusedByTheAbandonGuard(abandon(dec), 'requires decisionType=ABANDON');
	});

	it('REJECTS a PROPOSED ABANDON decision — a decision somebody drafted is not one anybody made', () => {
		const dec = decision('ABANDON', [PWU], false);
		refusedByTheAbandonGuard(abandon(dec), 'not EFFECTIVE');
	});

	it('REJECTS an ABANDON decision scoped to a DIFFERENT PWU (RPH-GOV-005)', () => {
		ok(proposePwu(OTHER_PWU), 'other pwu');
		const dec = decision('ABANDON', [OTHER_PWU], true, { [OTHER_PWU]: 1 });
		refusedByTheAbandonGuard(abandon(dec), 'does not bleed to another object');
	});

	it('REJECTS an ABANDON decision that pins NO version for the PWU being closed (ASR-15)', () => {
		// REACHABLE, and a real governance shape: a blanket decision taken BEFORE the work existed.
		// `proposeDecision` pins only subjects the store can load (`governance.ts:42`), so naming an id that does
		// not yet exist yields no version bind — and ASR-15 is explicit that *"An approval whose actor, subject,
		// subject version, type, and time cannot be identified is not authority — it is provenance at best."*
		//
		// ⚠ THIS TEST'S FIRST VERSION DID NOT TEST ITS OWN NAME. It cited an unpinned subject alongside a pinned
		// one and then asserted the ABANDONMENT SUCCEEDED — an accept case wearing a "REJECTS" title. It was caught
		// by mutation: neutralising the version conjunct left it green, when a test of that conjunct must redden.
		// The subject being closed has to be the unpinned one.
		const dec = decision('ABANDON', [UNBORN_PWU], true, {});
		expect(
			(store.loadObject(dec)!.state as { subjectSemanticVersions: Record<string, number> })
				.subjectSemanticVersions[UNBORN_PWU],
			'a subject that did not exist at propose time carries no pin'
		).toBe(undefined);
		// Now bring it into existence and try to close it on that decision.
		ok(proposePwu(UNBORN_PWU), 'the work now exists');
		toReady(UNBORN_PWU);
		refusedByTheAbandonGuard(abandon(dec, UNBORN_PWU), 'at semantic version nothing');
	});

	// ── THE VERSION-DRIFT LIMB, DEFENDED AHEAD OF A CAPABILITY THAT DOES NOT EXIST YET ───────────────────────
	// ASR-15: *"A decision approving version n never authorizes version n+1."* No PWU command bumps
	// `semanticVersion` today — `advanceStatus`'s `bumpSemanticVersion` is used only by `reviseIntent` and
	// `reviseDecomposition`, and `changePwuState` commits `loaded.semanticVersion` unchanged — so this arm CANNOT
	// be driven through the bus. It is tested at the resolver instead, and the reason is recorded rather than the
	// arm being dropped: the day a PWU revision command lands, this conjunct is already defending it.
	it('REJECTS a decision bound to version n when the PWU is at n+1 (ASR-15) — at the resolver', () => {
		// ⚠ THE DECISION IS A REAL ONE, BUILT THROUGH THE BUS, and only the CLAIMED CURRENT VERSION is varied.
		// The first attempt at this test hand-wrote the Decision state object and it did not parse — the resolver
		// answered "does not parse as a Decision" and the assertion below caught it. Inventing an object shape to
		// test a predicate about that shape is the field-name-guessing defect this repository has recorded; using
		// the real store removes the whole class.
		const dec = decision('ABANDON', [PWU], true, { [PWU]: 1 });
		const ctx = { store } as unknown as HandlerContext;
		const v = resolveAbandonAuthorization(ctx, {
			pwuId: PWU,
			authorizationId: dec,
			pwuSemanticVersion: 2
		});
		expect(v.ok).toBe(false);
		expect(v.ok === false && v.reason).toContain('never authorizes version n+1');
		// CONTROL FOR THIS CASE: the SAME decision at the matching version is accepted, so the assertion above is
		// about the VERSION conjunct and not about the decision failing some earlier check.
		expect(
			resolveAbandonAuthorization(ctx, { pwuId: PWU, authorizationId: dec, pwuSemanticVersion: 1 }).ok
		).toBe(true);
	});

	// ── SCOPE, asserted but NOT counted as a control ─────────────────────────────────────────────────────────
	// ⚠ HONEST LABELLING. This began life as "CONTROL — the guard is scoped to abandonment", on the reasoning that
	// a guard refusing EVERYTHING would fail here. Mutation says otherwise: deleting `p.newState !== 'ABANDONED'`
	// reddens all eleven tests, because `beforeEach` itself performs two non-abandon transitions. It reddens WITH
	// THE HERD, so it is not a control — a control must have a failure mode of its own. Kept as documentation of
	// the intended scope, demoted in name so the count of real controls stays true.
	it('a transition that is not an abandonment needs no decision', () => {
		// Uses arrows the generic setter still OWNS. SHAPING and READY moved to their semantic commands under
		// REG-F-072, so asserting them here would now be testing that guard rather than this one.
		ok(proposePwu(OTHER_PWU), 'other pwu');
		toReady(OTHER_PWU);
		ok(chgOn(OTHER_PWU, 'READY', 'PLANNED'), 'PLANNED needs no governance decision');
	});

	// ── CONTROL 1: THE ALREADY-CLOSED LIMB, WHICH IS THE ONE WITH ITS OWN FAILURE MODE ───────────────────────
	// Once a PWU is ABANDONED, moving an ORTHOGONAL axis is not a second abandonment and must not demand a second
	// decision — otherwise recording what happened to a closed unit of work would need governance approval each
	// time. Predicted red for the mutant that drops `|| currentWorkLifecycleState === 'ABANDONED'` from the early
	// return, and ONLY for it: every other test abandons from READY, where that disjunct is false and therefore
	// invisible. This is the limb `beforeEach` cannot reach.
	it('CONTROL — moving another axis on an ALREADY-abandoned PWU needs no second decision', () => {
		const dec = decision('ABANDON', [PWU], true, { [PWU]: 1 });
		ok(abandon(dec), 'the abandonment itself');
		// An axis MUST actually move: an all-axes-equal re-issue is refused earlier by the DWP-02 vacuity
		// precondition, which would make this control pass for the wrong reason.
		ok(
			dispatch(
				'ChangePwuState',
				{
					previousState: 'ABANDONED',
					newState: 'ABANDONED',
					executionState: 'PLANNED',
					assuranceState: 'UNASSESSED',
					shapeIntegrityState: 'PRESERVED',
					reasonCode: 'CONTROLLER',
					supportingObjectIds: []
				},
				PWU,
				'PROFESSIONAL_WORK_UNIT'
			),
			'recording an orthogonal axis on closed work is not a second governance act'
		);
	});

	// ── CONTROL 2: THE DECISION IS THE ONLY DIFFERENCE ───────────────────────────────────────────────────────
	// The reject cases assert a message, which proves WHICH guard spoke. This proves the guard is DECIDING: the
	// same dispatch, on the same PWU, in the same state, differs only by the cited decision — so a refusal that
	// actually came from `checkTransition`, the vacuity precondition or a sibling guard could not be cured by
	// adding one. Predicted red for any mutant that makes the guard refuse unconditionally.
	it('CONTROL — the identical abandonment is refused without the decision and accepted with it', () => {
		const refused = abandon('dec_does_not_exist');
		expect(refused.status).toBe('REJECTED');
		expect(
			(store.loadObject(PWU)!.state as { workLifecycleState: string }).workLifecycleState,
			'a refused abandonment must not have moved the PWU'
		).toBe('READY');
		const dec = decision('ABANDON', [PWU], true, { [PWU]: 1 });
		ok(abandon(dec), 'the same dispatch, now authorized');
		expect(
			(store.loadObject(PWU)!.state as { workLifecycleState: string }).workLifecycleState
		).toBe('ABANDONED');
	});

	// ── CONTROL 3: THE OWNERSHIP CONJUNCT LANDED IN THIS SAME COMMIT ─────────────────────────────────────────
	// W-1 moves the authority guard OFF `ChangePwuState`. If the ownership row had not landed with it, the setter
	// would still perform `-> ABANDONED` — now with nothing checking authority at all — re-opening the exact
	// finding this file exists for, for six increments. This is the test that makes the coupling enforced rather
	// than merely intended. Predicted red for the mutant that deletes `ABANDONED` from
	// `PWU_SEMANTIC_LIFECYCLE_COMMANDS`, and ONLY for it.
	it('CONTROL — the generic setter refuses the arrow outright and names the command', () => {
		const r = chgOn(PWU, 'READY', 'ABANDONED', []);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.message, 'the setter must redirect, not adjudicate').toContain(
			'Dispatch AbandonPwu instead'
		);
		expect(pwuState(), 'and must not have moved the PWU').toBe('READY');
	});

	// ── §8.2'S "ANY ACTIVE" UMBRELLA — THE WHOLE SOURCE SET, NOT ONE MEMBER OF IT (JAN-PFA) ──────────────────
	//
	// ⚠ THE GAP THESE CASES CLOSE. Every case above abandons from READY, so the command's RATIFIED BREADTH was
	// asserted by nothing: a mutant that kept `AbandonPwu` in every other respect and removed exactly ONE state
	// from the `sourceStates` it declares at its call site SURVIVED this suite, and survived the repository.
	// Breadth is not a detail of this command — DOC-002 §8.2 declares SEVENTEEN `-> ABANDONED` in-edges under the
	// umbrella *"Any active"*, kept verbatim in `transitions.data.ts` rather than enumerated per state, and
	// `AbandonPwu` is the only command that may perform any of them (REG-F-072 ownership).
	//
	// AND THE MEMBER THAT MUTANT REMOVED WAS `BLOCKED`, WHICH IS THE ONE THE ENGINE ITSELF PRESCRIBES: a PWU whose
	// `PwuBlocked` recorded no origin cannot be unblocked, and `unblockPwu` fails closed naming the way out —
	// *"Blocks recorded before JAN-PWUWP W-5.5 fail closed here by design (AX-8); abandon or supersede this PWU
	// instead"*. Narrow the source set there and the engine's own stated remedy becomes unperformable, with
	// `AbandonPwu` answering that it does not claim the arrow.
	//
	// ⭐ DERIVED FROM THE MACHINE, NOT FROM THE TABLE THE HANDLER READS. `PWU_LIFECYCLE_COMMAND_SPECS` is what
	// `abandonPwu` hands to `advancePwuLifecycle`; reading it here would make any narrowing invisible, because the
	// expected list would shrink with the very thing it is meant to police. `transitions.data.ts` is the
	// independently authored artifact (that spec table's own docblock forbids computing one from the other, and
	// `verif/lifecycle-arrow-declarations.test.ts` holds the two in agreement), so the machine is the honest
	// source for what this command must reach.
	const ABANDON_MACHINE = getMachine('PWU.workLifecycleState');
	const declaresAbandonFrom = (state: string) =>
		ABANDON_MACHINE.transitions.some((t) => t.from === state && t.to === 'ABANDONED');

	it('ACCEPTS an abandonment from BLOCKED, reached by COMMANDS — the remedy the engine itself names', () => {
		// ⭐ REACHABILITY, DRIVEN RATHER THAN ASSERTED. The parameterised case below seeds its from-state; this one
		// does not touch the store at all. `READY -> PLANNED` is the generic setter's own arrow and `BlockPwu` owns
		// `PLANNED -> BLOCKED`, both dispatched through the bus — so a professional holding blocked work really can
		// reach this, and the arrow under test is a LIVE promise rather than a dead arm.
		ok(chgOn(PWU, 'READY', 'PLANNED'), 'planned');
		ok(
			dispatch(
				'BlockPwu',
				{ blockReason: 'the upstream interface contract is not published' },
				PWU,
				'PROFESSIONAL_WORK_UNIT'
			),
			'block'
		);
		expect(pwuState(), 'the arrangement must really be BLOCKED, not merely attempted').toBe(
			'BLOCKED'
		);
		const dec = decision('ABANDON', [PWU], true, { [PWU]: 1 });
		ok(abandon(dec), 'abandonment of BLOCKED work');
		expect(pwuState()).toBe('ABANDONED');
		expectPwuReplayEquivalence(store, PWU);
	});

	// ⚠ ONE `it.each` OVER ALL TWENTY STATES, NOT SEVENTEEN ACCEPT CASES. Pinning only the members that must be
	// ADMITTED would be satisfied by a command that admits EVERYTHING — the declared-source check deleted, or its
	// list widened — so the same parameterisation carries the refusals too, and the two halves together pin the
	// set EXACTLY: the machine's seventeen active states are performed, its three terminal states are not.
	//
	// ⚠ AND THE REFUSED HALF ASSERTS THE MESSAGE, BECAUSE TWO GUARDS REFUSE IT. A terminal from-state trips the
	// declared-source check AND `canAdvanceWorkLifecycle` (the machine has no `BASELINED -> ABANDONED` edge), and
	// both answer `RPH_ILLEGAL_STATE_TRANSITION`, so the code alone tells them apart in neither direction. Only
	// `does not declare … as a source state` says the DECLARATION was consulted.
	//
	// THE ARRANGEMENT IS SEEDED AND THE ACT IS DRIVEN — the split `block-escalate.test.ts` already uses for
	// ESCALATED, for the same stated reason: the route into `SATISFIED` or `REJECTED` is eight governance commands
	// long and would fail for eight reasons that are not this rule. The named helper validates the state against
	// the ratified machine and re-parses the aggregate before writing, so nothing rehearses against a shape the
	// contract forbids; and every state seeded here is one the machine declares an owning command for
	// (REG-F-192's total partition), not an arm invented so that something could be reached.
	it.each(ABANDON_MACHINE.states.map((from) => ({ from, declared: declaresAbandonFrom(from) })))(
		'$from -> ABANDONED is performed iff the machine declares that arrow (declared=$declared)',
		({ from, declared }) => {
			seedPwuWorkLifecycleState_FIXTURE(store, PWU, from);
			const dec = decision('ABANDON', [PWU], true, { [PWU]: 1 });
			const r = abandon(dec);
			if (declared) {
				expect(
					r.status,
					`${from} -> ABANDONED is a ratified §8.2 in-edge and AbandonPwu is the only command that ` +
						`performs it, so an authorized abandonment from ${from} must be ACCEPTED: ${r.error?.message}`
				).toBe('ACCEPTED');
				expect(pwuState(), `and the PWU must have closed out of ${from}`).toBe('ABANDONED');
			} else {
				expect(
					r.status,
					`${from} is terminal — the machine declares no ${from} -> ABANDONED, so AbandonPwu must not ` +
						`claim it`
				).toBe('REJECTED');
				expect(
					r.error?.message,
					`and the refusal must come from the DECLARED-SOURCE check for ${from}, not from the machine ` +
						`legality check that would refuse it anyway`
				).toContain(`AbandonPwu does not declare ${from} as a source state`);
				expect(pwuState(), `a refused abandonment must not have moved the PWU off ${from}`).toBe(
					from
				);
			}
		}
	);

	// INSTRUMENT CHECK, and it is not a claim about the handler. If `ABANDONED` were renamed or its in-edges
	// removed, `declaresAbandonFrom` would answer false for every state and the case above would degrade into
	// twenty refusal expectations that cannot fail — coverage asserting the opposite of its own name. This pins
	// what the derivation actually yielded. (`verif/lifecycle-arrow-declarations.test.ts` holds the machine and
	// the spec table in agreement; this holds THIS FILE's reading of the machine to §8.2's own words.)
	it('INSTRUMENT — the derived source set is §8.2 "Any active": every non-terminal state, no terminal one', () => {
		const sources = ABANDON_MACHINE.states.filter(declaresAbandonFrom);
		const active = ABANDON_MACHINE.states.filter(
			(s) => !ABANDON_MACHINE.terminalStates.includes(s)
		);
		expect(
			sources,
			'the parameterised case must be asserting over a non-empty set'
		).not.toHaveLength(0);
		expect(sources).toEqual(active);
	});
});
