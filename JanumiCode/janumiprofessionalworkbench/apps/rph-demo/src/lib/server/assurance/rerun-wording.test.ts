// ⭐⭐ `JAN-EXEC` Phase 7, package O-2 — D28 (`REG-D-137`, Q46; `REG-F-583`; `DESIGN-data-flow-order-and-deliverable-review.md` D28,
// revision 4) — A RE-RUN'S WORDING, RENDERED.
//
// ⭑ WHAT MUST HOLD, read off the prompt the real validator sends at its print seam (the stub answers every criterion met):
//   · a work-product review whose deliverable is marked a work re-run (`Deliverable.workRerun`: its files are counted from an
//     EARLIER step's baseline, the unit's first) says, in its subject and in its changed-files heading, that the files are
//     counted from the unit's first step, that a file an earlier step changed is among them, and that the sequence shown is
//     this step's alone — and, with no file changed, "since its first step began";
//   · a declared review whose work holds a unit so marked shows the mark on that unit's work product, and its subject gains one
//     clause saying what the mark means — only then;
//   · ⛔ UNMARKED, EACH PROMPT IS TODAY'S, BYTE FOR BYTE (every confirmed case of v12 is a first step's): each control below
//     holds the marked prompt to the unmarked one with nothing between them but the re-run's own words.
// ⭑ Each expected sentence is RESTATED here, never imported, so a change to the product's words reddens this file.
// ⛔ NO MODEL IS REACHABLE: every prompt is captured at the validator's print seam.
import { SEEDED_REASONING_REVIEW_CRITERIA, type AssuranceSubject, type Deliverable, type ReasoningReviewInput } from '@janumipwb/rph-assurance';
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import { createAgyReasoningReviewValidator, REASONING_REVIEW_BUDGET } from './reasoning-review-validator.js';
import { declaredPolicyReviewInput, workProductReviewInput } from './review-input.js';

const SUBJECT: AssuranceSubject = {
	subjectId: 'pwu_01K5QFBR8Z0000000000000O21',
	objectType: 'PROFESSIONAL_WORK_UNIT',
	semanticVersion: 1,
	isAiProduced: true,
	producer: { actorType: 'AGENT', agentId: 'model:producer', modelId: 'producer-model', providerId: 'producer' }
};

/** The prompt the real validator sends for `input`, captured at its print seam; the stub answers every criterion met. */
async function promptOf(input: ReasoningReviewInput): Promise<string> {
	let seen = '';
	await createAgyReasoningReviewValidator({
		print: async (p) => {
			seen = p;
			return JSON.stringify({
				findings: input.criteria.map((c) => ({ criterionId: c.id, failed: false, statement: 'met' })),
				recommendation: 'SATISFIED',
				residualUncertainty: []
			});
		},
		modelId: 'jpwb-judge'
	}).evaluate(SUBJECT, { reasoningReview: input });
	return seen;
}

// ── the work-product review ──────────────────────────────────────────────────────────────────────────────────────────────────

/** ⛔ TODAY'S SUBJECT, BYTE FOR BYTE (`WORK_PRODUCT_DELIVERABLE_SUBJECT`) — a first step's, which D28 leaves as it is. */
const FIRST_STEP_SUBJECT =
	"The WORK PRODUCT to review — what a professional work unit produced by running the instruction above: the agent's answer, then the files the unit changed in its workspace since its step began, as the host read them after its last try, then the step's writes and runs in the host's order. Judge each criterion below — whether the obligation the instruction delegates is discharged, whether any of it is dropped, whether its scope is narrowed, among them — against this whole deliverable: the files as they now stand, never as an earlier command read them. The answer:";
