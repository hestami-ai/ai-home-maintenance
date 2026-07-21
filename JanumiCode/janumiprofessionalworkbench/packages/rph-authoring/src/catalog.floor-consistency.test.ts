import { describe, expect, it } from 'vitest';
// Test-only import of the server-side authority. rph-assurance is NOT browser-safe (node:crypto), which is exactly
// why the browser-safe ./catalog keeps its OWN floor id→label map (.dependency-cruiser.cjs `projections-browser-safe`
// forbids dragging rph-assurance into a browser bundle). A test file is never bundled for the browser, so it is the
// one place that may import both authorities and pin them together.
import { FLOOR_POLICY_IDS, FLOOR_POLICY_DEFINITIONS } from '@janumipwb/rph-assurance';
import { ASSURANCE_FLOOR, assurancePolicyLabel } from './catalog.js';

// F-13 drift-guard. The de-minimis floor's identity (the 3 ids) and its human labels are DELIBERATELY duplicated
// across two authorities that cannot share a runtime import: the SERVER store source (`@janumipwb/rph-assurance` —
// `FLOOR_POLICY_IDS` in floor.ts, `FLOOR_POLICY_DEFINITIONS` names in floor-policies.ts, the values seeded as the
// ASSURANCE_POLICY objects' names) and the BROWSER-safe `./catalog` `ASSURANCE_FLOOR` display map. Physical
// consolidation would break catalog's browser-safety, so the copy is retained BY DESIGN — and pinned HERE so it can
// never SILENTLY drift (a floor renamed in one authority but not the other would show two different labels in the UI
// depending on whether the store object was loaded). Un-need this guard only if floor identity is relocated to the
// rph-contracts foundation (a separate architectural increment every layer could import browser-safely).
describe('F-13 floor-policy identity drift-guard: the two justified authorities must agree', () => {
	const canonicalIds = new Set<string>(Object.values(FLOOR_POLICY_IDS));
	const storeNameById = new Map<string, string>(
		FLOOR_POLICY_DEFINITIONS.map((d) => [d.policyId, d.name])
	);

	it('the browser catalog ASSURANCE_FLOOR covers EXACTLY the canonical floor ids (no extra, none missing)', () => {
		expect(new Set(ASSURANCE_FLOOR.map((p) => p.id))).toEqual(canonicalIds);
	});

	it('every canonical floor id is defined in the server store (floor-policies.ts)', () => {
		for (const id of canonicalIds) expect(storeNameById.has(id), `store missing floor id ${id}`).toBe(true);
	});

	it('the browser display label equals the server store name for every floor policy (no drift)', () => {
		for (const p of ASSURANCE_FLOOR) {
			expect(p.label, `floor label drift for ${p.id}`).toBe(storeNameById.get(p.id));
			// The public resolver must also return that same label for a floor id.
			expect(assurancePolicyLabel(p.id)).toBe(p.label);
		}
	});
});
