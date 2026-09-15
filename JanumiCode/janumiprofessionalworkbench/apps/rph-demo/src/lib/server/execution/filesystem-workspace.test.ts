// JAN-EXEC Phase 2 — the victim for the DURABLE workspace adapter.
//
// ⭐ THE ASSERTION THIS FILE EXISTS FOR IS THE ONE `defaults/workspace.ts` CANNOT MAKE: bytes written through
// ONE workspace object are readable through a SECOND one built later over the same directory. That is `R8` —
// *"the workspace is the DELIVERABLE … it must persist, survive a restart"* — and it is also the difference
// between an Undertaking that builds one product and one that builds seven fragments.
//
// ⚠ EVERY DIRECTORY HERE IS UNDER `os.tmpdir()`, NEVER UNDER THE REPOSITORY. A spec that wrote into the
// checkout would be the very containment defect the phase removes, committed by its own test.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath, sep } from 'node:path';
import { createFilesystemWorkspace } from './filesystem-workspace.js';

/**
 * The record's basename, SPELLED OUT rather than imported.
 *
 * ⛔ THE ASSERTION MUST NOT IMPORT WHAT IT IS CHECKING. If this came from the module, renaming the constant
 * would move the test with it and every claim below would stay green against a record that had gone somewhere
 * else entirely. It is also no longer exported, and for the same reason: nothing outside that module needs it.
 */
const RECORD_BASENAME = '.jpwb-workspace-tombstones.json';

// ⛔ THE WORKSPACE IS ONE LEVEL BELOW THE DIRECTORY THIS SPEC OWNS, AND THAT IS NOT TIDINESS — IT IS A
// MEASURED REPAIR. The escape cases below assert that `../escaped.txt` was NOT created; with the workspace AT
// the mkdtemp root, that path resolves into the system temp directory, which `afterEach` does not own and
// cannot remove. The mutation run for `P2-l` genuinely writes that file (which is what proves the guard), and
// it then SURVIVED into the next run and reddened an unrelated assertion in a sibling spec. Nesting the
// workspace inside a container this spec created means every escape the suite provokes lands inside what it
// deletes.
let container = '';
let dir = '';

beforeEach(async () => {
	container = await mkdtemp(join(tmpdir(), 'jpwb-ws-'));
	dir = join(container, 'workspace');
	await mkdir(dir, { recursive: true });
});
afterEach(async () => {
	await rm(container, { recursive: true, force: true });
});

const retained = () =>
	createFilesystemWorkspace({
		ownerKind: 'UNDERTAKING',
		ownerId: 'und_01ARZ3NDEKTSV4RRFFQ69G5PAA',
		purgeability: 'RETAINED_BY_PARTICIPATION',
		directoryPath: dir
	});

const purgeable = () =>
	createFilesystemWorkspace({
		ownerKind: 'UNDERTAKING',
		ownerId: 'und_01ARZ3NDEKTSV4RRFFQ69G5PAA',
		purgeability: 'PURGEABLE_AT_EXPIRY',
		directoryPath: dir
	});

describe('the workspace is DURABLE — the deliverable outlives the object that wrote it (R8)', () => {
	it('⭐ bytes written through ONE workspace are read back through a SECOND one over the same directory', async () => {
		// ⭑⭑ THE MEASURED CONSEQUENCE, IN ONE ASSERTION. The spike: with one UNDERTAKING-owned directory a second
		// step in a NEW session with a NEW plan read a file the first step wrote. A per-object or per-step
		// workspace finds nothing here, and a multi-phase PWA then builds seven fragments instead of one product.
		const first = retained();
		const wrote = await first.writeFile('src/greet.js', 'console.log("hi")\n');
		expect(wrote.written, 'the first step must be able to write its work product').toBe(true);

		const second = retained();
		expect(await second.readFile('src/greet.js')).toBe('console.log("hi")\n');
	});

	it('⭑ and the bytes are genuinely on disk, at the path the entry names', async () => {
		// Without this the assertion above is satisfiable by any store that happens to be shared — including a
		// module-level Map, which would pass while surviving no restart at all.
		await retained().writeFile('src/greet.js', 'console.log("hi")\n');
		expect(await readFile(join(dir, 'src', 'greet.js'), 'utf8')).toBe('console.log("hi")\n');
	});

	it('⭑ the workspace DECLARES FILESYSTEM and reports its own absolute directory', async () => {
		// `planProcessRun` and `producerWorkingDirectory` both read these two declarations, and both refuse on
		// them. An adapter that touched disk while declaring IN_MEMORY would make every such refusal wrong.
		const ws = retained();
		expect(ws.materialization).toBe('FILESYSTEM');
		expect(ws.directoryPath).toBe(resolvePath(dir));
		expect(ws.ownerKind).toBe('UNDERTAKING');
	});
});

