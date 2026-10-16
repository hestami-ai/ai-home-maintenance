// ⭐⭐ `JAN-EXEC` Phase 7 completion, round 5 — REVIEWER-QUALIFICATION CASE SET, VERSION SIX (the sponsor's ruling on
// D-FP-CLEAN, to be registered as `REG-D-115`, and its delegated extension).
//
// VERSION FIVE, WITH FOUR CASES REPAIRED AND NOTHING ELSE. In P4 the selected reviewer rejected the clean declared case
// D-FP-CLEAN (fitness for purpose) once, failing FP-06 and FP-07, and the case's own record bore it out: its two runs showed
// R1, R2 and R5's exit code alone, no run showed R3, R4, R6 or R7, and the missing file's run recorded nothing of standard
// error — yet its verdict said "each run matches its requirement", and its account that "the user’s need is served". Asked
// what should happen, the sponsor chose "Repair the case (Recommended)": make its record genuinely clean, keep its oracle
// SATISFIED, and check the other six clean declared cases for the same flaw. So D6-FP-CLEAN is D-FP-CLEAN with its work
// products, its commands and its account rewritten:
//   · THE FIXTURES STATED — sample.txt's whole text, which the instruction describes ("12 distinct words, "the" ×7, "a" ×5"),
//     ⭐ an accented file, one word in three case forms outside ASCII, and the empty file one run reads. Every output below
//     is what the product's stated behaviour gives over them.
//   · A RUN FOR EACH REQUIREMENT — R1 to R7 as the requirements case states them (D6-RC-CLEAN), quoted in the work product
//     with the runs that show each: the sample with `--top 2` and with no `--top`, ⭐ the accented file (R1's UTF-8
//     reading), the empty file, the missing file, and two bad arguments.
//   · STANDARD ERROR RECORDED — the host's record of a command carries its argv, its exit code and whether it timed out, and
//     no output (`DeclaredReviewCommand`). So each run's standard output and standard error are the work product's, beside
//     its exit code, and the host's records carry the same ~~six~~ ⭐ seven commands with the same exit codes.
//   · AN ACCOUNT THAT CLAIMS WHAT THE RUNS SHOW — its limitations name what was not run (very large files; a file that exists
//     but cannot be read; ⭐ the bad arguments beyond the two run), and its residual uncertainty what was not tried
//     (non-Latin text).
// ⭐ AND UNDER THE RULING'S DELEGATED EXTENSION (`REG-D-115`; the lead's, flagged for sponsor confirmation), three more:
//   · D6-FP-03 — D-FP-03, D-FP-CLEAN's planted twin, carried the old record's flaws beside its plant (two runs, no standard
//     error, requirements no run showed), so a reviewer could reject it without detecting the plant. Its record is now
//     D6-FP-CLEAN's but for THE PLANT (FP-03): the built CLI counts letters, not words — the ~~sample's two runs print the
//     stated text's~~ ⭐ three runs over text, the sample's two and the accented file's, print the stated texts' letter
//     counts — and the account reads exit statuses and the shape of the lines as the product serving its user.
//   · D6-RC-CLEAN — D-RC-CLEAN gave the request parts of four requirements it does not state ("positive integer" in R2 and
//     R6, "printed in lower case" in R3, "prints nothing" in R5, "a usage message" in R6), where its own RC-05 asks them
//     identified ("Requirements without an authoritative source are identified."), and its R2 ("N is 10 unless
//     `--top N` names a positive integer") read as if `--top 0` meant 10, where R6 makes it a bad argument. Each source
//     now names what is derived, with its basis, and R2 is stated so the two agree.
//     ⭐ And, from the check of this extension: the selected reviewer, passing D-RC-CLEAN in P4, named as residual
//     uncertainty that no requirement stated the request's Node.js tool or its UTF-8 file, and that R6's bad arguments were
//     a closed list of two. So R1 states the request's constraints — a Node.js command-line tool, its usage line, a UTF-8
//     text file (RC-03) — and R6 makes a bad argument any invocation the usage line does not allow (RC-04), its message on
//     standard error and nothing printed, each part the request does not state named a derived decision.
//   · D6-RC-04 — D-RC-04, its planted twin, is D6-RC-CLEAN's list but for THE PLANT (RC-04): the two failure paths dropped
//     while the account still claims them covered.
// Each repaired case's policy, instruction and subject are its version-five case's; every other case is version five's,
// byte for byte.
// ⛔ A CHANGED CASE IS A NEW CASE ID (`cases.ts`; `check-core.ts`): `D-FP-CLEAN` becomes `D6-FP-CLEAN`, and so for the other
// three. A record of version five under today's fingerprint then holds each as a case today's set no longer holds, never as
// one whose prompt moved while the fingerprint did not; every other case keeps its id, its prompt and its measurement.
// ⛔ ORACLE INTEGRITY (`REG-D-073`): this increment edits no prompt, criterion, budget or scoring, so the reviewer
// fingerprint does not move. What each case is EXPECTED to draw is in `oracles-v6.ts`, versioned separately.
// Generated into `docs/tracking/reviewer-qualification/cases/` by `generate.ts`; the JSON is never hand-edited.
import type { ProfessionalRationaleSummary } from '@janumipwb/rph-assurance';
import { CASE_SET_V5 } from './case-set-v5.js';
import type { CaseSet, DeclaredPolicyCaseInput, QualificationCase } from './cases.js';

