// ⭐ `JAN-EXEC` Phase 7, P7-2 (DESIGN-the-live-end-to-end-run.md §6, P7-2 D7 and D9; `REG-F-536`) — THE ARCHIVE SCAN: WHERE
// A FILE NAMES THE OPERATOR'S ACCOUNT, OR AN ABSOLUTE PATH, FOUND BEFORE ANYTHING DRAWN FROM THE RUN IS COMMITTED.
//
//   bun scripts/phase7/archive-scan.ts <file or folder> [<file or folder> ...]
//
// Every executor prompt carries the host's absolute workspace path, which names the account (`REG-F-536`), and a
// command's output reaches the record unredacted (`REG-F-521` W-3). So the run's archive holds the account name by
// construction, and it stays outside the repository (design §10). What may be committed is a SUMMARY, and only once
// this scan finds nothing in it: the run report scans its own output with `scanText` and writes nothing on a hit.
//
// ⛔ WHAT IT LOOKS FOR, IN EVERY SPELLING THE RUN CAN PRODUCE:
//   · the ACCOUNT NAME, from every source that names it — `os.userInfo()`'s name and the last segment of its home
//     folder, the last segment of USERPROFILE, and USERNAME (`accountNames`) — case-insensitively and as a whole
//     token: `jdoe` in `C:\Users\jdoe\…`, never inside `jdoeson`; ⛔ and never `unknown`, which Bun gives as the user
//     record's name when USERNAME is unset (`REG-F-545`);
//   · a DRIVE PATH — `C:\`, `C:/`, and the JSON-escaped `C:\\`: Pi prints the working directory with `/`, and the stores
//     keep `\` escaped;
//   · a UNC PATH — `\\host\share`, its JSON-escaped `\\\\host\\share`, and `//host/share` — ⭐ at EVERY depth of JSON
//     escaping, and escaped code at none (`PATH_PATTERNS`);
//   · a HOME PATH — `/Users/…` or `/home/…`;
//   · a drive in MSYS or WSL spelling — `/c/Users/…`, `/mnt/c/…` — which git's shell prints.
// ⭑ EACH ALSO WHERE AN ESCAPE STANDS BEFORE IT: a JSON escape (`\n`, `\t`, `\u001b` …) or a terminal colour code ends
// a token, though its last character is a letter — `"x:\nE:\\runs"`, `user:\njdoe`, `ESC[90mC:\…` — so a second view of
// the text, each escape's letters blanked to spaces, is scanned beside it, at the same places (`escapesBlanked`).
// ⭑ AND IN EITHER ENCODING WINDOWS WRITES: a file that opens with a UTF-16 byte-order mark (PowerShell 5's `>` and
// `Out-File`) is read as UTF-16, and one that holds NUL bytes is read as UTF-16 as well as UTF-8.
// ⚠ A RELATIVE PATH IS NOT A HIT, and nor is a URL: `https://x/y` has a scheme before its `//`, and `.\\src\\a.js` —
// a relative path as JSON spells it — has a `.` before its `\\`.
// ⚠ IT FAILS SAFE. An account named with a common word would hit prose, and the report would be refused; a refusal is
// read and judged, where a leak is not.
// ⛔ AND IT NEVER SCANS FOR NOTHING (`REG-F-545`): when no account name can be found, the command line refuses, as the
// run report does — a scan that looks for no name finds none, and its "no hit" would read as a pass.
//
// The command line exits 0 on no hit, 1 on any, 2 when it cannot scan — no such path, or no account name to look for.
// It prints each hit's KIND AND PLACE, never its text: the text is the account name, and a terminal log is the kind of
// thing that gets pasted into a commit.
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs';
import { userInfo } from 'node:os';
import { basename, join } from 'node:path';

export type ScanHitKind = 'account-name' | 'drive-path' | 'unc-path' | 'home-path' | 'msys-path';

export interface ScanHit {
	/** The file, relative to what was scanned, `/`-separated. */
	readonly file: string;
	/** 1-based. */
	readonly line: number;
	/** 1-based, in UTF-16 code units. */
	readonly column: number;
	readonly kind: ScanHitKind;
	/** The text that matched. ⚠ For a caller's own judgement; the command line never prints it. */
	readonly match: string;
}

