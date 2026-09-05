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
	SEEDED_REASONING_REVIEW_CRITERIA,
	REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type ProfessionalRationaleSummary,
	type ValidatorContext
} from '@janumipwb/rph-assurance';
import { describe, expect, it } from 'vitest';
import { MAX_AGY_PROMPT_CHARS } from './agy-cli.js';
import { createAgyReasoningReviewValidator, type AgyPrint } from './reasoning-review-validator.js';
import { createExchangeSink } from './exchange-capture.js';
import type { ArtifactStore } from '@janumipwb/rph-ports';

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

const JUDGE = 'gemini-judge-3';

const CLEAN = JSON.stringify({
	findings: [],
	recommendation: 'SATISFIED',
	residualUncertainty: []
});

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
	over: Partial<{
		rationale: ProfessionalRationaleSummary;
		narration: string;
		content: string;
	}> = {}
): ValidatorContext => ({
	reasoningReview: {
		// The policy's criteria AS SEEDED — what the store holds, which is what the composition root reads and
		// threads in. Not the `REASONING_REVIEW_CRITERIA` constant: the rubric and the score are the POLICY's now.
		criteria: SEEDED_REASONING_REVIEW_CRITERIA,
		prompt: 'Author a product realization PWA',
		content: over.content ?? '{"pwuTypes":[{"id":"t1"}]}',
		narration: over.narration ?? '',
		...(over.rationale ? { rationale: over.rationale } : {})
	}
});

/** A store whose FIRST put rejects and whose later puts succeed. The once-only failure is what exposes the
 *  defect: an always-failing store throws from the catch block's own capture before the repair is reached, so
 *  the spurious second model call never happens and the bug stays invisible. */
function failOncePut() {
	let calls = 0;
	const store = {
		async put() {
			calls += 1;
			if (calls === 1) throw new Error('content store unavailable');
			return { storageProvider: 'x', storageKey: 'k', contentHash: 'sha256:0', byteSize: 1 };
		},
		async get() {
			return undefined;
		},
		async stat() {
			return undefined;
		},
		async purge() {
			return { purged: false as const, refusedBecause: 'n/a' };
		}
	};
	return { store: store as unknown as ArtifactStore };
}

describe('Reasoning Review Validator — a CONTENT STORE failure is not a malformed model response', () => {
	it('does not re-prompt the model, and does not label a well-formed answer repair-requested', async () => {
		const { prompts, print } = capturing();
		const { store } = failOncePut();
		const exchanges = createExchangeSink();

		// THE DEFECT: `capture(...)` sat INSIDE the same `try` as `JSON.parse`, under a bare `catch`. The model's
		// answer parsed cleanly and the judgement was already computed — then the store threw, the bare catch
		// swallowed it as if the BLOB were bad, the good judgement was discarded, a second paid model call was
		// issued, and the exchange was recorded as `repair-requested`. After that, `repair-requested` no longer
		// means "the model returned something unusable", which is the one thing that disposition is for.
		await expect(
			createAgyReasoningReviewValidator({ print, modelId: JUDGE, artifacts: store, exchanges }).evaluate(
				SUBJECT,
				ctx()
			)
		).rejects.toThrow(/content store unavailable/);

		// EXACTLY ONE model call. The repair prompt is a second billed invocation provoked by an infrastructure
		// fault that has nothing to do with the model.
		expect(prompts).toHaveLength(1);
		// And no record may claim the model was asked to repair anything.
		expect(exchanges.drain().some((e) => e.disposition === 'repair-requested')).toBe(false);
	});

	it('CONTROL — a genuinely malformed answer DOES still trigger exactly one repair', async () => {
		// Without this the fix could not be told apart from "never repair". The repair path is the reason the
		// try/catch exists; narrowing it must not disable it.
		let n = 0;
		const print: AgyPrint = async (p) => {
			prompts.push(p);
			n += 1;
			return n === 1 ? 'not json at all' : CLEAN;
		};
		const prompts: string[] = [];
		const exchanges = createExchangeSink();

		const result = await createAgyReasoningReviewValidator({
			print,
			modelId: JUDGE,
			exchanges
		}).evaluate(SUBJECT, ctx());

		expect(result.executionFailed).toBe(false);
		expect(prompts).toHaveLength(2);
		expect(exchanges.drain().some((e) => e.disposition === 'repair-requested')).toBe(true);
	});
});

