// Drives the PublishPwa protected transition LIVE to prove the CALL SITE scopes a waiver, not just the kernel.
// The neighbouring pwa-authoring.test.ts proves an in-scope floor waiver PERMITS publish; these tests prove the
// complement it never asks — that an OUT-OF-SCOPE waiver must NOT. A waiver naming the subject is not a waiver of
// every criterion over that subject.
//
// Guide §16 item 12, L2509 (byte-exact): "Never implement waiver as a Boolean—require a version-bound Decision with
// scope, expiry, rationale, controls, and preserved finding."
// Guide §8.4, L854 (byte-exact): "No PWA profile, low-risk classification, planner optimization, or local agent
// instruction may suppress this Reasoning Review floor."
//
// DEAD KERNEL: packages/rph-domain/src/governance.ts:127 waiverCovers(w, criterionId, subjectObjectId,
// subjectSemanticVersion) implements exactly this scoping and is called by nothing in production. floor-gate.ts:99
// calls hasEffectiveFloorWaiver instead, whose whole test is `subjectObjectIds.includes(subjectId)` — a Boolean.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { floorValidatorResult } from './__tests__/floor-fixtures.js';
import type { AssuranceDispositionRecommendation } from '@janumipwb/rph-contracts';

const TS = '2026-07-15T00:00:00Z';
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
const AI_PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5S00';
const AI_ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5S10';
const WAIVER = 'dec_01ARZ3NDEKTSV4RRFFQ69G5S20';
const SCHEMA = 'floor.schema-invariant';
const IDENTITY = 'floor.identity-provenance';
const REVIEW = 'floor.reasoning-review';

describe('de minimis floor waiver SCOPE at the PublishPwa call site', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;
	let asmtSeq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		asmtSeq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
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
			issuedBy: actor,
			correlationId: 'waiver-scope',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const pub = () =>
		(store.loadObject(AI_PWA)?.state as { publicationStatus: string }).publicationStatus;

	function authorValidatedAiPwa() {
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
		d(AGENT, 'SubmitPwaForReview', {}, AI_PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		d(AGENT, 'ValidatePwa', {}, AI_PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
	}

	const ulid = (prefix: string) => `${prefix}_${String(++asmtSeq).padStart(26, '0')}`;

	function recordFloor(
		dispositions: Record<string, AssuranceDispositionRecommendation>,
		version = 1
	) {
		for (const [policyId, disposition] of Object.entries(dispositions)) {
			const assessmentId = ulid('asmt');
			d(
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
			d(
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
		}
	}

	// Grant an EFFECTIVE WAIVER naming AI_PWA as its subject, scoped to `scope`.
	/** Grant an EFFECTIVE waiver naming an exact (policy, criterion) — DOC-004 §12.2's "exact policy and criterion".
	 *  The payload previously carried only a free-text `scope`, which the Decision could not even hold; the
	 *  WaiverDetail contract now requires the waiver to say precisely what it waives. Premise fix only — every
	 *  expectation below is unchanged, because the behavior they assert is exactly what the contract now enforces. */
	function grantWaiverScopedTo(policyId: string, criterionId: string) {
		const req = d(
			HUMAN,
			'RequestWaiver',
			{
				subjectObjectIds: [AI_PWA],
				scope: criterionId,
				rationale: 'Accepted residual risk for the pilot.',
				duration: 'until superseded',
				affectedObjectIds: [AI_PWA],
				waivedPolicyId: policyId,
				waivedCriterionId: criterionId,
				waivedFindingIds: [],
				compensatingControls: [],
				reviewConditions: []
			},
			WAIVER,
			'DECISION'
		);
		expect(req.status, JSON.stringify(req.error)).toBe('ACCEPTED');
		const grant = d(
			HUMAN,
			'GrantWaiver',
			{ waiverDecisionId: WAIVER, effectiveAt: TS, duration: 'until superseded' },
			WAIVER,
			'DECISION'
		);
		expect(grant.status, JSON.stringify(grant.error)).toBe('ACCEPTED');
	}

	const publish = () =>
		d(AGENT, 'PublishPwa', { rootPwuTypeId: AI_ROOT }, AI_PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');

	it('a waiver scoped to an UNRELATED criterion does not discharge the Reasoning Review floor', () => {
		authorValidatedAiPwa();
		recordFloor({ [SCHEMA]: 'SATISFIED', [IDENTITY]: 'SATISFIED', [REVIEW]: 'REJECTED' });
		expect(publish().status).toBe('REJECTED');

		// The waiver names the subject but waives a naming-convention criterion — it says nothing about the floor.
		grantWaiverScopedTo('style.naming-convention', 'naming-convention style guide deviation');

		const r = publish();
		expect(r.status, JSON.stringify(r.error)).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(pub()).toBe('VALIDATED');
	});

	it('a waiver scoped to ONE floor criterion does not waive the OTHER floor criteria', () => {
		authorValidatedAiPwa();
		// Only the schema/invariant criterion is unmet AND waived; the Reasoning Review is independently REJECTED,
		// so the transition must stay blocked on the review regardless of the schema waiver.
		recordFloor({ [SCHEMA]: 'REJECTED', [IDENTITY]: 'SATISFIED', [REVIEW]: 'REJECTED' });
		grantWaiverScopedTo(SCHEMA, 'SCHEMA_INVALID');

		const r = publish();
		expect(r.status, JSON.stringify(r.error)).toBe('REJECTED');
		expect(pub()).toBe('VALIDATED');
	});
});
