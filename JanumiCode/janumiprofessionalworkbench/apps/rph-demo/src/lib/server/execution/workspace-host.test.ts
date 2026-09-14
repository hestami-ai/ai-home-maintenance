// JAN-EXEC Phase 2 — the victim for the HOST LIFECYCLE: where an Undertaking's workspace lives, and what the
// host wires beside it.
//
// ⭐ FOUR THINGS ARE PROVED HERE, AND THE ROADMAP NAMES ALL FOUR:
//   1. a file written by one step is readable by a LATER step in a NEW session;
//   2. the resolved working directory is the OWNER'S SUBDIRECTORY and NEVER the server's;
//   3. a path escaping the workspace is refused (and an owner id that would escape the ROOT is refused too);
//   4. test mode gets NO durable root at all.
//
// ⚠ `RPH_DEMO_MODE` IS SET OR DELETED EXPLICITLY IN EVERY CASE, never inherited. `floor-recording.test.ts`
// sets it process-wide in a `vi.hoisted` block, so a spec sharing a worker with it would otherwise read a value
// no line of this file chose — and the branch under test is exactly the one that variable decides.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath, sep } from 'node:path';
import { planProcessRun } from '@janumipwb/rph-ports';
import { resolveUndertakingSandbox } from './workspace-host.js';

const UND = 'und_01ARZ3NDEKTSV4RRFFQ69G5PAA';
const OTHER = 'und_01ARZ3NDEKTSV4RRFFQ69G5PBB';

/**
 * The DIRECTORY NAME `UND` derives to, written out rather than recomputed.
 *
 * ⛔ THE LITERAL IS THE POINT. Deriving it here with the same `createHash` call the host makes would assert
 * that the host agrees with itself, which it cannot fail to do; the 16 hex characters are what pin the
 * derivation, and a change to them is a change that strands every workspace already on disk. They are the
 * fingerprint that makes the map INJECTIVE on a case-insensitive filesystem — without it `UND-ALPHA` and
 * `und-alpha` are two ids, two strings and ONE directory.
 */
const UND_DIRECTORY = `${UND}-7b80f362d9256e03`;

// ⛔ THE DURABLE ROOT IS ONE LEVEL BELOW THE DIRECTORY THIS SPEC OWNS. The escape cases assert that nothing was
// created ABOVE the root, and with the root at the mkdtemp directory itself that assertion reaches into the
// system temp directory — which `afterEach` does not own and cannot clean. A mutation run that genuinely
// escapes (which is what proves the guard) then leaves a file behind that reddens a later run for a reason
// nothing in that run caused. Nesting means every escape this suite provokes lands inside what it deletes.
let container = '';
let root = '';
const SAVED = { mode: process.env.RPH_DEMO_MODE, db: process.env.JPWB_DEMO_DB };

beforeEach(async () => {
	container = await mkdtemp(join(tmpdir(), 'jpwb-root-'));
	root = join(container, 'workspaces');
	delete process.env.RPH_DEMO_MODE;
	delete process.env.JPWB_DEMO_DB;
});
afterEach(async () => {
	if (SAVED.mode === undefined) delete process.env.RPH_DEMO_MODE;
	else process.env.RPH_DEMO_MODE = SAVED.mode;
	if (SAVED.db === undefined) delete process.env.JPWB_DEMO_DB;
	else process.env.JPWB_DEMO_DB = SAVED.db;
	await rm(container, { recursive: true, force: true });
	// ⛔ AND THE ONE DIRECTORY THIS SUITE CAN PROVOKE OUTSIDE ITS OWN CONTAINER. The relative-root case
	// below resolves against `process.cwd()` BY CONSTRUCTION — that is the defect it exists to catch — so on
	// the run that reddens it, the escape lands in the checkout. The same reasoning as the container above:
	// every escape this suite provokes must land inside something it deletes.
	await rm(resolvePath(process.cwd(), `${RELATIVE_DB}.workspaces`), { recursive: true, force: true });
});

