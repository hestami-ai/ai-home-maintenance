// ⭐ `JAN-EXEC` Phase 7, P7-2 (DESIGN-the-live-end-to-end-run.md §6, D7 and D9; `REG-F-536`) — THE ARCHIVE SCAN: the account
// name and every spelling of an absolute path the run can produce, found with the file and line they are on.
//
// `scripts/phase7/archive-scan.ts` is what stands between the run's archive — which holds the operator's account name by
// construction, in every executor prompt (`REG-F-536`) — and anything committed from it; the run report scans its own
// output with it and writes nothing on a hit. So:
//   · ⭐ each spelling is a hit, by kind, at its line and column: a drive with `\`, with `/`, JSON-escaped; a UNC share, raw
//     and escaped, and `//host/share`; a home folder; git's shell's `/c/…` and WSL's `/mnt/c/…`;
//   · ⭐ the account name is a hit in any case, as a whole token — ⛔ and never inside a longer word, or a ULID;
//   · ⛔ what is not a path is not a hit: a relative path — with backslashes, raw or JSON-escaped, too — a URL, an id, a
//     timestamp — a scan that hits prose blocks every report, and one that hits everything says nothing;
//   · ⭐ a path or the account name right after an escape (a JSON `\n`, a terminal colour code) is a hit — ⭐ at any depth
//     of JSON escaping (the lead's delegated decision of 2026-10-15, to be registered) — and a file written in UTF-16 is
//     read as UTF-16;
//   · ⭐ a folder is walked whole, each hit naming its file relative to what was scanned;
//   · ⛔ the command line prints each hit's kind and place and NEVER its text, which is the account name itself;
//   · ⛔ `REG-F-545`: the account is looked for by every source that names it — the user record's name and home folder,
//     USERPROFILE and USERNAME — and NEVER as `unknown`, which Bun gives as the user record's name when USERNAME is unset;
//     with no name found the command line refuses, and run under bun as the gate runs it, it still finds the account;
//   · ⭐ (`JAN-EXEC` Phase 8; the review of E4, finding 3) a replay recording is scanned by its DECODED values
//     (`scanDecodedJson`): ~~code whose JSON spelling reads as a UNC path is no hit, and~~ a real path or the account
//     name in a value still is a hit, at its place in the value — ⭐ and the account name after an escape inside a value
//     that is itself JSON ~~, which the line's own text hides~~ (⭐ the line's own text finds it too now, two levels
//     deep) — synthetic lines only;
//   · ⭐ (the re-review of E4's fix round: finding 3 was not fixed — decoding one level moved the false hits a level
//     down) a UNC share is a hit at EVERY depth of JSON escaping, its leading run twice its separator ⭐ or four times it
//     (CommonMark's source spelling), and escaped code ⭐ whose runs are equal is a hit at none — wherever a recording
//     holds it: a write_file argument, the answer envelope's files, a review prompt that embeds the work product. ⚠ Code
//     whose own runs have a share's ratio is a hit at every depth, and fails safe;
//   · ⭐ (the lead's delegated decision of 2026-10-15, to be registered) the account name, and every path, after an escape
//     at ANY depth of JSON escaping is a hit — the confirm of E4's second fix round found the account name missed after
//     an escape two levels deep (`\\n`) — and a share in each spelling the old pattern caught ⭐ but a leading run of two
//     with a separator of two, which is code's shape and no hit (three of its four; the check of E4's polish round, F3),
//     CommonMark's source spelling (a leading run of four, a separator of one) among them; ⚠ a drive whose first folder
//     begins with an escape letter is a hit, and a letter and a colon before an escaped newline are spelled the same: the
//     scan cannot tell the two apart, and keeps the drive.
//
// No model is called, and nothing outside a temporary folder is read but the scan's own script, run by bun.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { splitExecutionEnvelope } from '../apps/rph-demo/src/lib/server/execution/execution-contract.js';
import {
	accountNames,
	main,
	scanDecodedJson,
	scanTarget,
	scanText,
	textsOf,
	type UserRecord
} from '../scripts/phase7/archive-scan.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SCAN = join(ROOT, 'scripts', 'phase7', 'archive-scan.ts');