/** ⭐ D28 — A WORK RE-RUN'S SUBJECT: the files counted from the unit's first step, an earlier step's among them, the sequence this step's alone. */
const RERUN_SUBJECT =
	"The WORK PRODUCT to review — what a professional work unit produced by running the instruction above, in a step that re-runs its work: the agent's answer, then the files the unit changed in its workspace since its first step began, as the host read them after this step's last try — so a file an earlier step changed is among them — then this step's writes and runs in the host's order, which are this step's alone. Judge each criterion below — whether the obligation the instruction delegates is discharged, whether any of it is dropped, whether its scope is narrowed, among them — against this whole deliverable: the files as they now stand, never as an earlier command read them. The answer:";
/** ⛔ Today's changed-files heading, byte for byte (`deliverableHeading`), after try `n`. */
const firstStepHeading = (n: number): string =>
	`The files the unit changed in its workspace since its step began, as the host read them after try ${n}. Each path, as JSON, and what changed are the host's record; each file's text, between fence lines, is the file's own:`;
/** ⭐ D28 — a work re-run's changed-files heading, after try `n` of this step. */
const rerunHeading = (n: number): string =>
	`The files the unit changed in its workspace since its first step began, as the host read them after try ${n} of this step — so a file an earlier step changed is among them, and the writes and runs below are this step's alone. Each path, as JSON, and what changed are the host's record; each file's text, between fence lines, is the file's own:`;
/** ⛔ Today's line for a view in which no file changed, byte for byte. */
const firstStepNoFile = (n: number): string =>
	`The unit changed no file in its workspace since its step began, as the host read it after try ${n}.`;
/** ⭐ D28 — a work re-run's line for a view in which no file changed. */
const rerunNoFile = (n: number): string =>
	`The unit changed no file in its workspace since its first step began, as the host read it after try ${n} of this step; the writes and runs below are this step's alone.`;
/** The words only a re-run's prompt holds: none may reach a first step's. */
const RERUN_WORDS = ['since its first step began', 'an earlier step changed', "this step's alone", 'in a step that re-runs its work'] as const;

/**
 * A work re-run's finished work, after its first try: the file a refused earlier attempt wrote, which this step left alone —
 * counted from the unit's first step (D22) — and this step's one act, a run of the check. ⛔ The sequence shows no write of the
 * file: the contradiction `REG-F-583` names, unless the review is told the sequence is this step's alone.
 */
const INHERITED: Deliverable = {
	afterTry: 1,
	files: [{ path: 'docs/required.md', change: 'ADDED', content: '# Required\nR1. Count each word.\n' }],
	sequence: {
		acts: [{ try: 1, ordinal: 1, kind: 'RUN', argv: ['node', '--test'], exitCode: 0, timedOut: false }],
		droppedRuns: 0,
		recordedLimit: 32
	}
};
const NO_FILE: Deliverable = { afterTry: 2, files: [], sequence: { acts: [], droppedRuns: 0, recordedLimit: 32 } };

const workProduct = (deliverable: Deliverable) =>
	workProductReviewInput({
		criteria: SEEDED_REASONING_REVIEW_CRITERIA,
		producingPrompt: 'Write the required document and check it with the suite.',
		answer: '{"done":"the required document is in place; the check passes"}',
		rationale: {
			rationale: 'The earlier attempt wrote the required document; this step left it as it was and ran the check, which passed.',
			assumptions: [],
			limitations: [],
			residualUncertainty: []
		},
		deliverable
	});

