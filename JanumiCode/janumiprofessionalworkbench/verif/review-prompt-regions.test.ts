// ⭐⭐ `JAN-PRQUAL` `PQ-1` (`REG-F-481`; design D2 under the sponsor's answer (a) of 2026-10-03) — NO WORD OF THE HOST'S IS
// QUOTED: EVERY REGION OF EVERY REVIEW PROMPT IS ONE UNTRUSTED VALUE, ITS STATED SERIALIZATION, OR A DECLARED CUT OF ONE.
//
// The preamble tells the reviewer that every statement of this host stands outside all quoted material (`FENCE_MEANING`).
// ⛔ It was false in 82 of the 108 prompts the selected reviewer is measured on: the agent's account was fenced WHOLE as
// `renderRationale` renders it, so the host's labels ("Assumptions relied on:", …) and its "(none declared)" were quoted
// as the agent's words; and the graph's host-computed subject hash was merged into the fenced content. A reviewer
// holding the prompt to its own preamble was told the host's text was the agent's.
//
// ⭐ THE GENERAL PIN, not one instance of it: every prompt is read by the parse the preamble states — a line of the form
// `<<<UNTRUSTED-nn>>>` opens quoted material, the next IDENTICAL line closes it — and each region's text must be
//   · byte-equal to one untrusted value the input carries — the instruction, a graph's or work product's content, a
//     field of the account, the narration — or its STATED serialization (~~a list, or the prior findings, as one line of
//     JSON~~ a list's items each on a line of its own after `  - `; the prior findings as one line of JSON; a command's
//     argv as one line of JSON; a stream's bytes), or
//   · a DECLARED cut of one: its kept HEAD under the head-only declaration on the line before its fence, or a process
//     result's HEAD and TAIL under the head-and-tail declaration, each with the code points the declaration states.
// ⭐⭐ DESIGN §9.3 D7 (the sponsor's answers of 2026-10-05) — ~~`  - ` (`LIST_ITEM`) IS THE ONE HOST BYTE SEQUENCE A REGION
// MAY HOLD~~ A REGION MAY HOLD TWO HOST BYTE SEQUENCES, BOTH `renderRationale`'s FORMATTING, WHICH STATES NOTHING: `  - `
// (`LIST_ITEM`) before each item of a list, and the line feed that ends every item but the last (the agent wrote an
// array, not lines). The pin admits them there and nowhere else — the prefix before each item of a list's region, once,
// and one line feed between two items — so a region holding any other host byte still reddens here.
// Anything else in a region — a label, "(none declared)", a heading, the subject hash — is host text quoted. The values
// are taken from the INPUTS (and, for a process result, the run its builder rendered), never from the product's
// rendering, and read by a parser written here. ⭐ Held in every framing over literal inputs reaching every slice whole
// and cut, over the cases of the current set (initial and repair prompts) — case set v4's 40 since `JAN-PRQUAL` `PQ-2`, its
// process results read against their runs — and over every fingerprint probe.
// ⛔ NO MODEL IS REACHABLE: every prompt is captured at the validator's print seam, and PATH names an empty directory.
import { SEEDED_REASONING_REVIEW_CRITERIA, type ProfessionalRationaleSummary, type ReasoningReviewInput } from '@janumipwb/rph-assurance';
import type { ObservedToolCallReport } from '@janumipwb/rph-contracts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
	createAgyReasoningReviewValidator,
	CRITERION_REPAIR_INSTRUCTION
} from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { NO_FENCE_STATEMENT } from '../apps/rph-demo/src/lib/server/assurance/review-fence.js';
import { TEST_INDICATIONS } from '../apps/rph-demo/src/lib/server/assurance/indications.testing.js';
import { answerItems, pyStrip, sentences } from '../apps/rph-demo/src/lib/server/assurance/review-cuts.js';
import {
	graphReviewInput,
	processResultReviewInput,
	pwaTypeReviewInput,
	workProductReviewInput,
	type ProcessResultReviewSource
} from '../apps/rph-demo/src/lib/server/assurance/review-input.js';
import type { ObservedProcessRun } from '../apps/rph-demo/src/lib/server/tools/process-run-observer.js';
import { readFileSync } from 'node:fs';
import { CASE_SET_V7_FILE, type CaseSet } from '../scripts/reviewer-qual/cases.js';
import { committedCaseSet } from '../scripts/reviewer-qual/fingerprint.js';
import { caseReviewInput } from '../scripts/reviewer-qual/materialize.js';
import { FINGERPRINT_PROBES, PROBE_SUBJECT } from '../scripts/reviewer-qual/probes.js';
import { NO_PROGRAMS } from './reviewer-qualification-hermetic.js';
import { buildPwaGraphExport, pwaTypeParts, type PwaGraphNode } from '@janumipwb/rph-projections';

/** The three line breaks `JSON.stringify` leaves raw — built from their code points, so this file holds no escape. */
const RAW_BREAKS = new RegExp(`[${String.fromCharCode(0x85, 0x2028, 0x2029)}]`, 'g');
/**
 * ⭐ D7 — ~~THE ONE HOST BYTE SEQUENCE A REGION HOLDS~~ ONE OF THE TWO HOST BYTE SEQUENCES A REGION HOLDS: the prefix
 * `renderRationale` writes before each item of a list (the other is the line feed `listItems` joins two items with).
 * Named here, from the design, never read from the product: a validator that changed it would be quoting other host
 * bytes.
 */
const LIST_ITEM = '  - ';
/**
 * A list as the prompt states it carries it (D7): each item on a line of its own after `LIST_ITEM`, as the agent wrote it
 * — one line feed between two items, the host's.
 */
