// ⭐ `JAN-CRITREAD` J2-3 — THE REVIEWER FINGERPRINT (DESIGN-what-the-tests-prove.md §5.5; ROADMAP J2-3 + J2-4).
//
// ONE EXPORTED FUNCTION, `reviewerFingerprint`, shared by the runner (which stamps each RUN line with it, `run.ts`) and
// the check (which asks whether today's reviewer is covered, `check.ts`). It says which reviewer DEFINITION a record
// measured, at the grain of behaviour — never of text:
//   · `probes`   — the prompts the product's validator materializes for the probe set (`probes.ts`), which reaches every
//                  branch of assembly, the process-result arm and every oversize-together cap included;
//   · `budget`   — the excerpt budget constants themselves (`REASONING_REVIEW_BUDGET`), since `CONTENT_MAX` is a cap no
//                  probe can reach;
//   · `criteria` — the seed criteria as whole objects, every field, the ones no prompt or score reads included — and,
//                  since `JAN-CRITREAD` J2-3, the seeded Reasoning Review policy's `independence`, which the product's
//                  recording gate reads (`rph-application` `assurance.ts`, the §39 inv-8 check) though no score does;
//   · `scoring`  — the scoring digest: the corpus of raw replies (`scoring-corpus.ts`) through the runner's own
//                  `evaluateCase` — the real validator at its print seam, then the Reasoning Review reference alone —
//                  hashed as outcomes only, with the repair instruction a failed first parse draws, and the
//                  malformation classes the harness detects in each reply (a class lost is `MALFORMATION_GAINED`'s
//                  measure moving, §5.1).
// Beside it, not in it: the CASE-SET digest (over each case's inputs, never its oracle, §5.5) and each case's prompt
// hashes, which the check compares with what a run recorded (§5.6 limbs 1 and 2).
//
// ⛔ NOTHING HERE READS A SOURCE FILE. A comment moves no fingerprint, and a whole-file hash would move it on every
// comment — `verif/reviewer-qualification-fingerprint.test.ts` measures that on a disposable copy of the tree.
// ⚠ OUT OF SCOPE, AS §5.5 STATES: the model (a change of model moves nothing), the transports' bounds and argv (in each
// RUN's candidate identity instead), and a durable deployment seeded before a criteria change.
// ⚠ AND `renderProcessResult` (`REG-D-072` D17): the process-result arm's content is literal in its probes, so a change
// to how a production process result is rendered into `content` moves no fingerprint.
import { readFileSync } from 'node:fs';
import {
	FLOOR_POLICY_DEFINITIONS,
	FLOOR_POLICY_IDS,
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type IndependenceRequirement,
	type ReasoningReviewInput,
	type Validator
} from '@janumipwb/rph-assurance';
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import {
	createAgyReasoningReviewValidator,
	REASONING_REVIEW_BUDGET,
	type AgyPrint
} from '../../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { CURRENT_CASE_SET_FILE, type CaseSet, type QualificationCase } from './cases.js';
import { canonicalJson, reviewerFingerprintOf, sha256, type FingerprintComponents } from './digest.js';
import { FINGERPRINT_PROBES, PROBE_SUBJECT } from './probes.js';
import type { CandidateIdentity } from './record.js';
import { evaluateCase } from './runner.js';
import { CORPUS_CASE, scoringCorpus } from './scoring-corpus.js';

/** A case's two prompts, as sha256 — the hashes its CALL lines carry for the initial call and the repair. */
export interface CasePrompts {
	readonly initial: string;
	readonly repair: string;
}
export interface ReviewerFingerprint {
	/** The reviewer fingerprint — a RUN line's `reviewerFingerprint`. */
	readonly reviewer: string;
	/** The scoring digest — a RUN line's `scoringDigest`, and `components.scoring`. */
	readonly scoring: string;
	/** The case-set digest — a RUN line's `caseSetDigest`. */
	readonly caseSet: string;
	readonly components: FingerprintComponents;
	/** Each case's prompt hashes, by case id. */
	readonly casePrompts: ReadonlyMap<string, CasePrompts>;
	/** Each probe's materialized prompt, by probe id — kept whole so a test can say what it reaches. */
	readonly probePrompts: ReadonlyMap<string, string>;
}

/**
 * ⭐ WHAT THE FINGERPRINT MEASURES, as seams — the product's own in `PRODUCT_SEAMS`. A test swaps ONE to show the
 * fingerprint moves with it; nothing else ever passes anything but the product's.
 */
