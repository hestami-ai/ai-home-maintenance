// W1 WIRE-3a (JAN-ROADMAP-001 gate G1 condition C1): ProposeRecomposition mints a RecompositionContract (the
// plane BeginRecomposition/CompleteRecomposition decide over — previously un-instantiated), and
// CompleteRecomposition now runs evaluateRecomposition (§14.1 / RPH-DEC-005/006) instead of unconditionally
// advancing to COMPOSABLE. The §19-prohibited shortcut it closes: "recomposition = concatenation" — a
// recomposition with a detected conflict (or an unacceptable required child) used to be marked COMPOSABLE anyway.
//
// The kernel's precedence (conflict > insufficient > satisfied) is unit-tested in rph-domain/decomposition.test.ts.
// These tests prove the LIVE handler ROUTES each kernel outcome to the right RecompositionContract.status state:
// CONFLICTED / INSUFFICIENT / COMPOSABLE — including conflict taking precedence over an unacceptable child.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-19T00:00:00Z';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5V00';
const PARENT = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5V01';
const CHILD_A = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5V0A';
const CHILD_B = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5V0B';
const RCP = 'rcp_01ARZ3NDEKTSV4RRFFQ69G5V05';
const CLAIM = 'clm_01ARZ3NDEKTSV4RRFFQ69G5V06';
const WAIVER_A = 'dec_01ARZ3NDEKTSV4RRFFQ69G5V07';

