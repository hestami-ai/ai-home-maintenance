// The command line, read against the brief: node bin/wordfreq.js [options] [file].

/** How many words are printed when no -n or --top is given. */
export const DEFAULT_TOP = 10;

export const USAGE = [
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

/** A usage error. Its message is what follows "wordfreq: " on standard error. */
export class UsageError extends Error {
	constructor(message) {
		super(message);
		this.name = 'UsageError';
	}
}

/** A positive integer, written in decimal digits, or a usage error naming the option. */
export function parseTop(option, value) {
	if (value === undefined) throw new UsageError(`${option} needs a positive integer`);
	const n = Number(value);
	if (!/^[0-9]+$/.test(value) || !Number.isSafeInteger(n) || n < 1)
		throw new UsageError(`${option} must be a positive integer, not '${value}'`);
	return n;
}

/**
 * The options in `argv` (the arguments after the script). Help wins wherever it appears before "--": a user asking
 * for usage is shown it rather than an error.
 */
export function parseArgs(argv) {
	const end = argv.indexOf('--');
	const optionArgs = end === -1 ? argv : argv.slice(0, end);
	if (optionArgs.includes('-h') || optionArgs.includes('--help')) return { help: true };
	const options = { help: false, top: DEFAULT_TOP, caseSensitive: false, stopWordsFile: undefined, file: undefined };
	const files = [];
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--') {
			files.push(...argv.slice(i + 1));
			break;
		}
		if (arg === '-n' || arg === '--top') {
			i += 1;
			options.top = parseTop(arg, argv[i]);
		} else if (arg === '--case-sensitive') {
			options.caseSensitive = true;
		} else if (arg === '--stop-words') {
			i += 1;
			if (argv[i] === undefined) throw new UsageError('--stop-words needs a file');
			options.stopWordsFile = argv[i];
		} else if (arg.startsWith('-') && arg !== '-') {
			throw new UsageError(`unknown option '${arg}'`);
		} else {
			files.push(arg);
		}
	}
	if (files.length > 1) throw new UsageError(`expected at most one file, got ${files.length}`);
	options.file = files[0];
	return options;
}