describe('containment — a path that escapes the workspace is REFUSED, never written', () => {
	// ⛔ THE ESCAPE AND ITS CONCEALMENT WOULD BE THE SAME LINE: a tolerated `../` both writes outside the
	// workspace and makes `list()` report a tidy relative entry, so the record of what the step wrote is also
	// wrong. Each form is asserted on the REFUSAL and on the ABSENCE of a file.
	for (const escaping of ['../escaped.txt', 'a/../../escaped.txt', '/etc/passwd', 'C:\\Windows\\x.txt', '\\\\srv\\share\\x.txt']) {
		it(`⛔ refuses '${escaping}' and leaves nothing behind`, async () => {
			const ws = retained();
			const out = await ws.writeFile(escaping, 'escaped');
			expect(out.written).toBe(false);
			expect(out.written === false && out.refusedBecause).toMatch(/does not name a location inside this workspace/);
			// The refusal is not enough on its own: a write that refused and ALSO wrote would pass the line above.
			expect(existsSync(resolvePath(dir, '..', 'escaped.txt'))).toBe(false);
			expect(await ws.readFile(escaping)).toBeUndefined();
			const purge = await ws.purge(escaping);
			expect(purge.purged).toBe(false);
		});
	}

	it('⭑ CONTROL — a path that stays inside, including one that walks back into itself, IS written', async () => {
		// Without this, every refusal above is satisfiable by "refuses everything", and a guard that refuses
		// lawful paths teaches its callers to route around it.
		const ws = retained();
		const out = await ws.writeFile('src/../src/nested/deep.txt', 'inside');
		expect(out.written && out.path).toBe('src/nested/deep.txt');
		expect(await ws.readFile('src/nested/deep.txt')).toBe('inside');
		// And it landed UNDER the workspace root rather than beside it.
		expect(resolvePath(dir, 'src/nested/deep.txt').startsWith(resolvePath(dir) + sep)).toBe(true);
	});

	// ── ⛔ RETIRED, NOT DELETED: TWO TESTS THAT GUARDED A RESERVED NAME THAT NO LONGER EXISTS ─────────────
	//
	// They asserted that `writeFile` and `purge` refuse `.jpwb-workspace-tombstones.json` *"BY ITS OWN NAME, not
	// as an escape"* and that *"the record never appears in `list()`"*. ⭐ BOTH PROPERTIES SURVIVE AND ARE NOW
	// STRUCTURAL RATHER THAN COMPARATIVE: the record is a SIBLING of the workspace directory, so no path this
	// workspace admits can reach it, `list()` walks a directory it is not in, and there is no reserved name left
	// to refuse. The successor is the describe block near the end of this file, which drives all four spellings
	// that defeated or falsely tripped the guard — including the NTFS 8.3 alias that beat its last revision.
	// ⚠ The distinction they protected — that a caller naming the record has not tried to ESCAPE, and telling
	// it that it did would be false — is kept by removing the second refusal entirely rather than by wording.

	it('⛔ the inventory reports the work and nothing else, the record included', async () => {
		// ⭑ THE SURVIVING HALF OF THE SECOND RETIRED TEST. It used to prove `list()` SKIPPED the record; it now
		// proves `list()` never had to, because the record is not under the root it walks.
		const ws = purgeable();
		await ws.writeFile('a.txt', 'a');
		await ws.purge('a.txt');
		expect((await ws.list()).map((e) => e.path)).toEqual(['a.txt']);
		expect(existsSync(join(dir, RECORD_BASENAME)), 'and it is not there to be skipped').toBe(false);
	});
});

