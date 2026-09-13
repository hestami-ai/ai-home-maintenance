// REG-D-024 / REG-F-044 — the claim-assessment capability, and the one refusal in it that is RATIFIED.
//
// WHAT WAS MISSING. Of 92 registered commands exactly ONE targeted a CLAIM (`AssertClaim`, which hard-codes
// `status: 'OPEN'`), and `ClaimSupported` / `ClaimContested` / `ClaimRejected` had payload schemas and
// event-registry rows with ZERO emitters. Seven of the eight ratified ClaimStatus values were reachable by
// nothing. The reference undertaking minted 9 claims across 332 events and all 9 finished OPEN — while
// fourteen assurance assessments reached SATISFIED citing one of them.
//
// COMMANDED, NOT DERIVED — and the corpus settles it, on text a prior pass did not find. RPH-DOC-008 §13
// RPH-EVD-002 reads: "Given a claim with no admissible evidence. When status is changed to SUPPORTED. Then
// THE COMMAND IS REJECTED." That ratifies a claim-status-changing COMMAND by presupposition; only its name
// was never minted. JPWB-DOC-003 §9 PER-3 forecloses the alternative — canonical state moves "only through
// authenticated, authorized, semantically named commands" — and PER-7 shuts the projection escape.
//
// ⚠ WHAT THIS IS NOT, stated here because a test file is where an overclaim would be believed:
//   - NOT A GATE. Measured before building: ONE actor can issue all nine of CreateAssurancePolicy
//     (independenceRequirement DIFFERENT_AGENT) -> Activate -> AssertClaim -> ProposeEvidence -> AdmitEvidence
//     -> Request/Begin/CompleteAssuranceAssessment(SATISFIED) and every one is ACCEPTED. `dispatch` has no
//     authentication stage; `validatorRole`/`evaluatorRole` have 4 writes and 0 reads. A caller can therefore
//     reach SUPPORTED through evidence it proposed and admitted itself. That is disclosed, not fixed here.
//   - NOT a ratified state machine. All 15 Claim.status arrows are AUTHORED (REG-F-045): the vocab says
//     "Transitions RECONSTRUCTED ... NO explicit matrix", and the generator has no field to carry that.
//   - NOT a closure of RPH-EVD-001. Reification means an assessment DECIDES a claim; this records one.
//
// THE ONE THING THAT *IS* NON-FORGEABLE is RPH-EVD-002's refusal, because ADMISSIBILITY is a fact the engine
// holds: evidence reaches ADMISSIBLE only through `AdmitEvidence`, and the check folds committed events
// rather than reading the payload. Hence the third test below, which is the one that pins ADMISSIBLE rather
// than merely PRESENT — the same distinction `authorityDecisionId` needed (EFFECTIVE, not merely present).

import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-08-06T00:00:00Z';
const ACTOR: ActorReference = { actorId: 'assessor', actorType: 'HUMAN', displayName: 'Assessor' };
const CLAIM = 'clm_01ARZ3NDEKTSV4RRFFQ69J8001';
const SUBJECT = 'pwu_01ARZ3NDEKTSV4RRFFQ69J8002';
const EV = 'evd_01ARZ3NDEKTSV4RRFFQ69J8003';
// The SIGN fixtures (#8 below): evidence pointing AGAINST the claim, and a second claim to point away at.
const AGAINST = 'evd_01ARZ3NDEKTSV4RRFFQ69J8011';
const OTHER_CLAIM = 'clm_01ARZ3NDEKTSV4RRFFQ69J8012';

