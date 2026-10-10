// End to end: the real tool, started as a child process by the Node.js running these tests.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../../bin/wordfreq.js', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'wordfreq-e2e-'));
after(() => rmSync(dir, { recursive: true, force: true }));

/** Write `text` to a file in the test's own directory, and return its name there. */
function file(name, text) {
	writeFileSync(join(dir, name), text);
	return name;
}

/** Run the tool in the test directory, with `input` on its standard input. */
function wordfreq(args, input = '') {
	const result = spawnSync(process.execPath, [BIN, ...args], {
		cwd: dir,
		input,
		encoding: 'utf8',
		timeout: 30_000
	});
	return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** The brief's error form: exactly one line on standard error, beginning "wordfreq: ". */
function assertOneErrorLine(stderr) {
	assert.match(stderr, /^wordfreq: [^\n]+\n?$/);
}

/** Thirteen distinct words, each with its own count, so a default other than 10 changes the line count. */
const THIRTEEN = Array.from({ length: 13 }, (_, i) => `w${String(i + 1).padStart(2, '0')} `.repeat(14 - i)).join('');

describe('wordfreq, end to end', () => {
	test('reads a file and prints "<count> <word>", most frequent first', () => {
		const r = wordfreq([file('pets.txt', 'cat dog cat bird cat dog\n')]);
		assert.equal(r.status, 0);
		assert.equal(r.stdout, '3 cat\n2 dog\n1 bird\n');
		assert.equal(r.stderr, '');
	});

	test('reads standard input when no file is given, and when the file is "-"', () => {
		for (const args of [[], ['-']]) {
			const r = wordfreq(args, 'red blue red\n');
			assert.equal(r.status, 0, `args ${JSON.stringify(args)}`);
			assert.equal(r.stdout, '2 red\n1 blue\n', `args ${JSON.stringify(args)}`);
		}
	});

	test('prints 10 words by default', () => {
		const r = wordfreq([file('thirteen.txt', THIRTEEN)]);
		assert.equal(r.status, 0);
		const lines = r.stdout.trimEnd().split('\n');
		assert.equal(lines.length, 10);
		assert.equal(lines[0], '14 w01');
		assert.equal(lines[9], '5 w10');
	});

	test('prints N words with -n N and --top N', () => {
		for (const option of ['-n', '--top']) {
			const r = wordfreq([option, '3', file('thirteen.txt', THIRTEEN)]);
			assert.equal(r.status, 0, option);
			assert.equal(r.stdout, '14 w01\n13 w02\n12 w03\n', option);
		}
	});

	test('breaks a tie by the word, ascending, whatever order the words came in', () => {
		const r = wordfreq([], 'pear fig apple fig apple pear kiwi');
		assert.equal(r.stdout, '2 apple\n2 fig\n2 pear\n1 kiwi\n');
	});

	test('folds case by default, and keeps it with --case-sensitive', () => {
		const text = 'the the the The The THE';
		assert.equal(wordfreq([], text).stdout, '6 the\n');
		assert.equal(wordfreq(['--case-sensitive'], text).stdout, '3 the\n2 The\n1 THE\n');
	});

	test('reads Unicode letters as letters, and apostrophes as part of a word', () => {
		const r = wordfreq([], "Café café don't, x");
		assert.equal(r.stdout, "2 café\n1 don't\n1 x\n");
	});

	test('excludes the stop words, compared after folding unless --case-sensitive', () => {
		const stop = file('stop.txt', 'The\nand\n');
		const text = 'The cat and the dog and THE bird';
		assert.equal(wordfreq(['--stop-words', stop], text).stdout, '1 bird\n1 cat\n1 dog\n');
		assert.equal(
			wordfreq(['--case-sensitive', '--stop-words', stop], text).stdout,
			'1 THE\n1 bird\n1 cat\n1 dog\n1 the\n'
		);
	});

	test('an unknown option is a usage error: exit 2 and one line on standard error', () => {
		const r = wordfreq(['--bogus']);
		assert.equal(r.status, 2);
		assertOneErrorLine(r.stderr);
	});

	test('a bad N is a usage error: exit 2 and one line on standard error', () => {
		for (const n of ['0', '-1', 'ten', '2.5']) {
			const r = wordfreq(['-n', n], 'a b');
			assert.equal(r.status, 2, `-n ${n}`);
			assertOneErrorLine(r.stderr);
		}
	});

	test('a missing file exits 1 with one line on standard error', () => {
		const r = wordfreq(['no-such-file.txt']);
		assert.equal(r.status, 1);
		assertOneErrorLine(r.stderr);
		assert.equal(r.stdout, '');
	});

	test('-h and --help print usage to standard output and exit 0', () => {
		for (const option of ['-h', '--help']) {
			const r = wordfreq([option]);
			assert.equal(r.status, 0, option);
			assert.match(r.stdout, /^Usage: node bin\/wordfreq\.js \[options\] \[file\]/, option);
			assert.equal(r.stderr, '', option);
		}
	});

	test('empty input prints nothing and succeeds', () => {
		const r = wordfreq([], '');
		assert.equal(r.status, 0);
		assert.equal(r.stdout, '');
	});
});