describe('the working directory is the OWNER\u2019S and NEVER the server\u2019s', () => {
	it('\u2b50 resolves to a SUBDIRECTORY of the durable root, named by the owner', async () => {
		const { workspace } = resolveUndertakingSandbox(UND, root);
		expect(workspace.materialization).toBe('FILESYSTEM');
		expect(workspace.directoryPath).toBe(resolvePath(join(root, UND_DIRECTORY)));
		// ⛔ A SUBDIRECTORY, not the root itself. One Undertaking owning the whole root would mean every
		// Undertaking on this host shares one directory, which is `R8`'s owner ruling silently discarded.
		expect(workspace.directoryPath?.startsWith(resolvePath(root) + sep)).toBe(true);
		expect(workspace.directoryPath).not.toBe(resolvePath(root));
	});

	it('\u26d4 and it is NOT the server\u2019s own working directory \u2014 the defect this phase exists to remove', () => {
		// ⭑⭑ THE ASSERTION THE WHOLE PHASE IS FOR. `openPiExecutionSession` hardcoded `process.cwd()` twice, so a
		// sandboxed step ran in the SvelteKit server's own source tree — i.e. inside this repository.
		const { workspace } = resolveUndertakingSandbox(UND, root);
		expect(workspace.directoryPath).not.toBe(process.cwd());
		expect(workspace.directoryPath).not.toBe(resolvePath(process.cwd()));
		// Nor anywhere INSIDE it: a directory under the checkout is the same defect with extra steps.
		expect(workspace.directoryPath?.startsWith(resolvePath(process.cwd()) + sep)).toBe(false);
	});

	it('\u2b50 the directory EXISTS as soon as it is resolved, so the deliverable is inspectable (R8)', () => {
		const { workspace } = resolveUndertakingSandbox(UND, root);
		expect(existsSync(workspace.directoryPath ?? '')).toBe(true);
	});

	it('\u2b50 two Undertakings get two directories', () => {
		expect(resolveUndertakingSandbox(UND, root).workspace.directoryPath).not.toBe(
			resolveUndertakingSandbox(OTHER, root).workspace.directoryPath
		);
	});

	it('\u2b50 the owner is the UNDERTAKING \u2014 not the plan, not the step (R8)', () => {
		// Every existing lifecycle in this repository is narrower: the producer session is disposed per work unit
		// and `beginExecute` mints a fresh plan and step per click. Step-owned, a multi-phase PWA builds seven
		// fragments instead of one product.
		const { workspace } = resolveUndertakingSandbox(UND, root);
		expect(workspace.ownerKind).toBe('UNDERTAKING');
		expect(workspace.ownerId).toBe(UND);
	});
});

describe('\u2b50 R8 \u2014 a LATER step, in a NEW session, reads what an EARLIER one wrote', () => {
	it('survives a fresh resolution, which is what "resolved per request" has to mean', async () => {
		// ⭑⭑ THE MEASURED CONSEQUENCE. The spike: with one UNDERTAKING-owned directory a SECOND step in a NEW
		// session with a NEW plan ran `node greet.js` against a file the FIRST step wrote, exit 0. Nothing in
		// this host holds a workspace across requests — a SvelteKit form action cannot — so the only thing that
		// can make this true is that the DERIVATION lands in the same place every time.
		const first = resolveUndertakingSandbox(UND, root);
		const wrote = await first.workspace.writeFile('src/greet.js', 'console.log("hi")\n');
		expect(wrote.written).toBe(true);

		const later = resolveUndertakingSandbox(UND, root);
		expect(later.workspace).not.toBe(first.workspace);
		expect(await later.workspace.readFile('src/greet.js')).toBe('console.log("hi")\n');
	});

	it('\u26d4 CONTROL \u2014 a DIFFERENT Undertaking cannot see it', async () => {
		// Without this, "the second resolution found the file" is satisfiable by one shared directory for
		// everybody — which would pass the case above while destroying the isolation it depends on.
		await resolveUndertakingSandbox(UND, root).workspace.writeFile('src/greet.js', 'mine');
		expect(
			await resolveUndertakingSandbox(OTHER, root).workspace.readFile('src/greet.js')
		).toBeUndefined();
	});

	it('\u26d4 and a path escaping the workspace is refused even through the host', async () => {
		const { workspace } = resolveUndertakingSandbox(UND, root);
		const out = await workspace.writeFile('../../escaped.txt', 'escaped');
		expect(out.written).toBe(false);
		expect(existsSync(resolvePath(root, 'escaped.txt'))).toBe(false);
		expect(existsSync(resolvePath(root, '..', 'escaped.txt'))).toBe(false);
	});
});

