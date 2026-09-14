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
});

describe('the working directory is the OWNER\u2019S and NEVER the server\u2019s', () => {
	it('\u2b50 resolves to a SUBDIRECTORY of the durable root, named by the owner', async () => {
		const { workspace } = resolveUndertakingSandbox(UND, root);
		expect(workspace.materialization).toBe('FILESYSTEM');
		expect(workspace.directoryPath).toBe(resolvePath(join(root, UND)));
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
		expect(existsSync(join(`${join(root, 'demo.sqlite')}.workspaces`, UND))).toBe(false);
	});

	it('\u2b50 outside test mode the root is DERIVED from JPWB_DEMO_DB, so one key configures all three planes', () => {
		// ⭑ `getArtifactStore()` derives the CONTENT plane from the RECORD plane's key the same way
		// (`${DB_PATH}.content.sqlite`). A second env key would let an operator configure a durable record whose
		// deliverable evaporates at restart — the inverse orphan `ArtifactStore.durability` exists to prevent.
		const db = join(root, 'demo.sqlite');
		process.env.JPWB_DEMO_DB = db;
		const { workspace } = resolveUndertakingSandbox(UND);
		expect(workspace.materialization).toBe('FILESYSTEM');
		expect(workspace.directoryPath).toBe(resolvePath(join(`${db}.workspaces`, UND)));
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
		expect(plan.planned === true && plan.request.cwd).toBe(resolvePath(join(root, UND)));
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