/**
 * ⛔ `REG-F-545` — the scan's command line run under bun as the gate runs it: NO USERNAME and NO USERPROFILE, as turbo's
 * default env mode leaves a task — so that Bun 1.3.14 on Windows answers `os.userInfo().username` with `unknown` — and
 * nothing else of the environment but PATH and SYSTEMROOT, so bun runs. Set here, so it never hangs on how the runner
 * was launched.
 * ⚠ NOT BY HANDING SPAWN AN ENV WITHOUT THEM: on Windows, Node's spawn and Bun's alike put USERNAME, USERPROFILE and the
 * other variables libuv requires back into the child's environment, read from the PARENT's own (driven 2026-10-10), so
 * an env that omits them strips nothing. A bun of its own removes them from ITS environment first, then runs the scan —
 * whatever process, pool or shell this test runs in — and says whether the two were absent where it ran.
 */
function scanStripped(target: string): { stripped: unknown; code: number | null; out: string } {
	const driver = [
		'delete process.env.USERNAME;',
		'delete process.env.USERPROFILE;',
		"const { spawnSync } = require('node:child_process');",
		'const env = { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT };',
		"const probe = 'process.stdout.write(JSON.stringify([process.env.USERNAME === undefined, process.env.USERPROFILE === undefined]))';",
		"const seen = spawnSync(process.execPath, ['--eval', probe], { env, encoding: 'utf8' });",
		`const r = spawnSync(process.execPath, ${JSON.stringify([SCAN, target])}, { cwd: ${JSON.stringify(ROOT)}, env, encoding: 'utf8' });`,
		"process.stdout.write(JSON.stringify({ stripped: JSON.parse(seen.stdout), code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') }));"
	].join('\n');
	const r = spawnSync('bun', ['--eval', driver], { cwd: ROOT, encoding: 'utf8', timeout: 60_000 });
	expect(r.status, `arrangement: the stripping driver ran: ${r.stderr}`).toBe(0);
	return JSON.parse(r.stdout) as { stripped: unknown; code: number | null; out: string };
}

/** A made-up account: what the run's own host is called must not decide what this test proves. */
const NAMES = ['jdoe'];
const B = '\\';
const kinds = (text: string, names: readonly string[] = NAMES) =>
	scanText(text, 'f', names).map((h) => [h.kind, h.line, h.column]);
/** `text` as it reads inside a JSON string `depth` levels deep: each level doubles every backslash. */
const escaped = (text: string, depth: number): string =>
	Array.from({ length: depth }).reduce<string>((t) => JSON.stringify(t).slice(1, -1), text);

