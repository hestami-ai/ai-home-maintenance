// REG-F-199 residue (1) — /undertakings/<id> must refuse an id that is not an Undertaking.
//
// ── THE DEFECT, DRIVEN RATHER THAN REASONED ──────────────────────────────────────────────────────────────────
// The loader read `getObject(engine, params.id)` — TYPE-BLIND, `handle.loadObject(id)?.state` — and guarded only
// EXISTENCE: `if (!u) throw error(404, 'Undertaking not found')`. Executed against the seeded PWA's id it did
// not throw. It returned `undertaking.name = "Product Realization"`, THE PWA'S OWN NAME, rendered as the
// Undertaking's.
//
// Nothing downstream saved it, and the reason is worth keeping: `u.pwaId` is absent on a non-Undertaking, so the
// PWA lookup became `getObject(engine, 'undefined')` -> undefined, absorbed by the `?? ''` fallbacks; and
// `listPwus(engine, params.id)` filters on `undertakingId` and returned `[]`. Every read degraded to empty and
// the one field that DID resolve was the wrong object's name. The page did not even look broken — which is why
// this was invisible to every existing test and to two adversarial reviews of the surface.
//
// DOC-002 §34's preamble is the ratified half: the first implementation "should expose commands and queries
// rather than unrestricted CRUD". `getObject` IS that unrestricted read. §34.5 is NOT a by-name contract
// (REG-F-199 settled that), so the remedy is a typed SEAM — `getObjectOfType` — not four renamed exports.
//
// ⚠ THE CONTROL IS LOAD-BEARING AND HAS ITS OWN MUTANT. Without it, `throw error(404)` unconditionally would
// satisfy the refusal test while breaking the page for everyone. `F199-the-typed-read-refuses-every-id` names
// THIS FILE as its victim precisely so the control is the thing that reddens.
import { describe, expect, it } from 'vitest';
import { SEED_PWA, SEED_UNDERTAKING } from '@janumipwb/rph-engine';
import { load } from '../../routes/undertakings/[id]/+page.server.js';

/** `load` only ever reads `params.id`; the rest of the SvelteKit event is untouched. */
const event = (id: string) => ({ params: { id } }) as unknown as Parameters<typeof load>[0];

/**
 * The outcome as a caller sees it: either the HTTP status of a refusal, or the name that got rendered.
 * Returning the RENDERED NAME rather than a boolean is what makes the failure message name the leak
 * ("expected { rendered: 'Product Realization' } to be 404") instead of dumping the whole page payload.
 */
function loadOutcome(id: string): number | { rendered: string } {
	try {
		const data = load(event(id)) as unknown as { undertaking: { name: string } };
		return { rendered: data.undertaking.name };
	} catch (e) {
		return (e as { status: number }).status;
	}
}

describe('the Undertaking Workbench loader asserts the object TYPE, not just existence', () => {
	it('refuses an id that names a PROFESSIONAL_WORK_ARCHITECTURE rather than rendering it', () => {
		expect(
			loadOutcome(SEED_PWA),
			'/undertakings/<a PWA id> must be REFUSED, not rendered as an Undertaking'
		).toBe(404);
	});

	it('CONTROL: a real Undertaking id still renders, so the guard discriminates', () => {
		expect(loadOutcome(SEED_UNDERTAKING)).toEqual({
			rendered: 'Field Service Management SaaS Undertaking'
		});
	});

	it('and a genuinely absent id still 404s, as it always did', () => {
		// The pre-existing existence guard must survive the change: the new seam returns `undefined` for
		// BOTH "wrong type" and "no such object", and one `throw` covers both.
		expect(loadOutcome('und_01ARZ3NDEKTSV4RRFFQ69NOPE00')).toBe(404);
	});
});
