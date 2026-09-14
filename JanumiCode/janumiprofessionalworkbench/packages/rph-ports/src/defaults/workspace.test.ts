// JAN-EXEC Phase 1 — the in-memory Workspace, and the retention behaviour that makes it lawful.
//
// ⭑ THE PURGE HALF IS THE POINT. The spike shipped a `Workspace` with NO `purge`, and `artifact-store.ts`'s own
// header explains why that is the wrong default for retained model content: *"a store with `put` and no `purge`
// would not make retention lawful — it would move the unlawfulness behind an interface."* A workspace holds a
// build's stdout and stderr under `R7`, which is model-adjacent content, so the same rule reaches it.
import { describe, expect, it } from 'vitest';
import { createInMemoryWorkspace } from './workspace.js';

const PURGEABLE = {
	ownerKind: 'UNDERTAKING',
	ownerId: 'und_01ARZ3NDEKTSV4RRFFQ69G5X01',
	purgeability: 'PURGEABLE_AT_EXPIRY'
} as const;

/** The same workspace, DECLARED the other way. The declaration is the only thing that differs. */
const PARTICIPATING = { ...PURGEABLE, purgeability: 'RETAINED_BY_PARTICIPATION' } as const;

describe('createInMemoryWorkspace — a working set a step can build up', () => {
	it('⭑ writes and reads back, and the declared facts are the ones the host stated', async () => {
		const ws = createInMemoryWorkspace(PURGEABLE);
		expect(ws.ownerKind).toBe('UNDERTAKING');
		expect(ws.ownerId).toBe(PURGEABLE.ownerId);
		// ⛔ IN_MEMORY IS DECLARED, NOT INFERRED FROM THE ABSENCE OF A PATH. THE MUTANT: have a consumer decide
		// materialization by probing `directoryPath === undefined` — `REG-F-333`'s defect, reading the name
		// where the property travels by shape.
		expect(ws.materialization).toBe('IN_MEMORY');
		expect(ws.directoryPath, 'an in-memory workspace has no directory to run in').toBeUndefined();
		expect(ws.purgeability).toBe('PURGEABLE_AT_EXPIRY');

		const out = await ws.writeFile('./src/greet.js', 'console.log("hi")');
		expect(out.written).toBe(true);
		expect(out.written && out.path, 'the write reports the NORMALIZED path').toBe('src/greet.js');
		expect(await ws.readFile('src/greet.js')).toBe('console.log("hi")');
		// The same file under its other lawful spelling — the normalization is what makes that true.
		expect(await ws.readFile('src\\greet.js')).toBe('console.log("hi")');
	});

	it('⛔ REFUSES an escaping write, and leaves NO entry behind', async () => {
		// THE MUTANT: throw instead of refusing. The step then records a stack trace where it should record what
		// it was not allowed to do — and `list` is the only place a reader could have seen the attempt at all.
		const ws = createInMemoryWorkspace(PURGEABLE);
		const out = await ws.writeFile('../escape.txt', 'x');
		expect(out.written).toBe(false);
		expect(out.written === false && out.refusedBecause).toMatch(/inside this workspace/);
		expect(await ws.list(), 'a refused write must not create an entry').toHaveLength(0);
	});

	it('⭑ list() is SORTED, so two listings are comparable', async () => {
		const ws = createInMemoryWorkspace(PURGEABLE);
		await ws.writeFile('b.txt', 'bb');
		await ws.writeFile('a.txt', 'a');
		expect((await ws.list()).map((e) => e.path)).toEqual(['a.txt', 'b.txt']);
		// UTF-8 bytes, measured — not `String.length`, which disagrees the moment content is not ASCII.
		await ws.writeFile('c.txt', 'é');
		expect((await ws.list()).find((e) => e.path === 'c.txt')?.byteSize).toBe(2);
	});
});