describe('⭐⭐ package O-2 — D28: a work-product review of a work re-run says its files are counted from the unit’s FIRST step, and its sequence is this step’s alone', () => {
	it('⭐ THE PREDICTED RED — a re-run’s view that inherits a file: the subject and the changed-files heading say so', async () => {
		const p = await promptOf(workProduct({ ...INHERITED, workRerun: true }));
		expect(p, 'the subject does not say the files are counted from the unit’s first step').toContain(RERUN_SUBJECT);
		expect(p.split('\n'), 'the heading does not say the files are counted from the unit’s first step').toContain(rerunHeading(1));
		expect(p, 'a re-run’s review still reads the first step’s words').not.toContain('since its step began');
		// ⭑ The file and the sequence are shown as before: what is said of them moved, never what is shown.
		expect(p.split('\n')).toContain('Added "docs/required.md":');
		expect(p).toContain('Try 1:\n  1. ran ["node","--test"] — exit 0');
	});

	it('⭑ CONTROL — the same view unmarked is today’s, byte for byte: the first step’s subject and heading, no word of the re-run’s — and nothing else between the two prompts', async () => {
		const first = await promptOf(workProduct(INHERITED));
		expect(first, 'a first step’s subject moved').toContain(FIRST_STEP_SUBJECT);
		expect(first.split('\n'), 'a first step’s heading moved').toContain(firstStepHeading(1));
		for (const words of RERUN_WORDS) expect(first, `a first step’s review reads the re-run’s words: ${words}`).not.toContain(words);
		const rerun = await promptOf(workProduct({ ...INHERITED, workRerun: true }));
		expect(
			rerun.replace(RERUN_SUBJECT, FIRST_STEP_SUBJECT).replace(rerunHeading(1), firstStepHeading(1)),
			'the re-run’s prompt differs from the first step’s in more than its own two sentences'
		).toBe(first);
	});

	it('⭐ THE PREDICTED RED — a re-run’s view in which no file changed: “since its first step began”, and the sequence this step’s alone', async () => {
		const p = await promptOf(workProduct({ ...NO_FILE, workRerun: true }));
		expect(p, 'the subject does not say the files are counted from the unit’s first step').toContain(RERUN_SUBJECT);
		expect(p.split('\n'), 'the line for no file changed does not say “since its first step began”').toContain(rerunNoFile(2));
		expect(p).toContain('(none: the host completed no write and no run for the agent in this step)');
	});

	it('⭑ CONTROL — unmarked, no file changed, the line is today’s, byte for byte', async () => {
		const first = await promptOf(workProduct(NO_FILE));
		expect(first.split('\n'), 'a first step’s line for no file changed moved').toContain(firstStepNoFile(2));
		for (const words of RERUN_WORDS) expect(first, `a first step’s review reads the re-run’s words: ${words}`).not.toContain(words);
		const rerun = await promptOf(workProduct({ ...NO_FILE, workRerun: true }));
		expect(rerun.replace(RERUN_SUBJECT, FIRST_STEP_SUBJECT).replace(rerunNoFile(2), firstStepNoFile(2))).toBe(first);
	});
});

// ── the declared review ──────────────────────────────────────────────────────────────────────────────────────────────────────

const criterion = (id: string, severityIfNotMet: 'BLOCKING' | 'MATERIAL' | 'ADVISORY'): AssessmentCriterion =>
	({
		id,
		name: id,
		description: `Requirement ${id} is covered.`,
		criterionType: 'QUALITATIVE',
		evaluationMethod: 'MODEL_JUDGMENT',
		requiredEvidenceIds: [],
		severityIfNotMet,
		mayBeNotApplicable: false
	}) as AssessmentCriterion;
const CRITERIA = [criterion('RC-01', 'BLOCKING'), criterion('RC-02', 'MATERIAL')];
const POLICY = {
	policyId: 'pol_requirement_coverage',
	name: 'Requirement Coverage',
	purpose: 'Determine whether approved outcomes are represented by requirements or explicitly excluded.'
};
/** ⛔ The end of today's declared subject, byte for byte: the files' description closes on the exit, then the colon. */
const FIRST_STEP_SUBJECT_END = 'and the path written or the command run with the exit the host recorded:';
/** ⭐ D28 — the clause a declared subject gains when some unit of its work is marked a work re-run, before its colon. */
const RERUN_CLAUSE =
	'; and a work product marked "workRerun" was made by a step that re-ran its unit’s work: that unit’s "files" are counted from its first step, so a file an earlier step changed is among them, and its "sequence" is that step’s alone';
/** ⭐ D28 — the mark, on the marked unit's work product, as the work's line of JSON carries it. */
const MARK = ',"workRerun":true';

