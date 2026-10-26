// ⭐ `JAN-CRITREAD` J2-2 — THE REVIEWER-QUALIFICATION RUNNER (DESIGN-what-the-tests-prove.md §5.3; ROADMAP J2-2).
//
// Each case goes through the PRODUCT'S REAL PATH and nothing else: the case's input is built by the module both
// production floors build with (`materialize.ts`), the real `createAgyReasoningReviewValidator` materializes the prompt,
// parses, repairs and maps the reply, and the outcome is `composeAssuranceOutcome` over the Reasoning Review policy's
// reference ALONE (`floor.ts` `deMinimisFloorPlan`, `composeAssuranceOutcome`) — so no fact for the other two floor
// policies is fabricated, and no argument list is re-typed (the `REG-F-427` scorer's defect, §3.5). The transport sits
// at the validator's `print` seam, which exists so a conformance run can exercise the REAL validator
// (`reasoning-review-validator.ts`, `AgyPrint`). ⭐ E12's polish — save a DECLARED case's outcome, which is the verdict the
// declared sign-off records, by its own functions (`scoreDeclared`): the product's real path for a declared policy.
// ⭐ The review in parts, B7 (`REG-D-125`) — a PART case (`PWA_TYPE`) is scored as every floor case is: its own Reasoning Review
// disposition, `composeAssuranceOutcome` over the Reasoning Review reference alone, its subject the type it reviews; the check
// holds that disposition to its oracle and reports its attribution (`REG-D-080`).
//
//   · The validator is built with the run's RECORDED evaluator identity, never through `judgeModel()` (§5.3).
//   · A TRANSPORT FAILURE is recorded as its class, not re-scorable, and scored as the product's own floor runner scores
//     a validator that throws (`validators.ts` `runFloorResults`: an execution-failed result, VALIDATOR_FAILED).
//   · ⭐ P5 package A (F2) — so is a reply the product's tool cut at the model's output-token limit, recorded as its own
//     class (`OUTPUT_LIMIT`), never as a transport failure.
//   · Anything else a transport throws is the HARNESS's fault, and the run stops (§5.1: a candidate is measured on what
//     it did, never on what the harness did).
//   · RETENTION (§5.3): a line keeps `splitAnswerSpan(raw).answer` only when it parses as one JSON value, and then only
//     what the product reads of it (`retainedAnswer`); a span that does not parse keeps nothing but its hash; with no
//     span, nothing but whether the product's parse accepted the reply. `REG-F-428`'s classes are detected here, over
//     the raw reply, and only their names are kept.
import { createHash } from 'node:crypto';
import {
	composeAssuranceOutcome,
	createValidatorRegistry,
	deMinimisFloorPlan,
	FLOOR_POLICY_IDS,
	runDeMinimisFloor,
	type ReasoningReviewInput,
	type Validator,
	type ValidatorResult
} from '@janumipwb/rph-assurance';
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import {
	extractJson,
	splitAnswerSpan
} from '../../apps/rph-demo/src/lib/server/assurance/agy-cli.js';
import { createModelDeclaredPolicyReviewer } from '../../apps/rph-demo/src/lib/server/assurance/declared-policy-review.js';
import { declaredVerdict, evidenceCeiling } from '../../apps/rph-demo/src/lib/server/assurance/declared-policy-signoff.js';
import {
	createAgyReasoningReviewValidator,
	CRITERION_REPAIR_INSTRUCTION,
	MISSING_CRITERION_REPAIR_CLOSING,
	MISSING_CRITERION_REPAIR_OPENING,
	missingCriterionRepairInstruction
} from '../../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import {
	isToolInvocationResult,
	type ToolInvocationResult
} from '../../apps/rph-demo/src/lib/server/tools/backing-tool.js';
import { OutputLimitReached } from '../../apps/rph-demo/src/lib/server/tools/output-limit.js';
import type { DeclaredPolicyCase, QualificationCase } from './cases.js';
import { detectMalformations } from './malformations.js';
import { caseReviewInput } from './materialize.js';
import { HarnessRefusal, refuseProgramOverrides } from './preflight.js';
import {
	DEPLOYABLE_TRANSPORTS,
	lineProblems,
	RECORD_VERSION,
	retainedAnswer,
	serverDayOf,
	type CallEvaluator,
	type CallLine,
	type CallRole,
	type CallReply,
	type CandidateIdentity,
	type CriterionOutcomeName,
	type MalformationClass,
	type RunLine,
	type ScoredOutcome,
	type ServedFacts
} from './record.js';
import { TransportFailure, type Transport, type TransportReply } from './transports.js';

