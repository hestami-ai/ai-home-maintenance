// ⭐ `JAN-EXEC` Phase 7, P7-4a (DESIGN-the-live-end-to-end-run.md §3.1, §6) — THE ACCEPTANCE SUITE, WRITTEN FROM THE BRIEF
// ALONE (`scripts/phase7/product-brief.md`) AND COMMITTED BEFORE THE RUN.
//
//   WORDFREQ_WORKSPACE=<a workspace copy> node --test "scripts/phase7/acceptance/*.test.mjs"
//
// ⚠ THE GLOB IS QUOTED AND NODE EXPANDS IT. On Node 24 a DIRECTORY argument to `node --test` is loaded as a module and
// fails ("Cannot find module …"), so `node --test scripts/phase7/acceptance/` reports one failed test and runs none of these.
//
// ⛔ IT TESTS THE BRIEF'S INTERFACE AND NOTHING ELSE. Each case starts `node "$WORDFREQ_WORKSPACE/bin/wordfreq.js"` as a child
// process — the Node.js running this suite (`process.execPath`) — in a temporary directory, and reads only its exit code,
// standard output and standard error. No module of the product is imported: a phase's `src/` is the model's, shaped as
// the model chose, and the brief fixes only the command line.
//
// ⛔ AND IT CANNOT PASS VACUOUSLY. With `WORDFREQ_WORKSPACE` unset, or naming a folder with no `bin/wordfreq.js`, every case
// FAILS, naming why. A suite that skipped there would report "0 failed" for a workspace it never ran.
//
// ⚠ WHERE THE BRIEF COULD BE READ TWO WAYS, NO CASE DEPENDS ON THE READING. "Ties are broken by the word, ascending" is
// code-unit order to one reader and alphabetical to another, and the two differ only when a tie mixes cases ("THE" before
// "bird" in code units, after it alphabetically). So every tie below is between lower-case ASCII words, where both orders
// agree. Equally, nothing here depends on whether U+2019 is an apostrophe, on a stop-word file's line endings, or on
// what an error message says after "wordfreq: ".
// ⚠ NOR ON HOW A LINE ENDS. "One per line" fixes neither LF nor CRLF, nor whether the last line is terminated, and the
// run is on Windows, where a product that writes `os.EOL` ends every line CRLF. So each case compares standard output as
// LINES (`lines`), never as bytes. ⛔ CORRECTED: the first version compared bytes, LF-ended, and failed five of the seven
// cases on a CRLF product while the paragraph above said no case depended on a reading. `verif/phase7-acceptance.test.ts`
// now holds both readings to all seven cases, and holds the error's shape, which the brief does close, to one line.
//
// THE SEVEN CASES (design §3.1): a file; standard input; N; case folding; a stop-word list; an unknown option's exit code;
// a missing file's exit code. `verif/phase7-acceptance.test.ts` holds this suite to the reference fixture (all seven
// pass) and to each of the seeded end-to-end variants (each fails the case its deviation breaks).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, test } from 'node:test';

const dir = mkdtempSync(join(tmpdir(), 'wordfreq-acceptance-'));
after(() => rmSync(dir, { recursive: true, force: true }));

/** The workspace's entry, or a failure naming what is missing. Called inside each case, so each case fails alone. */
function entry() {
	const workspace = process.env.WORDFREQ_WORKSPACE;
	assert.ok(
		workspace !== undefined && workspace.trim() !== '',
		'WORDFREQ_WORKSPACE is not set: name the workspace copy whose bin/wordfreq.js this suite runs'
	);
	const bin = join(resolve(workspace), 'bin', 'wordfreq.js');
	assert.ok(existsSync(bin), `WORDFREQ_WORKSPACE names no workspace with bin/wordfreq.js: ${bin}`);
	return bin;
}

/** Write `text` into this suite's directory and return the file's name there. */
function file(name, text) {
	writeFileSync(join(dir, name), text);
	return name;
}

