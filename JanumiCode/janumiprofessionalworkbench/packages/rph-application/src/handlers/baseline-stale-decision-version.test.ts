// W1 WIRE-4 (RPH-GOV-003 / Property P5): a decision binds EXACT subject semantic versions; a promotion whose
// PROMOTE_BASELINE decision approved a version that is NOT the subject's CURRENT semantic version must be rejected.
// The kernel rule decisionAuthorizesVersions (packages/rph-domain/src/governance.ts:95) is correct and — before
// this increment — was UNREACHABLE: promoteBaseline never compared the decision's subjectSemanticVersions against
// the subjects' current versions, so a stale-version approval promoted a baseline to AUTHORITATIVE anyway.
//
// §35 / RPH-GOV-003, byte-exact intent: "a decision approval of v_n never authorizes v_{n+1}; the subject becomes
// re-review-required." This drives the REAL command pipeline (engine.dispatch) to ask whether the CALL SITE
// enforces it, not just the kernel.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { floorValidatorResult, seedPolicy } from './__tests__/floor-fixtures.js';

const TS = '2026-07-19T00:00:00Z';
const human = { actorId: 'gov-1', actorType: 'HUMAN' as const, displayName: 'Governor' };
// ONE governor issues everything, and it must be `gov-1`: the PROMOTE_BASELINE decision declares
// `authority: human`, and since REG-F-014 a declared authority that is not the authenticated principal is
// refused. The shared `TEST_CRED.human` resolves to `u1`, which would refuse the proposal and leave the
// staleness assertion below true about a decision that was never made.
const DIR = testDirectory([{ ...human, tenantId: 'tenant-test', organizationId: 'org-test' }]);
const INTENT_ID = 'int_01ARZ3NDEKTSV4RRFFQ69G5V00';
const PWU_ID = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5V01';
const ASSESS = 'assess_01ARZ3NDEKTSV4RRFFQ69G5V02';
const DEC = 'dec_01ARZ3NDEKTSV4RRFFQ69G5V04';
const BASE = 'base_01ARZ3NDEKTSV4RRFFQ69G5V05';