/** What a run is stamped with — J2-3's reviewer fingerprint, scoring digest and case-set digest (§5.5), handed in. */
export interface RunFingerprint {
	readonly reviewer: string;
	readonly scoring: string;
	readonly caseSet: string;
}

/** One model call, as a line will carry it. */
export interface EvaluationCall {
	readonly role: CallRole;
	readonly promptSha256: string;
	readonly elapsedMs: number;
	readonly reply: CallReply;
	readonly malformations: readonly MalformationClass[];
	readonly served: ServedFacts | null;
}
export interface Evaluation {
	readonly calls: readonly EvaluationCall[];
	readonly evaluator: CallEvaluator;
	readonly scored: ScoredOutcome;
}

const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

/**
 * ⭐ P7-6 I5 (`DESIGN-the-reviewer-isolated.md` §4d; `REG-F-552`) — WHICH CALL THIS IS, as the record names it: the first is
 * `initial`; a later one is the validator's one repair — `criterion-repair` when its prompt ends with the line the
 * validator writes after a reply that PARSED and answered no criterion (`CRITERION_REPAIR_INSTRUCTION`, the product's own
 * constant), else `repair`, the repair of a reply that did not parse. ⛔ A plain `repair` for both would hold the
 * criterion repair's hash to the JSON repair's, and the check would read today's own repair as a prompt that changed.
 * ⭐ Package L — D13 (`REG-D-135` (3)): AND the missing-criterion repair, whose prompt ends with D13's line
 * (`endsWithMissingCriterionLine`), is a criterion repair too; ~~the validator's one repair~~ a review makes at most one
 * JSON repair and one criterion repair, so a criterion repair may be the second call or the third.
 */
const callRole = (made: number, prompt: string): CallRole => {
	if (made === 0) return 'initial';
	return prompt.endsWith(`\n\n${CRITERION_REPAIR_INSTRUCTION}`) || endsWithMissingCriterionLine(prompt)
		? 'criterion-repair'
		: 'repair';
};

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L — D13 (`REG-D-135` (3); design D13) — WHETHER A PROMPT ENDS WITH THE MISSING-CRITERION
 * REPAIR'S LINE: its last paragraph the product's own line (`missingCriterionRepairInstruction`) for the ids between its two
 * fixed parts. ⛔ That repair is a criterion repair too, recorded `criterion-repair`: read as a plain `repair`, its hash would
 * be held to the JSON repair's. ⭑ Told by the product's own builder, never by a pattern restated here.
 */
function endsWithMissingCriterionLine(prompt: string): boolean {
	const line = prompt.slice(prompt.lastIndexOf('\n\n') + 2);
	if (!line.startsWith(MISSING_CRITERION_REPAIR_OPENING) || !line.endsWith(MISSING_CRITERION_REPAIR_CLOSING)) return false;
	const ids = line.slice(MISSING_CRITERION_REPAIR_OPENING.length, line.length - MISSING_CRITERION_REPAIR_CLOSING.length);
	return ids !== '' && missingCriterionRepairInstruction(ids.split(', ')) === line;
}
/** The validator's exchange clock. Its stamps reach no line, so a fixed value keeps a re-scoring identical. */
const EXCHANGE_CLOCK = () => '1970-01-01T00:00:00.000Z';