describe('Reasoning Review Validator — §14.3 conformance: no private chain-of-thought', () => {
	it('reaches a VALID Assessment with all volunteered reasoning material withheld (the ablation)', async () => {
		const { print } = capturing();
		const result = await createAgyReasoningReviewValidator({ print, modelId: JUDGE }).evaluate(
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

		const a = await createAgyReasoningReviewValidator({
			print: withAccount.print,
			modelId: JUDGE
		}).evaluate(SUBJECT, ctx({ rationale: RATIONALE, narration: 'I added a Realization root.' }));
		const b = await createAgyReasoningReviewValidator({
			print: withheld.print,
			modelId: JUDGE
		}).evaluate(SUBJECT, ctx());

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
		await createAgyReasoningReviewValidator({ print, modelId: JUDGE }).evaluate(
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
		const result = await createAgyReasoningReviewValidator({ print, modelId: JUDGE }).evaluate(
			SUBJECT,
			ctx()
		);

		// §9.7 requires the producer to return an account. It did not. The review still concludes (§8.4: it works
		// without the producer's interior), but §8.9 requires a valid result to identify its limitations — so the
		// shortfall is on the record rather than silently absorbed.
		expect(result.limitations.some((l) => l.includes('no professional rationale summary'))).toBe(
			true
		);
		// And the reviewer is told plainly, so it can weigh the omission itself.
		expect(prompts[0]).toContain('NOT DECLARED');

		const declared = capturing();
		const ok = await createAgyReasoningReviewValidator({
			print: declared.print,
			modelId: JUDGE
		}).evaluate(SUBJECT, ctx({ rationale: RATIONALE }));
		expect(ok.limitations.some((l) => l.includes('no professional rationale summary'))).toBe(false);
	});

	it('budgets the WHOLE prompt under agy\'s command-line ceiling on a huge graph (the ENAMETOOLONG fix)', async () => {
		const { prompts, print } = capturing();
		const result = await createAgyReasoningReviewValidator({ print, modelId: JUDGE }).evaluate(
			SUBJECT,
			ctx({
				rationale: RATIONALE,
				narration: 'n'.repeat(50_000),
				content: `{"pad":"${'x'.repeat(200_000)}"}`
			})
		);
		// The assembled prompt stays under the argv ceiling, so agyPrint can never reach `spawn ENAMETOOLONG`...
		expect(prompts[0].length).toBeLessThanOrEqual(MAX_AGY_PROMPT_CHARS);
		// ...the oversized graph content is truncated (declared, §9.7)...
		expect(prompts[0]).toContain('…(truncated)');
		// ...and the review still reaches a real disposition rather than failing on the payload size.
		expect(result.executionFailed).toBe(false);
	});

	it('DECLARES truncation rather than silently cutting the subject or the account (§9.7)', async () => {
		const { prompts, print } = capturing();
		await createAgyReasoningReviewValidator({ print, modelId: JUDGE }).evaluate(
			SUBJECT,
			ctx({ narration: 'y'.repeat(5000), content: `{"pad":"${'x'.repeat(30000)}"}` })
		);
		// Two independent excerpts; both must announce themselves. Silent truncation makes an Assessment's record
		// of what it saw false, and §5.6 requires that record so the conclusion "can be reproduced and challenged".
		expect(prompts[0].match(/…\(truncated\)/g)).toHaveLength(2);
	});

	it('records the ACTUAL evaluator identity so independence is checkable against the producer (§8.4)', async () => {
		const { print } = capturing();
		const result = await createAgyReasoningReviewValidator({ print, modelId: JUDGE }).evaluate(
			SUBJECT,
			ctx()
		);
		// §8.4 requires "actual identities and lineage are recorded". The producer is resolved per run; the
		// evaluator is recorded here. A comparison is only meaningful if both sides are real.
		expect(result.evaluator.agentId).toBe('agy');
		expect(result.evaluator.providerId).toBe('google');
		// The recorded model is the model that ACTUALLY judged. It was the literal 'agy:default' — not the name of
		// any model — so the floor's DIFFERENT_MODEL comparison was a real id against a placeholder and could never
		// report sameness, which is the common-mode failure §8.8 names.
		expect(result.evaluator.modelId).toBe(JUDGE);
		expect(result.evaluator.modelId).not.toBe('agy:default');
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
		const result = await createAgyReasoningReviewValidator({ print, modelId: JUDGE }).evaluate(
			SUBJECT,
			ctx()
		);

		// The real coercion ran (not a stub echoing a verdict): a BLOCKING finding drives REJECTED, and the
		// reviewer's own prompt shape is what produced it.
		expect(result.dispositionRecommendation).toBe('REJECTED');
		expect(result.observations.some((o) => o.severity === 'BLOCKING')).toBe(true);
		expect(prompts).toHaveLength(1); // parsed first time — no reformat retry needed
	});
});

describe('JAN-TOOLSUITE TS-06 — the SEAM sanitises, not just the adapters', () => {
	// ⛔ THE HOLE THIS CLOSES WAS REAL AND UNGUARDED. `agyPrint` and `devinPrint` each scrub their own failures,
	// so the guarantee held only for the two adapters that remembered to. The Validator wrapped its `print(...)`
	// call in NOTHING, so ANY injected backend's raw rejection reached the floor runner and was written verbatim
	// into a `VALIDATOR_EXECUTION_FAILED` observation `statement` — dispatched and PROJECTED. That is finding
	// #60 reachable through a different door.

	it('⛔ a backing tool that throws WITH the prompt in its message does not leak it', async () => {
		// THE MUTANT: remove the try/catch around `print(p)`. The materialized judge prompt — graph export,
		// rubric, the producer's declared rationale and narration — then lands in a permanent projected record.
		let sent = '';
		const leaky: AgyPrint = async (p: string) => {
			sent = p;
			throw new Error(`Command failed: agy --print ${p} --model X`);
		};
		await expect(
			createAgyReasoningReviewValidator({ print: leaky, modelId: JUDGE }).evaluate(SUBJECT, ctx())
		).rejects.toThrow(/WITHHELD from the record plane/);

		// ⭑ AND THE ASSERTION THAT ACTUALLY MATTERS: the prompt's own bytes are absent from what propagates.
		// Asserting only the word "WITHHELD" would pass on a message that ALSO carried the prompt.
		expect(sent.length).toBeGreaterThan(200);
		const caught = await createAgyReasoningReviewValidator({ print: leaky, modelId: JUDGE })
			.evaluate(SUBJECT, ctx())
			.then(() => '', (e: unknown) => (e instanceof Error ? e.message : String(e)));
		expect(caught).not.toContain(sent.slice(0, 120));
		expect(caught).not.toContain(sent.slice(-120));
	});

	it('⭑ CONTROL — a CLEAN diagnostic survives, so the fix does not destroy what it exists to save', async () => {
		// Without this, "withhold everything" passes the test above — and that would repeat agy's disclosed loss
		// for no reason. `REG-F-333` records that the diagnostic's lawful home is the exchange record's E-5 and
		// that losing it was accepted only because there was no alternative.
		const clean: AgyPrint = async () => {
			throw new Error('devin exited with code 2: model not available for this account');
		};
		const caught = await createAgyReasoningReviewValidator({ print: clean, modelId: JUDGE })
			.evaluate(SUBJECT, ctx())
			.then(() => '', (e: unknown) => (e instanceof Error ? e.message : String(e)));
		expect(caught).toContain('model not available for this account');
		expect(caught).not.toMatch(/WITHHELD/);
	});
});

describe('JAN-LIVEEXEC LE-02 — the reviewer is told what it is actually looking at', () => {
	// ⛔ THE PROMPT USED TO TELL EVERY REVIEWER IT WAS READING *"a canonical graph export / serialized subject"* —
	// true of a PWA, FALSE of a work product, which became a subject in `REG-F-355`. A reviewer handed a route
	// assessment and told it is reading a graph export has been MISDESCRIBED TO, and a review conducted on a
	// false account of its own subject is worse than no review, because it is RECORDED as one.

	const ARTIFACT: AssuranceSubject = { ...SUBJECT, objectType: 'ARTIFACT' };

	async function promptFor(subject: AssuranceSubject): Promise<string> {
		let seen = '';
		const capture: AgyPrint = async (p: string) => {
			seen = p;
			return CLEAN;
		};
		await createAgyReasoningReviewValidator({ print: capture, modelId: JUDGE }).evaluate(subject, ctx());
		return seen;
	}

	it('⭑ an ARTIFACT subject is described as a WORK PRODUCT, never as a graph export', async () => {
		// THE MUTANT: keep one framing for both. The reviewer is then told a work product is a canonical graph
		// export, and its judgement is made against a description of something else.
		const p = await promptFor(ARTIFACT);
		expect(p).toMatch(/WORK PRODUCT/);
		expect(p, 'a work product is not a graph export').not.toMatch(/canonical graph export/);
	});

	it('⭑ CONTROL — a PWA subject KEEPS the graph framing, so this is routing and not replacement', async () => {
		// Without this, "describe everything as a work product" passes the test above — and the authoring
		// floor's reviewer would silently be told it is reading something it is not.
		const p = await promptFor(SUBJECT);
		expect(p).toMatch(/canonical graph export/);
		expect(p).not.toMatch(/WORK PRODUCT/);
	});

	it('⚠ BOTH framings still render rationale and narration — §9.7: absence is never a signal', async () => {
		// An executing model declares no rationale, so these sections render "(none recorded)". THE MUTANT: drop
		// them for work products. The reviewer's INPUT SHAPE would then encode whether the producer said
		// anything, which is exactly what §9.7 forbids the reviewer from being able to see.
		for (const s of [ARTIFACT, SUBJECT]) {
			const p = await promptFor(s);
			expect(p).toMatch(/PROFESSIONAL RATIONALE SUMMARY/);
			expect(p).toMatch(/observable narration/);
		}
	});

	it('⭑ and the rubric ids come from the POLICY in both framings, not from a second rubric', async () => {
		// `ASR-4`: policy meaning is stable across validator replacement — what varies with the subject is how
		// the review is CONDUCTED, never what the policy means. THE MUTANT: invent a work-product rubric here.
		// `coerceJudgement` would then drop every finding as unrecognised, and the review would silently pass.
		const first = SEEDED_REASONING_REVIEW_CRITERIA[0]!.id;
		for (const s of [ARTIFACT, SUBJECT]) expect(await promptFor(s)).toContain(first);
	});
});
