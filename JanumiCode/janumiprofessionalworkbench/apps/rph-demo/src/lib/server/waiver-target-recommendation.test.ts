// ⭐ `JAN-ESCREC` D3 (`REG-D-090`) — A WAIVER NEVER NAMES THE REVIEWER'S RECOMMENDATION AS THE FINDING IT WAIVES.
//
// ⛔ WHAT IS AT STAKE. `recordWaiver` (`routes/pwa/[id]/+page.server.ts`) derives what a waiver names from the RECORDED
// floor: the first policy that is not SATISFIED, and ~~that policy's FIRST observation~~ as the finding (DOC-004 §12.2 —
// a waiver names the exact policy and criterion it accepts). From `JAN-ESCREC` a reasoning review carries
// `REVIEWER_RECOMMENDED_ESCALATION` whenever its reviewer recommended ESCALATED (`rph-assurance` D2): ALONE on the clean
// review D1 escalates, and after the review's own observations elsewhere. Taken as `observations[0]`, it made the
// waiver's `waivedCriterionId` a recommendation — accepted risk recorded against a code that names no criterion and no
// deficiency. So the target skips it: the first observation that is NOT the recommendation, or the existing refusal
// when there is none.
//
// ⭑ THE PRODUCTION ACTION, in-process, over the canonical engine in test mode. The floor is staged through the same
// dispatch helper the page's actions use, in DOC-007 §20's shape, as `e2e/assurance-floor-waiver.e2e.ts` stages it. The
// recommendation is recorded FIRST here, so the first case tells `observations[0]` from the skip; the product records
// it last, beside a finding — a position the skip does not depend on.
//
// ⭐ AND THE PAGE OFFERS THE FORM EXACTLY WHERE THE ACTION RECORDS (the third fix round's re-verifier's finding [7], as the
// caller ruled): the load answers `hasWaiverTarget` from the ONE selection the action records against (`waiverTargetOf`).
// The form was offered on publication status alone, so beside a review whose only observation is the recommendation the
// page offered "Record accepted risk" and the action refused it. Each case reads the load's answer BEFORE the action, and
// holds it to the action's outcome.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

import { getObject, listDecisions } from '@janumipwb/rph-engine';
import { beforeEach, describe, expect, it } from 'vitest';
import { actions, load } from '../../routes/pwa/[id]/+page.server.js';
import { floorBlockedHint, loadPwaFloor } from './floor.js';
import { dispatch, getEngine, resetEngine } from './workbench.js';

type ActionEvent = Parameters<typeof actions.recordWaiver>[0];
type LoadEvent = Parameters<typeof load>[0];

const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5W00';
/** ⭐ The review in parts, B3 (`REG-D-125`) — the PWA's one type, whose review the floor shows: a reasoning review is a
 *  part's, recorded under its type. */
const TYPE = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5W02';
const POLICY = 'floor.reasoning-review';

/** `REG-D-090`'s observation, restated: the code as a literal — the RECORDED word — and the statement byte for byte. */
const RECOMMENDATION = {
	findingCode: 'REVIEWER_RECOMMENDED_ESCALATION',
	severity: 'INFORMATIONAL',
	statement:
		"The reviewing model's recommendation was ESCALATED. The review prompt does not define ESCALATED; the Assurance Policy Catalog defines it as: the validator implementation or policy-designated authority cannot resolve the issue within its authority or competence."
};
/** A SUBJECT finding — the one a waiver may name. */
const SUBJECT_FINDING = {
	findingCode: 'RR-04',
	severity: 'BLOCKING',
	statement: 'Staged blocking reasoning-review finding.'
};
/** A SUBJECT finding at the recommendation's own severity — so only the CODE tells it from the recommendation. */
const INFORMATIONAL_FINDING = {
	findingCode: 'RR-08',
	severity: 'INFORMATIONAL',
	statement: 'Staged informational reasoning-review finding.'
};