describe('⛔ the deliverable is RETAINED, so the host’s workspace refuses to purge (R8 / PER-8)', () => {
	it('⭐ a durable workspace REFUSES a purge, and the bytes are still there afterwards', async () => {
		// ⭑⭑ THE MUTANT THIS EXISTS FOR — AND IT SURVIVED THE FIRST RUN OF THIS SUITE, WHICH IS THE FINDING THE
		// INSTRUMENT IS FOR. Declaring the workspace `PURGEABLE_AT_EXPIRY` in the host changes nothing a read can
		// see: files are written, files are read, every other assertion in this file passes. It becomes visible
		// only by asking the workspace to DESTROY the product and requiring it to say no.
		//
		// ⚠ AND IT IS ASSERTED ON THE FILESYSTEM, NOT ON THE RETURN VALUE. A purge that refused and deleted
		// anyway would satisfy the refusal assertion alone.
		const { workspace } = resolveUndertakingSandbox(UND, root);
		await workspace.writeFile('src/index.ts', 'export const answer = 42;\n');
		const out = await workspace.purge('src/index.ts');
		expect(out.purged).toBe(false);
		expect(out.purged === false && out.refusedBecause).toMatch(/PER-8 forbids it/);
		expect(await workspace.readFile('src/index.ts')).toBe('export const answer = 42;\n');
	});

	it('⭐ and so does the IN_MEMORY one, so the declaration does not depend on configuration', async () => {
		// The retention class is a statement about what the content IS, not about where it happens to live. A
		// host that declared the configured workspace retained and the unconfigured one purgeable would make
		// `PER-8` a property of an operator's environment variable.
		const { workspace } = resolveUndertakingSandbox(UND);
		await workspace.writeFile('src/index.ts', 'export const answer = 42;\n');
		const out = await workspace.purge('src/index.ts');
		expect(out.purged).toBe(false);
		expect(out.purged === false && out.refusedBecause).toMatch(/PER-8 forbids it/);
		expect(await workspace.readFile('src/index.ts')).toBe('export const answer = 42;\n');
	});
});

describe('the durable root comes from ONE env key, and TEST MODE ignores it unconditionally', () => {
	it('\u26d4 test mode gets NO durable root at all, even with the database configured', () => {
		// ⛔ `JPWB_DEMO_DB`'s own docblock, applied verbatim: "a durable store shared across specs would make them
		// order-dependent, which is the failure mode `resetEngine` exists to prevent. So test mode is in-memory
		// by construction, not by configuration."
		process.env.RPH_DEMO_MODE = 'test';
		process.env.JPWB_DEMO_DB = join(root, 'demo.sqlite');
		const { workspace } = resolveUndertakingSandbox(UND);
		expect(workspace.materialization).toBe('IN_MEMORY');
		expect(workspace.directoryPath).toBeUndefined();
		// And nothing was created on disk to be shared between specs.
		expect(existsSync(`${join(root, 'demo.sqlite')}.workspaces`)).toBe(false);
	});

	it('\u2b50 outside test mode the root is DERIVED from JPWB_DEMO_DB, so one key configures all three planes', () => {
		// ⭑ `getArtifactStore()` derives the CONTENT plane from the RECORD plane's key the same way
		// (`${DB_PATH}.content.sqlite`). A second env key would let an operator configure a durable record whose
		// deliverable evaporates at restart — the inverse orphan `ArtifactStore.durability` exists to prevent.
		// ⛔ THE SERVING DECLARATION IS PART OF THE ARRANGEMENT NOW, and this test is where the change is visible:
		// the key still decides WHERE all three planes live, and the declaration decides WHETHER this process may
		// have a durable one at all. Setting the key alone is what a test runner does by accident.
		process.env.RPH_DEMO_MODE = 'server';
		const db = join(root, 'demo.sqlite');
		process.env.JPWB_DEMO_DB = db;
		const { workspace } = resolveUndertakingSandbox(UND);
		expect(workspace.materialization).toBe('FILESYSTEM');
		expect(workspace.directoryPath).toBe(resolvePath(join(`${db}.workspaces`, UND_DIRECTORY)));
	});

	it('\u26a0 with NO database configured the workspace is IN_MEMORY and DECLARES it', () => {
		// Lawful and disclosed, the posture `getArtifactStore()` already takes. What is lost is durability, and
		// the declaration is what stops a producer inheriting the server's directory instead.
		const { workspace } = resolveUndertakingSandbox(UND);
		expect(workspace.materialization).toBe('IN_MEMORY');
		expect(workspace.directoryPath).toBeUndefined();
		expect(workspace.ownerKind).toBe('UNDERTAKING');
	});
});