describe('CompleteRecomposition evaluates instead of concatenating (WP-1-006, §14.1, live pipeline)', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	function dispatch(
		commandType: string,
		targetAggregateId: string,
		targetAggregateType: string,
		payload: unknown
	) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType,
			targetAggregateId,
			issuedAt: TS,
			correlationId: 'corr-recomp',
			idempotencyKey: `idem-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	function proposePwu(pwuId: string) {
		dispatch('ProposePwu', pwuId, 'PROFESSIONAL_WORK_UNIT', {
			pwuId,
			pwuKind: 'ARCHITECTURE',
			title: pwuId,
			description: 'd',
			intentId: INTENT,
			boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
			obligationIds: [],
			constraintIds: [],
			assumptionIds: [],
			expectedOutputs: [],
			assurancePolicyIds: [],
			riskProfile: {
				consequence: 'HIGH',
				uncertainty: 'MEDIUM',
				irreversibility: 'MEDIUM',
				securitySensitivity: 'HIGH',
				regulatoryExposure: 'LOW'
			}
		});
	}

	function propose(requiredChildWorkUnitIds: string[], conflictRules: unknown[] = []) {
		// ⚠ THESE TWO RESULTS ARE NOW READ. They were dispatched and discarded, and when ProposeRecomposition
		// began refusing an empty child list (REG-F-041 S-0) the repo's own REG-F-015 guard fired on this helper:
		// "DISPATCH REFUSED AND NEVER READ ... if it was an arrangement, the arrangement did not happen and
		// nothing here could tell." An arrangement that cannot report its own failure is not an arrangement.
		const proposed = dispatch('ProposeRecomposition', RCP, 'RECOMPOSITION_CONTRACT', {
			parentWorkUnitId: PARENT,
			requiredChildWorkUnitIds,
			parentCompletionClaimId: CLAIM,
			conflictResolutionRules: conflictRules
		});
		expect(proposed.status, JSON.stringify(proposed.error)).toBe('ACCEPTED');
		const begun = dispatch('BeginRecomposition', RCP, 'RECOMPOSITION_CONTRACT', {
			recompositionContractId: RCP
		});
		expect(begun.status, JSON.stringify(begun.error)).toBe('ACCEPTED');
	}

	/** Drive `childId` to an assurance state `ACCEPTABLE_CHILD_ASSURANCE` admits, HONESTLY — via a real WAIVER
	 *  Decision that names it, granted through GrantWaiver.
	 *
	 *  ⚠ WAIVED RATHER THAN SATISFIED, and the choice is deliberate. Both are acceptable
	 *  (`handlers/decomposition.ts` ACCEPTABLE_CHILD_ASSURANCE = {SATISFIED, WAIVED}), but SATISFIED requires the
	 *  PWU to reach UNDER_ASSURANCE first — a chain of execution hops this file has no reason to walk — whereas
	 *  the assurance axis can be moved while workLifecycle stays PROPOSED, and child acceptability reads ONLY
	 *  `assuranceState`. WAIVED is also the arm REG-F-042 kept on DEC-6's own exception clause ("an explicit,
	 *  policy-permitted act that closes its condition"), and until now it was pinned only by an exact-membership
	 *  assertion with no live consumer.
	 *
	 *  ⚠ NOTHING HERE IS FABRICATED. `rejectUnbackedDisposition` refuses an asserted disposition with nothing
	 *  behind it, and `pwu.test.ts` records a test that once fabricated exactly this and was corrected. The waiver
	 *  is proposed, GRANTED (never ApproveDecision — an approval does not make a waiver effective), and cited. */
	function waiveChild(childId: string, waiverId: string): void {
		const ok = (r: { status: string; error?: { message?: string } }, what: string): void => {
			expect(r.status, `${what}: ${JSON.stringify(r.error)}`).toBe('ACCEPTED');
		};
		// WAIVED is not reachable from the birth axis, so the child crosses to EVIDENCE_REQUIRED first.
		ok(
			dispatch('ChangePwuState', childId, 'PROFESSIONAL_WORK_UNIT', {
				previousState: 'PROPOSED',
				newState: 'PROPOSED',
				executionState: 'NOT_PLANNED',
				assuranceState: 'EVIDENCE_REQUIRED',
				shapeIntegrityState: 'UNKNOWN',
				reasonCode: 'CONTROLLER',
				supportingObjectIds: []
			}),
			'open the assurance axis'
		);
		ok(
			dispatch('ProposeDecision', waiverId, 'DECISION', {
				decisionType: 'WAIVER',
				subjectObjectIds: [childId],
				selectedOption: 'accept the residual risk on this child',
				rationale: 'Recorded so the recomposition control rests on a real, granted waiver.',
				// ⚠ THE ISSUING ACTOR, not a convenient literal: ASR-15 refuses a Decision whose declared authority is
				// anyone but its issuer, absent a delegation record. `TEST_CRED.human` resolves to u1/Operator.
				authority: { actorId: 'u1', actorType: 'HUMAN', displayName: 'Operator' },
				consideredEvidenceIds: [],
				consideredObservationIds: []
			}),
			'propose the waiver'
		);
		ok(
			dispatch('GrantWaiver', waiverId, 'DECISION', { waiverDecisionId: waiverId, duration: 'P30D' }),
			'grant the waiver'
		);
		ok(
			dispatch('ChangePwuState', childId, 'PROFESSIONAL_WORK_UNIT', {
				previousState: 'PROPOSED',
				newState: 'PROPOSED',
				executionState: 'NOT_PLANNED',
				assuranceState: 'WAIVED',
				shapeIntegrityState: 'UNKNOWN',
				reasonCode: 'CONTROLLER',
				supportingObjectIds: [waiverId]
			}),
			'waive the child'
		);
	}

	function complete(extra: Record<string, unknown> = {}) {
		return dispatch('CompleteRecomposition', RCP, 'RECOMPOSITION_CONTRACT', {
			parentCompletionClaimId: CLAIM,
			...extra
		});
	}

	function statusOf(id: string): string {
		return (store.loadObject(id)?.state as Record<string, string>)?.status ?? '';
	}

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ authenticate: testAuthenticator(), store, now: () => TS, newEventId: () => `evt_${++seq}` }).as(TEST_CRED.human);
		dispatch('CaptureIntent', INTENT, 'INTENT', {
			intentId: INTENT,
			originatingExpression: 'x',
			ontologyId: 'o',
			ontologyVersion: '1'
		});
		proposePwu(PARENT);
		proposePwu(CHILD_A);
		proposePwu(CHILD_B);
	});

	it('ProposeRecomposition mints the contract in READY; BeginRecomposition advances it to EVALUATING', () => {
		dispatch('ProposeRecomposition', RCP, 'RECOMPOSITION_CONTRACT', {
			parentWorkUnitId: PARENT,
			requiredChildWorkUnitIds: [CHILD_A],
			parentCompletionClaimId: CLAIM
		});
		expect(statusOf(RCP)).toBe('READY');
		expect((store.loadObject(RCP)?.state as Record<string, unknown>).objectType).toBe(
			'RECOMPOSITION_CONTRACT'
		);
		dispatch('BeginRecomposition', RCP, 'RECOMPOSITION_CONTRACT', { recompositionContractId: RCP });
		expect(statusOf(RCP)).toBe('EVALUATING');
	});

	it('a detected conflict routes to CONFLICTED, not COMPOSABLE (recomposition is NOT concatenation)', () => {
		propose([CHILD_A, CHILD_B], [{ conflictType: 'TENANT_IDENTITY_MISMATCH', action: 'REJECT_RECOMPOSITION' }]);
		const r = complete({
			detectedConflicts: [
				{
					conflictType: 'TENANT_IDENTITY_MISMATCH',
					conflictingChildWorkUnitIds: [CHILD_A, CHILD_B],
					description: 'incompatible tenant identity models'
				}
			]
		});
		expect(r.status).toBe('ACCEPTED');
		expect(statusOf(RCP)).toBe('CONFLICTED');
	});

	it('a required child that is not assurance-acceptable routes to INSUFFICIENT', () => {
		// CHILD_A/CHILD_B are freshly proposed (assuranceState=UNASSESSED) → not acceptable
		propose([CHILD_A, CHILD_B]);
		const r = complete();
		expect(r.status).toBe('ACCEPTED');
		expect(statusOf(RCP)).toBe('INSUFFICIENT');
	});

	it('a detected conflict takes precedence over an unacceptable child (CONFLICTED, not INSUFFICIENT)', () => {
		propose([CHILD_A, CHILD_B]); // children unacceptable AND a conflict present
		const r = complete({
			detectedConflicts: [
				{
					conflictType: 'OFFLINE_AUDIT_CONFLICT',
					conflictingChildWorkUnitIds: [CHILD_A],
					description: 'offline audit trail cannot reconcile'
				}
			]
		});
		expect(r.status).toBe('ACCEPTED');
		expect(statusOf(RCP)).toBe('CONFLICTED');
	});

	// ⚠ BOTH OF THESE USED TO ARRANGE `propose([])` — A RECOMPOSITION OF NOTHING (REG-F-041 S-0). That was the
	// cheap route to COMPOSABLE precisely because it is the broken one: with no required children the kernel's
	// child rung (`unsatisfied.length > 0`) is VACUOUSLY FALSE, so every child-acceptability check passed by
	// having nothing to check. `proposeRecomposition` now refuses an empty contract, so the control has to earn
	// its COMPOSABLE with a child that is genuinely acceptable — which is the whole point of the guard.
	it('an ACCEPTABLE child, no conflict, whole-checks hold -> COMPOSABLE (the discriminating control)', () => {
		waiveChild(CHILD_A, WAIVER_A);
		propose([CHILD_A]);
		const r = complete();
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		// THE DISCRIMINATION: without this, an `evaluateRecomposition` that returned INSUFFICIENT unconditionally
		// would satisfy every other test in this file. It is the only one that reaches COMPOSABLE.
		expect(statusOf(RCP)).toBe('COMPOSABLE');
	});

	it('the recomposed whole not supporting the parent claim routes to INSUFFICIENT', () => {
		// The child is ACCEPTABLE, so the child rung passes on its merits and cannot be what routes this — the
		// WHOLE-check is the only remaining cause. With `propose([])` that separation was an accident of emptiness.
		waiveChild(CHILD_A, WAIVER_A);
		propose([CHILD_A]);
		const r = complete({ parentCompletionClaimSupported: false });
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(statusOf(RCP)).toBe('INSUFFICIENT');
	});

	// ── S-0's OWN RED: an empty composition is refused at PROPOSE ────────────────────────────────────────────
	it('refuses a recomposition contract naming NO required children, and mints nothing', () => {
		const r = dispatch('ProposeRecomposition', RCP, 'RECOMPOSITION_CONTRACT', {
			parentWorkUnitId: PARENT,
			requiredChildWorkUnitIds: [],
			parentCompletionClaimId: CLAIM
		});
		expect(r.status, JSON.stringify(r.error)).toBe('REJECTED');
		expect(r.error?.message).toContain('at least one required child work unit');
		expect(store.loadObject(RCP), 'a refused proposal must mint no contract').toBeUndefined();
	});

	// CONTROL — the guard must refuse EMPTINESS, not proposals. Without this a `return reject(...)` with no
	// condition would satisfy the test above while making every recomposition unproposable.
	it('CONTROL: a contract naming one required child is proposed normally', () => {
		const r = dispatch('ProposeRecomposition', RCP, 'RECOMPOSITION_CONTRACT', {
			parentWorkUnitId: PARENT,
			requiredChildWorkUnitIds: [CHILD_A],
			parentCompletionClaimId: CLAIM
		});
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(statusOf(RCP)).toBe('READY');
	});

	// ── REG-F-020 residue: the caller must NAME the claim this contract settles ──────────────────────────────
	//
	// `parentCompletionClaimId` is REQUIRED on CompleteRecomposition and was READ BY NOTHING — the event took it
	// from the contract and no line referenced the payload's. A required field nothing reads is the
	// `GrantWaiver.effectiveAt` shape. Removing it was available (the command is UNRATIFIED-AUTHORED) and is the
	// weaker answer: checking it catches a caller completing the WRONG contract, which is a real mistake at a
	// real seam — the contract id and the claim id are different ids.
	describe('the named parent completion claim is a precondition, not decoration', () => {
		it('refuses a completion that names a DIFFERENT claim, and the contract does not advance', () => {
			propose([CHILD_A]);
			const r = complete({ parentCompletionClaimId: 'clm_01ARZ3NDEKTSV4RRFFQ69G5VZZ' });
			expect(r.status, JSON.stringify(r.error)).toBe('REJECTED');
			expect(r.error?.message).toContain('was proposed to settle');
			expect(statusOf(RCP), 'a refused completion leaves the contract EVALUATING').toBe('EVALUATING');
		});

		// CONTROL — the guard must not refuse the correct caller. Without this a `return reject(...)` with no
		// condition would satisfy the test above.
		it('CONTROL: the matching claim completes normally', () => {
			propose([CHILD_A]);
			const r = complete();
			expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
			// INSUFFICIENT, not COMPOSABLE: a freshly proposed child is UNASSESSED and so not acceptable. The
			// outcome is not the point — the point is that the guard ACCEPTS the correct caller and lets the
			// evaluation decide, rather than refusing before it runs.
			expect(statusOf(RCP)).toBe('INSUFFICIENT');
		});
	});
});
