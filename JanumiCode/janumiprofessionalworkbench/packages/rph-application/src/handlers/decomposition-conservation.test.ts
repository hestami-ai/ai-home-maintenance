// W1 WIRE-1/2 (JAN-ROADMAP-001 gate G1 condition C1): ValidateDecomposition now enforces obligation conservation
// (Property P2 / RPH-DEC-002/007 / §35.1 "no obligation disappears") and constraint propagation (Property P3 /
// RPH-CNS-001..004 / RPH-DEC-003 / §35.1 "no constraint silently drops") over the FIRST-CLASS Obligation/Constraint
// objects the parent PWU references. Before this increment the validator's VALID verdict was taken at face value:
// a decomposition that left a MANDATORY parent obligation unallocated, or silently dropped a mandatory constraint
// from a relevant child, was accepted anyway. These tests drive the LIVE engine pipeline (engine.dispatch) and
// assert the call site — not just the kernel — rejects the violating input.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-19T00:00:00Z';
const human = { actorId: 'arch-1', actorType: 'HUMAN' as const, displayName: 'Architect' };
const authority = {
	authorityId: 'auth_arch',
	authorityType: 'ORGANIZATIONAL_ROLE' as const,
	scope: ['architecture'],
	validFrom: TS
};
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5V00';
const PARENT = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5V01';
const CHILD_A = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5V0A';
const CHILD_B = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5V0B';
const OBL = 'obl_01ARZ3NDEKTSV4RRFFQ69G5V02';
const CON = 'con_01ARZ3NDEKTSV4RRFFQ69G5V03';
const DCP = 'dcp_01ARZ3NDEKTSV4RRFFQ69G5V04';