/** The text the validator parses out of what a transport returned (`reasoning-review-validator.ts` `timed`). */
const replyText = (returned: string | ToolInvocationResult): string =>
	isToolInvocationResult(returned)
		? returned.answer.arrived
			? returned.answer.text
			: ''
		: returned;

/**
 * ⛔ RETENTION (§5.3: reasoning, in its own field or inline, never enters a tracked record).
 *   · A located span that parses as ONE JSON value is kept in its retained form — only what the product reads of it.
 *   · A located span that does not parse is NOT RETAINED: `splitAnswerSpan` runs from the first `{` to the last `}`, so
 *     such a span is exactly the one that holds reasoning with a brace on each side of it. Only its hash is kept.
 *   · No span: nothing but whether the product's parse accepted the reply anyway.
 */
function retained(raw: string): CallReply {
	const span = splitAnswerSpan(raw);
	if (span.located) {
		const spanSha256 = sha256(span.answer);
		let parsed: Record<string, unknown>;
		try {
			// A text that begins with `{` and parses is one JSON object.
			parsed = JSON.parse(span.answer) as Record<string, unknown>;
		} catch {
			return { status: 'NOT_RETAINED', spanSha256 };
		}
		return { status: 'ANSWERED', answer: retainedAnswer(parsed), spanSha256 };
	}
	let parses = true;
	try {
		JSON.parse(extractJson(raw));
	} catch {
		parses = false;
	}
	return { status: 'NO_ANSWER_SPAN', parses };
}

/**
 * One case, one repetition, through the real validator — `call` standing at its `print` seam. Returns the calls it
 * made and the outcome as the product scores it.
 */
