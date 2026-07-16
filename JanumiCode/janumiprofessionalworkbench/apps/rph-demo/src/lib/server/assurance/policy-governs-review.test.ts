// THE DIVERGENCE DETECTOR — is the seeded ASSURANCE_POLICY object load-bearing, or a projection of the code?
//
// This is the acceptance test for the store→runtime content path, and the template for every future "is this
// governed object actually read?" question. The finding it exists to close:
//
//   JPWB's governed layer was a PROJECTION of the code rather than its source. The Reasoning Review rubric and
//   the scored criterion set BOTH keyed off the `REASONING_REVIEW_CRITERIA` constant in rph-assurance, so the
//   seeded policy object was written once at seed time and never read again. Editing it would have changed the
//   UI card and nothing in the evaluation — "a policy that lies about what it checks".
//
// The test is written so it CANNOT pass by accident: it drives the REAL Validator with a policy whose criteria
// are deliberately DIFFERENT from the constant, and asserts the policy won on both halves. Under the old code
// every assertion here fails, because the constant would have won both.
import {
	REASONING_REVIEW_CRITERIA,
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type ValidatorContext
} from '@janumipwb/rph-assurance';
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import { createAgyReasoningReviewValidator, type AgyPrint } from './reasoning-review-validator.js';

const SUBJECT: AssuranceSubject = {
	subjectId: 'pwa_governs',
	objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
	semanticVersion: 1,
	isAiProduced: true,
	producer: {
		actorType: 'AGENT',
		agentId: 'authoring-agent',
		modelId: 'executor-model',
		providerId: 'executor-provider'
	}
};

/** A criterion that exists in NO constant — the whole point. If the rubric mentions it, the policy was read. */
const REVISED: AssessmentCriterion = {
	id: 'RR-99-tenant-isolation',
	name: 'Tenant isolation',
	description: 'The result does not leak data across tenant boundaries.',
	criterionType: 'BOOLEAN',
	evaluationMethod: 'MODEL_JUDGMENT',
	requiredEvidenceIds: [],
	severityIfNotMet: 'BLOCKING',
	mayBeNotApplicable: false
};

function capturing(reply: string) {
	const prompts: string[] = [];
	const print: AgyPrint = async (p) => {
		prompts.push(p);
		return reply;
	};
	return { prompts, print };
}

const ctx = (criteria: readonly AssessmentCriterion[]): ValidatorContext => ({
	reasoningReview: {
		criteria,
		prompt: 'Author a product realization PWA',
		content: '{"pwuTypes":[{"id":"t1"}]}',
		narration: ''
	}
});

const CLEAN = JSON.stringify({ findings: [], recommendation: 'SATISFIED' });

describe('the POLICY governs the Reasoning Review — the seeded object is load-bearing, not a projection', () => {
	it('a criterion that exists ONLY in the policy reaches the RUBRIC the reviewer is asked to judge', async () => {
		const { prompts, print } = capturing(CLEAN);
		await createAgyReasoningReviewValidator({ print, modelId: 'judge' }).evaluate(
			SUBJECT,
			ctx([REVISED])
		);
		// Under the old code the rubric was REASONING_REVIEW_CRITERIA.map(...) and this id could never appear.
		expect(prompts[0]).toContain('RR-99-tenant-isolation');
		expect(prompts[0]).toContain('The result does not leak data across tenant boundaries.');
	});

	it('a criterion REMOVED from the policy disappears from the rubric — the constant does not smuggle it back', async () => {
		const { prompts, print } = capturing(CLEAN);
		await createAgyReasoningReviewValidator({ print, modelId: 'judge' }).evaluate(
			SUBJECT,
			ctx([REVISED])
		);
		// Every constant criterion is absent, because the policy no longer declares them. This is the half that
		// catches a fallback: `input.criteria ?? REASONING_REVIEW_CRITERIA` would fail right here.
		for (const c of REASONING_REVIEW_CRITERIA) {
			expect(prompts[0], `${c.id} must not survive its removal from the policy`).not.toContain(
				c.id
			);
		}
	});

	it('the policy also governs the SCORED criterion set — not just the prompt', async () => {
		const { print } = capturing(CLEAN);
		const result = await createAgyReasoningReviewValidator({ print, modelId: 'judge' }).evaluate(
			SUBJECT,
			ctx([REVISED])
		);
		// The other half of the projection. A rubric that asks about one set while the result reports another is
		// exactly the divergence this increment exists to make impossible.
		expect(result.criteria).toHaveLength(1);
		expect(result.criteria[0]!.criterionId).toBe('RR-99-tenant-isolation');
	});

	it('a finding against a policy criterion is ADMITTED — the id whitelist follows the policy too', async () => {
		const judged = JSON.stringify({
			findings: [
				{
					criterionId: 'RR-99-tenant-isolation',
					failed: true,
					statement: 'Cross-tenant read observed.',
					severity: 'BLOCKING'
				}
			],
			recommendation: 'REJECTED'
		});
		const { print } = capturing(judged);
		const result = await createAgyReasoningReviewValidator({ print, modelId: 'judge' }).evaluate(
			SUBJECT,
			ctx([REVISED])
		);
		// The whitelist was a module-level Set built from the constant, so this finding would have been silently
		// DROPPED and the criterion scored MET — a policy failure reported as a pass.
		expect(result.criteria[0]!.outcome).toBe('NOT_MET');
		expect(result.observations.some((o) => o.code === 'RR-99-tenant-isolation')).toBe(true);
	});

	it("a criterion's ratified severity decides whether it BLOCKS — `mandatory` is derived, not hardcoded true", async () => {
		// DOC-004 §7's severityIfNotMet is the ratified answer; `mandatory: true` was hardcoded for every
		// criterion, which was right only because every floor criterion happens to be BLOCKING. An ADVISORY
		// criterion must NOT block — and nothing tested that, because none existed.
		const advisory: AssessmentCriterion = { ...REVISED, severityIfNotMet: 'ADVISORY' };
		const { print } = capturing(CLEAN);
		const result = await createAgyReasoningReviewValidator({ print, modelId: 'judge' }).evaluate(
			SUBJECT,
			ctx([advisory])
		);
		expect(result.criteria[0]!.mandatory).toBe(false);

		const blocking = capturing(CLEAN);
		const r2 = await createAgyReasoningReviewValidator({
			print: blocking.print,
			modelId: 'judge'
		}).evaluate(SUBJECT, ctx([REVISED]));
		expect(r2.criteria[0]!.mandatory).toBe(true);
	});

	it('the seeded criteria still drive the review unchanged — the seed IS the policy until revised', async () => {
		const { prompts, print } = capturing(CLEAN);
		const result = await createAgyReasoningReviewValidator({ print, modelId: 'judge' }).evaluate(
			SUBJECT,
			ctx(SEEDED_REASONING_REVIEW_CRITERIA)
		);
		// Nothing about making the policy load-bearing changes what the floor checks TODAY: the seed is the
		// policy's content until someone revises it. Behaviour preserved; the source of truth moved.
		expect(result.criteria).toHaveLength(REASONING_REVIEW_CRITERIA.length);
		for (const c of REASONING_REVIEW_CRITERIA) expect(prompts[0]).toContain(c.id);
	});
});
