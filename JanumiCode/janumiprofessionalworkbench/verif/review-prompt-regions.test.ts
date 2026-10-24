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
import { createAgyReasoningReviewValidator } from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { NO_FENCE_STATEMENT } from '../apps/rph-demo/src/lib/server/assurance/review-fence.js';
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
		...(run ? [oneLineOfJson(run.argv), run.stdout, run.stderr] : [])
	];
}

/**
 * ⭐ THE PIN: every region of `prompt` is a value of `input` (or `run`), or a declared cut of one — and the host's subject
 * hash is in no region, on a host line of its own.
 */
function expectNoHostTextQuoted(prompt: string, input: ReasoningReviewInput, what: string, run?: ObservedProcessRun): void {
	const values = untrustedValues(input, run);
	const { regions, lines } = regionsOf(prompt);
	expect(regions.length, `${what}: arrangement — the prompt quotes something`).toBeGreaterThan(0);
	for (let k = 0; k < regions.length; k += 1) {
		const r = regions[k]!;
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

/** The prompts the real validator sends for `input` — the initial, and the repair an unusable first reply draws. */
async function promptsOf(input: ReasoningReviewInput): Promise<string[]> {
	const sent: string[] = [];
	const validator = createAgyReasoningReviewValidator({
		agentId: 'jpwb-regions',
		modelId: 'jpwb-regions',
		providerId: 'jpwb-regions',
		clock: () => '1970-01-01T00:00:00.000Z',
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
		pr('PROCESS_RESULT, a long command line', run({ argv: ['pytest', ...Array.from({ length: 4_000 }, (_, i) => `checks/test_${i}.py`)] }))
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
	it('⭐ the 76 cases of the current case set — initial and repair prompt, each process result read against its run, each declared case its work one region, each part case its part one region; and version seven’s graph cases', async () => {
		const cases = committedCaseSet(new URL('../', import.meta.url)).cases;
		expect(cases).toHaveLength(76);
		expect(cases.filter((c) => c.arm === 'PWA_TYPE'), 'the 35 part cases').toHaveLength(35);
		expect(cases.filter((c) => c.arm === 'PWA_GRAPH'), 'no graph case').toHaveLength(0);
		expect(cases.filter((c) => c.arm === 'PROCESS_RESULT'), 'the 14 process-result cases').toHaveLength(14);
		expect(cases.filter((c) => c.arm === 'DECLARED_POLICY'), 'the 14 declared-policy cases').toHaveLength(14);
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
});