export async function evaluateCase(args: {
	readonly case: QualificationCase;
	readonly criteria: readonly AssessmentCriterion[];
	readonly candidate: CandidateIdentity;
	readonly call: (prompt: string) => Promise<TransportReply>;
	readonly scoringDigest: string;
	readonly now?: () => number;
	/**
	 * ⭐ R3-A F3 (the lead's delegated decision of 2026-10-16, registered as REG-D-114 (13)) — a declared policy's required
	 * evidence, by its id: what sets the ceiling a declared case is scored at (`evidenceCeiling`). Absent, the catalog's seed,
	 * which the store's is copied from (`seedAdditivePolicies`) — a run's; the fingerprint hands its own declared seam's
	 * (`fingerprint.ts`), so its declared corpus is scored at the ceilings it hashes.
	 */
	readonly requiredEvidenceOf?: (policyId: string) => RequiredEvidence | undefined;
}): Promise<Evaluation> {
	const now = args.now ?? (() => performance.now());
	// ⭐⭐ `JAN-EXEC` Phase 7 completion E2 (design B5) — A DECLARED CASE IS ANSWERED AGAINST ITS OWN POLICY'S CRITERIA, never the
	// floor's seeded rubric the run is handed (`materialize.ts` builds its prompt from them): so its reply's rows are read
	// against them too. ⛔ Read against the floor's, every row of a well-formed declared reply is recorded as
	// UNDECLARED_CRITERION_ID and every floor criterion as MISSING_CRITERION — malformations the reviewer never made.
	// ~~⚠ ITS SCORE IS THE OTHER ARMS': for a VALID result the floor's composition computes `dispositionFromFindings` over the
	// result's own rows and findings — the ladder the declared sign-off computes its verdict by (`declared-policy-signoff.ts`)
	// — and its DIFFERENT_MODEL requirement is one every candidate meets against the case's fictional producer (measured on
	// the fourteen cases: a scorer of their own, the ladder alone, scored each of them alike).~~ ⛔ E12's polish (the confirm's
	// runner.ts finding): FALSE — the sign-off does not compute its verdict by the floor's composition, and the two part on v5's
	// own cases. ⭐ ITS SCORE IS THE SIGN-OFF'S VERDICT (`scoreDeclared`).
	const caseCriteria = args.case.arm === 'DECLARED_POLICY' ? args.case.input.policy.criteria : args.criteria;
	const criterionIds = new Set(caseCriteria.map((k) => k.id));
	const input: ReasoningReviewInput = caseReviewInput(args.case, args.criteria);
	const calls: EvaluationCall[] = [];
	let harness: unknown;
	/** The last reply that REPORTED an identity — the validator keeps it across calls, and so does the record. */
	let reported: ToolInvocationResult | undefined;
	// ⛔ NEVER `requireReportedModel` (`JAN-SELREV` D6). A run measures what the candidate did, and a reply reporting
	// another model is recorded under that model; the fingerprint scores its corpus through here, and the corpus holds
	// such replies, so setting it would move the fingerprint (`verif/reviewer-qualification-fingerprint.test.ts`).
	const validator = createAgyReasoningReviewValidator({
		agentId: args.candidate.agentId,
		modelId: args.candidate.modelLabel,
		providerId: args.candidate.provider,
		clock: EXCHANGE_CLOCK,
		print: async (prompt) => {
			const role = callRole(calls.length, prompt);
			const started = now();
			const elapsed = () => Math.round(now() - started);
			try {
				const reply = await args.call(prompt);
				const raw = replyText(reply.returned);
				if (reportsIdentity(reply.returned)) reported = reply.returned;
				calls.push({
					role,
					promptSha256: sha256(prompt),
					elapsedMs: elapsed(),
					reply: retained(raw),
					malformations: detectMalformations(raw, criterionIds),
					served: reply.served
				});
				return reply.returned;
			} catch (e) {
				if (e instanceof TransportFailure)
					calls.push({
						role,
						promptSha256: sha256(prompt),
						elapsedMs: elapsed(),
						reply: {
							status: 'TRANSPORT_FAILURE',
							failureClass: e.failureClass,
							reason: e.reason,
							rescorable: false,
							preContact: e.preContact
						},
						malformations: [],
						served: e.served
					});
				// ⭐⭐ P5 package A (F2) — a reply the tool ended at the model's output-token limit (the product's own class,
				// `tools/output-limit.ts`): what the tool reported of the cut, nothing of the reply (§5.3), never re-scored. ⭑ The
				// validator records it and fails the review, scored as a throw is (`scoreThrow`).
				else if (e instanceof OutputLimitReached)
					calls.push({
						role,
						promptSha256: sha256(prompt),
						elapsedMs: elapsed(),
						reply: {
							status: 'OUTPUT_LIMIT',
							finishReason: e.facts.finishReason ?? null,
							outputTokens: e.facts.outputTokens ?? null,
							rescorable: false
						},
						malformations: [],
						served: null
					});
				// ⚠ The validator sanitises whatever its seam throws, so the harness's own fault leaves by this variable.
				else harness = e;
				throw e;
			}
		}
	});
	let result: ValidatorResult | undefined;
	let thrown: unknown;
	try {
		result = await validator.evaluate(args.case.subject, { reasoningReview: input });
	} catch (e) {
		thrown = e;
	}
	if (harness !== undefined) throw harness;
	if (calls.length === 0)
		throw new HarnessRefusal(
			`${args.case.id}: the validator failed before it called its transport — ${String(thrown)}`
		);
	const floor = result
		? scoreResult(args.case, result, args.scoringDigest)
		: await scoreThrow(args.case, input, validator.validatorId, thrown, args.scoringDigest);
	const evidenceOf = args.requiredEvidenceOf ?? seededEvidence;
	const scored =
		args.case.arm === 'DECLARED_POLICY'
			? await scoreDeclared(args.case, input, validator, result, thrown, floor, args.candidate, evidenceOf)
			: floor;
	return { calls, evaluator: evaluatorOf(args.candidate, result, reported), scored };
}

/** ⭐ R3-A F3 — a declared policy's required evidence, as `evidenceCeiling` reads it. */
type RequiredEvidence = Parameters<typeof evidenceCeiling>[0];
/** ⭐ R3-A F3 — the catalog's seed of a policy's required evidence, which the store's is copied from
 *  (`seedAdditivePolicies`): what a run's declared cases are scored at. */