describe('Workspace.purge — the bytes go, the ENTRY stays', () => {
	it('⭑⭑ a purged read is UNDEFINED while list() still EXPLAINS the entry', async () => {
		// ⭑ THIS IS THE TOMBSTONE INVARIANT, AND IT IS THE HALF MOST LIKELY TO BE LOST IN A SECOND ADAPTER.
		// THE MUTANT: `files.delete(rel)`. `readFile` still answers undefined, so a test that checked only the
		// read would stay GREEN — and a record naming the path would then point at nothing, with a reader
		// unable to tell "purged on schedule" from "never written" from "lost".
		const ws = createInMemoryWorkspace(PURGEABLE);
		await ws.writeFile('logs/build.txt', 'warning: unused variable');
		expect(await ws.readFile('logs/build.txt')).toBeTruthy();

		expect((await ws.purge('logs/build.txt')).purged).toBe(true);
		expect(
			await ws.readFile('logs/build.txt'),
			'a purge that left the bytes readable is a fiction'
		).toBeUndefined();

		const entry = (await ws.list()).find((e) => e.path === 'logs/build.txt');
		expect(entry, 'the entry did not survive its purge').toBeDefined();
		expect(entry?.purged).toBe(true);
		// ⚠ NOT ZEROED. A byteSize of 0 reads as an EMPTY FILE, which is a different fact from "24 bytes were
		// removed from here" — and the second is the one a retention audit needs.
		expect(entry?.byteSize, 'the tombstone must still say what was removed').toBe(24);
	});

	it('⛔ REFUSES on a workspace DECLARED RETAINED_BY_PARTICIPATION — PER-8 has no exception', async () => {
		// ⭑ THE CLASS IS READ OFF THE WORKSPACE'S DECLARATION, because a path-named workspace cannot carry it in
		// the address the way the content-addressed store does. THE MUTANT: purge unconditionally. Participating
		// material is then hard-deleted by a method whose whole warrant is that retention is lawful.
		const ws = createInMemoryWorkspace(PARTICIPATING);
		await ws.writeFile('result.json', '{"exitCode":0}');
		const outcome = await ws.purge('result.json');

		expect(outcome.purged).toBe(false);
		// Assert the REASON, not just the refusal: `purge` also returns false for an absent path, so a bare
		// false cannot tell "refused because it participated" from "refused because nothing is there".
		expect(outcome.purged === false && outcome.refusedBecause).toMatch(/PER-8|participat/i);
		expect(await ws.readFile('result.json'), 'a refusal that lost the bytes anyway is worse').toBe(
			'{"exitCode":0}'
		);
	});

	it('⚠ REFUSES an absent path, and bounds the claim to what this implementation can observe', async () => {
		// THE MUTANT: report `{purged: true}` for a path that holds nothing. A purge log that cannot tell
		// "removed" from "was not there" cannot evidence that a retention policy ran, which is the only reason
		// to keep such a log.
		const ws = createInMemoryWorkspace(PURGEABLE);
		const outcome = await ws.purge('never/written.txt');
		expect(outcome.purged).toBe(false);
		expect(outcome.purged === false && outcome.refusedBecause).toMatch(/no entry is present/);
		// ⭑ AND IT DOES NOT ASSERT AN ABSENCE IT CANNOT SEE. Entries live in a Map, so a path that held bytes
		// before a restart is indistinguishable here from one that never existed.
		expect(outcome.purged === false && outcome.refusedBecause).toMatch(/lost at restart/);
	});

	it('⛔ REFUSES an escaping path rather than purging outside the workspace', async () => {
		const ws = createInMemoryWorkspace(PURGEABLE);
		const outcome = await ws.purge('../../etc/passwd');
		expect(outcome.purged).toBe(false);
		expect(outcome.purged === false && outcome.refusedBecause).toMatch(/inside this workspace/);
	});

	it('⭑ CONTROL — a REWRITE clears the tombstone, so "purged" never outlives the absence it states', async () => {
		// Without this, "once purged, always purged" would satisfy the tombstone test above while making the
		// entry state something false about a file that now holds bytes — the record defect, inverted.
		const ws = createInMemoryWorkspace(PURGEABLE);
		await ws.writeFile('a.txt', 'first');
		await ws.purge('a.txt');
		await ws.writeFile('a.txt', 'second');
		expect(await ws.readFile('a.txt')).toBe('second');
		expect((await ws.list()).find((e) => e.path === 'a.txt')?.purged).toBe(false);
	});
});
