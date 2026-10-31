// ⭐⭐ `JAN-EXEC` Phase 7, package O-2 — D28 (`REG-D-137`, Q46; `REG-F-583`; `DESIGN-data-flow-order-and-deliverable-review.md` D28,
// revision 4) — A RE-RUN'S WORDING, RENDERED.
//
// ⭑ WHAT MUST HOLD, read off the prompt the real validator sends at its print seam (the stub answers every criterion met):
//   · a work-product review whose deliverable is marked a work re-run (`Deliverable.workRerun`: its files are counted from an
//     EARLIER step's baseline, the unit's first) says, in its subject and in its changed-files heading, that the files are
//     counted from the unit's first step, that a file an earlier step changed ~~is~~ ⭐ CAN BE among them (package O-2's check,
//     finding 1, below), and that the sequence shown is this step's alone — and, with no file changed, "since its first step
//     began";
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
/**
 * ⭐ D28 — A WORK RE-RUN'S SUBJECT: the files counted from the unit's first step, ~~an earlier step's among them~~ ⭐ an earlier
 * step's CAN be among them, the sequence this step's alone. ⛔ MOVED 2026-10-26 (package O-2's check, finding 1): ~~"— so a file an
 * earlier step changed is among them —"~~, false of a marked view that lists no file, or whose every file this step changed.
 */
const RERUN_SUBJECT =
	"The WORK PRODUCT to review — what a professional work unit produced by running the instruction above, in a step that re-runs its work: the agent's answer, then the files the unit changed in its workspace since its first step began, as the host read them after this step's last try — so a file an earlier step changed can be among them — then this step's writes and runs in the host's order, which are this step's alone. Judge each criterion below — whether the obligation the instruction delegates is discharged, whether any of it is dropped, whether its scope is narrowed, among them — against this whole deliverable: the files as they now stand, never as an earlier command read them. The answer:";
/** ⛔ Today's changed-files heading, byte for byte (`deliverableHeading`), after try `n`. */
const firstStepHeading = (n: number): string =>
	`The files the unit changed in its workspace since its step began, as the host read them after try ${n}. Each path, as JSON, and what changed are the host's record; each file's text, between fence lines, is the file's own:`;
/**
 * ⭐ D28 — a work re-run's changed-files heading, after try `n` of this step. ⛔ MOVED 2026-10-26 (package O-2's check, finding 1):
 * ~~"— so a file an earlier step changed is among them,"~~, false of a marked view whose every file this step changed.
 */
const rerunHeading = (n: number): string =>
	`The files the unit changed in its workspace since its first step began, as the host read them after try ${n} of this step — so a file an earlier step changed can be among them, and the writes and runs below are this step's alone. Each path, as JSON, and what changed are the host's record; each file's text, between fence lines, is the file's own:`;
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
/**
 * ⭐ D28 — the clause a declared subject gains when some unit of its work is marked a work re-run, before its colon. ⛔ MOVED
 * 2026-10-26 (package O-2's check, finding 1): ~~", so a file an earlier step changed is among them,"~~, false of a marked unit
 * that changed no file, or whose every file its re-run changed.
 */
const RERUN_CLAUSE =
	'; and a work product marked "workRerun" was made by a step that re-ran its unit’s work: that unit’s "files" are counted from its first step, so a file an earlier step changed can be among them, and its "sequence" is that step’s alone';
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