const seededEvidence = (policyId: string): RequiredEvidence | undefined =>
	ontology.seedPolicies.find((p) => p.policyId === policyId)?.requiredEvidence;

/**
 * ⭐⭐ E12's polish (the confirm's runner.ts finding; the qualification measures what the product will record) — A DECLARED CASE,
 * SCORED AS THE DECLARED SIGN-OFF RECORDS ITS VERDICT: the review read as the product's declared seam reads it
 * (`createModelDeclaredPolicyReviewer`, over this evaluation's own result or throw — no second call), and the verdict the
 * sign-off's own function computes (`declaredVerdict`), at the ceiling its policy's evidence sets as the catalog seeds it
 * (`evidenceCeiling`). ⛔ It was the floor composition's, and the two part on v5's own cases: a reply that faults a BLOCKING
 * criterion and recommends SATISFIED (the floor's BOUNDARY_REJECTED; the sign-off records REJECTED), a clean reply
 * recommending ESCALATED (`REG-D-089`'s rule (a): ESCALATED; the sign-off records SATISFIED), and a review that threw
 * (VALIDATOR_FAILED; the sign-off records INCONCLUSIVE) — and past v5's seven, at the sign-off's own limbs and an evidence
 * ceiling. ⭑ `resultClass` says whether the review answered (VALID) or failed (VALIDATOR_FAILED), the one distinction the
 * declared seam draws; `independenceOk` stays the floor reference's check against the case's producer, which the sign-off's
 * verdict does not read (the kernel checks the declared policy's own requirement at completion, against the unit's producer).
 * ⭐ R3-A F3 — the policy's evidence read through `requiredEvidenceOf`: the catalog's seed for a run (`seededEvidence`), the
 * declared seam's for the fingerprint's declared corpus (`fingerprint.ts`).
 */
async function scoreDeclared(
	c: DeclaredPolicyCase,
	input: ReasoningReviewInput,
	validator: Validator,
	result: ValidatorResult | undefined,
	thrown: unknown,
	floor: ScoredOutcome,
	candidate: CandidateIdentity,
	requiredEvidenceOf: (policyId: string) => RequiredEvidence | undefined
): Promise<ScoredOutcome> {
	const required = requiredEvidenceOf(c.input.policy.policyId);
	if (required === undefined)
		throw new HarnessRefusal(
			`${c.id}: the catalog seeds no policy ${c.input.policy.policyId}, so no sign-off would review it`
		);
	const answer = await createModelDeclaredPolicyReviewer(
		{ ...validator, evaluate: () => (result === undefined ? Promise.reject(thrown) : Promise.resolve(result)) },
		() => ({ actorType: 'AGENT', agentId: candidate.agentId, modelId: candidate.modelLabel, providerId: candidate.provider })
	).review(c.subject, input);
	const verdict = declaredVerdict(
		{ criteria: c.input.policy.criteria, evidenceCeiling: evidenceCeiling(required) },
		answer,
		false
	);
	return {
		...floor,
		disposition: verdict.disposition,
		resultClass: answer.failure === undefined ? 'VALID' : 'VALIDATOR_FAILED',
		criteria: verdict.rows.map((k) => [k.criterionId, k.outcome as CriterionOutcomeName] as const)
	};
}