describe('\u26d4 an owner id that would escape the root is REFUSED, never substituted', () => {
	for (const hostile of ['', '..', '../elsewhere', 'a/b', '/etc', 'C:\\Windows', '.']) {
		it(`refuses '${hostile}'`, () => {
			expect(() => resolveUndertakingSandbox(hostile, root)).toThrow(
				/cannot name an Undertaking workspace directory/
			);
			// ⛔ AND NOTHING WAS CREATED. A refusal that had already made a directory would have already escaped.
			expect(existsSync(resolvePath(root, '..', 'elsewhere'))).toBe(false);
		});
	}

	it('\u2b50 CONTROL \u2014 an ordinary Undertaking id is accepted', () => {
		// Without this, every refusal above is satisfiable by "refuses everything".
		expect(resolveUndertakingSandbox(UND, root).workspace.ownerId).toBe(UND);
	});
});

describe('\u2b50 the ProcessRunner seam is WIRED, and provably INERT', () => {
	it('the host wires the REFUSING default \u2014 no real runner lands in this commit', () => {
		// ⛔ A real runner captures stdout and stderr, which REOPENS `REG-Q-066`, and roadmap rule 8 requires a
		// disclosed question to be answered in the commit that reopens it. `R7` has ruled the disposition; Phase
		// 2b implements it. Until then the host declares what it is holding.
		expect(resolveUndertakingSandbox(UND, root).runner.kind).toBe('REFUSING');
	});

	it('\u2b50 the seam is COMPLETE \u2014 a run PLANS against the owner\u2019s directory, never the server\u2019s', () => {
		// ⭑ This is what "complete" means: `planProcessRun` is the only sanctioned way to build a request, `cwd`
		// is required on one, and the only value it may carry is the workspace's OWN `directoryPath`. A host
		// assembling a request by hand would have to put something there, and the obvious something is
		// `process.cwd()`.
		const sandbox = resolveUndertakingSandbox(UND, root);
		const plan = planProcessRun({
			runner: sandbox.runner,
			workspace: sandbox.workspace,
			argv: ['node', '--version'],
			timeoutMs: 5_000
		});
		expect(plan.planned).toBe(true);
		expect(plan.planned === true && plan.request.cwd).toBe(resolvePath(join(root, UND_DIRECTORY)));
		expect(plan.planned === true && plan.request.cwd).not.toBe(process.cwd());
	});

	it('\u26d4 and it is INERT \u2014 the wired runner refuses, and carries NO exitCode field at all', async () => {
		// ⛔ `Object.hasOwn`, NOT `toBeUndefined`. `out.exitCode === undefined` passes for a runner returning
		// `{ran: true, exitCode: undefined}` — a shape claiming a command RAN while saying nothing about how it
		// went — and only the presence of the FIELD discriminates. This repository has the receipt for the
		// weaker form.
		const sandbox = resolveUndertakingSandbox(UND, root);
		const plan = planProcessRun({
			runner: sandbox.runner,
			workspace: sandbox.workspace,
			argv: ['node', '--version'],
			timeoutMs: 5_000
		});
		if (!plan.planned) throw new Error(plan.refusedBecause);
		const out = await sandbox.runner.run(plan.request);
		expect(out.ran).toBe(false);
		expect(Object.hasOwn(out, 'exitCode')).toBe(false);
		expect(out.ran === false && out.refusedBecause).toMatch(/was not run/);
	});
});

// ── ⛔ THE BREACHES AN ADVERSARY DROVE THROUGH THE HOST ──────────────────────────────────────────────────────
//
// ⭐ THREE OF THE EIGHT ARE HOST DEFECTS RATHER THAN ADAPTER ONES, and all three are about a DERIVATION that
// was trusted without being bounded: an owner id the FILESYSTEM cannot tell apart from another one, a root
// that is not absolute, and a test-mode predicate only one runner sets.