// ── ⛔ package O-2's check, finding 1 (2026-10-26) — A MARKED VIEW IS NEVER TOLD THAT A FILE AN EARLIER STEP CHANGED *IS* AMONG ITS FILES ──
// The mark says where a view's files are counted FROM — the unit's first step — never which step changed which of them: the host
// keeps that baseline's hashes alone, and a re-run takes no manifest at its own start (`unitBaselineOf`), so it cannot know
// whether an earlier step changed any file the view lists. ⛔ The re-run's words said one IS among them, whatever the record held:
// a marked view listing no file read "— so a file an earlier step changed is among them —" above "The unit changed no file in its
// workspace since its first step began", the host's record contradicting itself in front of the reviewer (`REG-F-583`'s class),
// and a view whose every file this step wrote was told an earlier step's was among them. ⭑ A unit that changes no file is
// production's common shape: 13 of v12's 24 W12 cases and 10 of its 14 D12 cases change none.
describe('⛔ package O-2’s check, finding 1 — a marked view is told a file an earlier step changed CAN be among its files, never that one IS', () => {
	/** The words that say an earlier step's file stands in the list, whatever the record holds. */
	const IS_AMONG = 'an earlier step changed is among them';
	/** A re-run's view whose one file THIS step wrote: no earlier step changed a file it lists. */
	const OWN_FILE: Deliverable = {
		afterTry: 1,
		files: [{ path: 'docs/required.md', change: 'ADDED', content: '# Required\nR1. Count each word.\n' }],
		sequence: { acts: [{ try: 1, ordinal: 1, kind: 'WRITE', path: 'docs/required.md' }], droppedRuns: 0, recordedLimit: 32 }
	};

	it('⛔ a marked view that lists NO file: its subject says an earlier step’s file can be among them, above the line that none changed', async () => {
		const p = await promptOf(workProduct({ ...NO_FILE, workRerun: true }));
		expect(p, 'a marked view listing no file is told a file an earlier step changed is among them').not.toContain(IS_AMONG);
		expect(p, 'arrangement: the subject is the re-run’s').toContain(RERUN_SUBJECT);
		expect(p.split('\n'), 'arrangement: the line for no file changed').toContain(rerunNoFile(2));
	});

	it('⛔ a marked view whose every file THIS step wrote: neither its subject nor its heading says an earlier step’s file is among them', async () => {
		const p = await promptOf(workProduct({ ...OWN_FILE, workRerun: true }));
		expect(p, 'a marked view whose every file this step wrote is told a file an earlier step changed is among them').not.toContain(IS_AMONG);
		expect(p, 'arrangement: the subject is the re-run’s').toContain(RERUN_SUBJECT);
		expect(p.split('\n'), 'arrangement: the heading is the re-run’s').toContain(rerunHeading(1));
		expect(p, 'arrangement: this step’s sequence holds the write of the one file it lists').toContain('Try 1:\n  1. wrote "docs/required.md"');
	});

	it('⛔ a declared work whose marked unit changed NO file: the clause says an earlier step’s file can be among that unit’s, never that one is', async () => {
		const p = await promptOf(declared(['Design']));
		expect(productsShown(p), 'arrangement: the unit that changed no file is the marked one').toEqual([
			['Requirements', undefined],
			['Design', true]
		]);
		expect(p, 'arrangement: the marked unit changed no file').not.toContain('"workUnit":"Design","path"');
		expect(p, 'a marked unit that changed no file is told a file an earlier step changed is among its files').not.toContain(IS_AMONG);
		expect(p, 'arrangement: the subject says what the mark means').toContain(`with the exit the host recorded${RERUN_CLAUSE}:`);
	});
});

