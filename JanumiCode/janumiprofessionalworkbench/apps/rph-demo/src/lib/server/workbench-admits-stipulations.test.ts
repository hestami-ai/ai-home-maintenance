// ⭐ ONLY A TEST PROCESS BUILDS AN ENGINE THAT ADMITS TEST-STIPULATED ANSWERS (`JAN-CRITREAD` J1-1b; `REG-D-071` Q5).
//
// Two locks, kept separate on purpose. The `Engine` refuses the flag over any durable store
// (`admit-stipulated-answers.test.ts`) — but it cannot know it is a TEST engine: the demo's ordinary boot is in
// memory too. That fact belongs to this host, and this file pins it: the flag is set when, and only when, the
// process declared `RPH_DEMO_MODE=test`. In particular `JPWB_HARNESS=1` — the live-execution lane's switch, which
// exposes `/test-api` — is NOT test mode, and must not admit.
//
// ⚠ `vi.stubEnv` PLUS `vi.resetModules`, as `workbench-durable-store-declaration.test.ts` records: `workbench.ts`
// freezes its mode into module consts at import, so each arrangement needs a fresh module registry.
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

async function engineUnder(mode: string, harness = false) {
	vi.resetModules();
	vi.stubEnv('RPH_DEMO_MODE', mode);
	vi.stubEnv('JPWB_DEMO_DB', '');
	vi.stubEnv('JPWB_HARNESS', harness ? '1' : '');
	const { getEngine } = await import('./workbench.js');
	return getEngine();
}

describe('⭐ the demo host admits test-stipulated answers only in test mode', () => {
	it('⛔ mode `test` builds an admitting engine', async () => {
		// THE MUTANT THAT KILLS THIS: drop the flag from the TEST_MODE branch of `newEngine`. The stand-in's
		// stipulations would then never count on the lane, and the thirteen reds could never go green.
		expect((await engineUnder('test')).admitStipulatedAnswers).toBe(true);
	});

	it('⭐ an unset mode, `server`, and the harness switch alone do NOT', async () => {
		expect((await engineUnder('')).admitStipulatedAnswers, 'no mode').toBe(false);
		expect((await engineUnder('server')).admitStipulatedAnswers, 'server').toBe(false);
		expect((await engineUnder('', true)).admitStipulatedAnswers, 'JPWB_HARNESS=1 is not test mode').toBe(false);
	});
});