/**
 * The absolute-path spellings, each a token START: what precedes it is not part of a longer word, so `https://` (a scheme
 * before `//`), `src/home/x` (a relative path through a `home` folder), `e2e/c/x` and `.\\test\\x` (a relative path,
 * JSON-escaped) are not hits.
 * ⭐⭐ A UNC SHARE BY ITS RUNS' RATIO, AT EVERY DEPTH OF JSON ESCAPING (the re-review of E4's fix round: finding 3 was not
 * fixed). Each level of escaping doubles every backslash, so a share's leading run is TWICE its separator at every depth
 * — `\\host\share`, `\\\\host\\share`, `\\\\\\\\host\\\\share` — and escaped code's runs are EQUAL at every depth: `/\r\n/`
 * is a run of one before each letter, `\\r\\n` escaped once, `\\\\r\\\\n` twice, as is a source literal of escaped
 * backslashes (`"\\r\\n"`). So the pattern takes a run of 2n backslashes, a host, and a run of exactly n (`(\\+)\1 … \1`).
 * It replaces two fixed spellings — the leading pair or its one escaping, then a separator of one or two — which read
 * `\\r\\n` as a share (P3's 199 hits) and a share escaped twice as nothing. Decoding one level (`scanDecodedJson`) did not
 * answer the first: a recording's values are themselves JSON — the executor's answer is the contract's envelope, whose
 * work product carries each file's full text, and each review prompt embeds that work product — so code sits two levels
 * deep, and one level decoded still left `\\r\\n` there.
 */
const PATH_PATTERNS: readonly (readonly [ScanHitKind, RegExp])[] = [
	['drive-path', /(?<![A-Za-z0-9])[A-Za-z]:[\\/]/g],
	['unc-path', /(?<![\w.:\\])(\\+)\1[\w.$-]+\1[\w.$-]/g],
	['unc-path', /(?<![\w:/])\/\/[\w.$-]+\/[\w.$-]/g],
	['home-path', /(?<![\w.])\/(?:Users|home)\/[\w.$-]/g],
	['msys-path', /(?<![\w.:/])\/(?:mnt\/)?[A-Za-z]\/[\w.$-]/g]
];

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

/**
 * A terminal colour code, raw or JSON-escaped (`ESC[90m`, `\u001b[90m`), and a JSON escape other than `\\` — read left to
 * right, so an escaped backslash is consumed whole and the letter after it stays a letter. ⚠ Its ESC is computed from its
 * code, as `scripts/mutants/run.ts` computes its ANSI stripper's: `no-control-regex` refuses an ESC in a regex literal
 * however it is spelled.
 */
const ESCAPES = new RegExp(
	String.raw`${String.fromCodePoint(27)}\[[0-?]*[ -/]*[@-~]|\\u001[bB]\[[0-?]*[ -/]*[@-~]|\\(?:\\|u[0-9A-Fa-f]{4}|[bfnrt"/])`,
	'g'
);

/**
 * ⭐ `text` with each escape blanked to spaces — the same places, and no escape letter left to end a token. ⚠ A
 * backslash that opens an escape is KEPT: in raw text it is a path's own separator (`C:\runs`, whose `\r` reads as an
 * escape), and blanking it would hide the very drive the view is there to find.
 */
export const escapesBlanked = (text: string): string =>
	text.replace(ESCAPES, (m) => {
		if (m === '\\\\') return m;
		return m.startsWith('\\') ? `\\${' '.repeat(m.length - 1)}` : ' '.repeat(m.length);
	});

/** Strings in code-unit order: the same on every host and locale. */
const byCodeUnit = (a: string, b: string): number => Number(a > b) - Number(a < b);

/** What the OS says of the user it runs as (`os.userInfo()`): its name and its home folder. Either may be missing. */
export interface UserRecord {
	readonly username?: string;
	readonly homedir?: string;
}

function osUser(): UserRecord {
	try {
		const { username, homedir } = userInfo();
		return { username, homedir };
	} catch {
		// ⚠ A host with no passwd entry for this uid throws here; USERPROFILE and USERNAME still name the account on Windows.
		return {};
	}
}