const dirs: string[] = [];
afterAll(() => {
	for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe('JAN-EXEC P7-2 — what the archive scan finds', () => {
	it('⭐ a drive path is a hit in each of its spellings: with \\, with /, and JSON-escaped', () => {
		expect(kinds(`C:${B}runs${B}p7`)).toEqual([['drive-path', 1, 1]]);
		expect(kinds('the cwd is E:/runs/p7')).toEqual([['drive-path', 1, 12]]);
		expect(kinds(`{"cwd":"e:${B}${B}runs${B}${B}p7"}`)).toEqual([['drive-path', 1, 9]]);
		expect(kinds('file:///E:/runs/p7/x.js')).toEqual([['drive-path', 1, 9]]);
	});

	it('⭐ a UNC share is a hit, raw, JSON-escaped, and with forward slashes', () => {
		expect(kinds(`${B}${B}host${B}share${B}x`)).toEqual([['unc-path', 1, 1]]);
		expect(kinds(`"${B}${B}${B}${B}host${B}${B}share"`)).toEqual([['unc-path', 1, 2]]);
		expect(kinds('at //host/share/x')).toEqual([['unc-path', 1, 4]]);
	});

	it('⭐ a home folder, and a drive in git’s shell’s or WSL’s spelling, is a hit', () => {
		expect(kinds('/home/someone/run')).toEqual([['home-path', 1, 1]]);
		expect(kinds('--out=/Users/someone/x')).toEqual([['home-path', 1, 7]]);
		expect(kinds('cd /e/Projects/x')).toEqual([['msys-path', 1, 4]]);
		expect(kinds('/mnt/c/runs')).toEqual([['msys-path', 1, 1]]);
	});

	it('⭐ the account name is a hit in any case, as a whole token, on the line it is on', () => {
		expect(kinds(`one\nC:${B}Users${B}JDoe${B}x`)).toEqual([
			['drive-path', 2, 1],
			['account-name', 2, 10]
		]);
		expect(kinds('signed by jdoe.')).toEqual([['account-name', 1, 11]]);
	});

	it('⛔ the account name is never a hit inside a longer word, or inside an id', () => {
		expect(kinds('jdoeson@example.com, ajdoe, run_01JDOEAX')).toEqual([]);
	});

	it('⛔ what is not an absolute path is no hit: a relative path, a URL, an id, a timestamp, a ratio', () => {
		for (const text of [
			'test/unit/wordfreq.test.js',
			'src/home/x and lane/report/report.md',
			'https://example.com/a/b and http://127.0.0.1:4322/undertakings/und_1?/beginExecute',
			'pol_01ARZ3NDEKTSV4RRFFQ69GDEM0 tnt-local/RETAINED_BY_PARTICIPATION/ab12',
			'2026-10-09T12:00:00.000Z',
			'stage 5a/5b, K2r/K2j, captures/e2e-1/stdout.txt, and/or'
		])
			expect(kinds(text), text).toEqual([]);
	});

	it('⛔ a relative path with backslashes is no hit in either spelling — raw, or JSON-escaped as the report writes it', () => {
		// ⭐ (The re-review of E4's fix round) and one whose first separator is doubled: its runs are a share's ratio
		// (`\\test\u…`), and the `.` before them is what makes it relative — escaping alone no longer tells it apart.
		for (const path of [
			`.${B}test${B}unit${B}wordfreq.test.js`,
			`..${B}src${B}wordfreq.js`,
			`test${B}unit${B}x.js`,
			`.${B}${B}test${B}unit${B}x.js`
		]) {
			expect(kinds(path), path).toEqual([]);
			expect(kinds(JSON.stringify({ argv: ['node', '--test', path] })), `${path} as JSON`).toEqual([]);
		}
	});

	it('⭐ a path or the account name right after an escape is a hit: a JSON \\n or \\t, a terminal colour code, raw or escaped', () => {
		expect(kinds(JSON.stringify({ text: `files:\nE:${B}runs${B}p7${B}a.js` }))).toEqual([['drive-path', 1, 18]]);
		expect(kinds(JSON.stringify({ text: 'files:\tD:/runs/p7/a.js' }))).toEqual([['drive-path', 1, 18]]);
		expect(kinds(JSON.stringify({ stdout: 'user:\njdoe\n' }))).toEqual([['account-name', 1, 19]]);
		expect(kinds(JSON.stringify({ text: `x\n${B}${B}host${B}share${B}y` }))).toEqual([['unc-path', 1, 13]]);
		const esc = String.fromCodePoint(27);
		expect(kinds(`${esc}[90mC:${B}runs${B}a.js${esc}[39m`)).toEqual([['drive-path', 1, 6]]);
		expect(kinds(JSON.stringify(`${esc}[90mjdoe${esc}[39m`))).toEqual([['account-name', 1, 12]]);
		// ~~⭐ The view keeps every place: an escaped backslash stays one, and the letter after it a letter.~~ ⭐ No view any
		// more (`AFTER_AN_ESCAPE`): the escape before a token is looked behind, never matched, so a hit is the token alone.
		expect(scanText(JSON.stringify({ stdout: 'user:\njdoe\n' }), 'f', NAMES).map((h) => h.match)).toEqual([
			'jdoe'
		]);
		// ⛔ And in raw text a separator that reads as an escape (`\r` in `C:\runs`) is still found behind a colour code.
		expect(kinds(`${esc}[90mC:${B}temp${B}new${esc}[39m`)).toEqual([['drive-path', 1, 6]]);
	});

	it('⛔ a name inside a longer word is no hit after an escape — ⚠ and an escaped backslash and a letter before the name read as an escape: a newline escaped twice is spelled the same, so it is a hit, and fails safe', () => {
		// ⭐ (the lead's delegated decision of 2026-10-15, to be registered: the account name at ANY depth of escaping.)
		// ~~No hit:~~ `dir\\njdoe` is the folder `njdoe` escaped once, AND the account name after a newline escaped twice.
		expect(kinds(JSON.stringify(`dir${B}njdoe`))).toEqual([['account-name', 1, 8]]);
		expect(kinds(JSON.stringify('line\njdoeson'))).toEqual([]);
	});
});

describe('JAN-EXEC P7-2 — the encodings a file can be in', () => {
	const text = `cwd: C:${B}Users${B}jdoe${B}runs`;
	const utf16le = (s: string) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(s, 'utf16le')]);
	const utf16be = (s: string) => Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(s, 'utf16le').swap16()]);
	const found = (bytes: Buffer) => textsOf(bytes).map((t) => [t.encoding, scanText(t.text, 'f', NAMES).map((h) => h.kind)]);

	it('⭐ a file with a UTF-16 byte-order mark is read as UTF-16, either byte order — as PowerShell 5 writes it', () => {
		expect(found(utf16le(text))).toEqual([['UTF-16', ['drive-path', 'account-name']]]);
		expect(found(utf16be(text))).toEqual([['UTF-16', ['drive-path', 'account-name']]]);
	});

	it('⭐ a file holding NUL bytes is read as UTF-16 too, from either byte; ⛔ one that holds none, as UTF-8 alone', () => {
		const odd = Buffer.concat([Buffer.from([0x00]), Buffer.from(text, 'utf16le')]);
		expect(found(odd).filter(([, kinds]) => (kinds as string[]).length > 0)).toEqual([['UTF-16', ['drive-path', 'account-name']]]);
		expect(textsOf(Buffer.from(text, 'utf8')).map((t) => t.encoding)).toEqual(['UTF-8']);
	});

	it('⭐ a folder scan finds the account in a UTF-16 file, and says it read it as UTF-16', () => {
		const d = mkdtempSync(join(tmpdir(), 'jpwb-p7-scan-'));
		dirs.push(d);
		writeFileSync(join(d, 'out.txt'), utf16le(text));
		expect(scanTarget(d, NAMES).hits.map((h) => [h.file, h.kind])).toEqual([
			['out.txt (as UTF-16)', 'drive-path'],
			['out.txt (as UTF-16)', 'account-name']
		]);
	});
});

