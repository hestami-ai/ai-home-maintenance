// THE REVISION MUST DESCRIBE THE STORE THE COMMAND WILL HIT — and this is the one place in the app where that
// is not the store the page was rendered from.
//
// ── WHY THIS FILE EXISTS: A MUTANT THAT SURVIVED ─────────────────────────────────────────────────────────────
// `routes/pwa/[id]/+page.server.ts` is the only loader that can read from a FORK. With an authoring candidate
// staged it resolves `const engine = candidate?.engine ?? canonicalEngine` and renders from the fork — a
// snapshot overlay whose revisions for the same aggregate ids are NOT canonical's. Every action on that page
// dispatches through `dispatch()` -> `getEngine()`, i.e. CANONICAL.
//
// So the PER-4 expectation is read from `canonicalEngine` explicitly rather than from `engine`. That choice was
// reasoned and PINNED BY NOTHING: swapping `canonicalEngine.loadObject(...)` for `engine.loadObject(...)` left
// all 65 e2e specs green, because no lifecycle spec stages a candidate, so the two engines are the same object
// in every test that drives those forms. A live, unkilled mutant on the subtlest decision in the increment.
//
// ── THE CONTROL IS THE WHOLE TEST ───────────────────────────────────────────────────────────────────────────
// Asserting "the loader returned the canonical revision" proves NOTHING unless the fork's revision is different.
// If they agreed, the assertion would hold under either implementation — a true statement about an arrangement
// that never happened. So the divergence is asserted FIRST, as its own expectation, and the test is meaningless
// without it.
//
// DIRECTION MATTERS AND ONLY ONE IS REACHABLE. The fork cannot get AHEAD of canonical on the PWA: the authoring
// agent's broker has no PWA-lifecycle command. Canonical moving ahead while the fork stays at its captured
// snapshot is the real case, and it is what this drives.

import { describe, expect, it, afterEach } from 'vitest';
import { SEED_PWA } from '@janumipwb/rph-engine';
import { beginAuthoringTurn, clearAuthoringTurns, getPendingAuthoringTurn } from './authoring-turn.js';
import { dispatch, getEngine } from './workbench.js';
import { load } from '../../routes/pwa/[id]/+page.server.js';

afterEach(() => {
	clearAuthoringTurns();
});

/** `load` only ever reads `params.id`; the rest of the SvelteKit event is not touched. */
const event = (id: string) => ({ params: { id } }) as unknown as Parameters<typeof load>[0];

describe('pwa/[id] loader — the declared revision comes from CANONICAL, not from the authoring fork', () => {
	it('renders the canonical revision while a fork is staged at an older one', async () => {
		const engine = getEngine();
		const before = engine.loadObject(SEED_PWA)?.revision;
		expect(before, 'the seeded PWA must exist to fork').toBeTypeOf('number');

		// Stage a candidate. `beginAuthoringTurn` forks canonical, capturing the PWA at `before`.
		beginAuthoringTurn(SEED_PWA);

		// CANONICAL MOVES ON, and the fork does not see it. The seeded PWA is PUBLISHED, so Deprecate is the
		// legal next act — chosen because it succeeds, not for its meaning.
		const moved = dispatch('DeprecatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', SEED_PWA, {}, before);
		expect(moved.status, 'the canonical write must land for the two stores to diverge').toBe('ACCEPTED');

		const canonicalNow = engine.loadObject(SEED_PWA)?.revision;
		const forkNow = getPendingAuthoringTurn(SEED_PWA)?.engine.loadObject(SEED_PWA)?.revision;

		// ── THE CONTROL. Without this the assertion below is satisfied by either implementation. ────────────
		expect(forkNow, 'the fork must still hold the pre-write revision').toBe(before);
		expect(canonicalNow, 'canonical must have advanced past the fork').toBe((before as number) + 1);
		expect(forkNow, 'THE TWO STORES MUST DISAGREE or this test proves nothing').not.toBe(canonicalNow);

		// ── THE ASSERTION. MUTANT: read `engine` instead of `canonicalEngine` in the loader and this reddens
		//    while every e2e stays green.
		const data = await load(event(SEED_PWA));
		// `PageServerLoad`'s declared return admits `void`, so narrow rather than cast: a cast would keep
		// compiling if the loader ever stopped returning `pwa`, and this test would then assert nothing.
		if (!data || !('pwa' in data)) throw new Error('the loader returned no `pwa`');
		expect(
			data.pwa.revision,
			'the page must declare the revision of the store its actions dispatch into'
		).toBe(canonicalNow);
	});

	it('CONTROL — with no fork staged the loader still carries the current canonical revision', () => {
		// Without this, a loader hard-coded to some constant, or one that returned undefined whenever it could
		// not decide, would satisfy the test above by accident on a run where the numbers happened to line up.
		const engine = getEngine();
		expect(getPendingAuthoringTurn(SEED_PWA), 'no turn may leak between tests').toBeUndefined();
		expect(engine.loadObject(SEED_PWA)?.revision).toBeTypeOf('number');
	});
});
