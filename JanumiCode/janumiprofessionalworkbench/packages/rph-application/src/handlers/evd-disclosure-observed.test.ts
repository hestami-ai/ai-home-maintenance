// The ENFORCEMENT REGISTER's disclosures, OBSERVED rather than argued — the mirror of
// `execrem-wp16-enforcement-observed.test.ts`.
//
// WHY A SECOND INSTRUMENT EXISTS (2026-08-01, the RPH-EVD tranche). A disclosure that nothing checks is an excuse.
// The register's original guard for "nothing enforces this" was a CENSUS: name the dead kernel predicate, pin the
// exact set of production files that reference it, and let the gate grep. That works — but only when the baseline
// set EXCLUDES the file the wiring would land in. `capabilityAuthorized`'s census is one file, its own definition,
// so the archetype satisfied that precondition silently and nothing checked it.
//
// It fails for every RPH-EVD row. Measured with the gate's own algorithm, every plausible symbol's baseline ALREADY
// CONTAINS a command-layer handler (`producedBy` -> handlers/assurance.ts; `parentCompletionClaimId` ->
// handlers/decomposition.ts; `admittedScope` -> handlers/assurance.ts). Wiring the missing check into that same
// handler would not change the set, and the row would stay green through the very event it exists to detect. That
// is a guard that cannot fail, and `enforcement-register.test.ts` now rejects one by construction.
//
// So these rows are guarded by BEHAVIOUR instead. Each dispatches the arrangement its ratified statement says must
// be REFUSED, and asserts the engine ACCEPTS it. The day someone wires the guard, this file goes RED and the row
// must be re-dispositioned to ENFORCED with a refusal probe. That is strictly stronger than a census: it reddens on
// the behaviour changing, not on a symbol moving.
//
// EVERY PROBE CARRIES A CONTROL, and it is the MIRROR of the enforcement file's. There, the control is the same
// command ACCEPTED before the arranging act, so a handler that refused everything cannot pass. Here the hazard is
// inverted — an acceptance means nothing if the command is never refused for any reason, or if the arrangement
// never reached the site at all. So each control is a SIBLING DEFECT AT THE SAME SITE that IS refused: it proves
// the refusal machinery is alive and simply has no limb for this rule.
//
// THESE ARRANGEMENTS CORRECTED TWO CLAIMS THAT SURVIVED SOURCE-READING. "Evidence with no producing actor is
// admitted" is FALSE — `ActorReferenceSchema` requires `actorId`/`displayName` `.min(1)`, so that antecedent is
// schema-foreclosed and never reaches a handler (asserted below, because a disclosure narrower than its rule must
// say where the rest of the rule went). What survives dispatch is the SOURCE half, and it survives for a precise
// reason: `ArtifactReferenceSchema` is `z.record(z.string(), z.unknown())`, so `contentReference: {}` is valid, and
// the guard's CONTENT_AVAILABLE limb is a null-check that `{}` passes.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import {
	ENFORCEMENT_REGISTER,
	observedAdmissionRuleIds,
	type RegisteredRuleId
} from '@janumipwb/rph-domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-08-01T00:00:00Z';
const actor: ActorReference = { actorId: 'gov-1', actorType: 'HUMAN', displayName: 'Governor' };

const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5V00';
const PARENT = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5V01';
const CHILD_A = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5V0A';
const RCP = 'rcp_01ARZ3NDEKTSV4RRFFQ69G5V05';
const RCP2 = 'rcp_01ARZ3NDEKTSV4RRFFQ69G5V06';
/** Deliberately names NO Claim aggregate — nothing ever asserts it. That absence IS the arrangement. */
const UNREIFIED_CLAIM = 'clm_01ARZ3NDEKTSV4RRFFQ69G5V07';

interface Outcome {
	readonly status: string;
	readonly code?: string;
	readonly message?: string;
}

/**
 * One disclosure's proof: the arrangement the rule says must be refused, ACCEPTED; and a sibling defect at the same
 * site, REFUSED.
 */
interface DisclosureProbe {
	/** What is dispatched, and why its acceptance is the rule going unenforced. */
	readonly arrangement: string;
	readonly run: () => { readonly admitted: Outcome; readonly control: Outcome };
}