/**
 * ⛔ THE NAME BUN GIVES A USER IT DID NOT NAME — NEVER AN ACCOUNT NAME (`REG-F-545`). Bun 1.3.14 on Windows answers
 * `os.userInfo().username` with the literal `unknown` when USERNAME is unset, its home folder still right; Node answers
 * the real name either way (driven 2026-10-10). Turbo's default env mode unsets USERNAME, and USERPROFILE, for the gate's
 * tests: looked for, `unknown` hit the report's own `unknown` cells and refused it, while the account itself went
 * unlooked-for — the scan blind exactly where the gate runs it. ⚠ An account truly named `unknown` is then looked for by
 * no source, its list is empty, and every caller refuses: it fails safe.
 */
const PLACEHOLDER_NAME = 'unknown';

/** The last segment of a path, by either separator; undefined when it has none. */
const leafOf = (path: string | undefined): string | undefined =>
	path?.split(/[\\/]/).reduce<string | undefined>((leaf, segment) => (segment === '' ? leaf : segment), undefined);

/**
 * ⭐ THE ACCOUNT NAMES A SCAN LOOKS FOR, FROM EVERY SOURCE THAT NAMES THE ACCOUNT: the user record's name and the last
 * segment of its home folder, the last segment of USERPROFILE, and USERNAME — trimmed, lower case, de-duplicated. Pure:
 * `env` and `user` (the user record, `os.userInfo()` by default — or its name alone) are its parameters.
 * ⚠ A name shorter than two characters is dropped: it would match every one-letter token, and a scan that hits
 * everything says nothing. ⛔ So is the placeholder `unknown` (`PLACEHOLDER_NAME`). ⛔ THE LIST CAN BE EMPTY, and each
 * caller that scans with it refuses then (`noAccountName`), rather than scanning for nothing (`REG-F-545`).
 */
export function accountNames(
	env: Readonly<Record<string, string | undefined>> = process.env,
	user: UserRecord | string | undefined = osUser()
): string[] {
	const { username, homedir }: UserRecord = typeof user === 'string' ? { username: user } : (user ?? {});
	return [
		...new Set(
			[username, leafOf(homedir), leafOf(env.USERPROFILE), env.USERNAME]
				.map((n) => n?.trim().toLowerCase())
				.filter((n): n is string => n !== undefined && n.length >= 2 && n !== PLACEHOLDER_NAME)
		)
	];
}

/**
 * ⛔ WHAT A CALLER SAYS WHEN `accountNames` FINDS NONE (`REG-F-545`), refusing rather than scanning: a scan that looks
 * for no name finds none, and its "no hit" would read as a pass. `what` is what could not be checked.
 */
export const noAccountName = (what: string): string =>
	"no account name could be found — not the user record's name or home folder, nor USERPROFILE or USERNAME — so " +
	`${what} cannot be checked for it (REG-F-536)`;

/** The 0-based index at which each line of `text` starts. */
function lineStarts(text: string): number[] {
	const starts = [0];
	for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
	return starts;
}

/** The 1-based line and column of `index`, by binary search over `starts`. */
function place(starts: readonly number[], index: number): { line: number; column: number } {
	let lo = 0;
	let hi = starts.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (starts[mid]! <= index) lo = mid;
		else hi = mid - 1;
	}
	return { line: lo + 1, column: index - starts[lo]! + 1 };
}

/**
 * ⭐ Every place `text` names one of `names` (`accountNames`) or an absolute path, in order — in the text as it is, and in
 * its escapes-blanked view (`escapesBlanked`), whose places are the same. Pure.
 */
