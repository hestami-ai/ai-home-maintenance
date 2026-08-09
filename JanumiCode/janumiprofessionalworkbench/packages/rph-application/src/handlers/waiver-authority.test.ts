// W-3 — WAIVED on the assurance axis needed no authority, and §5.2 names waiver FIRST among the reserved acts.
//
// C-0b measured this live before the guard existed: `ChangePwuState` drove `PWU.assuranceState` to `WAIVED` with
// `supportingObjectIds: []`, `reasonCode: 'CONTROLLER'`, no Decision and no `WaiverGranted` event, and the
// committed object read `WAIVED`. `rejectUnbackedDisposition` never fired because `WAIVED` is deliberately
// excluded from `ASSESSMENT_BACKED_DISPOSITIONS` — and `pwu.ts` says why in terms: *"WAIVED is authorized by a
// WAIVER, not an assessment … Both need their own citation and their own guard."* **The file named the gap and
// left it open.** This is that guard, and these are the tests that make it load-bearing.
//
// ⚠ THE MECHANISM IS RATIFIED AS OF TODAY, WHICH IT WAS NOT WHEN THE ABANDONMENT AND REJECTION GUARDS WERE BUILT.
// REG-Q-030 closed (REG-D-038): WAIVED enters ONLY through the waiver flow — a version-bound waiver Decision,
// finding preserved. That sweep also warned against the over-strong converse, and these tests obey it: nothing
// here asserts `WaiverGranted ⇒ WAIVED`, because DOC-002 Scenario 4 says *"WAIVED **or** conditionally satisfied"*.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { resolveWaiverAuthorization } from './waiver-authorization.js';

const TS = '2026-08-09T00:00:00Z';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69H9300';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H9310';
// `authority` is an ActorReference OBJECT, not an id string — the schema said so and I passed a string.
const actor: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };

