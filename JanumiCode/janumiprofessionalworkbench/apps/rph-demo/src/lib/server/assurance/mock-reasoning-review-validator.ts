// Deterministic, offline Reasoning-Review Validator for TEST_MODE. It derives its judgement from the Layer-A
// structural report over the subject's graph export, so the floor RUNS reproducibly in the gate (a well-formed graph
// passes; an invalid one is REJECTED; an UNREADABLE one is INCONCLUSIVE and therefore BLOCKS; dead-end outputs are a
// MATERIAL proxy-satisfaction finding). It is honest about
// its limits — it judges STRUCTURE, not deep semantics (that is what the agy Validator provides in dev/prod).
import { analyzePwaGraph, type PwaGraphExport } from '@janumipwb/rph-projections';
import {
	FLOOR_POLICY_IDS,
	reasoningReviewResultFromJudgement,
	type Identity,
	type ReasoningReviewFinding,
	type ReasoningReviewJudgement,
	type Validator
} from '@janumipwb/rph-assurance';

const EVALUATOR: Identity = {
	actorType: 'AGENT',
	agentId: 'mock-judge',
	modelId: 'mock-reasoning-review',
	providerId: 'jpwb'
};

/**
 * FAIL CLOSED on a subject this Validator could not read.
 *
 * ⚠ BOTH ARMS BELOW USED TO RETURN `SATISFIED` WITH ZERO FINDINGS — a control that cannot fail, sitting inside
 * the assurance floor, on the one Validator path the gate can run. Every e2e that "proved" the floor blocks was
 * proving less than it appeared.
 *
 * INCONCLUSIVE is the correct disposition and it BLOCKS: `floor.ts` records that INCONCLUSIVE "leaves assurance
 * incomplete → blocks", and `assurance-rules.ts` that an undeterminable mandatory criterion is "INCONCLUSIVE
 * (never a pass)". A Validator that could not read its subject has not reviewed it — that is neither a pass nor
 * a rejection of the subject.
 *
 * The reason is carried in `limitations` rather than as a finding, because inventing a criterion id for
 * "unparseable" would attribute the failure to a policy criterion that says nothing about parsing. §8.9 requires
 * a valid result to identify its "residual uncertainty, limitations"; this is what that field is for, and it is
 * how PER-9's E-5 (the parse outcome) reaches the record through a ratified field instead of a fabricated one.
 */
function unreadable(why: string): ReasoningReviewJudgement {
	return {
		findings: [],
		recommendation: 'INCONCLUSIVE',
		limitations: [
			`The Reasoning Review did not run: ${why}. No structural review was performed, so no criterion was evaluated and no conclusion about the subject may be drawn from this result.`
		]
	};
}

function judge(content: string): ReasoningReviewJudgement {
	let ex: PwaGraphExport | undefined;
	try {
		ex = JSON.parse(content) as PwaGraphExport;
	} catch (e) {
		return unreadable(`the subject is not parseable as JSON (${e instanceof Error ? e.message : String(e)})`);
	}
	// `{ nodes: [] }` is a legitimately EMPTY graph and stays reviewable — `[]` is truthy. This arm fires only
	// when `nodes` is absent altogether, which means the payload is not a PWA graph export at all.
	if (!ex?.nodes)
		return unreadable('the subject parsed but carries no `nodes`, so it is not a PWA graph export');
	const report = analyzePwaGraph(ex);
	const findings: ReasoningReviewFinding[] = [];
	if (!report.valid)
		findings.push({
			criterionId: 'RR-09-no-completeness-from-existence',
			failed: true,
			statement: 'The graph is not well-formed; completeness cannot be claimed from its existence.',
			severity: 'BLOCKING'
		});
	if (report.metrics.unusedOutputs > 0)
		findings.push({
			criterionId: 'RR-04-no-proxy-satisfaction',
			failed: true,
			statement: `${report.metrics.unusedOutputs} produced output(s) feed no consumer (dead-end).`,
			severity: 'MATERIAL'
		});
	let recommendation: ReasoningReviewJudgement['recommendation'] = 'SATISFIED';
	if (!report.valid) recommendation = 'REJECTED';
	else if (findings.length > 0) recommendation = 'CONDITIONALLY_SATISFIED';
	return { findings, recommendation };
}

