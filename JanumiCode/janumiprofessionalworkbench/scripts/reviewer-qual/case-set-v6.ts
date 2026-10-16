// ⭐⭐ `JAN-EXEC` Phase 7 completion, round 5 — REVIEWER-QUALIFICATION CASE SET, VERSION SIX (the sponsor's ruling on
// D-FP-CLEAN, to be registered as `REG-D-115`).
//
// VERSION FIVE, WITH ONE CASE REPAIRED AND NOTHING ELSE. In P4 the selected reviewer rejected the clean declared case
// D-FP-CLEAN (fitness for purpose) once, failing FP-06 and FP-07, and the case's own record bore it out: its two runs showed
// R1, R2 and R5's exit code alone, no run showed R3, R4, R6 or R7, and the missing file's run recorded nothing of standard
// error — yet its verdict said "each run matches its requirement", and its account that "the user’s need is served". Asked
// what should happen, the sponsor chose "Repair the case (Recommended)": make its record genuinely clean, and keep its
// oracle SATISFIED. So D6-FP-CLEAN is D-FP-CLEAN with its work products, its commands and its account rewritten:
//   · THE FIXTURES STATED — sample.txt's whole text, which the instruction describes ("12 distinct words, "the" ×7, "a" ×5"),
//     and the empty file one run reads. Every output below is what the product's stated behaviour gives over them.
//   · A RUN FOR EACH REQUIREMENT — R1 to R7 as the requirements case states them (D-RC-CLEAN), quoted in the work product
//     with the runs that show each: the sample with `--top 2` and with no `--top`, the empty file, the missing file, and two
//     bad arguments.
//   · STANDARD ERROR RECORDED — the host's record of a command carries its argv, its exit code and whether it timed out, and
//     no output (`DeclaredReviewCommand`). So each run's standard output and standard error are the work product's, beside
//     its exit code, and the host's records carry the same six commands with the same exit codes.
//   · AN ACCOUNT THAT CLAIMS WHAT THE RUNS SHOW — its limitations name what was not run (very large files; a file that exists
//     but cannot be read), and its residual uncertainty what was not tried (non-Latin text).
// Its policy, instruction and subject are D-FP-CLEAN's, which are D-FP-03's: the planted twin is version five's, byte for
// byte, as is every other case.
// ⛔ A CHANGED CASE IS A NEW CASE ID (`cases.ts`; `check-core.ts`): `D-FP-CLEAN` becomes `D6-FP-CLEAN`. A record of version
// five under today's fingerprint then holds D-FP-CLEAN as a case today's set no longer holds, never as one whose prompt moved
// while the fingerprint did not; every other case keeps its id, its prompt and its measurement.
// ⛔ ORACLE INTEGRITY (`REG-D-073`): this increment edits no prompt, criterion, budget or scoring, so the reviewer
// fingerprint does not move. What each case is EXPECTED to draw is in `oracles-v6.ts`, versioned separately.
// Generated into `docs/tracking/reviewer-qualification/cases/` by `generate.ts`; the JSON is never hand-edited.
import type { ProfessionalRationaleSummary } from '@janumipwb/rph-assurance';
import { CASE_SET_V5 } from './case-set-v5.js';
import type { CaseSet, DeclaredPolicyCaseInput, QualificationCase } from './cases.js';

/** The one case version six changes: its version-five id, and the id it carries in version six. */
export const REPAIRED_IN_V6 = { from: 'D-FP-CLEAN', to: 'D6-FP-CLEAN' } as const;

/** sample.txt as the instruction describes it: 32 words, 12 distinct, "the" ×7 and "a" ×5, several in mixed case. */
const SAMPLE =
	'A cat sat on the mat. The Dog sat on a rug.\nThe CAT ran to the dog. A dog ran to the cat.\nA rug, a mat, the sun, the end.\n';

/** One run of the built CLI, as the work product reports it; `argv` is what the host recorded it running. */
interface Run {
	readonly words: readonly string[];
	readonly stdout: string;
	readonly stderr: string;
	readonly exit: number;
	readonly expected: string;
}
const USAGE = 'usage: wordfreq <file> [--top N]\n';
const RUNS: readonly Run[] = [
	{
		words: ['test/e2e/fixtures/sample.txt', '--top', '2'],
		stdout: '7 the\n5 a\n',
		stderr: '',
		exit: 0,
		expected: 'R1, R2: `--top 2` names a positive integer, so the two most frequent words, one per line as `<count> <word>`; R3: `the` counts `The` ×2 and `the` ×5'
	},
	{
		words: ['test/e2e/fixtures/sample.txt'],
		stdout: '7 the\n5 a\n3 cat\n3 dog\n2 mat\n2 on\n2 ran\n2 rug\n2 sat\n2 to\n',
		stderr: '',
		exit: 0,
		expected:
			'R1, R2: no `--top`, so the ten most frequent of the sample’s twelve words, `end` and `sun` (1 each) left out; R3: `The` and `the`, `CAT` and `cat`, `Dog` and `dog` each counted as one word, printed in lower case; R4: the words counted 3 (`cat`, `dog`) and the words counted 2 (`mat`, `on`, `ran`, `rug`, `sat`, `to`) each in alphabetical order'
	},
	{
		words: ['test/e2e/fixtures/empty.txt'],
		stdout: '',
		stderr: '',
		exit: 0,
		expected: 'R7: an empty file prints nothing and exits 0'
	},
	{
		words: ['test/e2e/fixtures/missing.txt'],
		stdout: '',
		stderr: 'wordfreq: cannot read test/e2e/fixtures/missing.txt: no such file or directory\n',
		exit: 2,
		expected: 'R5: a missing file exits 2 with a message on standard error, and prints nothing'
	},
	{
		words: ['test/e2e/fixtures/sample.txt', '--top', '0'],
		stdout: '',
		stderr: `wordfreq: --top must be a positive integer, got 0\n${USAGE}`,
		exit: 1,
		expected: 'R6: `--top` not a positive integer exits 1 with a usage message on standard error, and prints nothing'
	},
	{
		words: [],
		stdout: '',
		stderr: `wordfreq: no file named\n${USAGE}`,
		exit: 1,
		expected: 'R6: no file exits 1 with a usage message on standard error, and prints nothing'
	}
];