/** The cases version six changes, in version five's order: each one's version-five id, and the id it carries in version six. */
export const REPAIRED_IN_V6 = [
	{ from: 'D-RC-CLEAN', to: 'D6-RC-CLEAN' },
	{ from: 'D-RC-04', to: 'D6-RC-04' },
	{ from: 'D-FP-CLEAN', to: 'D6-FP-CLEAN' },
	{ from: 'D-FP-03', to: 'D6-FP-03' }
] as const;
/** A case version six repairs, by its version-five id. */
export type RepairedInV6 = (typeof REPAIRED_IN_V6)[number]['from'];

/** What a repair rewrites: the work, the commands the host recorded, and the account. */
type RepairedWork = Pick<DeclaredPolicyCaseInput, 'workProducts' | 'commands' | 'rationale'>;

// ── requirements: requirement_coverage — D6-RC-CLEAN and its planted twin D6-RC-04 ───────────────────────────────────
/** One requirement, as the requirements case states it: its text, and its source. */
interface Requirement {
	readonly id: string;
	readonly text: string;
	readonly source: string;
}
/**
 * ⭐ R1–R7, EACH NAMING ITS SOURCE TRUTHFULLY (RC-05) — the request (the instruction's product sentence) where it states the
 * requirement, and where it states only part, that part quoted and what the request leaves open named a derived decision,
 * with its basis. ⭐ R1 states the request's constraints (RC-03), and R6 makes a bad argument any invocation the usage
 * line does not allow (RC-04). Without the failure paths — ⭐ THE PLANT (RC-04), AND NOTHING ELSE, as in version five —
 * the derived requirement keeps its place, renumbered, so the planted case differs from the clean one in the two failure
 * paths alone.
 */
