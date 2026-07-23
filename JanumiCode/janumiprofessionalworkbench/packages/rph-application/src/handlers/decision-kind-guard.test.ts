// JAN-CMDPRE DWP-01a — the Decision family closed SYMMETRICALLY on decisionType (DS-001 D1/D8).
//
// Why this file exists. `Decision.status` legalises the ARROWS these commands drive, but the discriminator between
// them is `decisionType` — a NON-state field no source-state set can reach. Before this guard, two mirrored
// exploits were live, both REPRODUCED against the real engine:
//
//  - ApproveDecision aimed at a PROPOSED WAIVER drove it EFFECTIVE: `authorizeDecisionEffective` checks only
//    arrow-legality + authority, and floor-gate reads the resulting OBJECT's decisionType/status without regard to
//    which command produced it — so the assurance floor was DISCHARGED with a DecisionEffective where a
//    WaiverGranted should be. The discharge stayed scoped and expiry-bound (the floor gate reads the object's
//    WaiverDetail, which the exploit left intact), but the grant act itself was unrecorded — no WaiverGranted
//    fact to audit.
//  - DenyWaiver aimed at a non-waiver decision drove it to SUPERSEDED: the machine also legalises
//    EFFECTIVE -> SUPERSEDED, so an unguarded DenyWaiver could retire an EFFECTIVE governance authorization while
//    emitting WaiverDenied about a decision that never requested a waiver.
//
// The kind mismatch refuses as RPH_VALIDATION_SEMANTIC_FAILED (the state arrow is legal; the command addresses the
// wrong KIND of decision). DenyWaiver's wrong-STATE half refuses as RPH_ILLEGAL_STATE_TRANSITION via requireFrom.
import type {
	ActorReference,
	AssuranceDispositionRecommendation,
	DomainCommand
} from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { floorValidatorResult, seedFloorPolicies } from './__tests__/floor-fixtures.js';

const TS = '2026-07-23T00:00:00Z';
const AGENT: ActorReference = { actorId: 'agent-1', actorType: 'AGENT', displayName: 'Authoring Agent' };
const SVC: ActorReference = { actorId: 'assurance', actorType: 'SERVICE', displayName: 'Assurance' };
const HUMAN: ActorReference = { actorId: 'lead', actorType: 'HUMAN', displayName: 'Eng Lead' };

const AI_PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5T00';
const AI_ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5T10';
const WAIVER = 'dec_01ARZ3NDEKTSV4RRFFQ69G5T20';
const APPROVAL = 'dec_01ARZ3NDEKTSV4RRFFQ69G5T30';
const SCHEMA = 'floor.schema-invariant';
const IDENTITY = 'floor.identity-provenance';
const REVIEW = 'floor.reasoning-review';

