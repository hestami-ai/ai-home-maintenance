// ⛔ A DURABLE STORE REACHES A TEST RUN — the record plane's half of the same defect the workspace host had.
//
// ⭐ THE ARRANGEMENT IS THIS FILE'S OWN RUNNER. `DB_PATH` was `TEST_MODE ? undefined : process.env.JPWB_DEMO_DB`,
// and `TEST_MODE` keys on `RPH_DEMO_MODE === 'test'` — which ONLY the Playwright configs set. `vitest.config.ts`
// does not. So `vitest run --project app:rph-demo` with `JPWB_DEMO_DB` set was NOT test mode by that predicate:
// driven, it produced a durable 2,719,744-byte `demo.sqlite` and reddened
// `undertaking-loader-object-type.test.ts`'s CONTROL — the order-dependence `resetEngine` exists to prevent,
// arriving through the one runner the predicate did not name.
//
// ⛔ THE FIX IS NOT A SECOND ENV CHECK. A blocklist of runners is a list that rots, and the next runner will not
// set the new key either. Durability is granted only to a process that AFFIRMS it is serving
// (`RPH_DEMO_MODE=server`); every other process — named, unnamed, or future — is in-memory BY CONSTRUCTION.
// That is the same posture `JPWB_DEMO_DB`'s own docblock already claimed and could not deliver.
//
// ⚠ `vi.stubEnv` PLUS `vi.resetModules`, NOT A PLAIN ASSIGNMENT. `workbench.ts` freezes the decision into a
// module const at import (`floor-recording.test.ts:19-21` records what that costs), so each arrangement needs a
// fresh module registry to be read at all.
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

let container = '';

function dbPath(): string {
	container = mkdtempSync(join(tmpdir(), 'jpwb-store-'));
	return join(container, 'demo.sqlite');
}

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
	// Best-effort: the sqlite driver holds the file open and Windows refuses to unlink an open file. Letting
	// EPERM through would replace a real assertion failure with a cleanup error, which is how a diagnosis is lost.
	try {
		if (container !== '') rmSync(container, { recursive: true, force: true });
	} catch {
		/* the OS still holds it; the temp directory is the backstop */
	}
	container = '';
});

/** Load a fresh `workbench.ts` under one declared mode, with the database key set. */
async function loadWorkbench(mode: string | undefined, db: string) {
	vi.resetModules();
	if (mode === undefined) vi.stubEnv('RPH_DEMO_MODE', '');
	else vi.stubEnv('RPH_DEMO_MODE', mode);
	vi.stubEnv('JPWB_DEMO_DB', db);
	return import('./workbench.js');
}

describe('⛔ the durable store is reached only by a process that DECLARES it is serving', () => {
	it('⛔ THIS RUNNER sets no mode, and gets NO file on disk even with JPWB_DEMO_DB configured', async () => {
		// ⭑⭑ THE OBSERVABLE IS A FILE, NOT A FLAG. `getArtifactStore()` constructs `SqliteArtifactStore`, whose
		// constructor opens the driver and execs the schema — so a durable store CREATES its file the moment it
		// is asked for. Asserting the absence of that file is what makes "in-memory by construction" checkable.
		const db = dbPath();
		const { getArtifactStore } = await loadWorkbench(undefined, db);
		expect(getArtifactStore().durability).toBe('PROCESS_LOCAL');
		expect(existsSync(`${db}.content.sqlite`)).toBe(false);
	});

	it('⛔ and neither does a mode nobody recognises — the arm is affirmative, not a blocklist', async () => {
		for (const mode of ['dev', 'production', 'TEST', 'Server', 'test']) {
			const db = dbPath();
			const { getArtifactStore } = await loadWorkbench(mode, db);
			expect(getArtifactStore().durability, mode).toBe('PROCESS_LOCAL');
			expect(existsSync(`${db}.content.sqlite`), mode).toBe(false);
			vi.unstubAllEnvs();
		}
	});

	it('⭐ CONTROL — a process that DECLARES `server` still gets the durable store it configured', async () => {
		// ⛔ WITHOUT THIS, BOTH REFUSALS ABOVE ARE SATISFIABLE BY "NEVER DURABLE AT ALL", which would silently
		// discard an operator's configuration and leave a permanent record naming content that evaporates —
		// the orphan `ArtifactStore.durability` exists to prevent, arriving from the other side.
		const db = dbPath();
		const { getArtifactStore } = await loadWorkbench('server', db);
		expect(getArtifactStore().durability).toBe('DURABLE');
		expect(existsSync(`${db}.content.sqlite`)).toBe(true);
	});
});