function arrange(commandType: string, aggregateType: string, id: string, payload: unknown): void {
	const r = dispatch(commandType, aggregateType, id, payload);
	expect(r.status, `arrangement: ${commandType} — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
}

/**
 * The reasoning review's assessment of the PWA's type (⭐ B3: its one part), carrying `observations` IN THAT ORDER — the recommendation typed
 * RECOMMENDATION, as the recorder types it — and CONCLUDED as given. No producer is named, so no independence is checked.
 */
function stageAReview(
	observations: readonly (typeof RECOMMENDATION)[],
	concludeAs: 'REJECTED' | 'ESCALATED'
): void {
	const assessmentId = 'assess_01ARZ3NDEKTSV4RRFFQ69G5W01';
	const version = Number(getObject(getEngine(), TYPE)?.semanticVersion ?? 1);
	arrange('RequestAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {
		assessmentId,
		assurancePolicyId: POLICY,
		policyVersion: '1',
		subjectObjectIds: [TYPE],
		subjectSemanticVersions: { [TYPE]: version },
		claimIds: []
	});
	arrange('BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {});
	observations.forEach((o, i) =>
		arrange(
			'RecordAssuranceObservation',
			'ASSURANCE_OBSERVATION',
			`obs_01ARZ3NDEKTSV4RRFFQ69G5W1${i}`,
			{
				assessmentId,
				observationType: o === RECOMMENDATION ? 'RECOMMENDATION' : 'FINDING',
				...o
			}
		)
	);
	arrange('CompleteAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {
		validatorResult: {
			validatorId: 'staged.reasoning-review',
			validatorVersion: '1',
			policyId: POLICY,
			policyVersion: '1',
			assessmentId,
			subjectObjectIds: [TYPE],
			subjectSemanticVersions: { [TYPE]: version },
			claimResults: [],
			evidenceConsideredIds: [],
			evidenceRejected: [],
			observations: observations.map((o) => ({ ...o, subjectObjectIds: [TYPE] })),
			dispositionRecommendation: concludeAs,
			recommendedControlActions: [],
			residualUncertainty: [],
			limitations: [],
			executionProvenance: {}
		}
	});
}

/** POST the page's own `recordWaiver` action, as the waiver form does. */
async function recordWaiver(): Promise<{
	readonly waived?: string;
	readonly status?: number;
	readonly data?: { readonly error?: string };
}> {
	const form = new FormData();
	form.set('rationale', 'Accepted: the staged review is understood and owned.');
	return (await actions.recordWaiver({
		request: new Request(`http://localhost/pwa/${PWA}?/recordWaiver`, {
			method: 'POST',
			body: form
		}),
		params: { id: PWA }
	} as unknown as ActionEvent)) as {
		waived?: string;
		status?: number;
		data?: { error?: string };
	};
}

/** What the page's load answers about the waiver form, read in-process as the browser's request reads it. */
async function theLoadOffersTheForm(): Promise<boolean | undefined> {
	const data = (await load({ params: { id: PWA } } as unknown as LoadEvent)) as {
		readonly hasWaiverTarget?: boolean;
	};
	return data.hasWaiverTarget;
}

beforeEach(() => {
	resetEngine('empty');
	arrange('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', PWA, {
		pwaId: PWA,
		name: 'Waiver target fixture',
		description: 'A DRAFT PWA whose reasoning review carries the recommendation.',
		domain: 'software',
		version: '1.0.0'
	});
	arrange('DefinePwuType', 'PWU_TYPE', TYPE, {
		pwuTypeId: TYPE,
		pwaId: PWA,
		pwuKind: 'PLAN',
		name: 'Plan',
		purpose: 'Plan the work',
		isRoot: true,
		permittedChildTypeIds: [],
		requiredInputs: [],
		requiredOutputs: [],
		requiredAssurancePolicyIds: []
	});
});