export interface FingerprintSeams {
	/** The product's validator, its print seam handed in — how the probe prompts are materialized. */
	readonly validator: (print: AgyPrint) => Validator;
	/** The runner's evaluation — how each case's prompts are found and the corpus is scored. */
	readonly evaluate: typeof evaluateCase;
	readonly budget: Readonly<Record<string, number>>;
	readonly criteria: readonly AssessmentCriterion[];
	/** The seeded Reasoning Review policy's independence requirement — what the recording gate holds a reviewer to. */
	readonly independence: IndependenceRequirement;
}

/** Who the fingerprint's validator says it is: an identity no producer carries, so independence never decides a probe. */
const FINGERPRINT_EVALUATOR = {
	agentId: 'jpwb-fingerprint',
	modelId: 'jpwb-fingerprint-reviewer',
	providerId: 'jpwb-fingerprint'
} as const;
const FINGERPRINT_CANDIDATE: CandidateIdentity = {
	transport: 'stub',
	agentId: FINGERPRINT_EVALUATOR.agentId,
	provider: FINGERPRINT_EVALUATOR.providerId,
	modelLabel: FINGERPRINT_EVALUATOR.modelId,
	servedModelDigest: null,
	servedTemplateSha256: null,
	servedModelfileSha256: null,
	templateInjectsDate: null,
	serverVersion: null,
	serverUtcOffset: null,
	options: {},
	bounds: { wallClockMs: 240_000, promptChars: null, printTimeout: null },
	argv: null
};
/** The exchange clock the validator stamps with — its stamps reach no prompt and no outcome. */
const FIXED_CLOCK = () => '1970-01-01T00:00:00.000Z';
/** Stamped into an evaluation's outcome by `evaluateCase`, and removed before anything is hashed. */
const NO_DIGEST = '0'.repeat(64);

/** The seeded Reasoning Review policy's own requirement — `floor-policies.ts`, whence the seed writes it. */
const SEEDED_INDEPENDENCE: IndependenceRequirement = (() => {
	const policy = FLOOR_POLICY_DEFINITIONS.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW);
	if (!policy) throw new Error('the seeded floor policies hold no Reasoning Review policy');
	return policy.independence;
})();

export const PRODUCT_SEAMS: FingerprintSeams = {
	// ⛔ Built WITHOUT `requireReportedModel`, as the runner's is (`JAN-SELREV` D6): only the product's devin branch sets it.
	validator: (print) =>
		createAgyReasoningReviewValidator({ ...FINGERPRINT_EVALUATOR, clock: FIXED_CLOCK, print }),
	evaluate: evaluateCase,
	budget: REASONING_REVIEW_BUDGET,
	criteria: SEEDED_REASONING_REVIEW_CRITERIA,
	independence: SEEDED_INDEPENDENCE
};

/** A judgement answering every criterion clean — what the second call of a prompt capture returns. */
const cleanJudgement = (criteria: readonly AssessmentCriterion[]): string =>
	JSON.stringify({
		findings: criteria.map((k) => ({ criterionId: k.id, failed: false, statement: 'absent' })),
		recommendation: 'SATISFIED'
	});
/** A first reply no parse accepts, so the validator sends its repair prompt too. */
const UNUSABLE = 'not a judgement';

/** The first prompt the validator materializes for `input`. */
async function probePrompt(
	seams: FingerprintSeams,
	subject: AssuranceSubject,
	input: ReasoningReviewInput
): Promise<string> {
	const sent: string[] = [];
	const validator = seams.validator(async (p) => {
		sent.push(p);
		return cleanJudgement(input.criteria);
	});
	await validator.evaluate(subject, { reasoningReview: input });
	if (sent.length === 0) throw new Error('the validator materialized no prompt');
	return sent[0]!;
}

/** Each case's initial and repair prompt hashes, exactly as the runner records them (`CallLine.promptSha256`). */
async function casePromptsOf(
	seams: FingerprintSeams,
	cases: readonly QualificationCase[]
): Promise<Map<string, CasePrompts>> {
	const out = new Map<string, CasePrompts>();
	for (const c of cases) {
		let n = 0;
		const e = await seams.evaluate({
			case: c,
			criteria: seams.criteria,
			candidate: FINGERPRINT_CANDIDATE,
			scoringDigest: NO_DIGEST,
			call: async () => ({ returned: (n += 1) === 1 ? UNUSABLE : cleanJudgement(seams.criteria), served: null })
		});
		const [initial, repair] = e.calls;
		if (!initial || !repair) throw new Error(`${c.id}: the capture drew ${e.calls.length} call(s), not an initial and a repair`);
		out.set(c.id, { initial: initial.promptSha256, repair: repair.promptSha256 });
	}
	return out;
}

