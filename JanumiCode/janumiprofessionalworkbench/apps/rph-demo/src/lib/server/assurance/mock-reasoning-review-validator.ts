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
import type { ObservedToolCallReport } from '@janumipwb/rph-contracts';

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

/**
 * ⭐⭐ `JAN-EXEC` PHASE 5 / `R15` — THE OFFLINE ARM FOR A PROCESS RESULT, AND ITS SUBJECT IS NOT THE EXIT CODE.
 *
 * ⛔ THERE IS NO MODEL REASONING IN `exitCode: 0`; THE PRODUCER IS A CHILD PROCESS. So this arm does not grade
 * the command. It performs the ONE check `§22.1` licenses and nothing else can: the agent's account is untrusted
 * external input, the HOST's observation is not, and the review is the JOIN between them.
 *
 * ⭑ THE JOIN IS STRUCTURAL, WHICH IS WHY IT IS DECIDABLE OFFLINE. A process result is under review, so a command
 * ran. If the host WATCHED and completed nothing, the subject's existence and the observation contradict each
 * other — `RR-07-no-contradiction`, verbatim: *"No contradiction with intent, constraints, inputs, or evidence."*
 *
 * ⛔ AND IT DELIBERATELY DOES NOT MATCH TOOL NAMES OR READ THE ACCOUNT'S PROSE. Deciding whether a sentence
 * *claims* a command ran is a predicate over arbitrary text — the normaliser shape this programme has refused in
 * four consecutive rounds. `outcome === 'COMPLETED'` is a fact the host recorded about its own dispatch, and it
 * is the whole of what is compared.
 *
 * ⚠ `NOT_OBSERVABLE` IS INCONCLUSIVE AND NOT A PASS. An adapter that could not look has supplied no independent
 * half, so the only check this arm performs could not be performed. `unreadable()` already carries the rule this
 * file records: a Validator that could not read its subject has not reviewed it.
 */
function judgeProcessResult(
	content: string,
	observed: ObservedToolCallReport | undefined
): ReasoningReviewJudgement {
	if (!observed || observed.observation === 'NOT_OBSERVABLE')
		return unreadable(
			observed?.reason
				? `the host was not in a position to observe tool calls (${observed.reason}), so the agent’s account could not be checked against what actually ran`
				: 'the host reported nothing about tool calls, so the agent’s account could not be checked against what actually ran'
		);

	const findings: ReasoningReviewFinding[] = [];

	// ⭑ A RESULT THAT SAYS NOTHING, mirroring the work-product arm. A command result with no content conceals
	// whether anything was run just as surely as an empty work product conceals whether work was done.
	if (content.trim() === '')
		findings.push({
			criterionId: 'RR-04-no-proxy-satisfaction',
			failed: true,
			statement:
				'The command result carries no content at all: nothing is recorded that could be reviewed, so a passing verdict would rest on the result’s existence rather than on anything it says.',
			severity: 'BLOCKING'
		});

	// ⛔ THE JOIN. `NONE_OBSERVED` means the host WATCHED and saw nothing — it is not an absence of observation,
	// and `R11` minted the discriminator so those two could never be confused here.
	const completed = (observed.calls ?? []).filter((c) => c.outcome === 'COMPLETED').length;
	if (observed.observation === 'NONE_OBSERVED' || completed === 0)
		findings.push({
			criterionId: 'RR-07-no-contradiction',
			failed: true,
			statement:
				observed.observation === 'NONE_OBSERVED'
					? 'A command result is under review, yet the host watched this turn and observed NO tool calls at all. The result and the host’s own observation contradict each other.'
					: `A command result is under review, yet of the ${(observed.calls ?? []).length} tool call(s) the host observed, NONE completed. Nothing the host watched could have produced this result.`,
			severity: 'BLOCKING'
		});

	if (findings.length > 0) return { findings, recommendation: 'REJECTED' };

	return {
		findings: [],
		recommendation: 'SATISFIED',
		// ⚠ THE LIMITATION IS WHAT KEEPS THE WORD HONEST, exactly as in the work-product arm. Without it a
		// two-limb structural join is recorded as a passed REASONING review over a build.
		limitations: [
			`This review checked the JOIN only — that a command result exists and that the host observed ${completed} tool call(s) complete this turn, so the result and the observation do not contradict each other. It did NOT read the command’s output, did NOT judge whether the right command was run, and did NOT assess whether the agent’s account of why it ran is sound. A semantic review requires the configured reviewer model.`
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
			// ⭑ ONE VALIDATOR, THREE ARMS — not three registered validators. The POLICY is the same policy, and
			// `ASR-4` holds that "policy meaning is stable across validator replacement": what changes with the
			// subject is how the review is conducted, never what the policy means.
			//
			// ⛔ THE SELECTOR USED TO BE `subject.objectType === 'ARTIFACT'`, AND ITS FALSE ARM WAS THE GRAPH — so
			// every subject kind that was neither took the graph arm SILENTLY, which for a process result meant a
			// guaranteed INCONCLUSIVE and a permanently blocked step. `R14`: the CALLER declares the framing, and
			// this switch is exhaustive, so a fourth kind is a type error here rather than a misdescription there.
			const judgement = ((): ReasoningReviewJudgement => {
				switch (input.framing) {
					case 'WORK_PRODUCT':
						return judgeWorkProduct(input.content, input.prompt);
					case 'PROCESS_RESULT':
						return judgeProcessResult(input.content, input.observedToolCalls);
					case 'PWA_GRAPH':
						return judge(input.content);
					default: {
						const _never: never = input.framing;
						throw new Error(`Unknown review framing: ${String(_never)}`);
					}
				}
			})();
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