describe('JAN-EXEC P7-2 — whose account the scan looks for', () => {
	it('⭐ the OS user name and the USERPROFILE folder’s name, lower case, each once', () => {
		expect(accountNames({ USERPROFILE: `C:${B}Users${B}JDoe` }, 'jdoe')).toEqual(['jdoe']);
		expect(accountNames({ USERPROFILE: 'C:/Users/Field.Ops/' }, 'svc-run')).toEqual(['svc-run', 'field.ops']);
	});

	it('⛔ a name shorter than two characters is not looked for: it would hit every one-letter word', () => {
		expect(accountNames({ USERPROFILE: `C:${B}Users${B}y` }, 'x')).toEqual([]);
	});

	it('⛔ REG-F-545 — `unknown`, the name Bun gives the user record when USERNAME is unset, is never looked for: the home folder names the account', () => {
		// As Bun 1.3.14 on Windows answers under turbo's default env mode, which passes neither USERNAME nor USERPROFILE.
		expect(accountNames({}, { username: 'unknown', homedir: `C:${B}Users${B}jdoe` })).toEqual(['jdoe']);
		// ⛔ In any case, from any source.
		expect(accountNames({ USERNAME: 'Unknown' }, { username: 'UNKNOWN', homedir: '/home/jdoe/' })).toEqual(['jdoe']);
	});

	it('⭐ each source alone names the account: the user record’s name, its home folder, USERPROFILE, USERNAME', () => {
		const alone: readonly (readonly [string, Record<string, string>, UserRecord])[] = [
			['the user record’s name', {}, { username: 'JDoe' }],
			['the user record’s home folder', {}, { homedir: `C:${B}Users${B}JDoe` }],
			['USERPROFILE', { USERPROFILE: `C:${B}Users${B}JDoe` }, {}],
			['USERNAME', { USERNAME: 'JDoe' }, {}]
		];
		for (const [source, env, user] of alone) expect(accountNames(env, user), source).toEqual(['jdoe']);
		// ⭐ All four naming one account name it once.
		expect(
			accountNames({ USERPROFILE: `C:${B}Users${B}jdoe`, USERNAME: 'JDOE' }, { username: 'jdoe', homedir: '/home/JDoe' })
		).toEqual(['jdoe']);
	});

	it('⛔ REG-F-545 — with every source empty, or the placeholder, NO name is found: the list is empty, for each caller to refuse on', () => {
		expect(accountNames({}, {})).toEqual([]);
		expect(accountNames({ USERNAME: ' ', USERPROFILE: '' }, { username: '', homedir: '/' })).toEqual([]);
		expect(
			accountNames(
				{ USERNAME: 'unknown', USERPROFILE: `C:${B}Users${B}Unknown` },
				{ username: 'unknown', homedir: '/home/unknown' }
			)
		).toEqual([]);
	});

	it('⭐ the names found on this host are looked for — so a scan run here finds this host’s account', () => {
		const names = accountNames();
		expect(names.length, 'this host names its account').toBeGreaterThan(0);
		expect(scanText(`C:${B}Users${B}${names[0]!.toUpperCase()}${B}x`, 'f', names).map((h) => h.kind)).toContain(
			'account-name'
		);
	});
});