describe('RecordClaimAssessment — the claim machine becomes reachable, and RPH-EVD-002 becomes real', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ authenticate: testAuthenticator(), store, now: () => TS, newEventId: () => `e${++seq}` }).as(TEST_CRED.human);
	});

	const dispatch = (commandType: string, payload: unknown, id: string, aggType: string) => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'reg-d-024',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	};

	const assertClaim = () =>
		dispatch(
			'AssertClaim',
			{
				statement: 'the tenant isolation boundary holds',
				claimType: 'COMPLETENESS',
				subjectObjectIds: [SUBJECT]
			},
			CLAIM,
			'CLAIM'
		);

	/** Propose evidence supporting the claim. `admit` = also drive it to ADMISSIBLE.
	 *  `links` overrides the SIGN of the claim links — `ProposeEvidence`'s two ratified, opposite-signed
	 *  fields. The default is the supporting case every test arranged before #8, so those fixtures are
	 *  byte-identical to what they were; #8 needs the other sign. */
	const proposeEvidence = (
		admit: boolean,
		evidenceId = EV,
		links: { supports?: readonly string[]; contradicts?: readonly string[] } = {}
	) => {
		const supports = links.supports ?? [CLAIM];
		const r = dispatch(
			'ProposeEvidence',
			{
				evidenceType: 'TEST_RESULT',
				contentReference: { uri: 'ref://suite/tenant-isolation' },
				producedBy: ACTOR,
				capturedAt: TS,
				scope: 'tenant isolation',
				limitations: [],
				supportsClaimIds: supports,
				contradictsClaimIds: links.contradicts ?? [],
				evidenceId
			},
			evidenceId,
			'EVIDENCE'
		);
		expect(r.status, 'arranging ProposeEvidence must succeed').toBe('ACCEPTED');
		if (admit) {
			const a = dispatch(
				'AdmitEvidence',
				// `admittedClaimIds` rides the event and is read by NO production code: an admission cannot
				// assert support, which is exactly why the support decision is folded from committed state.
				{
					admissibilityAssessmentId: 'asm-1',
					admittedScope: 'tenant isolation',
					admittedClaimIds: supports
				},
				evidenceId,
				'EVIDENCE'
			);
			expect(a.status, 'arranging AdmitEvidence must succeed').toBe('ACCEPTED');
		}
		return evidenceId;
	};

	const record = (targetStatus: string, extra: Record<string, unknown> = {}) =>
		dispatch('RecordClaimAssessment', { targetStatus, ...extra }, CLAIM, 'CLAIM');

	const claimStatus = () => (store.loadObject(CLAIM)?.state as { status?: string })?.status;

	/** COMMITTED Evidence state — the copy `claimsWithAdmissibleEvidence` folds, not the emitted payload. */
	const evidenceState = (id: string) =>
		(store.loadObject(id)?.state ?? {}) as {
			status?: string;
			supportsClaimIds?: readonly string[];
			contradictsClaimIds?: readonly string[];
		};

	/** The DERIVED supporting set `recordClaimAssessment` writes onto the claim when it reaches SUPPORTED. */
	const supportingEvidenceIds = () =>
		(store.loadObject(CLAIM)?.state as { supportingEvidenceIds?: readonly string[] } | undefined)
			?.supportingEvidenceIds;

	const eventTypes = () =>
		store
			.readAllEvents()
			.filter((e) => String(e.aggregateId) === CLAIM)
			.map((e) => String(e.eventType));

	// ── 1. THE RATIFIED REFUSAL ─────────────────────────────────────────────────────────────────────────────
	// RPH-EVD-002 verbatim. MUTANT: delete the guard in `recordClaimAssessment` -> this reddens.
	it('RPH-EVD-002 — a claim with NO admissible evidence cannot be moved to SUPPORTED', () => {
		expect(assertClaim().status).toBe('ACCEPTED');
		expect(record('UNDER_ASSESSMENT').status, 'OPEN -> UNDER_ASSESSMENT is legal').toBe('ACCEPTED');

		const r = record('SUPPORTED');
		expect(r.status, 'no evidence at all -> the command is rejected').not.toBe('ACCEPTED');
		expect(claimStatus(), 'and the claim did not move').toBe('UNDER_ASSESSMENT');
	});

	// ── 2. THE CONTROL, WITHOUT WHICH TEST 1 PASSES FOR A REFUSAL THAT REFUSES EVERYTHING ───────────────────
	// REG-F-015's lesson: every test in that file asserted a REJECTED publish, and REJECTED was the default,
	// so a file that arranged NOTHING passed. A negative test needs a positive control on the same path.
	// MUTANT: make the guard unconditional -> this reddens and test 1 stays green.
	it('CONTROL — with admissible evidence the same command SUCCEEDS and emits ClaimSupported', () => {
		expect(assertClaim().status).toBe('ACCEPTED');
		proposeEvidence(true);
		expect(record('UNDER_ASSESSMENT').status).toBe('ACCEPTED');

		const r = record('SUPPORTED');
		expect(r.status, 'admissible evidence exists -> accepted').toBe('ACCEPTED');
		expect(claimStatus()).toBe('SUPPORTED');
		expect(eventTypes(), 'the ratified event name is emitted, not a generic one').toContain(
			'ClaimSupported'
		);
	});

	// ── 3. ADMISSIBLE, NOT MERELY PRESENT ───────────────────────────────────────────────────────────────────
	// The word RPH-EVD-002 uses is "admissible". Evidence sits at PROPOSED until `AdmitEvidence` moves it, so
	// a check for mere existence would satisfy the sentence's shape and not its content.
	// MUTANT: weaken the guard from `status === 'ADMISSIBLE'` to "any supporting evidence exists" -> ONLY
	// this test reddens, which is what makes it load-bearing rather than a restatement of test 1.
	it('PROPOSED evidence is not ADMISSIBLE evidence — the refusal still fires', () => {
		expect(assertClaim().status).toBe('ACCEPTED');
		proposeEvidence(false); // proposed, never admitted
		expect(record('UNDER_ASSESSMENT').status).toBe('ACCEPTED');

		const r = record('SUPPORTED');
		expect(r.status, 'PROPOSED is not ADMISSIBLE -> still rejected').not.toBe('ACCEPTED');
		expect(claimStatus()).toBe('UNDER_ASSESSMENT');
	});

	// ── 4. THE EVIDENCE MUST SUPPORT *THIS* CLAIM ───────────────────────────────────────────────────────────
	// The conjunct that stops the guard being satisfied by any admissible evidence anywhere in the store —
	// REG-F-015's OBJECT limb, which in that case turned out to be a tautology comparing a thing with itself.
	it('admissible evidence supporting a DIFFERENT claim does not support this one', () => {
		expect(assertClaim().status).toBe('ACCEPTED');
		const other = 'clm_01ARZ3NDEKTSV4RRFFQ69J8009';
		expect(
			dispatch(
				'AssertClaim',
				{ statement: 'unrelated', claimType: 'COMPLETENESS', subjectObjectIds: [SUBJECT] },
				other,
				'CLAIM'
			).status
		).toBe('ACCEPTED');
		// evidence admitted, but pointing at `other`
		const r0 = dispatch(
			'ProposeEvidence',
			{
				evidenceType: 'TEST_RESULT',
				contentReference: { uri: 'ref://suite/other' },
				producedBy: ACTOR,
				capturedAt: TS,
				scope: 'other',
				limitations: [],
				supportsClaimIds: [other],
				contradictsClaimIds: [],
				evidenceId: 'evd_01ARZ3NDEKTSV4RRFFQ69J8010'
			},
			'evd_01ARZ3NDEKTSV4RRFFQ69J8010',
			'EVIDENCE'
		);
		expect(r0.status).toBe('ACCEPTED');
		expect(
			dispatch(
				'AdmitEvidence',
				{ admissibilityAssessmentId: 'asm-2', admittedScope: 'other', admittedClaimIds: [other] },
				'evd_01ARZ3NDEKTSV4RRFFQ69J8010',
				'EVIDENCE'
			).status
		).toBe('ACCEPTED');

		expect(record('UNDER_ASSESSMENT').status).toBe('ACCEPTED');
		expect(record('SUPPORTED').status, 'evidence for another claim is not evidence for this').not.toBe(
			'ACCEPTED'
		);
	});

	// ── 5. THE REFUSAL IS SCOPED TO SUPPORTED ───────────────────────────────────────────────────────────────
	// RPH-EVD-002 constrains one destination. A guard that refused every transition on missing evidence would
	// pass tests 1, 3 and 4 and would be wrong — CONTESTED and REJECTED need no supporting evidence.
	it('the evidence requirement binds SUPPORTED only — CONTESTED needs none', () => {
		expect(assertClaim().status).toBe('ACCEPTED');
		expect(record('UNDER_ASSESSMENT').status).toBe('ACCEPTED');

		const r = record('CONTESTED', { rationale: 'the isolation test was inconclusive' });
		expect(r.status, 'no evidence, and CONTESTED is still legal').toBe('ACCEPTED');
		expect(claimStatus()).toBe('CONTESTED');
		expect(eventTypes()).toContain('ClaimContested');
	});

	// ── 6. THE MACHINE STILL DECIDES LEGALITY ───────────────────────────────────────────────────────────────
	// The authored 15-arrow machine (REG-F-045) is the authority on which moves exist; this command does not
	// get to bypass it. OPEN -> SUPPORTED skips UNDER_ASSESSMENT and must be refused as an illegal transition
	// rather than accepted-and-then-guarded, so the two refusals stay distinguishable.
	it('an illegal transition is refused by the machine, not by the evidence guard', () => {
		expect(assertClaim().status).toBe('ACCEPTED');
		proposeEvidence(true); // evidence is present and admissible, so ONLY legality can refuse
		const r = record('SUPPORTED');
		expect(r.status, 'OPEN -> SUPPORTED is not an arrow the machine declares').not.toBe('ACCEPTED');
		expect(claimStatus()).toBe('OPEN');
	});
	// ── 7. THE SAME-STATE RE-ISSUE (REG-F-127) ──────────────────────────────────────────────────────────────
	//
	// DRIVEN BEFORE IT WAS DESIGNED: a second, byte-identical RecordClaimAssessment at the SAME status was
	// ACCEPTED and appended a second `ClaimSupported` — an event recording a change that did not happen, which
	// is AX-7's permanent false entry in an append-only log. Same shape as governance's REVOKED -> REVOKED and
	// as RuntimeBinding's N-22 before it was guarded.
	//
	// ⚠ THE RULE IS "NOTHING CHANGED", NOT "THE STATUS STAYED THE SAME", and the CONTROL below is what makes
	// the difference assertable. `runtime-binding.ts` records itself adopting the broad form first and
	// withdrawing it: a second assessment that reaches the same conclusion BY A DISTINCT ASSESSMENT is a real
	// professional act, and refusing it would strand the incremental case. A guard that refused every
	// `from === to` would pass the first test here and FAIL the second.
	it('REFUSES a re-assessment that changes nothing — no second ClaimSupported for a change that did not happen', () => {
		expect(assertClaim().status).toBe('ACCEPTED');
		proposeEvidence(true);
		expect(record('UNDER_ASSESSMENT').status).toBe('ACCEPTED');
		expect(record('SUPPORTED', { assessmentId: 'asm-1' }).status).toBe('ACCEPTED');
		expect(claimStatus()).toBe('SUPPORTED');

		const again = record('SUPPORTED', { assessmentId: 'asm-1' });
		expect(again.status, 'the identical re-issue records nothing new').not.toBe('ACCEPTED');
		expect(
			eventTypes().filter((e) => e === 'ClaimSupported'),
			'exactly ONE ClaimSupported — a second would assert an assessment that did not occur'
		).toHaveLength(1);
	});

	// THE CONTROL. Without it this guard is indistinguishable from narrowing `fromStates`, which is the
	// over-refusal the RuntimeBinding lineage already made and withdrew.
	it('CONTROL — a DISTINCT re-assessment at the same status is still ACCEPTED', () => {
		expect(assertClaim().status).toBe('ACCEPTED');
		proposeEvidence(true);
		expect(record('UNDER_ASSESSMENT').status).toBe('ACCEPTED');
		expect(record('SUPPORTED', { assessmentId: 'asm-1' }).status).toBe('ACCEPTED');

		const second = record('SUPPORTED', {
			assessmentId: 'asm-2',
			rationale: 'a second assessor reached the same conclusion independently'
		});
		expect(
			second.status,
			'a distinct assessment reaching the same conclusion is a real act'
		).toBe('ACCEPTED');
		expect(eventTypes().filter((e) => e === 'ClaimSupported')).toHaveLength(2);
	});

	// The other two self-edges ride the same handler and their event payloads differ, so "nothing changed" is a
	// different comparison on each arm — neither is assumed from the SUPPORTED case.
	it('the rule covers the other machine-admitted self-edges too, on their own arms', () => {
		expect(assertClaim().status).toBe('ACCEPTED');
		expect(record('UNDER_ASSESSMENT', { assessmentId: 'asm-1' }).status).toBe('ACCEPTED');
		expect(
			record('UNDER_ASSESSMENT', { assessmentId: 'asm-1' }).status,
			'UNDER_ASSESSMENT -> UNDER_ASSESSMENT with nothing new'
		).not.toBe('ACCEPTED');

		expect(record('CONTESTED', { rationale: 'inconclusive' }).status).toBe('ACCEPTED');
		expect(
			record('CONTESTED', { rationale: 'inconclusive' }).status,
			'CONTESTED -> CONTESTED with nothing new'
		).not.toBe('ACCEPTED');
	});

	// ── 8. THE SIGN OF THE CLAIM LINK IS LOAD-BEARING (JAN-PFA S3.3) ─────────────────────────────────────────
	//
	// WHICH MUTANT THIS CLOSES, and why nothing above could see it. `proposeEvidence` (assurance.ts) writes
	// `ProposeEvidence`'s two ratified, OPPOSITE-SIGNED fields onto committed Evidence state, and
	// `claimsWithAdmissibleEvidence` folds the SUPPORTING one — and only that one — to answer RPH-EVD-002 in
	// test 1. The inventoried mutation merges the other sign into it:
	//
	//     supportsClaimIds: p.supportsClaimIds,
	//  -> supportsClaimIds: [...p.supportsClaimIds, ...p.contradictsClaimIds],
	//
	// It contaminates COMMITTED STATE only; the emitted `EvidenceProposed` payload stays honest, so
	// `supportsGraph`, the SUPPORTS trace links and the invalidation cascade are untouched and every
	// event-level assertion in the repo stays green. What changes is the one answer that matters: the claim
	// reaches SUPPORTED on the strength of evidence that REFUTES it — Inv-3 / RPH-EVD-002 inverted, with the
	// guard still firing and simply asking the wrong set.
	//
	// Tests 1-4 proved the refusal HAPPENS (no evidence / PROPOSED-only / another claim's evidence) and every
	// one of them arranges `contradictsClaimIds: []`, where HEAD and the mutant are byte-identical. Test 4 is
	// the adjacent control on the OBJECT of the link; this is its missing twin on the SIGN.
	it('admissible evidence that CONTRADICTS this claim does not support it', () => {
		expect(assertClaim().status).toBe('ACCEPTED');
		proposeEvidence(true, AGAINST, { supports: [], contradicts: [CLAIM] });

		// The arrangement's own precondition, so the refusal below cannot be the cheaper one — evidence that
		// never became admissible at all. `admitEvidence` deliberately passes no `claimId` to
		// `evidenceAdmissibility`, which is the only input that scores RELEVANT, so evidence that merely
		// contradicts IS genuinely ADMISSIBLE and the refusal can only be about the sign.
		expect(evidenceState(AGAINST).status, 'the contradicting evidence IS admissible').toBe('ADMISSIBLE');

		// THE PROMISE, asserted BEFORE the field shapes below on purpose: the mutation must be caught by what
		// the engine DECIDES, not only by how it filed the link. A test whose first red is a field comparison
		// would be satisfied by any edit that moved both sides.
		expect(record('UNDER_ASSESSMENT').status).toBe('ACCEPTED');
		const r = record('SUPPORTED');
		expect(r.status, 'evidence against a claim is not evidence for it').not.toBe('ACCEPTED');
		expect(r.error?.message, 'and RPH-EVD-002 is what refuses, not an earlier gate').toContain(
			'no ADMISSIBLE evidence supports it'
		);
		expect(claimStatus(), 'and the claim did not move').toBe('UNDER_ASSESSMENT');

		// THE MECHANISM, corroborating the decision above rather than standing in for it.
		expect(evidenceState(AGAINST).contradictsClaimIds, 'it is filed AGAINST this claim').toEqual([CLAIM]);
		expect(
			evidenceState(AGAINST).supportsClaimIds,
			'and was not ALSO filed as support — the two fields keep opposite signs in committed state'
		).not.toContain(CLAIM);
	});

	// THE CONTROL. Without it the assertion above is satisfied by a guard that disqualifies a claim the moment
	// ANY contradicting evidence exists — an over-refusal that would strand the ordinary professional case of a
	// claim supported by one admissible artifact and questioned by another. The claim must still reach
	// SUPPORTED, and the DERIVED record must name what supports it and not what opposes it.
	it('CONTROL — real support still reaches SUPPORTED with a contradiction sitting in the store', () => {
		expect(assertClaim().status).toBe('ACCEPTED');
		proposeEvidence(true, AGAINST, { supports: [], contradicts: [CLAIM] });
		const forClaim = proposeEvidence(true); // the default sign: supports [CLAIM]
		expect(record('UNDER_ASSESSMENT').status).toBe('ACCEPTED');

		const r = record('SUPPORTED', { assessmentId: 'asm-1' });
		expect(r.status, `a contradiction must not disqualify real support: ${r.error?.message}`).toBe(
			'ACCEPTED'
		);
		expect(claimStatus()).toBe('SUPPORTED');
		expect(
			supportingEvidenceIds(),
			'the claim records the evidence FOR it, not every admissible artifact that names it'
		).toEqual([forClaim]);
	});

	// THE SECOND CONTROL, on the other direction of the same precision: carrying a contradiction about SOME
	// OTHER claim must not cost an artifact its voice on this one. A guard that ignored every piece of evidence
	// with a non-empty `contradictsClaimIds` would pass both tests above and fail here.
	it('CONTROL — evidence may support this claim and contradict a different one at once', () => {
		expect(assertClaim().status).toBe('ACCEPTED');
		expect(
			dispatch(
				'AssertClaim',
				{
					statement: 'the cache is coherent',
					claimType: 'COMPLETENESS',
					subjectObjectIds: [SUBJECT]
				},
				OTHER_CLAIM,
				'CLAIM'
			).status
		).toBe('ACCEPTED');
		const both = proposeEvidence(true, EV, { supports: [CLAIM], contradicts: [OTHER_CLAIM] });
		expect(evidenceState(both).contradictsClaimIds, 'it really does contradict the other').toEqual([
			OTHER_CLAIM
		]);

		expect(record('UNDER_ASSESSMENT').status).toBe('ACCEPTED');
		const r = record('SUPPORTED', { assessmentId: 'asm-1' });
		expect(r.status, `a contradiction elsewhere is not a defect here: ${r.error?.message}`).toBe(
			'ACCEPTED'
		);
		expect(claimStatus()).toBe('SUPPORTED');
		expect(supportingEvidenceIds()).toEqual([both]);
	});
});