describe('purge — the BYTES go and the ENTRY stays (PER-8, and the tombstone on disk)', () => {
	it('⛔ a RETAINED_BY_PARTICIPATION workspace REFUSES to purge, and the bytes are still there', async () => {
		const ws = retained();
		await ws.writeFile('src/greet.js', 'kept');
		const out = await ws.purge('src/greet.js');
		expect(out.purged).toBe(false);
		expect(out.purged === false && out.refusedBecause).toMatch(/PER-8 forbids it/);
		// ⚠ ASSERTED ON THE FILESYSTEM, NOT ON THE RETURN VALUE. A `purge` that refused and deleted anyway would
		// satisfy every assertion above — the shape this repository has the receipt for.
		expect(await ws.readFile('src/greet.js')).toBe('kept');
	});

	it('⭑ a PURGEABLE_AT_EXPIRY workspace purges — the read goes dark, the entry survives and says what it held', async () => {
		const ws = purgeable();
		await ws.writeFile('logs/build.txt', 'twelve-bytes');
		const out = await ws.purge('logs/build.txt');
		expect(out.purged).toBe(true);
		expect(await ws.readFile('logs/build.txt')).toBeUndefined();
		// ⛔ THE READ-SIDE ASSERTION ALONE PROVES NOTHING. Deleting the entry outright makes `readFile` answer
		// undefined exactly as a lawful purge does, so `list()` is what tells "purged on schedule" apart from
		// "never written" and from "lost" — and `byteSize` is the only surviving statement of WHAT was removed.
		expect(await ws.list()).toEqual([
			{ path: 'logs/build.txt', byteSize: 'twelve-bytes'.length, purged: true, nameCount: 1 }
		]);
		expect(existsSync(join(dir, 'logs', 'build.txt'))).toBe(false);
	});

	it('⭑ the tombstone SURVIVES A NEW WORKSPACE OBJECT — which is what a durable adapter can promise', async () => {
		// The in-memory default's own refusal discloses that it "CANNOT DISTINGUISH 'never written' from 'written
		// and lost at restart'". This adapter can, and this is the assertion that says so.
		await purgeable().writeFile('logs/build.txt', 'twelve-bytes');
		await purgeable().purge('logs/build.txt');
		expect(await purgeable().list()).toEqual([
			{ path: 'logs/build.txt', byteSize: 'twelve-bytes'.length, purged: true, nameCount: 1 }
		]);
	});

	it('⚠ a REWRITE clears the tombstone, because the absence is no longer true', async () => {
		const ws = purgeable();
		await ws.writeFile('logs/build.txt', 'first');
		await ws.purge('logs/build.txt');
		await ws.writeFile('logs/build.txt', 'second-run');
		expect(await ws.readFile('logs/build.txt')).toBe('second-run');
		expect(await ws.list()).toEqual([
			{ path: 'logs/build.txt', byteSize: 'second-run'.length, purged: false, nameCount: 1 }
		]);
	});

	it('⛔ purging a path that was never written REFUSES and says so — durably, not by inability to observe', async () => {
		const out = await purgeable().purge('never/written.txt');
		expect(out.purged).toBe(false);
		expect(out.purged === false && out.refusedBecause).toMatch(/nothing was purged/);
		expect(out.purged === false && out.refusedBecause).toMatch(/never written here/);
	});

	it('a purge the filesystem REJECTS is a refusal, never a thrown stack trace', async () => {
		// THE SIBLING OF `writeFile`'s SAME CASE, AND THE PREVIOUS COMMIT WRAPPED ONE AND LEFT THE OTHER BARE.
		// Driven: `purge('sub')` on a real subdirectory threw straight out of the promise -- `ERR_FS_EISDIR`
		// under node, `EFAULT` under bun -- and BOTH messages carried the HOST'S ABSOLUTE PATH. The port's rule
		// is the same for both methods: "a refusal is a fact a step can record; a throw becomes a stack trace in
		// a record that was supposed to say what the step was not allowed to do."
		const ws = purgeable();
		await ws.writeFile('sub/inner.txt', 'x');
		const out = await ws.purge('sub');
		expect(out.purged).toBe(false);
		expect(out.purged === false && out.refusedBecause).toMatch(/could not be purged/);
		// AND IT NAMES THE ERRNO CODE, NOT THE HOST'S FILESYSTEM. The absolute path of the workspace on this
		// machine belongs in nothing a step records, and a wrapped cause is the one place it leaks by accident.
		expect(
			out.purged === false && out.refusedBecause,
			'the host absolute path must not travel in a recorded refusal'
		).not.toContain(resolvePath(dir));
		expect(out.purged === false && out.refusedBecause).toContain("'sub'");
		// AND THE DIRECTORY IS INTACT: a refusal that also deleted would satisfy every line above.
		expect(await ws.readFile('sub/inner.txt')).toBe('x');
	});

	it('⚠ a corrupt retention record is treated as NO record rather than thrown over', async () => {
		// The caller is a step that must be able to RECORD what it was refused; a parse error surfacing here
		// would be a stack trace where a retention fact belongs. The files themselves are untouched.
		const ws = purgeable();
		await ws.writeFile('a.txt', 'a');
		await writeFile(resolvePath(dir) + RECORD_BASENAME, 'not json at all', 'utf8');
		expect(await ws.list()).toEqual([{ path: 'a.txt', byteSize: 1, purged: false, nameCount: 1 }]);
		expect(await ws.readFile('a.txt')).toBe('a');
	});
});

describe('list — every path the workspace knows about, sorted so two listings are comparable', () => {
	it('⭑ walks nested directories and reports forward-slashed relative paths', async () => {
		const ws = retained();
		await ws.writeFile('b.txt', 'bb');
		await ws.writeFile('src/a.txt', 'a');
		await ws.writeFile('src/deep/c.txt', 'ccc');
		expect(await ws.list()).toEqual([
			{ path: 'b.txt', byteSize: 2, purged: false, nameCount: 1 },
			{ path: 'src/a.txt', byteSize: 1, purged: false, nameCount: 1 },
			{ path: 'src/deep/c.txt', byteSize: 3, purged: false, nameCount: 1 }
		]);
	});

	it('⭑ an empty workspace lists nothing rather than failing', async () => {
		expect(await retained().list()).toEqual([]);
	});
});