describe('PromoteBaseline call site: stale decision version binding (RPH-GOV-003 / P5, live pipeline)', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	function dispatch(commandType: string, payload: unknown, over: Partial<DomainCommand> = {}) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: 'PROFESSIONAL_WORK_UNIT',
			targetAggregateId: PWU_ID,
			issuedAt: TS,
			correlationId: 'corr-stale-version',
			idempotencyKey: `idem-${n}`,
			payload,
			...over
		};
		return engine.dispatch(command);
	}

	function statusOf(id: string, field = 'status'): string {
		return (store.loadObject(id)?.state as Record<string, string>)[field] ?? '';
	}

	/**
	 * Build the full intent→pwu→assessment→decision→baseline chain. When `staleAfterApproval` is true, a SUBJECT
	 * OF THE DECISION really moves after the decision is approved, so the decision's pinned versions stop
	 * describing the world.
	 *
	 * WHY THE INTENT CARRIES THE STALENESS AND NOT THE PWU (REG-F-017, 2026-08-03). This test used to make the
	 * decision bind v2 by having the approver STATE v2 while the subject sat at v1 — the caller-supplied-fact
	 * bug REG-F-014 records, used as a fixture device. `approveDecision` no longer writes the caller's number,
	 * so that premise is gone; and it cannot simply be replaced by moving the PWU, because A PWU'S
	 * semanticVersion NEVER MOVES — censused: only INTENT (ReviseIntent), DECOMPOSITION_CONTRACT
	 * (ReviseDecomposition) and PWA (the authoring commands) can ever bump one. So the decision names the
	 * intent as a co-subject alongside the baselined PWU, and the intent is genuinely revised. The rule under
	 * test is 'a decision approving version n never authorizes version n+1'; a subject moving is a subject
	 * moving, whichever subject it is. This arrangement asserts the refusal from a TRUE premise for the first
	 * time.
	 */
	function setup(staleAfterApproval: boolean) {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: DIR.authenticate,
			store,
			now: () => TS,
			newEventId: () => `evt_${++seq}`
		}).as(DIR.credentialFor(human.actorId));
		seedPolicy(engine, 'pol_arch');
		dispatch(
			'CaptureIntent',
			{ intentId: INTENT_ID, originatingExpression: 'ship it', ontologyId: 'o', ontologyVersion: '1' },
			{ targetAggregateId: INTENT_ID, targetAggregateType: 'INTENT' }
		);
		dispatch(
			'ProposePwu',
			{
				pwuId: PWU_ID,
				pwuKind: 'ARCHITECTURE',
				title: 'Architecture Definition',
				description: 'd',
				intentId: INTENT_ID,
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
			{ targetAggregateId: PWU_ID }
		);
		dispatch(
			'RequestAssuranceAssessment',
			{
				assessmentId: ASSESS,
				assurancePolicyId: 'pol_arch',
				policyVersion: '1',
				subjectObjectIds: [PWU_ID],
				subjectSemanticVersions: { [PWU_ID]: 1 },
				claimIds: []
			},
			{ targetAggregateId: ASSESS, targetAggregateType: 'ASSURANCE_ASSESSMENT' }
		);
		// THE READY -> ASSESSING ARROW (REG-F-021 increment 3): requestAssuranceAssessment now lands the
		// assessment in READY, so it must be BEGUN before it can be assessed or completed.
		dispatch(
			'BeginAssuranceAssessment',
			{},
			{ targetAggregateId: ASSESS, targetAggregateType: 'ASSURANCE_ASSESSMENT' }
		);
		dispatch(
			'CompleteAssuranceAssessment',
			{
				validatorResult: floorValidatorResult({
					assessmentId: ASSESS,
					policyId: 'pol_arch',
					subjectId: PWU_ID,
					subjectSemanticVersion: 1,
					disposition: 'SATISFIED'
				})
			},
			{ targetAggregateId: ASSESS }
		);
		dispatch(
			'ProposeDecision',
			{
				decisionType: 'PROMOTE_BASELINE',
				// The INTENT is a co-subject precisely because it is one of the three aggregates whose semantic
				// version can move; the PWU is the baselined item and its version is 1 forever.
				subjectObjectIds: [PWU_ID, INTENT_ID],
				selectedOption: 'promote',
				rationale: 'ready',
				authority: human
			},
			{ targetAggregateId: DEC, targetAggregateType: 'DECISION' }
		);
		dispatch(
			'ApproveDecision',
			{
				selectedOption: 'promote',
				rationale: 'ready',
				consideredEvidenceIds: [],
				consideredObservationIds: [],
				// States what the decision pinned at proposal. Stating anything else is now refused: the approval
				// binds the versions that were REVIEWED (REG-F-017).
				subjectSemanticVersions: { [PWU_ID]: 1, [INTENT_ID]: 1 }
			},
			{ targetAggregateId: DEC }
		);
		// THE ARRANGING ACT, and the only difference between the two runs: the intent the decision approved is
		// materially revised AFTER the approval, bumping its semanticVersion 1 -> 2. The decision's pin still
		// says 1. Nothing about the decision is edited — the world moved, which is the rule's actual scenario.
		if (staleAfterApproval) {
			const intent = (t: string, payload: unknown) =>
				dispatch(t, payload, { targetAggregateId: INTENT_ID, targetAggregateType: 'INTENT' });
			const step = (t: string, payload: unknown) => {
				const r = intent(t, payload);
				expect(r.status, `${t}: ${JSON.stringify(r.error)}`).toBe('ACCEPTED');
			};
			step('BeginIntentDiscovery', {});
			step('ProvisionIntent', { ambiguityIds: [] });
			step('FormalizeIntent', {
				formalizedObjective: 'ship the architecture',
				desiredOutcomes: [{ description: 'a coherent structure' }],
				successConditions: [{ statement: 'the review passes' }],
				nonGoals: ['vendor selection'],
				ambiguityIds: [],
				constraintIds: [],
				stakeholderIds: []
			});
			step('ApproveIntent', {
				decisionId: DEC,
				approvedSemanticVersion: 1,
				approvalScope: 'the architecture intent'
			});
			step('ReviseIntent', { changeRationale: 'the client widened the scope' });
			expect(
				store.loadObject(INTENT_ID)?.semanticVersion,
				'the subject must really have moved — otherwise this test asserts staleness over a world that did not change'
			).toBe(2);
		}
		dispatch(
			'CreateBaseline',
			{ baselineType: 'ARCHITECTURE', itemObjectIds: [PWU_ID], assuranceAssessmentIds: [ASSESS] },
			{ targetAggregateId: BASE, targetAggregateType: 'BASELINE' }
		);
		dispatch('SubmitBaselineForReview', {}, { targetAggregateId: BASE });
		dispatch('ApproveBaseline', {}, { targetAggregateId: BASE });
	}

	function promote() {
		return dispatch(
			'PromoteBaseline',
			{
				promotionDecisionId: DEC,
				expectedItemObjectVersions: [{ objectId: PWU_ID, semanticVersion: 1 }],
				requiredAssessmentIds: [ASSESS]
			},
			{ targetAggregateId: BASE }
		);
	}

	it('rejects promotion when the decision bound a version other than the subject current version (RPH-GOV-003)', () => {
		setup(true); // the approved intent was revised after approval → the decision's pin is stale
		const r = promote();
		expect(r.status).not.toBe('ACCEPTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message).toContain('STALE_DECISION_VERSION');
		expect(statusOf(BASE)).toBe('APPROVED'); // not AUTHORITATIVE
	});

	it('promotes when the decision bound the subject current version (the control must discriminate)', () => {
		setup(false); // nothing moved after approval → every pinned version is still current → authorizes
		const r = promote();
		expect(r.status).toBe('ACCEPTED');
		expect(statusOf(BASE)).toBe('AUTHORITATIVE');
	});
});
