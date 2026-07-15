// §14.3 minimum conformance scenario — "conformance requires no private chain-of-thought": the Reasoning Review
// reaches a VALID Assessment with all volunteered reasoning material withheld, and its materialized prompt never
// carries the producer's interior.
//
// This is an ABLATION gate, which is the only formulation writable across both model classes: hosted APIs return a
// summary or an empty string and local models emit raw reasoning inline, so a rule of the form "assert the reasoning
// is absent from the response" is unwritable — but "assert the reviewer works without it" is not.
//
// It exercises the REAL Validator path (judgePrompt -> agy -> extractJson -> coerceJudgement ->
// reasoningReviewResultFromJudgement) with ONLY the impure subprocess faked. §14.3 is explicit that the scenario must
// exercise the real Validator "since a stub that ignores the input passes this trivially" — so the fake CAPTURES the
// materialized prompt and every assertion below is made over the prompt SENT and the Assessment's SHAPE. Never over
// model prose: §14.1 requires prompt and agent tests assess "trajectory, tool use, provenance, schema compliance,
// adversarial input, uncertainty handling, and bounded authority—not exact prose". That is also why this cannot rot.
import {
	REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type ProfessionalRationaleSummary,
	type ValidatorContext
} from '@janumipwb/rph-assurance';
import { describe, expect, it } from 'vitest';
import { createAgyReasoningReviewValidator, type AgyPrint } from './reasoning-review-validator.js';

const SUBJECT: AssuranceSubject = {
	subjectId: 'pwa_conformance',
	objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
	semanticVersion: 1,
	isAiProduced: true,
	// A REAL resolved producer — §8.12 checks independence against actual model/provider, never a role label.
	producer: {
		actorType: 'AGENT',
		agentId: 'authoring-agent',
		modelId: 'executor-model',
		providerId: 'executor-provider'
	}
};

const CLEAN = JSON.stringify({ findings: [], recommendation: 'SATISFIED', residualUncertainty: [] });

/** A capturing fake for the impure agy call: records every materialized prompt, replies with a fixed judgement. */
function capturing(reply = CLEAN) {
	const prompts: string[] = [];
	const print: AgyPrint = async (p) => {
		prompts.push(p);
		return reply;
	};
	return { prompts, print };
}

const RATIONALE: ProfessionalRationaleSummary = {
	rationale: 'Product Realization is the root obligation, so it is the root type.',
	assumptions: ['Assumed the catalog blueprints suit this domain.'],
	limitations: ['Only two types are defined.'],
	residualUncertainty: ['Whether Architecture should permit children is unsettled.']
};

const ctx = (
	over: Partial<{ rationale: ProfessionalRationaleSummary; narration: string; content: string }> = {}
): ValidatorContext => ({
	reasoningReview: {
		prompt: 'Author a product realization PWA',
		content: over.content ?? '{"pwuTypes":[{"id":"t1"}]}',
		narration: over.narration ?? '',
		...(over.rationale ? { rationale: over.rationale } : {})
	}
});