// ── ⛔ THE FILESYSTEM REALITIES AN ADVERSARY DROVE THROUGH THIS ADAPTER ──────────────────────────────────────
//
// ⭐ EVERY CASE BELOW IS THE ATTACKER'S OWN VECTOR, TYPED OUT — `.JPWB-WORKSPACE-TOMBSTONES.JSON`, a real
// `mklink /J` junction, `NUL`, `report.md:stolen` — and every one was watched FAILING against this adapter
// before a line of it changed. A fix whose test never reddened is not proved.

/** A DIRECTORY JUNCTION on Windows (`mklink /J`, no privilege required), a directory symlink elsewhere. */
async function linkDirectory(at: string, target: string): Promise<void> {
	if (process.platform === 'win32')
		execFileSync('cmd.exe', ['/c', 'mklink', '/J', at, target], { stdio: 'pipe' });
	else await symlink(target, at, 'dir');
}

describe('⛔ the filesystem realities, driven through the adapter that touches the disk', () => {
	// ── ⛔ B1 IS RETIRED HERE AND RE-DRIVEN, HARDER, IN THE STRUCTURAL BLOCK BELOW ────────────────────
	//
	// It drove `.JPWB-WORKSPACE-TOMBSTONES.JSON` against a case-SENSITIVE `===` and required a refusal. ⛔ THE
	// GUARD IT PROVED WAS THEN BEATEN BY THE NEXT SPELLING — the NTFS 8.3 ALIAS `JPWB-W~1.JSO`, which `dir /x`
	// reports verbatim against the record on this host: driven, `writeFile` answered `written: true`, the
	// directory kept its one lower-case entry, the genuine tombstone was destroyed, and `list()` went empty.
	// ⭐ A TEST THAT REQUIRES A REFUSAL CANNOT OUTLIVE THE GUARD, AND THE GUARD IS THE THING THAT WAS WRONG. The
	// successor asserts what the ARRANGEMENT makes true — all four spellings are ordinary work products and the
	// record survives every one of them — which no spelling can defeat because no spelling reaches it.

	it('⛔ B2 — a DIRECTORY JUNCTION inside the workspace reaches nothing outside it', async () => {
		// ⭑⭑ `mklink /J` NEEDS NEITHER ADMIN RIGHTS NOR DEVELOPER MODE — it ran unprivileged on this host, which
		// is why the adapter's old disclosure ("symlinks are not resolved") UNDERSTATED its own precondition: a
		// junction is not a symlink and costs an attacker nothing. Measured: `realpath` DOES resolve it
		// (`<ws>/escape/.env` -> `<container>/outside/.env`), and `lstat(escape).isSymbolicLink()` is true, so
		// containment is decidable as a FILESYSTEM property instead of a string one.
		const outside = join(container, 'outside');
		await mkdir(outside, { recursive: true });
		await writeFile(join(outside, '.env'), 'SECRET=1\n', 'utf8');
		await linkDirectory(join(dir, 'escape'), outside);

		const ws = retained();
		expect(await ws.readFile('escape/.env'), 'bytes outside the workspace stay outside it').toBeUndefined();
		const out = await ws.writeFile('escape/.env', 'OVERWRITTEN BY A STEP\n');
		expect(out.written).toBe(false);
		expect(out.written === false && out.refusedBecause).toMatch(
			/does not name a location inside this workspace/
		);
		expect(await readFile(join(outside, '.env'), 'utf8'), 'the file outside is untouched').toBe(
			'SECRET=1\n'
		);
		// ⛔ AND `list()` MUST NOT CLAIM IT. Reporting `escape/.env` as an in-workspace entry is the escape and
		// its concealment in one line — the shape `P2-l` exists for.
		await ws.writeFile('src/mine.txt', 'mine');
		expect((await ws.list()).map((e) => e.path)).toEqual(['src/mine.txt']);
	});

	it('⛔ B3 — `NUL` is REFUSED: no write is reported that cannot be read back', async () => {
		// ⭑⭑ MEASURED UNDER BUN, THE RUNTIME THIS REPOSITORY'S OWN SUITES RUN ON: `writeFileSync(<dir>/NUL, …)`
		// returns normally and the bytes are GONE — `existsSync` false, `readdirSync` empty, read-back ENOENT.
		// `writeFile` answered `{written: true, byteSize: 18}` for bytes that went to the null device, which
		// defeats the union's whole purpose from inside: a caller may not read `path` off a write that never
		// happened. ⚠ Under node the same call creates a real file, because libuv reaches the filesystem
		// through the long-path prefix that bypasses device translation — so the defect is invisible to half
		// the runtimes this source runs on, and refusing the NAME is the only form that holds on both.
		const ws = retained();
		const out = await ws.writeFile('NUL', 'SHOULD NOT VANISH\n');
		expect(out.written).toBe(false);
		expect(out.written === false && out.refusedBecause).toMatch(
			/does not name a location inside this workspace/
		);
		expect(await ws.readFile('NUL')).toBeUndefined();
		expect(await ws.list()).toEqual([]);
	});

	it('⛔ B4 — an ALTERNATE DATA STREAM is refused, so `list()` is not incomplete by construction', async () => {
		// ⭑⭑ MEASURED: `writeFileSync('report.md:stolen', …)` succeeded, `readdir` showed only `report.md`, and
		// `stat('report.md')` reported the visible file's size alone. The payload is on disk and the inventory
		// the retention story rests on does not know it exists.
		const ws = retained();
		await ws.writeFile('report.md', 'the report');
		const out = await ws.writeFile('report.md:stolen', 'PAYLOAD');
		expect(out.written).toBe(false);
		expect(out.written === false && out.refusedBecause).toMatch(
			/does not name a location inside this workspace/
		);
		expect(await ws.readFile('report.md:stolen')).toBeUndefined();
		expect(await ws.list()).toEqual([
			{ path: 'report.md', byteSize: 'the report'.length, purged: false, nameCount: 1 }
		]);
		// ⛔ AND NOT ON DISK BEHIND THE VISIBLE FILE: what `list()` reports is the whole of what is stored.
		expect(existsSync(join(dir, 'report.md:stolen'))).toBe(false);
	});

	it('⛔ a write the filesystem REJECTS is a refusal, never a thrown stack trace', async () => {
		// ⛔ THE PORT IS EXPLICIT: "MUST REFUSE, NEVER THROW … a throw becomes a stack trace in a record that was
		// supposed to say what the step was not allowed to do." Every refusal above is decided from the path;
		// this is the case that cannot be, and it must reach the same shape.
		const ws = retained();
		await ws.writeFile('build/out.txt', 'x');
		const out = await ws.writeFile('build', 'clobber the directory');
		expect(out.written).toBe(false);
		expect(out.written === false && out.refusedBecause).toMatch(/could not be written/);
		expect(await ws.readFile('build/out.txt'), 'and the directory it names is intact').toBe('x');
	});

	it('⭐ CONTROL — an ordinary work product still writes, reads, lists and purges', async () => {
		// ⛔ WITHOUT THIS, EVERY REFUSAL ABOVE IS SATISFIABLE BY "REFUSES EVERYTHING" — a durable workspace that
		// accepted nothing would pass all five while making the deliverable impossible.
		const ws = purgeable();
		const wrote = await ws.writeFile('src/report.md', 'the report\n');
		expect(wrote.written && wrote.path).toBe('src/report.md');
		expect(await ws.readFile('src/report.md')).toBe('the report\n');
		expect(await ws.list()).toEqual([{ path: 'src/report.md', byteSize: 11, purged: false, nameCount: 1 }]);
		expect((await ws.purge('src/report.md')).purged).toBe(true);
	});
});

