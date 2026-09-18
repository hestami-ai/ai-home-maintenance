// ⭐⭐ THE HARNESS AND THE SERVER ARE TWO QUESTIONS — `JAN-EXEC` `R24`, design §4.17.
//
// ── ⛔ WHAT COULD NOT BE ASKED BEFORE ─────────────────────────────────────────────────────────────────────────
//
// `RPH_DEMO_MODE` is single-valued, so a process could declare `test` (the `/test-api` harness exists) or
// `server` (durable store, durable workspace, REAL process runner) and never both. `JAN-EXEC` Phase 7 — build a
// product in a durable workspace, run its tests, observe the result — needs BOTH, so it was not performable at
// all. Not for want of work: for want of a way to say it.
//
// ⭑ AND THE CODEBASE HAD ALREADY NAMED THE TWO QUESTIONS. `workbench.ts` says so in terms: *"It is deliberately
// NOT the negation of `TEST_MODE`: those two are different questions. `TEST_MODE` asks whether the harness
// endpoints exist, and a process that is neither a harness nor a server (a unit runner, a script, a future tool)
// must answer NO to both."* Correct about the semantics; the encoding could not express it.
//
// ── ⛔ EVERY PREDICATE HERE IS AFFIRMATIVE, AND THAT IS A RULING THIS FILE DOES NOT REOPEN ────────────────────
//
// `workbench-durable-store-declaration.test.ts` records why: a negative predicate let `vitest run` with
// `JPWB_DEMO_DB` set produce a durable 2,719,744-byte `demo.sqlite` and redden another spec's CONTROL, because
// *"a blocklist of runners is a list that rots"*. This runner sets NEITHER declaration and must therefore get
// NEITHER capability — which is the last test below, and the one that would catch a predicate that drifted open.
//
// ⚠ `vi.stubEnv` PLUS `vi.resetModules`, for the same reason the sibling file states: `workbench.ts` freezes
// these decisions into module consts at import, so each arrangement needs a fresh module registry.
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

let container = '';

function dbPath(): string {
	container = mkdtempSync(join(tmpdir(), 'jpwb-harness-'));
	return join(container, 'demo.sqlite');
}

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
	try {
		if (container !== '') rmSync(container, { recursive: true, force: true });
	} catch {
		/* the sqlite driver still holds it open on Windows; tmpdir is the backstop */
	}
	container = '';
});

/** Load a fresh `workbench.ts` under one pair of declarations. `db` omitted leaves the key unset entirely. */
async function loadWorkbench(
	opts: { readonly mode?: string; readonly harness?: string; readonly db?: string } = {}
) {
	vi.resetModules();
	vi.stubEnv('RPH_DEMO_MODE', opts.mode ?? '');
	vi.stubEnv('JPWB_HARNESS', opts.harness ?? '');
	vi.stubEnv('JPWB_DEMO_DB', opts.db ?? '');
	return import('./workbench.js');
}

