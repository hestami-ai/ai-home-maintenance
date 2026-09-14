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
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath, sep } from 'node:path';
import {
	createFilesystemWorkspace,
	WORKSPACE_TOMBSTONE_RECORD
} from './filesystem-workspace.js';

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

	it("⛔ the workspace's own retention record is refused BY ITS OWN NAME, not as an escape", async () => {
		// ⚠ THE TWO REFUSALS MUST STAY DISTINGUISHABLE. A caller naming the record has not tried to escape the
		// workspace, and telling it that it did would be false — while a record a step could rewrite would let a
		// purge be made to look like a file that was never written.
		const ws = retained();
		const out = await ws.writeFile(WORKSPACE_TOMBSTONE_RECORD, '{"forged":true}');
		expect(out.written).toBe(false);
		expect(out.written === false && out.refusedBecause).toMatch(/retention record/);
		expect(out.written === false && out.refusedBecause).not.toMatch(/does not name a location inside this workspace/);
		const purge = await ws.purge(WORKSPACE_TOMBSTONE_RECORD);
		expect(purge.purged).toBe(false);
		expect(purge.purged === false && purge.refusedBecause).toMatch(/retention record/);
	});

	it('⛔ and the record never appears in `list()`, so it cannot be mistaken for the work', async () => {
		const ws = purgeable();
		await ws.writeFile('a.txt', 'a');
		await ws.purge('a.txt');
		expect((await ws.list()).map((e) => e.path)).toEqual(['a.txt']);
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
			{ path: 'logs/build.txt', byteSize: 'twelve-bytes'.length, purged: true }
		]);
		expect(existsSync(join(dir, 'logs', 'build.txt'))).toBe(false);
	});

	it('⭑ the tombstone SURVIVES A NEW WORKSPACE OBJECT — which is what a durable adapter can promise', async () => {
		// The in-memory default's own refusal discloses that it "CANNOT DISTINGUISH 'never written' from 'written
		// and lost at restart'". This adapter can, and this is the assertion that says so.
		await purgeable().writeFile('logs/build.txt', 'twelve-bytes');
		await purgeable().purge('logs/build.txt');
		expect(await purgeable().list()).toEqual([
			{ path: 'logs/build.txt', byteSize: 'twelve-bytes'.length, purged: true }
		]);
	});

	it('⚠ a REWRITE clears the tombstone, because the absence is no longer true', async () => {
		const ws = purgeable();
		await ws.writeFile('logs/build.txt', 'first');
		await ws.purge('logs/build.txt');
		await ws.writeFile('logs/build.txt', 'second-run');
		expect(await ws.readFile('logs/build.txt')).toBe('second-run');
		expect(await ws.list()).toEqual([
			{ path: 'logs/build.txt', byteSize: 'second-run'.length, purged: false }
		]);
	});

	it('⛔ purging a path that was never written REFUSES and says so — durably, not by inability to observe', async () => {
		const out = await purgeable().purge('never/written.txt');
		expect(out.purged).toBe(false);
		expect(out.purged === false && out.refusedBecause).toMatch(/nothing was purged/);
		expect(out.purged === false && out.refusedBecause).toMatch(/never written here/);
	});

	it('⚠ a corrupt retention record is treated as NO record rather than thrown over', async () => {
		// The caller is a step that must be able to RECORD what it was refused; a parse error surfacing here
		// would be a stack trace where a retention fact belongs. The files themselves are untouched.
		const ws = purgeable();
		await ws.writeFile('a.txt', 'a');
		await writeFile(join(dir, WORKSPACE_TOMBSTONE_RECORD), 'not json at all', 'utf8');
		expect(await ws.list()).toEqual([{ path: 'a.txt', byteSize: 1, purged: false }]);
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
			{ path: 'b.txt', byteSize: 2, purged: false },
			{ path: 'src/a.txt', byteSize: 1, purged: false },
			{ path: 'src/deep/c.txt', byteSize: 3, purged: false }
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
	it('⛔ B1 — the retention record is refused under a CASE VARIANT, which on NTFS is the SAME FILE', async () => {
		// ⭑⭑ THE RESERVED NAME WAS COMPARED WITH `===` AND THE FILESYSTEM COMPARES CASE-INSENSITIVELY. Measured
		// on this host: writing `.JPWB-WORKSPACE-TOMBSTONES.JSON` beside an existing
		// `.jpwb-workspace-tombstones.json` left ONE directory entry, still spelled in lower case, holding the
		// SECOND write's bytes. A genuine tombstone is destroyed and replaced by a forgery; `list()` then
		// reports the forged entry and no longer reports the path actually purged — the "purged on schedule vs
		// never written" distinction the record exists to keep, destroyed through the one name the adapter
		// believed it was refusing.
		const ws = purgeable();
		await ws.writeFile('logs/build.txt', 'twelve-bytes');
		await ws.purge('logs/build.txt');
		expect(await ws.list(), 'the genuine tombstone must exist before it can be forged over').toEqual([
			{ path: 'logs/build.txt', byteSize: 'twelve-bytes'.length, purged: true }
		]);

		const out = await ws.writeFile(
			'.JPWB-WORKSPACE-TOMBSTONES.JSON',
			'{"forged/never-written.txt":{"byteSize":4096}}'
		);
		expect(out.written).toBe(false);
		expect(out.written === false && out.refusedBecause).toMatch(/retention record/);
		// ⚠ THE REFUSAL ALONE PROVES NOTHING — a refusal that ALSO wrote would satisfy it. The record is
		// asserted through `list()`, the only surface that can tell the forgery from the fact.
		expect(await ws.list()).toEqual([
			{ path: 'logs/build.txt', byteSize: 'twelve-bytes'.length, purged: true }
		]);
		const purge = await ws.purge('.JPWB-WORKSPACE-TOMBSTONES.JSON');
		expect(purge.purged).toBe(false);
		expect(purge.purged === false && purge.refusedBecause).toMatch(/retention record/);
	});

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
			{ path: 'report.md', byteSize: 'the report'.length, purged: false }
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
		expect(await ws.list()).toEqual([{ path: 'src/report.md', byteSize: 11, purged: false }]);
		expect((await ws.purge('src/report.md')).purged).toBe(true);
	});
});