describe('Reasoning Review Validator — §14.3 conformance: no private chain-of-thought', () => {
	it('reaches a VALID Assessment with all volunteered reasoning material withheld (the ablation)', async () => {
		const { print } = capturing();
		const result = await createAgyReasoningReviewValidator({ print }).evaluate(
			SUBJECT,
			ctx({ rationale: RATIONALE })
		);

		// Valid means: it ran, every mandatory criterion resolved, and a real disposition was reached — not that
		// it passed. A reviewer that needs the producer's interior to function would degrade here; this one does not.
		expect(result.executionFailed).toBe(false);
		expect(result.dispositionRecommendation).toBe('SATISFIED');
		expect(result.criteria).toHaveLength(REASONING_REVIEW_CRITERIA.length);
		// §8.12: "UNABLE_TO_DETERMINE is never MET". A reviewer degraded by the ablation would land there; this one
		// resolves every criterion, which is what makes the Assessment VALID rather than merely recorded.
		expect(result.criteria.every((c) => c.outcome !== 'UNABLE_TO_DETERMINE')).toBe(true);
	});

	it('never treats the presence or absence of the producer account as a signal (§9.7)', async () => {
		const withAccount = capturing();
		const withheld = capturing();

		const a = await createAgyReasoningReviewValidator({ print: withAccount.print }).evaluate(
			SUBJECT,
			ctx({ rationale: RATIONALE, narration: 'I added a Realization root.' })
		);
		const b = await createAgyReasoningReviewValidator({ print: withheld.print }).evaluate(
			SUBJECT,
			ctx()
		);

		// Both sections render unconditionally, so the reviewer's input shape cannot encode whether an account
		// exists. Previously the whole section vanished when empty — a presence signal by construction.
		for (const p of [withAccount.prompts[0], withheld.prompts[0]]) {
			expect(p).toContain('PROFESSIONAL RATIONALE SUMMARY');
			expect(p).toContain('observable narration');
		}
		// And withholding cannot move the verdict — no control depends on the account being there.
		expect(b.dispositionRecommendation).toBe(a.dispositionRecommendation);
	});

	it('renders the CONTRACTED account and its declared bindings — not scraped narration (§9.7 / §3)', async () => {
		const { prompts, print } = capturing();
		await createAgyReasoningReviewValidator({ print }).evaluate(
			SUBJECT,
			ctx({ rationale: RATIONALE, narration: 'I added a Realization root.' })
		);

		// §3: the summary is "bound to the Evidence used, Assumptions, Claims, limitations, and residual
		// uncertainty it declares" — so the reviewer must actually SEE those bindings, not just the prose.
		expect(prompts[0]).toContain(RATIONALE.rationale);
		expect(prompts[0]).toContain(RATIONALE.assumptions[0]);
		expect(prompts[0]).toContain(RATIONALE.limitations[0]);
		expect(prompts[0]).toContain(RATIONALE.residualUncertainty[0]);
		// Narration is admissible trace data (§8.4) but is a separate, weaker section.
		expect(prompts[0]).toContain('I added a Realization root.');
	});

	it('records a LIMITATION when the producer returned no rationale summary — never infers from silence', async () => {
		const { prompts, print } = capturing();
		const result = await createAgyReasoningReviewValidator({ print }).evaluate(SUBJECT, ctx());

		// §9.7 requires the producer to return an account. It did not. The review still concludes (§8.4: it works
		// without the producer's interior), but §8.9 requires a valid result to identify its limitations — so the
		// shortfall is on the record rather than silently absorbed.
		expect(result.limitations.some((l) => l.includes('no professional rationale summary'))).toBe(true);
		// And the reviewer is told plainly, so it can weigh the omission itself.
		expect(prompts[0]).toContain('NOT DECLARED');

		const declared = capturing();
		const ok = await createAgyReasoningReviewValidator({ print: declared.print }).evaluate(
			SUBJECT,
			ctx({ rationale: RATIONALE })
		);
		expect(ok.limitations.some((l) => l.includes('no professional rationale summary'))).toBe(false);
	});

	it('DECLARES truncation rather than silently cutting the subject or the account (§9.7)', async () => {
		const { prompts, print } = capturing();
		await createAgyReasoningReviewValidator({ print }).evaluate(
			SUBJECT,
			ctx({ narration: 'y'.repeat(5000), content: `{"pad":"${'x'.repeat(30000)}"}` })
		);
		// Two independent excerpts; both must announce themselves. Silent truncation makes an Assessment's record
		// of what it saw false, and §5.6 requires that record so the conclusion "can be reproduced and challenged".
		expect(prompts[0].match(/…\(truncated\)/g)).toHaveLength(2);
	});

	it('records the ACTUAL evaluator identity so independence is checkable against the producer (§8.4)', async () => {
		const { print } = capturing();
		const result = await createAgyReasoningReviewValidator({ print }).evaluate(SUBJECT, ctx());
		// §8.4 requires "actual identities and lineage are recorded". The producer is resolved per run; the
		// evaluator is recorded here. A comparison is only meaningful if both sides are real.
		expect(result.evaluator.agentId).toBe('agy');
		expect(result.evaluator.providerId).toBe('google');
		expect(result.evaluator.providerId).not.toBe(SUBJECT.producer.providerId);
	});

	it('exercises the real parse/repair path — a fenced, prose-wrapped reply still yields a schema-conformant result', async () => {
		const { prompts, print } = capturing(
			'Sure! Here you go:\n```json\n' +
				JSON.stringify({
					findings: [
						{
							criterionId: REASONING_REVIEW_CRITERIA[0].id,
							failed: true,
							statement: 'The root type restates the intent without decomposing it.',
							severity: 'BLOCKING'
						}
					],
					recommendation: 'REJECTED',
					residualUncertainty: []
				}) +
				'\n```'
		);
		const result = await createAgyReasoningReviewValidator({ print }).evaluate(SUBJECT, ctx());

		// The real coercion ran (not a stub echoing a verdict): a BLOCKING finding drives REJECTED, and the
		// reviewer's own prompt shape is what produced it.
		expect(result.dispositionRecommendation).toBe('REJECTED');
		expect(result.observations.some((o) => o.severity === 'BLOCKING')).toBe(true);
		expect(prompts).toHaveLength(1); // parsed first time — no reformat retry needed
	});
});