describe('JAN-EXEC P7-2 — scanning a folder, and the command line', () => {
	const folder = () => {
		const d = mkdtempSync(join(tmpdir(), 'jpwb-p7-scan-'));
		dirs.push(d);
		mkdirSync(join(d, 'lane', 'report'), { recursive: true });
		writeFileSync(join(d, 'lane', 'report', 'report.md'), '# Report\nclean line\n');
		writeFileSync(join(d, 'lane', 'boot.json'), `{\n  "db": "C:${B}${B}Users${B}${B}jdoe${B}${B}run"\n}\n`);
		return d;
	};

	it('⭐ a folder is walked whole, each hit naming its file relative to the folder, at its line and column', () => {
		const scanned = scanTarget(folder(), NAMES);
		expect(scanned.files).toBe(2);
		expect(scanned.hits.map((h) => [h.file, h.line, h.column, h.kind])).toEqual([
			['lane/boot.json', 2, 10, 'drive-path'],
			['lane/boot.json', 2, 21, 'account-name']
		]);
	});

	it('⭐ exit 0 on no hit, 1 on a hit, 2 when there is nothing to scan — each refusal by its own words', () => {
		const d = folder();
		const said: string[] = [];
		expect(main([join(d, 'lane', 'report')], (s) => said.push(s))).toBe(0);
		expect(said.join('')).toMatch(/no hit in 1 file\(s\)/);
		expect(main([d], () => undefined)).toBe(1);
		const refused = (argv: string[]) => {
			const out: string[] = [];
			return [main(argv, (s) => out.push(s)), out.join('')];
		};
		expect(refused([])).toEqual([2, 'phase7/archive-scan — usage: bun scripts/phase7/archive-scan.ts <file or folder> [<file or folder> ...]\n']);
		// ⛔ A flag is refused as a flag — never as a path it does not name.
		expect(refused(['--json', d])).toEqual([2, 'phase7/archive-scan — usage: unknown flag --json — this command takes paths only\n']);
		expect(refused([join(d, 'no-such-folder')])).toEqual([2, 'phase7/archive-scan — usage: no such file or folder: no-such-folder\n']);
	});

	it('⛔ the command line prints each hit’s kind and place, and never the text that matched', () => {
		const d = mkdtempSync(join(tmpdir(), 'jpwb-p7-scan-'));
		dirs.push(d);
		const name = accountNames()[0]!;
		writeFileSync(join(d, 'note.txt'), `a path: C:${B}Users${B}${name}${B}x\n`);
		const said: string[] = [];
		expect(main([d], (s) => said.push(s))).toBe(1);
		const out = said.join('');
		expect(out).toMatch(/note\.txt:1:9 drive-path/);
		expect(out).toMatch(/note\.txt:1:\d+ account-name/);
		// ⛔ Asked as a yes or no, so this test's own failure never prints the account name it guards.
		expect(out.toLowerCase().includes(name), 'the printed hits carry the account name').toBe(false);
		expect(out.includes(`C:${B}`), 'the printed hits carry a drive path').toBe(false);
	});

	it('⛔ REG-F-545 — with no account name to look for, the command line scans nothing, and says why: exit 2, never a "no hit"', () => {
		const d = folder();
		const out: string[] = [];
		// A folder with no path in it: scanned for no name, it would read "no hit", a pass.
		expect(main([join(d, 'lane', 'report')], (s) => out.push(s), [])).toBe(2);
		expect(out.join('')).toBe(
			"phase7/archive-scan — refused, and nothing was scanned: no account name could be found — not the user record's " +
				'name or home folder, nor USERPROFILE or USERNAME — so the files cannot be checked for it (REG-F-536)\n'
		);
	});

	it('⛔ REG-F-545 — run under bun as the gate runs it, with no USERNAME and no USERPROFILE, the scan still finds the account by its home folder, and `unknown` is no hit', () => {
		const d = mkdtempSync(join(tmpdir(), 'jpwb-p7-scan-'));
		dirs.push(d);
		// What that environment still knows: the home folder, which Bun reads from the OS (driven 2026-10-10). Written as
		// a bare token, no path around it, so only the account name can hit it.
		const home = userInfo().homedir.split(/[\\/]/).filter((s) => s !== '').at(-1)!;
		writeFileSync(join(d, 'signed.txt'), `signed by ${home}.\n`);
		writeFileSync(join(d, 'cells.md'), '| 3 | unknown |\n');
		const signed = scanStripped(join(d, 'signed.txt'));
		expect(signed.stripped, 'arrangement: the scan ran with USERNAME and USERPROFILE absent').toEqual([true, true]);
		// ⛔ Each compared whole: the scan's output never carries the name, so neither can this test's failure.
		expect([signed.code, signed.out]).toEqual([
			1,
			'phase7/archive-scan — signed.txt:1:11 account-name\nphase7/archive-scan — 1 hit(s) in 1 of 1 file(s) (REG-F-536)\n'
		]);
		const cells = scanStripped(join(d, 'cells.md'));
		expect([cells.code, cells.out]).toEqual([0, 'phase7/archive-scan — no hit in 1 file(s): no account name and no absolute path\n']);
	});
});

