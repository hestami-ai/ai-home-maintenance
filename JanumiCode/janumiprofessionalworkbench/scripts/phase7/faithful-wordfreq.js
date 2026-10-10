#!/usr/bin/env node
// ⭐ `JAN-EXEC` Phase 7, P7-4b (DESIGN-the-live-end-to-end-run.md §6) — THE FAITHFUL SINGLE-FILE wordfreq, WHICH EVERY
// END-TO-END VARIANT IS CUT FROM (`seeded-faults.ts` `END_TO_END_VARIANTS`).
//
// ⛔ ONE FILE, IMPORTING NOTHING BUT NODE'S OWN MODULES, BECAUSE IT REPLACES SOMEONE ELSE'S ENTRY. The seeded-faults tool
// writes this text, or a variant of it, over a target workspace's `bin/wordfreq.js` and runs that workspace's own
// end-to-end tests. The target's `src/` is the model's, shaped however the model shaped it, so a variant that imported
// from `../src/` would be testing the model's modules, not the deviation the variant plants.
//
// ⭐ IT IS ALSO THE BASELINE, AND THAT IS WHAT MAKES A "CAUGHT" MEAN ANYTHING. The tool runs the target's end-to-end tests on
// this text unchanged before any variant: a suite that fails on a correct CLI fails on every variant too, and "caught"
// would then be the suite failing for its own reasons — a kill no fault caused (`vitest.projects.ts` records the same
// vacuity for the mutation runner). So the tool judges no variant until this file passes the target's suite — and
// `verif/phase7-seeded-faults.test.ts` holds this file to the acceptance suite and to the reference fixture's own
// end-to-end tests, so it is shown correct before it is trusted.
//
// ⚠ EACH VARIANT IS ONE FIND-AND-REPLACE ON THIS TEXT, and the tool refuses a variant whose find is not here EXACTLY ONCE.
// The lines a variant anchors on are written to be unique; an edit here that duplicates one, or removes one, makes that
// variant NOT_APPLIED rather than silently identical to this file (the mutation ledger's anchor rule, applied here).
import { readFile } from 'node:fs/promises';

const DEFAULT_TOP = 10;
const EXIT_OK = 0;
const EXIT_UNREADABLE = 1;
const EXIT_USAGE = 2;
/** A word: a maximal run of letters (any script), decimal digits, or apostrophes (U+0027 and U+2019). */
const WORD = /[\p{L}\p{Nd}'’]+/gu;
const USAGE = [
	'Usage: node bin/wordfreq.js [options] [file]',
	'',
	'Prints the N most frequent words in UTF-8 text read from file, or from standard input',
	'when no file is given or the file is "-".',
	'',
	'Options:',
	'  -n N, --top N       print the N most frequent words (a positive integer; default 10)',
	'  --case-sensitive    count words as written instead of folding them to lower case',
	'  --stop-words FILE   exclude the words listed in FILE, one per line',
	'  -h, --help          print this usage and exit'
].join('\n');

/** Write the brief's one-line error and return `code`. */
function fail(message, code) {
	process.stderr.write(`wordfreq: ${String(message).replace(/[\r\n]+/g, ' ')}\n`);
	return code;
}

function reason(error) {
	if (error?.code === 'ENOENT') return 'no such file';
	if (error?.code === 'EISDIR') return 'is a directory';
	if (error?.code === 'EACCES' || error?.code === 'EPERM') return 'permission denied';
	return error?.code ?? 'unreadable';
}

async function readStdin() {
	const chunks = [];
	for await (const chunk of process.stdin) chunks.push(chunk);
	return Buffer.concat(chunks).toString('utf8');
}

/** A positive integer in decimal digits, or undefined. */
function positiveInteger(value) {
	if (value === undefined || !/^[0-9]+$/.test(value)) return undefined;
	const n = Number(value);
	return Number.isSafeInteger(n) && n >= 1 ? n : undefined;
}

/** `{ options }`, `{ help: true }`, or `{ exit }` once a usage error has been written. */
function parse(argv) {
	const end = argv.indexOf('--');
	const optionArgs = end === -1 ? argv : argv.slice(0, end);
	if (optionArgs.includes('-h') || optionArgs.includes('--help')) return { help: true };
	const options = { top: DEFAULT_TOP, caseSensitive: false, stopWordsFile: undefined, file: undefined };
	const files = [];
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--') {
			files.push(...argv.slice(i + 1));
			break;
		}
		if (arg === '-n' || arg === '--top') {
			i += 1;
			const top = positiveInteger(argv[i]);
			if (top === undefined) return { exit: fail(`${arg} must be a positive integer`, EXIT_USAGE) };
			options.top = top;
		} else if (arg === '--case-sensitive') {
			options.caseSensitive = true;
		} else if (arg === '--stop-words') {
			i += 1;
			if (argv[i] === undefined) return { exit: fail('--stop-words needs a file', EXIT_USAGE) };
			options.stopWordsFile = argv[i];
		} else if (arg.startsWith('-') && arg !== '-') {
			return { exit: fail(`unknown option '${arg}'`, EXIT_USAGE) };
		} else {
			files.push(arg);
		}
	}
	if (files.length > 1) return { exit: fail(`expected at most one file, got ${files.length}`, EXIT_USAGE) };
	options.file = files[0];
	return { options };
}

/** Most frequent first; a tie goes to the word, ascending (code-unit order). */
function byFrequency([wordA, countA], [wordB, countB]) {
	if (countA !== countB) return countB - countA;
	return wordA < wordB ? -1 : wordA > wordB ? 1 : 0;
}

async function main(argv) {
	const parsed = parse(argv);
	if (parsed.help) {
		process.stdout.write(`${USAGE}\n`);
		return EXIT_OK;
	}
	if (parsed.exit !== undefined) return parsed.exit;
	const { options } = parsed;
	const { caseSensitive } = options;
	const stopWords = new Set();
	if (options.stopWordsFile !== undefined) {
		let listed;
		try {
			listed = await readFile(options.stopWordsFile, 'utf8');
		} catch (error) {
			return fail(`cannot read stop-word file '${options.stopWordsFile}': ${reason(error)}`, EXIT_UNREADABLE);
		}
		for (const line of listed.split(/\r?\n/)) {
			const word = line.trim();
			if (word !== '') stopWords.add(caseSensitive ? word : word.toLowerCase());
		}
	}
	const fromStdin = options.file === undefined || options.file === '-';
	let text;
	try {
		text = fromStdin ? await readStdin() : await readFile(options.file, 'utf8');
	} catch (error) {
		const name = fromStdin ? 'standard input' : `'${options.file}'`;
		return fail(`cannot read ${name}: ${reason(error)}`, EXIT_UNREADABLE);
	}
	const found = text.match(WORD) ?? [];
	const words = caseSensitive ? found : found.map((word) => word.toLowerCase());
	const counts = new Map();
	for (const word of words) {
		if (stopWords.has(word)) continue;
		counts.set(word, (counts.get(word) ?? 0) + 1);
	}
	const top = [...counts].sort(byFrequency).slice(0, options.top);
	process.stdout.write(top.map(([word, count]) => `${count} ${word}\n`).join(''));
	return EXIT_OK;
}

process.exitCode = await main(process.argv.slice(2));