// -- THE RECORD MOVED OUT OF THE WORKSPACE, AND THAT IS WHAT DELETES THE BREACH CLASS ----------------------
//
// TWO ADVERSARIES DEFEATED THE RESERVED-PATH GUARD IN A ROW, AND BOTH WON THE SAME WAY: they spelled the
// record's name differently from the guard while the FILESYSTEM read both spellings as the same file. First
// `.JPWB-WORKSPACE-TOMBSTONES.JSON` (case), then -- after that was folded -- the NTFS 8.3 ALIAS `JPWB-W~1.JSO`,
// which `dir /x` reports verbatim against `.jpwb-workspace-tombstones.json` on this host. PUTTING A RESERVED
// PATH INSIDE A DIRECTORY THE MODEL WRITES TO IS WHAT CREATES THAT CLASS. The record is now a SIBLING of the
// workspace directory, so there is no name a contained path can spell that reaches it -- and the guard, the
// case-folding normaliser and both breaches are gone together rather than fixed one spelling at a time.
describe('the retention record is BESIDE the workspace directory, not inside it', () => {
	/** Purge one path so a GENUINE tombstone exists to be forged over. */
	async function withGenuineTombstone() {
		const ws = purgeable();
		await ws.writeFile('logs/build.txt', 'twelve-bytes');
		await ws.purge('logs/build.txt');
		expect(await ws.list(), 'the genuine tombstone must exist before it can be forged over').toEqual([
			{ path: 'logs/build.txt', byteSize: 'twelve-bytes'.length, purged: true, nameCount: 1 }
		]);
		return ws;
	}

	it('the record is NOT a file in the workspace, and IS a file beside it', async () => {
		// THIS IS THE WHOLE FIX, AND IT IS STRUCTURAL RATHER THAN COMPARATIVE. `locate` admits only paths that
		// resolve at or under the root; the record is a sibling of the root; therefore NO admitted path is the
		// record, under any spelling, on any filesystem, without a comparison being right about anything.
		await withGenuineTombstone();
		expect(existsSync(join(dir, RECORD_BASENAME)), 'nothing inside the workspace is the record').toBe(
			false
		);
		expect(
			existsSync(resolvePath(dir) + RECORD_BASENAME),
			'and the record is beside the directory it describes'
		).toBe(true);
	});

	// THE THREE SPELLINGS THAT DEFEATED, OR FALSELY TRIPPED, THE GUARD THAT USED TO STAND HERE. Each is now an
	// ORDINARY work product: written, listed, readable -- and the retention record is untouched by all of them.
	for (const [label, spelling] of [
		['the exact record name', '.jpwb-workspace-tombstones.json'],
		['the CASE VARIANT that defeated `===` on NTFS', '.JPWB-WORKSPACE-TOMBSTONES.JSON'],
		['the NTFS 8.3 ALIAS that defeated the case-folded guard', 'JPWB-W~1.JSO'],
		// KELVIN SIGN (U+212A). `toLowerCase()` folds it to `k` and NTFS does NOT -- measured on this host: the
		// two names coexist as two files holding different bytes. The folded guard therefore REFUSED this path
		// while telling the caller it "is this workspace's own retention record", which was untrue of its input.
		// A refusal that states something false about what it was given is worse than no refusal.
		['the KELVIN SIGN spelling the normaliser over-folded', '.jpwb-wor\u212Aspace-tombstones.json']
	] as const) {
		it(`${label} is an ordinary work product, and the record survives it`, async () => {
			const ws = await withGenuineTombstone();
			const out = await ws.writeFile(spelling, 'A STEP WROTE THIS');
			expect(out.written, 'it names a location inside the workspace, so it is written').toBe(true);
			expect(await ws.readFile(spelling)).toBe('A STEP WROTE THIS');
			// THE ASSERTION THAT MATTERS IS ON THE RECORD, NOT ON THE WRITE. Driven against the previous
			// adapter, `JPWB-W~1.JSO` returned `written: true` and OVERWROTE the record: `list()` then reported
			// `forged/never-written.txt` as purged and stopped reporting `logs/build.txt` -- the "purged on
			// schedule vs never written" distinction destroyed through a name the guard could not see.
			expect(await ws.list()).toEqual([
				{ path: spelling, byteSize: 'A STEP WROTE THIS'.length, purged: false, nameCount: 1 },
				{ path: 'logs/build.txt', byteSize: 'twelve-bytes'.length, purged: true, nameCount: 1 }
			]);
		});
	}

	it('a directoryPath with NO PARENT is refused at construction, because a sibling would be inside it', () => {
		// THE ONE PRECONDITION THE SIBLING ARRANGEMENT HAS, MADE IMPOSSIBLE TO VIOLATE QUIETLY. At a volume
		// root `dirname(root) === root`, so "beside the directory" and "inside the directory" are the same
		// place and the whole guarantee above would be false. Refusing rather than falling back to a reserved
		// name inside: a workspace that silently reinstated the breach class is worse than one that will not
		// open at all.
		expect(() =>
			createFilesystemWorkspace({
				ownerKind: 'UNDERTAKING',
				ownerId: 'und_01ARZ3NDEKTSV4RRFFQ69G5PAA',
				purgeability: 'RETAINED_BY_PARTICIPATION',
				directoryPath: resolvePath(dir).slice(0, 2) + sep
			})
		).toThrow(/cannot be a workspace directory/);
	});
});