/** The one value that BUYS durability. Everything else, named or not, is in-memory by construction. */
const SERVER_MODE = 'server';
/** The attacker's configuration, verbatim: a database key that carries no root of its own. */
const RELATIVE_DB = 'jpwb-relative-root-probe.sqlite';

/**
 * What one owner id can READ at `path`, or `undefined`.
 *
 * ⚠ A REFUSAL COUNTS AS UNREACHABLE, because refusing the second id and giving it its own directory are both
 * lawful answers to a collision and only the BYTES distinguish a breach. The control below is what stops this
 * from passing because resolution refuses everything.
 */
async function reachableThroughOwner(ownerId: string, path: string): Promise<string | undefined> {
	try {
		return await resolveUndertakingSandbox(ownerId, root).workspace.readFile(path);
	} catch {
		return undefined;
	}
}

describe('⛔ two owner ids the FILESYSTEM cannot tell apart are still two Undertakings', () => {
	it('⛔ a CASE VARIANT of an owner id does not reach the first owner’s deliverable', async () => {
		// ⭑⭑ MEASURED, AND THE SUITE'S OWN DISTINCTNESS ASSERTION PASSED THROUGHOUT. `UND-ALPHA` and `und-alpha`
		// produced two DIFFERENT `directoryPath` STRINGS — so "two Undertakings get two directories" was green —
		// while NTFS gave them ONE DIRECTORY: `mkdir` of the second returned EEXIST, and a file written through
		// the first was read back through the second. The existing control cannot catch it because its two ids
		// differ by more than case.
		const first = resolveUndertakingSandbox('UND-ALPHA', root);
		await first.workspace.writeFile('src/index.ts', 'the first owner’s product\n');

		// ⛔ ASSERTED ON WHAT THE FILESYSTEM DOES, NOT ON THE STRINGS. A host that refused the second id and one
		// that gave it its own directory are both lawful answers; a host that hands it the FIRST OWNER'S BYTES
		// is not, and that is the only thing this asserts — so it holds on a case-insensitive filesystem and on
		// a case-sensitive one alike.
		expect(await reachableThroughOwner('und-alpha', 'src/index.ts')).toBeUndefined();
	});

	it('⛔ and the two directories differ UNDER THE FILESYSTEM’S OWN EQUALITY, not merely as strings', () => {
		// ⭑ THE STRING COMPARISON IS THE DEFECT ONE LEVEL UP: `'…/UND-ALPHA' !== '…/und-alpha'` is true and says
		// nothing about which directory each one opens. Case-folding both sides is what asks the question the
		// filesystem answers.
		const a = resolveUndertakingSandbox('UND-ALPHA', root).workspace.directoryPath ?? '';
		const b = resolveUndertakingSandbox('und-alpha', root).workspace.directoryPath ?? '';
		expect(a.toLowerCase()).not.toBe(b.toLowerCase());
	});

	it('⭐ CONTROL — the SAME id still resolves to the SAME directory, and reads back what it wrote', async () => {
		// ⛔ WITHOUT THIS, THE TWO ABOVE ARE SATISFIABLE BY A DERIVATION THAT NEVER REPEATS — which is `P2-g`,
		// the mutant that builds seven fragments instead of one product.
		const first = resolveUndertakingSandbox(UND, root);
		await first.workspace.writeFile('src/index.ts', 'stable\n');
		const later = resolveUndertakingSandbox(UND, root);
		expect(later.workspace.directoryPath).toBe(first.workspace.directoryPath);
		expect(await later.workspace.readFile('src/index.ts')).toBe('stable\n');
	});
});