/** R1–R7 as the requirements case states them (D-RC-CLEAN), and the runs, numbered from 1, that show each. */
const REQUIREMENTS: readonly { readonly id: string; readonly text: string; readonly runs: readonly number[] }[] = [
	{ id: 'R1', text: 'wordfreq prints the N most frequent words of the named file, one per line as `<count> <word>`.', runs: [1, 2] },
	{ id: 'R2', text: 'N is 10 unless `--top N` names a positive integer.', runs: [1, 2] },
	{ id: 'R3', text: 'Words are compared case-insensitively and printed in lower case.', runs: [1, 2] },
	{ id: 'R4', text: 'Words with equal counts are printed in alphabetical order.', runs: [2] },
	{ id: 'R5', text: 'An unreadable or missing file exits 2 with a message on standard error, and prints nothing.', runs: [4] },
	{ id: 'R6', text: 'A bad argument — no file, or `--top` not a positive integer — exits 1 with a usage message.', runs: [5, 6] },
	{ id: 'R7', text: 'An empty file prints nothing and exits 0.', runs: [3] }
];

const UNIT = 'End-to-end';

/** ⭐ The repaired record: the work product, the host's commands, and the account. */
const REPAIRED_WORK: Pick<DeclaredPolicyCaseInput, 'workProducts' | 'commands' | 'rationale'> = {
	workProducts: [
		{
			unit: UNIT,
			answer: JSON.stringify({
				fixtures: [
					{
						path: 'test/e2e/fixtures/sample.txt',
						contents: SAMPLE,
						words:
							'32 words, 12 distinct: the ×7 (The ×2, the ×5), a ×5 (A ×3, a ×2), cat ×3 (cat ×2, CAT ×1), dog ×3 (Dog ×1, dog ×2), mat ×2, on ×2, ran ×2, rug ×2, sat ×2, to ×2, end ×1, sun ×1'
					},
					{ path: 'test/e2e/fixtures/empty.txt', contents: '', words: 'none' }
				],
				runs: RUNS.map((r, n) => ({
					run: n + 1,
					command: ['wordfreq', ...r.words].join(' '),
					stdout: r.stdout,
					stderr: r.stderr,
					exit: r.exit,
					expected: r.expected
				})),
				requirements: REQUIREMENTS,
				verdict:
					'Each of the six runs matches what its requirements state, on standard output, standard error and its exit code, and each of R1–R7 is shown by at least one run — R5 for a missing file only.'
			})
		}
	],
	commands: RUNS.map((r) => ({ unit: UNIT, argv: ['node', 'bin/wordfreq.js', ...r.words], exitCode: r.exit, timedOut: false })),
	rationale: {
		rationale:
			'Six runs of the built CLI show each of R1–R7 end to end: on the sample, the top two and the default top ten as `<count> <word>`, mixed-case words counted together and printed in lower case, and equal counts in alphabetical order; the empty file printed nothing and exited 0; the missing file exited 2 with its message on standard error and printed nothing; and `--top 0` and no file named each exited 1 with a usage message on standard error. On this evidence wordfreq serves its user — the most frequent words of a text file, and a plain message on standard error when it cannot give them — within the limitations below.',
		assumptions: [],
		limitations: [
			'Very large files were not run; the largest file run is the 32-word sample.',
			'R5 was shown with a missing file only; a file that exists but cannot be read was not tried.'
		],
		residualUncertainty: ['Non-Latin text was not tried end to end.']
	} satisfies ProfessionalRationaleSummary
};

/** A version-five case as version six holds it: D-FP-CLEAN repaired under its new id, every other case itself. */
function inVersionSix(c: QualificationCase): QualificationCase {
	if (c.id !== REPAIRED_IN_V6.from) return c;
	if (c.arm !== 'DECLARED_POLICY') throw new Error(`${c.id} is not a declared-policy case`);
	return { ...c, id: REPAIRED_IN_V6.to, input: { ...c.input, ...REPAIRED_WORK } };
}

if (CASE_SET_V5.cases.filter((c) => c.id === REPAIRED_IN_V6.from).length !== 1)
	throw new Error(`version five holds ${REPAIRED_IN_V6.from} other than once`);

export const CASE_SET_V6: CaseSet = {
	note:
		'GENERATED by `bun run scripts/reviewer-qual/generate.ts` from scripts/reviewer-qual/case-set-v6.ts — never ' +
		'hand-edited. Reviewer-qualification cases, version six (JAN-EXEC Phase 7 completion, round 5; the sponsor’s ruling ' +
		'on D-FP-CLEAN, to be registered as REG-D-115): version five, with one case repaired — the clean fitness-for-purpose ' +
		'case D-FP-CLEAN, whose record showed three of its seven requirements while its verdict claimed all, is D6-FP-CLEAN: ' +
		'its fixtures stated, a run for each requirement with its standard output and standard error, and an account that ' +
		'claims what the runs show. Its policy, instruction and subject, and every other case, are version five’s, unchanged. ' +
		'Oracles are versioned separately, in ../oracles/. Oracle integrity: no increment that edits the reviewer’s prompt, ' +
		'criteria or scoring edits these cases.',
	caseSetVersion: 6,
	cases: CASE_SET_V5.cases.map(inVersionSix)
};