export function scanText(text: string, file: string, names: readonly string[]): ScanHit[] {
	const found: { index: number; kind: ScanHitKind; match: string }[] = [];
	const blanked = escapesBlanked(text);
	for (const view of blanked === text ? [text] : [text, blanked]) {
		for (const [kind, pattern] of PATH_PATTERNS)
			for (const m of view.matchAll(pattern))
				found.push({ index: m.index, kind, match: text.slice(m.index, m.index + m[0].length) });
		for (const name of names)
			for (const m of view.matchAll(new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(name)}(?![A-Za-z0-9])`, 'gi')))
				found.push({ index: m.index, kind: 'account-name', match: text.slice(m.index, m.index + m[0].length) });
	}
	if (found.length === 0) return [];
	const starts = lineStarts(text);
	const seen = new Set<string>();
	found.sort((a, b) => a.index - b.index);
	return found
		.filter((h) => {
			const key = `${h.index}:${h.kind}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.map((h) => ({ file, ...place(starts, h.index), kind: h.kind, match: h.match }));
}

/** A plain JSON key, shown as `.key` in a hit's place; any other is shown by its ordinal, never its text. */
const PLAIN_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * ⭐⭐ `JAN-EXEC` Phase 8 (the review of E4, finding 3) — EVERY PLACE A JSON TEXT'S DECODED VALUES NAME THE ACCOUNT OR AN
 * ABSOLUTE PATH: each string value, and each key, scanned AS IT DECODES (`scanText`), never as JSON spells it. `jsonl`
 * reads one value per non-blank line. A hit's `file` is `<file>:<line> <path>` — `$.stdout`,
 * `$.toolCalls[0].arguments.contents` — and its line and column are inside that value; a key that is not a plain identifier, or that itself hits, is shown by
 * its ordinal (`{key 2}`), so a place never prints the text it refused.
 * ⛔ WHY DECODED: ~~JSON doubles every backslash, and two backslashes before a word read as the start of a UNC path — code a
 * model wrote, a regular expression like `/\r\n/`, became `\\r\\n` in a recording line and refused it (P3's archive: 199
 * unc-path hits, every one JSON-escaped code). Decoded, a backslash is the one the text holds: an escaped one is not a
 * path, and~~ ⭐ (the re-review of E4's fix round: decoding undoes ONE level, and a recording's values are JSON themselves
 * — the executor's answer envelope, a review prompt embedding the work product — so code two levels deep stayed escaped,
 * and still read as a share; the share pattern now holds at every depth by its own rule, `PATH_PATTERNS`.) Decoded, a
 * hit is placed inside its value, and an escape inside a value that is itself JSON is one level nearer what it stands
 * for: a newline before the account name in the answer envelope is `\\n` in the line's text, an escaped backslash and a
 * letter, where no token ends, and `\n` decoded, where one does. A real drive, share or home path — or the account name —
 * in a value still hits, as it would in the file the value came from. ⚠ A line that is not JSON is scanned as text,
 * whole, so nothing is skipped for failing to parse.
 */
export function scanDecodedJson(
	text: string,
	file: string,
	names: readonly string[],
	jsonl: boolean
): ScanHit[] {
	const hits: ScanHit[] = [];
	const walk = (value: unknown, at: string, path: string): void => {
		if (typeof value === 'string') {
			hits.push(...scanText(value, `${at} ${path}`, names));
			return;
		}
		if (Array.isArray(value)) {
			value.forEach((v, k) => walk(v, at, `${path}[${k}]`));
			return;
		}
		if (typeof value !== 'object' || value === null) return;
		Object.entries(value).forEach(([key, v], k) => {
			const keyHits = scanText(key, `${at} ${path}{key ${k + 1}}`, names);
			hits.push(...keyHits);
			walk(v, at, PLAIN_KEY.test(key) && keyHits.length === 0 ? `${path}.${key}` : `${path}{key ${k + 1}}`);
		});
	};
	const lines = jsonl ? text.split('\n') : [text];
	lines.forEach((line, k) => {
		if (line.trim() === '') return;
		const at = `${file}:${jsonl ? k + 1 : 1}`;
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			hits.push(...scanText(line, `${at} (as text)`, names));
			return;
		}
		walk(parsed, at, '$');
	});
	return hits;
}

/**
 * ⭐ A file's text in each encoding it can be in: UTF-16 after a UTF-16 byte-order mark; otherwise UTF-8 — and, when it
 * holds a NUL byte, UTF-16 too, from either byte (a BOM-less UTF-16 file, or text inside a binary one).
 */
export function textsOf(bytes: Buffer): { readonly text: string; readonly encoding: 'UTF-8' | 'UTF-16' }[] {
	const even = (b: Buffer) => b.subarray(0, b.length - (b.length % 2));
	if (bytes[0] === 0xff && bytes[1] === 0xfe) return [{ text: even(bytes.subarray(2)).toString('utf16le'), encoding: 'UTF-16' }];
	if (bytes[0] === 0xfe && bytes[1] === 0xff)
		return [{ text: Buffer.from(even(bytes.subarray(2))).swap16().toString('utf16le'), encoding: 'UTF-16' }];
	const utf8 = { text: bytes.toString('utf8'), encoding: 'UTF-8' as const };
	if (!bytes.includes(0)) return [utf8];
	return [
		utf8,
		{ text: even(bytes).toString('utf16le'), encoding: 'UTF-16' },
		{ text: even(bytes.subarray(1)).toString('utf16le'), encoding: 'UTF-16' }
	];
}

/**
 * Every hit under `target` — a file, or a folder walked whole. ⛔ A symbolic link is never followed: its TARGET's text is
 * scanned as what the link says, so a link out of the archive is a hit and not a walk through somebody else's tree.
 */
export function scanTarget(
	target: string,
	names: readonly string[]
): { readonly hits: ScanHit[]; readonly files: number } {
	const hits: ScanHit[] = [];
	let files = 0;
	const visit = (path: string, rel: string): void => {
		const stat = lstatSync(path);
		if (stat.isSymbolicLink()) {
			files += 1;
			hits.push(...scanText(readlinkSync(path), `${rel} (link)`, names));
		} else if (stat.isDirectory())
			for (const entry of readdirSync(path).sort(byCodeUnit))
				visit(join(path, entry), rel === '' ? entry : `${rel}/${entry}`);
		else if (stat.isFile()) {
			files += 1;
			for (const { text, encoding } of textsOf(readFileSync(path)))
				hits.push(...scanText(text, encoding === 'UTF-8' ? rel : `${rel} (as UTF-16)`, names));
		}
	};
	const root = lstatSync(target);
	visit(target, root.isDirectory() && !root.isSymbolicLink() ? '' : basename(target));
	return { hits, files };
}

/** How many hits are printed per file; the count says how many more there were. */
const PRINTED_PER_FILE = 20;

/** Prints one target's hits by their place and kind, at most `PRINTED_PER_FILE` a file; returns the files that had any. */
function printHits(hits: readonly ScanHit[], say: (s: string) => void): string[] {
	const byFile = new Map<string, ScanHit[]>();
	for (const h of hits) byFile.set(h.file, [...(byFile.get(h.file) ?? []), h]);
	for (const [file, inFile] of byFile) {
		for (const h of inFile.slice(0, PRINTED_PER_FILE)) say(`${file}:${h.line}:${h.column} ${h.kind}`);
		if (inFile.length > PRINTED_PER_FILE) say(`${file}: ${inFile.length - PRINTED_PER_FILE} more hit(s) not printed`);
	}
	return [...byFile.keys()];
}

/**
 * Returns the exit code: 0 no hit, 1 a hit, 2 nothing could be scanned. `names` are the account names looked for
 * (`accountNames`), given so a test can hand it none.
 */
export function main(
	argv: readonly string[],
	write: (s: string) => void,
	names: readonly string[] = accountNames()
): number {
	const say = (s: string) => write(`phase7/archive-scan — ${s}\n`);
	if (argv.length === 0) {
		say('usage: bun scripts/phase7/archive-scan.ts <file or folder> [<file or folder> ...]');
		return 2;
	}
	const flag = argv.find((a) => a.startsWith('--'));
	if (flag !== undefined) {
		say(`usage: unknown flag ${flag} — this command takes paths only`);
		return 2;
	}
	const missing = argv.filter((a) => !existsSync(a));
	if (missing.length > 0) {
		say(`usage: no such file or folder: ${missing.map((a) => basename(a)).join(', ')}`);
		return 2;
	}
	if (names.length === 0) {
		say(`refused, and nothing was scanned: ${noAccountName('the files')}`);
		return 2;
	}
	let total = 0;
	let files = 0;
	const hitFiles = new Set<string>();
	for (const target of argv) {
		const scanned = scanTarget(target, names);
		files += scanned.files;
		total += scanned.hits.length;
		for (const file of printHits(scanned.hits, say)) hitFiles.add(`${target}\u0000${file}`);
	}
	say(
		total === 0
			? `no hit in ${files} file(s): no account name and no absolute path`
			: `${total} hit(s) in ${hitFiles.size} of ${files} file(s) (REG-F-536)`
	);
	return total === 0 ? 0 : 1;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2), (s) => process.stdout.write(s));