describe('⛔ the durable root must be ABSOLUTE, or the deliverable lands in the server’s own tree', () => {
	it('⛔ a RELATIVE JPWB_DEMO_DB is REFUSED — resolved against `process.cwd()` it IS the defect this phase removes', () => {
		// ⭑⭑ THE EXACT DEFECT THIS PHASE EXISTS TO CLOSE, REACHED THROUGH CONFIGURATION RATHER THAN THROUGH AN
		// OWNER ID. `resolvePath(join(root, segment))` resolves a RELATIVE root against the process's working
		// directory, so with `JPWB_DEMO_DB=demo.sqlite` every Undertaking's workspace is a directory INSIDE THE
		// SVELTEKIT SERVER'S OWN SOURCE TREE — and `workspace-host.test.ts`'s own predicate
		// ("NOT anywhere INSIDE `process.cwd()`") required FALSE and evaluated TRUE. The suite held only
		// because every case injected an absolute root under `tmpdir()`; nothing required the DERIVED one to be
		// absolute at all.
		process.env.RPH_DEMO_MODE = SERVER_MODE;
		process.env.JPWB_DEMO_DB = RELATIVE_DB;
		expect(() => resolveUndertakingSandbox(UND)).toThrow(/absolute/);
		expect(existsSync(resolvePath(process.cwd(), `${RELATIVE_DB}.workspaces`))).toBe(false);
	});

	it('⛔ and so is a relative root handed in directly, including the Win32 spellings that only LOOK rooted', () => {
		// ⚠ `\\workspaces` AND `C:workspaces` ARE NOT ABSOLUTE ON WINDOWS. The first resolves against the
		// process's CURRENT DRIVE and the second against that drive's CURRENT DIRECTORY, so both depend on
		// exactly the state a derived root may not depend on — and `path.isAbsolute` answers TRUE for the first.
		for (const relative of ['workspaces', './workspaces', '..\\workspaces', '\\workspaces', 'C:workspaces'])
			expect(() => resolveUndertakingSandbox(UND, relative), relative).toThrow(/absolute/);
	});

	it('⭐ CONTROL — an absolute root is accepted and still lands under it', () => {
		// Without this, every refusal above is satisfiable by "refuses every root".
		const { workspace } = resolveUndertakingSandbox(UND, root);
		expect(workspace.materialization).toBe('FILESYSTEM');
		expect(workspace.directoryPath?.startsWith(resolvePath(root) + sep)).toBe(true);
	});
});

describe('⛔ durability is DECLARED by the process, not assumed from the absence of a test marker', () => {
	it('⛔ THIS RUNNER gets no durable root, and it is the runner that had never been considered', () => {
		// ⭑⭑ THE ATTACKER'S VECTOR IS THE COMMAND THAT RUNS THIS FILE. `durableWorkspaceRoot`'s arm was written
		// "TEST MODE FIRST AND UNCONDITIONALLY" and keys on `RPH_DEMO_MODE === 'test'` — which ONLY the
		// Playwright configs set. `vitest.config.ts` does not, so `vitest run --project app:rph-demo` with
		// `JPWB_DEMO_DB` set was NOT test mode by this predicate: it produced real directories on disk and a
		// durable 2,719,744-byte `demo.sqlite`, and `undertaking-loader-object-type.test.ts`'s CONTROL went red.
		// That is precisely the order-dependence `resetEngine` exists to prevent, arriving through the one
		// runner the predicate did not name.
		//
		// ⛔ THE FIX IS NOT A SECOND ENV CHECK — the next runner will not set that one either. Durability is
		// granted only to a process that AFFIRMS it is serving; everything else, named or not, is in-memory by
		// construction. This spec sets nothing, which is exactly the arrangement that broke it.
		process.env.JPWB_DEMO_DB = join(root, 'demo.sqlite');
		const { workspace } = resolveUndertakingSandbox(UND);
		expect(workspace.materialization).toBe('IN_MEMORY');
		expect(workspace.directoryPath).toBeUndefined();
		expect(existsSync(`${join(root, 'demo.sqlite')}.workspaces`)).toBe(false);
	});

	it('⛔ and an unrecognised declaration is not a server either — the arm is affirmative, not a blocklist', () => {
		// A blocklist of runners is a list that rots; this is the same rule stated from the other side, and it
		// is what makes "the next runner" safe without knowing its name.
		process.env.JPWB_DEMO_DB = join(root, 'demo.sqlite');
		for (const mode of ['', 'dev', 'production', 'TEST', 'Server', 'test']) {
			process.env.RPH_DEMO_MODE = mode;
			expect(resolveUndertakingSandbox(UND).workspace.materialization, mode).toBe('IN_MEMORY');
		}
	});
});