const declared = (rerunUnits: readonly string[], answerSize = 0) => {
	const units = ['Requirements', 'Design'] as const;
	return declaredPolicyReviewInput({
		policy: POLICY,
		criteria: CRITERIA,
		instruction: 'Realize the word-frequency tool from its requirements through its design.',
		instructionIs: 'UNIT_PURPOSE',
		workProducts: units.map((unit) => ({
			unit,
			answer: `${unit}: done${'w'.repeat(answerSize)}`,
			...(rerunUnits.includes(unit) ? { workRerun: true as const } : {})
		})),
		commands: [{ unit: 'Requirements', argv: ['node', '--test'], exitCode: 0, timedOut: false }],
		// The file the Requirements unit's refused earlier attempt wrote: its re-run's sequence holds no write of it.
		files: [{ unit: 'Requirements', path: 'docs/required.md', change: 'ADDED', content: '# Required\n' }],
		sequence: [{ unit: 'Requirements', try: 1, ordinal: 1, kind: 'RUN', argv: ['node', '--test'], exitCode: 0, timedOut: false }]
	});
};
/** The work products the prompt's line of JSON shows, each with whether it carries the mark. */
const productsShown = (prompt: string) => {
	const lines = prompt.split('\n').filter((l) => l.startsWith('{"workProducts":'));
	expect(lines, 'arrangement: the prompt shows its work on one line').toHaveLength(1);
	return (JSON.parse(lines[0]!) as { workProducts: { workUnit: string; workRerun?: unknown }[] }).workProducts.map((w) => [
		w.workUnit,
		w.workRerun
	]);
};

describe('⭐⭐ package O-2 — D28: a declared review marks a work re-run’s unit on the work’s line, and says what the mark means only when one is marked', () => {
	it('⭐ THE PREDICTED RED — a work holding a unit marked a work re-run: the mark on that unit’s work product alone, and the clause in the subject', async () => {
		const p = await promptOf(declared(['Requirements']));
		expect(productsShown(p), 'the re-run unit’s work product is not marked, or another unit’s is').toEqual([
			['Requirements', true],
			['Design', undefined]
		]);
		expect(p, 'the subject does not say what the mark means').toContain(`with the exit the host recorded${RERUN_CLAUSE}:`);
	});

	it('⭑ CONTROL — the same work with no unit marked is today’s, byte for byte: no mark, no clause — and nothing else between the two prompts', async () => {
		const first = await promptOf(declared([]));
		expect(first, 'a first step’s subject moved').toContain(FIRST_STEP_SUBJECT_END);
		expect(first, 'the clause stands where no unit is marked').not.toContain('workRerun');
		const rerun = await promptOf(declared(['Requirements']));
		expect(rerun.replace(RERUN_CLAUSE, '').replace(MARK, ''), 'the marked prompt differs in more than its mark and its clause').toBe(first);
	});

	it('⭐ the clause is said once, however many units are marked', async () => {
		const p = await promptOf(declared(['Requirements', 'Design']));
		expect(productsShown(p)).toEqual([
			['Requirements', true],
			['Design', true]
		]);
		expect(p.split(RERUN_CLAUSE).length - 1, 'the clause is not said exactly once').toBe(1);
	});

	it('⭐ the mark survives the builder’s unit-by-unit cut: work over its budget keeps each marked unit’s mark on its cut work product', async () => {
		const input = declared(['Design'], REASONING_REVIEW_BUDGET.CONTENT_MAX);
		expect(input.declaredWorkCut, 'arrangement: the work was cut unit by unit').toBeDefined();
		const p = await promptOf(input);
		expect(productsShown(p), 'the cut lost the mark, or gave it to another unit').toEqual([
			['Requirements', undefined],
			['Design', true]
		]);
		expect(p, 'the cut work’s subject does not say what the mark means').toContain(`with the exit the host recorded${RERUN_CLAUSE}:`);
		expect(p.length, 'the prompt passed its budget').toBeLessThanOrEqual(REASONING_REVIEW_BUDGET.PROMPT_BUDGET);
	});
});
