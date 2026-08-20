// REG-F-201 — the PWA surfaces must assert the object TYPE, and the permissive default is why.
//
// TWO SITES, ONE SHAPE, AND THE SECOND ONE INVERTS A GUARD.
//
// (1) routes/pwa/[id]/+page.server.ts:82 reads `getObject(engine, params.id)` and guards existence
//     only — the same defect fixed at the Undertaking Workbench (REG-F-199 residue 1). Here it is
//     WORSE, because of what happens next: `publicationStatus` exists only on PWAs, so on any other
//     object it is absent and line :192's `?? 'DRAFT'` FABRICATES "DRAFT". `isDraft` then unlocks the
//     full authoring surface. A guessed URL gets MORE editing surface on a non-PWA than on the real
//     seeded PWA, which is PUBLISHED and correctly shows none. It is not even ULID-guarded:
//     `/pwa/floor.reasoning-review` — a module constant — renders an ASSURANCE_POLICY as a draft PWA.
//
// (2) packages/rph-authoring/src/broker.ts:262 repeats the same `?? 'DRAFT'` fallback, and there it
//     DEFEATS AN EXPLICIT GUARD. routes/pwa/[id]/agent/+server.ts:310 refuses unless
//     `publicationStatus === 'DRAFT'` — which looks like a lifecycle check and is, for real PWAs. For
//     a non-PWA the fallback synthesizes exactly the value the guard admits, so the guard is EXACTLY
//     INVERTED: it refuses the legitimate PUBLISHED PWA and admits everything else.
//
// THE DEFAULT IS THE MECHANISM IN BOTH. A fallback chosen to be convenient ("assume DRAFT") is a
// fallback chosen to be PERMISSIVE, and it fires precisely when the object is not what the code
// thinks it is. The fix asserts the type at the read, which makes the fallback unreachable rather
// than merely unlucky.
import { describe, expect, it } from 'vitest';
import { SEED_PWA, SEED_UNDERTAKING } from '@janumipwb/rph-engine';
import { makeAuthoringBroker } from './workbench.js';
import { load } from '../../routes/pwa/[id]/+page.server.js';

const event = (id: string) => ({ params: { id } }) as unknown as Parameters<typeof load>[0];

function loadOutcome(id: string): number | { name: string; publicationStatus: string } {
	try {
		const data = load(event(id)) as unknown as {
			pwa: { name: string; publicationStatus: string };
		};
		return { name: data.pwa.name, publicationStatus: data.pwa.publicationStatus };
	} catch (e) {
		return (e as { status: number }).status;
	}
}

describe('the PWA Designer surfaces refuse an id that is not a PWA', () => {
	it('the loader refuses an UNDERTAKING id instead of rendering it as a DRAFT PWA', () => {
		expect(
			loadOutcome(SEED_UNDERTAKING),
			'/pwa/<an Undertaking id> must be REFUSED, not rendered — and never as DRAFT, which unlocks authoring'
		).toBe(404);
	});

	it('the loader refuses a guessable NON-ULID id (an assurance policy constant)', () => {
		// The ids are not all opaque: floor policy ids are module constants and appear in the corpus.
		expect(loadOutcome('floor.reasoning-review')).toBe(404);
	});

	it('CONTROL: the real PWA still loads, and reports its TRUE publication status', () => {
		// Load-bearing twice over. It proves the guard discriminates, AND it pins the inversion: the
		// genuine subject is PUBLISHED, which is exactly the value the agent endpoint's guard REFUSES —
		// so any fabricated 'DRAFT' is strictly more permissive than the truth.
		expect(loadOutcome(SEED_PWA)).toEqual({
			name: 'Product Realization',
			publicationStatus: 'PUBLISHED'
		});
	});

	it('the authoring broker returns undefined for a non-PWA rather than a fabricated DRAFT view', () => {
		expect(
			makeAuthoringBroker(SEED_UNDERTAKING).getPwa(),
			'a fabricated DRAFT view is what defeats the agent endpoint lifecycle guard'
		).toBeUndefined();
	});

	it('CONTROL: the broker still returns the real PWA, PUBLISHED and not fabricated', () => {
		expect(makeAuthoringBroker(SEED_PWA).getPwa()?.publicationStatus).toBe('PUBLISHED');
	});
});