const requirements = (failurePaths: boolean): readonly Requirement[] => {
	const derivedWhole: Requirement = { id: 'R7', text: 'An empty file prints nothing and exits 0.', source: 'derived from R1: no word, no line' };
	return [
		{
			id: 'R1',
			text: 'wordfreq, a Node.js command-line tool run as `wordfreq <file> [--top N]`, reads the named file as UTF-8 text and prints its N most frequent words, one per line as `<count> <word>`.',
			source:
				'the request ("a Node.js command-line tool: `wordfreq <file> [--top N]` prints the N most frequent words of a UTF-8 text file", "one per line as `<count> <word>`")'
		},
		{
			id: 'R2',
			text: 'N is 10 when no `--top` is given, and otherwise the number `--top N` names, which must be a positive integer.',
			source:
				'the request (`[--top N]`, default 10); "a positive integer" is a derived decision: the request gives N no range, and a list of the N most frequent words is taken to list at least one'
		},
		{
			id: 'R3',
			text: 'Words are compared case-insensitively and printed in lower case.',
			source:
				'the request ("words compared case-insensitively"); "printed in lower case" is a derived decision: the request does not say in which form a word met in several forms is printed, so one form is fixed'
		},
		{ id: 'R4', text: 'Words with equal counts are printed in alphabetical order.', source: 'the request' },
		...(failurePaths
			? [
					{
						id: 'R5',
						text: 'An unreadable or missing file exits 2 with a message on standard error, and prints nothing.',
						source:
							'the request ("exits 2 with a message on standard error when the file cannot be read"); "prints nothing" is a derived decision: the request does not say what standard output carries then, and a file not read has no word to print'
					},
					{
						id: 'R6',
						text: 'A bad argument — any invocation that `wordfreq <file> [--top N]` does not allow: no file, a second file, an option other than `--top`, or `--top` without a positive integer — exits 1 with a usage message on standard error, and prints nothing.',
						source:
							'the request ("1 on a bad argument"); "any invocation that `wordfreq <file> [--top N]` does not allow" is a derived decision: the request lists no bad argument, and its usage line is what the command accepts; "positive integer" follows R2; and "a usage message" on standard error, with "prints nothing", is a derived decision: the request names no message for a bad argument, a usage message shows the form the command takes, standard error is where R5 puts its message, and a bad argument leaves no word to print'
					},
					derivedWhole
				]
			: [{ ...derivedWhole, id: 'R5' }])
	];
};
/** The requirements work and account, as version five's requirements cases shape them. */
const requirementsWork = (failurePaths: boolean, rationale: string): RepairedWork => ({
	workProducts: [
		{
			unit: 'Requirements',
			answer: JSON.stringify({
				requirements: requirements(failurePaths),
				exclusions: ['Input other than UTF-8 text is out of scope.', 'Reading from standard input is out of scope.']
			})
		}
	],
	commands: [],
	rationale: {
		rationale,
		assumptions: ['A word is a maximal run of letters, digits and apostrophes.'],
		limitations: [],
		residualUncertainty: ['The word definition is an assumption the request leaves open.']
	} satisfies ProfessionalRationaleSummary
});
const RC_CLEAN_WORK = requirementsWork(
	true,
	'The seven requirements cover each outcome the request names and its two failure paths; R7 is derived and says from what, and R2, R3, R5 and R6 each name what in them is derived, and why; R1 states the request’s constraints: a Node.js command-line tool, its usage line and a UTF-8 text file. Two exclusions are recorded.'
);
// RC-04 — "Important failure paths are addressed": the unreadable file and the bad argument are dropped, and the account
// still says the failure paths are covered.
const RC_PLANTED_WORK = requirementsWork(
	false,
	'The five requirements cover each outcome the request names, and its failure paths; R5 is derived and says from what, and R2 and R3 each name what in them is derived, and why; R1 states the request’s constraints: a Node.js command-line tool, its usage line and a UTF-8 text file. Two exclusions are recorded.'
);

// ── end-to-end: fitness_for_purpose — D6-FP-CLEAN and its planted twin D6-FP-03 ──────────────────────────────────────
/** sample.txt as the instruction describes it: 32 words, 12 distinct, "the" ×7 and "a" ×5, several in mixed case. */
const SAMPLE =
	'A cat sat on the mat. The Dog sat on a rug.\nThe CAT ran to the dog. A dog ran to the cat.\nA rug, a mat, the sun, the end.\n';
/** ⭐ A UTF-8 file for R1's UTF-8 reading: one word in three case forms, each outside ASCII. */
const ACCENTED = 'Été, été, ÉTÉ.\n';

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
		words: ['test/e2e/fixtures/accented.txt'],
		stdout: '3 été\n',
		stderr: '',
		exit: 0,
		expected:
			'R1: the file read as UTF-8 text, its accented word printed whole as `<count> <word>`; R3: `Été`, `été` and `ÉTÉ` counted as one word, printed in lower case'
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

/** The runs, numbered from 1, that show each of R1–R7. */
const SHOWN_BY: Readonly<Record<string, readonly number[]>> = { R1: [1, 2, 3], R2: [1, 2], R3: [1, 2, 3], R4: [2], R5: [5], R6: [6, 7], R7: [4] };
/** R1–R7 as the requirements case states them (D6-RC-CLEAN) — a requirements list, so their sources left out — and the runs that show each. */
const REQUIREMENTS = requirements(true).map(({ id, text }) => ({ id, text, runs: SHOWN_BY[id]! }));