describe('⭐ JAN-EXEC Phase 8 — a replay recording is scanned by its DECODED values, never its JSON spelling (the review of E4, finding 3)', () => {
	// ⭑ BUILT, NOT SPELLED: a drive and a home folder joined at run time, so no line of this file names one (`REG-F-536`).
	const drive = `${String.fromCodePoint(81)}:`;
	const decoded = (text: string, jsonl = true) =>
		scanDecodedJson(text, 'executor.jsonl', NAMES, jsonl).map((h) => [h.file, h.line, h.column, h.kind]);

	it('⛔ code where a recording holds it is no hit — a write_file argument, the answer envelope’s files, a review prompt embedding the work product — and a share there still is', () => {
		// ⭑ `/\r\n|\n/`, a regular expression of SINGLE backslashes, in each place a Phase 7 recording carries a file the
		// executor wrote: the write_file call (one JSON level), the contract's envelope, whose work product holds each file's
		// full text (two: the answer is JSON inside the line), and the work-product review's prompt, which embeds that work
		// product re-serialised (`splitExecutionEnvelope`; two). The re-review drove the decoded scan red at the last two.
		const code = `export const lines = (text) => text.split(/${B}r${B}n|${B}n/);\n`;
		const answer = (document: string): string =>
			JSON.stringify({
				workProduct: {
					documents: [{ path: 'docs/notes.md', text: document }],
					files: [{ path: 'src/lines.js', text: code }],
					hashes: [],
					commands: []
				},
				rationale: { rationale: 'written', assumptions: [], limitations: [], residualUncertainty: [] }
			});
		const recordingLines = (document: string): string =>
			[
				JSON.stringify({
					unit: 'implementation',
					toolCalls: [
						{ name: 'write_file', arguments: { path: 'src/lines.js', contents: code }, outcome: 'COMPLETED' }
					],
					answer: { arrived: true, text: answer(document) }
				}),
				JSON.stringify({
					unit: 'implementation',
					prompt: `Judge this work product.\n${splitExecutionEnvelope(answer(document)).workProduct}\n`
				})
			].join('\n');
		expect(decoded(recordingLines('no path here'))).toEqual([]);
		// ⭑ CONTROL: the same places hold a share when one is there — in the work product's document, two levels deep.
		expect(
			decoded(recordingLines(`copied to ${B}${B}host${B}share${B}out`)).map(([file, , , kind]) => [file, kind])
		).toEqual([
			['executor.jsonl:1 $.answer.text', 'unc-path'],
			['executor.jsonl:2 $.prompt', 'unc-path']
		]);
	});

	it('⭐ the account name after an escape inside a value that is itself JSON — the answer envelope — is a hit decoded, placed in its value, and in the line’s own text too, two levels deep', () => {
		const line = JSON.stringify({
			unit: 'implementation',
			answer: {
				arrived: true,
				text: JSON.stringify({ workProduct: {}, rationale: { rationale: 'ran as\njdoe' } })
			}
		});
		// ⭑ ~~CONTROL: in the line's own text that newline is `\\n` — an escaped backslash, then a letter — so no token ends
		// before the name, and a scan of the text passes it.~~ ⭐ In the line's own text that newline is `\\n`, a newline
		// escaped twice — and an escape ends a token at any depth (`AFTER_AN_ESCAPE`; the lead's delegated decision of
		// 2026-10-15, to be registered), so the text's own scan finds the name too. Decoded, it is placed in its value.
		expect(scanText(line, 'executor.jsonl', NAMES).map((h) => h.kind)).toEqual(['account-name']);
		expect(decoded(line).map(([file, , , kind]) => [file, kind])).toEqual([
			['executor.jsonl:1 $.answer.text', 'account-name']
		]);
	});

	it('⭐ a real drive, share or home path — or the account name — in a decoded value still hits, at its place in the value', () => {
		const home = ['', 'home', 'someone', 'run'].join('/');
		const line = JSON.stringify({
			argv: ['node', '--test', `${drive}${B}elsewhere${B}test`],
			stdout: `ok\nwritten to ${B}${B}host${B}share${B}out by jdoe\n`,
			stderr: `see ${home}`
		});
		expect(decoded(line)).toEqual([
			['executor.jsonl:1 $.argv[2]', 1, 1, 'drive-path'],
			['executor.jsonl:1 $.stdout', 2, 12, 'unc-path'],
			['executor.jsonl:1 $.stdout', 2, 32, 'account-name'],
			['executor.jsonl:1 $.stderr', 1, 5, 'home-path']
		]);
	});

	it('⛔ a key that names the account is a hit, placed by its ordinal so no place prints it — and so is what lies under it', () => {
		const hits = scanDecodedJson(
			JSON.stringify({ unit: 'x', jdoe: { note: `${drive}${B}x` } }),
			'reviewer.jsonl',
			NAMES,
			true
		);
		expect(hits.map((h) => [h.file, h.kind])).toEqual([
			['reviewer.jsonl:1 ${key 2}', 'account-name'],
			['reviewer.jsonl:1 ${key 2}.note', 'drive-path']
		]);
		expect(hits.some((h) => h.file.includes('jdoe')), 'a place printed the name it refused').toBe(false);
	});

	it('⛔ nothing is skipped for failing to parse: a line that is not JSON is scanned whole, as text — and a blank line still counts', () => {
		const text = [JSON.stringify({ ok: true }), '', `not json: ${drive}${B}x`].join('\n');
		expect(decoded(text)).toEqual([['executor.jsonl:3 (as text)', 1, 11, 'drive-path']]);
	});

	it('⭐ a manifest is ONE JSON value over many lines, read whole', () => {
		const manifest = JSON.stringify({ models: { reviewer: { note: `ran in ${drive}/runs` } } }, null, 2);
		expect(scanDecodedJson(manifest, 'recording.json', NAMES, false).map((h) => [h.file, h.kind])).toEqual([
			['recording.json:1 $.models.reviewer.note', 'drive-path']
		]);
	});
});