/** Run the product in this suite's directory, with `input` on standard input (empty unless given). */
function wordfreq(args, input = '') {
	const r = spawnSync(process.execPath, [entry(), ...args], {
		cwd: dir,
		input,
		encoding: 'utf8',
		timeout: 30_000,
		windowsHide: true
	});
	if (r.error) throw r.error;
	return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** The brief's error form: one line on standard error, beginning "wordfreq: ". */
function assertOneErrorLine(stderr) {
	assert.match(stderr, /^wordfreq: [^\r\n]*(\r?\n)?$/, `standard error is not one line beginning "wordfreq: ": ${JSON.stringify(stderr)}`);
}

/**
 * Standard output as its lines: each ended LF or CRLF, the last one terminated or not. ⛔ An EMPTY line is still a line —
 * only the one empty string a final terminator leaves behind is dropped — so output with a blank line in it, or a
 * trailing blank line, is not the lines a case expects.
 */
function lines(stdout) {
	const all = stdout.split(/\r?\n/);
	if (all.at(-1) === '') all.pop();
	return all;
}

/**
 * Twelve words, each with its own count (alpha 12 down to lima 1), written least frequent FIRST and mixed with
 * punctuation and line breaks — so a product that printed words in the order it met them, or split words on spaces
 * alone, prints something else.
 */
const NATO = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima'];
const SEPARATORS = [' ', ', ', '. ', '\n', '; ', '! ', ' (', ') '];
const TWELVE = NATO.map((word, i) => ({ word, count: 12 - i }))
	.reverse()
	.flatMap(({ word, count }) => Array.from({ length: count }, () => word))
	.map((word, i) => `${word}${SEPARATORS[i % SEPARATORS.length]}`)
	.join('');
const TOP_TEN = NATO.slice(0, 10).map((word, i) => `${12 - i} ${word}`);

test('case 1 — a file: "<count> <word>" lines, most frequent first, 10 by default', () => {
	const r = wordfreq([file('twelve.txt', TWELVE)]);
	assert.equal(r.status, 0, r.stderr);
	assert.deepEqual(lines(r.stdout), TOP_TEN);
});

test('case 2 — standard input, when no file is given and when the file is "-"', () => {
	for (const args of [[], ['-']]) {
		const r = wordfreq(args, 'blue green red green red red\n');
		assert.equal(r.status, 0, `${JSON.stringify(args)}: ${r.stderr}`);
		assert.deepEqual(lines(r.stdout), ['3 red', '2 green', '1 blue'], JSON.stringify(args));
	}
});

test('case 3 — N: -n 3 and --top 3 print the three most frequent words', () => {
	for (const option of ['-n', '--top']) {
		const r = wordfreq([option, '3', file('twelve.txt', TWELVE)]);
		assert.equal(r.status, 0, `${option}: ${r.stderr}`);
		assert.deepEqual(lines(r.stdout), ['12 alpha', '11 bravo', '10 charlie'], option);
	}
});

test('case 4 — case folding: words are folded to lower case by default, and kept with --case-sensitive', () => {
	const text = 'THE The the The the the';
	const folded = wordfreq([], text);
	assert.equal(folded.status, 0, folded.stderr);
	assert.deepEqual(lines(folded.stdout), ['6 the']);
	const sensitive = wordfreq(['--case-sensitive'], text);
	assert.equal(sensitive.status, 0, sensitive.stderr);
	assert.deepEqual(lines(sensitive.stdout), ['3 the', '2 The', '1 THE']);
});

test('case 5 — a stop-word list: its words are excluded, compared after folding unless --case-sensitive', () => {
	const stop = file('stop.txt', 'The\nand\n');
	const folded = wordfreq(['--stop-words', stop], 'dog and The cat and the bird THE');
	assert.equal(folded.status, 0, folded.stderr);
	assert.deepEqual(lines(folded.stdout), ['1 bird', '1 cat', '1 dog']);
	const sensitive = wordfreq(['--case-sensitive', '--stop-words', stop], 'the the The cat and');
	assert.equal(sensitive.status, 0, sensitive.stderr);
	assert.deepEqual(lines(sensitive.stdout), ['2 the', '1 cat']);
});

test('case 6 — an unknown option: exit 2, and one line on standard error beginning "wordfreq: "', () => {
	const r = wordfreq(['--bogus', file('words.txt', 'one two two')]);
	assert.equal(r.status, 2);
	assertOneErrorLine(r.stderr);
});

test('case 7 — a missing file: exit 1, and one line on standard error beginning "wordfreq: "', () => {
	const r = wordfreq(['no-such-file.txt']);
	assert.equal(r.status, 1);
	assertOneErrorLine(r.stderr);
});
