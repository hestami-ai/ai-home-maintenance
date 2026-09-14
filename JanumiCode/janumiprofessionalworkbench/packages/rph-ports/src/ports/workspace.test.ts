// JAN-EXEC Phase 1 — the containment predicate, pinned in BOTH directions.
//
// ⛔ THIS IS THE ONLY THING STANDING BETWEEN A MODEL-SUPPLIED PATH AND THE HOST'S FILESYSTEM. Every escape here
// is an escape a filesystem adapter would perform for real, so the predicate is tested at the PORT rather than
// once per adapter — the same argument `artifact-store-contract.ts` makes about `purge`.
import { describe, expect, it } from 'vitest';
import { containedWorkspacePath } from './workspace.js';

describe('containedWorkspacePath — what may not leave the workspace', () => {
	it('⛔ REFUSES every shape that resolves outside the workspace root', () => {
		// THE MUTANT: normalize first and check afterwards. `/etc/passwd` normalizes to a tidy-looking
		// `etc/passwd` and reads as contained, which is the escape stated as a pass.
		expect(containedWorkspacePath('../secrets'), 'a leading ..').toBeUndefined();
		expect(containedWorkspacePath('a/../../b'), 'underflow after a pop').toBeUndefined();
		expect(
			containedWorkspacePath('a/b/../../../c'),
			'underflow several levels down'
		).toBeUndefined();
		expect(containedWorkspacePath('/etc/passwd'), 'posix-absolute').toBeUndefined();
		expect(containedWorkspacePath('\\Windows\\System32'), 'backslash-absolute').toBeUndefined();
		expect(containedWorkspacePath('C:/Windows/System32'), 'drive-qualified').toBeUndefined();
		// ⚠ A DRIVE-RELATIVE PATH CARRIES NO SEPARATOR AND WOULD NORMALIZE TO A TIDY RELATIVE STRING. On Windows
		// `c:src` means "src, on drive C, relative to that drive's current directory" — a different volume.
		expect(containedWorkspacePath('c:src'), 'drive-relative').toBeUndefined();
		expect(containedWorkspacePath(''), 'the empty path names nothing').toBeUndefined();
		expect(containedWorkspacePath('.'), 'the root is a directory, not a file').toBeUndefined();
		expect(
			containedWorkspacePath('a/..'),
			'and so is anything that normalizes back to it'
		).toBeUndefined();
	});

	it('⭑ CONTROL — it ACCEPTS the lawful shapes, and normalizes them to one spelling', () => {
		// ⛔ WITHOUT THIS THE PREDICATE IS SATISFIABLE BY REFUSING EVERYTHING, and a workspace nothing can be
		// written into would pass every assertion above while making the seam useless. THE MUTANT: return
		// `undefined` unconditionally.
		expect(containedWorkspacePath('a/b.txt')).toBe('a/b.txt');
		expect(containedWorkspacePath('./a/b.txt'), 'a leading . is not an escape').toBe('a/b.txt');
		// ⚠ `a/../b.txt` IS INSIDE, and refusing every `..` would reject it. A guard that refuses lawful paths
		// teaches its callers to route around it, which is how a containment check comes to be optional.
		expect(containedWorkspacePath('a/../b.txt')).toBe('b.txt');
		expect(containedWorkspacePath('a\\b.txt'), 'backslashes normalize to one spelling').toBe(
			'a/b.txt'
		);
		expect(containedWorkspacePath('a//b.txt'), 'and so do repeated separators').toBe('a/b.txt');
	});

	it('⚠ the normalized form is what a caller must key on — two spellings of one path agree', () => {
		// Without normalization a workspace would hold `a/b.txt` and `a\b.txt` as two different files, and a
		// step that wrote one and read the other would see an absence it did not create.
		expect(containedWorkspacePath('a\\b.txt')).toBe(containedWorkspacePath('./a/b.txt'));
	});
});