describe('ValidateDecomposition conservation gate (WP-1-005/006, P2/P3, live pipeline)', () => {
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
			issuedBy: human,
			correlationId: 'corr-cons',
			idempotencyKey: `idem-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	function proposePwu(pwuId: string, obligationIds: string[], constraintIds: string[]) {
		dispatch('ProposePwu', pwuId, 'PROFESSIONAL_WORK_UNIT', {
			pwuId,
			pwuKind: 'ARCHITECTURE',
			title: pwuId,
			description: 'd',
			intentId: INTENT,
			boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
			obligationIds,
			constraintIds,
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

	function assertObligation(id: string, strength: string) {
		dispatch('AssertObligation', id, 'OBLIGATION', {
			statement: 'Isolate tenant data',
			obligationType: 'SECURITY',
			sourceObjectId: PARENT,
			authority,
			strength
		});
	}

	function assertConstraint(id: string, strength: string) {
		dispatch('AssertConstraint', id, 'CONSTRAINT', {
			statement: 'Encrypt PII at rest',
			constraintType: 'SECURITY',
			sourceObjectId: PARENT,
			authority,
			applicability: { objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'] },
			strength
		});
	}

	function proposeDecomposition(extra: Record<string, unknown>) {
		dispatch('ProposeDecomposition', DCP, 'DECOMPOSITION_CONTRACT', {
			parentWorkUnitId: PARENT,
			childWorkUnitIds: [CHILD_A, CHILD_B],
			rationale: 'split',
			...extra
		});
	}

	function validate(disposition = 'VALID') {
		return dispatch('ValidateDecomposition', DCP, 'DECOMPOSITION_CONTRACT', { disposition });
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
	});

	it('REJECTS marking VALID a decomposition that leaves a MANDATORY parent obligation unaccounted (P2)', () => {
		assertObligation(OBL, 'MANDATORY');
		proposePwu(PARENT, [OBL], []);
		proposePwu(CHILD_A, [], []);
		proposePwu(CHILD_B, [], []);
		proposeDecomposition({}); // no obligationAllocations, no retainedParentObligationIds → the obligation vanishes
		const r = validate('VALID');
		expect(r.status).not.toBe('ACCEPTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message).toContain('MISSING_OBLIGATION_ALLOCATION');
		expect(statusOf(DCP)).toBe('UNDER_REVIEW'); // did not advance to VALID
	});

	it('ACCEPTS when the mandatory obligation is allocated to a child (the control must discriminate)', () => {
		assertObligation(OBL, 'MANDATORY');
		proposePwu(PARENT, [OBL], []);
		proposePwu(CHILD_A, [], []);
		proposePwu(CHILD_B, [], []);
		proposeDecomposition({ obligationAllocations: [{ obligationId: OBL, allocatedTo: [CHILD_A] }] });
		const r = validate('VALID');
		expect(r.status).toBe('ACCEPTED');
		expect(statusOf(DCP)).toBe('VALID');
	});

	it('ACCEPTS when the mandatory obligation is retained at the parent', () => {
		assertObligation(OBL, 'MANDATORY');
		proposePwu(PARENT, [OBL], []);
		proposePwu(CHILD_A, [], []);
		proposePwu(CHILD_B, [], []);
		proposeDecomposition({ retainedParentObligationIds: [OBL] });
		expect(validate('VALID').status).toBe('ACCEPTED');
	});

	it('does NOT gate an ADVISORY obligation (only MANDATORY is conservation-gated)', () => {
		assertObligation(OBL, 'ADVISORY');
		proposePwu(PARENT, [OBL], []);
		proposePwu(CHILD_A, [], []);
		proposePwu(CHILD_B, [], []);
		proposeDecomposition({});
		expect(validate('VALID').status).toBe('ACCEPTED');
	});

	it('REJECTS marking VALID when a MANDATORY constraint silently drops a relevant child (P3)', () => {
		assertConstraint(CON, 'MANDATORY');
		proposePwu(PARENT, [], [CON]);
		proposePwu(CHILD_A, [], []);
		proposePwu(CHILD_B, [], []);
		// disposition CHILD_A only; CHILD_B is a relevant child left undispositioned → SILENT_CONSTRAINT_DROP
		proposeDecomposition({
			constraintPropagations: [
				{ constraintId: CON, childWorkUnitIds: [CHILD_A], disposition: 'PROPAGATED' }
			]
		});
		const r = validate('VALID');
		expect(r.status).not.toBe('ACCEPTED');
		expect(r.error?.message).toContain('SILENT_CONSTRAINT_DROP');
		expect(r.error?.message).toContain(CHILD_B);
		expect(statusOf(DCP)).toBe('UNDER_REVIEW');
	});

	it('ACCEPTS when every relevant child is dispositioned for the mandatory constraint', () => {
		assertConstraint(CON, 'MANDATORY');
		proposePwu(PARENT, [], [CON]);
		proposePwu(CHILD_A, [], []);
		proposePwu(CHILD_B, [], []);
		proposeDecomposition({
			constraintPropagations: [
				{ constraintId: CON, childWorkUnitIds: [CHILD_A, CHILD_B], disposition: 'PROPAGATED' }
			]
		});
		expect(validate('VALID').status).toBe('ACCEPTED');
	});

	it('leaves an obligation-free / constraint-free decomposition (the reference-fixture shape) VALID', () => {
		proposePwu(PARENT, [], []);
		proposePwu(CHILD_A, [], []);
		proposePwu(CHILD_B, [], []);
		proposeDecomposition({});
		expect(validate('VALID').status).toBe('ACCEPTED');
	});

	// ── AN AUTHORITY BASIS MUST BE A REAL, EFFECTIVE DECISION (REG-F-014's fifth instance, 2026-08-03) ────────
	//
	// Three kernel arms drop or weaken a constraint on the strength of `authorityDecisionId` —
	// CONSTRAINT_WEAKENED_WITHOUT_AUTHORITY, INAPPLICABLE_WITHOUT_RATIONALE, WAIVED_WITHOUT_AUTHORITY — and every
	// one of them tests only TRUTHINESS. The id reached them straight from the payload, so ANY NON-EMPTY STRING
	// was authority: a MANDATORY constraint could be declared INAPPLICABLE by citing a decision that named nothing.
	//
	// The boundary now RESOLVES it (`buildConstraintInput`), and an id that does not load as an EFFECTIVE Decision
	// is passed on as ABSENT — so the kernel's existing ratified findings fire exactly as they do for a citation
	// nobody made. An authority that does not exist is no authority. The kernel is untouched: it cannot load
	// objects and should not; its arms were correct and were being fed an unverified fact.
	//
	// SURVEYED FIRST: across the whole suite exactly two dispositions carried an `authorityDecisionId`, both the
	// same literal, and both named an object the store had never held — the enforcement register's own RPH-CNS-003
	// probe, which now mints a real one.
	function decisionOverParent(id: string, approve: boolean): void {
		dispatch('ProposeDecision', id, 'DECISION', {
			decisionType: 'APPROVAL',
			subjectObjectIds: [PARENT],
			selectedOption: 'accept the inapplicability',
			rationale: 'the constraint does not reach these children',
			authority: human
		});
		if (approve)
			dispatch('ApproveDecision', id, 'DECISION', {
				selectedOption: 'accept the inapplicability',
				rationale: 'the constraint does not reach these children',
				consideredEvidenceIds: [],
				consideredObservationIds: [],
				subjectSemanticVersions: { [PARENT]: 1 }
			});
	}

	/** Declare CON inapplicable, with a rationale, citing `authorityDecisionId`. */
	function inapplicableCiting(authorityDecisionId: string) {
		proposeDecomposition({
			constraintPropagations: [
				{
					constraintId: CON,
					childWorkUnitIds: [CHILD_A, CHILD_B],
					disposition: 'INAPPLICABLE',
					rationale: 'the children hold no PII',
					authorityDecisionId
				}
			]
		});
		return validate('VALID');
	}

	function parentWithConstraint(): void {
		assertConstraint(CON, 'MANDATORY');
		proposePwu(PARENT, [], [CON]);
		proposePwu(CHILD_A, [], []);
		proposePwu(CHILD_B, [], []);
	}

	it('a constraint declared INAPPLICABLE on an authority that does not exist is refused', () => {
		parentWithConstraint();
		const r = inapplicableCiting('dec_01ARZ3NDEKTSV4RRFFQ69G5V99');
		expect(r.status, JSON.stringify(r.error)).toBe('REJECTED');
		expect(r.error?.message).toContain('INAPPLICABLE_WITHOUT_RATIONALE');
		expect(statusOf(DCP)).not.toBe('VALID');
	});

	// The sharper half: the decision is REAL but has not become effective. A proposal has decided nothing, and
	// canon ASR-15 checks authority BEFORE effect — so a PROPOSED decision cannot be the basis for dropping a
	// mandatory constraint. Without this, `authorityBasis` could check mere existence and both other tests pass.
	it('a constraint declared INAPPLICABLE on a PROPOSED (not yet effective) decision is refused', () => {
		parentWithConstraint();
		const AUTH = 'dec_01ARZ3NDEKTSV4RRFFQ69G5V07';
		decisionOverParent(AUTH, false);
		const r = inapplicableCiting(AUTH);
		expect(r.status, JSON.stringify(r.error)).toBe('REJECTED');
		expect(r.error?.message).toContain('INAPPLICABLE_WITHOUT_RATIONALE');
	});

	// CONTROL. Without it the boundary could drop EVERY authority and both tests above would still pass.
	it('CONTROL: the same disposition citing a real EFFECTIVE decision is ACCEPTED', () => {
		parentWithConstraint();
		const AUTH = 'dec_01ARZ3NDEKTSV4RRFFQ69G5V08';
		decisionOverParent(AUTH, true);
		const r = inapplicableCiting(AUTH);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(statusOf(DCP)).toBe('VALID');
	});

	it('an INVALID verdict is never re-gated by conservation (validator already rejected it)', () => {
		assertObligation(OBL, 'MANDATORY');
		proposePwu(PARENT, [OBL], []);
		proposePwu(CHILD_A, [], []);
		proposePwu(CHILD_B, [], []);
		proposeDecomposition({}); // would fail conservation, but the validator says INVALID
		const r = validate('INVALID');
		expect(r.status).toBe('ACCEPTED');
		expect(statusOf(DCP)).toBe('INVALID');
	});
});