describe('JAN-CMDPRE DWP-01a — a Decision command cannot address the wrong KIND of decision', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;
	let asmtSeq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		asmtSeq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
		seedFloorPolicies(engine); // the floor assessments below cite floor.* policies — they must exist
	});

	function d(actor: ActorReference, commandType: string, payload: unknown, id: string, type: string) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'decision-kind',
			idempotencyKey: `k-${n}`, // a DISTINCT key each time — a re-aimed command is a new request, not a retry
			payload
		};
		return engine.dispatch(command);
	}

	const stateOf = (id: string) => store.loadObject(id)?.state as Record<string, unknown>;
	const eventsOfType = (t: string) => store.readAllEvents().filter((e) => e.eventType === t);
	const ulid = (prefix: string) => `${prefix}_${String(++asmtSeq).padStart(26, '0')}`;

	/** A PROPOSED non-waiver decision (the seed's own kind — PROMOTE_BASELINE, not APPROVAL, to keep the
	 *  fixture honest about why the guard is `!== 'WAIVER'` rather than `=== 'APPROVAL'`). */
	function proposeDecision(id = APPROVAL, decisionType = 'PROMOTE_BASELINE') {
		const r = d(
			HUMAN,
			'ProposeDecision',
			{
				decisionType,
				subjectObjectIds: [AI_PWA],
				selectedOption: 'Promote',
				rationale: 'Assessments satisfied.',
				authority: HUMAN,
				consideredObservationIds: []
			},
			id,
			'DECISION'
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	}

	const approveDecision = (id = APPROVAL) =>
		d(
			HUMAN,
			'ApproveDecision',
			{
				selectedOption: 'Promote',
				rationale: 'Approved.',
				consideredEvidenceIds: [],
				consideredObservationIds: [],
				subjectSemanticVersions: { [AI_PWA]: 1 }
			},
			id,
			'DECISION'
		);

	/** A PROPOSED waiver naming the exact (policy, criterion, finding) DOC-004 §12.2 requires. */
	function requestWaiver(over: { policyId: string; criterionId: string; findingIds: string[] }) {
		const r = d(
			HUMAN,
			'RequestWaiver',
			{
				subjectObjectIds: [AI_PWA],
				scope: 'de minimis assurance floor',
				rationale: 'Accepted residual risk for the pilot.',
				duration: 'until superseded',
				affectedObjectIds: [AI_PWA],
				waivedPolicyId: over.policyId,
				waivedCriterionId: over.criterionId,
				waivedFindingIds: over.findingIds,
				compensatingControls: ['Manual architecture review before pilot rollout.'],
				reviewConditions: ['Revisit at the next PWA version.']
			},
			WAIVER,
			'DECISION'
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	}

	const grantWaiver = () =>
		d(
			HUMAN,
			'GrantWaiver',
			{ waiverDecisionId: WAIVER, effectiveAt: TS, duration: 'until superseded' },
			WAIVER,
			'DECISION'
		);

	const denyWaiver = (id = WAIVER) => d(HUMAN, 'DenyWaiver', { rationale: 'Risk not accepted.' }, id, 'DECISION');

	// ---- the floor fixture (pwa-authoring.test.ts's shape) — for proving the DISCHARGE half ----

	function authorValidatedAiPwa() {
		d(
			AGENT,
			'CreatePwa',
			{ pwaId: AI_PWA, name: 'Agent-authored', description: 'd', domain: 'software', version: '1.0.0' },
			AI_PWA,
			'PROFESSIONAL_WORK_ARCHITECTURE'
		);
		d(
			AGENT,
			'DefinePwuType',
			{ pwuTypeId: AI_ROOT, pwaId: AI_PWA, pwuKind: 'PRODUCT_REALIZATION', name: 'R', purpose: 'root', isRoot: true },
			AI_ROOT,
			'PWU_TYPE'
		);
		d(AGENT, 'SubmitPwaForReview', {}, AI_PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		d(AGENT, 'ValidatePwa', {}, AI_PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
	}

	const pwaVersion = () =>
		Number((store.loadObject(AI_PWA)?.state as { semanticVersion?: number }).semanticVersion ?? 1);

	function recordFloor(
		dispositions: Record<string, AssuranceDispositionRecommendation>,
		version = pwaVersion()
	): Record<string, string> {
		const assessmentIds: Record<string, string> = {};
		for (const [policyId, disposition] of Object.entries(dispositions)) {
			const assessmentId = ulid('asmt');
			assessmentIds[policyId] = assessmentId;
			const req = d(
				SVC,
				'RequestAssuranceAssessment',
				{
					assessmentId,
					assurancePolicyId: policyId,
					policyVersion: '1.0.0',
					subjectObjectIds: [AI_PWA],
					subjectSemanticVersions: { [AI_PWA]: version },
					claimIds: []
				},
				assessmentId,
				'ASSURANCE_ASSESSMENT'
			);
			expect(req.status, JSON.stringify(req.error)).toBe('ACCEPTED');
			const done = d(
				SVC,
				'CompleteAssuranceAssessment',
				{
					validatorResult: floorValidatorResult({
						assessmentId,
						policyId,
						subjectId: AI_PWA,
						subjectSemanticVersion: version,
						disposition
					})
				},
				assessmentId,
				'ASSURANCE_ASSESSMENT'
			);
			expect(done.status, JSON.stringify(done.error)).toBe('ACCEPTED');
		}
		return assessmentIds;
	}

	function recordFinding(assessmentId: string, findingCode: string): string {
		const observationId = ulid('obs');
		d(
			SVC,
			'RecordAssuranceObservation',
			{
				assessmentId,
				observationType: 'FINDING',
				findingCode,
				severity: 'BLOCKING',
				statement: `${findingCode} not satisfied.`
			},
			observationId,
			'ASSURANCE_OBSERVATION'
		);
		return observationId;
	}

	const publish = () =>
		d(AGENT, 'PublishPwa', { rootPwuTypeId: AI_ROOT }, AI_PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');

	// THE SECURITY CASE. The floor gate honours any EFFECTIVE WAIVER-typed Decision covering the failed criterion,
	// however it became effective — so ApproveDecision aimed at a waiver request was a floor discharge that recorded
	// no waiver fact. The refusal must hold the decision at PROPOSED and keep publish blocked; the SAME waiver then
	// granted through GrantWaiver must still discharge — proving the guard removed the exploit, not the capability.
	it('ApproveDecision on a PROPOSED WAIVER is REFUSED — and the floor stays blocked until GrantWaiver records the fact', () => {
		authorValidatedAiPwa();
		const ids = recordFloor({ [SCHEMA]: 'SATISFIED', [IDENTITY]: 'SATISFIED', [REVIEW]: 'REJECTED' });
		const findingId = recordFinding(ids[REVIEW]!, 'RR-04-completeness-shortcut');
		expect(publish().status).toBe('REJECTED');

		requestWaiver({ policyId: REVIEW, criterionId: 'RR-04-completeness-shortcut', findingIds: [findingId] });

		const exploit = approveDecision(WAIVER);
		expect(exploit.status).toBe('REJECTED');
		expect(exploit.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(stateOf(WAIVER).status).toBe('PROPOSED');
		expect(eventsOfType('DecisionEffective')).toHaveLength(0);

		// The floor gate still blocks: no waiver fact was recorded, so nothing discharges the REJECTED review.
		expect(publish().status).toBe('REJECTED');

		// The legitimate act on the SAME waiver still works end to end.
		const grant = grantWaiver();
		expect(grant.status, JSON.stringify(grant.error)).toBe('ACCEPTED');
		expect(eventsOfType('WaiverGranted')).toHaveLength(1);
		const r = publish();
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	});

	it('GrantWaiver on a PROPOSED non-waiver decision is REFUSED with no event', () => {
		proposeDecision();
		const r = d(
			HUMAN,
			'GrantWaiver',
			{ waiverDecisionId: APPROVAL, effectiveAt: TS, duration: 'until superseded' },
			APPROVAL,
			'DECISION'
		);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(stateOf(APPROVAL).status).toBe('PROPOSED');
		expect(eventsOfType('WaiverGranted')).toHaveLength(0);
	});

	// THE MIRROR. Decision.status legalises EFFECTIVE -> SUPERSEDED, so no state set can refuse this — the
	// discriminator is decisionType, which is exactly why the family needed a payload-shaped precondition (DS §5).
	it('DenyWaiver on an EFFECTIVE non-waiver decision is REFUSED — a governance authorization cannot be retired as a "waiver denial"', () => {
		proposeDecision();
		expect(approveDecision().status).toBe('ACCEPTED');

		const r = denyWaiver(APPROVAL);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(stateOf(APPROVAL).status).toBe('EFFECTIVE');
		expect(eventsOfType('WaiverDenied')).toHaveLength(0);
	});

	it('DenyWaiver on a PROPOSED non-waiver decision is REFUSED on kind, not state', () => {
		proposeDecision();
		const r = denyWaiver(APPROVAL);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(stateOf(APPROVAL).status).toBe('PROPOSED');
	});

	it('DenyWaiver on an EFFECTIVE (granted) waiver is REFUSED — unmaking a grant is RevokeDecision, not a late denial', () => {
		requestWaiver({ policyId: REVIEW, criterionId: 'RR-04-completeness-shortcut', findingIds: [] });
		expect(grantWaiver().status).toBe('ACCEPTED');

		const r = denyWaiver();
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(stateOf(WAIVER).status).toBe('EFFECTIVE');
		expect(eventsOfType('WaiverDenied')).toHaveLength(0);
	});

	// The positive halves — the guard must refuse the wrong KIND, never the legitimate act.
	it('DenyWaiver on a PROPOSED waiver still succeeds and records WaiverDenied', () => {
		requestWaiver({ policyId: REVIEW, criterionId: 'RR-04-completeness-shortcut', findingIds: [] });
		const r = denyWaiver();
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(stateOf(WAIVER).status).toBe('SUPERSEDED');
		expect(eventsOfType('WaiverDenied')).toHaveLength(1);
	});

	// The re-issue (NOOP) half of requireFrom: SUPERSEDED -> SUPERSEDED classifies NOOP, which checkTransition
	// admits — only requireFrom ['PROPOSED'] stops a second contradicting WaiverDenied. This is the test that
	// kills the ['PROPOSED','SUPERSEDED'] mutant (JAN-NOOP-01 discipline: reverting the enforcement must fail here).
	it('a RE-ISSUED DenyWaiver on an already-denied waiver is REFUSED and appends no second WaiverDenied', () => {
		requestWaiver({ policyId: REVIEW, criterionId: 'RR-04-completeness-shortcut', findingIds: [] });
		expect(denyWaiver().status).toBe('ACCEPTED');

		const reissue = denyWaiver();
		expect(reissue.status).toBe('REJECTED');
		expect(reissue.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(stateOf(WAIVER).status).toBe('SUPERSEDED');
		expect(eventsOfType('WaiverDenied')).toHaveLength(1);
	});

	it('ApproveDecision on a PROPOSED non-waiver decision still succeeds (the seed path)', () => {
		proposeDecision();
		const r = approveDecision();
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(stateOf(APPROVAL).status).toBe('EFFECTIVE');
		expect(eventsOfType('DecisionEffective')).toHaveLength(1);
	});
});