// ── ⭐⭐ `B-7` — ONE FILE MUST NOT PRODUCE TWO TRUE-SOUNDING STATEMENTS ────────────────────────────────────────
//
// DRIVEN: `writeFile('Report.md')` then `writeFile('REPORT.MD')` each answered *"Wrote N bytes to <the caller's
// own spelling>"* while `list()` reported ONE entry — and the tool description handed to the model says
// *"writing the same path again replaces it"*, so two answers read as two files while one file changed under
// it. ⛔ THE INVARIANT THAT WAS BROKEN IS EXACTLY THIS: **a path `writeFile` reports must be a path `list()`
// reports.** It is asserted below in a form that is non-vacuous on BOTH kinds of host, because the aliasing
// itself is a property of the filesystem and not of this adapter.
describe('B-7 -- writeFile reports the spelling the FILESYSTEM holds, never the caller’s', () => {
	/**
	 * Does THIS filesystem treat two case-spellings as one file? ⛔ ASKED, NEVER ASSUMED FROM `process.platform`.
	 *
	 * ⚠ A SUITE THAT HARD-CODED "WINDOWS IS CASE-INSENSITIVE" WOULD BE MAKING THIS ADAPTER'S OWN MISTAKE ONE
	 * LEVEL UP — a claim about a filesystem derived from a string rather than from the filesystem. A repository
	 * checked out onto a case-sensitive volume on Windows, or a case-insensitive one on macOS, answers the other
	 * way, and the probe below is cheap.
	 */
	async function foldsCase(): Promise<boolean> {
		const probe = join(container, 'case-probe');
		await mkdir(probe, { recursive: true });
		await writeFile(join(probe, 'Probe.txt'), 'a', 'utf8');
		return existsSync(join(probe, 'PROBE.TXT'));
	}

	it('⭐⭐ the reported path is one `list()` reports — on a case-folding host AND on a case-keeping one', async () => {
		const ws = retained();
		await ws.writeFile('Report.md', 'first');
		const second = await ws.writeFile('REPORT.MD', 'second');
		expect(second.written).toBe(true);

		const listed = (await ws.list()).map((e) => e.path);
		// ⛔ THE ASSERTION THIS BLOCK EXISTS FOR, AND IT IS NON-VACUOUS EITHER WAY: on a case-keeping host the
		// second write creates a real second file and BOTH spellings are listed; on a case-folding host there is
		// ONE file and the outcome must name the spelling that file actually has. Before the fix the
		// case-folding branch returned `REPORT.MD`, which `list()` has never reported.
		expect(second.written && listed).toContain(second.written ? second.path : '');

		if (await foldsCase()) {
			// ⭐ ONE FILE, AND THE CALLER IS TOLD SO BY GETTING BACK A SPELLING IT DID NOT SUPPLY.
			expect(listed, 'this filesystem folds case, so there is exactly one file').toEqual([
				'Report.md'
			]);
			expect(second.written && second.path).toBe('Report.md');
			expect(await ws.readFile('Report.md'), 'and the second write replaced the first').toBe('second');
		} else {
			// ⭐ TWO FILES, AND THE CALLER'S OWN SPELLING IS THE RIGHT ANSWER — the over-correction this fix is
			// most at risk of would rename a genuinely distinct file onto its neighbour.
			expect([...listed].sort(), 'this filesystem keeps case, so there are two files').toEqual([
				'REPORT.MD',
				'Report.md'
			]);
			expect(second.written && second.path).toBe('REPORT.MD');
			expect(await ws.readFile('Report.md'), 'and neither write touched the other').toBe('first');
		}
	});

	it('⭑ CONTROL — an exact re-write keeps the caller’s spelling, so this is not "rename every path"', async () => {
		// ⛔ WITHOUT THIS, `locate` is satisfied by returning the FIRST directory entry for every call — which
		// would silently redirect every write in the workspace onto one file. Same workspace, same path, twice.
		const ws = retained();
		await ws.writeFile('src/notes.md', 'one');
		const again = await ws.writeFile('src/notes.md', 'two');
		expect(again.written && again.path).toBe('src/notes.md');
		expect((await ws.list()).map((e) => e.path)).toEqual(['src/notes.md']);
	});

	it('⭑ CONTROL — a path that does not exist yet is created under the name it was GIVEN', async () => {
		// ⚠ THE ARM WHERE THE FILESYSTEM HAS NOTHING TO SAY. `heldSpelling` returns `undefined` when nothing is
		// there, and the caller's spelling is then the only honest answer — a fabricated one would name a file
		// nobody asked for. THE MUTANT: return the first listed sibling when the target is absent.
		const ws = retained();
		await ws.writeFile('sibling.txt', 'x');
		const fresh = await ws.writeFile('BrandNew.md', 'y');
		expect(fresh.written && fresh.path).toBe('BrandNew.md');
		expect((await ws.list()).map((e) => e.path)).toContain('BrandNew.md');
	});
});