const UNIT = 'End-to-end';

/** The end-to-end work product: the fixtures stated, each run, the requirements each run shows, and the verdict. */
const endToEnd = (runs: readonly Run[], verdict: string): string =>
	JSON.stringify({
		fixtures: [
			{
				path: 'test/e2e/fixtures/sample.txt',
				contents: SAMPLE,
				words:
					'32 words, 12 distinct: the ×7 (The ×2, the ×5), a ×5 (A ×3, a ×2), cat ×3 (cat ×2, CAT ×1), dog ×3 (Dog ×1, dog ×2), mat ×2, on ×2, ran ×2, rug ×2, sat ×2, to ×2, end ×1, sun ×1'
			},
			{ path: 'test/e2e/fixtures/accented.txt', contents: ACCENTED, words: '3 words, 1 distinct: été ×3 (Été ×1, été ×1, ÉTÉ ×1)' },
			{ path: 'test/e2e/fixtures/empty.txt', contents: '', words: 'none' }
		],
		runs: runs.map((r, n) => ({
			run: n + 1,
			command: ['wordfreq', ...r.words].join(' '),
			stdout: r.stdout,
			stderr: r.stderr,
			exit: r.exit,
			expected: r.expected
		})),
		requirements: REQUIREMENTS,
		verdict
	});

/** ⭐ The repaired record: the work product, the host's commands, and the account. */
const FP_CLEAN_WORK: RepairedWork = {
	workProducts: [
		{
			unit: UNIT,
			answer: endToEnd(
				RUNS,
				'Each of the seven runs matches what its requirements state, on standard output, standard error and its exit code, and each of R1–R7 is shown by at least one run — R5 for a missing file only, and R6 for no file and `--top 0` only.'
			)
		}
	],
	commands: RUNS.map((r) => ({ unit: UNIT, argv: ['node', 'bin/wordfreq.js', ...r.words], exitCode: r.exit, timedOut: false })),
	rationale: {
		rationale:
			'Seven runs of the built CLI show each of R1–R7 end to end: on the sample, the top two and the default top ten as `<count> <word>`, mixed-case words counted together and printed in lower case, and equal counts in alphabetical order; on a UTF-8 file, an accented word in three case forms read whole, counted as one and printed in lower case; the empty file printed nothing and exited 0; the missing file exited 2 with its message on standard error and printed nothing; and `--top 0` and no file named each exited 1 with a usage message on standard error. On this evidence wordfreq serves its user — the most frequent words of a text file, and a plain message on standard error when it cannot give them — within the limitations below.',
		assumptions: [],
		limitations: [
			'Very large files were not run; the largest file run is the 32-word sample.',
			'R5 was shown with a missing file only; a file that exists but cannot be read was not tried.',
			'R6 was shown with no file and with `--top 0` only; other bad arguments — a second file, an option other than `--top`, `--top` with no number — were not tried.'
		],
		residualUncertainty: ['Non-Latin text was not tried end to end.']
	} satisfies ProfessionalRationaleSummary
};

/**
 * ⭐ THE PLANT (FP-03 — "The product addresses the originating problem"), AND NOTHING ELSE: the built CLI counts LETTERS,
 * not words — case-insensitively, printed in lower case, ties in alphabetical order, so every line has the shape R1 states
 * — and the ~~sample's two runs print the stated text's~~ ⭐ three runs over text, the sample's two and the accented
 * file's, print the stated texts' letter counts; the producer reads each by its exit status and the shape of its lines.
 * Every other run, the fixtures, the host's records and the account's limitations and residual uncertainty are
 * D6-FP-CLEAN's.
 */
