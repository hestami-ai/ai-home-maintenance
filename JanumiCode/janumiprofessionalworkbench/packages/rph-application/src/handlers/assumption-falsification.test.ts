// REG-F-069 — assumption falsification, end to end through the LIVE pipeline.
//
// ── WHAT WAS MISSING, AND WHY IT WAS A JOIN RATHER THAN A CAPABILITY ─────────────────────────────────────────
// Four parts existed and nothing connected them:
//   1. CANON obliges the act — JPWB-DOC-003 §3 OBJ-4, "falsification triggers impact analysis".
//   2. The EVENT was RATIFIED — `AssumptionFalsifiedPayloadSchema` is in `RATIFIED_EVENT_PAYLOADS`, and was the
//      ONLY member of that set no handler emitted.
//   3. The KERNEL already computed the outcome — `assessFalsification`, with no caller.
//   4. The CONSUMER already refused FALSIFIED — `canAuthorizeNewWork` via `approveExecutionPlan`. The
//      enforcement register recorded RPH-ASM-006 as "enforced on one third of its own predicate" precisely
//      because FALSIFIED and SUPERSEDED were unreachable.
//
// ── ⚠ AND THE COMMAND ALONE WOULD HAVE SHIPPED DEAD ──────────────────────────────────────────────────────────
// FALSIFIED is reachable only from DISCLOSED|UNDER_VERIFICATION|ACCEPTED|VERIFIED; all trace back to DISCLOSED;
// DISCLOSED's only in-arrow is PROPOSED — and NO command drove it. `DetectAssumption` creates in PROPOSED,
// `ExpireAssumption` leaves for EXPIRED, so the middle of the lifecycle was unoccupiable. A `FalsifyAssumption`
// registered without `DiscloseAssumption` would have been scored COVERED by the C-0 arrow census and been
// unable to fire. `it('the source state is occupiable')` below is the test that pins that, and it is the one
// that would have caught the mistake.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-08-08T00:00:00Z';
const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5K00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5K10';
const ASM = 'asm_01ARZ3NDEKTSV4RRFFQ69G5K20';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69G5K30';
const EV = 'ev_01ARZ3NDEKTSV4RRFFQ69G5K40';