describe('⭐ JAN-ESCREC D3 — the waiver target skips the reviewer’s recommendation', () => {
	it('⛔ the recommendation FIRST and a subject finding SECOND: the waiver names the subject finding, never the recommendation', async () => {
		stageAReview([RECOMMENDATION, SUBJECT_FINDING], 'REJECTED');
		const review = loadPwaFloor(PWA)?.policies.find((p) => p.policyId === POLICY);
		expect(
			review?.observations.map((o) => o.code),
			'arrangement: the recommendation is not the first observation, so this case cannot tell the skip from observations[0]'
		).toEqual(['REVIEWER_RECOMMENDED_ESCALATION', 'RR-04']);

		const offered = await theLoadOffersTheForm();
		const result = await recordWaiver();
		expect(result.data?.error, 'arrangement: the waiver was refused').toBeUndefined();
		expect(result.waived, 'arrangement: no waiver was recorded').toBeDefined();
		expect(
			offered,
			'the page withholds the waiver form beside a finding the action records against'
		).toBe(true);
		// ⭑ READ FROM THE RECORDED DECISION, where `RequestWaiver` keeps what it names (`waiver`).
		const waiver = getObject(getEngine(), result.waived!)?.waiver as
			{ readonly waivedPolicyId?: string; readonly waivedCriterionId?: string } | undefined;
		expect(waiver?.waivedPolicyId).toBe(POLICY);
		expect(
			waiver?.waivedCriterionId,
			'the waiver named the reviewer’s recommendation as the finding it waives'
		).toBe('RR-04');
	});

	it('⛔ the skip is of ONE CODE, not a severity: an INFORMATIONAL finding right after the recommendation is the one the waiver names', async () => {
		// The ER-1 app verifier's finding [5] (its mutant `ER1-V55`): the only finding beside the recommendation above is
		// BLOCKING, so a target that skipped every INFORMATIONAL observation passed it. Here the first finding after the
		// recommendation is INFORMATIONAL — the recommendation's own severity — and a BLOCKING one follows it.
		stageAReview([RECOMMENDATION, INFORMATIONAL_FINDING, SUBJECT_FINDING], 'REJECTED');
		const review = loadPwaFloor(PWA)?.policies.find((p) => p.policyId === POLICY);
		expect(
			review?.observations.map((o) => `${o.code}/${o.severity}`),
			'arrangement: the two INFORMATIONAL observations do not lead, with the BLOCKING finding after them'
		).toEqual([
			'REVIEWER_RECOMMENDED_ESCALATION/INFORMATIONAL',
			'RR-08/INFORMATIONAL',
			'RR-04/BLOCKING'
		]);

		const offered = await theLoadOffersTheForm();
		const result = await recordWaiver();
		expect(result.data?.error, 'arrangement: the waiver was refused').toBeUndefined();
		expect(
			offered,
			'the page withholds the waiver form beside a finding the action records against'
		).toBe(true);
		const waiver = getObject(getEngine(), result.waived!)?.waiver as
			{ readonly waivedCriterionId?: string } | undefined;
		expect(
			waiver?.waivedCriterionId,
			'the waiver skipped an informational finding along with the recommendation'
		).toBe('RR-08');
	});

	it('⛔ the recommendation ALONE — the clean review D1 escalates: no waiver is recorded, and the refusal says no open finding is recorded', async () => {
		stageAReview([RECOMMENDATION], 'ESCALATED');
		const review = loadPwaFloor(PWA)?.policies.find((p) => p.policyId === POLICY);
		expect(review?.disposition, 'arrangement: the review was not concluded ESCALATED').toBe(
			'ESCALATED'
		);
		expect(review?.observations.map((o) => o.code)).toEqual(['REVIEWER_RECOMMENDED_ESCALATION']);

		const offered = await theLoadOffersTheForm();
		const result = await recordWaiver();
		expect(result.status, 'a waiver was recorded against the reviewer’s recommendation').toBe(400);
		// ⭐ THE CLAIM (the third fix round's re-verifier's finding [7], ruled): the page does not offer what the action refuses.
		expect(
			offered,
			'the page offers the waiver form beside a review whose only observation is the recommendation, which the action refuses'
		).toBe(false);
		expect(result.data?.error).toBe(
			`Cannot waive ${POLICY}: no open finding is recorded for it, and a waiver must name the finding it waives (DOC-004 §12.2).`
		);
		expect(listDecisions(getEngine(), { kind: 'WORKSPACE' })).toEqual([]);
	});
});