/**
 * ⭐ THE SCORING DIGEST — each corpus entry's outcome as the runner scores it (the disposition, the result class,
 * independence, each criterion's outcome), how many calls it drew and the malformation classes the harness detected in
 * each reply, never a statement or a clock; and the REPAIR INSTRUCTION every repaired entry drew, as the text appended
 * to its first prompt — so a change to the corpus case's own prompt moves no scoring digest, and a change to the
 * instruction does. ⚠ The classes are here because no record can re-detect them: a line keeps only their names, never
 * the reply they were read from (§5.3), so a detection change is visible only as a fingerprint move.
 */
async function scoringDigestOf(seams: FingerprintSeams): Promise<string> {
	const outcomes: unknown[] = [];
	const repairs: unknown[] = [];
	for (const entry of scoringCorpus(seams.criteria)) {
		const sent: string[] = [];
		let n = 0;
		const e = await seams.evaluate({
			case: CORPUS_CASE,
			criteria: seams.criteria,
			candidate: FINGERPRINT_CANDIDATE,
			scoringDigest: NO_DIGEST,
			call: async (p) => {
				sent.push(p);
				return { returned: entry.replies[Math.min(n++, entry.replies.length - 1)]!, served: null };
			}
		});
		const { scoringDigest: _stamp, ...scored } = e.scored;
		outcomes.push([entry.id, scored, e.calls.length, e.calls.map((c) => c.malformations)]);
		const [first, repair] = sent;
		if (first !== undefined && repair !== undefined)
			repairs.push([
				entry.id,
				repair.startsWith(first) ? { appended: repair.slice(first.length) } : { prompt: sha256(repair) }
			]);
	}
	return sha256(JSON.stringify({ outcomes, repairs }));
}

/** The case-set digest: each case's inputs as the reviewer-side assembly receives them — never its oracle, nor a note. */
export function caseSetDigest(cases: readonly QualificationCase[]): string {
	return sha256(
		JSON.stringify(cases.map((c) => ({ id: c.id, arm: c.arm, subject: c.subject, input: c.input })))
	);
}

/**
 * ⭐⭐ THE REVIEWER FINGERPRINT of today's reviewer, over `cases` — the one function the runner and the check share.
 * `seams` is the product's own everywhere but in the tests that show each component moves it.
 */
export async function reviewerFingerprint(
	cases: readonly QualificationCase[],
	seams: FingerprintSeams = PRODUCT_SEAMS
): Promise<ReviewerFingerprint> {
	const probePrompts = new Map<string, string>();
	for (const probe of FINGERPRINT_PROBES)
		probePrompts.set(probe.id, await probePrompt(seams, PROBE_SUBJECT, probe.input(seams.criteria)));
	const components: FingerprintComponents = {
		probes: sha256(JSON.stringify([...probePrompts].map(([id, p]) => [id, sha256(p)]))),
		budget: sha256(canonicalJson(seams.budget)),
		criteria: sha256(canonicalJson({ criteria: seams.criteria, independence: seams.independence })),
		scoring: await scoringDigestOf(seams)
	};
	return {
		reviewer: reviewerFingerprintOf(components),
		scoring: components.scoring,
		caseSet: caseSetDigest(cases),
		components,
		casePrompts: await casePromptsOf(seams, cases),
		probePrompts
	};
}

/** The committed CURRENT case set (`cases.ts`), read from the tree `root` names (a `file:` URL ending in `/`). */
export function committedCaseSet(root: URL): CaseSet {
	return JSON.parse(readFileSync(new URL(CURRENT_CASE_SET_FILE, root), 'utf8')) as CaseSet;
}

// `bun --conditions=source scripts/reviewer-qual/fingerprint.ts` — today's fingerprint of this tree, as JSON on stdout.
if (import.meta.main) {
	const f = await reviewerFingerprint(committedCaseSet(new URL('../../', import.meta.url)).cases);
	process.stdout.write(
		`${JSON.stringify({ reviewer: f.reviewer, scoring: f.scoring, caseSet: f.caseSet, components: f.components })}\n`
	);
}