// ── ⭐⭐ `JAN-EXEC` Phase 7, package X — D31 (`REG-D-140`; `REG-F-589`; design §10.3, D31, revision 5) — THE MARKS, RENDERED ─────────────
// ⛔ RED BEFORE THE BUILD: a work re-run's view could say only where its files are counted from (D28), so a file this step only read
// stood on the same line as one it wrote, and v12's selected reviewer passed a claimed fix to a file only read 3 of 3. ⭐ D31: in a
// work re-run's view whose files carry marks (`DeliverableFile.inThisStep`, the host's record of what this step did to each), the mark
// stands on the file's host line, and one clause in the re-run's heading says what the marks mean (design §10.3's illustrative
// wording). ⛔ A first step's view, and a re-run's view recorded before package X — which carries no mark — read as before, byte for
// byte: the unmarked controls above stay as they are.
describe('⭐⭐ package X — D31: a work re-run’s view whose files carry marks shows each on its file’s host line, and its heading says what they mean — only there', () => {
	/** ⭐ D31 — the clause the marked re-run's heading gains, restated byte for byte (design §10.3's illustrative wording). */
	const MARKS_CLAUSE =
		'Beside each path, the host says what this step did to that file, against the workspace as the host read it when this step began.';
	/** ⭐ D31 — a marked re-run's changed-files heading, after try `n` of this step: D28's, the clause before its last sentence. */
	const markedHeading = (n: number): string =>
		`The files the unit changed in its workspace since its first step began, as the host read them after try ${n} of this step — so a file an earlier step changed can be among them, and the writes and runs below are this step's alone. ${MARKS_CLAUSE} Each path, as JSON, and what changed are the host's record; each file's text, between fence lines, is the file's own:`;
	/**
	 * A work re-run's view after its first try, a file of each mark: the draft its refused attempt wrote, rewritten here; a file the
	 * unit's first step found, removed here; the notes added here; and the required document its refused attempt wrote, which this
	 * step only read. Each is counted from the unit's first step (D22), so each is listed as added or removed.
	 */
	const MARKED: Deliverable = {
		afterTry: 1,
		files: [
			{ path: 'docs/draft.md', change: 'ADDED', content: '# Final\n', inThisStep: 'CHANGED' },
			{ path: 'docs/gone.md', change: 'REMOVED', inThisStep: 'REMOVED' },
			{ path: 'docs/notes.md', change: 'ADDED', content: '# Notes\n', inThisStep: 'ADDED' },
			{ path: 'docs/required.md', change: 'ADDED', content: '# Required\nR1. Count each word.\n', inThisStep: 'UNCHANGED' }
		],
		sequence: {
			acts: [
				{ try: 1, ordinal: 1, kind: 'RUN', argv: ['cat', 'docs/required.md'], exitCode: 0, timedOut: false },
				{ try: 1, ordinal: 2, kind: 'WRITE', path: 'docs/draft.md' },
				{ try: 1, ordinal: 3, kind: 'WRITE', path: 'docs/notes.md' },
				{ try: 1, ordinal: 4, kind: 'RUN', argv: ['rm', 'docs/gone.md'], exitCode: 0, timedOut: false }
			],
			droppedRuns: 0,
			recordedLimit: 32
		},
		workRerun: true
	};
	/** Each file's host line in the marked view, restated byte for byte: its change since the unit began, then this step's mark. */
	const MARKED_LINES = [
		'Added "docs/draft.md" — changed in this step:',
		'Removed "docs/gone.md" — removed in this step: it is no longer in the workspace.',
		'Added "docs/notes.md" — added in this step:',
		'Added "docs/required.md" — the same as when this step began:'
	] as const;
	/** The same lines as an unmarked view writes them (`deliverableFileLine`, as before). */
	const UNMARKED_LINES = ['Added "docs/draft.md":', 'Removed "docs/gone.md": it is no longer in the workspace.', 'Added "docs/notes.md":', 'Added "docs/required.md":'] as const;
	/** `view` with every mark taken off its files: a view as the host recorded one before package X. */
	const unmarked = (view: Deliverable): Deliverable => ({ ...view, files: view.files.map(({ inThisStep: _mark, ...f }) => f) });
	/** The words only a marked view's prompt holds. */
	const MARK_WORDS = ['in this step:', 'the same as when this step began', MARKS_CLAUSE] as const;

	it('⭐ THE PREDICTED RED — a marked re-run’s view: each file’s line carries its mark, byte for byte, and the heading says what the marks mean', async () => {
		const lines = (await promptOf(workProduct(MARKED))).split('\n');
		for (const line of MARKED_LINES) expect(lines, `a file’s line does not carry its mark: ${line}`).toContain(line);
		expect(lines, 'the marked heading does not say what the marks mean').toContain(markedHeading(1));
	});

	it('⭑ CONTROL — the same view, its marks taken off (a view recorded before package X), is the re-run’s prompt as before; the marked prompt differs from it at the heading’s clause and the four file lines alone', async () => {
		const before = await promptOf(workProduct(unmarked(MARKED)));
		expect(before.split('\n'), 'an unmarked re-run’s heading moved').toContain(rerunHeading(1));
		for (const line of UNMARKED_LINES) expect(before.split('\n'), `an unmarked re-run’s file line moved: ${line}`).toContain(line);
		for (const words of MARK_WORDS) expect(before, `an unmarked re-run’s review reads a mark: ${words}`).not.toContain(words);
		let marked = (await promptOf(workProduct(MARKED))).replace(markedHeading(1), rerunHeading(1));
		MARKED_LINES.forEach((line, i) => (marked = marked.replace(`\n${line}\n`, `\n${UNMARKED_LINES[i]}\n`)));
		expect(marked, 'the marked prompt differs from the unmarked one in more than its marks and its clause').toBe(before);
	});

	it('⭑ CONTROL — a FIRST step’s view whose files carry marks (a record the host never writes): today’s first-step prompt, byte for byte — no mark, no clause', async () => {
		const { workRerun: _rerun, ...firstStep } = MARKED;
		const p = await promptOf(workProduct(firstStep));
		expect(p, 'a first step’s view shows a mark').toBe(await promptOf(workProduct(unmarked(firstStep))));
		expect(p.split('\n'), 'arrangement: the first step’s heading').toContain(firstStepHeading(1));
		for (const words of MARK_WORDS) expect(p, `a first step’s review reads a mark: ${words}`).not.toContain(words);
	});

	it('⭑ CONTROL — a re-run’s view in which only SOME files carry a mark (a record the host never writes): read as unmarked — the clause, of every path, would be false of the others', async () => {
		const some: Deliverable = { ...MARKED, files: MARKED.files.map(({ inThisStep, ...f }, i) => (i === 0 ? { ...f, inThisStep } : f)) };
		expect(some.files.filter((f) => f.inThisStep !== undefined), 'arrangement: one file of four carries a mark').toHaveLength(1);
		expect(await promptOf(workProduct(some)), 'a view marked in part shows its marks').toBe(await promptOf(workProduct(unmarked(MARKED))));
	});

	it('⭑ CONTROL — the declared review is not extended (design D31): a sign-off whose unit’s files carry the marks its re-run’s view recorded reads as the same work unmarked, byte for byte', async () => {
		// The files as the route builds a sign-off's from the recorded view (`{ unit, ...f }`, `+page.server.ts`): marks and all.
		const signOff = (files: readonly { readonly unit: string; readonly path: string; readonly change: Deliverable['files'][number]['change']; readonly content?: string }[]) =>
			declaredPolicyReviewInput({
				policy: POLICY,
				criteria: CRITERIA,
				instruction: 'Realize the word-frequency tool from its requirements through its design.',
				instructionIs: 'UNIT_PURPOSE',
				workProducts: [{ unit: 'Requirements', answer: 'Requirements: done', workRerun: true }],
				commands: [],
				files,
				sequence: MARKED.sequence.acts.map((a) => ({ unit: 'Requirements', ...a }))
			});
		const marked = MARKED.files.map((f) => ({ unit: 'Requirements', ...f }));
		expect(marked.filter((f) => f.inThisStep !== undefined), 'arrangement: each file carries its mark').toHaveLength(4);
		const p = await promptOf(signOff(marked));
		expect(p, 'arrangement: the sign-off shows the files').toContain('"workUnit":"Requirements","path":"docs/draft.md","change":"ADDED"');
		expect(p, 'a sign-off’s prompt carries a re-run’s mark').toBe(await promptOf(signOff(marked.map(({ inThisStep: _mark, ...f }) => f))));
		for (const words of MARK_WORDS) expect(p, `a sign-off reads a mark: ${words}`).not.toContain(words);
	});

	it('⭐ a marked list too long to show whole: the list is cut, declared after the marked heading, each shown line carries its mark — and the prompt stays within its budget', async () => {
		const files = Array.from({ length: 400 }, (_, i) => ({
			path: `docs/m${String(i).padStart(3, '0')}.md`,
			change: 'ADDED' as const,
			content: '# M\n',
			inThisStep: i % 2 === 0 ? ('UNCHANGED' as const) : ('ADDED' as const)
		}));
		const p = await promptOf(workProduct({ ...MARKED, files }));
		expect(p.length, 'the marked prompt passed its budget').toBeLessThanOrEqual(REASONING_REVIEW_BUDGET.PROMPT_BUDGET);
		const lines = p.split('\n');
		const at = lines.indexOf(markedHeading(1));
		expect(at, 'the marked heading').toBeGreaterThan(-1);
		const cut = /^\[CUT FOR THIS REVIEW: the changed files — the first (\d+) of the 400 are shown; the last (\d+) are removed\.\]$/.exec(lines[at + 1] ?? '');
		expect(cut, 'the list’s cut is not declared after the marked heading').not.toBeNull();
		const shown = Number(cut![1]);
		const fileLines = lines.filter((l) => /^Added "docs\/m\d{3}\.md"/.test(l));
		expect(fileLines, 'the shown files are not those the cut declares').toHaveLength(shown);
		fileLines.forEach((l, i) =>
			expect(l, `a shown file’s line lost its mark: ${l}`).toBe(`Added "docs/m${String(i).padStart(3, '0')}.md" — ${i % 2 === 0 ? 'the same as when this step began' : 'added in this step'}:`)
		);
	});

	it('⭐ the clause’s and the marks’ own words: no criterion id and no disposition value (REG-D-090); they ask the reviewer to find nothing (REG-D-105 (2)); ⭑ the readers find each in a text that holds it', () => {
		const criterionId = /\b[A-Z]{2,3}-\d\d\b/;
		const looksForAFailure = /\b(look|search|hunt)\b[^.;]*\bfor\b[^.;]*\bfailure/i;
		const asksToFind = /\bfind\b/i;
		const dispositions = ['SATISFIED', 'CONDITIONALLY_SATISFIED', 'REJECTED', 'INCONCLUSIVE', 'ESCALATED'];
		for (const text of [MARKS_CLAUSE, ...MARKED_LINES]) {
			for (const d of dispositions) expect(text.toUpperCase(), `${text}: names ${d}`).not.toContain(d);
			expect(text, `${text}: names a criterion id`).not.toMatch(criterionId);
			expect(text, `${text}: speaks of looking for a failure`).not.toMatch(looksForAFailure);
			expect(text, `${text}: asks the reviewer to find something`).not.toMatch(asksToFind);
		}
		// ⭑ THE POSITIVE CONTROLS: each reader finds what it reads for in a text that holds it.
		expect(`- ${SEEDED_REASONING_REVIEW_CRITERIA[0]!.id}: ${SEEDED_REASONING_REVIEW_CRITERIA[0]!.description}`).toMatch(criterionId);
		expect('look in each file for a failure').toMatch(looksForAFailure);
		expect('find the defect').toMatch(asksToFind);
		for (const d of dispositions) expect(`recommend ${d.toLowerCase()} here`.toUpperCase(), d).toContain(d);
	});
});