describe('the register\'s RPH-EVD disclosures are OBSERVED, not asserted', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	function dispatch(
		commandType: string,
		payload: unknown,
		id: string,
		aggType: string
	): Outcome {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'evd-disclosure',
			idempotencyKey: `k-${n}`,
			payload
		};
		const r = engine.dispatch(command);
		return { status: r.status, code: r.error?.code, message: r.error?.message };
	}

	const ok = (r: Outcome, what: string): Outcome => {
		expect(r.status, `${what}: ${r.code ?? ''} ${r.message ?? ''}`).toBe('ACCEPTED');
		return r;
	};

	// ── evidence fixtures ────────────────────────────────────────────────────────────────────────────────────
	const proposeEvidence = (evId: string, over: Record<string, unknown> = {}): Outcome =>
		dispatch(
			'ProposeEvidence',
			{
				evidenceId: evId,
				evidenceType: 'TEST_RESULT',
				contentReference: { uri: 'file://report.xml' },
				producedBy: { actorId: 'ci-1', actorType: 'SERVICE', displayName: 'CI' },
				supportsClaimIds: [],
				contradictsClaimIds: [],
				scope: 'unit tests for module X',
				limitations: [],
				capturedAt: TS,
				...over
			},
			evId,
			'EVIDENCE'
		);

	const admitEvidence = (evId: string, over: Record<string, unknown> = {}): Outcome =>
		dispatch(
			'AdmitEvidence',
			{
				admissibilityAssessmentId: 'asm_01ARZ3NDEKTSV4RRFFQ69G5F01',
				admittedScope: 'unit tests for module X',
				admittedClaimIds: [],
				...over
			},
			evId,
			'EVIDENCE'
		);

	/**
	 * THE SHARED CONTROL for both evidence rows: the same guard, at the same site, refusing a sibling limb.
	 *
	 * Shared deliberately and safely — unlike the ENFORCED arm's refusal markers, which must be distinct because a
	 * shared marker would let one arrangement green two rows, a shared CONTROL cannot do that: it proves a property
	 * of the SITE (its guard is alive), and each row still carries its own distinct arrangement, which is the half
	 * that carries the finding.
	 */
	const liveGuardControl = (evId: string): Outcome => {
		ok(proposeEvidence(evId, { scope: '' }), `propose control ${evId}`);
		return admitEvidence(evId);
	};

	const proposePwu = (pwuId: string) =>
		ok(
			dispatch(
				'ProposePwu',
				{
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
				},
				pwuId,
				'PROFESSIONAL_WORK_UNIT'
			),
			`propose ${pwuId}`
		);

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `evt_${++seq}` });
		ok(
			dispatch(
				'CaptureIntent',
				{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
				INTENT,
				'INTENT'
			),
			'capture intent'
		);
		proposePwu(PARENT);
		proposePwu(CHILD_A);
	});

	/**
	 * TOTAL over the OBSERVED_ADMISSION rows, by type. A row given that guard with no probe here does not compile —
	 * the same property that makes the enforcement map an instrument rather than a document.
	 */
	const PROBES: Readonly<Record<RegisteredRuleId, DisclosureProbe | null>> = {
		'RPH-EXE-001': null,
		'RPH-EXE-002': null,
		'RPH-EXE-003': null,
		'RPH-EXE-004': null, // disclosed, but by a DEAD_PREDICATE census — guarded in rph-domain, not here
		'RPH-EXE-005': null,
		'RPH-EXE-006': null,
		'RPH-EXE-007': null,
		'RPH-EXE-008': null,
		'RPH-EXE-009': null,
		'RPH-PWU-009': null,
		'RPH-PWU-010': null,
		'RPH-EVD-002': null,
		'RPH-EVD-005': null,
		'RPH-EVD-006': null,
		'RPH-EVD-007': null, // ENFORCED — its refusal is probed in execrem-wp16-enforcement-observed.test.ts

		'RPH-EVD-001': {
			arrangement:
				"CompleteRecomposition asserting the parent's completion is supported, naming a Claim id that was never asserted",
			run: () => {
				ok(
					dispatch(
						'ProposeRecomposition',
						{
							parentWorkUnitId: PARENT,
							requiredChildWorkUnitIds: [CHILD_A],
							parentCompletionClaimId: UNREIFIED_CLAIM,
							conflictResolutionRules: []
						},
						RCP,
						'RECOMPOSITION_CONTRACT'
					),
					'propose recomposition'
				);
				ok(
					dispatch(
						'BeginRecomposition',
						{ recompositionContractId: RCP },
						RCP,
						'RECOMPOSITION_CONTRACT'
					),
					'begin recomposition'
				);
				// The Claim named above is NEVER asserted — `store.loadObject(UNREIFIED_CLAIM)` is undefined
				// throughout — and the completion judgement travels instead as a caller-supplied boolean.
				expect(
					store.loadObject(UNREIFIED_CLAIM),
					'the arrangement is only meaningful while the Claim genuinely does not exist'
				).toBeUndefined();
				const admitted = dispatch(
					'CompleteRecomposition',
					{ parentCompletionClaimId: UNREIFIED_CLAIM, parentCompletionClaimSupported: true },
					RCP,
					'RECOMPOSITION_CONTRACT'
				);

				// CONTROL — the same command at the same site, on a contract that was proposed but never BEGUN, so
				// it sits in READY rather than EVALUATING. Refused with RPH_ILLEGAL_STATE_TRANSITION. Proves
				// CompleteRecomposition IS refusable, so the acceptance above is a missing limb rather than a
				// handler that accepts unconditionally.
				//
				// REFUSED BY TWO INDEPENDENT LIMBS, measured: `precondition: fromStates('EVALUATING')` refuses it,
				// AND the RecompositionContract.status machine forbids READY -> outcome even when that precondition
				// is widened to admit READY. Stated because it means this control is robust rather than
				// single-limb sensitive, and a reader re-running the mutation would otherwise read the survival as
				// a defect.
				ok(
					dispatch(
						'ProposeRecomposition',
						{
							parentWorkUnitId: PARENT,
							requiredChildWorkUnitIds: [CHILD_A],
							parentCompletionClaimId: UNREIFIED_CLAIM,
							conflictResolutionRules: []
						},
						RCP2,
						'RECOMPOSITION_CONTRACT'
					),
					'propose control recomposition'
				);
				const control = dispatch(
					'CompleteRecomposition',
					{ parentCompletionClaimId: UNREIFIED_CLAIM, parentCompletionClaimSupported: true },
					RCP2,
					'RECOMPOSITION_CONTRACT'
				);
				return { admitted, control };
			}
		},

		'RPH-EVD-003': {
			arrangement:
				'Evidence whose contentReference is {} — a source reference naming nothing — admitted to ADMISSIBLE',
			run: () => {
				const EV = 'evd_01ARZ3NDEKTSV4RRFFQ69G5FB1';
				// THE SCHEMA-FORECLOSED HALF, asserted so this narrower disclosure says where the rest of the rule
				// went. The producing-actor half CANNOT be arranged: ActorReferenceSchema requires .min(1) ids.
				expect(
					proposeEvidence('evd_01ARZ3NDEKTSV4RRFFQ69G5FA1', {
						producedBy: { actorId: '', actorType: 'MODEL', displayName: '' }
					}).status,
					'the producing-actor half is schema-foreclosed; if this ever becomes ACCEPTED the disclosure must widen'
				).toBe('VALIDATION_FAILED');

				ok(proposeEvidence(EV, { contentReference: {} }), 'propose sourceless evidence');
				return {
					admitted: admitEvidence(EV),
					control: liveGuardControl('evd_01ARZ3NDEKTSV4RRFFQ69G5FC1')
				};
			}
		},

		'RPH-EVD-004': {
			arrangement:
				"a TEST_RESULT of scope 'unit' admitted in support of a FITNESS claim, neither rejected nor qualified",
			run: () => {
				const CLAIM = 'clm_01ARZ3NDEKTSV4RRFFQ69G5F11';
				ok(
					dispatch(
						'AssertClaim',
						{
							claimType: 'FITNESS',
							statement: 'the product is fit for its intended use',
							subjectObjectIds: [PARENT],
							supportingEvidenceIds: [],
							contradictingEvidenceIds: []
						},
						CLAIM,
						'CLAIM'
					),
					'assert FITNESS claim'
				);
				const EV = 'evd_01ARZ3NDEKTSV4RRFFQ69G5FE1';
				ok(
					proposeEvidence(EV, { scope: 'unit', supportsClaimIds: [CLAIM] }),
					'propose unit-scope evidence'
				);
				return {
					admitted: admitEvidence(EV, { admittedScope: 'unit', admittedClaimIds: [CLAIM] }),
					control: liveGuardControl('evd_01ARZ3NDEKTSV4RRFFQ69G5FF1')
				};
			}
		}
	};

	it('the probe map is TOTAL over the OBSERVED_ADMISSION rows — every disclosure has an observation', () => {
		const unprobed = observedAdmissionRuleIds().filter((id) => PROBES[id] === null);
		expect(unprobed, 'OBSERVED_ADMISSION row(s) with no probe').toEqual([]);
		// …and nothing probes a row that does not claim that guard, which would be an observation with no claim
		// behind it — the mirror of the enforcement map's over-probing check.
		const overProbed = (Object.keys(PROBES) as RegisteredRuleId[]).filter((id) => {
			if (PROBES[id] === null) return false;
			const row = ENFORCEMENT_REGISTER[id];
			return !(row.kind === 'UNENFORCED_DISCLOSED' && row.guard.kind === 'OBSERVED_ADMISSION');
		});
		expect(overProbed, 'probe(s) for rule(s) that do not declare an OBSERVED_ADMISSION guard').toEqual(
			[]
		);
	});

	it.each(observedAdmissionRuleIds())(
		'%s is ADMITTED by the running engine — the disclosure is a measured fact',
		(id) => {
			const row = ENFORCEMENT_REGISTER[id];
			const probe = PROBES[id];
			expect(row.kind).toBe('UNENFORCED_DISCLOSED');
			expect(probe, `${id} has no probe`).not.toBeNull();
			if (row.kind !== 'UNENFORCED_DISCLOSED' || !probe) return;

			const { admitted, control } = probe.run();

			// THE DISCLOSURE. Wire the guard and this line fails, which is the whole point of the row.
			expect(
				admitted.status,
				`${id} (${probe.arrangement}) — the engine REFUSED what this row discloses as unenforced ` +
					`(${admitted.code ?? ''}: ${admitted.message ?? ''}). Re-disposition it as ENFORCED with a probe.`
			).toBe('ACCEPTED');

			// THE CONTROL. Without it, a site that accepted literally everything — or an arrangement that never
			// reached the site — would satisfy this file completely.
			//
			// CONTROL STRENGTH, MEASURED RATHER THAN ASSUMED (2026-08-01). Each control was mutated to check it is
			// load-bearing, and the two families answered differently — recorded because the difference is the kind
			// of thing that is otherwise assumed:
			//   EVD-003 / EVD-004  KILLED. Neutering `evidenceAdmissibility`'s SCOPE_STATED limb turns both controls
			//                      ACCEPTED and reddens THIS assertion (not the disclosure one above), which is the
			//                      property a control has to have.
			//   EVD-001            SURVIVED BY REDUNDANCY, not by vacuity. Widening completeRecomposition's
			//                      `fromStates('EVALUATING')` to admit READY leaves the control REJECTED, because
			//                      the RecompositionContract.status machine independently forbids READY -> outcome.
			//                      Two independent limbs refuse it. The control still reddens if the site stops
			//                      refusing at all, which is what it is here to exclude; it is simply not
			//                      single-limb sensitive, and saying so beats implying a kill that did not happen.
			expect(
				control.status,
				`${id}: the control must be REFUSED, proving the site's guard is alive and this rule is simply ` +
					`missing from it (observed ${control.status} ${control.code ?? ''}: ${control.message ?? ''})`
			).toBe('REJECTED');
		}
	);

	it('the disclosed arrangements are DISTINCT — no two rows are satisfied by one observation', () => {
		// The mirror of the refusal-marker distinctness gate. Two disclosures sharing an arrangement would report
		// two unenforced rules while only one thing had ever been dispatched.
		const arrangements = observedAdmissionRuleIds().map((id) => PROBES[id]?.arrangement ?? id);
		expect(new Set(arrangements).size, 'duplicate arrangement(s)').toBe(arrangements.length);
	});
});
