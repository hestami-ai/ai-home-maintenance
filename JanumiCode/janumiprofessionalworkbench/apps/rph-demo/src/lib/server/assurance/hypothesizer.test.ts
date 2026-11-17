// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — design D74 with D87's guidance (`DESIGN-data-flow-order-and-deliverable-review.md` §12.28, §12.41; `REG-D-166` (3),
// (5); `REG-D-167` (2)) — THE HYPOTHESIZER'S PROMPT AND THE READER OF ITS ANSWER.
//
// ⭑ WHAT MUST HOLD (D74, D87; the lead's ruling on reading 19): it is shown the rejected unit, the round's failed criteria, each candidate (its
// purpose, completion rule, accepted work and changed files) and the narrative; it runs its checks in a copy; it names one candidate or says it
// cannot tell, and gives no verdict; its guidance is advice that changes nothing of a unit's definition, outputs or criteria. Read: a named unit
// outside the candidates refuses the diagnosis; a claimed check the host did not capture it running is a finding, the diagnosis standing as advice.
// Its place in the stage — in a copy, its hashes compared, its commands captured — is `stage-helper-run.test.ts`'s and the stage's own test's.
import { describe, expect, it } from 'vitest';
import { DIAGNOSIS_FORM, hypothesizerPrompt, readDiagnosis, type HypothesizerCandidate } from './hypothesizer.js';

const CANDIDATES: readonly HypothesizerCandidate[] = [
	{ id: 'pwu_ver', title: 'Verification', purpose: 'Do the Verification', completionRule: 'every check passes', changedFiles: ['test/e2e.test.ts (added)'] },
	{
		id: 'pwu_src',
		title: 'Source',
		purpose: 'Do the Source',
		completionRule: 'the tool builds',
		acceptedWorkFile: '.jpwb/accepted/source--pwu_src.txt',
		changedFiles: ['src/reader.ts (added)', 'src/cli.ts (added)']
	}
];
const IDS = new Set(CANDIDATES.map((c) => c.id));

describe('⭐⭐ L17b1 (D74, D87) — the Hypothesizer’s prompt', () => {
	it('⛔ RED FIRST — it holds the rejected unit, the failed criteria, each candidate in full, the narrative, the duty to run its checks in a copy, the guidance as advice, and the form', () => {
		const prompt = hypothesizerPrompt({
			rejectedUnit: { id: 'pwu_ver', title: 'Verification' },
			failedCriteria: [{ code: 'RC-01', statement: 'The standard-input mode exits 1.' }],
			candidates: CANDIDATES,
			narrative: [
				{ id: 'art_ch1', failing: false, statements: [{ text: 'Source was accepted.', cites: ['pwu_src'] }] },
				{ id: 'art_ch0', failing: true, statements: [] }
			]
		});

		for (const part of [
			'The declared reviews of "Verification" (pwu_ver)',
			'- RC-01: The standard-input mode exits 1.',
			'- pwu_ver "Verification": purpose: Do the Verification; completion rule: every check passes; accepted work: not accepted; files its recorded work changed: test/e2e.test.ts (added)',
			'- pwu_src "Source": purpose: Do the Source; completion rule: the tool builds; accepted work: .jpwb/accepted/source--pwu_src.txt; files its recorded work changed: src/reader.ts (added), src/cli.ts (added)',
			'Chapter art_ch1:\n- Source was accepted. [pwu_src]',
			'Chapter art_ch0 failed its check and is left out: judge from the records instead.',
			'You work in a COPY of the Undertaking’s shared workspace',
			'Name ONE candidate whose work most likely holds the fault, or say you cannot tell (named: null). Give no verdict on the work.',
			'must not change any unit’s definition, its outputs or its criteria.',
			DIAGNOSIS_FORM
		])
			expect(prompt, `the prompt does not hold: ${part}`).toContain(part);
	});
});

describe('⭐⭐ L17b1 (D74, D87) — its answer read', () => {
	const answer = (over: Record<string, unknown> = {}) =>
		JSON.stringify({
			hypotheses: [
				{
					candidate: 'pwu_src',
					statement: 'Source’s reader treats a pipe as a file.',
					evidence: ['src/reader.ts'],
					checks: [{ command: ['node', 'bin/wf.js', '-'], why: 'reads a pipe', ifHeld: 'exit 1', showed: 'exit 1' }]
				}
			],
			named: 'pwu_src',
			confidence: 'fairly sure',
			guidance: 'Build the reader in parts and check each against a pipe.',
			...over
		});

	it('⛔ RED FIRST — the named candidate, the hypotheses, the confidence and the guidance are read; a check the host captured is no finding', () => {
		const read = readDiagnosis(answer(), IDS, [['node', 'bin/wf.js', '-']]);
		expect(read, 'the diagnosis is not read whole').toEqual({
			ok: true,
			diagnosis: {
				named: 'pwu_src',
				guidance: 'Build the reader in parts and check each against a pipe.',
				confidence: 'fairly sure',
				hypotheses: [{ candidate: 'pwu_src', statement: 'Source’s reader treats a pipe as a file.' }],
				findings: []
			}
		});
	});

	it('⛔ RED FIRST — a claimed check the host did not capture it running is a finding; the diagnosis stands as advice', () => {
		const read = readDiagnosis(answer(), IDS, [['node', '--version']]);
		expect(read.ok && [read.diagnosis.refusedBecause, read.diagnosis.findings], 'an uncaptured check is not a finding').toEqual([
			undefined,
			['its check ["node","bin/wf.js","-"] is not among the commands the host captured it running (design D74)']
		]);
	});

	it('⛔ RED FIRST — a named unit outside the candidates refuses the diagnosis', () => {
		const read = readDiagnosis(answer({ named: 'pwu_docs' }), IDS, [['node', 'bin/wf.js', '-']]);
		expect(read.ok && read.diagnosis.refusedBecause, 'a unit outside the candidates was not refused').toBe(
			'it names pwu_docs, which is not among the candidates (design D74)'
		);
	});

	it('⭑ CONTROL — "cannot tell" is read as no unit named, never refused; an answer that is not one JSON object is not read', () => {
		const read = readDiagnosis(answer({ named: null }), IDS, [['node', 'bin/wf.js', '-']]);
		expect(read.ok && [read.diagnosis.named, read.diagnosis.refusedBecause], 'cannot tell was refused').toEqual([null, undefined]);
		expect(readDiagnosis('The Source is at fault.', IDS, []), 'prose was read as a diagnosis').toEqual({
			ok: false,
			why: 'the answer does not parse as one JSON object'
		});
	});
});
