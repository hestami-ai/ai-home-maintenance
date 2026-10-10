// The tool: options in, lines out, and an exit code. Everything it touches arrives through `io`, so the unit tests
// can drive it without a process.
import { countWords, formatTop, parseStopWords, topWords } from './count.js';
import { USAGE, UsageError, parseArgs } from './options.js';

export const EXIT = Object.freeze({ OK: 0, UNREADABLE: 1, USAGE: 2 });

/** Why a file could not be read, in a few words. */
function reason(error) {
	switch (error?.code) {
		case 'ENOENT':
			return 'no such file';
		case 'EISDIR':
			return 'is a directory';
		case 'EACCES':
		case 'EPERM':
			return 'permission denied';
		default:
			return error?.code ?? 'unreadable';
	}
}

/** A name on one line: an error is one line, whatever the path holds. */
const oneLine = (name) => String(name).replace(/[\r\n]+/g, ' ');

/**
 * Run wordfreq on `argv` and return its exit code.
 * `io` = { readFile(path) => Promise<string>, readStdin() => Promise<string>, out(text), err(text) }.
 */
export async function run(argv, io) {
	let options;
	try {
		options = parseArgs(argv);
	} catch (error) {
		if (!(error instanceof UsageError)) throw error;
		io.err(`wordfreq: ${error.message}\n`);
		return EXIT.USAGE;
	}
	if (options.help) {
		io.out(`${USAGE}\n`);
		return EXIT.OK;
	}
	let stopWords = new Set();
	if (options.stopWordsFile !== undefined) {
		try {
			stopWords = parseStopWords(await io.readFile(options.stopWordsFile), options);
		} catch (error) {
			io.err(`wordfreq: cannot read stop-word file '${oneLine(options.stopWordsFile)}': ${reason(error)}\n`);
			return EXIT.UNREADABLE;
		}
	}
	const fromStdin = options.file === undefined || options.file === '-';
	let text;
	try {
		text = fromStdin ? await io.readStdin() : await io.readFile(options.file);
	} catch (error) {
		const name = fromStdin ? 'standard input' : `'${oneLine(options.file)}'`;
		io.err(`wordfreq: cannot read ${name}: ${reason(error)}\n`);
		return EXIT.UNREADABLE;
	}
	io.out(formatTop(topWords(countWords(text, { ...options, stopWords }), options.top)));
	return EXIT.OK;
}