/** Every string leaf in a parsed work product, so "it said nothing" and "it echoed the prompt" are decidable. */
function stringLeaves(value: unknown, out: string[] = []): string[] {
	if (typeof value === 'string') {
		if (value.trim() !== '') out.push(value.trim());
	} else if (Array.isArray(value)) value.forEach((v) => stringLeaves(v, out));
	else if (value && typeof value === 'object')
		Object.values(value as Record<string, unknown>).forEach((v) => stringLeaves(v, out));
	return out;
}

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * JAN-WPREVIEW — the offline arm for a WORK PRODUCT, mirroring the graph arm above.
 *
 * ⛔ THE SHORTCUT THIS FUNCTION MUST NOT TAKE IS NAMED IN `REG-F-355`'s OWN E2E: *"teach the offline reviewer
 * to pass any parseable work product, at which point 'assured' would mean a JSON parse."* That is not
 * hypothetical — this file's `unreadable()` docblock records that both of ITS arms once returned SATISFIED
 * with zero findings, "a control that cannot fail, sitting inside the assurance floor".
 *
 * ⭑ SO IT PERFORMS REAL CHECKS AND RECORDS WHAT IT DID NOT CHECK. The two criterion ids below are READ FROM
 * THE POLICY and their wording fits; inventing one would attribute a failure to a criterion that says nothing
 * about the thing, which is what `unreadable()` already refuses to do for parsing.
 */
function judgeWorkProduct(content: string, prompt: string): ReasoningReviewJudgement {
	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch (e) {
		return unreadable(
			`the work product is not parseable as JSON (${e instanceof Error ? e.message : String(e)})`
		);
	}

	const leaves = stringLeaves(parsed);
	const findings: ReasoningReviewFinding[] = [];

	if (leaves.length === 0)
		findings.push({
			criterionId: 'RR-04-no-proxy-satisfaction',
			failed: true,
			// The criterion's own words: "No proxy or surface satisfaction that conceals the underlying
			// problem." Something was produced and nothing was said — surface satisfaction exactly.
			statement:
				'The work product carries no content: it parses, and says nothing. A produced artifact that states nothing conceals whether the work was done.',
			severity: 'BLOCKING'
		});
	else {
		// ⭑ EVERY value must echo, not ANY. The demo's own deterministic fixture returns one value that quotes
		// the prompt and one that does not; an ANY rule would flag it, and that defect would be discovered by
		// breaking the demo rather than by reasoning about the rule.
		const haystack = norm(prompt);
		if (leaves.every((v) => haystack.includes(norm(v))))
			findings.push({
				criterionId: 'RR-01-no-problem-substitution',
				failed: true,
				// "The result genuinely discharges its delegated obligation rather than substituting an easier
				// problem." Restating the question instead of answering it IS the substitution.
				statement:
					'Every element of the work product restates its own prompt, so nothing was produced that the instruction did not already contain.',
				severity: 'BLOCKING'
			});
	}

	if (findings.length > 0) return { findings, recommendation: 'REJECTED' };

	return {
		findings: [],
		recommendation: 'SATISFIED',
		// ⚠ THE LIMITATION IS NOT DECORATION — IT IS WHAT KEEPS THE WORD HONEST. Without it a shape check is
		// recorded as a passed REASONING review. ASR-11 requires a valid result to identify its limitations,
		// and this is the one that matters: nothing here assessed whether the work is any good.
		limitations: [
			'This review judged STRUCTURE only — that the work product parses, carries content, and is not a restatement of its own prompt. It did not assess professional quality, correctness, or whether the delegated obligation was genuinely discharged. A semantic review requires the configured reviewer model.'
		]
	};
}

export function createMockReasoningReviewValidator(): Validator {
	return {
		policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
		validatorId: 'mock.reasoning-review',
		evaluate: (subject, ctx) => {
			const input = ctx.reasoningReview;
			// Fail-closed, and NOT `?? REASONING_REVIEW_CRITERIA`: the mock scores against the POLICY's criteria
			// like the real Validator does, so the E2E exercises the store->runtime content path rather than a
			// path that only the production adapter takes. A mock that quietly kept the constant would make the
			// whole increment untested end-to-end (§13.3: fail closed on missing policy).
			if (!input) throw new Error('reasoning-review context is missing');
			// ⭑ ONE VALIDATOR, TWO ARMS — not a second registered validator. The POLICY is the same policy, and
			// `ASR-4` holds that "policy meaning is stable across validator replacement": what changes with the
			// subject is how the review is conducted, never what the policy means.
			const judgement =
				subject.objectType === 'ARTIFACT'
					? judgeWorkProduct(input.content, input.prompt)
					: judge(input.content);
			return Promise.resolve(
				reasoningReviewResultFromJudgement(
					subject,
					EVALUATOR,
					'mock.reasoning-review',
					judgement,
					input.criteria
				)
			);
		}
	};
}
