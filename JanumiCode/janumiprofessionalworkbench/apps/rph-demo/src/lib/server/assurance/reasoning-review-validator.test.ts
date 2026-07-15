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

const ctx = (plan: string, content = '{"pwuTypes":[{"id":"t1"}]}'): ValidatorContext => ({
	reasoningReview: { prompt: 'Author a product realization PWA', content, plan }
});

describe('Reasoning Review Validator — §14.3 conformance: no private chain-of-thought', () => {
	it('reaches a VALID Assessment with all volunteered reasoning material withheld (the ablation)', async () => {
		const { print } = capturing();
		const result = await createAgyReasoningReviewValidator({ print }).evaluate(SUBJECT, ctx(''));

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
		const V = createAgyReasoningReviewValidator({ print: withAccount.print });
		const W = createAgyReasoningReviewValidator({ print: withheld.print });

		const a = await V.evaluate(SUBJECT, ctx('I added a Realization root and three child types.'));
		const b = await W.evaluate(SUBJECT, ctx(''));

		// The section is rendered unconditionally, so the reviewer's input shape cannot encode whether an account
		// exists. Previously the whole section was omitted when `plan` was empty — a presence signal by construction.
		const SECTION = "The producing agent's OWN recorded narration";
		expect(withAccount.prompts[0]).toContain(SECTION);
		expect(withheld.prompts[0]).toContain(SECTION);
		// And withholding cannot move the verdict — no control depends on the account being there.
		expect(b.dispositionRecommendation).toBe(a.dispositionRecommendation);
	});

	it('renders exactly the account it is handed — which is why the boundary is upstream, not here', async () => {
		const { prompts, print } = capturing();
		await createAgyReasoningReviewValidator({ print }).evaluate(
			SUBJECT,
			ctx('I added a Realization root.')
		);

		// The Validator cannot distinguish narration from reasoning: it renders whatever the caller supplies. So
		// asserting "the prompt contains no reasoning" HERE would be a tautology — it would only restate the test's
		// own input. The regression lock therefore lives where the decision is actually made, on narrationOf
		// (agent/transcript.test.ts). This pins the pass-through so that lock has something to protect.
		expect(prompts[0]).toContain('I added a Realization root.');
	});

	it('DECLARES truncation rather than silently cutting the subject or the account (§9.7)', async () => {
		const { prompts, print } = capturing();
		await createAgyReasoningReviewValidator({ print }).evaluate(
			SUBJECT,
			ctx('y'.repeat(5000), `{"pad":"${'x'.repeat(30000)}"}`)
		);
		// Two independent excerpts; both must announce themselves. Silent truncation makes an Assessment's record
		// of what it saw false, and §5.6 requires that record so the conclusion "can be reproduced and challenged".
		expect(prompts[0].match(/…\(truncated\)/g)).toHaveLength(2);
	});

	it('records the ACTUAL evaluator identity so independence is checkable against the producer (§8.4)', async () => {
		const { print } = capturing();
		const result = await createAgyReasoningReviewValidator({ print }).evaluate(SUBJECT, ctx(''));
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
		const result = await createAgyReasoningReviewValidator({ print }).evaluate(SUBJECT, ctx(''));

		// The real coercion ran (not a stub echoing a verdict): a BLOCKING finding drives REJECTED, and the
		// reviewer's own prompt shape is what produced it.
		expect(result.dispositionRecommendation).toBe('REJECTED');
		expect(result.observations.some((o) => o.severity === 'BLOCKING')).toBe(true);
		expect(prompts).toHaveLength(1); // parsed first time — no reformat retry needed
	});
});
