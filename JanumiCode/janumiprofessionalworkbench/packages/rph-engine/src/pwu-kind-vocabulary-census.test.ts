// PWU KIND VOCABULARY — the catalog scopes policies by a kind vocabulary the seeded work does not use.
//
// ── WHY IT EXISTS (REG-F-028) ────────────────────────────────────────────────────────────────────────────────
// REG-F-022's second instance DELIVERED `appliesToPwuKinds` to the runtime: twelve catalog policies declare which
// PWU kinds they govern, the seeding used to drop the field, and now it reaches `applicability.pwuKindConditions`
// where the §5.1 kernel can read it. That closed the delivery question and opened a better one, which only became
// visible when the applicability precondition was wired and run:
//
//   **A field can reach the runtime and still match nothing, because it names a vocabulary the runtime does not
//   speak.**
//
// The catalog says `INTENT_AND_PRODUCT_DEFINITION`; `seed-workbench.ts` gives its PWU Type the kind
// `INTENT_DEFINITION`. Same concept, different string, and `pwuKind` is a free `z.string()` with no ratified enum
// to hold either side honest — so nothing failed, nothing warned, and a kind-scoped policy silently governs
// nothing. The precondition run is what found it: it got past the floor and refused at step #56, reporting
// NOT_APPLICABLE for a PWU whose objectType the policy explicitly names.
//
// ── WHICH SIDE IS THE DRIFT, AND HOW THAT WAS SETTLED ────────────────────────────────────────────────────────
// Not by preferring the ratified-looking artifact — by finding the vocabulary in the corpus. The Field Service
// Management Reference Undertaking writes `"pwuKind": "INTENT_AND_PRODUCT_DEFINITION"`. **The catalog agrees with
// the corpus; the seeder does not.** So the repository's seeded kinds are the divergence, and the fix is a
// vocabulary migration of the seeded PWU Types — not an edit to the catalog, and not a mapping table invented
// here to make two names meet in the middle.
//
// This census does not fix it. It pins the size of it so the number can only fall, and so the next author sees
// the mismatch as a measured fact rather than rediscovering it through a refusal three layers away.
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, getObject, type EngineHandle } from './index.js';
import { seedWorkbench } from './seed-workbench.js';

/** Every PWU kind the CATALOG scopes a policy to. */
function catalogKinds(): string[] {
	const out = new Set<string>();
	for (const p of ontology.seedPolicies as ReadonlyArray<{ appliesToPwuKinds?: readonly string[] }>)
		for (const k of p.appliesToPwuKinds ?? []) out.add(k);
	return [...out].sort();
}

/**
 * Every PWU kind the SEEDED PWU Types actually carry — read from the committed EVENT LOG and the materialized
 * objects, never from `seed-workbench.ts`'s source. A census that re-reads the seeder's own constant agrees with
 * it by construction and could not have seen this divergence, which is a mismatch between what the seeder writes
 * and what the catalog expects to find.
 */
function seededKinds(engine: EngineHandle): string[] {
	const ids = new Set<string>();
	for (const e of engine.readAllEvents())
		if ((e as { aggregateType?: string }).aggregateType === 'PWU_TYPE')
			ids.add((e as unknown as { aggregateId: string }).aggregateId);
	const out = new Set<string>();
	for (const id of ids) {
		const state = getObject(engine, id) as { pwuKind?: string } | undefined;
		if (typeof state?.pwuKind === 'string') out.add(state.pwuKind);
	}
	return [...out].sort();
}

describe('PWU kind vocabulary: catalog vs seeded work (REG-F-028)', () => {
	let engine: EngineHandle;
	let seeded: string[];

	beforeAll(() => {
		let n = 0;
		engine = createEngine({
			ontology,
			now: () => '2026-08-05T00:00:00Z',
			newEventId: () => `evt_${++n}`
		});
		seedWorkbench(engine);
		seeded = seededKinds(engine);
	});

	it('CONTROL: both vocabularies are non-empty and read from their real sources', () => {
		// Two empty sets agree perfectly. This repository has shipped a census that measured nothing (REG-F-022's
		// blind reader), so the population is proven before any claim is made about it.
		expect(
			catalogKinds().length,
			'the catalog scopes no policy by kind — nothing to compare'
		).toBeGreaterThan(5);
		expect(
			seeded.length,
			'no seeded PWU Type carries a pwuKind — the census is reading nothing'
		).toBeGreaterThan(5);
	});

	it('records the divergence at its measured size, which may only fall', () => {
		const cat = catalogKinds();
		const unmatched = seeded.filter((k) => !cat.includes(k));
		const unbindable = cat.filter((k) => !seeded.includes(k));
		expect(
			unmatched,
			'these seeded kinds appear in NO catalog policy, so a kind-scoped policy can never govern work of ' +
				'this kind however correctly its objectType matches'
		).toEqual([
			'ARCHITECTURE',
			'ARCHITECTURE_CONCERN',
			'BASELINE_PROMOTION',
			'INTEGRATED_VALIDATION',
			'INTENT_DEFINITION',
			'PRODUCT_BEHAVIOR'
		]);
		expect(
			unbindable.length,
			'these catalog kinds bind to nothing the workbench seeds — authored scope that governs no work'
		).toBe(11);
	});

	it('the three that DO agree are the proof the mechanism works when the names match', () => {
		// Without this the divergence could be read as "kind scoping is broken". It is not: where the two
		// vocabularies happen to agree, a kind-scoped policy binds exactly as intended.
		expect(seeded.filter((k) => catalogKinds().includes(k))).toEqual([
			'IMPLEMENTATION_PLANNING',
			'PRODUCT_IMPLEMENTATION',
			'PRODUCT_REALIZATION'
		]);
	});

	it('the CORPUS uses the catalog vocabulary, which is what makes the seeder the drift', () => {
		// The load-bearing claim of REG-F-028's disposition, asserted rather than left in a comment: the fix
		// belongs in the seeder. If this ever fails, the direction of the migration is no longer settled.
		expect(catalogKinds()).toContain('INTENT_AND_PRODUCT_DEFINITION');
		expect(seeded).toContain('INTENT_DEFINITION');
	});
});