describe('⭐ R24 — a process may declare itself a harness and a server INDEPENDENTLY', () => {
	// ── `PR-1` ───────────────────────────────────────────────────────────────────────────────────────────────
	it('⭐⭐ a SERVER that also declares the harness gets BOTH — the arrangement Phase 7 needs and could not have', () => {
		// ⛔ RED AT HEAD: the harness question is asked as `RPH_DEMO_MODE === 'test'`, and this process says
		// `server`. There is no value of one variable that answers yes twice.
		return loadWorkbench({ mode: 'server', harness: '1', db: dbPath() }).then((w) => {
			expect(w.harnessExposed(), 'the harness endpoints must exist').toBe(true);
			expect(w.getArtifactStore().durability, 'and the store must still be durable').toBe('DURABLE');
		});
	});

	// ── `PR-3` — a CONTROL, and the one that stops `harnessExposed` being `() => true` ───────────────────────
	it('⛔ CONTROL — declaring `server` ALONE does not expose the harness', async () => {
		// ⚠ WITHOUT THIS, EVERY DEPLOYMENT GETS A RESET ENDPOINT. Serving is not a request to be inspected, and
		// the whole point of separating the questions is that answering one must not answer the other.
		const { harnessExposed, getArtifactStore } = await loadWorkbench({ mode: 'server', db: dbPath() });
		expect(harnessExposed()).toBe(false);
		expect(getArtifactStore().durability, 'durability is unaffected by the harness question').toBe(
			'DURABLE'
		);
	});

	// ── `PR-4` — the same control in the other direction ─────────────────────────────────────────────────────
	it('⛔ CONTROL — declaring the harness ALONE does not buy durability', async () => {
		// The declarations must stay independent in BOTH directions, or the split is a rename.
		const db = dbPath();
		const { harnessExposed, getArtifactStore } = await loadWorkbench({ harness: '1', db });
		expect(harnessExposed()).toBe(true);
		// ⭑ THE OBSERVABLE IS A FILE, NOT A FLAG — the sibling file's rule. A durable store CREATES its file the
		// moment it is asked for, so the absence of that file is what makes "in-memory" checkable.
		expect(getArtifactStore().durability).toBe('PROCESS_LOCAL');
		expect(existsSync(`${db}.content.sqlite`)).toBe(false);
	});

	// ── `PR-5` — THIS runner, which is the defect the affirmative shape exists to prevent ────────────────────
	it('⛔ CONTROL — a process declaring NEITHER gets neither, including this very test runner', async () => {
		const db = dbPath();
		const { harnessExposed, getArtifactStore } = await loadWorkbench({ db });
		expect(harnessExposed(), 'vitest declares nothing and must be offered nothing').toBe(false);
		expect(getArtifactStore().durability).toBe('PROCESS_LOCAL');
		expect(existsSync(`${db}.content.sqlite`)).toBe(false);
	});

	it('⭑ the legacy declaration still answers YES — `test` mode IS a harness', async () => {
		// ⚠ A COMPATIBILITY ASSERTION, AND IT IS LOAD-BEARING. Every gated e2e spec depends on `/test-api` under
		// `RPH_DEMO_MODE=test`; a split that stopped answering yes there would take the whole browser suite with
		// it, and would do so at the step AFTER this file.
		const { harnessExposed } = await loadWorkbench({ mode: 'test' });
		expect(harnessExposed()).toBe(true);
	});

	it('⛔ and an unrecognised harness value is NOT a harness — affirmative, never truthy-ish', async () => {
		// `'0'`, `'false'` and `'no'` are all truthy strings. A predicate written as `Boolean(env.JPWB_HARNESS)`
		// would answer YES to every one of them, which is how an operator disables something and gets it anyway.
		for (const value of ['0', 'false', 'no', 'TRUE', 'yes']) {
			const { harnessExposed } = await loadWorkbench({ harness: value });
			expect(harnessExposed(), value).toBe(false);
			vi.unstubAllEnvs();
		}
	});
});

describe('⛔ R24 — reset is for DISPOSABLE state, and refuses a durable store', () => {
	// ── `PR-2` ───────────────────────────────────────────────────────────────────────────────────────────────
	it('⛔ resetEngine REFUSES when the store is durable, naming what it would have destroyed', async () => {
		// ⛔ THE HAZARD IS CREATED BY `R24` AND IT IS MINE TO CLOSE. Before the split, a harness process was
		// in-memory BY CONSTRUCTION (`DB_PATH` is gated on `SERVING`), so `/test-api/reset` destroyed nothing on
		// disk. A process that is now BOTH could wipe a real store and real workspaces.
		//
		// ⭑ AND THE RULE IS THE REPOSITORY'S OWN, NOT A NEW POLICY. `JPWB_DEMO_DB`'s docblock already says the
		// two are contradictory: *"a durable store shared across specs would make them order-dependent, which is
		// the failure mode `resetEngine` exists to prevent."* Refusing the combination states that.
		const { resetEngine } = await loadWorkbench({ mode: 'server', harness: '1', db: dbPath() });
		expect(() => resetEngine('empty')).toThrow(/durable/i);
	});

	it('⭑ CONTROL — reset still works for the harness it was built for', async () => {
		// Without this, the refusal above is satisfied by a `resetEngine` that throws unconditionally — which
		// would take every gated e2e spec with it, since `resetEngine` is what `/test-api/reset` calls.
		const { resetEngine } = await loadWorkbench({ mode: 'test' });
		expect(() => resetEngine('empty')).not.toThrow();
	});
});