/** The Reasoning Review policy's disposition from `composeAssuranceOutcome` over its reference ALONE. */
function scoreResult(
	c: QualificationCase,
	result: ValidatorResult,
	scoringDigest: string
): ScoredOutcome {
	const plan = deMinimisFloorPlan(c.subject).filter(
		(p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW
	);
	const rr = composeAssuranceOutcome(c.subject, plan, [result]).perPolicy[0]!;
	return {
		scoringDigest,
		disposition: rr.disposition,
		resultClass: rr.resultClass,
		independenceOk: rr.independenceOk,
		criteria: result.criteria.map(
			(k) => [k.criterionId, k.outcome as CriterionOutcomeName] as const
		)
	};
}

/**
 * A validator that threw, scored as the PRODUCT's floor runner scores one: `runFloorResults` turns the throw into an
 * execution-failed result, which `composeAssuranceOutcome` classifies. That result is not exported, so the runner
 * hands the same throw to the product's runner and reads the Reasoning Review policy's row — the other two policies
 * have no validator there and stay MISSING, which touches nothing in this row. A failed result carries no criteria.
 */
async function scoreThrow(
	c: QualificationCase,
	input: ReasoningReviewInput,
	validatorId: string,
	thrown: unknown,
	scoringDigest: string
): Promise<ScoredOutcome> {
	const registry = createValidatorRegistry();
	registry.register({
		policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
		validatorId,
		evaluate: () => Promise.reject(thrown)
	});
	const floor = await runDeMinimisFloor(c.subject, { reasoningReview: input }, registry);
	const rr = floor.perPolicy.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)!;
	return {
		scoringDigest,
		disposition: rr.disposition,
		resultClass: rr.resultClass,
		independenceOk: rr.independenceOk,
		criteria: []
	};
}

/** Does this reply REPORT who answered? The validator's own test (`reasoning-review-validator.ts` `timed`): both ids set. */
const reportsIdentity = (
	returned: string | ToolInvocationResult
): returned is ToolInvocationResult =>
	isToolInvocationResult(returned) &&
	Boolean(returned.producer.modelId) &&
	Boolean(returned.producer.providerId);

/**
 * The evaluator the product recorded — the tool's REPORTED identity when one was reported (`reasoning-review-validator.ts`).
 * ⚠ ON ANY CALL, NOT ONLY THE LAST: the validator keeps a reported identity, and its grade, when a later call returns a
 * bare string, so reading the grade off the last reply alone would record the reported ids as HOST_CONFIGURED.
 */
function evaluatorOf(
	candidate: CandidateIdentity,
	result: ValidatorResult | undefined,
	reported: ToolInvocationResult | undefined
): CallEvaluator {
	return {
		agentId: result?.evaluator.agentId ?? (reported?.producer.agentId || candidate.agentId),
		modelId: result?.evaluator.modelId ?? reported?.producer.modelId ?? candidate.modelLabel,
		providerId: result?.evaluator.providerId ?? reported?.producer.providerId ?? candidate.provider,
		identityEvidence: reported ? reported.identityEvidence : 'HOST_CONFIGURED'
	};
}

/**
 * ⛔ EVERY LINE IS CHECKED BEFORE ANYONE WRITES IT. The record is append-only, so a line it would refuse, once appended,
 * breaks the file for good (the CLI then refuses to append to it) — the check has to come before, not after.
 */
function checked<L extends RunLine | CallLine>(line: L): L {
	const problems = lineProblems(line);
	if (problems.length > 0)
		throw new HarnessRefusal(
			`REFUSED: the run made a ${line.kind} line the record refuses, so nothing more is written — ${problems.join('; ')}`
		);
	return line;
}

/**
 * ⭐ `JAN-CRITREAD` J2-3 — ONE SERVER-CLOCK DAY, HELD WHILE THE RUN IS MADE (§5.3; `REG-F-429`). gpt-oss's template
 * injects the server's date, and across its midnight 0 of 4 replies held; so the check discards an Ollama run whose
 * calls fall on two server dates. This stops the run at the first call that lands on another date — or whose clock
 * cannot be placed — BEFORE that call is recorded, instead of spending GPU time on calls the check would discard: the
 * lines already appended stay, all on one date, and the CLI exits 4 (stopped part-way). The date is `record.ts`'s
 * `serverDayOf`, the one the check uses. A candidate whose server shows no clock (agy, devin) is never held.
 * ⚠ At most one call is spent past midnight: the clock is the one the call itself was served under.
 */