describe('FalsifyAssumption — the join between OBJ-4, the ratified event, the kernel, and the guard', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	function dispatch(commandType: string, payload: unknown, id: string, type: string) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const statusOf = (id: string) =>
		(store.loadObject(id)?.state as { status?: string } | undefined)?.status;

	const disclose = () => dispatch('DiscloseAssumption', {}, ASM, 'ASSUMPTION');
	const falsify = (ids: string[] = [EV]) =>
		dispatch('FalsifyAssumption', { contradictingEvidenceIds: ids }, ASM, 'ASSUMPTION');

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		}).as(TEST_CRED.human);

		dispatch(
			'CaptureIntent',
			{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
			INTENT,
			'INTENT'
		);
		dispatch(
			'DetectAssumption',
			{
				assumptionId: ASM,
				statement: 'The tenant identity model is stable',
				introducedBy: actor,
				affectedObjectIds: [PWU],
				materiality: 'MATERIAL'
			},
			ASM,
			'ASSUMPTION'
		);
		dispatch(
			'ProposeEvidence',
			{
				evidenceId: EV,
				evidenceType: 'OBSERVATION',
				contentReference: { uri: 'file://tenant-model-changed' },
				producedBy: actor,
				supportsClaimIds: [],
				contradictsClaimIds: [],
				scope: 'architecture',
				limitations: [],
				capturedAt: TS
			},
			EV,
			'EVIDENCE'
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
				assumptionIds: [ASM],
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
	});

	// THE TEST THAT WOULD HAVE CAUGHT THE MISTAKE. Not "does a command exist for the arrow" — C-0 answers that,
	// and would have answered YES for a command that could never fire — but "can the SOURCE STATE be occupied".
	it('the source state is occupiable: DetectAssumption lands PROPOSED and DiscloseAssumption reaches DISCLOSED', () => {
		expect(statusOf(ASM)).toBe('PROPOSED');
		expect(disclose().status).toBe('ACCEPTED');
		expect(statusOf(ASM)).toBe('DISCLOSED');
	});

	it('drives DISCLOSED -> FALSIFIED and emits the RATIFIED AssumptionFalsified payload', () => {
		expect(disclose().status).toBe('ACCEPTED');
		const r = falsify();
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(statusOf(ASM)).toBe('FALSIFIED');

		const ev = store.readAllEvents().find((e) => e.eventType === 'AssumptionFalsified');
		expect(ev, 'the only RATIFIED_EVENT_PAYLOADS member no handler emitted must now be emitted').toBeDefined();
		const p = ev?.payload as {
			assumptionId: string;
			priorStatus: string;
			newStatus: string;
			contradictingEvidenceIds: string[];
			affectedObjectIds: string[];
			impactAnalysisRequired: boolean;
		};
		expect(p.assumptionId).toBe(ASM);
		// STA-7 SCOPE: "History is never rewritten by invalidation." The prior status is carried, not erased.
		expect(p.priorStatus).toBe('DISCLOSED');
		expect(p.newStatus).toBe('FALSIFIED');
		expect(p.contradictingEvidenceIds).toEqual([EV]);
		// From the KERNEL's `impactedObjectIds`, i.e. the assumption's affected objects — not recomputed here.
		expect(p.affectedObjectIds).toEqual([PWU]);
		// OBJ-4's "falsification triggers impact analysis", recorded as the flag STA-7's conservatism clause
		// licenses. The cascade is deliberately not built; this is the disclosure that replaces silence.
		expect(p.impactAnalysisRequired).toBe(true);
	});

	// ⚠ THIS TEST ASSERTED THE OPPOSITE FIRST, AND THE SCHEMA REFUTED IT.
	// It required `contradictingEvidenceIds` on the OBJECT, citing ASR-8's "contradicting evidence remains
	// attached and visible". The ratified AssumptionObject has no such field and the write was REFUSED — and the
	// citation was an over-reach: ASR-8 is §8.3 *Evidence*, governing propagation to CLAIMS, and
	// `contradictingEvidenceIds` is ratified on CLAIM. The ratified home here is the EVENT. Kept as a test
	// rather than deleted, because "the object must not silently grow a field to match a citation" is the thing
	// worth pinning.
	it('does NOT write contradicting evidence onto the Assumption object — the ratified home is the event', () => {
		disclose();
		expect(falsify().status).toBe('ACCEPTED');
		const state = store.loadObject(ASM)?.state as Record<string, unknown>;
		expect(state.contradictingEvidenceIds).toBeUndefined();
		const ev = store.readAllEvents().find((e) => e.eventType === 'AssumptionFalsified');
		expect((ev?.payload as { contradictingEvidenceIds: string[] }).contradictingEvidenceIds).toEqual([EV]);
	});

	// THE POINT OF THE WHOLE INCREMENT: a guard that was enforced on one third of its own predicate.
	it('a FALSIFIED assumption now blocks ApproveExecutionPlan (RPH-ASM-006, previously unreachable)', () => {
		expect(
			dispatch(
				'ProposeExecutionPlan',
				{
					executionPlanId: PLAN,
					workUnitId: PWU,
					steps: [
						{
							id: `${PLAN}-step`,
							executionPlanId: PLAN,
							stepType: 'MODEL_INVOCATION',
							purpose: 'do the work',
							inputBindings: [],
							outputBindings: [],
							preconditions: [],
							postconditions: [],
							stepState: 'QUEUED'
						}
					],
					transitions: [],
					retryPolicy: {},
					tacticalChangePolicy: {},
					escalationPolicy: {},
					terminationPolicy: {}
				},
				PLAN,
				'EXECUTION_PLAN'
			).status
		).toBe('ACCEPTED');

		disclose();
		expect(falsify().status).toBe('ACCEPTED');

		const r = dispatch('ApproveExecutionPlan', {}, PLAN, 'EXECUTION_PLAN');
		expect(r.status).not.toBe('ACCEPTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message).toContain('RPH-ASM-006');
		expect(r.error?.message).toContain(ASM);
	});

	// ── CONTROLS, each with its OWN failure mode ─────────────────────────────────────────────────────────────
	// The cases above all pass in a world where the precondition is missing entirely. These do not.

	it('CONTROL — refuses a falsification citing NO contradicting evidence', () => {
		disclose();
		const r = falsify([]);
		expect(r.status).not.toBe('ACCEPTED');
		expect(r.error?.message).toContain('cites no contradicting evidence');
		expect(statusOf(ASM), 'a refused falsification must leave the assumption untouched').toBe(
			'DISCLOSED'
		);
	});

	it('CONTROL — refuses a falsification citing evidence that does not exist', () => {
		disclose();
		const r = falsify(['ev_01ARZ3NDEKTSV4RRFFQ69G5K99']);
		expect(r.status).not.toBe('ACCEPTED');
		expect(r.error?.message).toContain('does not exist as EVIDENCE');
		expect(statusOf(ASM)).toBe('DISCLOSED');
	});

	// The machine excludes PROPOSED from FALSIFIED's in-arrows: an assumption not yet disclosed has authorized
	// nothing. This fails if the precondition is widened to "any non-terminal state".
	it('CONTROL — refuses falsifying a PROPOSED assumption, the arrow the machine does not declare', () => {
		expect(statusOf(ASM)).toBe('PROPOSED');
		const r = falsify();
		expect(r.status).not.toBe('ACCEPTED');
		expect(statusOf(ASM)).toBe('PROPOSED');
	});
});