describe('⭐ R24 — the ENDPOINT, not the predicate behind it', () => {
	// ⚠ THE PREDICATE TESTS ABOVE GO RED AT HEAD FOR A WEAK REASON: `harnessExposed` does not exist, so they
	// fail to resolve rather than failing to agree. THIS one is red for the reason that matters — the endpoint
	// a live lane actually calls answers 404 in the one configuration Phase 7 needs, and it would keep doing so
	// if the new predicate were written and never wired.
	const introspect = async (mode: string, harness: string) => {
		vi.resetModules();
		vi.stubEnv('RPH_DEMO_MODE', mode);
		vi.stubEnv('JPWB_HARNESS', harness);
		vi.stubEnv('JPWB_DEMO_DB', '');
		const { GET } = await import('../../routes/test-api/introspect/+server.js');
		return GET({} as never);
	};

	it('⭐⭐ /test-api/introspect RESPONDS to a server that declares the harness', async () => {
		const res = await introspect('server', '1');
		expect((res as Response).status, 'the endpoint Phase 7 observes through').toBe(200);
	});

	it('⛔ CONTROL — and still 404s for a server that does NOT declare it', async () => {
		// The refusal must survive the fix, or `R24` hands every deployment an introspection endpoint.
		await expect(introspect('server', '')).rejects.toMatchObject({ status: 404 });
	});
});