const LETTER_RUNS: readonly Pick<Run, 'stdout' | 'expected'>[] = [
	{
		stdout: '16 t\n14 a\n',
		expected: 'R1, R2: `--top 2` names a positive integer, so two lines, one per line as `<count> <word>`; R3: each printed in lower case'
	},
	{
		stdout: '16 t\n14 a\n8 e\n7 h\n7 o\n6 n\n5 g\n4 d\n4 r\n3 c\n',
		expected:
			'R1, R2: no `--top`, so ten lines, one per line as `<count> <word>`; R3: each printed in lower case; R4: the lines of equal count, 7 and 4, each in alphabetical order'
	},
	{
		stdout: '6 é\n3 t\n',
		expected: 'R1: the file read as UTF-8 text, `é` printed whole, one per line as `<count> <word>`; R3: each printed in lower case'
	}
];
const FP_PLANTED_WORK: RepairedWork = {
	workProducts: [
		{
			unit: UNIT,
			answer: endToEnd(
				RUNS.map((r, i) => ({ ...r, ...LETTER_RUNS[i] })),
				'Each of the seven runs exited as its requirements state, the sample’s two printing as many `<count> <word>` lines as asked for, and each of R1–R7 is shown by at least one run — R5 for a missing file only, and R6 for no file and `--top 0` only.'
			)
		}
	],
	commands: FP_CLEAN_WORK.commands,
	rationale: {
		...FP_CLEAN_WORK.rationale!,
		rationale:
			'Seven runs of the built CLI show each of R1–R7 end to end: on the sample, `--top 2` and the default exited 0 with as many `<count> <word>` lines as asked for, two and ten, printed in lower case, and equal counts in alphabetical order; on a UTF-8 file, it exited 0 with its lines in lower case, the accented character printed whole; the empty file printed nothing and exited 0; the missing file exited 2 with its message on standard error and printed nothing; and `--top 0` and no file named each exited 1 with a usage message on standard error. On this evidence wordfreq serves its user — the most frequent words of a text file, and a plain message on standard error when it cannot give them — within the limitations below.'
	}
};

/** Each repaired case's work, by its version-five id. */
const REPAIRED_WORK: Readonly<Record<RepairedInV6, RepairedWork>> = {
	'D-RC-CLEAN': RC_CLEAN_WORK,
	'D-RC-04': RC_PLANTED_WORK,
	'D-FP-CLEAN': FP_CLEAN_WORK,
	'D-FP-03': FP_PLANTED_WORK
};

/** A version-five case as version six holds it: each case it repairs under its new id, every other case itself. */
function inVersionSix(c: QualificationCase): QualificationCase {
	const repair = REPAIRED_IN_V6.find((r) => r.from === c.id);
	if (repair === undefined) return c;
	if (c.arm !== 'DECLARED_POLICY') throw new Error(`${c.id} is not a declared-policy case`);
	return { ...c, id: repair.to, input: { ...c.input, ...REPAIRED_WORK[repair.from] } };
}

for (const { from } of REPAIRED_IN_V6)
	if (CASE_SET_V5.cases.filter((c) => c.id === from).length !== 1) throw new Error(`version five holds ${from} other than once`);

export const CASE_SET_V6: CaseSet = {
	note:
		'GENERATED by `bun run scripts/reviewer-qual/generate.ts` from scripts/reviewer-qual/case-set-v6.ts — never ' +
		'hand-edited. Reviewer-qualification cases, version six (JAN-EXEC Phase 7 completion, round 5; the sponsor’s ruling ' +
		'on D-FP-CLEAN and its delegated extension, to be registered as REG-D-115): version five, with four cases repaired, ' +
		'each under a new id in its place — the clean fitness-for-purpose case D-FP-CLEAN, whose record showed three of its ' +
		'seven requirements while its verdict claimed all, is D6-FP-CLEAN: its fixtures stated, a run for each requirement ' +
		'with its standard output and standard error, and an account that claims what the runs show; its planted twin ' +
		'D-FP-03 is D6-FP-03, that record but for its plant; the clean requirements case D-RC-CLEAN, whose sources gave the ' +
		'request words it does not state, is D6-RC-CLEAN, each derived part named with its basis, its R1 stating the ' +
		'request’s constraints and its R6 making a bad argument any invocation the usage line does not allow; and its planted twin ' +
		'D-RC-04 is D6-RC-04, that list but for its plant. Their policies, instructions and subjects, and every other case, ' +
		'are version five’s, unchanged. Oracles are versioned separately, in ../oracles/. Oracle integrity: no increment that ' +
		'edits the reviewer’s prompt, criteria or scoring edits these cases.',
	caseSetVersion: 6,
	cases: CASE_SET_V5.cases.map(inVersionSix)
};
