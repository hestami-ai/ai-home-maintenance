// ⭐⭐ `JAN-EXEC` Phase 7, package N — D10, D12 (`REG-D-135` (1); `REG-F-579`; `REG-F-522` remedy candidate 2;
// `DESIGN-data-flow-order-and-deliverable-review.md` D10, D12) — THE PROMPTS, RENDERED.
//
// ⭑ WHAT MUST HOLD, read off the prompt the real validator sends at its print seam — the deterministic stub reviewer's
// input — and off the builders' own inputs:
//   · D12 — each command's review asks whether what the account says about THIS command's result, and what it means, is
//     borne out given its place in the step's sequence (the other writes and runs on host lines: number, path or command,
//     exit); a statement about the unit's obligation supports no finding there either way; a command the account says
//     nothing about passes. The preamble and the RR labels stay the policy's; today's obligation sentence is gone.
//     Shapes: run-12 case 08's listing (`ls`, judged against the design obligation) and case 19's `package.json` read.
//   · D10 — the review of the finished work is shown the files the unit changed (added, changed, removed) and their text
//     as the host read them, and the step's sequence with try boundaries, within today's budget, cut unit by unit with each
//     cut declared on its own line before its bytes and counted in its allowance.
// ⛔ NO MODEL IS REACHABLE: every prompt is captured at the validator's print seam.
import { SEEDED_REASONING_REVIEW_CRITERIA, type ProfessionalRationaleSummary, type ReasoningReviewInput } from '@janumipwb/rph-assurance';
import type { AssuranceSubject } from '@janumipwb/rph-assurance';
import { describe, expect, it } from 'vitest';
import type { ObservedProcessRun } from '../tools/process-run-observer.js';
import { createAgyReasoningReviewValidator, REASONING_REVIEW_BUDGET } from './reasoning-review-validator.js';
import { processResultReviewInput, workProductReviewInput } from './review-input.js';

const SUBJECT: AssuranceSubject = {
	subjectId: 'evd_01K5QFBR8Z0000000000000N01',
	objectType: 'EVIDENCE',
	semanticVersion: 1,
	isAiProduced: true,
	producer: { actorType: 'AGENT', agentId: 'execution.process-run:evd', modelId: 'producer-model', providerId: 'producer' }
};

/** ⭐ D12's scoping sentence, BYTE FOR BYTE — restated, never imported (`PROCESS_RESULT_SCOPE`). */
const SCOPE =
	"Judge each criterion below on that question alone. Whether the unit's work discharges the instruction is judged by the review of its finished work, not here: a statement about the unit's obligation, another command or a file supports no finding here either way, and a command the account says nothing about meets each criterion here.";
/** ⭐ D12's intent, BYTE FOR BYTE — restated (`PROCESS_RESULT_INTENT`). */
const INTENT =
	"A DIFFERENT AI agent was given the instruction below, and in carrying it out it chose to RUN COMMANDS in its workspace. You are reviewing ONE of them: whether what the agent's account says about THIS command's result, and what it means, is borne out by the result and its place among the step's writes and runs:";
/** ⛔ Today's obligation sentence, as `DESIGN-process-result-qualification.md` D2 kept it — gone under D12. */
const OBLIGATION_SENTENCE = 'You are reviewing one command result and the account the agent gave of its work';
/** ⭑ The shared preamble's obligation question — the POLICY's (`R14`, `ASR-4`), which D12 leaves standing. */
const PREAMBLE = 'You ask whether the artifact genuinely discharges its delegated professional obligation, or merely produces a';

const run = (over: Partial<ObservedProcessRun>): ObservedProcessRun => ({
	ordinal: 1,
	argv: ['ls'],
	exitCode: 0,
	timedOut: false,
	durationMs: 61,
	outputComplete: true,
	omittedRegions: [],
	retention: { retained: false, notRetainedBecause: 'a fixture: nothing reads the capture here' },
	stdout: '',
	stderr: '',
	...over
});