// ⭐⭐ The review in parts, PACKAGE E, E2 (DESIGN-authoring-review-in-parts.md D6; guide §8.15: a waiver records the *"exact
// object and semantic version"*) — A WAIVER OF A PART'S FINDING NAMES THE PART.
//
// ⛔ WHAT WAS WRONG. The PWA's Reasoning Review is the fold of its parts, its observations every part's in export order, so the
// waiver took the FIRST observation across all the parts — a satisfied part's among them — and named the PWA as the waived
// object. ⭑ WHAT MUST HOLD: the first part that blocks and records a finding, that finding, and that part's type at its stored
// semantic version as the waived object; the PWA stays its downstream impact, and the PWA's floor reads the waiver as its own.
describe('⭐⭐ package E, E2 — the waiver names the blocking part: its type at its stored version, and its own finding', () => {
	/** A second type, defined after the first: the export lists it second, so its part comes after the first's. */
	const SECOND = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5W03';

	/** One part's reasoning review, concluded as given, with `observations` in that order. */
	function stagePart(
		typeId: string,
		assessmentId: string,
		observations: readonly (typeof SUBJECT_FINDING)[],
		concludeAs: 'REJECTED' | 'SATISFIED' | 'INCONCLUSIVE'
	): void {
		const version = Number(getObject(getEngine(), typeId)?.semanticVersion ?? 1);
		const subject = { subjectObjectIds: [typeId], subjectSemanticVersions: { [typeId]: version } };
		arrange('RequestAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {
			assessmentId,
			assurancePolicyId: POLICY,
			policyVersion: '1',
			...subject,
			claimIds: []
		});
		arrange('BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {});
		observations.forEach((o, i) =>
			arrange('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', `${assessmentId.replace('assess_', 'obs_').slice(0, -1)}${i}`, {
				assessmentId,
				observationType: 'FINDING',
				...o
			})
		);
		arrange('CompleteAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {
			validatorResult: {
				validatorId: 'staged.reasoning-review',
				validatorVersion: '1',
				policyId: POLICY,
				policyVersion: '1',
				assessmentId,
				...subject,
				claimResults: [],
				evidenceConsideredIds: [],
				evidenceRejected: [],
				observations: observations.map((o) => ({ ...o, subjectObjectIds: [typeId] })),
				dispositionRecommendation: concludeAs,
				recommendedControlActions: [],
				residualUncertainty: [],
				limitations: [],
				executionProvenance: {}
			}
		});
	}

	beforeEach(() => {
		arrange('DefinePwuType', 'PWU_TYPE', SECOND, {
			pwuTypeId: SECOND,
			pwaId: PWA,
			pwuKind: 'BUILD',
			name: 'Build',
			purpose: 'Build the work',
			isRoot: false,
			permittedChildTypeIds: [],
			requiredInputs: [],
			requiredOutputs: [],
			requiredAssurancePolicyIds: []
		});
	});

	it('⛔ RED — a satisfied part’s observation first, a rejected part’s finding second: the waiver names the rejected part, at its stored version, and its finding', async () => {
		stagePart(TYPE, 'assess_01ARZ3NDEKTSV4RRFFQ69G5W20', [INFORMATIONAL_FINDING], 'SATISFIED');
		stagePart(SECOND, 'assess_01ARZ3NDEKTSV4RRFFQ69G5W30', [SUBJECT_FINDING], 'REJECTED');
		const floor = loadPwaFloor(PWA);
		expect(
			floor?.parts?.map((p) => [p.typeId, p.disposition, p.observations.map((o) => o.code)]),
			'arrangement: the satisfied part’s observation is not first in the fold'
		).toEqual([
			[TYPE, 'SATISFIED', ['RR-08']],
			[SECOND, 'REJECTED', ['RR-04']]
		]);

		const offered = await theLoadOffersTheForm();
		const result = await recordWaiver();
		expect(result.data?.error, 'arrangement: the waiver was refused').toBeUndefined();
		expect(offered, 'the page withholds the form beside a part’s finding the action records against').toBe(true);
		const decision = getObject(getEngine(), result.waived!) as
			| {
					readonly subjectObjectIds?: readonly string[];
					readonly subjectSemanticVersions?: Record<string, number>;
					readonly waiver?: {
						readonly waivedPolicyId?: string;
						readonly waivedCriterionId?: string;
						readonly downstreamImpactObjectIds?: readonly string[];
					};
			  }
			| undefined;
		expect(decision?.subjectObjectIds, 'the waiver does not name the blocking part as the waived object').toEqual([SECOND]);
		expect(decision?.subjectSemanticVersions, 'the waived object is not pinned at its stored version').toEqual({
			[SECOND]: getObject(getEngine(), SECOND)?.semanticVersion
		});
		expect(decision?.waiver?.waivedPolicyId).toBe(POLICY);
		expect(decision?.waiver?.waivedCriterionId, 'the waiver named another part’s observation').toBe('RR-04');
		expect(decision?.waiver?.downstreamImpactObjectIds, 'the PWA is not the downstream impact').toEqual([PWA]);
		// ⭐ AND THE PWA'S FLOOR READS IT AS THE PWA'S: the panel's "waiver recorded" badge keys on this.
		expect(loadPwaFloor(PWA)?.waived, 'the PWA’s floor does not read a waiver of its part').toBe(true);
	});

	// ⭐ Package E's check, the MINOR finding — A PART WHOSE REVIEW FAILED OPERATIONALLY IS NOT THE PART A WAIVER NAMES BESIDE ONE
	// THAT RECORDS A FINDING. The failed part blocks too, so the waiver named it, first in export order, and its
	// VALIDATOR_EXECUTION_FAILED as the criterion waived, in the round E1 answers by revising for the other part's finding.
	/** What a review that did not execute records, as `assurance-floor-review-failure-hint.e2e.ts` stages it. */
	const EXECUTION_FAILED = {
		findingCode: 'VALIDATOR_EXECUTION_FAILED',
		severity: 'MATERIAL',
		statement: 'The reviewing tool did not run (staged execution failure).'
	};
	/** The waived object and criterion of the waiver the action recorded. */
	const waivedBy = (decisionId: string) => {
		const decision = getObject(getEngine(), decisionId) as
			| { readonly subjectObjectIds?: readonly string[]; readonly waiver?: { readonly waivedCriterionId?: string } }
			| undefined;
		return [decision?.subjectObjectIds, decision?.waiver?.waivedCriterionId];
	};

	it('⛔ RED — a failed part first, a rejected part second: the waiver names the rejected part and its finding', async () => {
		stagePart(TYPE, 'assess_01ARZ3NDEKTSV4RRFFQ69G5W50', [EXECUTION_FAILED], 'INCONCLUSIVE');
		stagePart(SECOND, 'assess_01ARZ3NDEKTSV4RRFFQ69G5W60', [SUBJECT_FINDING], 'REJECTED');
		const floor = loadPwaFloor(PWA);
		expect(
			floor?.parts?.map((p) => [p.typeId, p.disposition, p.observations.map((o) => o.code)]),
			'arrangement: the failed part is not first in the fold'
		).toEqual([
			[TYPE, 'INCONCLUSIVE', ['VALIDATOR_EXECUTION_FAILED']],
			[SECOND, 'REJECTED', ['RR-04']]
		]);
		expect(floorBlockedHint(floor!), 'arrangement: the round is not answered by revision beside the failed part').toBe(
			'REVISE_BESIDE_FAILED_REVIEWS'
		);

		const offered = await theLoadOffersTheForm();
		const result = await recordWaiver();
		expect(result.data?.error, 'arrangement: the waiver was refused').toBeUndefined();
		expect(offered).toBe(true);
		expect(waivedBy(result.waived!), 'the waiver named the part whose review failed, not the rejected part’s finding').toEqual([
			[SECOND],
			'RR-04'
		]);
	});

	it('⭑ CONTROL — a failed part beside SATISFIED ones: no other part records a finding, and the waiver names the failed part, as before', async () => {
		// The round `assurance-floor-review-failure-hint.e2e.ts` waives through the page's form: the root's review failed, the
		// rest SATISFIED.
		stagePart(TYPE, 'assess_01ARZ3NDEKTSV4RRFFQ69G5W70', [EXECUTION_FAILED], 'INCONCLUSIVE');
		stagePart(SECOND, 'assess_01ARZ3NDEKTSV4RRFFQ69G5W80', [], 'SATISFIED');
		const offered = await theLoadOffersTheForm();
		const result = await recordWaiver();
		expect(result.data?.error, 'the waiver beside a failed review was refused').toBeUndefined();
		expect(offered, 'the page withholds the form beside a failed review').toBe(true);
		expect(waivedBy(result.waived!)).toEqual([[TYPE], 'VALIDATOR_EXECUTION_FAILED']);
	});

	it('⭑ CONTROL — a finding of the PWA’s own policy is waived on the PWA, as before', async () => {
		// The schema/invariant policy, staged REJECTED with a finding: no part is the object.
		const assessmentId = 'assess_01ARZ3NDEKTSV4RRFFQ69G5W40';
		const version = Number(getObject(getEngine(), PWA)?.semanticVersion ?? 1);
		const subject = { subjectObjectIds: [PWA], subjectSemanticVersions: { [PWA]: version } };
		const finding = {
			findingCode: 'PWA_GRAPH_NOT_WELL_FORMED',
			severity: 'BLOCKING',
			statement: 'Deterministic invariant violated: PWA_GRAPH_NOT_WELL_FORMED'
		};
		arrange('RequestAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {
			assessmentId,
			assurancePolicyId: 'floor.schema-invariant',
			policyVersion: '1',
			...subject,
			claimIds: []
		});
		arrange('BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {});
		arrange('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', 'obs_01ARZ3NDEKTSV4RRFFQ69G5W41', {
			assessmentId,
			observationType: 'POLICY_VIOLATION',
			...finding
		});
		arrange('CompleteAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {
			validatorResult: {
				validatorId: 'staged.schema-invariant',
				validatorVersion: '1',
				policyId: 'floor.schema-invariant',
				policyVersion: '1',
				assessmentId,
				...subject,
				claimResults: [],
				evidenceConsideredIds: [],
				evidenceRejected: [],
				observations: [{ ...finding, subjectObjectIds: [PWA] }],
				dispositionRecommendation: 'REJECTED',
				recommendedControlActions: [],
				residualUncertainty: [],
				limitations: [],
				executionProvenance: {}
			}
		});
		const result = await recordWaiver();
		expect(result.data?.error, 'arrangement: the waiver was refused').toBeUndefined();
		const decision = getObject(getEngine(), result.waived!) as
			| { readonly subjectObjectIds?: readonly string[]; readonly waiver?: { readonly waivedPolicyId?: string } }
			| undefined;
		expect([decision?.subjectObjectIds, decision?.waiver?.waivedPolicyId]).toEqual([[PWA], 'floor.schema-invariant']);
	});
});