describe('⭐ JAN-EXEC Phase 8 — a UNC share is a hit at EVERY depth of JSON escaping, and escaped code whose runs are equal at none (the re-review of E4’s fix round: finding 3 was not fixed)', () => {
	it('⭐ a share is a hit at depths 0 to 3 — its leading run twice its separator at each, as each level doubles both', () => {
		for (const share of [`${B}${B}host${B}share${B}x`, `${B}${B}wsl$${B}Ubuntu${B}x`])
			for (let depth = 0; depth <= 3; depth += 1)
				expect(kinds(escaped(share, depth)), `${share} at depth ${depth}`).toEqual([['unc-path', 1, 1]]);
	});

	it('⛔ escaped code is no share at any depth — each of its runs as long as the next: a line split, a word boundary, a unicode escape, a source literal of escaped backslashes', () => {
		for (const code of [
			`text.split(/${B}r${B}n|${B}n/)`,
			`text.match(/${B}bthe${B}b/g)`,
			`'${B}u00e9t${B}u00e9'`,
			`text.split("${B}${B}r${B}${B}n")`
		])
			for (let depth = 0; depth <= 3; depth += 1)
				expect(kinds(escaped(code, depth)), `${code} at depth ${depth}`).toEqual([]);
	});

	it('⚠ code whose own runs are two to one, or four to one, HAS a share’s shape, and is a hit at every depth — the ratio cannot tell it from a share, and the scan fails safe', () => {
		// ⭑ A regular expression of a literal backslash, a `d` and an escaped dot — runs of two and one — and the same with
		// a run of four.
		for (const code of [`/${B}${B}d${B}./`, `/${B}${B}${B}${B}d${B}./`])
			for (let depth = 0; depth <= 3; depth += 1)
				expect(kinds(escaped(code, depth)), `${code} at depth ${depth}`).toEqual([['unc-path', 1, 2]]);
	});
});

