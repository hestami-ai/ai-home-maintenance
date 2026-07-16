// Drives the REAL command pipeline (engine.dispatch) to ask the question the kernel tests never ask: does the
// MarkPwuReady CALL SITE enforce the readiness contract, or does it only check that SHAPING -> READY is a legal
// arrow on the state machine? A PWU is seeded that fails EVERY limb of the §6.1 contract at once, so no single
// disputed reading of the guide carries the test.
//
// Guide "Janumi Canonical Implementation Context - Coding Agent Guide.md" §6.1 Readiness, line 466:
//   "A PWU meets the canonical minimum readiness contract only when it has:"
// line 468: "- one clear professional objective and active/provisional Intent or explicit exploratory authority;"
// line 469: "- explicit in-scope and out-of-scope boundaries, or explicit unknowns;"
// line 470: "- mandatory Obligations, Constraints, material Assumptions, dependencies, and responsible authority;"
// line 471: "- required inputs, expected outputs, completion Claim/criteria, Evidence and assurance expectations, and applicable risk/assurance profile."
//
// Guide §6.5 Critical transition guards, line 615:
//   "- Root readiness requires Intent at least provisional; authoritative root satisfaction requires approved Intent or an explicitly provisional result."
//
// "only when" is the operative construction: READY is conditional, not automatic. The PWU below is a ROOT PWU
// (no parentWorkUnitId) whose Intent is RAW — strictly below the "at least provisional" bar of §6.5 line 615.
//
// DEAD KERNEL FUNCTION: none. packages/rph-domain/src/pwuGuards.ts exports canAdvanceWorkLifecycle, whose
// WORK_LIFECYCLE_CROSS_AXIS_GUARDS table (pwuGuards.ts:21) holds entries ONLY for EXECUTING->EVIDENCE_PENDING,
// UNDER_ASSURANCE->SATISFIED and UNDER_ASSURANCE->CONDITIONALLY_SATISFIED. There is no `SHAPING->READY` key, so
// the call site's canAdvanceWorkLifecycle(...) call degrades to a bare legality check and passes. The readiness
// contract has no kernel representation at all: the guard that SHOULD be called does not yet exist.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'user-1', actorType: 'HUMAN' as const, displayName: 'Alice' };
const INTENT_ID = 'int_01ARZ3NDEKTSV4RRFFQ69G5R00';
const PWU_ID = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5R10';

describe('MarkPwuReady readiness contract (live command drive)', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `evt_${++seq}` });
	});

	function cmd(
		commandType: string,
		payload: unknown,
		over: Partial<DomainCommand> = {}
	): DomainCommand {
		const n = ++seq;
		return {
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: 'PROFESSIONAL_WORK_UNIT',
			targetAggregateId: PWU_ID,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'corr-1',
			idempotencyKey: `idem-${n}`,
			payload,
			...over
		};
	}

	// Left at RAW — never provisioned. §6.5 line 615 puts root readiness strictly above this bar.
	function seedRawIntent(): void {
		const r = engine.dispatch(
			cmd(
				'CaptureIntent',
				{
					intentId: INTENT_ID,
					originatingExpression: 'Maybe we should look into field service somehow',
					ontologyId: 'product-realization-pwa',
					ontologyVersion: '1.3.0'
				},
				{ targetAggregateId: INTENT_ID, targetAggregateType: 'INTENT' }
			)
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	}

	// A root PWU that fails every limb of §6.1 lines 468-471: RAW Intent (468); boundaries with no in-scope, no
	// out-of-scope and no declared unknowns (469); no Obligations, Constraints, Assumptions or dependencies (470);
	// no expected outputs, and — set by proposePwu itself — no inputRequirements, no verificationCriterionIds
	// (completion criteria) and no evidenceRequirementIds (471).
	function proposeUnreadyRootPwu(): void {
		const r = engine.dispatch(
			cmd('ProposePwu', {
				pwuId: PWU_ID,
				pwuKind: 'ARCHITECTURE',
				title: 'TBD',
				description: '',
				intentId: INTENT_ID,
				boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'HIGH',
					uncertainty: 'HIGH',
					irreversibility: 'HIGH',
					securitySensitivity: 'HIGH',
					regulatoryExposure: 'NONE'
				}
			})
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	}

	function pwuState(): Record<string, unknown> {
		return store.loadObject(PWU_ID)?.state as Record<string, unknown>;
	}

	it('rejects MarkPwuReady on a root PWU that meets no limb of the §6.1 readiness contract', () => {
		seedRawIntent();
		proposeUnreadyRootPwu();
		expect(engine.dispatch(cmd('BeginPwuShaping', {})).status).toBe('ACCEPTED');

		// The fixture must be unready at the instant of the call, or a rejection would prove nothing.
		const before = pwuState();
		expect(before.workLifecycleState).toBe('SHAPING');
		expect(before.expectedOutputs).toEqual([]);
		expect(before.verificationCriterionIds).toEqual([]);
		expect(before.evidenceRequirementIds).toEqual([]);
		expect(before.obligationIds).toEqual([]);
		expect(
			(store.loadObject(INTENT_ID)?.state as { intentStatus: string }).intentStatus,
			'root readiness requires Intent at least provisional (§6.5 line 615)'
		).toBe('RAW');

		const r = engine.dispatch(
			cmd('MarkPwuReady', {
				shapeReadinessAssessmentId: 'asm_01ARZ3NDEKTSV4RRFFQ69G5R20',
				expectedSemanticVersion: 1
			})
		);

		expect(r.status, 'MarkPwuReady must not advance a PWU that meets no readiness limb').toBe(
			'REJECTED'
		);
		expect(pwuState().workLifecycleState).toBe('SHAPING');
	});
});
