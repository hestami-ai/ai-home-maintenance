// W1 hollow-kernel triage, WIRE gap #4 — invalidated evidence must re-contest the claims it supported.
//
// THE GAP, as the triage records it: *"Admit E supporting claim C; `InvalidateEvidence(E)` must flag C for
// REVALIDATION, not leave it silently supported."* Invariant P4 / CT-10.
//
// `classifyEvidenceInvalidation` (packages/rph-domain/src/traceability.ts:195) computes exactly that — every claim
// the evidence SUPPORTS, classified REVALIDATION — and has been reachable from nothing but tests. The handler
// (assurance.ts) advances Evidence.status to INVALIDATED and stops, behind a comment that delegates the work
// elsewhere: *"(P4: dependent claims are re-contested by the controller)"*. There is no controller doing it.
//
// THE MECHANISM IS ALREADY DECLARED, WHICH IS WHY THIS IS WIRING AND NOT DESIGN.
// `EvidenceInvalidatedPayloadSchema` (messages.ts:1046-1050) declares `affectedClaimIds`, optional, and nothing
// has ever populated it. That is the same shape as F-I (REG-005 REG-F-006): a declared field the handler never
// writes. Here it is closed by wiring rather than by refusal, because unlike F-I the kernel that computes the
// value exists, is adversarially reviewed, and needs only a call site.
//
// FOUR OF THE TRIAGE'S FIVE GAPS WERE ALREADY CLOSED when this was checked (2026-07-29):
// validateObligationConservation and validateConstraintPropagation at decomposition.ts:210-211,
// evaluateRecomposition at :467, decisionAuthorizesVersions at governance.ts:652. This was the last one.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-29T00:00:00Z';
const HUMAN: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'User' };

const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G7W01';
const INT = 'int_01ARZ3NDEKTSV4RRFFQ69G7W02';
const CLAIM_A = 'clm_01ARZ3NDEKTSV4RRFFQ69G7W0A';
const CLAIM_B = 'clm_01ARZ3NDEKTSV4RRFFQ69G7W0B';
const EV_SUPPORTING = 'evd_01ARZ3NDEKTSV4RRFFQ69G7W0E';
const EV_LONELY = 'evd_01ARZ3NDEKTSV4RRFFQ69G7W0F';

function harness() {
	const store = new SqliteStorageAdapter({ now: () => TS });
	let seq = 0;
	const engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
	const d = (commandType: string, id: string, type: string, payload: unknown) => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: HUMAN,
			correlationId: 'wire4',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	};
	return {
		d,
		invalidationEvents: () =>
			store.readAllEvents().filter((e) => e.eventType === 'EvidenceInvalidated'),
		stateOf: (id: string) => store.loadObject(id)?.state as Record<string, unknown>
	};
}

describe('WIRE #4 — invalidated evidence re-contests the claims it supported (P4 / CT-10)', () => {
	let h: ReturnType<typeof harness>;

	/** Admit `evidenceId` supporting `claimIds`. Claims are asserted first — evidence names what it supports. */
	function admitEvidence(evidenceId: string, claimIds: readonly string[]) {
		expect(
			h.d('ProposeEvidence', evidenceId, 'EVIDENCE', {
				evidenceId,
				evidenceType: 'TEST_RESULT',
				contentReference: { uri: 'file://fixture-artifact' },
				producedBy: HUMAN,
				supportsClaimIds: [...claimIds],
				contradictsClaimIds: [],
				scope: 'architecture',
				limitations: [],
				capturedAt: TS
			}).status
		).toBe('ACCEPTED');
		expect(
			h.d('AdmitEvidence', evidenceId, 'EVIDENCE', {
				admissibilityAssessmentId: 'a',
				admittedScope: 'architecture',
				admittedClaimIds: [...claimIds]
			}).status
		).toBe('ACCEPTED');
	}

	function assertClaim(claimId: string, evidenceIds: readonly string[]) {
		expect(
			h.d('AssertClaim', claimId, 'CLAIM', {
				statement: `claim ${claimId}`,
				claimType: 'FITNESS',
				subjectObjectIds: [PWU],
				supportingEvidenceIds: [...evidenceIds]
			}).status
		).toBe('ACCEPTED');
	}

	beforeEach(() => {
		h = harness();
		h.d('CaptureIntent', INT, 'INTENT', {
			intentId: INT,
			originatingExpression: 'x',
			ontologyId: 'o',
			ontologyVersion: '1'
		});
		h.d('ProposePwu', PWU, 'PROFESSIONAL_WORK_UNIT', {
			pwuId: PWU,
			pwuKind: 'ARCHITECTURE',
			title: 'subject',
			description: 'd',
			intentId: INT,
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
	});

	it('names every claim the invalidated evidence supported', () => {
		assertClaim(CLAIM_A, [EV_SUPPORTING]);
		assertClaim(CLAIM_B, [EV_SUPPORTING]);
		admitEvidence(EV_SUPPORTING, [CLAIM_A, CLAIM_B]);

		expect(
			h.d('InvalidateEvidence', EV_SUPPORTING, 'EVIDENCE', { invalidationReason: 'source retracted' })
				.status
		).toBe('ACCEPTED');

		const [event] = h.invalidationEvents();
		expect(event, 'invalidation must emit its event').toBeDefined();
		const affected = ((event!.payload as Record<string, unknown>).affectedClaimIds ?? []) as string[];
		// BOTH claims, not just one. A wiring that took the first SUPPORTS link would satisfy "not silently
		// supported" while leaving the second claim exactly as silently supported as before.
		expect([...affected].sort(), 'every supported claim must be named').toEqual(
			[CLAIM_A, CLAIM_B].sort()
		);
	});

	it('CONTROL — evidence supporting NO claim names none, and is not refused', () => {
		// Without this, "always report every claim in the workspace" satisfies the assertion above. It also pins
		// the honest-empty case: an absent list and a list that was computed-and-empty must both be legal, because
		// invalidating unrelated evidence is a normal act, not an error.
		assertClaim(CLAIM_A, []);
		admitEvidence(EV_LONELY, []);

		expect(
			h.d('InvalidateEvidence', EV_LONELY, 'EVIDENCE', { invalidationReason: 'superseded' }).status
		).toBe('ACCEPTED');

		const [event] = h.invalidationEvents();
		const affected = ((event!.payload as Record<string, unknown>).affectedClaimIds ?? []) as string[];
		expect(affected, 'a claim this evidence never supported must not be named').toEqual([]);
		expect(h.stateOf(EV_LONELY).status, 'the invalidation still succeeds').toBe('INVALIDATED');
	});
});