/** A design unit's account — the shape of run-12 case 08's, its words the fixture's own. */
const DESIGN_ACCOUNT: ProfessionalRationaleSummary = {
	rationale: 'The design converts the approved requirements into module contracts, an error and exit mapping, and traceability to each requirement.',
	assumptions: ['The requirements are authoritative.'],
	limitations: ['The design does not modify the current implementation.'],
	residualUncertainty: []
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

describe('⭐⭐ package N — D12: a command’s review asks what the account says of THIS result, in its place in the step’s sequence', () => {
	// ⭐ Run-12 case 08: a technical-design unit's `ls`, REJECTED on RR-09 — "the only observable artifact in the reviewed
	// result is a trivial `ls` directory listing" — judged against the design obligation. Its sequence: the listing, then the
	// write of the design document.
	const CASE_08 = processResultReviewInput({
		criteria: SEEDED_REASONING_REVIEW_CRITERIA,
		producingPrompt: 'Produce the technical design for the word-frequency command-line tool, as docs/design.md.',
		run: run({ argv: ['ls'], stdout: 'README.md\nbin\ndocs\npackage.json\nscripts\nsrc\ntest\n' }),
		rationale: DESIGN_ACCOUNT,
		hostSequence: {
			acts: [
				{ try: 1, ordinal: 1, kind: 'RUN', argv: ['ls'], exitCode: 0, timedOut: false },
				{ try: 1, ordinal: 2, kind: 'WRITE', path: 'docs/design.md' }
			],
			droppedRuns: 0,
			recordedLimit: 32,
			subjectOrdinal: 1
		}
	} as Parameters<typeof processResultReviewInput>[0]);
	// ⭐ Run-12 case 19: an implementation unit's read of a pre-existing `package.json` ("type": "commonjs"), REJECTED,
	// which the unit then rewrote.
	const CASE_19 = processResultReviewInput({
		criteria: SEEDED_REASONING_REVIEW_CRITERIA,
		producingPrompt: 'Implement the word-frequency tool as ES modules, with its unit tests.',
		run: run({ ordinal: 2, argv: ['cat', 'package.json'], stdout: '{\n  "name": "wordfreq",\n  "type": "commonjs"\n}\n' }),
		rationale: { ...DESIGN_ACCOUNT, rationale: 'Converted the package to ES modules and added the unit tests.' },
		hostSequence: {
			acts: [
				{ try: 1, ordinal: 1, kind: 'RUN', argv: ['ls'], exitCode: 0, timedOut: false },
				{ try: 1, ordinal: 2, kind: 'RUN', argv: ['cat', 'package.json'], exitCode: 0, timedOut: false },
				{ try: 1, ordinal: 3, kind: 'WRITE', path: 'package.json' },
				{ try: 1, ordinal: 4, kind: 'RUN', argv: ['node', '--test'], exitCode: 0, timedOut: false }
			],
			droppedRuns: 0,
			recordedLimit: 32,
			subjectOrdinal: 2
		}
	} as Parameters<typeof processResultReviewInput>[0]);

	it.each([
		['case 08’s listing', CASE_08, '  1. ran ["ls"] — exit 0 ← this command\n  2. wrote "docs/design.md"'],
		[
			'case 19’s read',
			CASE_19,
			'  1. ran ["ls"] — exit 0\n  2. ran ["cat","package.json"] — exit 0 ← this command\n  3. wrote "package.json"\n  4. ran ["node","--test"] — exit 0'
		]
	])('⭐ %s: the narrowed intent, the scoping sentence and the sequence lines — and today’s obligation sentence gone', async (_what, input, lines) => {
		const p = await promptOf(input);
		const hostLines = p.split('\n');
		expect(hostLines, 'the narrowed intent, on its own line').toContain(INTENT);
		expect(hostLines, 'the scoping sentence, on its own line').toContain(SCOPE);
		expect(p, 'today’s obligation sentence').not.toContain(OBLIGATION_SENTENCE);
		expect(p, 'the step’s sequence, this command’s act marked').toContain(`Try 1:\n${lines}`);
		// ⭑ The preamble and the RR labels stay the policy's (R14, ASR-4).
		expect(p, 'the preamble moved').toContain(PREAMBLE);
		for (const c of SEEDED_REASONING_REVIEW_CRITERIA) expect(p, `${c.id}'s label moved`).toContain(`- ${c.id}: ${c.description}`);
		// ⭐ And the deterministic stub reviewer's INPUT is the builder's: it carries the sequence, this command's act named.
		expect(input.hostSequence?.subjectOrdinal, 'the builder’s input does not carry the sequence').toBe(input === CASE_08 ? 1 : 2);
		expect(input.hostSequence?.acts.length, 'the builder’s input does not carry every act').toBe(input === CASE_08 ? 2 : 4);
	});

	it('⭐ the sequence stands on HOST lines, its paths and commands as JSON, never inside a fence', async () => {
		const p = await promptOf(CASE_19);
		const lines = p.split('\n');
		let open: string | undefined;
		const host: string[] = [];
		for (const line of lines) {
			if (open === undefined && /^<<<UNTRUSTED-\d\d>>>$/.test(line)) open = line;
			else if (open !== undefined && line === open) open = undefined;
			else if (open === undefined) host.push(line);
		}
		expect(host, 'the act under review is not a host line').toContain('  2. ran ["cat","package.json"] — exit 0 ← this command');
		expect(host).toContain('  3. wrote "package.json"');
	});
});

describe('⭐⭐ package N — D10: the review of the finished work is shown the files the unit changed and the step’s sequence', () => {
	const COMMONJS = "'use strict';\nconst fs = require('node:fs');\nmodule.exports = { count };\n";
	const ESM = "import fs from 'node:fs';\nexport function count(text) {\n  return text.length;\n}\n";
	const base = {
		criteria: SEEDED_REASONING_REVIEW_CRITERIA,
		producingPrompt: 'Implement the word-frequency tool as ES modules.',
		answer: '{"done":"converted"}',
		rationale: { ...DESIGN_ACCOUNT, rationale: 'Converted the module to ESM.' }
	};

	it('⭐ a CommonJS file read and then rewritten to ESM: the prompt holds the FINAL file, never the read’s earlier state, and the sequence in order', async () => {
		const input = workProductReviewInput({
			...base,
			deliverable: {
				afterTry: 1,
				files: [{ path: 'src/wordfreq.js', change: 'CHANGED', content: ESM }],
				sequence: {
					acts: [
						{ try: 1, ordinal: 1, kind: 'RUN', argv: ['cat', 'src/wordfreq.js'], exitCode: 0, timedOut: false },
						{ try: 1, ordinal: 2, kind: 'WRITE', path: 'src/wordfreq.js' }
					],
					droppedRuns: 0,
					recordedLimit: 32
				}
			}
		} as Parameters<typeof workProductReviewInput>[0]);
		const p = await promptOf(input);
		expect(p, 'the changed file is not named').toContain('Changed "src/wordfreq.js":');
		expect(p, 'the final file’s text is not shown').toContain(`\n${ESM}\n`);
		expect(p, 'the read’s earlier state is shown').not.toContain(COMMONJS);
		expect(p, 'the sequence is not shown, in order').toContain('Try 1:\n  1. ran ["cat","src/wordfreq.js"] — exit 0\n  2. wrote "src/wordfreq.js"');
		expect(p, 'the framing does not judge the obligation against the deliverable').toContain(
			'against this whole deliverable: the files as they now stand, never as an earlier command read them.'
		);
	});

	it('⭐ a REMOVED file is listed as removed — never as unchanged, and with no text', async () => {
		const p = await promptOf(
			workProductReviewInput({
				...base,
				deliverable: {
					afterTry: 2,
					files: [
						{ path: 'old/legacy.js', change: 'REMOVED' },
						{ path: 'src/new.js', change: 'ADDED', content: ESM }
					],
					sequence: { acts: [], droppedRuns: 0, recordedLimit: 32 }
				}
			} as Parameters<typeof workProductReviewInput>[0])
		);
		const lines = p.split('\n');
		expect(lines, 'the removed file is not listed as removed').toContain('Removed "old/legacy.js": it is no longer in the workspace.');
		expect(lines[lines.indexOf('Removed "old/legacy.js": it is no longer in the workspace.') + 1], 'a removed file was given a text').not.toMatch(
			/^<<<UNTRUSTED-\d\d>>>$/
		);
		expect(lines).toContain('Added "src/new.js":');
		expect(p, 'the try the view was read after').toContain('as the host read them after try 2.');
	});

	it('⭐ an over-budget deliverable declares EACH cut on its own line before its bytes, counted in its allowance — and the prompt stays within budget', async () => {
		const files = Array.from({ length: 5 }, (_, i) => ({
			path: `src/f${i}.js`,
			change: 'ADDED' as const,
			content: `// file ${i}\n${'x'.repeat(9_000)}\n`
		}));
		const p = await promptOf(
			workProductReviewInput({
				...base,
				deliverable: { afterTry: 1, files, sequence: { acts: [], droppedRuns: 0, recordedLimit: 32 } }
			} as Parameters<typeof workProductReviewInput>[0])
		);
		expect(p.length, 'the prompt passed its budget').toBeLessThanOrEqual(REASONING_REVIEW_BUDGET.PROMPT_BUDGET);
		const lines = p.split('\n');
		for (const f of files) {
			const at = lines.indexOf(`Added ${JSON.stringify(f.path)}:`);
			expect(at, `${f.path}: not named`).toBeGreaterThan(-1);
			const declaration = /^\[CUT FOR THIS REVIEW: the text of "([^"]+)" — the first (\d+) of its (\d+) code points are shown; the last (\d+) are removed\.\]$/.exec(
				lines[at + 1] ?? ''
			);
			expect(declaration, `${f.path}: its cut is not declared on the line before its bytes`).not.toBeNull();
			expect(lines[at + 2], `${f.path}: its bytes are not fenced after the declaration`).toMatch(/^<<<UNTRUSTED-\d\d>>>$/);
			const fence = lines[at + 2]!;
			const kept = lines.slice(at + 3, lines.indexOf(fence, at + 3)).join('\n');
			expect([declaration![1], Number(declaration![2]), Number(declaration![3])], `${f.path}: the declaration is false of its bytes`).toEqual([
				f.path,
				[...kept].length,
				[...f.content].length
			]);
		}
	});

	it('⭐ too many files to show each with room for a declared cut: the LIST is cut, declared after the heading', async () => {
		const files = Array.from({ length: 400 }, (_, i) => ({ path: `src/m${String(i).padStart(3, '0')}.js`, change: 'ADDED' as const, content: 'export {};\n' }));
		const p = await promptOf(
			workProductReviewInput({
				...base,
				deliverable: { afterTry: 1, files, sequence: { acts: [], droppedRuns: 0, recordedLimit: 32 } }
			} as Parameters<typeof workProductReviewInput>[0])
		);
		expect(p.length).toBeLessThanOrEqual(REASONING_REVIEW_BUDGET.PROMPT_BUDGET);
		const cut = /\[CUT FOR THIS REVIEW: the changed files — the first (\d+) of the 400 are shown; the last (\d+) are removed\.\]/.exec(p);
		expect(cut, 'the list’s cut is not declared').not.toBeNull();
		const shown = Number(cut![1]);
		expect(shown + Number(cut![2])).toBe(400);
		expect(p).toContain(`Added "src/m${String(shown - 1).padStart(3, '0')}.js":`);
		expect(p, 'a file past the list’s cut is shown').not.toContain(`Added "src/m${String(shown).padStart(3, '0')}.js":`);
	});

	it('⭐ a long sequence is cut act by act, each cut declared before its act — the act under review always shown', async () => {
		const acts = Array.from({ length: 30 }, (_, i) => ({
			try: 1,
			ordinal: i + 1,
			kind: 'RUN' as const,
			argv: ['node', '-e', `/* script ${i} */ ${'y'.repeat(2_000)}`],
			exitCode: 0,
			timedOut: false
		}));
		const input = processResultReviewInput({
			criteria: SEEDED_REASONING_REVIEW_CRITERIA,
			producingPrompt: 'Run the scripts.',
			run: run({ ordinal: 17, argv: acts[16]!.argv, stdout: 'done\n' }),
			rationale: DESIGN_ACCOUNT,
			hostSequence: { acts, droppedRuns: 0, recordedLimit: 32, subjectOrdinal: 17 }
		} as Parameters<typeof processResultReviewInput>[0]);
		const p = await promptOf(input);
		expect(p.length).toBeLessThanOrEqual(REASONING_REVIEW_BUDGET.PROMPT_BUDGET);
		expect(p, 'the act under review is not marked').toMatch(/\n {2}17\. ran \["node","-e",.*← this command\n/);
		expect(p, 'no act’s cut is declared').toMatch(/\n {2}\[CUT FOR THIS REVIEW: the command of act \d+ — the first \d+ of its \d+ code points are shown; the last \d+ are removed\.\]\n {2}\d+\. ran /);
	});
});
