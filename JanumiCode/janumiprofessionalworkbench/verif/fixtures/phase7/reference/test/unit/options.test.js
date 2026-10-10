import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DEFAULT_TOP, USAGE, UsageError, parseArgs, parseTop } from '../../src/options.js';

const usageError = (message) => (error) => error instanceof UsageError && error.message === message;

describe('parseTop', () => {
	test('reads a positive integer', () => {
		assert.equal(parseTop('-n', '1'), 1);
		assert.equal(parseTop('-n', '3'), 3);
		assert.equal(parseTop('--top', '250'), 250);
	});

	test('refuses a missing value', () => {
		assert.throws(() => parseTop('-n', undefined), usageError('-n needs a positive integer'));
	});

	test('refuses zero, a sign, a fraction, a word and a number past the safe range', () => {
		for (const bad of ['0', '-3', '+5', '1.5', 'abc', '', '9007199254740993'])
			assert.throws(() => parseTop('--top', bad), usageError(`--top must be a positive integer, not '${bad}'`));
	});
});

describe('parseArgs', () => {
	test('defaults: top 10, folded, no stop words, standard input', () => {
		assert.equal(DEFAULT_TOP, 10);
		assert.deepEqual(parseArgs([]), {
			help: false,
			top: 10,
			caseSensitive: false,
			stopWordsFile: undefined,
			file: undefined
		});
	});

	test('reads -n and --top', () => {
		assert.equal(parseArgs(['-n', '3']).top, 3);
		assert.equal(parseArgs(['--top', '4', 'in.txt']).top, 4);
		assert.equal(parseArgs(['in.txt', '-n', '1']).file, 'in.txt');
	});

	test('reads --case-sensitive and --stop-words, and only those set them', () => {
		const options = parseArgs(['--case-sensitive', '--stop-words', 'stop.txt', 'in.txt']);
		assert.equal(options.caseSensitive, true);
		assert.equal(options.stopWordsFile, 'stop.txt');
		assert.equal(options.file, 'in.txt');
		assert.equal(parseArgs(['-n', '2', 'in.txt']).caseSensitive, false);
		assert.equal(parseArgs(['in.txt']).help, false);
	});

	test('refuses --stop-words with no file', () => {
		assert.throws(() => parseArgs(['--stop-words']), usageError('--stop-words needs a file'));
	});

	test('refuses an unknown option, long or short', () => {
		assert.throws(() => parseArgs(['--bogus']), usageError("unknown option '--bogus'"));
		assert.throws(() => parseArgs(['in.txt', '-x']), usageError("unknown option '-x'"));
	});

	test('reads "-" as a file name, which the tool reads as standard input', () => {
		assert.equal(parseArgs(['-']).file, '-');
	});

	test('refuses a second file', () => {
		assert.throws(() => parseArgs(['a.txt', 'b.txt']), usageError('expected at most one file, got 2'));
		assert.equal(parseArgs(['a.txt']).file, 'a.txt');
	});

	test('takes everything after "--" as a file', () => {
		assert.equal(parseArgs(['--', 'x']).file, 'x');
		assert.equal(parseArgs(['--', '--help']).file, '--help');
		assert.equal(parseArgs(['-n', '2', '--', '-x']).file, '-x');
		assert.equal(parseArgs(['-n', '2', '--', '-x']).top, 2);
	});

	test('help wins wherever it appears before "--"', () => {
		assert.deepEqual(parseArgs(['-h']), { help: true });
		assert.deepEqual(parseArgs(['--help']), { help: true });
		assert.deepEqual(parseArgs(['in.txt', '--bogus', '--help']), { help: true });
		assert.deepEqual(parseArgs(['-h', '--', 'in.txt']), { help: true });
	});

	test('usage names the program, every option and the default', () => {
		assert.match(USAGE, /^Usage: node bin\/wordfreq\.js \[options\] \[file\]/);
		for (const option of ['-n N', '--top N', '--case-sensitive', '--stop-words FILE', '-h', '--help', 'default 10'])
			assert.ok(USAGE.includes(option), option);
	});
});
