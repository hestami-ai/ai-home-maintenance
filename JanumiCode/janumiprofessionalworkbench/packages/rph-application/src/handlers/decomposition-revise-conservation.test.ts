// REG-F-006's DOCS_STRONGER component — DEC-3 and DEC-4 for REVISION.
//
// JPWB-DOC-003 scopes its conservation rules to revision explicitly: DEC-3 SCOPE governs "every decomposition,
// revision, and delegation", DEC-4 SCOPE governs "decomposition, delegation, semantic revision, and context
// assembly". `validateDecomposition` has enforced both since W1 WIRE-1/2. `reviseDecomposition` enforced neither:
// it REFUSED the three carrier fields outright (the B7 fail-closed discharge landed at 50785b5b), which made the
// missing capability visible on every attempt but left the capability missing.
//
// The tracker deferred this M9 -> "M10/M11" -> "M11/M13" -> "M13" -> "live-command-drive handlers deferred", every
// station green, and no milestone held it at the end. REG-F-006 records it as OPEN AND UNSCHEDULED.
//
// WHAT LANDS HERE AND WHAT DELIBERATELY DOES NOT. DEC-3 (obligation conservation) and DEC-4 (constraint
// disposition) are now enforced ON THE REVISE PATH, by the same M9 kernel `validateDecomposition` already calls —
// a second call site, not new domain logic. DEC-2's impact analysis is NOT implemented and `childWorkUnitIds`
// stays refused: `impactedObjects` is one of the hollow-kernel triage's deferrals and needs a TraceLink-minting
// command surface that does not exist. Refusing a field this handler cannot honour is the same B7 discharge as
// before, now narrowed to the one field that is genuinely blocked instead of standing in for all three.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-08-02T00:00:00Z';
const authority = {
	authorityId: 'auth_arch',
	authorityType: 'ORGANIZATIONAL_ROLE' as const,
	scope: ['architecture'],
	validFrom: TS
};
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5W00';
const PARENT = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5W01';
const CHILD_A = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5W0A';
const CHILD_B = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5W0B';
const OBL = 'obl_01ARZ3NDEKTSV4RRFFQ69G5W02';
const DCP = 'dcp_01ARZ3NDEKTSV4RRFFQ69G5W04';

describe('ReviseDecomposition conserves the parent obligations (REG-F-006, DOC-003 DEC-3/DEC-4)', () => {
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
			correlationId: 'corr-revise-cons',
			idempotencyKey: `idem-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const ok = (r: ReturnType<typeof dispatch>, what: string) => {
		expect(r.status, `${what}: ${r.error?.code ?? ''} ${r.error?.message ?? ''}`).toBe('ACCEPTED');
		return r;
	};

	function proposePwu(pwuId: string, obligationIds: string[]) {
		ok(
			dispatch('ProposePwu', pwuId, 'PROFESSIONAL_WORK_UNIT', {
				pwuId,
				pwuKind: 'ARCHITECTURE',
				title: pwuId,
				description: 'd',
				intentId: INTENT,
				boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
				obligationIds,
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
			}),
			`propose ${pwuId}`
		);
	}

	/** A VALID contract allocating the mandatory obligation to CHILD_A — the state a revision starts from. */
	function validContract(): void {
		ok(
			dispatch('AssertObligation', OBL, 'OBLIGATION', {
				statement: 'Isolate tenant data',
				obligationType: 'SECURITY',
				sourceObjectId: PARENT,
				authority,
				strength: 'MANDATORY'
			}),
			'assert obligation'
		);
		proposePwu(PARENT, [OBL]);
		proposePwu(CHILD_A, []);
		proposePwu(CHILD_B, []);
		ok(
			dispatch('ProposeDecomposition', DCP, 'DECOMPOSITION_CONTRACT', {
				parentWorkUnitId: PARENT,
				childWorkUnitIds: [CHILD_A, CHILD_B],
				rationale: 'split',
				obligationAllocations: [{ obligationId: OBL, allocatedTo: [CHILD_A] }]
			}),
			'propose decomposition'
		);
		ok(
			dispatch('ValidateDecomposition', DCP, 'DECOMPOSITION_CONTRACT', { disposition: 'VALID' }),
			'validate'
		);
	}

	const revise = (extra: Record<string, unknown>) =>
		dispatch('ReviseDecomposition', DCP, 'DECOMPOSITION_CONTRACT', {
			rationale: 'reallocate the obligation',
			...extra
		});

	const contract = () => store.loadObject(DCP)?.state as Record<string, unknown> | undefined;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ authenticate: testAuthenticator(), store, now: () => TS, newEventId: () => `evt_${++seq}` }).as(TEST_CRED.human);
		ok(
			dispatch('CaptureIntent', INTENT, 'INTENT', {
				intentId: INTENT,
				originatingExpression: 'x',
				ontologyId: 'o',
				ontologyVersion: '1'
			}),
			'capture intent'
		);
	});

	it('APPLIES a revision that reallocates a mandatory obligation to the other child (DEC-3)', () => {
		validContract();
		const r = revise({ obligationAllocations: [{ obligationId: OBL, allocatedTo: [CHILD_B] }] });
		expect(r.status, `${r.error?.code ?? ''}: ${r.error?.message ?? ''}`).toBe('ACCEPTED');

		// APPLIED, not merely accepted. The F-I finding was precisely that a revision could be accepted while the
		// content was dropped and the caller had no way to learn it, so asserting the status alone would re-create
		// the defect this closes.
		const allocations = contract()?.obligationAllocations as
			| { obligationId?: string; allocatedTo?: string[] }[]
			| undefined;
		expect(allocations, 'the revised allocation must be persisted').toEqual([
			{ obligationId: OBL, allocatedTo: [CHILD_B] }
		]);
		expect(contract()?.status).toBe('SUPERSEDED');
		expect(Number(contract()?.semanticVersion ?? 0)).toBeGreaterThan(1);
	});

	it('REFUSES a revision that drops a mandatory obligation entirely (DEC-3 conservation)', () => {
		validContract();
		const r = revise({ obligationAllocations: [] });
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message).toContain('MISSING_OBLIGATION_ALLOCATION');
		// …and nothing moved. A refusal that still superseded the contract would be worse than acceptance.
		expect(contract()?.status).toBe('VALID');
		expect(Number(contract()?.semanticVersion ?? 0)).toBe(1);
	});

	it('CONTROL — a revision carrying NO content still supersedes, so the gate is not refusing everything', () => {
		validContract();
		const r = revise({});
		expect(r.status, `${r.error?.message ?? ''}`).toBe('ACCEPTED');
		expect(contract()?.status).toBe('SUPERSEDED');
	});

	it('STILL REFUSES childWorkUnitIds — DEC-2 impact analysis has no plane, and says so by name', () => {
		validContract();
		const r = revise({ childWorkUnitIds: [CHILD_A] });
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(r.error?.message).toContain('childWorkUnitIds');
		expect(r.error?.message).toContain('DEC-2');
		// The disclosure must NOT have quietly widened back over the two fields that are now honoured.
		expect(r.error?.message).not.toContain('obligationAllocations');
		expect(contract()?.status).toBe('VALID');
	});
});
