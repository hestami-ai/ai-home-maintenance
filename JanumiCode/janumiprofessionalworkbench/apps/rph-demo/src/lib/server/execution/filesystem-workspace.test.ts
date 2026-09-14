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
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
