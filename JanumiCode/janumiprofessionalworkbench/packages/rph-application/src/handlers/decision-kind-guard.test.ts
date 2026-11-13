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
// wrong KIND of decision). DenyWaiver's wrong-STATE half refuses as RPH_ILLEGAL_STATE_TRANSITION via its
// fromStates('PROPOSED') precondition (DWP-01a authored these as requireFrom; DWP-01b migrated them to the union).
import type {
	ActorReference,
	AssuranceDispositionRecommendation,
	DomainCommand
} from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { floorValidatorResult, seedFloorPolicies } from './__tests__/floor-fixtures.js';

const TS = '2026-07-23T00:00:00Z';
const AGENT: ActorReference = {
	actorId: 'agent-1',
	actorType: 'AGENT',
	displayName: 'Authoring Agent'
};
const SVC: ActorReference = {
	actorId: 'assurance',
	actorType: 'SERVICE',
	displayName: 'Assurance'
};
const HUMAN: ActorReference = { actorId: 'lead', actorType: 'HUMAN', displayName: 'Eng Lead' };

// THREE ACTORS, AND THE SEPARATION IS LOAD-BEARING — which is why `d`'s first parameter must select a session
// rather than decorate a payload. The AGENT authors the PWA (so `floor-gate.ts` reads the work as AI-produced
// and the de minimis floor applies at all), the SERVICE records the assurance assessments and findings against
// it, and only the HUMAN issues the governance acts — `makeDecisionEffective` grants EFFECTIVE only on a HUMAN
// authority, and `proposeDecision` refuses an authority its issuer is not. Collapse these onto one principal
// and the file stops testing the kind guard: it tests one actor doing everything.
const DIR = testDirectory(
	[AGENT, SVC, HUMAN].map((a) => ({ ...a, tenantId: 'tenant-test', organizationId: 'org-test' }))
);

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

	/** The session for one of the three registered actors. `credentialFor` THROWS on an unregistered actor, so a
	 *  scenario cannot quietly acquire an identity the fixture never declared. */
	const sessionOf = (actor: ActorReference): AuthedEngine =>
		engine.as(DIR.credentialFor(actor.actorId));

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		asmtSeq = 0;
		engine = new Engine({
			authenticate: DIR.authenticate,
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		});
		// The floor assessments below cite floor.* policies — they must exist. Seeded by the human, as the
		// fixture's SEED_ACTOR did before the engine took over stamping.
		seedFloorPolicies(sessionOf(HUMAN));
	});

	function d(
		actor: ActorReference,
		commandType: string,
		payload: unknown,
		id: string,
		type: string
	) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'decision-kind',
			idempotencyKey: `k-${n}`, // a DISTINCT key each time — a re-aimed command is a new request, not a retry
			payload
		};
		// `actor` SELECTS THE SESSION; it is no longer written into the envelope. The engine stamps `issuedBy`
		// from the authenticated principal, and a declared issuer that disagreed would be refused outright.
		return sessionOf(actor).dispatch(command);
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
			{ waiverDecisionId: WAIVER, duration: 'until superseded' },
			WAIVER,
			'DECISION'
		);

	const denyWaiver = (id = WAIVER) =>
		d(HUMAN, 'DenyWaiver', { rationale: 'Risk not accepted.' }, id, 'DECISION');

	// ---- the floor fixture (pwa-authoring.test.ts's shape) — for proving the DISCHARGE half ----

	// ⭐⭐ RESTATED BY PACKAGE L11 — design D66 (`REG-D-155`; `l11-facts.md` §3 (e)): this drove the PWA to VALIDATED with no floor recorded;
	// SubmitPwaForReview now asks the floor PublishPwa asks, so the floor is recorded while the PWA is DRAFT and Submit decides it first
	// (`refusedAtSubmitThenPublish`).
	function authorAiPwa() {
		d(
			AGENT,
			'CreatePwa',
			{
				pwaId: AI_PWA,
				name: 'Agent-authored',
				description: 'd',
				domain: 'software',
				version: '1.0.0'
			},
			AI_PWA,
			'PROFESSIONAL_WORK_ARCHITECTURE'
		);
		d(
			AGENT,
			'DefinePwuType',
			{
				pwuTypeId: AI_ROOT,
				pwaId: AI_PWA,
				pwuKind: 'PRODUCT_REALIZATION',
				name: 'R',
				purpose: 'root',
				isRoot: true
			},
			AI_ROOT,
			'PWU_TYPE'
		);
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
			// THE READY -> ASSESSING ARROW (REG-F-021 increment 3): requestAssuranceAssessment now lands the
			// assessment in READY, so it must be BEGUN before it can be assessed or completed.
			d(SVC, 'BeginAssuranceAssessment', {}, assessmentId, 'ASSURANCE_ASSESSMENT');
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

	/**
	 * ⭐⭐ L11 (D66; `REG-D-155` (1), (2)) — SUBMIT, THEN PUBLISH'S OWN CHECK, ASKED OF ONE ARRANGEMENT. SubmitPwaForReview refuses the PWA for its
	 * floor while it is DRAFT, and leaves it DRAFT with no event appended; the PWA is then VALIDATED as a store written before L11 holds it
	 * (Submit then had no guard) — the status and its `lifecycleStatus` mirror written as Submit and Validate left them, the revision moved and the
	 * semantic version not, no event, the repository's way of arranging a state no command reaches (`sta6-superseded-intent.test.ts`) — and
	 * PublishPwa, its own floor check the second guard, is asked of the same floor, naming the dispositions Submit named.
	 */
	function refusedAtSubmitThenPublish(): ReturnType<typeof publish> {
		const before = store.readAllEvents().length;
		const submitted = d(AGENT, 'SubmitPwaForReview', {}, AI_PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		expect(submitted.status, 'Submit admitted a PWA whose floor PublishPwa refuses (D66)').toBe('REJECTED');
		expect(submitted.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(submitted.error?.message).toContain("The floor, PublishPwa's check: the de minimis assurance floor is not SATISFIED at v");
		const stored = store.loadObject(AI_PWA)!;
		expect([(stored.state as { publicationStatus: string }).publicationStatus, store.readAllEvents().length - before], 'a refused Submit moved the PWA').toEqual(['DRAFT', 0]);
		const tag = `fixture-l11-${AI_PWA}-VALIDATED`;
		const written = store.commit({
			aggregateType: 'PROFESSIONAL_WORK_ARCHITECTURE',
			aggregateId: AI_PWA,
			objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
			expectedRevision: stored.revision,
			newRevision: stored.revision + 1,
			newSemanticVersion: stored.semanticVersion,
			currentState: { ...(stored.state as Record<string, unknown>), publicationStatus: 'VALIDATED', lifecycleStatus: 'VALIDATED' },
			events: [],
			receipt: { commandId: tag, idempotencyKey: tag, commandType: 'FixtureSeedPublicationStatus', targetAggregateId: AI_PWA, status: 'ACCEPTED', producedEventIds: [] }
		});
		expect(written.ok, 'arrangement: the status was not written').toBe(true);
		const r = publish();
		const dispositions = (m: string | undefined) => /not SATISFIED (?:for PWA \S+ )?at v\d+ \(([^)]*)\)/.exec(m ?? '')?.[1];
		expect(dispositions(r.error?.message), 'Submit and Publish named other dispositions').toBe(dispositions(submitted.error?.message));
		return r;
	}

	// THE SECURITY CASE. The floor gate honours any EFFECTIVE WAIVER-typed Decision covering the failed criterion,
	// however it became effective — so ApproveDecision aimed at a waiver request was a floor discharge that recorded
	// no waiver fact. The refusal must hold the decision at PROPOSED and keep publish blocked; the SAME waiver then
	// granted through GrantWaiver must still discharge — proving the guard removed the exploit, not the capability.
	it('ApproveDecision on a PROPOSED WAIVER is REFUSED — and the floor stays blocked until GrantWaiver records the fact', () => {
		authorAiPwa();
		const ids = recordFloor({
			[SCHEMA]: 'SATISFIED',
			[IDENTITY]: 'SATISFIED',
			[REVIEW]: 'REJECTED'
		});
		const findingId = recordFinding(ids[REVIEW]!, 'RR-04-completeness-shortcut');
		expect(refusedAtSubmitThenPublish().status).toBe('REJECTED');

		requestWaiver({
			policyId: REVIEW,
			criterionId: 'RR-04-completeness-shortcut',
			findingIds: [findingId]
		});

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
		// ⚠ INVERTED 2026-08-20 (REG-F-202 / ASR-3). This test's SUBJECT is unchanged and still holds: an
		// ApproveDecision on a PROPOSED WAIVER is refused, and only GrantWaiver records the fact — the assertion
		// above still proves it. What changed is the CONSEQUENCE. GrantWaiver now records a waiver that discharges
		// NOTHING against a required floor policy, so the publish stays REJECTED. The governance act is real and
		// recorded (ASR-14: "a waiver accepts risk; it never rewrites truth"); its REACH over the floor is not.
		const r = publish();
		expect(r.status, 'ASR-3: the granted waiver does not discharge the floor').toBe('REJECTED');
	});

	it('GrantWaiver on a PROPOSED non-waiver decision is REFUSED with no event', () => {
		proposeDecision();
		const r = d(
			HUMAN,
			'GrantWaiver',
			{ waiverDecisionId: APPROVAL, duration: 'until superseded' },
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

	// The re-issue (NOOP) half of the precondition: SUPERSEDED -> SUPERSEDED classifies NOOP, which checkTransition
	// admits — only fromStates('PROPOSED') stops a second contradicting WaiverDenied. This is the test that
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

	// DWP-01b: the factory's source set is now EXPLICIT (fromStates('PROPOSED') ahead of the authority guard).
	// DELIBERATE refusal-code change, enumerated in the roadmap: these re-issues were refused by ACCIDENT —
	// authorizeDecisionEffective's legality arm, surfacing RPH_AUTHORITY_INSUFFICIENT — and authority was never
	// the defect. The state fact now refuses first, with the state code.
	it('a RE-ISSUED ApproveDecision on an EFFECTIVE decision is REFUSED on state, with no second DecisionEffective', () => {
		proposeDecision();
		expect(approveDecision().status).toBe('ACCEPTED');

		const reissue = approveDecision();
		expect(reissue.status).toBe('REJECTED');
		expect(reissue.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(eventsOfType('DecisionEffective')).toHaveLength(1);
	});

	it('a RE-ISSUED GrantWaiver on an EFFECTIVE waiver is REFUSED on state, with no second WaiverGranted', () => {
		requestWaiver({ policyId: REVIEW, criterionId: 'RR-04-completeness-shortcut', findingIds: [] });
		expect(grantWaiver().status).toBe('ACCEPTED');

		const reissue = grantWaiver();
		expect(reissue.status).toBe('REJECTED');
		expect(reissue.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(eventsOfType('WaiverGranted')).toHaveLength(1);
	});
});