function oneServerDay(offset: string | null): (reply: () => Promise<TransportReply>) => Promise<TransportReply> {
	let first: string | undefined;
	const hold = (served: ServedFacts | null) => {
		if (offset === null || served === null) return;
		const day = serverDayOf(served.serverClock, offset);
		if (day === undefined)
			throw new HarnessRefusal(
				`REFUSED: the server’s clock ${JSON.stringify(served.serverClock)} is not an HTTP date, so the call cannot be ` +
					`placed on its calendar (UTC${offset}; REG-F-429) — the run stops here, before recording it`
			);
		first ??= day;
		if (day !== first)
			throw new HarnessRefusal(
				`REFUSED: the server’s date changed from ${first} to ${day} during the run (UTC${offset}; REG-F-429) — a run ` +
					'must finish within one server-clock day (§5.3), and the check discards one that does not; it stops here, ' +
					'before recording the call that crossed. Measure the cases it did not reach in a run on the new day.'
			);
	};
	return async (reply) => {
		try {
			const r = await reply();
			hold(r.served);
			return r;
		} catch (e) {
			if (e instanceof TransportFailure) hold(e.served);
			throw e;
		}
	};
}

export interface RunInputs {
	readonly runId: string;
	readonly date: string;
	readonly commit: string;
	readonly fingerprint: RunFingerprint;
	readonly cases: readonly QualificationCase[];
	readonly caseSetVersion: number;
	readonly oracleVersion: number;
	readonly criteria: readonly AssessmentCriterion[];
	readonly transport: Transport;
	readonly repetitions: number;
	/** The environment the override refusal reads (`REG-D-072` D12). */
	readonly env: Readonly<Record<string, string | undefined>>;
	readonly now?: () => number;
	/** Each line as it is made, so a run killed part-way keeps every call it measured. */
	readonly onLine?: (line: RunLine | CallLine) => void;
}

/**
 * ⭐ A qualification run: the RUN line, then every case × repetition (repetitions outermost, so a case's repetitions
 * are separated by the rest of the set), each call a CALL line. Refuses a program override before the transport is
 * asked anything; releases the transport however the run ends.
 *
 * ⛔ THE RUN LINE WAITS FOR THE FIRST EVALUATION. A harness refusal stops the run; had the RUN line already been written,
 * the append-only record would keep a run with no CALL behind it — the candidate measured on nothing, for a fault that
 * was the harness's. So it is emitted with the first evaluation's calls, and a run the harness stops before then leaves
 * no line at all.
 */
export async function runQualification(i: RunInputs): Promise<(RunLine | CallLine)[]> {
	refuseProgramOverrides(i.env);
	const lines: (RunLine | CallLine)[] = [];
	const emit = (line: RunLine | CallLine) => {
		lines.push(checked(line));
		i.onLine?.(line);
	};
	try {
		const candidate = await i.transport.identify();
		const withinOneDay = oneServerDay(candidate.serverUtcOffset);
		// ⛔ Checked NOW, though written only with the first evaluation: a stamp the record would refuse (a run id, a
		// commit, a fingerprint) stops the run before a single model call is paid for.
		let pending: RunLine | undefined = checked({
			kind: 'RUN',
			recordVersion: RECORD_VERSION,
			runId: i.runId,
			date: i.date,
			commit: i.commit,
			reviewerFingerprint: i.fingerprint.reviewer,
			scoringDigest: i.fingerprint.scoring,
			caseSetDigest: i.fingerprint.caseSet,
			caseSetVersion: i.caseSetVersion,
			oracleVersion: i.oracleVersion,
			caseIds: i.cases.map((c) => c.id),
			repetitions: i.repetitions,
			candidate,
			deployable: DEPLOYABLE_TRANSPORTS.has(candidate.transport)
		});
		for (let repetition = 1; repetition <= i.repetitions; repetition++)
			for (const c of i.cases) {
				const e = await evaluateCase({
					case: c,
					criteria: i.criteria,
					candidate,
					call: (prompt) => withinOneDay(() => i.transport.call(prompt)),
					scoringDigest: i.fingerprint.scoring,
					...(i.now ? { now: i.now } : {})
				});
				if (pending) emit(pending);
				pending = undefined;
				e.calls.forEach((call, n) =>
					emit({
						kind: 'CALL',
						runId: i.runId,
						caseId: c.id,
						repetition,
						role: call.role,
						promptSha256: call.promptSha256,
						elapsedMs: call.elapsedMs,
						reply: call.reply,
						malformations: call.malformations,
						served: call.served,
						evaluator: e.evaluator,
						scored: n === e.calls.length - 1 ? e.scored : null
					})
				);
			}
	} finally {
		await i.transport.close?.();
	}
	return lines;
}