describe('JAN-PWUWP W-3 — WAIVED requires a granted, version-bound waiver', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	const dispatch = (commandType: string, payload: unknown, id = PWU, aggType = 'PROFESSIONAL_WORK_UNIT') => {
		const n = ++seq;
		return engine.dispatch({
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'w3',
			idempotencyKey: `k-${n}`,
			payload
		} as DomainCommand);
	};
	const ok = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		return r;
	};
	const assurance = () =>
		(store.loadObject(PWU)!.state as { assuranceState: string }).assuranceState;

	/** Move the assurance axis to a legal source state for the WAIVED arrows. */
	const toEvidenceRequired = () =>
		dispatch('ChangePwuState', {
			previousState: 'PROPOSED',
			newState: 'PROPOSED',
			executionState: 'NOT_PLANNED',
			assuranceState: 'EVIDENCE_REQUIRED',
			shapeIntegrityState: 'UNKNOWN',
			reasonCode: 'CONTROLLER',
			supportingObjectIds: []
		});

	/** Waive, citing whatever the caller supplies — the act under test. */
	const waive = (supportingObjectIds: string[]) =>
		dispatch('ChangePwuState', {
			previousState: 'PROPOSED',
			newState: 'PROPOSED',
			executionState: 'NOT_PLANNED',
			assuranceState: 'WAIVED',
			shapeIntegrityState: 'UNKNOWN',
			reasonCode: 'CONTROLLER',
			supportingObjectIds
		});

	/** A decision of `decisionType` over `subjects`, made EFFECTIVE only when `approve`. */
	const decision = (
		decisionType: string,
		subjects: string[],
		approve: boolean,
		pins: Record<string, number> = {}
	): string => {
		const id = `dec_01ARZ3NDEKTSV4RRFFQ69H9${(400 + seq).toString().padStart(3, '0')}`;
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
			// ⚠ A WAIVER MAY NOT BE MADE EFFECTIVE BY `ApproveDecision`, AND THE ENGINE SAYS SO — it refused with:
			// *"a waiver becomes effective only via GrantWaiver, whose WaiverGranted event is the waiver fact the
			// assurance floor audits. Approving it here would discharge the floor with no WaiverGranted fact
			// recorded."* That is REG-Q-030's ratified path already implemented on the GOVERNANCE side; only the
			// PWU assurance axis was left unguarded, which is what this increment closes. My first arrangement used
			// ApproveDecision for everything and the engine corrected me.
			const grant = decisionType === 'WAIVER';
			ok(
				dispatch(
					grant ? 'GrantWaiver' : 'ApproveDecision',
					grant
						? // strict schema: {waiverDecisionId, duration} ONLY. The version pins are not passed here —
							// `subjectVersions(ctx, p.subjectObjectIds)` derives them at PROPOSAL time (governance.ts:210),
							// which is why the guard's version limb is satisfiable at all.
							{ waiverDecisionId: id, duration: 'P30D' }
						: {
								selectedOption: 'go',
								rationale: 'r',
								consideredEvidenceIds: [],
								consideredObservationIds: [],
								subjectSemanticVersions: pins
							},
					id,
					'DECISION'
				),
				`make ${decisionType} effective`
			);
		}
		return id;
	};

	const refused = (r: { status: string; error?: { message?: string } }, because: string) => {
		expect(r.status).toBe('REJECTED');
		expect(r.error?.message, `refusal should name: ${because}`).toContain(because);
		expect(assurance(), 'and a refused waiver must not have moved the axis').not.toBe('WAIVED');
	};

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
		ok(
			dispatch('ProposePwu', {
				pwuId: PWU,
				pwuKind: 'ARCHITECTURE',
				title: 'Arch',
				description: 'd',
				intentId: INTENT,
				boundaries: {
					inScope: ['the governed work under test'],
					outOfScope: ['not yet known'],
					permittedChanges: [],
					prohibitedChanges: []
				},
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [{ outputId: 'out_1', kind: 'DOCUMENT' }],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'MEDIUM',
					uncertainty: 'MEDIUM',
					irreversibility: 'LOW',
					securitySensitivity: 'LOW',
					regulatoryExposure: 'NONE'
				}
			}),
			'pwu'
		);
		ok(toEvidenceRequired(), 'to EVIDENCE_REQUIRED');
	});

	// ⚠ THE RED-FIRST CASE. This is C-0b's measurement, verbatim: nothing cited, and it used to be ACCEPTED.
	it('REJECTS a waive with NOTHING cited — the exact dispatch C-0b drove to WAIVED', () => {
		refused(waive([]), 'no authorized waiver to back it');
	});

	it('REJECTS a dangling id — the cheapest possible forgery', () => {
		refused(waive(['dec_does_not_exist']), 'names no recorded object');
	});

	it('REJECTS an object that is not a DECISION — a category error, told as one', () => {
		refused(waive([INTENT]), 'not a DECISION');
	});

	// ⚠ RPH-GOV-005: authorization does not bleed. An APPROVAL is not a WAIVER.
	it('REJECTS an APPROVAL standing in for a WAIVER', () => {
		const dec = decision('APPROVAL', [PWU], true, { [PWU]: 1 });
		refused(waive([dec]), 'requires decisionType=WAIVER');
	});

	it('REJECTS a PROPOSED waiver — a request is not a grant', () => {
		const dec = decision('WAIVER', [PWU], false);
		refused(waive([dec]), 'not EFFECTIVE');
	});

	it('REJECTS a waiver that names a different object', () => {
		const other = 'pwu_01ARZ3NDEKTSV4RRFFQ69H9999';
		const dec = decision('WAIVER', [other], true, { [other]: 1 });
		refused(waive([dec]), 'does not name');
	});

	// ASR-14, byte-exact: a waiver does not apply to "a future semantic version unless explicitly renewed".
	//
	// ⚠ DRIVEN AT THE RESOLVER, NOT THROUGH THE BUS, AND THE REASON IS RECORDED RATHER THAN GLOSSED. The pins are
	// derived from the subjects at PROPOSAL time, so arranging a mismatch through the bus needs the PWU's
	// semanticVersion to move between proposal and waive — which no command in this fixture's reach does. Testing
	// the limb directly is honest; asserting it from a dispatch that cannot produce the condition would be a
	// control that cannot fail.
	it('REJECTS a waiver pinned to a different semantic version (resolver-level)', () => {
		const dec = decision('WAIVER', [PWU], true);
		const ctx = { store } as unknown as Parameters<typeof resolveWaiverAuthorization>[0];
		const atCurrent = resolveWaiverAuthorization(ctx, {
			authorizationId: dec,
			pwuId: PWU,
			pwuSemanticVersion: 1
		});
		expect(atCurrent.ok, 'the pin the proposal derived must be accepted').toBe(true);
		const atFuture = resolveWaiverAuthorization(ctx, {
			authorizationId: dec,
			pwuId: PWU,
			pwuSemanticVersion: 2
		});
		expect(atFuture.ok, 'a later version must NOT be covered').toBe(false);
		expect((atFuture as { ok: false; reason: string }).reason).toContain('semanticVersion');
	});

	// ── CONTROL: THE WAIVER IS THE ONLY DIFFERENCE ───────────────────────────────────────────────────────────
	// Without this, every refusal above is satisfied by a guard that refuses unconditionally — the shape this
	// repository has shipped before. Same dispatch, same axis, same source state; only the citation changes.
	it('CONTROL — the identical waive is refused without the decision and ACCEPTED with it', () => {
		refused(waive([]), 'no authorized waiver to back it');
		const dec = decision('WAIVER', [PWU], true, { [PWU]: 1 });
		ok(waive([dec]), 'authorized, version-bound waiver');
		expect(assurance()).toBe('WAIVED');
	});
});
