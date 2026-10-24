// Deterministic, offline Reasoning-Review Validator for TEST_MODE. It derives its judgement from the Layer-A
// structural report over the subject's graph export, so the floor RUNS reproducibly in the gate (a well-formed graph
// passes; an invalid one is REJECTED; an UNREADABLE one is INCONCLUSIVE and therefore BLOCKS; dead-end outputs are a
// MATERIAL proxy-satisfaction finding). It is honest about
// its limits — it judges STRUCTURE, not deep semantics (that is what ~~the agy Validator provides in dev/prod~~ the
// model-backed reviewer `reviewer-selection.ts` selects provides outside test mode — `JAN-SELREV` SR-3).
import { analyzePwaGraph, type PwaGraphExport } from '@janumipwb/rph-projections';
import {
	FLOOR_POLICY_IDS,
	reasoningReviewResultFromJudgement,
	type Identity,
	type ReasoningReviewFinding,
	type ReasoningReviewInput,
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
	// ⭐ TWO OF NINE, DECLARED. `report.valid` is the RR-09 check and `unusedOutputs` is the RR-04 check; this
	// arm examines nothing else, and now says so rather than letting seven silences read as passes.
	return {
		findings: [...findings, ...alsoEvaluated(GRAPH_ARM_EVALUATES, findings)],
		recommendation
	};
}

/** Every string leaf in a parsed work product, so "it said nothing" and "it echoed the prompt" are decidable. */
/** The criterion ids this fixture is able to examine at all — four of the policy's nine (`REG-F-409`). */
const RR_SUBSTITUTION = 'RR-01-no-problem-substitution';
const RR_PROXY = 'RR-04-no-proxy-satisfaction';
const RR_CONTRADICTION = 'RR-07-no-contradiction';
const RR_COMPLETENESS = 'RR-09-no-completeness-from-existence';
/** Per ARM, because coverage is a property of the check that ran, not of the fixture as a whole. */
const GRAPH_ARM_EVALUATES = [RR_COMPLETENESS, RR_PROXY] as const;
const PROCESS_ARM_EVALUATES = [RR_PROXY, RR_CONTRADICTION] as const;
/** ⭐ The review in parts, B2 — the part arm's one: whether each output this type produces feeds a consumer. */
const PART_ARM_EVALUATES = [RR_PROXY] as const;

/**
 * ⭐⭐ THE CRITERIA THIS ARM ACTUALLY EVALUATED AND FOUND CLEAN (`JAN-EXEC` `R26`).
 *
 * ⛔ THIS FIXTURE FAULTS FOUR OF THE POLICY'S NINE CRITERIA AND USED TO SAY NOTHING ABOUT THE OTHER FIVE — and
 * because absence read as `MET`, those five were RECORDED AS PASSED on every gated run. A mandatory control was
 * reporting itself satisfied over a rubric it examined less than half of (`REG-F-409`).
 *
 * ⭑ THE FIXTURE IS NOT AT FAULT FOR BEING A FIXTURE. A deterministic check cannot judge *“sound inference”* or
 * *“no premature convergence”*, and code pretending it could would be worse than the silence. What was wrong is
 * that the silence was INDISTINGUISHABLE FROM A PASS. Each arm now names exactly the criteria it examined; the
 * rest arrive `UNABLE_TO_DETERMINE`, and §28.2's ladder does the rest.
 *
 * ⚠ THE ARMS ALREADY SAID THIS IN PROSE — *“This review judged STRUCTURE only … it did not assess professional
 * quality”* — in a `limitations` string no machine reads. The honesty existed and could not be acted on.
 */