// ── ⭐⭐ WHAT AN ADVERSARIAL REVIEW FOUND IN `R24` AFTER ITS OWN TESTS WERE GREEN ───────────────────────
//
// ⛔ THE TEN TESTS ABOVE PASSED AND THE CHANGE STILL HAD FOUR DEFECTS. Every one is the same class — a rule
// stated in the design and applied to fewer things than it governs — which is why they are kept here together
// rather than filed as unrelated fixes.
describe('⛔ R24 — the review findings, each one a rule applied to fewer things than it governed', () => {
	// ⚠ TWO STATIC IMPORTS, NOT ONE TEMPLATED PATH. Vite resolves dynamic imports at BUILD time and refuses an
	// interpolated specifier outright (`Unknown variable dynamic import`), so the route must be named literally.
	const routeModule = (route: 'reset' | 'dispatch') =>
		route === 'reset'
			? import('../../routes/test-api/reset/+server.js')
			: import('../../routes/test-api/dispatch/+server.js');

	const post = async (route: 'reset' | 'dispatch', mode: string, harness: string, db: string) => {
		vi.resetModules();
		vi.stubEnv('RPH_DEMO_MODE', mode);
		vi.stubEnv('JPWB_HARNESS', harness);
		vi.stubEnv('JPWB_DEMO_DB', db);
		const mod = (await routeModule(route)) as { POST: (e: never) => Promise<Response> };
		return mod.POST({
			request: new Request('http://localhost/test-api/' + route, { method: 'POST', body: '{}' })
		} as never);
	};

	it('⭐⭐ a refused reset has destroyed NOTHING — the guard runs before `clearAuthoringTurns`', async () => {
		// ⛔ THE SHARPEST OF THE FOUR, AND IT IS THE SHAPE `resetEngine`'s OWN COMMENT NAMES. The route called
		// `clearAuthoringTurns()` FIRST and `resetEngine()` second, and the refusal lived inside the latter — so a
		// refused reset had already closed every in-flight authoring turn and deleted it, with nothing recording
		// that the work existed (`discardAuthoringTurn`: *"No compensating Command is needed because canonical
		// state never changed"*). A guard that refuses after the first destructive step is not a guard.
		//
		// ⚠ THE OBSERVABLE IS THE TURN, NOT THE STATUS. Asserting only the 409 would pass for the defective
		// ordering too, because the defective ordering ALSO ended in a refusal — it just destroyed something on
		// the way. This is `SPEC-001-INV-14`'s partial application, one layer up from where Phase 6c met it.
		const db = dbPath();
		vi.resetModules();
		vi.stubEnv('RPH_DEMO_MODE', 'server');
		vi.stubEnv('JPWB_HARNESS', '1');
		vi.stubEnv('JPWB_DEMO_DB', db);
		const turns = await import('./authoring-turn.js');
		const { getEngine } = await import('./workbench.js');
		const { listByType } = await import('@janumipwb/rph-engine');
		// ⭑ A SEEDED PWA, READ FROM THE STORE. `beginAuthoringTurn` refuses an id that names nothing — correctly —
		// and a literal id would make this test depend on a constant the seed is free to change.
		const pwaId = listByType(getEngine(), 'PROFESSIONAL_WORK_ARCHITECTURE')[0]?.id;
		expect(pwaId, 'the serving boot seeds a reference workbench with at least one PWA').toBeDefined();
		turns.beginAuthoringTurn(pwaId!);
		expect(turns.getPendingAuthoringTurn(pwaId!), 'precondition: a turn is in flight').toBeDefined();

		const mod = await import('../../routes/test-api/reset/+server.js');
		await expect(
			(mod as { POST: (e: never) => Promise<Response> }).POST({
				request: new Request('http://localhost/test-api/reset', { method: 'POST', body: '{}' })
			} as never)
		).rejects.toMatchObject({ status: 409 });

		expect(
			turns.getPendingAuthoringTurn(pwaId!),
			'the refused reset must not have discarded the professional\u2019s in-flight work'
		).toBeDefined();
		turns.discardAuthoringTurn(pwaId!);
	});

	it('⭐ the refusal reaches the caller as a 409, not a 500 “Internal Error”', async () => {
		// `resetEngine` threw a bare `Error`, which SvelteKit renders as a 500 whose body is `{"message":
		// "Internal Error"}` — so the reasoning written for the operator never reached them. That is this
		// repository's own rule about passing a tool's verbatim message, applied to an HTTP boundary.
		const db = dbPath();
		await expect(post('reset', 'server', '1', db)).rejects.toMatchObject({
			status: 409,
			body: { message: expect.stringContaining('DURABLE') }
		});
	});

	it('⛔ `/test-api/dispatch` refuses a durable store too — it is a WRITE, and the rule governs writes', async () => {
		// ⛔ `R24` CLASSIFIED `introspect` (read) AND `reset` (destructive) AND LEFT THIS ONE OUT. It is a write
		// channel into the permanent, append-only record, and it was moved into a newly reachable durable
		// configuration with no guard, no test and no disclosure while its sibling in the same enumerated set
		// got all four. *"Read affordances compose with durability; destructive ones do not"* — and a rule
		// applied to two of three members of a set it names is the defect this programme keeps finding.
		const db = dbPath();
		await expect(post('dispatch', 'server', '1', db)).rejects.toMatchObject({ status: 409 });
	});

	it('⭑ CONTROL — both endpoints still work for the in-memory harness the gate runs on', async () => {
		// ⚠ WITHOUT THIS, THE TWO REFUSALS ABOVE ARE SATISFIED BY ENDPOINTS THAT REFUSE EVERYTHING — which would
		// take the entire gated browser suite with them, since every spec resets between cases and several stage
		// state through `/test-api/dispatch`.
		expect((await post('reset', 'test', '', '')).status).toBe(200);
		expect((await post('dispatch', 'test', '', '')).status).toBe(200);
	});
});