const listItems = (items: readonly string[]): string => items.map((item) => `${LIST_ITEM}${item}`).join('\n');
/** The prior findings or argv as the prompt states it carries them: one line of JSON, the three breaks escaped. */
const oneLineOfJson = (value: unknown): string =>
	JSON.stringify(value).replace(RAW_BREAKS, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
const codePoints = (s: string): number => [...s].length;

/** One quoted region as the stated parse reads it, with the host line before its opening fence and its line index. */
interface Region {
	readonly text: string;
	readonly before: string | undefined;
	readonly line: number;
}

/** `FENCE_MEANING`'s parse, written here: a fence-form line opens, the next IDENTICAL line closes, all between is text. */
function regionsOf(prompt: string): { readonly regions: Region[]; readonly lines: string[] } {
	const lines = prompt.split('\n');
	const regions: Region[] = [];
	for (let i = 0; i < lines.length; i += 1) {
		if (!/^<<<UNTRUSTED-\d\d>>>$/.test(lines[i]!)) continue;
		const close = lines.indexOf(lines[i]!, i + 1);
		expect(close, `a region opened at line ${i} is never closed`).toBeGreaterThan(i);
		regions.push({ text: lines.slice(i + 1, close).join('\n'), before: lines[i - 1], line: i });
		i = close;
	}
	return { regions, lines };
}

const HEAD_ONLY = /^\[CUT FOR THIS REVIEW: .+ — the first (\d+) of its (\d+) code points are shown; the last (\d+) are removed\.\]$/;
const HEAD_AND_TAIL =
	/^\[CUT FOR THIS REVIEW: .+ — the first (\d+) \(HEAD\) and the last (\d+) \(TAIL\) of its (\d+) code points are shown, in that order; the (\d+) between them are removed\.\]$/;

/** The untrusted values an input carries — from the INPUT, as the prompt states it carries each. */
function untrustedValues(input: ReasoningReviewInput, run?: ObservedProcessRun): string[] {
	const account: ProfessionalRationaleSummary | undefined = input.rationale;
	return [
		input.prompt,
		...(input.framing === 'PROCESS_RESULT' ? [] : [input.content]),
		...(account
			? [
					account.rationale,
					...[account.assumptions, account.limitations, account.residualUncertainty]
						.filter((xs) => xs.length > 0)
						.map(listItems)
				]
			: []),
		...(input.narration ? [input.narration] : []),
		...(input.prior?.gaps.length ? [oneLineOfJson(input.prior.gaps)] : []),
		...(run ? [oneLineOfJson(run.argv), run.stdout, run.stderr] : []),
		// ⭐ `JAN-EXEC` Phase 7, package N — D10 (`REG-D-135` (1)) — MOVED DELIBERATELY: and, in a review of the finished work, each
		// changed file's text, as the host read it — one value of its own, each between fence lines (its path is on a host line).
		...(input.framing === 'WORK_PRODUCT' ? (input.deliverable?.files ?? []).flatMap((f) => (f.content === undefined ? [] : [f.content])) : [])
	];
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package Z1 — D50 (`REG-D-146`; design §12.2, its region guard restated here for the block, as D43
 * asked of the pointers: *"admits a pointer statement as a stated derivation of one quoted input value under this rule, and
 * refuses a statement the rule cannot derive"*) — THE STATEMENTS THE INDICATIONS BLOCK MAY QUOTE: each a statement the screen's
 * cut derives from ONE value the input carries — the work product's answer, item by item (a JSON object's string values
 * sentence by sentence after `<key>: `, its other values as Python's `json.dumps` writes them), the account's prose sentence by
 * sentence, and each list's items as the prompt carries them, each stripped of the spaces and hyphens around it.
 * ⭑ Derived HERE from the INPUT, never from the product's rendering — through the cut's own pure readers of a value
 * (`answerItems`, `sentences`, `pyStrip`, CPython's measured semantics: `review-cuts.test.ts`), which read no host byte: a host
 * line can only reach a block region by being quoted. ⛔ A region of the block is held to these, and every other region to the
 * values and their stated serializations, as before: a derived statement anywhere else is still host-shaped text quoted.
 */
function derivableStatements(input: ReasoningReviewInput): string[] {
	const account = input.rationale;
	const listed = (items: readonly string[]): string[] =>
		listItems(items)
			.split('\n')
			.filter((x) => pyStrip(x) !== '')
			.map((x) => pyStrip(x, ' -'));
	return [
		...(input.framing === 'WORK_PRODUCT' ? answerItems(input.content).map((s) => s.text) : []),
		...(account ? [...sentences(account.rationale), ...listed(account.assumptions), ...listed(account.limitations), ...listed(account.residualUncertainty)] : [])
	];
}

/** ⭐ Z1 — a block entry's opening line: `Statement, <score>:`, the score in two decimals. */
const STATEMENT_ENTRY = /^Statement, -?\d+\.\d\d:$/;

/**
 * ⭐ THE PIN: every region of `prompt` is a value of `input` (or `run`), or a declared cut of one — and the host's subject
 * hash is in no region, on a host line of its own. ⭐⭐ Package Z1 — D50 — and each region of the indications block, a statement
 * derived from one value by the stated rule, or a declared head-only cut of one (`derivableStatements`).
 */
function expectNoHostTextQuoted(prompt: string, input: ReasoningReviewInput, what: string, run?: ObservedProcessRun): void {
	const untrusted = untrustedValues(input, run);
	const derived = derivableStatements(input);
	const { regions, lines } = regionsOf(prompt);
	expect(regions.length, `${what}: arrangement — the prompt quotes something`).toBeGreaterThan(0);
	for (let k = 0; k < regions.length; k += 1) {
		const r = regions[k]!;
		// ⭐ Z1 — a block entry: its score line just before the region, or before the declaration of its cut.
		const inBlock = STATEMENT_ENTRY.test(r.before ?? '') || (HEAD_ONLY.test(r.before ?? '') && STATEMENT_ENTRY.test(lines[r.line - 2] ?? ''));
		const values = inBlock ? derived : untrusted;
		if (inBlock && !values.includes(r.text) && !HEAD_ONLY.test(r.before ?? ''))
			expect.fail(`${what}: a block region is no statement the rule derives from a value — host text quoted? ${JSON.stringify(r.text.slice(0, 120))}`);
		if (values.includes(r.text)) continue;
		const head = HEAD_ONLY.exec(r.before ?? '');
		if (head) {
			const [kept, total, removed] = [Number(head[1]), Number(head[2]), Number(head[3])];
			const of = values.find((v) => v.startsWith(r.text) && codePoints(v) === total);
			expect(of, `${what}: a cut region is the HEAD of no value it declares: ${JSON.stringify(r.text.slice(0, 80))}`).toBeDefined();
			expect([codePoints(r.text), kept + removed], `${what}: the cut's declaration is false of its region`).toEqual([kept, total]);
			continue;
		}
		// A process result's HEAD and TAIL: `<declaration>`, `HEAD:`, the HEAD's region, `TAIL:`, the TAIL's region.
		const both = r.before === 'HEAD:' ? HEAD_AND_TAIL.exec(lines[r.line - 2] ?? '') : null;
		expect(both, `${what}: a region is no value and no declared cut of one — host text quoted? ${JSON.stringify(r.text.slice(0, 120))}`).not.toBeNull();
		const tail = regions[k + 1];
		expect(tail?.before, `${what}: a HEAD with no TAIL after it`).toBe('TAIL:');
		const [h, t, n, x] = [Number(both![1]), Number(both![2]), Number(both![3]), Number(both![4])];
		const of = values.find((v) => v.startsWith(r.text) && v.endsWith(tail!.text) && codePoints(v) === n);
		expect(of, `${what}: a HEAD and TAIL of no value they declare`).toBeDefined();
		expect([codePoints(r.text), codePoints(tail!.text), h + t + x], `${what}: the declaration is false of its HEAD and TAIL`).toEqual([h, t, n]);
		k += 1;
	}
	const hash = input.candidateSubjectHash;
	if (hash) {
		for (const r of regions) expect(r.text.includes(hash), `${what}: the host's subject hash is quoted`).toBe(false);
		expect(lines, `${what}: the subject hash is a host line`).toContain(`The candidate's subject hash (host-computed): ${hash}`);
	}
}

/**
 * The prompts the real validator sends for `input` — the initial, and the repair an unusable first reply draws.
 * ⭐ Package L — D13 (`REG-D-135` (3)): MOVED DELIBERATELY. A criterion repair now follows the JSON repair's parsed
 * reply as it follows a first one, so where the policy declares NO criterion (`NO-CRITERIA`), the clean repair
 * reply below answers none and draws I5's repair, unchanged: a third prompt, ending with I5's line, its regions read too.
 * ~~Exactly two prompts, an initial and a repair, for every input.~~ Every other input still sends exactly two.
 */
async function promptsOf(input: ReasoningReviewInput): Promise<string[]> {
	const sent: string[] = [];
	const validator = createAgyReasoningReviewValidator({
		agentId: 'jpwb-regions',
		modelId: 'jpwb-regions',
		providerId: 'jpwb-regions',
		clock: () => '1970-01-01T00:00:00.000Z',
		// ⭐ Package Z1 — D50 — a decision model, so the review is sent: its block's regions are read below like every other.
		indications: TEST_INDICATIONS,
		print: async (p) => {
			sent.push(p);
			return sent.length === 1
				? 'not a judgement'
				: JSON.stringify({
						findings: input.criteria.map((c) => ({ criterionId: c.id, failed: false, statement: 'absent' })),
						recommendation: 'SATISFIED'
					});
		}
	});
	await validator.evaluate(PROBE_SUBJECT, { reasoningReview: input });
	if (input.criteria.length === 0) {
		expect(sent, 'no criterion declared: an initial prompt, a repair and I5’s criterion repair').toHaveLength(3);
		expect(sent[2]!.endsWith(CRITERION_REPAIR_INSTRUCTION), 'the third prompt is I5’s repair').toBe(true);
		return sent;
	}
	expect(sent, 'an initial prompt and a repair').toHaveLength(2);
	return sent;
}

beforeAll(() => {
	// ⛔ No program can be found from this process: the validator's default print is `agyPrint`.
	vi.stubEnv('PATH', NO_PROGRAMS);
});
afterAll(() => {
	vi.unstubAllEnvs();
});

// ── the literal inputs: every framing, every slice whole and cut, every account shape ────────────────────────────────

const over = (limit: number, unit: string): string => unit.repeat(Math.ceil((limit + 700) / unit.length));
const ACCOUNT: ProfessionalRationaleSummary = {
	rationale: 'Each check runs against the design code; the suite is the whole verification.',
	assumptions: ['The suite is the one the project runs.', 'Its fixtures are current.'],
	limitations: ['The site survey is not checked.'],
	residualUncertainty: ['Whether the wind data is current.']
};
const SPARSE: ProfessionalRationaleSummary = { ...ACCOUNT, assumptions: [], limitations: [] };
const LONG: ProfessionalRationaleSummary = {
	rationale: over(4_000, 'Every panel was checked. '),
	assumptions: [over(1_500, 'An assumption. ')],
	limitations: ['One.'],
	residualUncertainty: [over(1_500, 'A doubt. ')]
};
/** ⭐ The limitations ALONE over their room — the one field the others' cuts never reach. */
const LIMITED: ProfessionalRationaleSummary = { ...ACCOUNT, limitations: [over(4_000, 'No intrusive investigation. ')] };
const PWA = { id: 'pwa_01M4A7K2QH8X9Z3T5V6W1B0C7D', name: 'Footbridge', domain: 'civil-engineering', version: '1.0.0', publicationStatus: 'DRAFT' } as const;
const GRAPH = buildPwaGraphExport(PWA as never, []);
/** ⭐ The review in parts, B2 — a type of a PWA with a child, and a type with many children, each as a part. */
const typeNode = (over: Partial<PwaGraphNode> & Pick<PwaGraphNode, 'id' | 'name'>): PwaGraphNode => ({
	pwuKind: 'STRUCTURAL_REVIEW',
	isRoot: false,
	permittedChildTypeIds: [],
	requiredInputs: [],
	requiredOutputs: [],
	executionBoundary: 'INTERNAL',
	...over
});
const PART = pwaTypeParts(
	buildPwaGraphExport(PWA as never, [
		typeNode({
			id: 'pwut_01M4A7K2QH8X9Z3T5V6W1B0C7E',
			name: 'Review',
			isRoot: true,
			purpose: 'Review the footbridge.',
			permittedChildTypeIds: ['pwut_01M4A7K2QH8X9Z3T5V6W1B0C7F'],
			requiredInputs: ['site-survey'],
			promptTemplate: { templateText: 'Review {title}.', outputContract: 'A review.', status: 'ACTIVE', templateVersion: 1 }
		}),
		typeNode({ id: 'pwut_01M4A7K2QH8X9Z3T5V6W1B0C7F', name: 'Survey', purpose: 'Survey the site.', requiredOutputs: ['site-survey'] })
	])
)[0]!;
const WIDE = pwaTypeParts(
	buildPwaGraphExport(PWA as never, [
		typeNode({
			id: 'pwut_01M4A7K2QH8X9Z3T5V6W1B0C70',
			name: 'Wide Review',
			isRoot: true,
			permittedChildTypeIds: Array.from({ length: 6 }, (_, i) => `pwut_01M4A7K2QH8X9Z3T5V6W1B0C8${i}`)
		}),
		...Array.from({ length: 6 }, (_, i) =>
			typeNode({ id: `pwut_01M4A7K2QH8X9Z3T5V6W1B0C8${i}`, name: `Check ${i}`, purpose: over(5_000, `Check ${i} of the deck. `) })
		)
	])
)[0]!;
const ONE_CALL: ObservedToolCallReport = {
	observation: 'OBSERVED',
	calls: [{ ordinal: 1, nameProvenance: 'MINTED_BY_HOST', toolName: 'run_command', outcome: 'COMPLETED' }],
	observedCount: 1,
	recordedLimit: 32
};
const run = (fields: Partial<ObservedProcessRun> = {}): ObservedProcessRun => ({
	ordinal: 1,
	argv: ['pytest', '-rs', 'checks/'],
	exitCode: 1,
	timedOut: false,
	durationMs: 1532,
	outputComplete: true,
	omittedRegions: [],
	retention: { retained: false, notRetainedBecause: 'a fixture: nothing reads the capture here' },
	stdout: '3 failed, 45 passed\n',
	stderr: 'E   AssertionError\n',
	...fields
});

const LITERALS: readonly { readonly what: string; readonly input: ReasoningReviewInput; readonly run?: ObservedProcessRun }[] = (() => {
	const criteria = SEEDED_REASONING_REVIEW_CRITERIA;
	const pr = (what: string, r: ObservedProcessRun, rest: Partial<ProcessResultReviewSource> = {}) => ({
		what,
		run: r,
		input: processResultReviewInput({ criteria, producingPrompt: 'Run the checks.', run: r, rationale: ACCOUNT, observedToolCalls: ONE_CALL, ...rest })
	});
	return [
		...[ACCOUNT, SPARSE, LONG, undefined].flatMap((account, i) => [
			{
				what: `PWA_GRAPH, account ${i}`,
				input: graphReviewInput({
					criteria,
					prompt: i === 2 ? over(4_000, 'Design it. ') : 'Design the review.',
					graph: GRAPH,
					candidateSubjectHash: 'sha256:0f1e2d3c4b5a6978',
					...(account ? { rationale: account } : {}),
					narration: i === 2 ? over(2_000, 'Defined a type. ') : 'Defined the types.',
					priorGaps: i === 2 ? [over(2_000, 'A gap. ')] : ['RR-02: the check is missing.']
				})
			},
			{
				what: `WORK_PRODUCT, account ${i}`,
				input: workProductReviewInput({
					criteria,
					producingPrompt: 'Summarise the load analysis.',
					answer: i === 2 ? over(30_000, 'The deck carries the load. ') : 'The deck carries the load.',
					...(account ? { rationale: account } : {}),
					priorGaps: ['RR-04: asserted, not shown.']
				})
			}
		]),
		// ⭐ The review in parts, B2 — a part, under every account shape, and a part whose children's skeletons are cut.
		...[ACCOUNT, SPARSE, LONG, undefined].map((account, i) => ({
			what: `PWA_TYPE, account ${i}`,
			input: pwaTypeReviewInput({
				criteria,
				prompt: i === 2 ? over(4_000, 'Design it. ') : 'Design the review.',
				part: PART,
				candidateSubjectHash: 'sha256:0f1e2d3c4b5a6978',
				...(account ? { rationale: account } : {}),
				narration: i === 2 ? over(2_000, 'Defined a type. ') : 'Defined the types.',
				priorGaps: i === 2 ? [over(2_000, 'A gap. ')] : ['RR-02: the check is missing.']
			})
		})),
		{
			what: 'PWA_TYPE, its children’s skeletons cut child by child',
			input: pwaTypeReviewInput({ criteria, prompt: 'Compose them.', part: WIDE, rationale: ACCOUNT })
		},
		pr('PROCESS_RESULT, whole', run()),
		pr('PROCESS_RESULT, a sparse account, a narration and a prior', run(), { rationale: SPARSE, narration: 'Ran the suite.', priorGaps: ['RR-07'] }),
		pr('PROCESS_RESULT, an oversize account', run(), { rationale: LONG }),
		pr('PROCESS_RESULT, the limitations alone over their room', run(), { rationale: LIMITED }),
		{
			what: 'WORK_PRODUCT, the limitations alone over their room',
			input: workProductReviewInput({
				criteria,
				producingPrompt: 'Summarise the load analysis.',
				answer: 'The deck carries the load.',
				rationale: LIMITED
			})
		},
		pr('PROCESS_RESULT, no account', run(), { rationale: undefined }),
		pr('PROCESS_RESULT, a review cut of both streams', run({ stdout: over(40_000, 'checks/test_deck.py::test_load PASSED\n'), stderr: over(30_000, 'warning\n') })),
		pr(
			'PROCESS_RESULT, a capture cut and a review cut',
			run({
				stdout: over(30_000, 'PASSED\n'),
				omittedRegions: [{ stream: 'STDOUT', reason: 'capture bound', byteOffset: 65_536, byteSize: 9_000 }]
			})
		),
		pr('PROCESS_RESULT, a long command line', run({ argv: ['pytest', ...Array.from({ length: 4_000 }, (_, i) => `checks/test_${i}.py`)] })),
			// ⭐⭐ `JAN-EXEC` Phase 7, package N — D10, D12 (`REG-D-135` (1)) — MOVED DELIBERATELY: the finished work beside the answer,
			// whole and cut unit by unit, and a command's place in the step's sequence, whose lines are the host's and quote nothing.
			{
				what: 'WORK_PRODUCT, the finished work: a changed file, an added one and a removed one, and the sequence',
				input: workProductReviewInput({
					criteria,
					producingPrompt: 'Summarise the load analysis.',
					answer: 'The deck carries the load.',
					rationale: ACCOUNT,
					deliverable: {
						afterTry: 2,
						files: [
							{ path: 'docs/load.md', change: 'CHANGED', content: '# Load\n5.0 kN/m².\n' },
							{ path: 'docs/vibration.md', change: 'ADDED', content: '# Vibration\n2.1 Hz.\n' },
							{ path: 'docs/draft.md', change: 'REMOVED' }
						],
						sequence: {
							acts: [
								{ try: 1, ordinal: 1, kind: 'RUN', argv: ['cat', 'docs/load.md'], exitCode: 0, timedOut: false },
								{ try: 2, ordinal: 2, kind: 'WRITE', path: 'docs/vibration.md' }
							],
							droppedRuns: 0,
							recordedLimit: 32
						}
					}
				})
			},
			{
				what: 'WORK_PRODUCT, the finished work over its budget: each file’s text cut unit by unit, each cut declared',
				input: workProductReviewInput({
					criteria,
					producingPrompt: 'Summarise the load analysis.',
					answer: 'The deck carries the load.',
					rationale: ACCOUNT,
					deliverable: {
						afterTry: 1,
						files: Array.from({ length: 4 }, (_, i) => ({ path: `docs/p${i}.md`, change: 'ADDED' as const, content: over(9_000, `Panel ${i} checked. `) })),
						sequence: { acts: [], droppedRuns: 0, recordedLimit: 32 }
					}
				})
			},
			pr('PROCESS_RESULT, its place in the step’s sequence', run({ ordinal: 2 }), {
				hostSequence: {
					acts: [
						{ try: 1, ordinal: 1, kind: 'WRITE', path: 'checks/test_deck.py' },
						{ try: 1, ordinal: 2, kind: 'RUN', argv: ['pytest', '-rs', 'checks/'], exitCode: 1, timedOut: false }
					],
					droppedRuns: 0,
					recordedLimit: 32,
					subjectOrdinal: 2
				}
			})
	];
})();

describe('⭐⭐ JAN-PRQUAL PQ-1 (REG-F-481) — no host text inside quoted material: every region is an untrusted value or a declared cut of one', () => {
	it.each(LITERALS.map((l) => [l.what, l] as const))('⭐ %s — initial and repair prompt', async (_what, l) => {
		for (const p of await promptsOf(l.input)) expectNoHostTextQuoted(p, l.input, l.what, l.run);
	});

	it('⭐ the arrangement reaches what it must: the account’s four cuts, a HEAD and TAIL, a head-only cut of every other slice, an empty list, the hash', async () => {
		const all = (await Promise.all(LITERALS.map(async (l) => (await promptsOf(l.input))[0]!))).join('\n');
		for (const needle of [
			"[CUT FOR THIS REVIEW: the account's rationale — ",
			"[CUT FOR THIS REVIEW: the account's assumptions — ",
			"[CUT FOR THIS REVIEW: the account's limitations — ",
			"[CUT FOR THIS REVIEW: the account's residual uncertainty — ",
			'[CUT FOR THIS REVIEW: the intent — ',
			// ⭐ The review in parts, B2 — a part's request, and its children's skeletons, each cut child by child.
			'[CUT FOR THIS REVIEW: the request — ',
			// ⭐ A2 (3) — ~~'the skeleton of the child '~~: a child by its ordinal and type id.
			'[CUT FOR THIS REVIEW: the skeleton of child ',
			'[CUT FOR THIS REVIEW: the work product — ',
			// ⭐ Package N — D10: a changed file's text, cut unit by unit beside the answer.
			'[CUT FOR THIS REVIEW: the text of "docs/p0.md" — ',
			'[CUT FOR THIS REVIEW: the narration — ',
			'[CUT FOR THIS REVIEW: the prior findings — ',
			'[CUT FOR THIS REVIEW: stdout — the first ',
			'[CUT FOR THIS REVIEW: stderr — the first ',
			'[CUT FOR THIS REVIEW: the command line — the first ',
			'[CUT BY THE CAPTURE: stdout — ',
			'Assumptions relied on: (none declared)',
			"The candidate's subject hash (host-computed): "
		])
			expect(all.includes(needle), needle).toBe(true);
	});

	// ⭐ `JAN-PRQUAL` `PQ-2` (DESIGN-process-result-qualification.md D4) — and the 14 process-result cases of case set v4, each
	// read against the run its builder rendered, as every process-result probe is (below).
	// ⭐ `JAN-EXEC` Phase 7 completion E2 — ~~the 40 cases of case set v4~~ the 54 of case set v5: and its fourteen declared-policy
	// cases, each its work one line of JSON in one region (`declaredPolicyReviewInput`).
	// ⭐ `JAN-EXEC` Phase 7 completion, round 5 — ~~case set v5~~ the current set, version six since round 5: version five
	// with ~~D-FP-CLEAN repaired as D6-FP-CLEAN (`REG-D-115`)~~ ⭐ four cases repaired, each under a new id — D6-RC-CLEAN,
	// D6-RC-04, D6-FP-CLEAN and D6-FP-03 (`REG-D-115` and its delegated extension) — fifty-four cases still.
	// ⭐ `JAN-EXEC` Phase 7 after P6's third run, package P, F3 — ~~54~~ the 60 of case set v7, current since package P: and its
	// six graph cases whose types declare their work, each graph its content's one region (`REG-D-123` Q25).
	// ⭐ The review in parts, B7 — ~~the 60 of case set v7~~ the 76 of case set v8, current since B7: version seven's 41
	// non-graph cases and 35 part cases (`REG-D-126`), each part its subject, context and children's skeletons in one region;
	// ⭐ and, as history, version seven's 19 graph cases, which still materialize through their builder.
	// ⭐⭐ `JAN-EXEC` Phase 7, before P6 again, package V (`REG-D-136`) — ~~the 76 of case set v8~~ the 91 of case set v12, current
	// since package V: version eleven's 35 part cases, and 56 shown what production now hands each review (design D14) — the 24
	// work products their finished-work view, the 18 process results their places in their steps' sequences, the 14 sign-offs
	// their files and sequence.
	// ⭐⭐ Package V-2, 2026-10-29 (`REG-D-137` Q46; design D29) — ~~the 91 of case set v12~~ the 94: and its three re-run cases
	// after the 91, two work products their re-run's finished-work view and a sign-off its files and sequence, each marked.
	it('⭐ the ~~76~~ ~~91~~ ⭐ 94 cases of the current case set — initial and repair prompt, each process result read against its run, each declared case its work one region, each part case its part one region; and version seven’s graph cases', async () => {
		const cases = committedCaseSet(new URL('../', import.meta.url)).cases;
		// ~~expect(cases).toHaveLength(91);~~ ⭐ Package V-2, 2026-10-29: and the three re-run cases.
		// ~~expect(cases).toHaveLength(94);~~ — 2026-10-31, package Y: v13 has 97 cases, 27 work products and 20 commands; every prompt region remains checked.
		expect(cases).toHaveLength(97);
		expect(cases.filter((c) => c.arm === 'PWA_TYPE'), 'the 35 part cases').toHaveLength(35);
		expect(cases.filter((c) => c.arm === 'PWA_GRAPH'), 'no graph case').toHaveLength(0);
		// ~~'the 24 work-product cases'~~ ⭐ Package V-2, 2026-10-29: and the two re-run work cases.
		// ~~expect(cases.filter((c) => c.arm === 'WORK_PRODUCT'), 'the 26 work-product cases').toHaveLength(26);~~ — 2026-10-31, package Y: v13 has 97 cases, 27 work products and 20 commands; every prompt region remains checked.
		expect(cases.filter((c) => c.arm === 'WORK_PRODUCT'), 'the 27 work-product cases').toHaveLength(27);
		// ~~expect(cases.filter((c) => c.arm === 'PROCESS_RESULT'), 'the ~~14~~ 18 process-result cases').toHaveLength(18);~~ — 2026-10-31, package Y: v13 has 97 cases, 27 work products and 20 commands; every prompt region remains checked.
		expect(cases.filter((c) => c.arm === 'PROCESS_RESULT'), 'the ~~14~~ 20 process-result cases').toHaveLength(20);
		// ~~'the 14 declared-policy cases'~~ ⭐ Package V-2, 2026-10-29: and the sign-off after the re-run.
		expect(cases.filter((c) => c.arm === 'DECLARED_POLICY'), 'the 15 declared-policy cases').toHaveLength(15);
		const v7Graphs = (JSON.parse(readFileSync(new URL(`../${CASE_SET_V7_FILE}`, import.meta.url), 'utf8')) as CaseSet).cases.filter(
			(c) => c.arm === 'PWA_GRAPH'
		);
		expect(v7Graphs, 'version seven’s 19 graph cases').toHaveLength(19);
		for (const c of [...cases, ...v7Graphs]) {
			const input = caseReviewInput(c, SEEDED_REASONING_REVIEW_CRITERIA);
			const run = c.arm === 'PROCESS_RESULT' ? c.input.run : undefined;
			for (const p of await promptsOf(input)) expectNoHostTextQuoted(p, input, c.id, run);
		}
	}, 120_000);

	/** ⭐ Package Z1 — D52: the probes refused past a bound of the measured section's room, and the bound each passes. ⛔ MOVED 2026-11-09 (`JAN-EXEC` Phase 7, package L4 — D56; `REG-D-149`): the whole
	 *  bound ~~33000~~ 35500. */
	const PAST_A_BOUND_OF_THE_ROOM: Readonly<Record<string, RegExp>> = {
		'T-ACCOUNT-BREAKS': /^This review was not sent: its growth beyond today’s prompt would be \d+ characters, past its bound of 9500 \(REG-D-146; D52\)/,
		'W-ACCOUNT-BREAKS': /^This review was not sent: its growth beyond today’s prompt would be \d+ characters, past its bound of 9500 \(REG-D-146; D52\)/,
		'P-ACCOUNT-BREAKS': /^This review was not sent: its growth beyond today’s prompt would be \d+ characters, past its bound of 9500 \(REG-D-146; D52\)/,
		'P-OVERSIZE-SURROGATE': /^This review was not sent: its whole prompt would be \d+ characters, past its bound of 35500 \(REG-D-146; D52\)/,
		'P-OVERSIZE-ROOM-EDGES': /^This review was not sent: its whole prompt would be \d+ characters, past its bound of 35500 \(REG-D-146; D52\)/,
		'P-OVERSIZE-ALL': /^This review was not sent: its whole prompt would be \d+ characters, past its bound of 35500 \(REG-D-146; D52\)/
	};
	it('⭐ every fingerprint probe — each process result read against the run its builder rendered', async () => {
		for (const probe of FINGERPRINT_PROBES) {
			let rendered: ObservedProcessRun | undefined;
			const input = probe.input(SEEDED_REASONING_REVIEW_CRITERIA, (source) => {
				rendered = source.run;
				return processResultReviewInput(source);
			});
			expect(input.framing === 'PROCESS_RESULT', `${probe.id}: a process result was rendered through the builder`).toBe(
				rendered !== undefined
			);
			// ⭐ `PQ-1` (`REG-F-481`) — ~~`G-NO-FENCE`~~ ⭐ B7: `T-NO-FENCE`, `W-NO-FENCE` and `P-NO-FENCE` each print every fence
			// candidate, one in each framing, so the validator refuses each before any prompt exists: there is no region to read,
			// and the refusal is what is asserted (the fingerprint hashes it).
			if (['T-NO-FENCE', 'W-NO-FENCE', 'P-NO-FENCE'].includes(probe.id)) {
				await expect(promptsOf(input), `${probe.id}: refused, no prompt sent`).rejects.toThrow(NO_FENCE_STATEMENT);
				continue;
			}
			// ⭐ B7 — and `T-SUBJECT-REFUSED`, a subject no prompt can hold, refused whole before any prompt (design D3).
			if (probe.id === 'T-SUBJECT-REFUSED') {
				await expect(promptsOf(input), `${probe.id}: refused, no prompt sent`).rejects.toThrow('This review was not sent: the part it was handed');
				continue;
			}
			// ⭐⭐ `JAN-EXEC` Phase 7, package Z1 — D52 (`REG-D-146`; design §12.4) — and the six whose measured prompt passes a bound
			// of its room: the three account-breaks probes, past 9,500 characters of growth beyond today's prompt, and the three
			// held at `CONTENT_MIN` past ~~33,000~~ 35,500 characters whole. Each is refused before any prompt exists — no indication is
			// dropped to fit — so there is no region to read, and the refusal is what is asserted, as for the four above.
			const pastABound = PAST_A_BOUND_OF_THE_ROOM[probe.id];
			if (pastABound !== undefined) {
				await expect(promptsOf(input), `${probe.id}: refused past its bound, no prompt sent`).rejects.toThrow(pastABound);
				continue;
			}
			for (const p of await promptsOf(input)) expectNoHostTextQuoted(p, input, probe.id, rendered);
		}
	}, 120_000);

	it('⭑ CONTROL — the pin sees host text quoted: an account fenced whole, labels and all, and a hash merged into the content', () => {
		const input = graphReviewInput({
			criteria: SEEDED_REASONING_REVIEW_CRITERIA,
			prompt: 'Design the review.',
			graph: GRAPH,
			candidateSubjectHash: 'sha256:0f1e2d3c4b5a6978',
			rationale: ACCOUNT
		});
		const F = '<<<UNTRUSTED-00>>>';
		const whole = `x\n${F}\n${input.prompt}\n${F}\n${F}\n${ACCOUNT.rationale}\n\nAssumptions relied on:\n  - a\n${F}\nThe candidate's subject hash (host-computed): sha256:0f1e2d3c4b5a6978`;
		expect(() => expectNoHostTextQuoted(whole, input, 'control')).toThrow(/host text quoted/);
		const merged = `x\n${F}\n${input.prompt}\n${F}\n${F}\n{"candidateSubjectHash":"sha256:0f1e2d3c4b5a6978"}\n${F}\n`;
		expect(() => expectNoHostTextQuoted(merged, { ...input, content: '{"candidateSubjectHash":"sha256:0f1e2d3c4b5a6978"}' }, 'control')).toThrow(
			/the host's subject hash is quoted/
		);
	});

	it('⭑ CONTROL (design §9.3 D7) — the pin admits `  - ` before each item of a list, and one line feed between two, and nothing else: another prefix, another join, a label, or a list as JSON is host text quoted', () => {
		const input = graphReviewInput({ criteria: SEEDED_REASONING_REVIEW_CRITERIA, prompt: 'Design the review.', graph: GRAPH, rationale: ACCOUNT });
		const F = '<<<UNTRUSTED-00>>>';
		const withList = (region: string) => `x\n${F}\n${input.prompt}\n${F}\nAssumptions relied on:\n${F}\n${region}\n${F}\n`;
		// ⭑ The arrangement: the list as D7 renders it passes.
		expect(() => expectNoHostTextQuoted(withList(ACCOUNT.assumptions.map((a) => `  - ${a}`).join('\n')), input, 'control')).not.toThrow();
		for (const region of [
			ACCOUNT.assumptions.map((a) => `- ${a}`).join('\n'),
			ACCOUNT.assumptions.map((a) => `  * ${a}`).join('\n'),
			// ⭐ Another join: the line feed between two items is the host's too, and the pin admits ONE there, nothing else.
			ACCOUNT.assumptions.map((a) => `  - ${a}`).join('\n\n'),
			ACCOUNT.assumptions.map((a) => `  - ${a}`).join(' '),
			`Assumptions relied on:\n${ACCOUNT.assumptions.map((a) => `  - ${a}`).join('\n')}`,
			JSON.stringify(ACCOUNT.assumptions)
		])
			expect(() => expectNoHostTextQuoted(withList(region), input, 'control'), JSON.stringify(region)).toThrow(/host text quoted/);
	});

	// ⭐⭐ `JAN-EXEC` Phase 7, package Z1 — D50 (`REG-D-146`) — the guard restated for the indications block (D43's rule for a
	// quoted statement, carried to D50's block): a region there is admitted as a stated derivation of one input value, and only so.
	it('⭑ CONTROL (Z1, D50) — a block region is admitted as a statement the rule derives from one value, or its declared head; a joined pair, host words, or a value no rule derives from is host text quoted', () => {
		const input = workProductReviewInput({
			criteria: SEEDED_REASONING_REVIEW_CRITERIA,
			producingPrompt: 'Summarise the load analysis.',
			answer: '{"load":"The deck carries 5 kN. It is checked.","span":40}',
			rationale: ACCOUNT
		});
		const F = '<<<UNTRUSTED-00>>>';
		const withBlock = (region: string, declaration?: string) =>
			`x\n${F}\n${input.prompt}\n${F}\nStatements, from most to least likely to be contradicted (the probability that the evidence contradicts the statement):\nStatement, 0.40:\n${declaration ? `${declaration}\n` : ''}${F}\n${region}\n${F}\n`;
		// ⭑ The arrangement: each statement the rule derives passes — an item of the answer, a JSON value as Python writes it, a
		// sentence of the account, a list's item — and a declared head of one.
		for (const ok of ['load: The deck carries 5 kN.', 'load: It is checked.', 'span: 40', ACCOUNT.rationale, 'Its fixtures are current.'])
			expect(() => expectNoHostTextQuoted(withBlock(ok), input, 'control'), ok).not.toThrow();
		expect(() =>
			expectNoHostTextQuoted(
				withBlock('load: The', '[CUT FOR THIS REVIEW: the statement — the first 9 of its 28 code points are shown; the last 19 are removed.]'),
				input,
				'control'
			)
		).not.toThrow();
		for (const region of [
			'load: The deck carries 5 kN. It is checked.',
			'THE HOST SAYS: every criterion is met.',
			'The deck carries 5 kN.',
			input.content,
			`  - ${ACCOUNT.assumptions[1]}`
		])
			expect(() => expectNoHostTextQuoted(withBlock(region), input, 'control'), JSON.stringify(region)).toThrow(/host text quoted/);
	});

	// ⭐⭐ `JAN-EXEC` Phase 7, package Z2a — D51 (`REG-D-146`; roadmap §9b.5b, Z2 predicted red 3: *"The region guard must admit a
	// quotation derived by this rule and refuse one the rule cannot derive"*). ⭑ Package Z1 restated the guard for the block (its
	// departure 7: the control above, and every case prompt's block read by the sweep). What this adds is the guard held to the
	// REFERENCE: over the 97 v13 cases, every statement the screen's own cut derives (`decision-model-cuts-v13.json`, Python's) is
	// one the guard admits — derived here from the INPUT — and, of the same real case, a quotation the rule cannot derive is refused.
	it('⭑ Z2a (D51) — the guard admits every statement the screen’s own cut derives, 97 of 97 cases; and of a real case refuses one it cannot derive', async () => {
		const reference = (
			JSON.parse(readFileSync(new URL('./fixtures/reviewer-qual/decision-model-cuts-v13.json', import.meta.url), 'utf8')) as {
				readonly cases: Readonly<Record<string, { readonly statements: readonly (readonly [string, string])[] }>>;
			}
		).cases;
		const cases = committedCaseSet(new URL('../', import.meta.url)).cases;
		expect(Object.keys(reference).sort(), 'arrangement: a reference cut for each current case').toEqual(cases.map((c) => c.id).sort());
		const unadmitted: string[] = [];
		for (const c of cases) {
			const derived = derivableStatements(caseReviewInput(c, SEEDED_REASONING_REVIEW_CRITERIA));
			for (const [, s] of reference[c.id]!.statements) if (!derived.includes(s)) unadmitted.push(`${c.id}: ${s.slice(0, 60)}`);
		}
		expect(unadmitted, 'statements the screen cut that the guard would refuse as host text').toEqual([]);
		const c = cases.find((x) => x.id === 'W12-CSV-CLEAN')!;
		const input = caseReviewInput(c, SEEDED_REASONING_REVIEW_CRITERIA);
		const [first, second] = reference[c.id]!.statements.map(([, s]) => s);
		const F = '<<<UNTRUSTED-00>>>';
		const withBlock = (region: string) =>
			`x\n${F}\n${input.prompt}\n${F}\nStatements, from most to least likely to be contradicted (the probability that the evidence contradicts the statement):\nStatement, 0.40:\n${F}\n${region}\n${F}\n`;
		expect(() => expectNoHostTextQuoted(withBlock(first!), input, 'W12-CSV-CLEAN'), 'arrangement: its first statement is admitted').not.toThrow();
		for (const region of [`${first!} ${second!}`, input.prompt, `${first!}.`])
			expect(() => expectNoHostTextQuoted(withBlock(region), input, 'W12-CSV-CLEAN'), JSON.stringify(region.slice(0, 80))).toThrow(/host text quoted/);
	});
});