/**
 * The least text the product parses exactly as it parsed the recorded reply — for every retention form:
 *   · ANSWERED — the retained form, which the product reads as it read the span (`retainedAnswer`);
 *   · NOT_RETAINED — the empty string: the span did not parse, and neither does it, so the validator repairs or fails
 *     exactly as it did at run time;
 *   · NO_ANSWER_SPAN — `null` if the product's parse accepted the reply (any bare scalar coerces to the same empty
 *     judgement), the empty string if it did not.
 */
function replayText(
	reply: Exclude<CallReply, { readonly status: 'TRANSPORT_FAILURE' } | { readonly status: 'OUTPUT_LIMIT' }>
): string {
	switch (reply.status) {
		case 'ANSWERED':
			return reply.answer;
		case 'NOT_RETAINED':
			return '';
		case 'NO_ANSWER_SPAN':
			return reply.parses ? 'null' : '';
	}
}

/** A replayed reply, as the tool's report of the recorded evaluator, graded as recorded. */
const asReported = (text: string, evaluator: CallEvaluator): ToolInvocationResult => ({
	answer: { arrived: true, text },
	rawOutput: text,
	producer: {
		agentId: evaluator.agentId,
		modelId: evaluator.modelId,
		providerId: evaluator.providerId
	},
	identityEvidence: evaluator.identityEvidence,
	observedToolCalls: {
		canObserve: false,
		reason: 'A replay from the record: no tool ran, so nothing was observed.'
	}
});

/**
 * ⭐ A recorded evaluation's replies, replayed in order at the `print` seam — how a RESCORED record is re-derived
 * with no model call (§5.4, §5.6). Each retention form is replayed as the least text the product parses the same way
 * (`replayText`). ⛔ A transport failure has nothing to replay: it is not re-scorable.
 *
 * ⭐ AND THE RECORDED EVALUATOR GOES BACK IN WITH IT. The validator scores independence against the identity the tool
 * REPORTED when it reported one (`reasoning-review-validator.ts` `timed`), so a replay of the text alone would re-score
 * against the candidate's configured identity instead — a producer-equal report that was BOUNDARY_REJECTED at run time
 * would replay SATISFIED. So every reply is handed back as the tool's report of that evaluator, graded as recorded:
 * the validator then holds exactly the identity it held at run time, whichever call first reported it.
 */
export function replayReplies(
	calls: readonly Pick<CallLine, 'reply' | 'evaluator'>[]
): (prompt: string) => Promise<TransportReply> {
	const replies = calls.map(({ reply, evaluator }) => {
		if (reply.status === 'TRANSPORT_FAILURE')
			throw new HarnessRefusal(
				`a ${reply.failureClass} is not re-scorable: the call returned nothing to replay`
			);
		// ⭐ P5 package A (F2) — nor is a reply the tool cut: nothing of it was kept to replay (§5.3).
		if (reply.status === 'OUTPUT_LIMIT')
			throw new HarnessRefusal(
				'an OUTPUT_LIMIT is not re-scorable: the tool cut the reply at the model’s output-token limit, and nothing of it was kept'
			);
		return asReported(replayText(reply), evaluator);
	});
	let next = 0;
	return async () => {
		if (next >= replies.length) throw new HarnessRefusal('the replay ran out of recorded replies');
		return { returned: replies[next++]!, served: null };
	};
}
