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
import { loadPwaFloor } from './floor.js';
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