// -- DISCLOSURE PROBES: THE VECTORS THIS BOUNDARY DOES **NOT** CLOSE, ASSERTED SO THE DISCLOSURE STAYS TRUE --
//
// THESE ARE NOT GUARDS AND THEY CARRY NO MUTANT. They assert the ABSENCE of a guarantee, which is exactly why
// they exist: the adapter's header tells a reader that a HARD LINK and a ROOT SWAP are open, and a disclosure
// nothing checks is a comment that rots. If a later change closes one of these, the probe REDDENS and whoever
// closed it must come back and rewrite the disclosure -- which is the outcome this repository wants, and the
// opposite of a disclosure quietly outliving the thing it described.
//
// AND THE CONTAINMENT RULING IS WHY THEY ARE DISCLOSED RATHER THAN PATCHED: this is an ORGANISATIONAL boundary
// that keeps an undertaking's work in one place and catches accidents. The SECURITY boundary is the deployment
// environment's -- see DESIGN-undertaking-execution-sandbox.md section 4.8.
describe('DISCLOSURE PROBES -- what an organisational boundary does not close', () => {
	it('a HARD LINK reads and OVERWRITES a file outside the workspace, and list() reports it as inside', async () => {
		// MEASURED, UNPRIVILEGED, ON THIS HOST. `link()` and `mklink /H` create the SAME object -- one NTFS hard
		// link, a second directory entry for one file -- and `mklink /H` needs neither administrator rights nor
		// Developer Mode; it is spelled here through `node:fs` so the probe runs on every platform. `lstat` calls the result a plain file (`isSymbolicLink()` false, `isFile()` true) and `realpath`
		// answers with THE LINK'S OWN PATH, inside the workspace -- so both filesystem questions this adapter
		// knows how to ask answer "contained". The only signal is `nlink = 2`, which says the file has a second
		// NAME and nothing at all about WHERE that name is: a lawful second link inside the workspace reports
		// the same 2. There is no userspace path comparison that closes this.
		const outside = join(container, 'outside');
		await mkdir(outside, { recursive: true });
		await writeFile(join(outside, 'secret.env'), 'SECRET=1\n', 'utf8');
		await link(join(outside, 'secret.env'), join(dir, 'link.env'));

		const ws = retained();
		expect(await ws.readFile('link.env'), 'OPEN: bytes from outside the workspace are readable').toBe(
			'SECRET=1\n'
		);
		const out = await ws.writeFile('link.env', 'OVERWRITTEN BY A STEP\n');
		expect(out.written, 'OPEN: the write is not refused').toBe(true);
		expect(
			await readFile(join(outside, 'secret.env'), 'utf8'),
			'OPEN: the file OUTSIDE the workspace now holds bytes a step wrote'
		).toBe('OVERWRITTEN BY A STEP\n');
		expect(
			(await ws.list()).map((e) => e.path),
			'STILL LISTED: the path IS in this directory, and suppressing it would under-report a file that is there'
		).toEqual(['link.env']);
		// ── ⭐⭐ `B-6` — AND THIS IS THE HALF THAT STOPPED BEING UNREPORTED ────────────────────────────────────
		//
		// ⛔ UNDER `R12` THE WRITE ABOVE IS A STATED PROPERTY and this adapter cannot take it back: granting
		// `process-execution` means arbitrary code as the server user, so the model can plant the link itself and
		// then write through the CONTAINED tool. THE FALSE INVENTORY IS NOT A STATED PROPERTY OF ANYTHING — a
		// workspace reporting a file it does not exclusively hold is a RECORD-plane defect regardless of who
		// could reach it — so `list()` now reports the filesystem's own count of the names that hold these bytes.
		// ⚠ WHAT IS STILL NOT CLAIMED: the count says the bytes are SHARED and never where the other name is. A
		// lawful second link inside this workspace reports 2 as well, and the filesystem answers "how many" to
		// this adapter and "where" to nobody. THE MUTANT: hard-code `nameCount: 1` in the filesystem adapter, as
		// the in-memory default legitimately does — the inventory goes back to asserting an exclusivity it has
		// never been able to support, and nothing else in this suite notices.
		expect(
			(await ws.list())[0]?.nameCount,
			'REPORTED: the inventory no longer claims these bytes are this workspace’s alone'
		).toBe(2);
	});

	it('⭑ CONTROL — an ORDINARY file reports nameCount 1, so the count is measured and not a flag', async () => {
		// ⛔ WITHOUT THIS, `nameCount` is satisfied by an adapter that reports 2 for everything — which would
		// make every deliverable read as shared and the field as useless as the absent one it replaced. Same
		// workspace, same call, one file written the ordinary way.
		const ws = retained();
		await ws.writeFile('ordinary.txt', 'one name only\n');
		expect((await ws.list())[0]?.nameCount).toBe(1);
	});

	it('⭑⭑ CONTROL — a SECOND LINK INSIDE the workspace also reports 2, which is why WHERE is not claimed', async () => {
		// ⭐ THE MEASUREMENT THAT BOUNDS WHAT THE FIELD MAY BE READ AS. A reader could take `> 1` for "this
		// escaped the workspace"; it does not. Both names here are inside this very workspace and the count is
		// the same 2 the escaping arrangement produces, so the honest statement is SHARED and nothing more.
		const ws = retained();
		await ws.writeFile('original.txt', 'shared bytes\n');
		await link(join(dir, 'original.txt'), join(dir, 'alias.txt'));
		const counts = (await ws.list()).map((e) => [e.path, e.nameCount]);
		expect(counts).toEqual([
			['alias.txt', 2],
			['original.txt', 2]
		]);
	});

	it('a ROOT SWAP redirects the WHOLE workspace, persistently and undetected', async () => {
		// THE JUNCTION STANDS WHERE THE WORKSPACE ROOT WAS, so `realpath(root)` resolves to the ATTACKER'S
		// directory and every child resolves under it. Containment then holds -- against the wrong root. This is
		// not the TOCTOU race the previous disclosure described: nothing is swapped mid-call, the redirection is
		// durable across processes, and it is decided before this adapter is ever constructed.
		const elsewhere = join(container, 'elsewhere');
		await mkdir(elsewhere, { recursive: true });
		await writeFile(join(elsewhere, 'planted.txt'), 'PLANTED\n', 'utf8');
		await rm(dir, { recursive: true, force: true });
		await linkDirectory(dir, elsewhere);

		const ws = retained();
		expect(await ws.readFile('planted.txt'), 'OPEN: a file nobody wrote through the workspace').toBe(
			'PLANTED\n'
		);
		const out = await ws.writeFile('injected.txt', 'A STEP WROTE HERE\n');
		expect(out.written, 'OPEN: the write is not refused').toBe(true);
		expect(existsSync(join(elsewhere, 'injected.txt')), 'OPEN: and it landed outside').toBe(true);
	});
});