describe('⭐ JAN-EXEC Phase 8 — the account name, and every path, after an escape at ANY depth of JSON escaping; a share in each spelling the old pattern caught but a leading run of two with a separator of two (the lead’s delegated decision of 2026-10-15, to be registered; REG-F-536)', () => {
	const esc = String.fromCodePoint(27);
	/** What may stand right before a token, each a character JSON escapes: a newline, a tab, a control character, a colour code. */
	const BEFORE: readonly (readonly [string, string])[] = [
		['a newline', '\n'],
		['a tab', '\t'],
		['a control character', String.fromCodePoint(1)],
		['a colour code', `${esc}[90m`]
	];

	it('⭐ the account name after each, escaped zero to four times, is a hit', () => {
		for (const [what, before] of BEFORE)
			for (let depth = 0; depth <= 4; depth += 1)
				expect(
					kinds(escaped(`ran as${before}jdoe.`, depth)).map(([kind]) => kind),
					`after ${what}, at depth ${depth}`
				).toContain('account-name');
	});

	it('⭐ a drive, a share — its host or its share name beginning with an escape letter too — a home folder and git’s shell’s drive after a newline, escaped zero to three times, are hits', () => {
		// ⭑ BUILT, NOT SPELLED: every absolute path joined at run time, so no line of this file names one (`REG-F-536`).
		const paths: readonly (readonly [string, string])[] = [
			['drive-path', [`${String.fromCodePoint(81)}:`, 'runs', 'x'].join(B)],
			['unc-path', ['', '', 'host', 'share', 'x'].join(B)],
			['unc-path', ['', '', 'nas', 'share', 'x'].join(B)],
			['unc-path', ['', '', 'host', 'tools', 'x'].join(B)],
			['home-path', ['', 'home', 'someone', 'x'].join('/')],
			['msys-path', ['', 'c', 'runs', 'x'].join('/')]
		];
		for (const [kind, path] of paths)
			for (let depth = 0; depth <= 3; depth += 1)
				expect(
					kinds(escaped(`files:\n${path}`, depth)).map(([k]) => k),
					`${kind} at depth ${depth}`
				).toContain(kind);
	});

	it('⭐ a share in each spelling the old pattern caught but a leading run of two with a separator of two is a hit at every depth — raw, escaped once, and CommonMark’s source spelling, a leading run of four and a separator of one', () => {
		// ⭑ Each share by its runs, leading and separating — the label never spells a path (`REG-F-536`). ⚠ Three of the old
		// pattern's four: its fourth, a leading run of two and a separator of two, is code's shape, and the escaped code
		// above asserts it no hit (a source literal of escaped backslashes, at depth 0; `PATH_PATTERNS`).
		for (const [lead, separator] of [
			[2, 1],
			[4, 2],
			[4, 1]
		] as const)
			for (let depth = 0; depth <= 3; depth += 1)
				expect(
					kinds(escaped(`${B.repeat(lead)}host${B.repeat(separator)}share`, depth)),
					`a share of runs ${lead} and ${separator}, at depth ${depth}`
				).toEqual([['unc-path', 1, 1]]);
	});

	it('⚠ a drive whose first folder begins with an escape letter is a hit — and a letter and a colon before an escaped newline are the same characters: the scan cannot tell them apart, and keeps the drive', () => {
		// ⭑ The second fix round's residual (a): `a:` before an escaped newline reads as a drive. Removing it would lose
		// this drive: one spelling, a drive in raw text and a newline escaped once — built, never spelled (`REG-F-536`).
		const drive = [`${String.fromCodePoint(81)}:`, 'new'].join(B);
		expect(escaped(`${String.fromCodePoint(81)}:\new`, 1)).toBe(drive);
		expect(kinds(drive)).toEqual([['drive-path', 1, 1]]);
	});
});