// ── ⛔ WHAT WIN32 RESOLVES, NOT WHAT THE STRING LOOKS LIKE ───────────────────────────────────────────────────
//
// ⭐ EVERY CASE BELOW WAS DRIVEN BEFORE IT WAS WRITTEN, and the three shapes are measured facts about this
// host rather than readings of documentation (node v24.11.1 / win32, one `mkdtemp` directory per probe):
//
//   1. TRAILING DOTS AND SPACES ARE STRIPPED BY THE WIN32 PATH LAYER, and `node:path` does not strip them —
//      so the two disagree about which directory a name means. `mkdirSync` (which reaches the filesystem
//      through the long-path prefix) created literal entries `'.. '`, `'...'`, `'....'`, `' ..'`, `'UND-1 '`,
//      `'UND-1.'` and `'UND-1..'` in one directory, and a REAL CHILD PROCESS launched with each of them as its
//      `cwd` reported: the first four as the PARENT directory, and the last three as `UND-1` — a DIFFERENT
//      existing directory. A guard comparing strings sees seven distinct names; the operating system sees two.
//   2. A COLON INSIDE A COMPONENT NAMES AN NTFS ALTERNATE DATA STREAM. `writeFileSync('report.md:stolen')`
//      succeeded, `readdirSync` showed only `report.md`, and `statSync('report.md')` reported the size of the
//      visible file alone. The bytes are on disk and the inventory does not know.
//   3. A WIN32 DEVICE NAME IS NOT A LOCATION. Under bun, `writeFileSync(<dir>/NUL, …)` reported success and the
//      path did not exist afterwards: `existsSync` false, `readdirSync` empty, read-back ENOENT. Under node the
//      same call created a real file, because libuv reaches the filesystem through the `\?\` prefix that
//      bypasses device translation. ⚠ THE RUNTIME DECIDES, and this repository runs both — vitest under bun and
//      the SvelteKit server under node — so the predicate cannot be right on one and silent on the other.
//
// ⛔ THE COST IS AN OVER-REFUSAL ON POSIX, AND IT IS THE PORT'S OWN PRECEDENT. `a.` and `aux.log` are lawful
// filenames on Linux and are refused here anyway, exactly as BOTH separator spellings are refused on both
// platforms: "a Windows host accepts either, so a guard that knew only one would hold on one platform and
// silently not on the other." A containment predicate that admitted a name on one host and refused it on
// another would make the SAME workspace path mean two things.
describe('⛔ containedWorkspacePath — the names the FILESYSTEM rewrites under a guard that compares STRINGS', () => {
	it('⛔ REFUSES every component Win32 strips back to a DIFFERENT directory', () => {
		// ⭑ THE ATTACKER'S OWN VECTORS, verbatim. The first four resolved to the ROOTS directory holding EVERY
		// Undertaking's workspace; the last two resolved to `UND-1`, another Undertaking's directory.
		for (const hostile of ['.. ', '...', '....', ' ..', 'UND-1 ', 'UND-1.', 'UND-1..', 'a/b. ', 'a /b.txt'])
			expect(containedWorkspacePath(hostile), hostile).toBeUndefined();
	});

	it('⛔ REFUSES a colon inside a component — an NTFS alternate data stream is not a file', () => {
		// The stream hides FROM `list()` by construction: `readdir` never names it and the visible file's size
		// does not include it, so the inventory the retention record rests on would be incomplete.
		for (const hostile of ['report.md:stolen', 'a/report.md:stolen', 'x:y', 'a/b:$DATA'])
			expect(containedWorkspacePath(hostile), hostile).toBeUndefined();
	});

	it('⛔ REFUSES a Win32 reserved device name, WITH OR WITHOUT an extension', () => {
		// ⚠ THE EXTENSION DOES NOT SAVE IT: Win32 resolves `NUL.txt` to the null device too, and the stem is what
		// decides. Derived as a pattern rather than enumerated — `com0`/`lpt0` are not reserved and are not listed.
		for (const hostile of ['NUL', 'nul', 'NUL.txt', 'CON', 'con.md', 'PRN', 'AUX', 'aux.log', 'COM1', 'lpt9.txt', 'a/NUL', 'a/nul.json'])
			expect(containedWorkspacePath(hostile), hostile).toBeUndefined();
	});

	it('⭑ CONTROL — the lawful neighbours of all three rules are still ACCEPTED', () => {
		// ⛔ WITHOUT THIS, EVERY REFUSAL ABOVE IS SATISFIABLE BY "REFUSES EVERYTHING", and a predicate that
		// rejected ordinary work-product names would teach its callers to route around it — the failure this
		// file's original control was written against.
		expect(containedWorkspacePath('a b.txt'), 'a space INSIDE a component is lawful').toBe('a b.txt');
		expect(containedWorkspacePath('a.b.txt'), 'dots inside a component are lawful').toBe('a.b.txt');
		expect(containedWorkspacePath('CONSOLE.ts'), 'a device name is the WHOLE stem, never a prefix').toBe('CONSOLE.ts');
		expect(containedWorkspacePath('nullable.ts'), 'and `nul` is not a prefix rule either').toBe('nullable.ts');
		expect(containedWorkspacePath('com10.txt'), 'com10 is not a Win32 device').toBe('com10.txt');
		expect(containedWorkspacePath('src/.env'), 'a leading dot is a name, not a trailing one').toBe('src/.env');
		expect(containedWorkspacePath('UND-1/x.txt'), 'and the ordinary id still passes').toBe('UND-1/x.txt');
	});
});
