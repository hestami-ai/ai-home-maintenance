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
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-19T00:00:00Z';
const human = { actorId: 'arch-1', actorType: 'HUMAN' as const, displayName: 'Architect' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5V00';
const PARENT = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5V01';
const CHILD_A = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5V0A';
const CHILD_B = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5V0B';
const RCP = 'rcp_01ARZ3NDEKTSV4RRFFQ69G5V05';
const CLAIM = 'clm_01ARZ3NDEKTSV4RRFFQ69G5V06';

describe('CompleteRecomposition evaluates instead of concatenating (WP-1-006, §14.1, live pipeline)', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
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
		dispatch('ProposeRecomposition', RCP, 'RECOMPOSITION_CONTRACT', {
			parentWorkUnitId: PARENT,
			requiredChildWorkUnitIds,
			parentCompletionClaimId: CLAIM,
			conflictResolutionRules: conflictRules
		});
		dispatch('BeginRecomposition', RCP, 'RECOMPOSITION_CONTRACT', { recompositionContractId: RCP });
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
		engine = new Engine({ store, now: () => TS, newEventId: () => `evt_${++seq}` });
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

	it('no required children, no conflict, whole-checks hold -> COMPOSABLE (the discriminating control)', () => {
		propose([]);
		const r = complete();
		expect(r.status).toBe('ACCEPTED');
		expect(statusOf(RCP)).toBe('COMPOSABLE');
	});

	it('the recomposed whole not supporting the parent claim routes to INSUFFICIENT', () => {
		propose([]); // no child would fail; the WHOLE-check does
		const r = complete({ parentCompletionClaimSupported: false });
		expect(r.status).toBe('ACCEPTED');
		expect(statusOf(RCP)).toBe('INSUFFICIENT');
	});
});
