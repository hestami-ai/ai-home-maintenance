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
			issuedBy: ACTOR,
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

	/** Propose evidence supporting the claim. `admit` = also drive it to ADMISSIBLE. */
	const proposeEvidence = (admit: boolean, evidenceId = EV) => {
		const r = dispatch(
			'ProposeEvidence',
			{
				evidenceType: 'TEST_RESULT',
				contentReference: { uri: 'ref://suite/tenant-isolation' },
				producedBy: ACTOR,
				capturedAt: TS,
				scope: 'tenant isolation',
				limitations: [],
				supportsClaimIds: [CLAIM],
				contradictsClaimIds: [],
				evidenceId
			},
			evidenceId,
			'EVIDENCE'
		);
		expect(r.status, 'arranging ProposeEvidence must succeed').toBe('ACCEPTED');
		if (admit) {
			const a = dispatch(
				'AdmitEvidence',
				{ admissibilityAssessmentId: 'asm-1', admittedScope: 'tenant isolation', admittedClaimIds: [CLAIM] },
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
});