function alsoEvaluated(
	evaluated: readonly string[],
	faulted: readonly ReasoningReviewFinding[]
): ReasoningReviewFinding[] {
	const faultedIds = new Set(faulted.map((f) => f.criterionId));
	return evaluated
		.filter((criterionId) => !faultedIds.has(criterionId))
		.map((criterionId) => ({
			criterionId,
			failed: false,
			statement:
				'Evaluated by the deterministic fixture: this failure class is not present. Structural check only.'
		}));
}

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

	// ⭐ WHAT THIS ARM EXAMINED, AND IT IS BRANCH-DEPENDENT. `RR-04` is always checked; `RR-01` is only
	// reachable when there were leaves to compare against the prompt — on an empty work product it is NOT
	// evaluated, and claiming otherwise would be the fiction this change exists to remove.
	const evaluated = leaves.length === 0 ? [RR_PROXY] : [RR_PROXY, RR_SUBSTITUTION];
	if (findings.length > 0)
		return {
			findings: [...findings, ...alsoEvaluated(evaluated, findings)],
			recommendation: 'REJECTED'
		};

	return {
		findings: alsoEvaluated(evaluated, findings),
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
 * ⚠ `JAN-PRQUAL` `PQ-1` (`REG-F-484`'s general form): "the host watched" is the session's LAST turn — the only
 * observation this arm is handed — so its recorded statements say that turn, and that it sees no earlier one in which
 * the command may have run (`REG-F-485`). That holds of all four arms: an absent report and a NOT_OBSERVABLE one say
 * what the host could not observe — the tool calls of that turn — and that the account could not be checked against
 * THEM; the command under review DID run, and the host observed the process. The verdict is unchanged.
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
	// ⭐ `PQ-1` (`REG-F-484`'s general form): narrowed to the session's LAST turn, as the validator's own observation block
	// is. ⛔ They said the host could not observe "tool calls" at all and could not check the account "against what actually
	// ran" — but the command under review ran, and what the host lacked is only that turn's calls.
	if (!observed || observed.observation === 'NOT_OBSERVABLE')
		return unreadable(
			observed?.reason
				? `the host was not in a position to observe the tool calls of the session’s LAST turn (${observed.reason}), so the agent’s account could not be checked against the calls of that turn`
				: 'the host reported nothing about the tool calls of the session’s LAST turn, so the agent’s account could not be checked against the calls of that turn'
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
	// ⭐ `JAN-PRQUAL` `PQ-1` (`REG-F-484`'s general form) — AND EACH STATEMENT SAYS ONLY WHAT THE HOST KNOWS, WHICH IS THE
	// SESSION'S LAST TURN: the observation this arm is handed is that turn's (`producer.lastTurnObservation()`), and the
	// command under review may have run in an earlier one (`REG-F-485`). They read *"the host watched this turn …
	// The result and the host’s own observation contradict each other"* and *"Nothing the host watched could have
	// produced this result"* — false whenever the command ran earlier. ⚠ THE VERDICT IS UNCHANGED: whether this
	// stand-in should judge an earlier turn's run at all is the cross-try question (`REG-F-485`), not this audit's.
	const completed = (observed.calls ?? []).filter((c) => c.outcome === 'COMPLETED').length;
	if (observed.observation === 'NONE_OBSERVED' || completed === 0)
		findings.push({
			criterionId: 'RR-07-no-contradiction',
			failed: true,
			statement:
				observed.observation === 'NONE_OBSERVED'
					? 'A command result is under review, yet the host watched the session’s LAST turn and observed NO tool calls in it at all. This stand-in sees no earlier turn, so nothing it can see could have produced this result; it cannot tell a contradiction from a command run in an earlier turn.'
					: `A command result is under review, yet of the ${(observed.calls ?? []).length} tool call(s) the host observed in the session’s LAST turn, NONE completed. Nothing the host watched in that turn could have produced this result; this stand-in sees no earlier turn.`,
			severity: 'BLOCKING'
		});

	// ⭐ TWO OF NINE, DECLARED — the empty-result check (`RR-04`) and the observation join (`RR-07`).
	if (findings.length > 0)
		return {
			findings: [...findings, ...alsoEvaluated(PROCESS_ARM_EVALUATES, findings)],
			recommendation: 'REJECTED'
		};

	return {
		findings: alsoEvaluated(PROCESS_ARM_EVALUATES, findings),
		recommendation: 'SATISFIED',
		// ⚠ THE LIMITATION IS WHAT KEEPS THE WORD HONEST, exactly as in the work-product arm. Without it a
		// two-limb structural join is recorded as a passed REASONING review over a build.
		limitations: [
			`This review checked the JOIN only — that a command result exists and that the host observed ${completed} tool call(s) complete in the session’s LAST turn, so the result and that turn’s observation do not contradict each other (the host does not record which call produced it). It did NOT read the command’s output, did NOT judge whether the right command was run, and did NOT assess whether the agent’s account of why it ran is sound. A semantic review requires the configured reviewer model.`
		]
	};
}

/** The two lines of a part this arm reads: its subject's type and its context's artifacts (`pwaTypeReviewInput`). */
interface PartLines {
	readonly subject?: { readonly type?: { readonly requiredOutputs?: unknown } };
	readonly context?: { readonly artifacts?: unknown };
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B2 (`REG-D-125`; DESIGN-authoring-review-in-parts.md D10) — THE OFFLINE ARM FOR
 * ONE TYPE OF A PWA, READ AS A PART. ⛔ It never hands a part to the whole-graph checker: a part is not a graph export, and
 * judging one as a graph would misdescribe its subject.
 *
 * ⭑ IT JUDGES THE ONE STRUCTURAL FACT A PART HOLDS WHOLE: whether each output this type produces feeds a consumer. The part's
 * context lists every type of the PWA that consumes each artifact the type produces, so an output no type consumes is the
 * whole-graph arm's dead end, found on the part of the type that produces it (`RR-04`). ⚠ Well-formedness is the PWA's — a
 * single root, no cycle, every type reachable — and no one part holds it, so this arm judges no `RR-09`: the whole-PWA
 * deterministic check judges it. The children's skeleton lines, which a builder may cut, are not read.
 */
function judgePwaTypePart(content: string): ReasoningReviewJudgement {
	const [subjectLine = '', contextLine = ''] = content.split('\n');
	let subject: PartLines;
	let context: PartLines;
	try {
		subject = JSON.parse(subjectLine) as PartLines;
		context = JSON.parse(contextLine) as PartLines;
	} catch (e) {
		return unreadable(`the part's subject or context line is not parseable as JSON (${e instanceof Error ? e.message : String(e)})`);
	}
	const outputs = subject?.subject?.type?.requiredOutputs;
	const artifacts = context?.context?.artifacts;
	if (!Array.isArray(outputs) || !Array.isArray(artifacts))
		return unreadable('the part parsed but carries no subject type with its outputs or no context artifacts, so it is not a part of a PWA');
	const consumers = new Map(
		(artifacts as { name?: unknown; consumedBy?: unknown }[]).map((a) => [a?.name, a?.consumedBy] as const)
	);
	if (outputs.some((o) => !Array.isArray(consumers.get(o))))
		return unreadable('the part does not say which types consume each output its subject produces');
	const deadEnds = outputs.filter((o) => (consumers.get(o) as unknown[]).length === 0);
	const findings: ReasoningReviewFinding[] =
		deadEnds.length > 0
			? [
					{
						criterionId: RR_PROXY,
						failed: true,
						statement: `${deadEnds.length} output(s) this type produces feed no consumer (dead-end).`,
						severity: 'MATERIAL'
					}
				]
			: [];
	// ⭐ ONE OF NINE, DECLARED — the dead-end check (`RR-04`); this arm examines nothing else.
	return {
		findings: [...findings, ...alsoEvaluated(PART_ARM_EVALUATES, findings)],
		recommendation: findings.length > 0 ? 'CONDITIONALLY_SATISFIED' : 'SATISFIED'
	};
}

/**
 * ⭐ THE STRUCTURAL CHECKER'S JUDGEMENT, BY THE FRAMING THE CALLER DECLARED (`R14`). Exported so the declared stand-in
 * (`standin-reasoning-review-validator.ts`, `JAN-CRITREAD` J1-2) runs exactly this, unchanged — §4.1 rule 1: the
 * checker's answers are recorded as its own. The switch is exhaustive, so a fourth framing is a type error here
 * rather than a misdescription there.
 */
export function judgeStructurally(input: ReasoningReviewInput): ReasoningReviewJudgement {
	switch (input.framing) {
		case 'WORK_PRODUCT':
			return judgeWorkProduct(input.content, input.prompt);
		case 'PROCESS_RESULT':
			return judgeProcessResult(input.content, input.observedToolCalls);
		case 'PWA_GRAPH':
			return judge(input.content);
		case 'PWA_TYPE':
			// ⭐ The review in parts, B2 — the part-aware arm, never the whole-graph checker over a partial graph.
			return judgePwaTypePart(input.content);
		case 'DECLARED_POLICY':
			// ⭐ `JAN-EXEC` Phase 7 completion E2 (`REG-F-523`; design B1) — THE CHECKER JUDGES NO DECLARED CRITERION. It knows
			// two structural failure classes of the floor's rubric, and a declared policy's criteria are not among them, so it
			// answers none: an empty judgement, which the floor's stand-in never completes (its rule 2) and which reads
			// INCONCLUSIVE — fail-closed. ⚠ The declared stand-in (`declared-policy-review.ts`) does not run this checker.
			return {
				findings: [],
				recommendation: 'INCONCLUSIVE',
				limitations: [
					'The structural checker judges no declared-policy criterion: it knows two failure classes of the floor’s rubric only.'
				]
			};
		default: {
			const _never: never = input.framing;
			throw new Error(`Unknown review framing: ${String(_never)}`);
		}
	}
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
			const judgement = judgeStructurally(input);
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
